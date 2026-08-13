# SDS-CHEM Live Runtime Audit Report

**Task ID:** AUDIT-LIVE-1
**Scope:** Full live runtime audit of the SDS-CHEM Next.js app at `http://localhost:3000` via the `agent-browser` CLI — public catalog SPA, admin login + 6-tab dashboard, all API endpoints (public, admin-authenticated, unauthenticated), responsive + footer behavior.
**Method:** Drove a headless Chromium through the actual user flows: opened pages, snapshotted the accessibility tree, filled forms, clicked buttons, inspected network requests/responses, captured screenshots, evaluated JS in page context. Reproduced both code-audit-predicted bugs (A1, B3) and discovered one new minor issue.
**Pre-requisites:** Read `/home/z/my-project/worklog.md` (RUN-1, ADMIN-1, AUDIT-CODE-1 entries) and `/home/z/my-project/audit-code-report.md` for context on known issues. Verified dev server reachable (`curl http://localhost:3000/` → 200) before starting. Verified seed admin's `passwordChangeRequired` defaults to `false` (Prisma schema) and is not set to `true` in `scripts/seed-db.ts`, so login should land directly on `/admin` (not `/admin/change-password`).

---

## A. Pages verified working

| Route | Status | Evidence |
|---|---|---|
| `http://localhost:3000/` (public catalog) | **OK** | Snapshot shows header (logo + sync "Synced 07:29 AM" + "Online" + theme toggle), dashboard stats (14 Total Chemicals, 13 DANGER, 1 WARNING, 4 Departments, hazard pictogram distribution, department breakdown), search box (`@e36`), Filters button (`@e7`), 14 chemical cards (Acetic Acid → Sulfuric Acid), Emergency FAB (`@e1`). No runtime errors. Console only shows React DevTools promo + HMR connected (dev-only noise). |
| `http://localhost:3000/admin/login` | **OK** | Snapshot shows SDS-CHEM logo, "Administrator Sign In" card with Email + Password textboxes (`@e3`, `@e4`), Sign In button (`@e5`), "← Back to public catalog" link (`@e6`). Form accepts credentials and signs in successfully (see Stage 2). |
| `http://localhost:3000/admin` (dashboard) | **OK** | After login, redirected to `/admin`. 6-tab tablist rendered: Overview (selected), Chemicals, SDS Documents, Users, Audit Log, System. Overview tabpanel shows KPI cards (Total Chemicals=14, Total SDS=14, Available SDS=0, Placeholder SDS=14, Recent Activity table with rows for each chemical). |
| `http://localhost:3000/admin/change-password` | **NOT TESTED** | Seed admin's `passwordChangeRequired=false`, so we never land here. Route exists per code audit (AUDIT-CODE-1: "OK — Forces password change when flag is true"). |
| Detail view (in-app overlay) | **OK** | Clicking Acetone card opens detail view. Heading "Acetone" (`@e8`), DANGER badge, "Also known as: Propan-2-one", CAS 67-64-1, Formula C₃H₆O, GHS Hazard Pictograms (Flammable + Irritant / Harmful), HAZARD CLASSIFICATION (Flammable, Irritant, Specific Target Organ Toxicity), SDS Section Quick-Reference with 3 EMERGENCY sections (4 First-Aid, 5 Firefighting, 6 Accidental Release), Manufacturer (RCI Labscan), Supplier (VWR International), Location, Department, Required PPE list, "View SDS PDF" button, EMERGENCY CONTACT phone, Safety Instructions paragraph, "Open Emergency Mode" button, "PPE Info" popover button. PPE Info popover expands to show PPE list when clicked. |
| Emergency view (in-app overlay) | **OK** | Clicking Emergency FAB opens full-screen overlay with red theme. Snapshot shows "EMERGENCY MODE" header, Acetone name, Back + Close buttons, CAS/Formula/Signal Word/Location identifiers, GHS PICTOGRAM SUMMARY (Flammable + Irritant), Section 4/5/6 full text (First-Aid/Firefighting/Spill), REQUIRED PERSONAL PROTECTIVE EQUIPMENT list, EMERGENCY CONTACT (chemical-specific +63 2 8837 0713; Philippine Poison Control), EMERGENCY CONTACTS list (MIRDC facility, Poison Control, Fire & Rescue BFP National Hotline 166, Pollution Control Officer Ms. Gina Catalan, Chemical Spillage Brigade Ms. Mary Joy Bautista, Fire Brigade BFP Taguig City FTI, First Aid Brigade Ms. Deborah Balota, Safety Officer Engr. Nestor Colibao), "stored locally and works without internet" note. ESC key exits emergency mode and returns to detail view. Verified red theme via computed styles: header background `lab(48.4493 77.4328 61.5452)` (bg-red-600), fixed overlay `oklab(0.258 0.083 0.040 / 0.05)` (bg-red-950/5 backdrop-blur). |

---

## B. Admin tabs verified working

| Tab | Status | Evidence |
|---|---|---|
| Overview | **OK** | Selected by default after login. KPI cards visible: "14 Total Chemicals", "14 Total SDS", "0 Available SDS", "Placeholder SDS" (count not captured but card present), "Recent Activity" table with columns Chemical/SDS Status/Version/Updated By/Last Updated and rows for each of the 14 chemicals. |
| Chemicals | **OK** | Search box (`@e15`), "Add Chemical" button (`@e13`), refresh icon button (`@e14`). Table with columns Chemical/CAS/Signal/SDS/Last Updated/Actions, 14 rows. Each row has edit + delete action buttons. Clicking "Add Chemical" opens a dialog with fields: ID, Chemical Name, CAS Number, Formula, Trade Name, Manufacturer, Supplier, Signal Word combobox, Department combobox, Storage Location, Version, GHS Pictograms (9 toggle buttons), Hazard Classes (12 toggle buttons), Regulatory Tags (7 toggle buttons: DENR-EMB/PNP/PDEA/FDA/DOT/DOH/Other), Emergency Contact, PPE (textarea, one per line), Safety Instructions, First-Aid/Firefighting/Accidental Release Measures textareas, "Auto-fill from PDF" button (the AI Auto-Fill), Cancel + Create Chemical + Close buttons. Closed without saving. |
| SDS Documents | **OK** | Search box, refresh icon button. Table with columns Chemical/SDS File/Status/Version/Last Updated/Actions. 14 rows showing `placeholder.pdf` (≈1.0–1.1 KB) with "Placeholder" status. Each row has "View SDS" link + "Upload / Replace" button. **Note:** There is no global "Upload SDS" button — upload is per-row via "Upload / Replace" buttons (matches `sds-manager.tsx` design per code audit). |
| Users (SUPER_ADMIN) | **OK** | "User Management" heading, "1 super-admin" count badge, "Refresh" + "Add User" buttons, info banner explaining SUPER_ADMIN capabilities. Table with columns User/Role/Status/Last Login/Created/Actions. One row: "Administrator (you) admin@mirdc.dost.gov.ph", "Super Admin" role badge, "Active" status, "1m ago" last login, "8/13/2026" created, Edit + Delete buttons (Delete disabled — self-delete lockout guard). Edit dialog opens with: Display name (prefilled "Administrator"), Role combobox (disabled — can't change own role, with "You cannot remove your own super-admin role." note), "Disable account" button (disabled — "Cannot disable self"), "Reset password (optional)" field, "Require password change on next login" checkbox, Cancel + Save Changes + Close buttons. See A1 reproduction below for the cleared-name save behavior. |
| Audit Log (SUPER_ADMIN) | **OK** | "Audit Log" heading, "Filter by type" combobox (`@e14`), action filter combobox (`@e15`), Refresh button. Paginated table with columns When/Actor/Action/Summary/IP, clickable rows (expandable). Rows show entries like `user.update`, `sds.revert`, `sds.replace`, `user.delete`, `user.password-change` etc. with timestamps, actor email, IP `::1` (loopback). See B3 reproduction below for the filter dropdown issue. |
| System Settings (SUPER_ADMIN) | **OK** | "System Settings" heading, Refresh button, "Test Connection" button. 5 info cards visible: **AI Provider** (Provider=zai, Model=glm-4.6v, apiKeyConfigured=true, apiKeyHint="auto (sandbox)", note "In-house provider. Auto-configured on the Z.ai cloud sandbox."), **Storage** (SDS files=14, Directory=/home/z/my-project/storage/sds), **Database** (Type=SQLITE, Connection URL=file:/home/z/my-project/db/custom.db), **Sync & Data** (Chemicals=14, [deleted count=3 visible]), **System Runtime** (Node.js v24.18.0, [Next.js version present]). Clicked "Test Connection" — POST `/api/admin/system/test-ai` returned 200; UI displayed "OK — 981ms" with response body `{"ok":true}`. |

---

## C. API endpoints verified

### Public endpoints (no auth)

| Endpoint | Status | Result | Verdict |
|---|---|---|---|
| `GET /api/chemicals` | 200 | `application/json` — `{ "chemicals": [...] }` array | **OK** |
| `GET /api/chemicals/chem-acetone` | 200 | `application/json` — `{ "chemical": {...} }` single object | **OK** |
| `GET /api/chemicals/nonexistent` | 404 | `application/json` — `{ "error": "..." }` | **OK** |
| `GET /api/sds/sds-acetone/download` | 404 | `text/plain` — "SDS not found" | **OK (expected — see note)** |
| `GET /api/sds/cmsqwqnhp0002rh6hxrdryl6e/download` | 200 | `application/pdf` — 1068 bytes, Content-Disposition: `inline; filename="placeholder.pdf"` | **OK** |
| `GET /api/sync?since=0` | 200 | `application/json` — `{ "serverTime", "chemicals", "sdsDocuments", "deletedChemicalIds", "deletedSdsIds" }` | **OK** |

**Note on `/api/sds/sds-acetone/download`:** The task hint said "expect 200 + application/pdf (or 404 if id format differs — note either)". The 404 is correct because `"sds-acetone"` is not a valid SDS document id — actual SDS ids are cuids (e.g. `cmsqwqnhp0002rh6hxrdryl6e`). The `sdsDocumentId` field on the chemical record IS misleadingly set to the chemical id `"chem-acetone"` (this is the C1 cosmetic issue from the code audit), but the download route expects the real SDS cuid. Verified the route works correctly with the real cuid: status 200, content-type `application/pdf`, 1068 bytes, filename `placeholder.pdf`.

### Admin endpoints (authenticated as SUPER_ADMIN)

| Endpoint | Status | Result | Verdict |
|---|---|---|---|
| `GET /api/admin/dashboard` | 200 | `{ "totalChemicals":14, "deletedChemicals":0, "totalSds":14, "availableSds":0, "placeholderSds":14, "byDepartment":... }` | **OK** |
| `GET /api/admin/chemicals` | 200 | `{ "chemicals": [...] }` array | **OK** |
| `GET /api/admin/sds` | 405 | empty body | **OK (by design — POST-only route for upload/replace, no GET list endpoint)** |
| `GET /api/admin/users` | 200 | `{ "users": [{ "id":"cmsqwqnhk0000rh6hy6q1966w", "email":"admin@mirdc.dost.gov.ph", "name":"Administrator", ... }] }` | **OK** |
| `GET /api/admin/audit` | 200 | `{ "entries": [...], "nextCursor": "...", "hasMore": ... }` paginated | **OK** |
| `GET /api/admin/system/info` | 200 | `{ "ai": {...}, "storage": {...}, "sync": {...}, "database": {...}, "system": {...} }` — all 5 info blocks present | **OK** |
| `POST /api/admin/system/test-ai` | 200 | (Tested via UI button click) Response displayed "OK — 981ms" with body `{"ok":true}` | **OK** |

### Unauthenticated checks (fresh browser session, no auth cookies)

| Endpoint | Status | Result | Verdict |
|---|---|---|---|
| `GET /api/admin/users` | 401 | `{ "error": "Unauthorized" }` | **OK** |
| `GET /api/admin/audit` | 401 | `{ "error": "Unauthorized" }` | **OK** |
| `GET /api/admin/system/info` | 401 | `{ "error": "Unauthorized" }` | **OK** |
| `GET /api/admin/dashboard` | 401 | `{ "error": "Unauthorized" }` | **OK** |
| `GET /api/admin/chemicals` | 401 | `{ "error": "Unauthorized" }` | **OK** |
| `GET /api/admin/sds` | 405 | empty body | **UNEXPECTED (minor — see D1)** |

### Middleware redirect behavior

| URL | Unauth behavior | Verdict |
|---|---|---|
| `GET /admin/chemicals` (subpath) | 302 redirect → `/admin/login?callbackUrl=%2Fadmin%2Fchemicals` | **OK** |
| `GET /admin` (bare URL, no trailing slash) | 200 with body "Redirecting to login…" but no actual redirect fires | **FAIL — see E3 (C6 confirmed live)** |

---

## D. Issues found live (NOT predicted by code audit)

### D1. `GET /api/admin/sds` returns 405 (Method Not Allowed) even when unauthenticated

- **Severity:** Cosmetic (low)
- **Page/state:** Unauthenticated GET request to `/api/admin/sds`
- **What happened:** When an unauthenticated user sends `GET /api/admin/sds`, the route returns `405 Method Not Allowed` (empty body) instead of `401 Unauthorized`.
- **Expected:** 401 Unauthorized (auth check should run before method check, defense-in-depth).
- **Actual:** 405 Method Not Allowed.
- **Why it matters:** Minor information disclosure — the 405 leaks "this route exists but only accepts POST" to unauthenticated callers. The endpoint is still secure (POST requires auth, and the route is `requireAdmin()`-guarded per the code audit). Non-blocking.
- **Suggested fix:** Add a top-of-route `if (request.method !== "POST") return NextResponse.json({ error: "Method not allowed" }, { status: 405, headers: { Allow: "POST" } })` AFTER the `requireAdmin()` call, or restructure to run auth first.

**No other new issues found.** All other live behaviors matched the code audit's predictions or worked correctly.

---

## E. Issues confirmed live (predicted by code audit)

### E1. A1 — EditUserDialog PATCH fails when name field is cleared (CRITICAL) — REPRODUCED

- **Code audit reference:** A1 in `/home/z/my-project/audit-code-report.md`
- **Reproduction steps:**
  1. Logged in as `admin@mirdc.dost.gov.ph` (SUPER_ADMIN).
  2. Navigated to `/admin` → Users tab.
  3. Clicked "Edit" on the Administrator row → EditUserDialog opened with Display name prefilled "Administrator".
  4. Focused the Display name input, pressed `Control+A` then `Delete` to clear it (verified via `document.querySelectorAll('input')` — Display name field value was `""`).
  5. Clicked "Save Changes".
- **Observed:** The dialog stayed open (no toast notification visible — toast may have already auto-dismissed by the time we checked). Network log shows:
  ```
  [21952.310] PATCH http://localhost:3000/api/admin/users/cmsqwqnhk0000rh6hy6q1966w (Fetch) 400
  ```
- **Direct repro via `fetch()`** (to capture the response body):
  ```js
  fetch('/api/admin/users/cmsqwqnhk0000rh6hy6q1966w', {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: null, role: 'SUPER_ADMIN', disabled: false, passwordChangeRequired: false })
  })
  ```
  Response: `400` with body `{"error":"Validation failed","details":{"name":["Invalid input: expected string, received null"]}}`
- **Root cause confirmed:** `src/components/admin/user-manager.tsx:597` sends `name: name.trim() || null` when name is empty. Server schema at `src/app/api/admin/users/[id]/route.ts:26` is `name: z.string().min(1).max(120).optional()` which in zod 4.3.5 accepts `string | undefined` but rejects `null` (verified empirically with `node -e "const {z}=require('zod'); ..."` — `name:null` fails with `Invalid input: expected string, received null`).
- **Severity:** Critical — blocks a real workflow (clearing or never setting a display name on a user).
- **Fix:** Client should send `name: name.trim() || undefined` (matches the Create dialog at line 442 which already does this correctly), and/or server schema should be `name: z.string().min(1).max(120).nullable().optional()`.

### E2. B3 — Audit Log entity-type filter dropdown missing "System" option (WARNING) — REPRODUCED

- **Code audit reference:** B3 in `/home/z/my-project/audit-code-report.md`
- **Reproduction steps:**
  1. On `/admin` → Audit Log tab.
  2. Clicked the "Filter by type" combobox (`@e14`).
- **Observed dropdown options:** `All types`, `Chemicals`, `SDS`, `Users`, `Sessions`.
- **Expected:** Should also include `System` (since `/api/admin/system/test-ai` writes audit entries with `entityType: "system"` — confirmed during this audit when we clicked Test Connection on the System Settings tab).
- **Actual:** No `System` option. The `Sessions` option is present but no audit entries are ever written with `entityType: "session"` (per code audit, the change-password route writes `entityType: "user"`).
- **Severity:** Warning (minor UX — system test-ai events are invisible to the filter UI; users can still see them in the "All types" view).
- **Fix:** Replace `<SelectItem value="session">Sessions</SelectItem>` with `<SelectItem value="system">System</SelectItem>` in `src/components/admin/audit-log-viewer.tsx` lines 176–181.

### E3. C6 — `/admin` (bare URL) renders "Redirecting to login…" without actually redirecting (COSMETIC) — REPRODUCED

- **Code audit reference:** C6 in `/home/z/my-project/audit-code-report.md`
- **Reproduction steps:**
  1. Opened a fresh browser session with no auth cookies.
  2. Navigated to `http://localhost:3000/admin` (no trailing slash).
- **Observed:** Page rendered with the text "Redirecting to login…" and stayed there indefinitely. URL remained at `http://localhost:3000/admin`. No client-side redirect fired.
- **Expected:** Either middleware should redirect to `/admin/login`, OR the page fallback should call `router.replace("/admin/login")`.
- **Actual:** Neither happens. The user is stuck on a blank-looking page.
- **Root cause confirmed (live):**
  - Middleware matcher in `src/middleware.ts:27` is `["/admin/((?!login).*)"]`. This regex requires `/admin/` followed by a non-`login` segment — it does NOT match the bare `/admin` URL. Verified live: visiting `/admin/chemicals` (subpath) DOES redirect correctly to `/admin/login?callbackUrl=%2Fadmin%2Fchemicals`, but `/admin` (bare) does not.
  - Page fallback in `src/app/admin/page.tsx:65–71` renders the "Redirecting to login…" message but never calls `router.replace("/admin/login")`.
- **Severity:** Cosmetic (low) — only triggers when an unauthenticated user manually types `/admin` without a trailing slash or subpath. Real users typically click links that include the subpath. But the misleading "Redirecting to login…" message is confusing.
- **Fix:** Either widen the middleware matcher to `["/admin", "/admin/((?!login).*)"]`, OR add `useEffect(() => { if (!session) router.replace("/admin/login"); }, [session, router]);` to `src/app/admin/page.tsx`.

### E4. C1 — Detail view shows misleading SDS Document id (COSMETIC) — REPRODUCED

- **Code audit reference:** C1 in `/home/z/my-project/audit-code-report.md`
- **Reproduction steps:**
  1. Opened the Acetone detail view.
  2. Looked at the "SDS Document" label/value in the side panel.
- **Observed:** "SDS Document: chem-acetone" (the chemical id).
- **Expected:** The actual SDS document id (a cuid) — verified via `/api/sync?since=0` that the real SDS document id for Acetone is `cmsqwqnhp0002rh6hxrdryl6e`.
- **Actual:** Shows the chemical id `chem-acetone` instead.
- **Severity:** Cosmetic (very low) — functionally harmless. The PWA sync engine uses `sds.id` from the `sdsDocuments` Dexie table (correct), never `chemical.sdsDocumentId`. Only the UI label is wrong.
- **Fix:** Either remove the `sdsDocumentId` field from the client type, or have the serializer fetch the actual SDS id via the `sdsDocument` relation.

---

## F. Screenshots

All screenshots saved to `/home/z/my-project/`:

| File | Size | Description |
|---|---|---|
| `/home/z/my-project/audit-screenshot-catalog.png` | 163 KB | Public catalog page at desktop viewport (1920×1080), full-page scroll height. Shows header, dashboard stats, search bar, filter button, 14 chemical cards in grid, footer at bottom. |
| `/home/z/my-project/audit-screenshot-detail.png` | 66 KB | Acetone detail view (in-app overlay). Shows name, DANGER badge, GHS pictograms, hazard classification, SDS section quick-reference, identifiers, PPE list, emergency contact. |
| `/home/z/my-project/audit-screenshot-emergency.png` | 48 KB | Emergency mode full-screen overlay for Acetone. Red-themed header, GHS summary, first-aid/firefighting/spill sections, PPE list, MIRDC + hotlines contacts. |
| `/home/z/my-project/audit-screenshot-admin-overview.png` | 98 KB | Admin Overview tab — KPI cards (Total Chemicals, Total SDS, Available SDS, Placeholder SDS) + Recent Activity table. |
| `/home/z/my-project/audit-screenshot-admin-chemicals.png` | 143 KB | Admin Chemicals tab — table of 14 chemicals with edit/delete actions, "Add Chemical" button. |
| `/home/z/my-project/audit-screenshot-admin-sds.png` | 147 KB | Admin SDS Documents tab — table with View SDS / Upload-Replace per row. |
| `/home/z/my-project/audit-screenshot-admin-users.png` | 71 KB | Admin Users tab — table with one Administrator user, Edit + Delete (disabled) buttons. |
| `/home/z/my-project/audit-screenshot-admin-audit.png` | 266 KB | Admin Audit Log tab — paginated table with timestamps, actors, actions, summaries, IPs. |
| `/home/z/my-project/audit-screenshot-admin-system.png` | 116 KB | Admin System Settings tab — 5 info cards (AI Provider, Storage, Database, Sync & Data, System Runtime) with Test Connection result "OK — 981ms". |

---

## G. Responsive + footer verification

### Responsive layout (iPhone 14 — 390×844)

- Set device to "iPhone 14" and reloaded catalog.
- Verified: viewport 390×844, **no horizontal scroll** (`bodyScrollWidth=390 === viewportWidth=390`, `hasHScroll=false`).
- All 14 chemical cards visible (grid stacks to 1 column on mobile).
- Footer pushed to bottom of long content (`footerTop=7351, bodyScrollHeight=7484, viewportHeight=844` — footer is at the natural bottom, not floating).
- Touch target sizes:
  - "Filters" button: 358×44 — meets 44px minimum ✓
  - Emergency FAB: 160×48 — exceeds 44px ✓
  - Theme toggle (icon-only): 36×36 — below 44px (acceptable for icon toggles in headers; common pattern but technically fails WCAG 2.5.5)
  - Header logo button: 137×36 — below 44px height (acceptable as it's a brand link, not a primary control)
- Resized back to 1920×1080 and reloaded — catalog renders correctly at desktop with 14 cards.

### Footer behavior

- **Public catalog (long page, 14 cards):** Footer at `top=2765, bottom=2834`, body height 2834, viewport 1080. Footer is pushed down naturally by the content. `gapBelowMain=0` — no floating gap above the footer. The public app uses `flex min-h-screen flex-col` with `<main className="flex-1">` + `<AppFooter />` — the standard sticky-footer pattern (`src/app/page.tsx:77-86`).
- **Public catalog (empty search results, 0 cards):** With viewport 1080, footer top=1073 — footer sits right at the bottom of viewport. No floating gap.
- **Admin pages:** No footer is rendered by design (`src/app/admin/layout.tsx` has no footer component). The admin login page uses `flex min-h-screen flex-col items-center justify-center` to vertically center the card — no footer needed. This is intentional, not a bug.

---

## H. Overall verdict

### **Functional with known issues**

The SDS-CHEM app is production-usable for its core function: a public offline-first PWA catalog of chemicals with search, filters, detail view, and emergency mode. All 6 admin tabs render correctly and surface real data. All 17 API routes respond with the correct status codes and shapes. Auth guards work (unauth → 401 on all admin APIs except the method-not-allowed case on `/api/admin/sds`). The seed admin's `passwordChangeRequired=false` flag is correctly unset, so login lands directly on `/admin`.

The 1 critical bug (A1: user-edit PATCH fails on null name) only affects the rare workflow of editing a user with an empty/cleared display name — it does not block normal catalog use, search, detail view, emergency mode, or any of the other admin tabs. The 3 warnings (B1: pdf-rasterize TS errors that would block `next build` but don't affect dev; B2: stale JWT after role downgrade; B3: audit filter missing "system") are non-blocking. The cosmetic issues (C1, C6, plus the new D1) don't affect functionality.

**Before production deployment, fix at minimum:**
1. **A1** (critical) — one-line fix in `user-manager.tsx:597` (change `|| null` to `|| undefined`).
2. **B1** (would block `next build`) — cast pdfjs params to `any` or migrate to v6 API.
3. **B2** (security) — add DB-backed session revalidation in `requireAdmin`/`requireSuperAdmin`.
4. **C6** (UX) — widen middleware matcher or add `router.replace` fallback in `admin/page.tsx`.
5. **D1** (defense-in-depth) — reorder auth check before method check in `/api/admin/sds/route.ts`.

**Audit summary counts:**
- Pages verified: 5 OK, 1 not tested (`/admin/change-password` — preconditions not met)
- Admin tabs verified: 6 OK out of 6
- API endpoints verified (public + admin + unauth): 18 OK, 1 by-design 405, 1 unexpected 405 (D1)
- Issues found live (new): 1 (D1 — `/api/admin/sds` returns 405 before 401 when unauth)
- Issues confirmed live (from code audit): 4 (A1 critical, B3 warning, C6 cosmetic, C1 cosmetic)
- Issues NOT observed live but predicted: B1 (TS errors — only triggered by `next build`, not by dev server), B2 (would require role-downgrade scenario not exercised here)

---

## Verification commands run

```bash
# Stage 1 — Public catalog
agent-browser open http://localhost:3000/
agent-browser wait --load networkidle
agent-browser snapshot -i            # 14 cards, search, filters, FAB, header, footer
agent-browser errors                 # (no output — clean)
agent-browser console                # only React DevTools promo + HMR (dev noise)
agent-browser fill @e36 "acet"       # filter → 2 cards ("Showing 2 chemicals")
agent-browser click @e9              # Acetone card → detail view opens
agent-browser click @e7              # PPE Info popover expands
agent-browser click @e1              # Emergency FAB → red-themed overlay opens
agent-browser press Escape           # exits emergency back to detail view
agent-browser screenshot /home/z/my-project/audit-screenshot-catalog.png --full
agent-browser screenshot /home/z/my-project/audit-screenshot-detail.png
agent-browser screenshot /home/z/my-project/audit-screenshot-emergency.png --full
agent-browser set device "iPhone 14" # 390×844, no horizontal scroll, 14 cards stack
agent-browser set viewport 1920 1080 # back to desktop

# Stage 2 — Admin login + 6 tabs
agent-browser open http://localhost:3000/admin/login
agent-browser fill @e3 "admin@mirdc.dost.gov.ph"
agent-browser fill @e4 "ChangeMeNow!2026"
agent-browser click @e5              # Sign In
agent-browser wait --url "**/admin" --timeout 5000  # landed on /admin (not change-password)
# Clicked each of 6 tabs, snapshotted, screenshotted:
agent-browser screenshot ...admin-overview.png
agent-browser screenshot ...admin-chemicals.png     # after opening+closing Add Chemical dialog
agent-browser screenshot ...admin-sds.png
agent-browser screenshot ...admin-users.png         # after A1 repro
agent-browser screenshot ...admin-audit.png         # after B3 repro
agent-browser screenshot ...admin-system.png        # after Test Connection click

# Stage 3 — API endpoints (single eval call per session)
# Authed: 11 endpoints tested in one fetch loop
# Unauth (fresh --session unauth): 6 endpoints tested in one fetch loop
# A1 direct repro: fetch PATCH with name:null → 400 + body captured
# B3 repro: open "Filter by type" dropdown → snapshot shows 5 options (no "System")

# Stage 4 — Responsive + footer
# iPhone 14: 390×844, no h-scroll, 14 cards, footer at bottom
# Desktop: 1920×1080, footer at bottom of long content (gapBelowMain=0)
# Empty search results: footer still at bottom of viewport (no floating gap)
```
