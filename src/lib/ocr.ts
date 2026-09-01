// ============================================================================
// ocr.ts — Free offline OCR for scanned SDS PDFs (Tier 2, Tesseract.js).
// ============================================================================
//
// When a PDF has little or no embedded text it is almost certainly a scan
// (photographed/paper document). This module rasterizes the pages to PNGs via
// the existing pdf-rasterize pipeline and runs Tesseract.js (pure WASM — no
// system dependencies) locally on each image. No API, no quota, works offline.
//
// OFFLINE GUARANTEE: the English language data is BUNDLED with the app at
// <project>/tessdata/eng.traineddata.gz — no CDN download is ever attempted,
// so OCR works with the network fully disconnected. (Previously the data was
// fetched from tessdata.projectnaptha.com on first use and cached in the OS
// temp dir; Windows temp cleanup could wipe it, leaving offline OCR hanging
// on a CDN fetch that can never complete.)
//
// HANG GUARD: the whole batch runs under a hard deadline. Tesseract's worker
// can block indefinitely if something goes wrong (bad data, worker crash) —
// on timeout we reject with a clear error so the extraction route can fall
// back to the AI tier / report a notice instead of spinning forever.
//
// Performance: pages are recognized IN PARALLEL by a small pool of workers
// (default up to 4, or one per page if fewer). A 5-page scan drops from
// ~15-20s sequential to ~5-8s wall time on a typical machine.
// ============================================================================

import os from "os";
import path from "path";

export interface OcrResult {
  /** Recognized text per input image, in order. */
  pages: string[];
  /** Total characters recognized across all pages. */
  totalChars: number;
}

/** Upper bound on concurrent OCR workers (each is a WASM thread + ~50MB RAM). */
const MAX_WORKERS = 4;

/**
 * Hard wall-clock deadline for the entire OCR batch (init + all pages).
 * A healthy 5-page batch finishes in well under 30s; 90s means something is
 * wedged (e.g. a corrupted worker) and we should fail loudly, not hang.
 */
const OCR_DEADLINE_MS = 90_000;

/**
 * Run local OCR over an array of PNG buffers using a parallel worker pool.
 *
 * @param pngBuffers - PNG page images (from rasterizePdfToPngs).
 * @returns Per-page recognized text (same order as input) + total char count.
 * @throws Error with a user-actionable message if the engine fails to
 *         initialize or the deadline is exceeded.
 */
export async function ocrPngBuffers(pngBuffers: Buffer[]): Promise<OcrResult> {
  // No pages means nothing to recognize — return before initializing
  // Tesseract so an empty PDF/scan doesn't spin up a worker pool for nothing.
  if (pngBuffers.length === 0) {
    return { pages: [], totalChars: 0 };
  }

  // Dynamic import keeps tesseract.js out of the initial route bundle and,
  // together with serverExternalPackages in next.config.ts, forces Node to
  // load it natively from node_modules — bundling breaks its internal
  // worker/WASM file lookups and the request hangs forever.
  const tesseract = await import("tesseract.js");

  // Language data ships with the repo — fully offline, no CDN.
  const langPath = path.join(process.cwd(), "tessdata");
  // Worker-level cache dir (harmless; data is read from the repo bundle).
  const cachePath = path.join(os.tmpdir(), "sds-chem-tessdata");
  const workerCount = Math.max(1, Math.min(MAX_WORKERS, pngBuffers.length));

  const deadline = new Promise<never>((_, reject) => {
    setTimeout(
      () =>
        reject(
          new Error(
            `Local OCR timed out after ${OCR_DEADLINE_MS / 1000}s — the engine appears wedged. Try "Retry with AI", or restart the server.`
          )
        ),
      OCR_DEADLINE_MS
    );
  });

  const run = async (): Promise<OcrResult> => {
    const createWorker = tesseract.createWorker;
    const workers = await Promise.all(
      Array.from({ length: workerCount }, () =>
        createWorker("eng", 1, { langPath, cachePath, logger: () => {} })
      )
    );

    try {
      const pages: string[] = new Array(pngBuffers.length).fill("");

      // Round-robin pages across workers; each worker handles its share serially.
      await Promise.all(
        workers.map(async (worker, w) => {
          for (let i = w; i < pngBuffers.length; i += workerCount) {
            const { data } = await worker.recognize(pngBuffers[i]);
            pages[i] = (data.text ?? "").trim();
          }
        })
      );

      return {
        pages,
        totalChars: pages.reduce((sum, p) => sum + p.length, 0),
      };
    } finally {
      await Promise.allSettled(workers.map((w) => w.terminate()));
    }
  };

  return Promise.race([run(), deadline]);
}
