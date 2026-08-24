// ============================================================================
// pdf-text.ts — Free embedded-text extraction from PDFs (Tier 1).
// ============================================================================
//
// Most SDS documents are digitally generated, meaning their text is already
// embedded in the file. pdfjs-dist can pull that text out directly — instant,
// free, unlimited, and MORE accurate than vision AI or OCR because it reads
// the exact characters instead of interpreting pixels.
//
// This is the first tier of the auto-fill extraction pipeline:
//   Tier 1: embedded text  (this file)      — digital PDFs (~90% of SDS docs)
//   Tier 2: OCR            (src/lib/ocr.ts) — scanned/image-only PDFs
//   Tier 3: vision AI      (ai-vlm.ts)      — fallback for hard documents
// ============================================================================

import { getDocument, type PDFDocumentProxy } from "pdfjs-dist/legacy/build/pdf.mjs";

export interface PdfTextResult {
  /** Extracted text per page ("" for pages with no embedded text). */
  pages: string[];
  /** Total characters across all extracted pages. */
  totalChars: number;
  /** Total pages in the document. */
  numPages: number;
}

/**
 * Extract the embedded text layer from a PDF buffer.
 *
 * @param pdfBuffer - Raw PDF bytes (validated by magic bytes upstream).
 * @param maxPages - Cap on pages to read (default 5, matching the VLM path).
 * @returns Per-page text and a total character count used by the pipeline's
 *          "is this a scanned document?" heuristic.
 */
export async function extractPdfText(
  pdfBuffer: Buffer,
  maxPages = 5
): Promise<PdfTextResult> {
  const data = new Uint8Array(pdfBuffer);

  let doc: PDFDocumentProxy | null = null;
  try {
    doc = await getDocument({
      data,
      disableWorker: true,
      verbosity: 0,
    } as Parameters<typeof getDocument>[0]).promise;

    const pageCount = Math.min(doc.numPages, maxPages);
    const pages: string[] = [];

    for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
      const page = await doc.getPage(pageNum);
      try {
        // getTextContent() returns text items in reading order; hasEOL marks
        // line breaks so we can preserve paragraph structure for the parser.
        const content = await page.getTextContent();
        let pageText = "";
        for (const item of content.items) {
          if (!("str" in item)) continue;
          pageText += item.str;
          if ("hasEOL" in item && item.hasEOL) {
            pageText += "\n";
          } else if (item.str && !item.str.endsWith(" ")) {
            pageText += " ";
          }
        }
        pages.push(pageText.trim());
      } finally {
        page.cleanup();
      }
    }

    return {
      pages,
      totalChars: pages.reduce((sum, p) => sum + p.length, 0),
      numPages: doc.numPages,
    };
  } finally {
    if (doc) {
      try {
        await (doc as unknown as { destroy: () => Promise<void> }).destroy();
      } catch {
        // Ignore cleanup errors.
      }
    }
  }
}
