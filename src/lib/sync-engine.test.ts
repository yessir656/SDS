/// <reference types="bun-types" />
// ============================================================================
// sync-engine.test.ts — spec for the OFFLINE PDF contract.
//
// Seam under test (agreed):
//   getSdsBlobForChemical(chemicalId) -> Blob | null
//
// The user contract: a user who has previously synced the app while online
// must be able to view an SDS PDF after losing WiFi. The function's offline
// behavior is:
//   1. When ONLINE: try a fresh server fetch. If it succeeds, refresh the
//      local cache and return the blob.
//   2. When OFFLINE (or the fetch throws/rejects): fall back to whatever is
//      in IndexedDB (db.sdsBlobs). Return null only if nothing was cached.
//
// We test the SEAM (this public function), not the implementation. The only
// things we control at the boundary are:
//   - the `db` module that sync-engine.ts imports (mocked),
//   - `navigator.onLine` (mutated directly),
//   - `globalThis.fetch` (replaced for the duration of the test).
// We do NOT reach into Dexie, IndexedDB, or the PDF download route. If those
// internals change, these tests should not break — that's the point.
// ============================================================================

import { describe, test, expect, beforeEach, afterEach, mock } from "bun:test";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const CHEMICAL_ID = "chem-test";
const SDS_ID = "sds-test";

// A real PDF-shaped blob. We don't actually need a valid PDF for these tests
// — we only need a Blob that round-trips through `db.sdsBlobs.put`/`get`.
// A few bytes of "%PDF-1.4" magic keep it honest.
const CACHED_PDF_BYTES = new Blob(
  [new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34])],
  { type: "application/pdf" }
);

// ---------------------------------------------------------------------------
// Mock the local-db module BEFORE importing the module under test.
// sync-engine.ts does `import { db } from "@/lib/local-db"` — we intercept
// that import so the function talks to our in-memory tables, not real IndexedDB.
// ---------------------------------------------------------------------------

const sdsBlobsTable = new Map<string, { sdsId: string; blob: Blob; version: number; cachedAt: number }>();
const sdsDocumentsTable = new Map<string, { id: string; chemicalId: string; status: string; version: number; updatedAt: number }>();

mock.module("@/lib/local-db", () => ({
  db: {
    sdsDocuments: {
      where: (field: string) => ({
        equals: (value: string) => ({
          first: async () => {
            // Honor the actual .where("chemicalId").equals(id) filter so the
            // "no SDS document" case really exercises the missing-row branch
            // instead of always returning the seeded SDS_ID row.
            for (const row of sdsDocumentsTable.values()) {
              if ((row as unknown as Record<string, unknown>)[field] === value) {
                return row;
              }
            }
            return undefined;
          },
        }),
      }),
    },
    sdsBlobs: {
      get: async (id: string) => sdsBlobsTable.get(id),
      put: async (row: { sdsId: string; blob: Blob; version: number; cachedAt: number }) => {
        sdsBlobsTable.set(row.sdsId, row);
      },
    },
  },
}));

// Now safe to import — sync-engine.ts will pick up our mock.
const { getSdsBlobForChemical } = await import("./sync-engine");

// ---------------------------------------------------------------------------
// Capture and restore global state we mutate (fetch + navigator.onLine).
// ---------------------------------------------------------------------------

const originalFetch = globalThis.fetch;
const originalOnLine = Object.getOwnPropertyDescriptor(globalThis.navigator, "onLine");

function setOnline(value: boolean) {
  Object.defineProperty(globalThis.navigator, "onLine", {
    value,
    configurable: true,
    writable: true,
  });
}

beforeEach(() => {
  sdsBlobsTable.clear();
  sdsDocumentsTable.clear();
  sdsDocumentsTable.set(SDS_ID, {
    id: SDS_ID,
    chemicalId: CHEMICAL_ID,
    status: "current",
    version: 1,
    updatedAt: Date.now(),
  });
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  if (originalOnLine) {
    Object.defineProperty(globalThis.navigator, "onLine", originalOnLine);
  }
});

// ===========================================================================
// THE KEY CONTRACT: PDF is viewable with no WiFi
// ===========================================================================

describe("getSdsBlobForChemical — offline (no WiFi) fallback", () => {
  test("returns the IndexedDB-cached PDF when fetch rejects (server unreachable)", async () => {
    // Pre-condition: a sync ran earlier and cached this PDF.
    sdsBlobsTable.set(SDS_ID, {
      sdsId: SDS_ID,
      blob: CACHED_PDF_BYTES,
      version: 1,
      cachedAt: Date.now(),
    });

    // Browser still says "online" — `navigator.onLine` reflects the network
    // interface, not server reachability. The sync-engine handles this case
    // by ATTEMPTING the fetch and falling back when it throws (which is
    // exactly what "no WiFi" looks like to a fetch() call).
    setOnline(true);

    let fetchCalled = false;
    globalThis.fetch = mock(async () => {
      fetchCalled = true;
      // Simulates: server unreachable, DNS failure, TLS error, anything that
      // prevents the request from completing. fetch() throws on these.
      throw new TypeError("Failed to fetch");
    });

    const blob = await getSdsBlobForChemical(CHEMICAL_ID);

    expect(fetchCalled).toBe(true);
    expect(blob).not.toBeNull();
    expect(blob).toBe(CACHED_PDF_BYTES);
  });

  test("returns the IndexedDB-cached PDF when navigator.onLine is false (browser reports offline)", async () => {
    // Pre-condition: PDF is cached.
    sdsBlobsTable.set(SDS_ID, {
      sdsId: SDS_ID,
      blob: CACHED_PDF_BYTES,
      version: 1,
      cachedAt: Date.now(),
    });

    setOnline(false);

    let fetchCalled = false;
    globalThis.fetch = mock(async () => {
      fetchCalled = true;
      return new Response("should not be reached", { status: 200 });
    });

    const blob = await getSdsBlobForChemical(CHEMICAL_ID);

    // The browser reports offline — we should skip the network entirely
    // (no fetch attempt) and serve from cache.
    expect(fetchCalled).toBe(false);
    expect(blob).toBe(CACHED_PDF_BYTES);
  });

  test("returns null when offline AND nothing is cached (first-launch-on-a-plane scenario)", async () => {
    // No cache. No network. This is the only "PDF not viewable offline"
    // case, and the UI should surface an alert ("SDS document is not
    // available offline") — that's handled in the detail page component,
    // not here. We just pin the seam: getSdsBlobForChemical returns null.
    setOnline(false);
    globalThis.fetch = mock(async () => {
      throw new TypeError("Failed to fetch");
    });

    const blob = await getSdsBlobForChemical(CHEMICAL_ID);
    expect(blob).toBeNull();
  });

  test("returns null when the chemical has no SDS document at all", async () => {
    setOnline(false);
    globalThis.fetch = mock(async () => {
      throw new Error("should not be reached");
    });

    const blob = await getSdsBlobForChemical("chem-without-sds");
    expect(blob).toBeNull();
  });
});

// ===========================================================================
// Online path (regression guard — we don't want a future change to the
// offline fallback to silently break the online path)
// ===========================================================================

describe("getSdsBlobForChemical — online path", () => {
  test("returns the server's fresh PDF and refreshes the local cache", async () => {
    setOnline(true);

    const freshPdfBytes = new Blob(
      [new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x32, 0x2e, 0x30])], // %PDF-2.0
      { type: "application/pdf" }
    );

    globalThis.fetch = mock(async () => new Response(freshPdfBytes, { status: 200 }));

    const blob = await getSdsBlobForChemical(CHEMICAL_ID);

    // Blob identity won't match because await res.blob() creates a new instance.
    // Compare byte content instead.
    expect(blob).not.toBeNull();
    const blobBytes = new Uint8Array(await blob!.arrayBuffer());
    const expectedBytes = new Uint8Array(await freshPdfBytes.arrayBuffer());
    expect(blobBytes).toEqual(expectedBytes);

    // The cache should now hold the fresh bytes so a subsequent offline
    // viewing serves the latest version, not a stale placeholder.
    const cached = sdsBlobsTable.get(SDS_ID);
    expect(cached).toBeDefined();
    const cachedBytes = new Uint8Array(await cached!.blob.arrayBuffer());
    expect(cachedBytes).toEqual(expectedBytes);
  });
});
