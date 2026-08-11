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
#    - NEXTAUTH_URL        (already http://localhost:3000 — leave as-is)
#
#    Generate a NEXTAUTH_SECRET with:
#      bun -e 'console.log(require("crypto").randomBytes(32).toString("hex"))'

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
│  /admin         dashboard: Overview / Chemicals / SDS tabs      │
│  Protected by src/middleware.ts (edge, role=ADMIN)              │
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
            └── [id]/route.ts        DELETE (revert to placeholder)
```

### Library code
```
src/lib/
├── db.ts                Prisma client (singleton, query-log off in prod)
├── auth.ts              NextAuth options + hashPassword / verifyPassword (bcrypt)
├── session.ts           requireAdmin() server-side guard (throws 401 if no session)
├── storage.ts           Safe SDS file storage (UUID filenames, no path exposure)
├── validation.ts        zod schemas for chemical & SDS inputs
├── pdf-placeholder.ts   Generates a minimal valid placeholder PDF
├── sync-engine.ts       Client delta sync engine (mutex, rate-limit, SDS blob caching)
├── local-db.ts          Dexie schema v2 (chemicals, sdsDocuments, sdsBlobs, syncMeta, ...)
├── seed-data.ts         14 chemicals + 7 locations + default prefs (migration source)
├── serialize.ts         JSON ↔ DB field (de)serialization helpers
└── utils.ts             cn() and misc
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
prisma/schema.prisma      User · Chemical · SdsDocument
src/middleware.ts         Edge-level /admin/* protection (role=ADMIN)
src/types/index.ts        Domain types (ChemicalRecord, GhsPictogram, HazardClass, SyncStatus, ...)
src/types/next-auth.d.ts  Augments NextAuth session/token with `role`
src/store/app-store.ts    Zustand: view routing, search/filter, sync status
src/hooks/                use-sync, use-database-ready, use-online-status, use-mobile, use-toast

public/manifest.json      PWA manifest
public/sw.js              Vanilla service worker (app-shell cache, SWR for assets)
public/icons/             icon.svg + 192/512 PNGs (any + maskable)
scripts/seed-db.ts        Seeds admin from .env + migrates 14 chemicals into Prisma DB
scripts/generate-icons.mjssharp-based icon generator

.env                      DATABASE_URL, ADMIN_EMAIL, ADMIN_PASSWORD, NEXTAUTH_SECRET, NEXTAUTH_URL
.env.example              Template (committed)
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
| role | String | `"ADMIN"` or `"USER"` (only ADMIN can log in) |
| createdAt / updatedAt | DateTime | |
| Relations | `SdsDocument[] uploadedSds`, `Chemical[] updatedChemicals` | audit trail |

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
| POST | `/api/admin/sds/extract` | **AI extraction.** Upload a PDF → returns structured chemical fields extracted by VLM. Does NOT store the PDF. See [§ 6.1 AI SDS Extraction Pipeline](#61-ai-sds-extraction-pipeline) below. |
| DELETE | `/api/admin/sds/[id]` | Revert to placeholder. Removes the uploaded file, resets `status = placeholder`, increments `version`. |

### 6.1 AI SDS Extraction Pipeline

`POST /api/admin/sds/extract` — AI-powered auto-fill for the chemical form.

**Flow:**
```
Admin uploads PDF
       ↓
[1] Validate: magic bytes (%PDF-), MIME (application/pdf), extension (.pdf), size (≤10MB)
       ↓
[2] Save PDF to os.tmpdir()/sds-extract-{uuid}.pdf
       ↓
[3] pdftoppm -png -r 150 -l 5  (converts first 5 pages to PNG images)
       ↓
[4] Read each PNG as base64
       ↓
[5] zai.chat.completions.createVision()  (send all page images in one call)
     Prompt asks for JSON with 15 fields + provides valid enum values
     for signalWord, ghsPictograms, hazardClasses so VLM maps correctly
       ↓
[6] Parse VLM response: strip markdown fences, JSON.parse, fallback extraction
       ↓
[7] Sanitize: filterValid() drops invalid enum IDs, default signalWord="danger"
       ↓
[8] Clean up: delete temp PDF + all temp PNGs (finally block)
       ↓
Return { success: true, data: { ...15 fields } }
```

**Response shape:**
```json
{
  "success": true,
  "data": {
    "chemicalName": "Toluene",
    "casNumber": "108-88-3",
    "formula": "C₇H₈",
    "tradeName": "Methylbenzene",
    "manufacturer": "Sigma-Aldrich",
    "supplier": "...",
    "signalWord": "danger",
    "ghsPictograms": ["flame", "health-hazard", "exclamation-mark"],
    "hazardClasses": ["flammable", "irritant", "reproductive-toxicant", "specific-target-organ-toxicity"],
    "storageLocation": "",
    "safetyInstructions": "...",
    "emergencyContact": "...",
    "personalProtectiveEquipment": ["Chemical splash goggles", "Nitrile gloves", "..."],
    "firstAidMeasures": "...",
    "firefightingMeasures": "...",
    "accidentalReleaseMeasures": "..."
  }
}
```

**Key files:**
- `src/app/api/admin/sds/extract/route.ts` — the API endpoint
- `src/components/admin/chemical-manager.tsx` — the frontend `handleAutoFill()` function + "Auto-fill from PDF" button + review banner

**System dependency:** `pdftoppm` (from poppler-utils) must be installed on the server. Already available in the sandbox; for production deployments, install via `apt-get install poppler-utils` (Debian/Ubuntu) or `brew install poppler` (macOS).

**Cost:** Free — uses the in-house `z-ai-web-dev-sdk` VLM service. Each extraction uses ~3,000-10,000 tokens depending on PDF length.

### Auth
| Method | Path | Purpose |
|---|---|---|
| POST | `/api/auth/callback/credentials` | NextAuth credentials sign-in. |
| GET/POST | `/api/auth/*` | NextAuth session / csrf / signout handlers. |

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
- Passwords hashed with **bcrypt (12 rounds)** — never stored or logged in plaintext.
- JWT session strategy, 30-day max age.
- Cookies: `httpOnly`, `sameSite=lax`, `secure` in production (`__Secure-` prefix).

### Authorization (defense in depth)
1. **Edge middleware** (`src/middleware.ts`) — blocks `/admin/*` (except `/admin/login`) unless the JWT has `role === "ADMIN"`. Fast, runs at the edge.
2. **Server-side guard** (`requireAdmin()` in `src/lib/session.ts`) — every admin API route calls this. Returns 401 if no valid admin session. This is the real enforcement layer; the middleware is just a UX optimization / defense-in-depth.

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

- **Manifest** (`public/manifest.json`): standalone display, teal theme (`#0d9488`), icons for `any` + `maskable` at 192/512.
- **Service worker** (`public/sw.js`): vanilla, no Workbox.
  - Precaches app shell (`/`, manifest, icons).
  - Navigations: network-first with cache + app-shell fallback.
  - Static assets: stale-while-revalidate.
  - SDS PDF responses: cached for offline reuse.
- **Registration** (`src/components/common/service-worker-register.tsx`): production-only to avoid dev caching churn.
- **Installability:** after a production build, the app is installable on Android/Chrome/iOS.

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
1. Update the `role` check in `src/lib/auth.ts` (`authorize`) and `src/middleware.ts`.
2. Add role-based checks in API routes as needed.
3. Update the NextAuth type augmentation in `src/types/next-auth.d.ts`.

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
- Admin login + dashboard (Overview / Chemicals / SDS) functional.
- Delta sync API returns correct deltas; client sync engine runs on startup / online / periodic.
- SDS PDF upload validates files (magic bytes + MIME + extension + size).
- SDS PDFs cached client-side in IndexedDB for offline viewing.
- Security headers configured; `.env` gitignored; admin auth server-side enforced.
- TypeScript strict: 0 errors. ESLint: 0 errors.

For end-user administrator documentation, see **`ADMIN_GUIDE.md`**.
