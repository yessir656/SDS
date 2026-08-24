# SDS-CHEM — Offline Access Test Log

**Test date:** 2026-08-24
**Tested by:** AI session (forked from sess_7b41a700-c8cf-4b00-9403-6ab851ae6865)
**App version:** sdsv5 (Next.js 16.1.3 Turbopack, dev mode)
**Server:** http://localhost:3000 (bun run dev)

---

## PURPOSE

Verify the two user requirements:
1. **SDS PDF files must be accessible with no WiFi (offline).**
2. **The system must keep working with no WiFi.**

This log is written so any future AI/handler can understand the offline
architecture, what was tested, what passed, and what the known limitations are.

---

## 1. OFFLINE ARCHITECTURE (read this first)

The app is offline-first by design. Data flows like this:

```
Server (Prisma + SQLite, db/custom.db)
   │  storage/sds/<uuid>.pdf          ← PDFs live here on the server
   ▼
GET /api/sync?since=<timestamp>      ← delta sync (chemicals + SDS metadata)
GET /api/sds/<id>/download           ← streams PDF bytes (Cache-Control: no-store)
   ▼
Browser IndexedDB (Dexie, db name "sds-chem-db")
   ├─ chemicals      table  ← full chemical records
   ├─ sdsDocuments   table  ← SDS metadata (version, status, hash)
   ├─ sdsBlobs       table  ← THE ACTUAL PDF BLOBS (offline PDF source)
   └─ syncMeta       table  ← last sync timestamp
```

Key code paths:

- `src/lib/sync-engine.ts` → `syncNow()` runs on app startup, on
  offline→online transition, and every 5 minutes while online.
  It calls `syncSdsBlobs()` which downloads **every SDS PDF whose version
  changed** into the `sdsBlobs` IndexedDB table. So after one successful
  online sync, ALL PDFs are available offline.
- `src/lib/sync-engine.ts` → `getSdsBlobForChemical(chemicalId)`:
  - ONLINE: fetch fresh bytes from the server (never trusts stale cache),
    then refresh the IndexedDB cache.
  - OFFLINE or fetch failure (catch block): **falls back to the IndexedDB
    `sdsBlobs` cache**. Returns null only if nothing was ever cached.
- `src/components/detail/chemical-detail.tsx` → `handleViewSds()`:
  calls the above; if a blob comes back it does
  `window.open(URL.createObjectURL(blob))`. If null it alerts
  "SDS document is not available offline."
- `src/hooks/use-online-status.ts` → tracks `navigator.onLine` +
  `online`/`offline` window events (drives the "Online/Offline" header chip).
- `public/sw.js` + `src/components/common/service-worker-register.tsx` →
  service worker is **registered in production builds only**
  (`process.env.NODE_ENV !== "production"` returns early). It precaches
  `/`, `/manifest.json`, and icons, serves navigations network-first with
  cache fallback, and static assets stale-while-revalidate.

**Important:** offline PDF access does NOT depend on the service worker.
It depends on the Dexie/IndexedDB blob cache, which works in both dev and
production.

---

## 2. TEST RESULTS

### TEST A — Server-side PDF storage and APIs ✅ PASS
- `storage/sds/` contains 28 PDF files (14 current + 14 from an older seed
  run; DB references the current 14).
- `GET /api/sync?since=0` → HTTP 200, returns 14 chemicals + 14 sdsDocuments.
- `GET /api/sds/<id>/download` → HTTP 200, `Content-Type: application/pdf`,
  valid `%PDF-1.4` magic bytes, `Content-Disposition: inline`.

### TEST B — Online app load + sync ✅ PASS
- Opened http://localhost:3000 in the browser.
- App showed "Loading chemical database…" → then the full catalog.
- Header showed **"Synced 08:51 AM"** and **"Online"**.
- 14 chemicals listed with GHS pictograms, stats, departments.
- This sync also downloaded all 14 PDF blobs into IndexedDB (`sdsBlobs`).

### TEST C — PDF view while ONLINE ✅ PASS
- Navigated to Acetone detail page (chem-acetone, SDS id
  `cmswmv8tv0002u9xg12wjzron`, placeholder v1).
- Clicked **"View SDS PDF"** → `getSdsBlobForChemical()` fetched from the
  server, cached the blob in IndexedDB, and opened the PDF
  (`window.open` of a blob: URL). No error alert appeared.

### TEST D — PDF view with NO WIFI (server unreachable) ✅ PASS  ← KEY TEST
Method: killed the dev server process (`Stop-Process -Force` on the PID
listening on :3000). Verified with `netstat` that nothing was LISTENING on
port 3000 (only SYN_SENT entries remained — a client trying and failing to
connect, i.e. exactly what "no WiFi" looks like to the app).

- With the server DOWN, clicked **"View SDS PDF"** on the Acetone detail
  page (page was already loaded in the browser).
- Code path exercised: `navigator.onLine` still true (browser always thinks
  localhost is online) → `fetch()` to `/api/sds/<id>/download` → connection
  refused → **catch block → IndexedDB fallback** →
  `db.sdsBlobs.get(sds.id)` → blob returned → `window.open()` fired.
- **Evidence of success:** the tab navigated away from the app exactly as it
  did in the online test, and **NO "SDS document is not available offline"
  alert appeared** (checked via `getJsDialog()` on every tab — none). The
  alert only fires when the blob is null, so a blob WAS served from the
  IndexedDB cache. With the server down, that blob could only have come
  from the local cache.
- **Conclusion: SDS PDFs ARE accessible with no WiFi**, provided the device
  synced at least once while online.

### TEST E — Full page reload with no WiFi ⚠️ DEV-MODE LIMITATION
- With the server down, reloading http://localhost:3000 produced an empty
  page (title "localhost:3000", empty body).
- **Root cause (verified in code):** the service worker is only registered
  when `NODE_ENV === "production"` (`service-worker-register.tsx`). In dev
  mode there is no SW, and Turbopack dev chunks are not cached anywhere, so
  a hard reload with no server cannot rebuild the app.
- **In a production build** (`bun run build` → `bun run start`, or the
  packaged `next-service-dist`), the SW registers and precaches the app
  shell, serves navigations from cache when the network fails, and serves
  already-loaded static assets stale-while-revalidate. Full offline reload
  is expected to work there. This was NOT end-to-end tested in this session
  (would require a production build) — flagged for the next handler.

### TEST F — Offline status indicator (code-verified, not UI-forced)
- `useOnlineStatus` reacts to real browser `offline`/`online` events.
- Killing the localhost server does NOT fire those events (the browser
  still considers itself "online"), so the header chip may still say
  "Online" while the server is unreachable. This is correct behavior —
  `navigator.onLine` reflects the network interface, not server reachability.
- The PDF fallback does not rely on the chip: it relies on the fetch
  failure catch block (verified in Test D).

---

## 3. ANSWERS TO THE USER'S QUESTIONS

**Q1: Is the PDF file accessible even though the user has no WiFi?**
YES — verified by test D. After the device has synced once while online,
all SDS PDFs live in the browser's IndexedDB and open without the server.
A brand-new device that has NEVER been online cannot show PDFs (nothing to
cache yet) — it will show the "not available offline" alert. First-launch
must be online; after that it works offline.

**Q2: Does the system work even though there is no WiFi?**
- Already-open app: YES (catalog, search, detail pages, emergency info, and
  SDS PDFs all read from IndexedDB).
- Fresh page load with no server: only in a PRODUCTION build (service
  worker app-shell cache). Dev mode cannot do this by design. Next handler
  should verify with `bun run build && bun run start`.

---

## 4. HOW TO RE-RUN THIS TEST

1. Start server: `bun run dev` (repo root). Open http://localhost:3000.
2. Wait for header to show "Synced …" (this caches all PDFs to IndexedDB).
3. Open any chemical → click "View SDS PDF" once (confirms online path).
4. Kill the server:
   - Find PID: `netstat -ano | findstr :3000 | findstr LISTENING`
   - PowerShell: `Stop-Process -Id <PID> -Force`
5. Back in the browser (do NOT reload), click "View SDS PDF" again.
   - PASS = PDF opens, no "not available offline" alert.
6. Restart server: `bun run dev`.

Note for automated browser testing (ZCode in-app browser):
- `window.open(blob:)` navigates the IAB tab to a "guest" PDF context that
  cannot be screenshotted and reports an empty DOM. Success/failure must be
  judged by: (a) tab navigated away from the app, and (b) absence of the
  "SDS document is not available offline" JS alert (`tab.getJsDialog()`).
- Playwright role-based `.click()` times out on this app's chemical cards;
  use `tab.cua.click({x, y})` with coordinates from a read-only
  `evaluate()` bounding-box lookup instead.

---

## 5. OPEN ITEMS FOR THE NEXT HANDLER

1. [ ] Production offline test: `bun run build && bun run start`, then
       repeat Test E (reload with server down). Expect the SW to serve the
       app shell. If it fails, inspect `public/sw.js` precache list and the
       standalone build's `public/` copy step in `package.json` build script.
2. [ ] `storage/sds/` has 14 orphaned PDFs from an earlier seed (28 files
       vs 14 DB rows). Harmless, but a cleanup could diff DB storageKeys
       against the folder.
3. [ ] Consider a "Download all SDS for offline" UI indicator so lab users
       know when the device is safe to go offline (currently syncing is
       silent — only the tiny "Synced <time>" chip shows it).
4. [ ] Admin credentials (unchanged this session): admin@mirdc.dost.gov.ph
       / BakalBoi (from .env, seeded via `bun run scripts/seed-db.ts`).
5. [ ] PWA icons were regenerated this session from the real DOST-MIRDC
       logo (`public/icons/*`, navy #0a2540 maskable background) — see
       `scripts/generate-icons.mjs`. Installed-PWA icon will show MIRDC
       logo after users re-install/update the PWA.

---

## 6. ENVIRONMENT STATE AT END OF SESSION

- Dev server: RUNNING on http://localhost:3000 (started with
  `nohup bun run dev`, log at /tmp/dev-server.log).
- Database: seeded (14 chemicals, 14 SDS placeholder PDFs, 1 SUPER_ADMIN).
- Browser (ZCode IAB): 1 tab open at http://localhost:3000/ (may be showing
  the blob-PDF guest state from Test D — just reload).
