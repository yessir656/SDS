# SDS-CHEM — Developer Guide

**Audience:** Developers maintaining, extending, or deploying the SDS-CHEM application.

**Purpose:** A complete technical reference covering architecture, file map, database schema, API surface, sync engine, security model, commands, and a testing checklist.

---

## 0. Quick Start — How to Run This Project

> Read this section first. It covers everything from a fresh `git clone` to a running app.

### 0.1 Prerequisites

| Requirement | Why | Install |
|---|---|---|
| **Bun** (required) | The `db:seed` script and production `start` script run TypeScript / the standalone server via Bun. npm/node alone will **not** work. | https://bun.sh/docs/installation |
| **Node.js 18+** | Next.js 16 needs it. Bun usually bundles a compatible runtime, but having Node helps with tooling. | https://nodejs.org/ |
| **Git** | To clone the repo. | https://git-scm.com/ |

> **Windows users:** Install Bun with PowerShell (`irm bun.sh/install.ps1 | iex`). All commands below work in **Git Bash** or **WSL**. If you only have CMD/PowerShell, the `dev` script still works (it's just `next dev -p 3000`), but `db:seed` needs Bun regardless.

### 0.2 Step-by-Step (fresh clone)

```bash
# 1. Clone the repository
git clone <your-repo-url> sds-chem
cd sds-chem

# 2. Install dependencies with Bun (do NOT use npm install)
bun install

# 3. Create your environment file from the template
cp .env.example .env

# 4. Edit .env — set these values:
#    - ADMIN_EMAIL         (your admin login email)
#    - ADMIN_PASSWORD      (a strong password — will be bcrypt-hashed)
#    - NEXTAUTH_SECRET     (generate one — see the comment in .env.example)
#    - DATABASE_URL        (already set to ./db/custom.db — leave as-is)
#    - NEXTAUTH_URL        (LEAVE UNSET — the app uses `trustHost: true` so it
#                          works behind any gateway/localhost automatically)
#
#    Generate a NEXTAUTH_SECRET with:
#      bun -e 'console.log(require("crypto").randomBytes(32).toString("hex"))'
#      node -e "console.log(require('crypto').randomBytes(32).toString('hex'))'"

# 5. Create the SQLite database + tables
bun run db:push

# 6. Seed the database:
#    - Creates the admin user from ADMIN_EMAIL / ADMIN_PASSWORD
#    - Imports the 14 seed chemicals
#    - Generates a placeholder SDS PDF for each chemical
bun run db:seed

# 7. Start the dev server
bun run dev
```

Open **http://localhost:3000** in your browser. You should see the chemical catalog with 14 chemicals.

### 0.3 Accessing the admin dashboard

1. Go to **http://localhost:3000/admin/login**
2. Sign in with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` you set in `.env`.
3. You'll be redirected to `/admin` — the dashboard with Overview / Chemicals / SDS tabs.

### 0.4 Why `npm run dev` doesn't work (and how to fix it)

If you already ran `npm install` and `npm run dev`, you likely hit one of these:

| Symptom | Cause | Fix |
|---|---|---|
| `npm run dev` fails with `tee: command not found` | Old script used a Unix-only `tee` pipe. **This has been fixed** — update to the latest code, or run `npx next dev -p 3000` directly. | `bun install` (or `npm install`) on latest code, then `bun run dev` |
| `npm run db:seed` fails with `SyntaxError` or `Cannot find module` | The seed script is TypeScript run via Bun. Node/npm can't execute `.ts` files directly. | Install Bun, then run `bun run db:seed` |
| App loads but shows "Database Error" / 0 chemicals | The database hasn't been created/seeded yet. | Run `bun run db:push && bun run db:seed` |
| `PrismaClientInitializationError` | `DATABASE_URL` points to a path that doesn't exist on your machine. | Make sure `.env` has `DATABASE_URL=file:./db/custom.db` (relative path). Run `bun run db:push`. |
| 401 on every admin API | `NEXTAUTH_SECRET` is missing or the `.env` wasn't loaded. | Set `NEXTAUTH_SECRET` in `.env`; restart `bun run dev`. |
| Login fails with "Invalid email or password" | Admin user not created, or `.env` credentials don't match what's in the DB. | Run `bun run db:seed` again (it's idempotent — updates the admin to match `.env`). |

### 0.5 Migrating from npm to Bun (if you already ran npm install)

If you already ran `npm install`, you can clean up and switch to Bun:

```bash
# Remove npm's node_modules and lockfile
rm -rf node_modules package-lock.json

# Install with Bun
bun install

# Continue with step 5 onwards (db:push, db:seed, dev)
bun run db:push
bun run db:seed
bun run dev
```

> **Note:** `bun install` reads the same `package.json` and creates `bun.lockb` instead of `package-lock.json`. Both are fine; just don't mix them.

### 0.6 Quick command reference

| Command | What it does |
|---|---|
| `bun install` | Install dependencies |
| `bun run dev` | Start dev server on http://localhost:3000 |
| `bun run lint` | Run ESLint |
| `bun run db:push` | Create/update SQLite schema from `prisma/schema.prisma` |
| `bun run db:seed` | Create admin user + seed 14 chemicals (idempotent) |
| `bun run db:generate` | Regenerate Prisma Client after schema changes |
| `bun run db:reset` | ⚠️ Drop and recreate the database (destroys data) |
| `bun run build` | Production build (Unix-only due to `cp -r`) |
| `bun run start` | Run the production standalone server (after `build`) |

---

## 1. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript 5 (strict) |
| UI | Tailwind CSS v4 + shadcn/ui (New York) + Lucide icons |
| Client state | Zustand |
| Server state | TanStack Query (available), fetch-based clients |
| Client DB (offline-first) | Dexie (IndexedDB) |
| Server DB | Prisma + SQLite |
| Auth | NextAuth.js v4 (Credentials provider, JWT sessions) |
| Password hashing | bcryptjs (12 rounds) |
| Validation | zod |
| PWA | Vanilla service worker + web manifest |
| Runtime | Bun (dev), Node-compatible standalone build |

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        PUBLIC PWA  (/)                          │
│  Catalog → Detail → Emergency views (single-route SPA, Zustand) │
│  Offline-first: all reads go to Dexie (IndexedDB)               │
│  Writes (favorites/notes/prefs) are LOCAL ONLY                  │
└───────────────┬─────────────────────────────────┬───────────────┘
                │ GET /api/sync?since=<ts>         │ GET /api/chemicals
                │ GET /api/sds/[id]/download       │
                ▼                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                     PUBLIC API (no auth)                        │
│  /api/sync          delta sync (chemicals + SDS metadata)       │
│  /api/chemicals     list / get chemical                         │
│  /api/sds/[id]/download   stream SDS PDF                        │
└───────────────┬─────────────────────────────────────────────────┘
                │ Prisma
                ▼
┌─────────────────────────────────────────────────────────────────┐
│                  PRISMA + SQLite  (source of truth)             │
│  User · Chemical · SdsDocument                                  │
└─────────────────────────────────────────────────────────────────┘
                ▲
                │ requireAdmin()  (server-side session check)
┌───────────────┴─────────────────────────────────────────────────┐
│                    ADMIN API (auth required)                    │
│  /api/admin/dashboard          stats                            │
│  /api/admin/chemicals          POST  (create)                   │
│  /api/admin/chemicals/[id]     GET / PUT / DELETE               │
│  /api/admin/sds                POST  (upload PDF)               │
│  /api/admin/sds/[id]           DELETE (revert to placeholder)   │
└───────────────┬─────────────────────────────────────────────────┘
                ▲
                │ NextAuth session (JWT, httpOnly cookie)
┌───────────────┴─────────────────────────────────────────────────┐
│                    ADMIN UI  (/admin)                           │
│  /admin/login   sign-in form                                    │
│  /admin         dashboard: 6 tabs (last 3 SUPER_ADMIN-only)     │
│  Protected by src/middleware.ts (edge, role=SUPER_ADMIN||ADMIN)   │
└─────────────────────────────────────────────────────────────────┘
```

### Key principles
- **Server is the source of truth** for chemical & SDS data. Client Dexie DB is a cache.
- **Offline-first:** the public PWA reads from Dexie. It works fully offline after first sync.
- **Delta sync:** clients ask for changes since their last sync timestamp — never the whole DB.
- **SDS PDFs are versioned & cached** as Blobs in IndexedDB; only re-downloaded when version changes.
- **User preferences (favorites/notes) stay local** — never sent to the server, never overwritten.
- **Admin authorization is server-side** in every admin API route (`requireAdmin()`). The edge middleware is defense-in-depth only.

---

## 3. File Map

### App routes
```
src/app/
├── layout.tsx                       Root layout, PWA metadata, ThemeProvider, SessionProvider
├── page.tsx                         Public PWA single-route SPA (catalog/detail/emergency)
├── globals.css                      Tailwind v4 CSS-first config + animations + scrollbar
├── admin/
│   ├── layout.tsx                   Admin layout shell
│   ├── page.tsx                     Admin dashboard (Overview / Chemicals / SDS tabs)
│   └── login/page.tsx               Sign-in form
└── api/
    ├── route.ts                     Health check
    ├── auth/[...nextauth]/route.ts  NextAuth handler
    ├── sync/route.ts                GET /api/sync?since=<ts>  (public delta sync)
    ├── chemicals/
    │   ├── route.ts                 GET /api/chemicals
    │   └── [id]/route.ts            GET /api/chemicals/[id]
    ├── sds/[id]/download/route.ts   GET  (stream SDS PDF)
    └── admin/
        ├── dashboard/route.ts       GET  (admin stats)
        ├── chemicals/
        │   ├── route.ts             POST (create)
        │   └── [id]/route.ts        GET / PUT / DELETE
        └── sds/
            ├── route.ts             POST (upload PDF)
            ├── [id]/route.ts        DELETE (revert to placeholder)
            └── extract/route.ts     POST (AI auto-fill from PDF — VLM extraction)
```

### Library code
```
src/lib/
├── db.ts                Prisma client (singleton, query-log off in prod)
├── auth.ts              NextAuth options + hashPassword / verifyPassword (bcrypt) + **trustHost: true** (works behind preview gateway + localhost)
├── session.ts           requireAdmin() / requireSuperAdmin() server-side guards — **stale-JWT defense**: DB fresh-state check + 60s in-memory cache + invalidateUserStateCache() on mutations
├── storage.ts           Safe SDS file storage (UUID filenames, no path exposure)
├── validation.ts        zod schemas for chemical & SDS inputs (name is `.nullable().optional()` to allow empty-name edits)
├── pdf-placeholder.ts   Generates a minimal valid placeholder PDF
├── pdf-rasterize.ts     PDF → PNG renderer (pdfjs-dist + @napi-rs/canvas, pure JS, no Poppler; casts for v6 type mismatches)
├── ai-vlm.ts            Provider-agnostic VLM abstraction (zai / gemini / openai / anthropic)
├── ppe.ts               PPE display helpers / lookup tables
├── sync-engine.ts       Client delta sync engine (mutex, rate-limit, SDS blob caching)
├── local-db.ts          Dexie schema v2 (chemicals, sdsDocuments, sdsBlobs, syncMeta, ...)
├── seed-data.ts         14 chemicals + 7 locations + default prefs (sdsDocumentId="" placeholders — no fake ids)
├── serialize.ts         JSON ↔ DB field (de)serialization — serializeChemical includes `sdsDocument` relation and uses `c.sdsDocument?.id` for the real SDS cuid
└── utils.ts             cn() and misc
```

### Hooks
```
src/hooks/
├── use-online-status.ts     Navigator.onLine reactive subscription
├── use-database-ready.ts    Waits for Dexie initDatabase() to resolve
├── use-sync.ts              Drives the sync engine (startup / online / periodic)
├── use-mobile.ts            Viewport breakpoint hook
├── use-toast.ts             shadcn toast wrapper
└── use-pagination.ts        Client-side pagination hook (clamp + reset-on-deps-change via render-phase setState — avoids Next.js 16 set-state-in-effect errors)
```

### Components
```
src/components/
├── layout/        app-header.tsx, app-footer.tsx
├── catalog/       chemical-catalog, chemical-card, search-bar, filter-panel, dashboard-stats
├── detail/        chemical-detail.tsx
├── emergency/     emergency-view.tsx, emergency-fab.tsx
├── ghs/           pictograms.tsx (all 9 GHS pictograms as inline SVG)
├── common/        theme-provider, theme-toggle, offline-indicator,
│                  sync-status-indicator, service-worker-register
├── admin/         session-provider, admin-overview, chemical-manager, sds-manager
└── ui/            shadcn/ui component set (55 components)
```

### Other
```
prisma/schema.prisma      User (3-tier role) · Chemical · SdsDocument · AuditLog
src/lib/audit.ts         logAction() + auditContext() — fire-and-forget audit helper
src/lib/session.ts       requireAdmin() + requireSuperAdmin() server-side guards
src/middleware.ts         Edge-level /admin/* protection (role=SUPER_ADMIN || ADMIN)
src/types/index.ts        Domain types (ChemicalRecord, GhsPictogram, HazardClass, SyncStatus, ...)
src/types/next-auth.d.ts  Augments NextAuth session/token with `role` + `passwordChangeRequired`
src/store/app-store.ts    Zustand: view routing, search/filter, sync status
src/hooks/                use-sync, use-database-ready, use-online-status, use-mobile, use-toast, **use-pagination**

public/manifest.json      PWA manifest (navy theme #0a2540, DOST-MIRDC icons)
public/sw.js              Vanilla service worker (app-shell cache, SWR for assets)
public/dost-mirdc-logo.png  Official DOST-MIRDC logo (1929×1928, source for all icons)
public/icons/             16/32/192/512 PNG (any + maskable) + SVG — all regenerated from DOST-MIRDC logo
scripts/seed-db.ts        Seeds admin from .env + migrates 14 chemicals into Prisma DB
scripts/generate-icons.mjssharp-based icon generator

.env                      DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, NEXTAUTH_SECRET
                          (NEXTAUTH_URL is intentionally UNSET — `trustHost: true` in auth.ts
                          makes NextAuth work behind the preview gateway AND localhost without
                          a hardcoded URL)
                          + optional AI_PROVIDER / GEMINI_API_KEY / GEMINI_MODEL
                          (AI_PROVIDER defaults to "zai" — sandbox-only. Set to "gemini"
                          for local dev. See §6A below.)
.env.example              Template (committed — safe placeholders, no real secrets)
next.config.ts            Security headers (CSP, HSTS, X-Frame-Options, ...), reactStrictMode
```

---

## 4. Database Schema (Prisma)

### `User` — admin accounts only
| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| email | String | unique |
| passwordHash | String | bcrypt (12 rounds) |
| name | String? | optional display name |
| role | String | `"SUPER_ADMIN"` \| `"ADMIN"` \| `"USER"` (only SUPER_ADMIN and ADMIN can sign in; USER is reserved for the public PWA and cannot log in here) |
| disabled | Boolean | default `false` — super-admin can disable an account without deleting it (also blocks sign-in via `authorize()`) |
| passwordChangeRequired | Boolean | default `false` — when `true`, the user is forced to `/admin/change-password` on next login (triple-layered enforcement — see §8) |
| lastLoginAt | DateTime? | updated on each successful sign-in |
| createdAt / updatedAt | DateTime | |
| Relations | `SdsDocument[] uploadedSds`, `Chemical[] updatedChemicals`, `AuditLog[] auditLogs` | audit trail |

### `Chemical` — central catalog entity
| Field | Type | Notes |
|---|---|---|
| id | String | PK (stable slug, e.g. `chem-acetone`) |
| casNumber, chemicalName, formula | String | identifiers |
| tradeName, manufacturer, supplier | String | provenance |
| signalWord | String | `"danger"` / `"warning"` |
| hazardClasses | String | JSON-encoded `HazardClass[]` |
| ghsPictograms | String | JSON-encoded `GhsPictogram[]` |
| storageLocation, department | String | physical location |
| safetyInstructions | String | |
| version | String | SDS document version label (e.g. `"1.4"`) |
| emergencyContact | String | |
| personalProtectiveEquipment | String | JSON array |
| firstAidMeasures, firefightingMeasures, accidentalReleaseMeasures | String | SDS sections 4/5/6 |
| **serverVersion** | Int | **sync key** — incremented on every update |
| createdAt, updatedAt | DateTime | |
| **deletedAt** | DateTime? | **soft delete** — sync propagates deletes |
| updatedById | String? | FK → User (audit) |
| Relations | `SdsDocument? sdsDocument` | 1:1 |

Indexes: `updatedAt`, `deletedAt`, `chemicalName`, `casNumber`.

### `SdsDocument` — one per chemical (1:1)
| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| chemicalId | String | unique FK → Chemical (cascade delete) |
| storageKey | String | safe generated filename (`<uuid>.pdf`) — never user-supplied |
| originalFileName | String | for display/download only |
| fileSize, mimeType | Int / String | |
| contentHash | String | sha256 of file content |
| status | String | `"placeholder"` / `"available"` |
| **version** | Int | **incremented on each replace** (client re-download trigger) |
| uploadedById | String? | FK → User (audit) |
| createdAt, updatedAt | DateTime | |

Indexes: `updatedAt`, `status`.

### `AuditLog` — append-only trail of every administrative mutation
| Field | Type | Notes |
|---|---|---|
| id | String (cuid) | PK |
| actorId | String? | FK → User, nullable (null for system actions). `onDelete: SetNull` so the log row survives user deletion. |
| actorEmail | String? | Denormalized email — same reason: log survives user deletion. |
| action | String | Dotted convention, e.g. `chemical.create`, `chemical.update`, `chemical.delete`, `sds.upload`, `sds.replace`, `sds.revert`, `user.create`, `user.update`, `user.disable`, `user.delete`, `user.password-change`, `system.test-ai`. |
| entityType | String | `"chemical"` \| `"sds"` \| `"user"` \| `"session"` \| `"system"`. |
| entityId | String | id of the affected entity (or the provider name for `system.*`). |
| summary | String | Human-readable one-liner shown in the audit-log viewer. |
| before | String? | JSON snapshot of state before the mutation (for updates/deletes). |
| after | String? | JSON snapshot of state after the mutation (for creates/updates). |
| ipAddress | String? | Best-effort client IP from `x-forwarded-for` / `x-real-ip`. |
| createdAt | DateTime | default `now()`. |
| Relations | `User? actor` | nullable; `onDelete: SetNull`. |

Indexes: `createdAt`, `actorId`, `[entityType, entityId]`, `action`.

Entries are written via `logAction()` in `src/lib/audit.ts` (fire-and-forget — failures are logged to stderr and never propagate to the caller). The viewer (`src/components/admin/audit-log-viewer.tsx`) is cursor-paginated and exposed at `GET /api/admin/audit` (SUPER_ADMIN only).

---

## 5. Client Database (Dexie v2)

```
chemicals      : ChemicalRecord  (keyPath: id)        + indexes on casNumber, department, etc.
sdsDocuments   : SdsMeta          (keyPath: chemicalId)
sdsBlobs       : { chemicalId, version, blob, fetchedAt }   ← SDS PDF Blob cache
syncMeta       : { key, value }   ← lastSyncTimestamp, syncMutex, etc.
locations      : LaboratoryLocation
preferences    : UserPreferences  (favorites, notes, theme — LOCAL ONLY)
```

**Why two stores?** `sdsDocuments` holds metadata (small, synced as JSON). `sdsBlobs` holds the actual PDF Blob (large, only re-fetched when `version` changes).

---

## 6. API Reference

### Public (no auth)
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/sync?since=<epoch-ms>` | Delta sync. Returns `{ chemicals: [...], sdsDocuments: [...], deletedChemicalIds: [...], serverTime }`. Only records with `updatedAt > since` (or `deletedAt > since`) are returned. |
| GET | `/api/chemicals` | List all non-deleted chemicals (metadata only, no PDF). |
| GET | `/api/chemicals/[id]` | Single chemical. |
| GET | `/api/sds/[id]/download` | Stream the SDS PDF for chemical `[id]`. Sets `Content-Type: application/pdf`. Used by both the public PWA (caches Blob) and admin "View". |

### Admin (auth required — `requireAdmin()`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/dashboard` | Stats: total chemicals, SDS coverage, department distribution, recent updates. |
| POST | `/api/admin/chemicals` | Create chemical. Auto-creates a placeholder `SdsDocument`. Body validated by zod. |
| GET | `/api/admin/chemicals/[id]` | Read single (admin view). |
| PUT | `/api/admin/chemicals/[id]` | Update. Bumps `serverVersion`. Sets `updatedById`. |
| DELETE | `/api/admin/chemicals/[id]` | Soft-delete (`deletedAt = now`). Cascade-soft-deletes the SDS. |
| POST | `/api/admin/sds` | Upload / replace SDS PDF. Multipart form. Validates magic bytes + MIME + extension + size. Stores with UUID filename. Increments `version`, sets `status = available`. |
| DELETE | `/api/admin/sds/[id]` | Revert to placeholder. Removes the uploaded file, resets `status = placeholder`, increments `version`. |
| POST | `/api/admin/sds/extract` | **AI auto-fill.** Accepts an SDS PDF (multipart), rasterizes first 5 pages to PNG, sends to the configured VLM provider (`src/lib/ai-vlm.ts`), parses + sanitizes the JSON response, returns `{ success, data }`. 60s timeout. See §6A. |

### Super-admin only (`requireSuperAdmin()`)
| Method | Path | Purpose |
|---|---|---|
| GET | `/api/admin/users` | List all admin accounts (SUPER_ADMIN + ADMIN). `passwordHash` is never included in the response. |
| POST | `/api/admin/users` | Create admin. Zod-validated body: `email`, `password` (≥8 chars), `name?`, `role` (`ADMIN` \\| `SUPER_ADMIN`, default `ADMIN`), `passwordChangeRequired` (default `true`). Returns 409 on duplicate email. Audit-logs `user.create`. |
| PATCH | `/api/admin/users/[id]` | Update `name` / `role` / `disabled` / `password` / `passwordChangeRequired`. At least one field required. **Lockout guards**: cannot change own role away from `SUPER_ADMIN`; cannot disable self; cannot disable / downgrade / delete the last active super-admin. Resetting a password implicitly sets `passwordChangeRequired=true` unless the same PATCH explicitly sets it to `false`. Audit-logs `user.update` (or `user.disable` when `disabled: true` is set). |
| DELETE | `/api/admin/users/[id]` | Permanently delete admin. Same lockout guards as PATCH (cannot delete self; cannot delete last active super-admin). Audit-logs `user.delete`. |
| GET | `/api/admin/audit?cursor=&limit=&entityType=&action=&actorId=` | Cursor-paginated audit log (newest first). Defaults: `limit=50`, max `100`. `cursor` is the ISO timestamp of the last row on the previous page. Fetches `limit+1` rows to detect `hasMore`; returns `{ entries, nextCursor, hasMore }`. Filters are all optional: `entityType`, `action` (matched as a **prefix** — e.g. `action=user.`), `actorId`. |
| GET | `/api/admin/system/info` | Returns 5 read-only info blocks: **ai** (provider config from `getProviderInfo()` — masked key, never the actual key), **storage** (walks `storage/sds/` for totalBytes / fileCount / largestFile / averageBytes), **database** (SQLite file size + path + `DATABASE_URL`), **sync** (chemical/SDS/user/auditLog counts + `lastUpdatedAt` + `maxServerVersion` — 7 parallel DB queries), **system** (`nodeVersion`, `platform`, `arch`, `environment`, `nextjsVersion`, `uptimeSeconds`, `currentTime`, `timezone`). |
| POST | `/api/admin/system/test-ai` | Calls `testProviderConnection()` — sends a minimal text-only prompt (`'Reply with exactly the JSON: {"ok":true}'`) to the configured VLM provider. Returns `{ ok, provider, model, latencyMs, responsePreview, error? }`. **Never sends an image, never touches the DB.** Audit-logs as `system.test-ai` with the result + latency in the `after` snapshot. |

### Any authenticated admin (used by the password-change flow)
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/admin/change-password` | Body: `{ currentPassword, newPassword }`. Verifies `currentPassword` against the user's bcrypt hash, rejects if `newPassword === currentPassword`, hashes the new password, updates the DB (`passwordHash` + `passwordChangeRequired=false`), audit-logs `user.password-change`. **Uses `getServerSession` directly (NOT `requireAdmin()`)** so that users with `passwordChangeRequired === true` can still call it — this is the one API route that bypasses the password-change gate. |

### Auth
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/callback/credentials` | NextAuth credentials sign-in. |
| GET/POST | `/api/auth/*` | NextAuth session / csrf / signout handlers. |

---

## 6A. AI Auto-Fill Architecture (VLM Provider Abstraction)

The "Auto-fill from PDF" feature reads an uploaded SDS PDF using a vision-language
model (VLM) and returns structured JSON fields. The provider is swappable via the
`AI_PROVIDER` env var so the same code works on the sandbox (free in-house AI) and
on a local machine (free Google Gemini tier).

### Request flow

```
Admin UI (chemical-manager.tsx)
  └─ user clicks "Auto-fill from PDF", selects a .pdf file
  └─ POST /api/admin/sds/extract  (multipart: file=...)
       │
       ├─ requireAdmin()                          ← server-side authz
       ├─ validate file (magic bytes %PDF- + MIME + .pdf + size)
       ├─ assertProviderConfigured(provider)      ← fail fast if key missing
       ├─ rasterizePdfToPngs(buffer, {maxPages:5, scale:2})   ← src/lib/pdf-rasterize.ts
       │     └─ pdfjs-dist + @napi-rs/canvas (pure JS, no Poppler)
       ├─ callVlm(pageImages, EXTRACTION_PROMPT)  ← src/lib/ai-vlm.ts
       │     ├─ AI_PROVIDER=zai       → z-ai-web-dev-sdk (glm-4.6v)   [sandbox default]
       │     ├─ AI_PROVIDER=gemini    → @google/generative-ai (gemini-3.6-flash)
       │     ├─ AI_PROVIDER=openai    → openai SDK (gpt-4o-mini)
       │     └─ AI_PROVIDER=anthropic → @anthropic-ai/sdk (claude-3-5-sonnet)
       ├─ extractJson(rawResponse)                 ← strip markdown fences
       ├─ JSON.parse + sanitize (enum filter, trim, dedupe)
       └─ return { success: true, data: {…15 fields…} }
  └─ frontend merges fields into the chemical form (preserves the manual `id` field)
```

### Provider selection (`src/lib/ai-vlm.ts`)

| `AI_PROVIDER` | SDK package | Default model | Where it works |
|---|---|---|---|
| `zai` (default) | `z-ai-web-dev-sdk` (pre-installed) | `glm-4.6v` | **Z.ai sandbox only** — auto-configured via `/etc/.z-ai-config`. Does NOT work on a local machine. |
| `gemini` | `@google/generative-ai` (pre-installed, v0.24.1) | `gemini-3.6-flash` | Local dev / production. Free tier: 1,500 req/day. |
| `openai` | `openai` (NOT installed — `bun add openai`) | `gpt-4o-mini` | Local dev / production. Paid. |
| `anthropic` | `@anthropic-ai/sdk` (NOT installed — `bun add @anthropic-ai/sdk`) | `claude-3-5-sonnet-20241022` | Local dev / production. Paid. |

### Gemini configuration (verified)

| Item | Value |
|---|---|
| SDK | `@google/generative-ai` v0.24.1 (installed, pre-built into `node_modules`) |
| API endpoint | `https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent` (hardcoded in SDK as `DEFAULT_API_VERSION = "v1beta"`) |
| **Default model** | **`gemini-3.6-flash`** — hardcoded in `src/lib/ai-vlm.ts` line 270 as the fallback when `GEMINI_MODEL` is not set. Confirmed real and served by the current API. |
| Override | Set `GEMINI_MODEL=<model>` in `.env` to use a different model. Do NOT use retired models (see below). |
| Safety settings | All 4 categories set to `BLOCK_NONE` — SDS documents contain hazard words ("carcinogen", "fatal") that would otherwise trigger filters and silently blank the response. |
| Output mode | `responseMimeType: "application/json"` — forces valid JSON output, no markdown fences to strip. |
| **Retired models** | `gemini-1.5-flash`, `gemini-1.5-pro`, `gemini-2.0-flash`, `gemini-2.0-flash-lite`, `gemini-2.0-pro`, `gemini-2.5-flash`, `gemini-2.5-pro` — all return 404 "model is no longer available". |

### Required environment variables (Gemini)

| Variable | Required? | Purpose |
|---|---|---|
| `AI_PROVIDER` | Yes (to use Gemini) | Set to `gemini`. Defaults to `zai` if unset. |
| `GEMINI_API_KEY` | Yes (when `AI_PROVIDER=gemini`) | Google AI Studio API key. Get one free at https://aistudio.google.com/apikey. NEVER commit this. |
| `GEMINI_MODEL` | No | Override the default `gemini-3.6-flash`. Only set if you need a different currently-served model. |

### Error handling (`src/lib/ai-vlm.ts`)

| Error class | Thrown when | HTTP status returned by extract route |
|---|---|---|
| `AiConfigError` | Provider API key missing, or SDK package not installed, or (zai) config file not found. | 503 |
| `AiRequestError` | The API call itself failed (network, auth, rate limit, 404 model not found). Carries `.status` from the upstream API. | 502 (or the upstream status if 4xx/5xx) |

The extract route (`src/app/api/admin/sds/extract/route.ts`) catches both, returns a JSON `{ success: false, error: "…" }` body, and never exposes the API key or raw request payload to the client.

### Local development setup (Gemini)

```bash
# 1. Get a free key:  https://aistudio.google.com/apikey
# 2. Add to .env:
AI_PROVIDER=gemini
GEMINI_API_KEY=your_real_key_here
# GEMINI_MODEL is optional — defaults to gemini-3.6-flash
# 3. Restart:
bun run dev
```

The `@google/generative-ai` package is already in `package.json` — no `bun add` needed.

### Where the AI code lives

| File | Role |
|---|---|
| `src/lib/ai-vlm.ts` | Provider abstraction: `resolveProvider()`, `assertProviderConfigured()`, `callVlm()`, and per-provider functions `callZai()`, `callGemini()`, `callOpenai()`, `callAnthropic()`. |
| `src/lib/pdf-rasterize.ts` | PDF → PNG conversion (pdfjs-dist + @napi-rs/canvas). Returns `Buffer[]` (one per page, max 5). |
| `src/app/api/admin/sds/extract/route.ts` | The API endpoint. Validates file, calls rasterize + callVlm, parses + sanitizes response. |
| `src/components/admin/chemical-manager.tsx` | Frontend: the "Auto-fill from PDF" button + form-merge logic. |
| `src/types/ai-providers.d.ts` | TypeScript module declarations for the optional (not-pre-installed) `openai` and `@anthropic-ai/sdk` packages. |

---

## 7. Sync Engine (`src/lib/sync-engine.ts`)

### Trigger points
1. **App startup** — fires once Dexie is initialized.
2. **Offline → online transition** — `use-online-status` hook notifies the engine.
3. **Periodic** — runs every few minutes while online.

### Algorithm
```
1. Acquire mutex (in Dexie.syncMeta) — prevents concurrent syncs across tabs.
2. Read lastSyncTimestamp from syncMeta.
3. GET /api/sync?since=<lastSyncTimestamp>.
4. For each chemical in response:
   - If deleted (deletedAt > since) → remove from Dexie.chemicals.
   - Else → upsert into Dexie.chemicals.
5. For each sdsDocument in response:
   - Upsert metadata into Dexie.sdsDocuments.
   - Compare version with Dexie.sdsBlobs.
     - If version unchanged AND blob exists → skip (no re-download).
     - If version changed OR blob missing → GET /api/sds/[id]/download,
       store Blob in Dexie.sdsBlobs with new version.
6. Persist new lastSyncTimestamp = response.serverTime.
7. Release mutex. Update Zustand sync status.
```

### Rate limiting
A minimum interval between sync attempts prevents hammering the server on flaky connections. Manual retry from the UI bypasses the interval once.

### Status states (the `SyncStatus` type)
| State | Meaning |
|---|---|
| `offline` | Navigator reports offline. No sync attempts. |
| `syncing` | A sync is in progress. |
| `synced` | Last sync completed successfully and we're online. |
| `local-changes` | *(reserved)* user has local-only changes that couldn't be pushed (currently preferences only — always local). |
| `error` | Last sync attempt failed. UI shows a retry button. |

### Conflict resolution
- **Chemical / SDS data:** server-wins. The latest `updatedAt` always wins.
- **User preferences / favorites / notes:** local-only, never synced, never overwritten.

---

## 8. Security Model

### Authentication
- NextAuth Credentials provider.
- **`trustHost: true`** is set in `authOptions` (`src/lib/auth.ts`) so NextAuth trusts the request's `Host` header. This makes the app work behind the preview gateway (`preview-chat-<id>.space-z.ai`) AND `localhost:3000` without needing a hardcoded `NEXTAUTH_URL`. (If you ever deploy to a custom domain, `trustHost` continues to work — no env change needed.)
- **3-tier role hierarchy**: `SUPER_ADMIN` > `ADMIN` > `USER`. Only `SUPER_ADMIN` and `ADMIN` can sign in to `/admin/*`; `USER` is reserved for the public PWA and is rejected by `authorize()`.
- Disabled accounts (`disabled === true`) cannot sign in.
- Passwords hashed with **bcrypt (12 rounds)** — never stored or logged in plaintext.
- JWT session strategy, 30-day max age. The JWT carries `id`, `role`, and `passwordChangeRequired`; the `session` callback copies them onto `session.user`.
- On `useSession().update()` (trigger `"update"`), the `jwt` callback re-fetches `passwordChangeRequired` + `role` from the DB so a just-completed password change is reflected without a fresh sign-in.
- Cookies: `httpOnly`, `sameSite=lax`, `secure` in production (`__Secure-` prefix).

### Stale-JWT defense (Phase E10)
Without extra safeguards, a downgraded or disabled admin could keep using their JWT for up to 30 days (the JWT `maxAge`). To close this hole, `requireAdmin()` and `requireSuperAdmin()` perform a **DB-backed fresh-state check** on every call:

1. `getFreshUserState(userId)` (in `src/lib/session.ts`) queries the DB for the user's current `disabled`, `role`, and `passwordChangeRequired` fields.
2. Results are cached in an in-memory `Map<userId, FreshUserState>` with a **60-second TTL** — so the hot path (every admin API call) stays fast and only hits the DB once per minute per user.
3. If the cached state shows `disabled === true` or `role` no longer qualifies, the guard returns 401 immediately — the JWT is rejected even though it hasn't expired.
4. Mutations that change a user's state call `invalidateUserStateCache(userId)` to bust the cache immediately:
   - `PATCH /api/admin/users/[id]` (role change, disable/enable, password reset)
   - `DELETE /api/admin/users/[id]`
   - `POST /api/admin/change-password` (clears `passwordChangeRequired`)

This means a SUPER_ADMIN can disable a compromised account and the disabled user's **very next API call** returns 401 (worst case: 60 seconds later when the cache expires).

### Authorization (defense in depth)
1. **Edge middleware** (`src/middleware.ts`) — blocks `/admin` and `/admin/*` (except `/admin/login`) unless the JWT has `role === "SUPER_ADMIN" || role === "ADMIN"`. Fast, runs at the edge. (Super-admin-only routes enforce the stricter check server-side via `requireSuperAdmin()`.) The matcher explicitly includes the bare `/admin` URL so it doesn't slip through to a "Redirecting…" screen.
2. **`requireAdmin()`** (in `src/lib/session.ts`) — every admin API route for chemicals / SDS / dashboard / change-password-adjacent features calls this. Returns 401 if the session is missing or the user is not `ADMIN` / `SUPER_ADMIN`. **Also returns 401 if the user has `passwordChangeRequired === true`** — defense-in-depth so a bypassed client guard still can't reach the API. **Also performs the stale-JWT fresh-state check** (see above).
3. **`requireSuperAdmin()`** (in `src/lib/session.ts`) — same shape as `requireAdmin()` but additionally requires `role === "SUPER_ADMIN"`. Used by user-management, audit-log, and system-settings routes. Also blocks `passwordChangeRequired` users and performs the stale-JWT check.
4. **`PasswordGuard`** client component (`src/components/admin/password-guard.tsx`) — mounted in the admin layout. Uses `useSession()` + `usePathname()`; if the current path is NOT `/admin/login` and NOT `/admin/change-password`, and the session has `passwordChangeRequired === true`, hard-redirects to `/admin/change-password`.
5. **405-before-401 guard** — admin API routes that only support a subset of HTTP methods (e.g. `/api/admin/sds` supports only `POST`) declare explicit method handlers that call `requireAdmin()` FIRST, then return 405 with an `Allow` header. This ensures an unauthenticated request never sees a "405 Method Not Allowed" before the 401.

### Audit log
Every chemical / SDS / user / system mutation is logged via `logAction()` in `src/lib/audit.ts`.
- **Fire-and-forget**: `logAction()` wraps its `db.auditLog.create()` in a `try/catch` and only logs to `stderr` on failure. An audit-log problem can **never** break the main operation the user is trying to perform.
- **Captures**: `actorId`, `actorEmail` (denormalized so the row survives user deletion), `action` (dotted, e.g. `chemical.create`, `user.disable`, `system.test-ai`), `entityType`, `entityId`, `summary`, `before` / `after` JSON snapshots (built via `snapshotChemical()` for chemicals), and a best-effort `ipAddress` (from `x-forwarded-for` / `x-real-ip` via `auditContext()`).
- **Storage**: `AuditLog` table (append-only — no update / delete endpoints exist). Indexed on `createdAt`, `actorId`, `[entityType, entityId]`, `action`.
- **Viewer**: `GET /api/admin/audit` (SUPER_ADMIN only), cursor-paginated. UI: `src/components/admin/audit-log-viewer.tsx`.

### Password change enforcement (triple-layered)
When a super-admin creates a user with a temporary password (or resets an existing user's password), `passwordChangeRequired` is set to `true`. The user is then forced to change their password on next login via three independent layers:
1. **Client-side guard** — `PasswordGuard` (`src/components/admin/password-guard.tsx`) redirects to `/admin/change-password` as soon as the session loads. Bypassing this is possible (disable JS), so it's UX + first line of defense only.
2. **Server-side guard** — both `requireAdmin()` and `requireSuperAdmin()` return 401 when `passwordChangeRequired === true`. So a user with the flag set cannot call any admin API route except the change-password endpoint.
3. **Verified current password** — `POST /api/admin/change-password` calls `getServerSession` directly (NOT `requireAdmin()`), verifies `currentPassword` against the bcrypt hash, rejects if `newPassword === currentPassword`, hashes the new password, sets `passwordChangeRequired=false`, and audit-logs `user.password-change`. The client then calls `useSession().update()` so the JWT refreshes without a fresh sign-in.

The change-password route is the **only** admin API route that does not go through `requireAdmin()` / `requireSuperAdmin()` — by design, so the flag-bearer can still escape the gate.

### SDS file upload safety
- **Magic-byte validation** — the file must start with `%PDF-` (PDF signature). Renamed non-PDFs are rejected.
- **MIME type check** — must be `application/pdf`.
- **Extension check** — must end in `.pdf`.
- **Size limit** — enforced (see `validation.ts`).
- **Filename handling** — user-supplied filename is stored only for display/download. The actual stored file is named `<uuid>.pdf` under `storage/`. No path traversal possible.
- **No path exposure** — `storageKey` is a UUID, never the original path.

### Input validation
- All admin chemical inputs validated with **zod** schemas before reaching Prisma.
- Prisma parameterizes all queries — no raw SQL, no SQL injection surface.

### Security headers (`next.config.ts`)
- Content-Security-Policy
- X-Frame-Options: DENY
- X-Content-Type-Options: nosniff
- Referrer-Policy
- Strict-Transport-Security (HSTS)
- Permissions-Policy

### Secrets
- `NEXTAUTH_SECRET` — required in production. Generate with:
  ```bash
  bun -e 'console.log(require("crypto").randomBytes(32).toString("hex"))'
  ```
- `ADMIN_PASSWORD` — plaintext in `.env` only; hashed before DB storage.
- `.env` is gitignored. `.env.example` is the committed template.

### Known platform-level caveat
The sandbox gateway (`Caddyfile`) uses an `XTransformPort` query param for port routing. This is an open-proxy-style SSRF surface at the **infra level** and is outside the application code. Flag for the platform team before any public deployment.

---

## 9. PWA Behavior

- **Manifest** (`public/manifest.json`): standalone display, **navy theme `#0a2540`** (DOST-MIRDC brand), icons for `any` + `maskable` at 16/32/192/512 + SVG — all regenerated from `public/dost-mirdc-logo.png`. The maskable icons composite the logo on a navy background at the center 80% safe zone so Android adaptive icons don't crop it.
- **Favicon** (`src/app/layout.tsx` → `metadata.icons`): full size range (16, 32, 192, SVG) so browsers pick the crispest one. `apple-touch-icon` → 192px PNG. All point to `/icons/icon-*.png` (no more stale placeholder).
- **Service worker** (`public/sw.js`): vanilla, no Workbox.
  - Precaches app shell (`/`, manifest, icons).
  - Navigations: network-first with cache + app-shell fallback.
  - Static assets: stale-while-revalidate.
  - SDS PDF responses: cached for offline reuse.
- **Registration** (`src/components/common/service-worker-register.tsx`): production-only to avoid dev caching churn.
- **Installability:** after a production build, the app is installable on Android/Chrome/iOS. The installed app icon, splash screen, and taskbar icon all show the DOST-MIRDC logo.

---

## 10. Commands

### Development
```bash
bun run dev          # Start dev server on port 3000 (Turbopack), logs to dev.log
bun run lint         # ESLint
```

### Database
```bash
bun run db:push      # Push schema to SQLite (accept-data-loss on schema conflicts)
bun run db:generate  # Regenerate Prisma Client
bun run db:migrate   # Create + apply a migration (dev)
bun run db:reset     # Drop + recreate (dev — destroys data)
bun run db:seed      # Create admin from .env + migrate 14 chemicals into Prisma DB
```

### Production
```bash
bun run build        # next build + copy static + public into standalone
bun run start        # Run the standalone server (NODE_ENV=production)
```

> **Note:** In this sandbox, do **not** run `bun run build`. Use `bun run dev` only. The preview panel serves the dev server.

---

## 11. First-Time Setup (Fresh Clone)

> **See [Section 0 — Quick Start](#0-quick-start--how-to-run-this-project) above** for the complete, step-by-step guide including prerequisites, the `npm` → `bun` migration path, and common error fixes.

The short version:

```bash
bun install            # NOT npm install
cp .env.example .env   # then edit .env (set ADMIN_PASSWORD + NEXTAUTH_SECRET)
bun run db:push        # create SQLite tables
bun run db:seed        # create admin + 14 chemicals
bun run dev            # start on http://localhost:3000
```

---

## 12. Testing Checklist

### Auth
- [ ] `/admin/login` renders the sign-in form.
- [ ] Wrong password → "Invalid email or password" error.
- [ ] Correct credentials → redirect to `/admin`.
- [ ] Unauthenticated `GET /api/admin/dashboard` → 401.
- [ ] `/admin/*` (except `/admin/login`) redirects to `/admin/login` when not signed in.
- [ ] Sign out clears the session and returns to login.

### Chemical CRUD (admin)
- [ ] Create a new chemical → appears in dashboard and public catalog after sync.
- [ ] Edit a chemical → change is reflected on devices after sync.
- [ ] Delete a chemical → disappears from public catalog after sync.
- [ ] All inputs validated (zod rejects malformed payloads).

### SDS lifecycle (admin)
- [ ] New chemical gets an auto placeholder SDS (`status = placeholder`).
- [ ] Upload a real PDF → `status = available`, `version` increments.
- [ ] Upload a non-PDF (e.g. `.docx` renamed) → rejected.
- [ ] Upload a file with wrong extension → rejected.
- [ ] Upload an oversized file → rejected.
- [ ] View PDF → opens in new tab.
- [ ] Download PDF → downloads original.
- [ ] Revert to placeholder → `status = placeholder`, `version` increments, file removed from storage.

### Sync (public PWA)
- [ ] On first load with empty Dexie → full initial sync pulls all 14 chemicals.
- [ ] `GET /api/sync?since=0` returns all records.
- [ ] `GET /api/sync?since=<recent>` returns only deltas.
- [ ] Make an admin edit → on next periodic sync the public catalog updates.
- [ ] Toggle device offline → sync status shows `offline`, no sync attempts.
- [ ] Toggle device back online → sync fires automatically.
- [ ] SDS PDF only re-downloads when its version changes (inspect `sdsBlobs` in DevTools → Application → IndexedDB).
- [ ] SDS PDF opens offline (after first online fetch).
- [ ] Manual retry button works after a simulated error.

### PWA
- [ ] Manifest valid (Chrome DevTools → Application → Manifest).
- [ ] Service worker registered in production build.
- [ ] App shell loads offline after first visit.
- [ ] Installable on mobile (production build).

### Security
- [ ] Security headers present in response (check with `curl -I` or browser DevTools).
- [ ] Cookies are `httpOnly` and (in prod) `Secure` + `__Secure-` prefix.
- [ ] `.env` is gitignored (`git status` shows it as ignored).
- [ ] No plaintext passwords in the DB (`SELECT email, passwordHash FROM User` — hash only).
- [ ] SDS file paths on disk are UUIDs, not user-supplied names.

---

## 13. Extending the System

### Add a new chemical field
1. Add the field to `prisma/schema.prisma` → `Chemical` model.
2. `bun run db:push`.
3. Update the zod schema in `src/lib/validation.ts`.
4. Update the serialization in `src/lib/serialize.ts`.
5. Update the Dexie `ChemicalRecord` type in `src/types/index.ts`.
6. Update the admin chemical form (`src/components/admin/chemical-manager.tsx`).
7. Update the public detail view (`src/components/detail/chemical-detail.tsx`) if user-facing.

### Add a new admin role (e.g. `EDITOR`)
The three existing roles (`SUPER_ADMIN` / `ADMIN` / `USER`) are already wired through the entire stack — most features just need to call `requireAdmin()` or `requireSuperAdmin()`. To add a **4th** role:
1. Update the role union type in `src/types/next-auth.d.ts` (it's currently `"SUPER_ADMIN" | "ADMIN" | "USER"` in all three of `Session.user`, `User`, and `JWT`).
2. Update the `authorize()` check in `src/lib/auth.ts` (currently `user.role !== "SUPER_ADMIN" && user.role !== "ADMIN"`).
3. Update the `authorized()` check in `src/middleware.ts` (currently `token?.role === "SUPER_ADMIN" || token?.role === "ADMIN"`).
4. Add new `require<Role>` helpers in `src/lib/session.ts` as needed (mirroring the shape of `requireAdmin()` / `requireSuperAdmin()`) — including the `passwordChangeRequired` block for defense-in-depth.
5. Add role-based checks (or zod enum extensions for `role` in `createUserSchema` / `updateUserSchema`) in the relevant API routes. The user-manager UI (`src/components/admin/user-manager.tsx`) also has a hard-coded role Select that may need the new option.

### Change the sync interval
Edit the periodic interval constant in `src/lib/sync-engine.ts` (and/or `src/hooks/use-sync.ts`).

---

## 14. Troubleshooting (Developer)

| Symptom | Cause | Fix |
|---|---|---|
| `PrismaClientInitializationError` | DB file missing or path wrong | Check `DATABASE_URL` in `.env`; run `bun run db:push` |
| `bun run db:seed` does nothing | Admin already exists with same email | It's idempotent — it upserts. Check `SELECT * FROM User`. |
| 401 on every admin API even when "logged in" | Session cookie not sent (cross-origin / different port) | Ensure requests use relative paths; in this sandbox use `XTransformPort` for cross-service calls |
| SDS upload 413 | File too large | Check the size limit in `src/lib/validation.ts` / reverse proxy |
| Dexie schema version conflict | Old client DB version | Bump Dexie schema version in `src/lib/local-db.ts` with an upgrade function |
| Service worker not updating | Old SW cached | Bump `CACHE_VERSION` in `public/sw.js`; user will get new SW on next load |
| Preview shows blank "Z" screen | Dev server not running | `bun run dev` (this is the most common "it's loading" report) |

---

## 15. Project Status

The implementation is **complete and verified**:
- 14 chemicals seeded into the Prisma backend.
- Public PWA renders all chemicals, search, filters, detail, emergency mode.
- Admin login + dashboard functional. The dashboard now has **6 tabs**: Overview / Chemicals / SDS Documents / Users / Audit Log / System. The last three are SUPER_ADMIN-only (conditionally rendered via `session.user.role === "SUPER_ADMIN"`).
- Delta sync API returns correct deltas; client sync engine runs on startup / online / periodic.
- SDS PDF upload validates files (magic bytes + MIME + extension + size).
- SDS PDFs cached client-side in IndexedDB for offline viewing.
- Security headers configured; `.env` gitignored; admin auth server-side enforced.
- TypeScript strict: 0 errors. ESLint: 0 errors.
- **AI auto-fill** works with the default `zai` provider on the Z.ai sandbox (verified end-to-end via Agent Browser). The `gemini` provider code path is API-compatible with the installed `@google/generative-ai` v0.24.1 SDK; live verification against Google's API requires a real `GEMINI_API_KEY` in `.env` (not present in the sandbox).
- **3-tier role hierarchy** (`SUPER_ADMIN` > `ADMIN` > `USER`) wired through `prisma/schema.prisma`, `src/lib/auth.ts`, `src/lib/session.ts`, `src/middleware.ts`, and `src/types/next-auth.d.ts`. SUPER_ADMIN has full access incl. user management + audit log + system settings; ADMIN manages chemicals + SDS only; USER cannot sign in. Verified end-to-end via Agent Browser.
- **User management** (CRUD admins) at `/api/admin/users` + `user-manager.tsx` component — SUPER_ADMIN only. Lockout prevention: cannot change own role from SUPER_ADMIN, cannot disable/delete self, cannot remove last active super-admin.
- **Audit log** (append-only trail) — `AuditLog` Prisma model + `logAction()` helper + `/api/admin/audit` route + `audit-log-viewer.tsx` component. Every chemical/SDS/user/system mutation logged (fire-and-forget). Cursor-paginated viewer with entity-type + action-prefix filters and expandable before/after JSON detail rows.
- **System Settings tab (Phase D)** at `/api/admin/system/info` + `/api/admin/system/test-ai` + `system-settings.tsx` component — SUPER_ADMIN only. 5 read-only info cards (AI provider, storage, database, sync, runtime) + a "Test Connection" button that calls `testProviderConnection()` and audit-logs `system.test-ai`.
- **Password change on next login** — triple-layered enforcement (client `PasswordGuard` redirect + server `requireAdmin`/`requireSuperAdmin` 401 block + verified-current-password at `/api/admin/change-password`). JWT refreshed via `useSession().update()` after a successful change so no re-login is needed. Verified end-to-end via Agent Browser.
- **Phase E — security & correctness fixes (10 issues, all verified)**:
  - **E1 (critical):** User-edit PATCH no longer crashes on empty `name` — zod schema is now `.nullable().optional()` and the client omits the field instead of sending `null`.
  - **E2:** Audit log filter dropdown replaced the never-written "Sessions" option with "System" (which `system.test-ai` actually writes).
  - **E3:** Bare `/admin` URL no longer stuck on "Redirecting…" — middleware matcher includes `/admin` explicitly, plus a client-side `useEffect` redirect fallback for unauthenticated sessions.
  - **E4:** `/api/admin/sds` returns 401 (not 405) when unauthenticated — explicit method handlers call `requireAdmin()` first, then return 405 with `Allow` header.
  - **E5:** `serializeChemical` now includes the `sdsDocument` relation and uses `c.sdsDocument?.id` for the real SDS cuid (was incorrectly using `c.id`, the chemical id). All 5 callers updated to `include: { sdsDocument: true }`. Seed data corrected to use `sdsDocumentId: ""` instead of fake `"sds-<name>"` ids. Detail view conditionally renders the SDS id row only when a real SDS exists.
  - **E6:** `/admin/login` now redirects already-authenticated users to `/admin` via `useSession` + `useEffect`.
  - **E7:** Removed 14 dead imports from `src/app/admin/page.tsx`.
  - **E8:** Corrected misleading `storage.ts` comment (the SDS download route is intentionally public — the comment wrongly said "authenticated").
  - **E9:** `pdf-rasterize.ts` casts for 3 pdfjs-dist v6 type mismatches (getDocument params, page.render params, doc.destroy).
  - **E10 (security):** Stale-JWT defense — see §8 "Stale-JWT defense" above. `getFreshUserState()` + 60s cache + `invalidateUserStateCache()` on every user mutation.
- **NextAuth `trustHost: true`** — the app now works behind the preview gateway AND localhost without a hardcoded `NEXTAUTH_URL`. This fixed the `Configuration` error users saw when signing in via the preview URL.
- **DOST-MIRDC navy blue rebrand** — full UI rebrand from the old teal-600 primary to a navy blue palette (`navy-50` → `navy-950`, `--primary: #0a2540`). 52 teal color references replaced across 18 component files. The real DOST-MIRDC logo (`public/dost-mirdc-logo.png`) is integrated in 5 locations: public header, footer, admin dashboard header, login page (centered, 64px, on a navy gradient), and the loading screen. CSS variables `--primary`, `--ring`, `--sidebar-primary`, `--chart-*` all updated. Favicon, Apple touch icon, maskable Android icons, and PWA manifest theme color all regenerated from the logo.
- **Pagination (Phase F0)** — reusable `usePagination` hook (`src/hooks/use-pagination.ts`) + `DataPagination` component (`src/components/common/data-pagination.tsx`) wired into all 4 list views:
  - Public catalog: 12 cards/page (resets on search/filter change)
  - Admin Chemicals table: 10 rows/page
  - Admin Users table: 10 rows/page
  - Admin SDS Documents table: 10 rows/page
  - The hook uses the React-blessed "adjust state during render" pattern (conditional setState during render) instead of `useEffect`+`setState` — avoids Next.js 16 / React 19 `react-hooks/set-state-in-effect` errors. Footer shows "Showing X–Y of Z <noun>" + numbered page nav with ellipses; hides entirely when results fit one page.
- **Audit log already had cursor-based "Load more"** (not affected by the new pagination — that's a separate, server-side cursor pattern for the append-only log).

For end-user administrator documentation, see **`ADMIN_GUIDE.md`**.

---

## 16. Anti-Hallucination Reference

> **Purpose:** This section exists so future AI agents (and developers) have a single source of truth about what is actually in the codebase. If the docs and the code ever disagree, **the code is the truth** — update the docs.

### CURRENTLY IMPLEMENTED (verified in code)

| Feature | Where | Notes |
|---|---|---|
| Offline-first PWA (Dexie/IndexedDB cache) | `src/lib/local-db.ts`, `src/lib/sync-engine.ts` | Client reads from Dexie; writes are local-only for prefs. |
| Prisma + SQLite backend (source of truth) | `prisma/schema.prisma`, `src/lib/db.ts` | 4 models: `User`, `Chemical`, `SdsDocument`, `AuditLog`. |
| NextAuth.js v4 (Credentials, JWT, bcrypt 12 rounds) | `src/lib/auth.ts`, `src/app/api/auth/` | `role === "SUPER_ADMIN" \|\| role === "ADMIN"` gate in `authorize()` (3-tier role hierarchy). Disabled users + `USER` role rejected. JWT carries `id`, `role`, `passwordChangeRequired`. |
| Admin dashboard at `/admin` (6 tabs) | `src/app/admin/`, `src/components/admin/` | Tabs: Overview / Chemicals / SDS Documents / Users / Audit Log / System. Last 3 are SUPER_ADMIN-only (conditionally rendered). Edge middleware + `requireAdmin()` / `requireSuperAdmin()` server-side guards. |
| Delta sync API (`GET /api/sync?since=<ms>`) | `src/app/api/sync/route.ts` | Public, returns chemicals + SDS metadata deltas. |
| SDS PDF upload (magic-byte + MIME + ext + size validation) | `src/app/api/admin/sds/route.ts`, `src/lib/storage.ts`, `src/lib/validation.ts` | UUID storage keys, no path traversal. |
| SDS PDF download (streamed, version-cached client-side) | `src/app/api/sds/[id]/download/route.ts` | `Cache-Control: no-store` server-side; IndexedDB Blob cache client-side. |
| **AI auto-fill from PDF** (VLM extraction) | `src/app/api/admin/sds/extract/route.ts`, `src/lib/ai-vlm.ts`, `src/lib/pdf-rasterize.ts` | Provider-agnostic: `zai` / `gemini` / `openai` / `anthropic`. Default `zai` (sandbox). |
| **Gemini provider** (`@google/generative-ai` v0.24.1) | `src/lib/ai-vlm.ts` → `callGemini()` | Default model `gemini-3.6-flash` (hardcoded line 270). SDK pre-installed. BLOCK_NONE safety, JSON output mode. |
| PDF rasterization (pure JS, no Poppler) | `src/lib/pdf-rasterize.ts` | `pdfjs-dist` + `@napi-rs/canvas`. Max 5 pages, scale 2.0 (~150 DPI). |
| Security headers (CSP, HSTS, X-Frame-Options DENY, etc.) | `next.config.ts` | |
| Service worker (vanilla, production-only) | `public/sw.js`, `src/components/common/service-worker-register.tsx` | App-shell precache + SWR for assets. Disabled in dev. |
| GHS pictograms (9 inline SVGs) | `src/components/ghs/pictograms.tsx` | |
| Emergency mode (full-screen, offline, context-aware FAB) | `src/components/emergency/` | |
| Dark mode (next-themes) | `src/components/common/theme-provider.tsx` | |
| **3-tier role hierarchy** (`SUPER_ADMIN` > `ADMIN` > `USER`) | `prisma/schema.prisma`, `src/lib/auth.ts`, `src/lib/session.ts`, `src/middleware.ts`, `src/types/next-auth.d.ts` | SUPER_ADMIN has full access (user mgmt + audit log + system settings + chemicals + SDS); ADMIN manages chemicals + SDS only; USER cannot sign in. All three roles defined as a string union in the type augmentation. |
| User management (CRUD admins) | `src/app/api/admin/users/route.ts`, `src/app/api/admin/users/[id]/route.ts`, `src/components/admin/user-manager.tsx` | SUPER_ADMIN only (via `requireSuperAdmin()`). List / create / update / disable / delete. `passwordHash` never returned. Lockout prevention enforced server-side. |
| Lockout prevention guards | `src/app/api/admin/users/[id]/route.ts` | Cannot change own role away from `SUPER_ADMIN`; cannot disable / delete self; cannot disable / downgrade / delete the last active super-admin. Each guard returns 400 with a clear error message. |
| Audit log (append-only trail) | `prisma/schema.prisma` (`AuditLog` model), `src/lib/audit.ts`, `src/app/api/admin/audit/route.ts`, `src/components/admin/audit-log-viewer.tsx` | Every chemical / SDS / user / system mutation logged via `logAction()`. Fire-and-forget (failures logged to stderr, never propagated). Cursor pagination: fetches `limit+1` rows to detect `hasMore`. |
| System Settings tab (Phase D) | `src/app/api/admin/system/info/route.ts`, `src/app/api/admin/system/test-ai/route.ts`, `src/components/admin/system-settings.tsx` | SUPER_ADMIN only. 5 read-only info cards (AI provider, storage, database, sync, runtime) + "Test Connection" button. Test-ai route audit-logs `system.test-ai`. |
| AI provider info + test connection | `src/lib/ai-vlm.ts` → `getProviderInfo()` + `testProviderConnection()` | `getProviderInfo()` returns `{ provider, model, apiKeyConfigured, apiKeyHint (masked), sdkInstalled, notes }` — never returns the actual key. `testProviderConnection()` sends a minimal text-only prompt, never sends an image, never touches the DB. |
| Password change on next login | `prisma/schema.prisma` (`passwordChangeRequired` field on `User`), `src/app/api/admin/change-password/route.ts`, `src/app/admin/change-password/page.tsx`, `src/components/admin/password-guard.tsx` | Triple-layered enforcement: (1) client `PasswordGuard` redirect, (2) `requireAdmin`/`requireSuperAdmin` return 401 when flag is set, (3) `/api/admin/change-password` verifies `currentPassword` against bcrypt before accepting the new one. Change-password route uses `getServerSession` directly (the only admin route that bypasses `requireAdmin`). |
| **Stale-JWT defense (Phase E10)** | `src/lib/session.ts` | `getFreshUserState(userId)` queries DB for `disabled`/`role`/`passwordChangeRequired`, cached 60s in `freshStateCache` Map. `requireAdmin()`/`requireSuperAdmin()` call it on every request and return 401 if the state changed. `invalidateUserStateCache(userId)` is called by user PATCH, user DELETE, and change-password routes. |
| **NextAuth `trustHost: true`** | `src/lib/auth.ts` | Set in `authOptions`. Lets NextAuth trust the request's `Host` header so it works behind the preview gateway AND localhost without `NEXTAUTH_URL`. `NEXTAUTH_URL` is intentionally UNSET in `.env`. |
| **DOST-MIRDC navy blue theme** | `src/app/globals.css` (`@theme` block with `navy-50`→`navy-950`, `--primary: #0a2540`), 18 component files | Replaced the old teal-600 primary across 52 color references. `mirdc-cyan` (#00AEEF) and `mirdc-red` (#ED1C24) tokens exist as accents but the brand color is navy. |
| **DOST-MIRDC logo integration** | `public/dost-mirdc-logo.png`, `src/components/layout/app-header.tsx`, `app-footer.tsx`, `src/app/admin/page.tsx`, `src/app/admin/login/page.tsx`, `src/app/page.tsx` | Real logo (via `next/image`) in 5 locations: public header (36px), footer (20px + full agency name), admin dashboard header (36px), login page (64px centered on navy gradient), loading screen (56px). |
| **PWA icons regenerated from DOST-MIRDC logo** | `public/icons/icon-16/32/192/512.png`, `icon-maskable-192/512.png`, `icon.svg`, `public/logo.svg`, `public/manifest.json`, `src/app/layout.tsx` (`metadata.icons`) | All icons regenerated from `dost-mirdc-logo.png` via Python PIL. Maskable variants composite the logo on navy `#0a2540` at the 80% safe zone. Manifest `theme_color` corrected from teal `#0d9488` to navy `#0a2540`. Favicon link tags cover 16/32/192/SVG. |
| **Pagination (Phase F0)** | `src/hooks/use-pagination.ts`, `src/components/common/data-pagination.tsx`, wired into `chemical-catalog.tsx` (12/page), `chemical-manager.tsx` (10/page), `user-manager.tsx` (10/page), `sds-manager.tsx` (10/page) | Reusable hook + component. Hook uses render-phase setState (not useEffect) to clamp/reset page — avoids Next.js 16 `react-hooks/set-state-in-effect` errors. `deps` array serialized to JSON for stable comparison. Footer: "Showing X–Y of Z" + numbered nav with ellipses; hides when totalPages ≤ 1. |
| **serializeChemical includes sdsDocument (Phase E5)** | `src/lib/serialize.ts`, 5 API callers (`api/chemicals/route.ts`, `api/chemicals/[id]/route.ts`, `api/sync/route.ts`, `api/admin/chemicals/[id]/route.ts`, `api/admin/chemicals/route.ts`), `src/lib/seed-data.ts`, `src/components/detail/chemical-detail.tsx` | `serializeChemical` accepts `Chemical & { sdsDocument?: SdsDocument \| null }` and uses `c.sdsDocument?.id ?? ""` for the real SDS cuid (was incorrectly `c.id`). All callers now `include: { sdsDocument: true }`. Seed data uses `sdsDocumentId: ""` (no fake ids). Detail view conditionally renders the SDS id row. |

### PLANNED (discussed but NOT implemented)

| Feature | Source | Status |
|---|---|---|
| AI-powered chatbot for chemical/SDS queries | `aug12-meeting.md` §1 (Mr. Casila suggestion) | **Not started.** Discussed at the August 12 meeting as a potential future enhancement. No code exists. |
| Excel bulk chemical import | `ADMIN_GUIDE.md` §4.4 ("A future Excel bulk-import feature is planned") | **Not started.** No code, no API route, no UI. |
| Per-division admin roles / focal persons | `aug12-meeting.md` §4 | **Partially implemented.** 3-tier role hierarchy now exists (`SUPER_ADMIN`/`ADMIN`/`USER`). Per-division scoping (Phase B) explicitly skipped per user decision — all admins see all chemicals. May revisit if division-scoped access is needed. |
| Regulatory tag display (DENR-EMB / PNP / PDEA) | `aug12-meeting.md` §3.2 | **Partially present.** The `regulatoryTags` field exists in the Prisma schema and Chemical type, and a `RegulatoryTags` component exists. See "Unknown" below. |

### DEPRECATED / RETIRED (do not use)

| Item | Why | Replace with |
|---|---|---|
| `gemini-1.5-flash`, `gemini-1.5-pro` | Retired by Google — returns 404 | `gemini-3.6-flash` |
| `gemini-2.0-flash`, `gemini-2.0-flash-lite`, `gemini-2.0-pro` | Retired by Google — returns 404 | `gemini-3.6-flash` |
| `gemini-2.5-flash`, `gemini-2.5-pro` | Retired by Google — returns 404 | `gemini-3.6-flash` |
| `@google/generative-ai` older versions (< 0.24.0) | Missing `responseMimeType` support | v0.24.1 (currently installed) |
| `pdftoppm` / Poppler system dependency | Replaced by pure-JS renderer | `pdfjs-dist` + `@napi-rs/canvas` (`src/lib/pdf-rasterize.ts`) |
| Old Dexie-only architecture (no backend) | Described in outdated `README.md` (pre-backend era) | Current: Prisma + SQLite backend + Dexie client cache + delta sync. See §2. |
| `npm install` / `npm run dev` | Use Bun — `db:seed` is TypeScript | `bun install` + `bun run dev` |
| **teal-600 / teal-500 / teal-700** color classes | Replaced by DOST-MIRDC navy blue rebrand | `navy-600` / `navy-500` / `navy-700` (see `src/app/globals.css` `@theme` block). Zero `teal-*` references remain in `src/`. |
| **`NEXTAUTH_URL` env var** | No longer needed — `trustHost: true` in `auth.ts` handles gateway + localhost automatically | Leave UNSET in `.env`. If migrating an old deploy, remove the line. |
| **Old PWA icon files** (pre-rebrand placeholder shield-with-flask) | Regenerated from DOST-MIRDC logo | `public/icons/icon-*.png` + `icon.svg` + `public/logo.svg` — all rebuilt via Python PIL from `public/dost-mirdc-logo.png`. |
| **`sdsDocumentId: "sds-<name>"` in seed data** | Were fake placeholder ids that collided with chemical ids | `sdsDocumentId: ""` (empty string) — the real SDS cuid comes from the `sdsDocument` relation via `serializeChemical`. |

### UNKNOWN / REQUIRES VERIFICATION

| Item | What we know | What we don't |
|---|---|---|
| `regulatoryTags` field | Exists in Prisma schema (`Chemical.regulatoryTags`), in the TypeScript types, and a `RegulatoryTags.tsx` component renders them. The seed data includes empty arrays for all 14 chemicals. | Whether the August 12 meeting's request (DENR-EMB / PNP / PDEA classification tags) is fully wired up — the field exists but may need population logic and admin UI. Not verified end-to-end. |
| Gemini 3.6 free-tier quota | Code comment and `.env.example` say "1,500 requests/day". | This quota is set by Google and may change. Verify at https://ai.google.dev/pricing before relying on it. |
| Live Gemini API response | SDK wiring is verified (import + `getGenerativeModel` + `generateContent` all callable, `BLOCK_NONE` + `responseMimeType` accepted by the SDK). | No real `GEMINI_API_KEY` is present in the sandbox `.env`, so the actual end-to-end Gemini request/response has not been tested in this environment. The `zai` provider (sandbox default) HAS been tested end-to-end. |
| `@tanstack/react-query` dependency | Listed in `package.json` (^5.82.0). | **Zero imports found** in `src/`. It is a dead dependency — installed but unused. Safe to remove in a future cleanup, but left in place to avoid breaking the running app. |
| Committed SQLite DB at `prisma/db/custom.db` | Present in the repo (from the original ZIP). Contains a bcrypt admin hash. | Whether this is intentional (for dev convenience) or an accidental commit. The live sandbox uses a fresh DB at `db/custom.db` (different path). The `.gitignore` does NOT cover `prisma/db/*.db` (only `/db/*.db` root-anchored). |

### Documentation vs. code — how to resolve disagreements

1. **The code is always the truth.** If a doc says X but the code does Y, the doc is wrong.
2. **Verify in the code** before trusting any doc claim about: model names, env var names, API routes, file locations, database fields.
3. **Update the doc** to match the code. Do not change the code to match a stale doc unless explicitly asked.
4. **Never assume a model / API / package exists** without checking the installed version or the code's actual import.
