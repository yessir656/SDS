// ============================================================================
// pdf-rasterize.ts — Pure-JavaScript PDF → PNG rasterization.
// ============================================================================
//
// Replaces the previous pdftoppm (Poppler) system dependency with a fully
// npm-based solution using pdfjs-dist + @napi-rs/canvas.
//
// Why:
//   - No system packages to install (no sudo, no brew, no PATH tweaks).
//   - Clone + `bun install` → auto-fill works on any OS.
//   - @napi-rs/canvas ships pre-built native binaries, so no compilation.
//
// API:
//   rasterizePdfToPngs(buffer, { maxPages, scale }) → Promise<Buffer[]>
//     Returns an array of PNG image buffers (one per page, up to maxPages).
//
//   The PNG buffers are ready to base64-encode for the VLM image_url content.
// ============================================================================

import { getDocument, type PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";
import { createCanvas, GlobalFonts } from "@napi-rs/canvas";

// Ensure font rendering works for CJK / special characters in PDFs.
// @napi-rs/canvas ships with a default font; this is a no-op guard.
void GlobalFonts;

export interface RasterizeOptions {
  /** Maximum number of pages to render (default: 5). */
  maxPages?: number;
  /** Render scale — 2.0 ≈ 150 DPI on a standard 72 DPI PDF viewport (default: 2.0). */
  scale?: number;
}

/**
 * Rasterize a PDF buffer into an array of PNG image buffers.
 *
 * @param pdfBuffer - Raw PDF file bytes (validated by magic bytes %PDF- upstream).
 * @param opts.maxPages - Cap on pages to render (default 5, to bound VLM cost).
 * @param opts.scale   - Zoom factor for rendering (default 2.0 ≈ 150 DPI).
 * @returns Array of PNG Buffers, one per rendered page, in page order.
 *
 * @throws Error if the PDF cannot be parsed or rendered.
 */
export async function rasterizePdfToPngs(
  pdfBuffer: Buffer,
  opts: RasterizeOptions = {}
): Promise<Buffer[]> {
  const maxPages = opts.maxPages ?? 5;
  const scale = opts.scale ?? 2.0;

  // pdfjs-dist accepts a Uint8Array. The buffer must not be transferred /
  // detached, so we pass a copy to be safe.
  const data = new Uint8Array(pdfBuffer);

  let doc: PDFDocumentProxy | null = null;
  try {
    doc = await getDocument({
      data,
      // Disable worker thread — we're in Node.js, not a browser. pdfjs will
      // run the parsing on the main thread which is fine for our use case.
      disableWorker: true,
      // Suppress verbose console warnings from pdfjs (e.g. font fallback).
      verbosity: 0,
    }).promise;

    const pageCount = Math.min(doc.numPages, maxPages);
    const pngs: Buffer[] = [];

    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await doc.getPage(pageNum);
      const viewport = page.getViewport({ scale });

      // Create a canvas matching the page dimensions at the chosen scale.
      const canvas = createCanvas(viewport.width, viewport.height);
      const ctx = canvas.getContext("2d");

      // pdfjs render() expects a CanvasRenderingContext2D-like object.
      // @napi-rs/canvas's context is compatible with pdfjs's type expectations,
      // but TypeScript needs a cast since the types don't perfectly align.
      await page.render({
        canvasContext: ctx as unknown as CanvasRenderingContext2D,
        viewport,
        // Use the default white background for SDS pages (most are white).
        background: "#ffffff",
      }).promise;

      // Export the canvas as a PNG buffer.
      const pngBuffer = canvas.toBuffer("image/png");
      pngs.push(pngBuffer);

      // Clean up the page reference to free memory.
      page.cleanup();
    }

    return pngs;
  } finally {
    // Always destroy the document to release memory.
    if (doc) {
      try {
        await doc.destroy();
      } catch {
        // Ignore cleanup errors.
      }
    }
  }
}
