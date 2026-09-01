/// <reference types="bun-types" />
// ============================================================================
// ocr.test.ts — spec for the OFFLINE contract of the local OCR engine.
//
// Seam under test (agreed):
//   The public function ocrPngBuffers() must be runnable with NO network.
//   Concretely:
//     1. Tesseract's language data is loaded from the repo-bundled
//        ./tessdata directory, not from any CDN URL.
//     2. The bundled data file exists on disk (otherwise (1) is hollow).
//     3. The OCR code path itself never performs a network request — it
//        cannot, because (1) routes data from the repo and (2) makes that
//        the only possible source.
//
// We do NOT call Tesseract against a real SDS scan here. The slow end-to-end
// pass belongs to the admin extract route's own integration test, not to
// every `bun test` run. These tests pin the offline contract so a future
// refactor that re-introduces a CDN fetch (the bug that broke offline OCR on
// Windows in the first place) fails CI immediately.
// ============================================================================

import { describe, test, expect } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ocrPngBuffers } from "./ocr";

// Anchor to this file's own directory (src/lib) rather than process.cwd(),
// so the test survives being launched from a subdirectory (`cd src && bun test`).
const REPO_ROOT = join(import.meta.dir, "..", "..");

describe("ocr — offline language-data contract", () => {
  test("bundled tessdata directory contains eng.traineddata.gz", () => {
    // The English language model must ship with the repo, not be fetched
    // from a CDN. If this is missing, offline OCR hangs on a fetch that can
    // never complete (the historical Windows temp-cleanup bug).
    const dataPath = join(REPO_ROOT, "tessdata", "eng.traineddata.gz");
    expect(existsSync(dataPath)).toBe(true);

    // Sanity: it's a real gzip file (gzip magic bytes 0x1f 0x8b). A zero-byte
    // placeholder would pass existsSync and silently break OCR at runtime.
    const head = readFileSync(dataPath).subarray(0, 2);
    expect(head[0]).toBe(0x1f);
    expect(head[1]).toBe(0x8b);
  });

  test("ocr.ts source contains no http/https/fetch call paths", () => {
    // Defense-in-depth: even if the langPath wiring changes, the OCR module
    // itself must never reach the network. A grep of the source is the
    // cheapest way to keep this guarantee honest in CI.
    const src = readFileSync(join(REPO_ROOT, "src/lib/ocr.ts"), "utf8");
    expect(src).not.toMatch(/\bfetch\s*\(/);
    expect(src).not.toMatch(/https?:\/\//);
    // Tesseract.js takes langPath as a filesystem path; we set it from
    // process.cwd(). A future "load from URL" change would show up here.
    expect(src).toContain("langPath");
  });
});

describe("ocrPngBuffers — input handling", () => {
  test("returns an empty result for an empty input array without crashing", async () => {
    // Edge case: zero-page PDFs (rare but possible for an empty scan).
    // We don't want this path to spin up a worker pool for nothing.
    const result = await ocrPngBuffers([]);
    expect(result.pages).toEqual([]);
    expect(result.totalChars).toBe(0);
  });
});
