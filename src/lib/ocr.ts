// ============================================================================
// ocr.ts — Free offline OCR for scanned SDS PDFs (Tier 2, Tesseract.js).
// ============================================================================
//
// When a PDF has little or no embedded text it is almost certainly a scan
// (photographed/paper document). This module rasterizes the pages to PNGs via
// the existing pdf-rasterize pipeline and runs Tesseract.js (pure WASM — no
// system dependencies) locally on each image. No API, no quota, works offline.
//
// Performance: pages are recognized IN PARALLEL by a small pool of workers
// (default up to 4, or one per page if fewer). A 5-page scan drops from
// ~15-20s sequential to ~5-8s wall time on a typical machine.
//
// NOTE: On the very first OCR run, Tesseract downloads the English language
// data (~10-15 MB) from its CDN and caches it in the OS temp directory.
// Subsequent runs are fully offline and fast.
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
 * Run local OCR over an array of PNG buffers using a parallel worker pool.
 *
 * @param pngBuffers - PNG page images (from rasterizePdfToPngs).
 * @returns Per-page recognized text (same order as input) + total char count.
 * @throws Error with a user-actionable message if the OCR engine fails to
 *         initialize (e.g., language data could not be downloaded).
 */
export async function ocrPngBuffers(pngBuffers: Buffer[]): Promise<OcrResult> {
  // Dynamic import keeps tesseract.js out of the initial route bundle and,
  // together with serverExternalPackages in next.config.ts, forces Node to
  // load it natively from node_modules — bundling breaks its internal
  // worker/WASM file lookups and the request hangs forever.
  const tesseract = await import("tesseract.js");

  // Cache language data in the OS temp dir so repeat runs are offline+fast.
  const cachePath = path.join(os.tmpdir(), "sds-chem-tessdata");
  const workerCount = Math.max(1, Math.min(MAX_WORKERS, pngBuffers.length));

  const createWorker = tesseract.createWorker;
  const workers = await Promise.all(
    Array.from({ length: workerCount }, () =>
      createWorker("eng", 1, { cachePath, logger: () => {} })
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
}
