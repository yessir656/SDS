# SDS-CHEM Code-Level Audit Report

**Task ID:** AUDIT-CODE-1
**Scope:** Full read of every page route, API route, library file, config file, and custom component in `/home/z/my-project/src`, `/home/z/my-project/prisma`, `/home/z/my-project/scripts`, plus root configs.
**Method:** Read every file end-to-end; cross-checked imports against `package.json`; cross-checked Prisma schema fields against code usage; verified auth guards and audit-log coverage on every mutating admin route; verified PPE normalization boundary; ran `tsc --noEmit` and `eslint .`.

---

## A. Critical bugs (must fix before user can trust system)

### A1. `EditUserDialog` PATCH fails when name field is empty or already null

- **File:** `src/components/admin/user-manager.tsx` (line ~597) + `src/app/api/admin/users/[id]/route.ts` (lines 24–34)
- **What's wrong:** `EditUserDialog.handleSave()` always sends `name: name.trim() || null` in the PATCH body. The server's `updateUserSchema` defines `name: z.string().min(1).max(120).optional()`, which in **zod 4** accepts `string | undefined` but **rejects `null`**. Verified empirically:

  ```
  Test 1 (name=null): false {"_errors":[],"name":{"_errors":["Invalid input: expected string, received null"]}}
  Test 2 (name='Alice'): true
  ```

- **Why it matters:** Any time a super-admin edits a user whose `name` is null (which is the default — `name String?` in Prisma) OR clears the name field intentionally, clicking **Save Changes** returns `400 Validation failed` and the toast shows `"Update failed: Validation failed"`. The user appears to be uneditable. Since newly created users default to having `name` set (super-admins usually fill the field), this most often bites when editing a user that was created without a display name, or when intentionally clearing the name.
- **Suggested fix (either side; both is best):**
  - **Client** (`user-manager.tsx`): send `name: name.trim() || undefined` instead of `null` — `undefined` keys are dropped from JSON.stringify, so the field is simply omitted from the PATCH and `name` stays unchanged.
  - **Server** (`users/[id]/route.ts`): change schema to `name: z.string().min(1).max(120).nullable().optional()` so it also accepts `null` (which Prisma happily writes).

---

## B. Warnings (should fix soon, but not blocking)

### B1. TypeScript errors in `src/lib/pdf-rasterize.ts` (3 errors) — would block production `next build`

- **File:** `src/lib/pdf-rasterize.ts` lines 61, 80, 100
- **What's wrong:** `tsc --noEmit -p tsconfig.json` reports three errors against `pdfjs-dist@^6.2.108`:
  1. Line 61: `'disableWorker' does not exist in type 'DocumentInitParameters'` — the option was removed/renamed in pdfjs v6.
  2. Line 80: `Property 'canvas' is missing in type '{ canvasContext, viewport, background }' but required in type 'RenderParameters'` — v6 added a required `canvas` field.
  3. Line 100: `Property 'destroy' does not exist on type 'PDFDocumentProxy'` — v6 renamed/removed `destroy()`.
- **Why it matters:** Next.js's dev server (Turbopack) ignores TS errors, so the app runs in dev. But `next build` runs `tsc` and would fail, blocking production deploys. The AUDIT-1 worklog confirmed AI auto-fill "works" at runtime — pdfjs's runtime JS is more lenient than its TS types — so this is a type-level issue, not a runtime failure.
- **Suggested fix:** Cast the parameter objects to `any` (or use `as unknown as RenderParameters`), or migrate to the v6 API (`canvas` field; `cleanup()` instead of `destroy()`). Example:

  ```ts
  await page.render({
    canvas,
    canvasContext: ctx as unknown as CanvasRenderingContext2D,
    viewport,
    background: "#ffffff",
  } as unknown as RenderParameters).promise;
  ```

### B2. Stale JWT after role downgrade or disable

- **File:** `src/lib/auth.ts` (JWT callback, lines 74–95)
- **What's wrong:** The JWT callback only refreshes `role` and `passwordChangeRequired` from the DB when `trigger === "update"` (i.e. when the client explicitly calls `useSession().update()`). On a normal API request, the role/disabled state is read from the JWT, which is valid for 30 days. If a super-admin downgrades an ADMIN to USER, or disables their account, the user's existing JWT continues to grant admin access until expiry.
- **Why it matters:** A compromised or disgruntled admin whose account is revoked retains access for up to 30 days. Defense-in-depth is partially preserved: `authorize()` rejects disabled users *on fresh sign-in*, but does nothing for active sessions.
- **Suggested fix:** In `requireAdmin()` / `requireSuperAdmin()`, after getting the session, do a quick `db.user.findUnique({ where: { id }, select: { disabled: true, role: true, passwordChangeRequired: true } })` and reject if disabled or role doesn't match. Cache for 60s in-memory if performance is a concern. (This is the standard pattern for JWT + DB-backed auth.)

### B3. Audit-log viewer dropdown missing "system" entity type

- **File:** `src/components/admin/audit-log-viewer.tsx` lines 176–181
- **What's wrong:** The entity-type filter dropdown offers `["all", "chemical", "sds", "user", "session"]`, but no audit entries ever have `entityType === "session"` (the change-password route writes `entityType: "user"`). Meanwhile `entityType: "system"` IS written by `/api/admin/system/test-ai` (line 28 of `test-ai/route.ts`) but is missing from the dropdown, so super-admins can't filter to system events.
- **Why it matters:** Minor UX — system test-ai events are invisible to the filter UI.
- **Suggested fix:** Replace `<SelectItem value="session">Sessions</SelectItem>` with `<SelectItem value="system">System</SelectItem>`.

---

## C. Cosmetic / hygiene

### C1. `sdsDocumentId` field is misleading

- **File:** `src/lib/serialize.ts` line 73
- **What's wrong:** `sdsDocumentId: c.id` sets the SDS document id to the *chemical*'s id (e.g. `"chem-acetone"`). But the SDS document has its own separate cuid. The comment claims "1:1 — SDS id matches chemical id for client convenience" but they do NOT match.
- **Impact:** Functionally harmless — the client sync engine uses `sds.id` from the `sdsDocuments` Dexie table (correct), never `chemical.sdsDocumentId`. The only consumer is `chemical-detail.tsx:355`, which displays the value under a "SDS Document" label — so the UI shows "chem-acetone" as the SDS document identifier, which is wrong but not breaking.
- **Suggested fix:** Either remove the field from `ClientChemical` + `ChemicalRecord` + the seed data, or have the serializer fetch the SDS id from a relation: `serializeChemical(c: Chemical & { sdsDocument?: SdsDocument | null })` and use `c.sdsDocument?.id ?? ""`.

### C2. Dead `sdsDocumentId` values in `src/lib/seed-data.ts`

- **File:** `src/lib/seed-data.ts` lines 119, 168, 212, 255, 298, 342, 386, 429, 477, 521, 564, 612, 659, 707
- **What's wrong:** Each of the 14 seed chemicals has `sdsDocumentId: "sds-acetone"` (etc.) set in the static `SEED_CHEMICALS` array. But `scripts/seed-db.ts` does NOT write this field to the DB (it's not a Prisma field — only `ChemicalRecord`'s client-side type has it). The serializer overwrites it to `c.id` on the way out. So these 14 string literals are orphaned dead data.
- **Suggested fix:** Delete the `sdsDocumentId:` lines from `seed-data.ts`, or remove the field from the type entirely (see C1).

### C3. Dead imports in `src/app/admin/page.tsx`

- **File:** `src/app/admin/page.tsx` lines 11, 29–40, 41
- **What's wrong:** These imports are never referenced in the file body:
  - `useEffect`, `useCallback` (from react)
  - `Input`, `Label`, `Badge` (from ui)
  - `Card`, `CardContent`, `CardHeader`, `CardTitle` (from ui/card)
  - `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription` (from ui/dialog)
  - `cn` (from `@/lib/utils`)
- **Why not caught by eslint:** `eslint.config.mjs` disables `@typescript-eslint/no-unused-vars` and `no-unused-vars` (lines 13, 33).
- **Impact:** Slightly larger bundle, harder to read. Not breaking.
- **Suggested fix:** Delete the unused imports.

### C4. `storage.ts` docstring contradicts actual route behavior

- **File:** `src/lib/storage.ts` line 8 (comment block)
- **What's wrong:** The header comment says "Downloads are gated through an authenticated API route." But `src/app/api/sds/[id]/download/route.ts` is **public** — no `requireAdmin()` call. This is intentional (the public PWA needs to download SDS PDFs without auth), but the comment is misleading.
- **Suggested fix:** Reword to "Downloads are gated through an explicit API route that validates the SDS id — files are never served directly from `public/`."

### C5. `/admin/login` doesn't redirect already-authenticated users

- **File:** `src/app/admin/login/page.tsx`
- **What's wrong:** If an already-authenticated admin navigates to `/admin/login`, they see the login form again instead of being redirected to `/admin`. The middleware matcher explicitly excludes `/admin/login` from the auth check.
- **Impact:** Minor UX confusion.
- **Suggested fix:** Add a `useEffect` that calls `router.replace("/admin")` when `status === "authenticated"`.

### C6. `/admin` page fallback message doesn't actually redirect

- **File:** `src/app/admin/page.tsx` lines 65–71
- **What's wrong:** If `!session` (e.g. middleware bypassed somehow), the page renders "Redirecting to login…" but no `router.replace("/admin/login")` ever fires. The user is stuck.
- **Impact:** Very unlikely to trigger (middleware handles this), but the fallback is misleading.
- **Suggested fix:** Add `useEffect(() => { if (!session) router.replace("/admin/login"); }, [session, router]);`

### C7. Three inverse-relation fields on `User` are declared but never queried

- **File:** `prisma/schema.prisma` lines 34–36
- **What's wrong:** `uploadedSds SdsDocument[]`, `updatedChemicals Chemical[]`, and `auditLogs AuditLog[]` are declared on `User` but never used in any `include` or `select` clause anywhere in `src/` or `scripts/`.
- **Caveat:** These are **structurally required** by Prisma — without them, the forward relations (`SdsDocument.uploader`, `Chemical.updatedBy`, `AuditLog.actor`) can't be declared. So they're not removable. But they're effectively write-only.
- **Suggested fix:** None needed — leave as-is. Documented here for completeness.

### C8. ESLint config disables many useful rules

- **File:** `eslint.config.mjs` lines 9–45
- **What's wrong:** `@typescript-eslint/no-unused-vars`, `react-hooks/exhaustive-deps`, `no-unused-vars`, `prefer-const`, `no-unreachable`, etc. are all turned off. This is why C3 (dead imports) wasn't flagged.
- **Impact:** Future bugs from unused variables, missing deps, etc. won't be caught.
- **Suggested fix:** Re-enable the safer rules (`no-unused-vars`, `@typescript-eslint/no-unused-vars`, `prefer-const`, `no-unreachable`) and clean up the resulting warnings.

### C9. `react-hooks/exhaustive-deps` disabled — `useEffect` deps likely incomplete in places

- **File:** `eslint.config.mjs` line 20
- **What's wrong:** With exhaustive-deps off, several `useEffect` hooks may have stale closure bugs that aren't caught. Spot-checked: `src/components/admin/admin-overview.tsx:59–61` (`fetchDashboard` not in deps but stable enough), `src/components/detail/chemical-detail.tsx:66–71` (`chemical?.id` only — fine).
- **Impact:** No actual bugs found, but the safety net is gone.
- **Suggested fix:** Re-enable the rule and fix the warnings.

---

## D. Confirmed-working inventory

### Page routes (4 files)

| File | Status | Note |
|---|---|---|
| `src/app/page.tsx` | OK | Public SPA shell — loads DB, mounts sync, routes between catalog/detail/emergency via Zustand. Imports verified. |
| `src/app/admin/page.tsx` | OK (with C3) | 6-tab dashboard shell. Role-gates tabs. Has dead imports (see C3). |
| `src/app/admin/login/page.tsx` | OK (with C5) | Credentials sign-in via NextAuth. Doesn't redirect already-authed users (see C5). |
| `src/app/admin/change-password/page.tsx` | OK | Forces password change when `passwordChangeRequired`. Calls `/api/admin/change-password`, refreshes JWT via `update({})`, hard-navigates to `/admin`. |

### API routes (17 files)

| File | Status | Note |
|---|---|---|
| `src/app/api/route.ts` | OK | Hello-world stub. Unused but harmless. |
| `src/app/api/chemicals/route.ts` | OK | Public GET list. No auth needed. |
| `src/app/api/chemicals/[id]/route.ts` | OK | Public GET by id. 404 on missing. |
| `src/app/api/sds/[id]/download/route.ts` | OK | Public PDF stream with ETag + no-store. **Public by design** (PWA needs unauth access). |
| `src/app/api/sync/route.ts` | OK | Public delta sync. Returns chemicals + SDS + deletes. |
| `src/app/api/auth/[...nextauth]/route.ts` | OK | Standard NextAuth handler re-export. |
| `src/app/api/admin/dashboard/route.ts` | OK | `requireAdmin()`. Returns KPIs + recent activity. |
| `src/app/api/admin/chemicals/route.ts` | OK | GET list + POST create. `requireAdmin()`, zod-validated, audit-logged (`chemical.create`). |
| `src/app/api/admin/chemicals/[id]/route.ts` | OK | PUT + DELETE. `requireAdmin()`, zod-validated, audit-logged (`chemical.update` / `chemical.delete`). Soft-delete + serverVersion bump. |
| `src/app/api/admin/sds/route.ts` | OK | POST upload/replace. `requireAdmin()`, magic-byte + MIME + extension + size validation, audit-logged (`sds.upload` / `sds.replace`). |
| `src/app/api/admin/sds/[id]/route.ts` | OK | DELETE revert-to-placeholder. `requireAdmin()`, audit-logged (`sds.revert`). |
| `src/app/api/admin/sds/extract/route.ts` | OK | POST AI auto-fill. `requireAdmin()`, file validation, rasterize → VLM → JSON sanitize. Returns extracted fields. Read-only (no DB write) — audit logging not required. |
| `src/app/api/admin/users/route.ts` | OK | GET list + POST create. `requireSuperAdmin()`, zod-validated, audit-logged (`user.create`). Password hashed with bcrypt 12 rounds. |
| `src/app/api/admin/users/[id]/route.ts` | OK (with A1) | PATCH + DELETE. `requireSuperAdmin()`, 3 lockout guards (can't downgrade self, can't disable self, can't remove last super-admin). Audit-logged (`user.update` / `user.disable` / `user.delete`). **PATCH rejects `name: null`** (see A1). |
| `src/app/api/admin/audit/route.ts` | OK | GET paginated. `requireSuperAdmin()`, cursor pagination, action-prefix filter via `startsWith`. |
| `src/app/api/admin/system/info/route.ts` | OK | GET 5-block system info. `requireSuperAdmin()`. Reads package.json for Next.js version (avoids Turbopack false positive — per AUDIT-1 fix). |
| `src/app/api/admin/system/test-ai/route.ts` | OK | POST test connection. `requireSuperAdmin()`, audit-logged (`system.test-ai`). |
| `src/app/api/admin/change-password/route.ts` | OK | POST. **Bypasses `requireAdmin()` intentionally** (uses `getServerSession` directly) so users with `passwordChangeRequired=true` can change their password. Verifies current password, rejects new==current, hashes new, clears flag, audit-logged (`user.password-change`). |

### Library & config files (12 files)

| File | Status | Note |
|---|---|---|
| `src/lib/auth.ts` | OK (with B2) | NextAuth config, Credentials provider, bcrypt, JWT callbacks. Stale JWT issue (see B2). |
| `src/lib/session.ts` | OK | `requireAdmin()` + `requireSuperAdmin()` both block `passwordChangeRequired=true`. Defense-in-depth. |
| `src/lib/audit.ts` | OK | `logAction()` fire-and-forget (try/catch + console.error). `auditContext()` reads `x-forwarded-for` / `x-real-ip`. `snapshotChemical()` helper. |
| `src/lib/db.ts` | OK | PrismaClient singleton. Dev: query log enabled. Prod: warn/error only. |
| `src/lib/ai-vlm.ts` | OK | 4-provider abstraction (zai/gemini/openai/anthropic). Late imports + try/catch for optional SDKs. `getProviderInfo()` + `testProviderConnection()`. API keys masked. |
| `src/lib/ppe.ts` | OK | `normalizePpe()` is the canonical boundary. Handles string/string[]/PpeItem[]/null. Used by `PpeList` component. |
| `src/lib/validation.ts` | OK | Zod schemas for chemical create/update + SDS upload. Enum sets match types/index.ts. |
| `src/lib/serialize.ts` | OK (with C1) | `serializeChemical` + `serializeSds`. Uses `safeJsonArray()` for JSON fields. `sdsDocumentId: c.id` is misleading (see C1). |
| `src/lib/storage.ts` | OK (with C4) | File storage with path-traversal guard (`validateKey`), UUID storage keys, SHA-256 content hash. Comment inaccurate (see C4). |
| `src/lib/pdf-rasterize.ts` | OK at runtime (with B1) | pdfjs-dist + @napi-rs/canvas. 3 TS errors (see B1) but works at runtime per AUDIT-1. |
| `src/lib/pdf-placeholder.ts` | OK | Minimal valid PDF generator for placeholder SDS. |
| `src/lib/sync-engine.ts` | OK | Mutex + rate-limited delta sync. SDS blob cache with version check. `getSdsBlobForChemical` always fetches fresh when online (safety-critical). |
| `src/lib/local-db.ts` | OK | Dexie v2 schema. CRUD + search + stats helpers. |
| `src/lib/seed-data.ts` | OK (with C2) | 14 realistic chemicals. Dead `sdsDocumentId` values (see C2). |
| `src/middleware.ts` | OK | `withAuth` gate for `/admin/*` (excludes `/admin/login`). Allows ADMIN + SUPER_ADMIN. PasswordChangeRequired handled server-side via `requireAdmin()`. |
| `prisma/schema.prisma` | OK (with C7) | 4 models (User, Chemical, SdsDocument, AuditLog). 3 inverse relations on User never queried (see C7). |
| `scripts/seed-db.ts` | OK | Idempotent seed. Admin user created/updated with bcrypt 12 rounds. 14 chemicals + placeholder SDS. Preserves existing SUPER_ADMIN role on re-seed. |
| `src/types/next-auth.d.ts` | OK | Adds `id`, `role`, `passwordChangeRequired` to Session/User/JWT. |
| `src/types/ai-providers.d.ts` | OK | Declares `openai` and `@anthropic-ai/sdk` as `any` so dynamic imports don't break TS. |
| `src/types/index.ts` | OK | Canonical types: GhsPictogram, HazardClass, Department, ChemicalRecord, PpeItem, regulatory classifications, emergency contacts. |
| `next.config.ts` | OK | Standalone output, security headers (CSP, HSTS, X-Frame-Options DENY, etc.), `serverExternalPackages` for native modules. |
| `tailwind.config.ts` | OK | Standard shadcn config. |
| `tsconfig.json` | OK | Strict mode, bundler resolution, `@/*` path alias. |
| `package.json` | OK | All non-optional imports installed. Optional `openai` + `@anthropic-ai/sdk` declared as `any` and try/caught. |
| `eslint.config.mjs` | OK (with C8, C9) | Many rules disabled — see C8/C9. |

### Custom components (24 files)

#### Admin (8 files)

| File | Status | Note |
|---|---|---|
| `src/components/admin/session-provider.tsx` | OK | Wraps admin layout with NextAuth `SessionProvider`. |
| `src/components/admin/password-guard.tsx` | OK | Client-side redirect to `/admin/change-password` when flag is true. Skips `/admin/login` + `/admin/change-password` paths. |
| `src/components/admin/admin-overview.tsx` | OK | KPI cards + recent activity table. Fetches `/api/admin/dashboard`. |
| `src/components/admin/chemical-manager.tsx` | OK | CRUD table + create/edit dialog with AI auto-fill. Submits PPE as newline-joined string → split on submit. Submits `regulatoryTags` as string[]. |
| `src/components/admin/sds-manager.tsx` | OK | Upload/replace/revert table. Client-side file validation mirrors server. Uses correct SDS id for download URL. |
| `src/components/admin/user-manager.tsx` | **ISSUE (A1)** | Otherwise OK — lockout guards, role/disabled/password editing. **PATCH sends `name: null` → 400** (see A1). |
| `src/components/admin/audit-log-viewer.tsx` | OK (with B3) | Cursor pagination, expandable rows, before/after JSON. Filter dropdown missing "system" type (see B3). |
| `src/components/admin/system-settings.tsx` | OK | 5 info cards + Test Connection button. Live data from `/api/admin/system/info`. |

#### Catalog (5 files)

| File | Status | Note |
|---|---|---|
| `src/components/catalog/chemical-catalog.tsx` | OK | Stats + search + filters + grid. `useLiveQuery` for reactive Dexie reads. |
| `src/components/catalog/chemical-card.tsx` | OK | Compact card with GHS pictograms, hazard chips, PPE compact pills, regulatory tags. Memoized. |
| `src/components/catalog/dashboard-stats.tsx` | OK | KPIs + pictogram distribution + department breakdown. |
| `src/components/catalog/search-bar.tsx` | OK | Type-ahead suggestions, keyboard nav (ArrowUp/Down/Enter/Esc). |
| `src/components/catalog/filter-panel.tsx` | OK | Department/signal-word/hazard-class chips. Active-filter summary + collapsible full controls. |

#### Common (7 files)

| File | Status | Note |
|---|---|---|
| `src/components/common/theme-toggle.tsx` | OK | Light/dark/system via next-themes. Hydration-safe with `mounted` pattern. |
| `src/components/common/theme-provider.tsx` | OK | Wraps next-themes `ThemeProvider`. |
| `src/components/common/offline-indicator.tsx` | OK | Online/offline badge. |
| `src/components/common/sync-status-indicator.tsx` | OK | Synced/syncing/offline/error/local-changes states. Retry button on error. |
| `src/components/common/service-worker-register.tsx` | OK | Production-only SW registration with `SKIP_WAITING` for instant updates. |
| `src/components/common/PpeList.tsx` | OK | Renders PPE via `normalizePpe()`. 3 layouts (default/compact/iconsOnly). Inline SVG icons. |
| `src/components/common/RegulatoryTags.tsx` | OK | Whitelists tags against `REGULATORY_CLASSIFICATIONS`. Collapses unknowns to "Other (+N)". |

#### Detail (1 file)

| File | Status | Note |
|---|---|---|
| `src/components/detail/chemical-detail.tsx` | OK (with C1) | Full detail view. GHS badges, accordion SDS sections (4/5/6 marked EMERGENCY), PPE popover, SDS PDF viewer (blob URL), emergency contact. Triggers background `syncNow()` on mount. Displays `chemical.sdsDocumentId` (misleading — see C1). |

#### Emergency (2 files)

| File | Status | Note |
|---|---|---|
| `src/components/emergency/emergency-view.tsx` | OK | Full-screen red theme. Quick identifiers, GHS summary, first-aid/firefighting/spill sections, PPE list + icons-only quick-scan, emergency contact, MIRDC contacts + hotlines. ESC to exit. |
| `src/components/emergency/emergency-fab.tsx` | OK | Floating red button. Opens quick-select dialog when no chemical selected. |

#### GHS (1 file)

| File | Status | Note |
|---|---|---|
| `src/components/ghs/pictograms.tsx` | OK | All 9 GHS pictograms as inline SVG (diamond frame + symbol). Accessible (`role="img"`, `aria-label`). `GhsPictogram` + `GhsPictogramBadge` exports. |

#### Layout (2 files)

| File | Status | Note |
|---|---|---|
| `src/components/layout/app-header.tsx` | OK | Logo, sync indicator, offline indicator, theme toggle. |
| `src/components/layout/app-footer.tsx` | OK | MIRDC org info. |

---

## E. Optional packages referenced but not installed

| Package | Where referenced | How it's handled | In `package.json`? |
|---|---|---|---|
| `openai` | `src/lib/ai-vlm.ts` line 366 (`await import("openai")`) | Late import inside try/catch → throws `AiConfigError` with install instructions if missing. Declared as `any` in `src/types/ai-providers.d.ts`. | NO (intentional — only needed if `AI_PROVIDER=openai`) |
| `@anthropic-ai/sdk` | `src/lib/ai-vlm.ts` line 421 (`await import("@anthropic-ai/sdk")`) | Same pattern — late import + try/catch + `any` module declaration. | NO (intentional — only needed if `AI_PROVIDER=anthropic`) |

No other missing packages found. All other imports resolve to installed dependencies.

---

## F. Orphaned Prisma fields

Strict definition (field in `prisma/schema.prisma` not referenced anywhere in `src/` or `scripts/`):

| Field | Model | Status | Removable? |
|---|---|---|---|
| `uploadedSds SdsDocument[]` | User | Never queried (no `include: { uploadedSds: ... }` anywhere) | **NO** — structurally required by Prisma for the `SdsDocument.uploader` forward relation to exist. |
| `updatedChemicals Chemical[]` | User | Never queried | **NO** — structurally required for `Chemical.updatedBy`. |
| `auditLogs AuditLog[]` | User | Never queried | **NO** — structurally required for `AuditLog.actor`. |

**No truly orphaned (removable) fields found.** All scalar fields and forward relations are read or written by application code. The three inverse relations above are write-only from the app's perspective but can't be removed without breaking the schema.

---

## Verification commands run

```bash
# TypeScript type check (project sources only)
npx tsc --noEmit -p tsconfig.json
# → 3 errors in src/lib/pdf-rasterize.ts (see B1); rest are in examples/ and upload/ (out of scope)

# ESLint (full project)
npx eslint .
# → 1 error in upload/SDS-extracted/SDS-main/examples/websocket/frontend.tsx (out of scope); src/ clean

# Zod behavior verification (for A1)
node zodtest.mjs  # confirmed name=null fails validation
```

---

## Summary

- **1 critical bug** (A1: user-edit PATCH fails on null name) — easy fix, blocks a real workflow.
- **3 warnings** (B1: pdf-rasterize TS errors block `next build`; B2: stale JWT after role/disable; B3: audit-log filter dropdown missing "system" type).
- **9 cosmetic/hygiene items** (dead imports, misleading fields, disabled lint rules, etc.).
- **All 17 API routes** have correct auth guards (`requireAdmin` for chemical/SDS/dashboard/extract; `requireSuperAdmin` for users/audit/system; `getServerSession` direct for change-password with manual role check).
- **All 10 mutating admin routes** are audit-logged (chemical.create/update/delete, sds.upload/replace/revert, user.create/update/disable/delete, user.password-change, system.test-ai).
- **PPE normalization** is consistent — `safeJsonArray` parses the JSON string, `normalizePpe` is the canonical boundary at render time. No raw `JSON.parse(personalProtectiveEquipment)` bypasses the normalization layer.
- **Password-change enforcement** is triple-layered: client `PasswordGuard`, server `requireAdmin/requireSuperAdmin` block, and the change-password API verifies current password before accepting the new one.
- **No hardcoded secrets**, no `dangerouslySetInnerHTML` on user input (only on a static shadcn chart CSS injection), no `$queryRaw`/`$executeRaw` (Prisma parameterized queries only), CSP + HSTS + X-Frame-Options headers set in `next.config.ts`.

The system is **functionally trustworthy for development use**. Before production deployment, fix A1, B1, and B2 at minimum.
