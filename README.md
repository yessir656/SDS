# SDS-CHEM — Safety Data Sheet Centralized System

A centralized, offline-first Progressive Web App for managing Safety Data Sheets (SDS) in a chemical research laboratory. Built for **MIRDC** (Metal Industries Research and Development Center), Philippines.

## Problem Solved

Safety Data Sheets were previously kept on paper, stored separately by each lab unit — limiting access, slowing emergency response, and risking outdated/lost documents. SDS-CHEM provides a centralized digital system accessible to **all personnel** (no login needed to browse the catalog), with **offline capability**, **zero app-store distribution cost**, and a **secure admin dashboard** for managing the chemical catalog and SDS PDFs.

---

## Run Commands

```bash
# Install dependencies (use Bun, NOT npm)
bun install

# Create the SQLite database + tables
bun run db:push

# Seed the database (admin user + 14 chemicals + placeholder SDS PDFs)
bun run db:seed

# Start the development server (port 3000)
bun run dev

# Lint
bun run lint

# Type-check (strict mode, 0 errors expected in src/)
npx tsc --noEmit

# Production build + start (for PWA/installability verification)
bun run build
bun run start
```

> **First-time setup:** copy `.env.example` to `.env`, set `ADMIN_EMAIL`, `ADMIN_PASSWORD`, and `NEXTAUTH_SECRET`, then run `db:push` + `db:seed`. See `DEVELOPER_GUIDE.md` §0 for the full step-by-step.
>
> The service worker is **disabled in dev** (to avoid stale-cache churn) and **active in production builds**. To verify PWA installability, use `bun run build && bun run start`.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, Turbopack) + TypeScript (strict) |
| Server DB (source of truth) | Prisma + SQLite |
| Client DB (offline cache) | Dexie (IndexedDB) — delta-synced from the server |
| Auth | NextAuth.js v4 (Credentials provider, JWT sessions, bcrypt 12 rounds) — 3-tier roles: `SUPER_ADMIN` > `ADMIN` > `USER` |
| AI auto-fill | Provider-agnostic VLM: `zai` (sandbox default) / `gemini` (local) / `openai` / `anthropic` |
| PDF rasterization | pdfjs-dist + @napi-rs/canvas (pure JS, no Poppler) |
| PWA | Vanilla service worker + web manifest + generated icons |
| Styling | Tailwind CSS v4 (CSS-first config) + shadcn/ui (New York) |
| State management | Zustand (client UI state) + Dexie `useLiveQuery` (reactive local data) |
| Theming | next-themes (light / dark / system) |
| Icons | Lucide React + custom inline SVG GHS pictograms |
| Runtime | Bun (dev + seed scripts), Node-compatible standalone build (production) |

---

## Design Decisions

### Visual Direction
The design uses a **teal-emerald primary** (safety/lab connotation) with **red** reserved exclusively for danger signal words and the emergency system, creating an immediate visual hierarchy where red always means "act now." GHS pictograms are rendered as inline SVG with the official red-diamond/black-symbol standard. Cards use left border-accent color-coding (red for DANGER, amber for WARNING) so hazard level is scannable at a glance. The emergency view inverts to a high-contrast red header with large, plain-language text optimized for readability under stress.

### Architecture: Server-Source-of-Truth + Offline-First Client
The **server (Prisma + SQLite) is the source of truth** for all chemical and SDS data. The **public PWA reads from Dexie (IndexedDB)** as a local cache, delta-synced from the server on startup / online-transition / periodically. This means:
- Field devices work fully **offline** after the first sync.
- Admin changes propagate automatically — no manual refresh needed.
- Only deltas (changed records) are transferred, not the whole database.
- SDS PDFs are versioned; clients only re-download a PDF when its version changes.
- User preferences (favorites, notes) stay **local-only** — never sent to the server.

The **admin dashboard** (`/admin`) is a separate authenticated area (NextAuth Credentials provider). There are two admin tiers: **`ADMIN`** (manage chemicals + SDS) and **`SUPER_ADMIN`** (everything ADMIN does, plus user management, audit log, and system settings). All admin API routes enforce `requireAdmin()` / `requireSuperAdmin()` server-side; the edge middleware is defense-in-depth. Every mutating admin action is recorded in an append-only `AuditLog` table.

### Component Approach
Components are grouped by feature domain (`catalog/`, `detail/`, `emergency/`, `ghs/`, `common/`, `layout/`, `admin/`). The **public app** is a single-route SPA — the catalog, detail, and emergency views all render on `/` with Zustand controlling which view is visible. This keeps the offline model simple (one HTML shell cached by the service worker). The **admin app** lives at `/admin` with its own layout and is not part of the offline PWA shell. Chemical cards, the search bar, and the emergency FAB are independently reusable. The floating emergency button is context-aware: it jumps directly to the selected chemical's emergency info in detail view, or opens a quick-select search dialog in the catalog.

### State Management
**Zustand** manages ephemeral UI state (current view, selected chemical, search query, active filters). **Dexie's `useLiveQuery`** provides reactive reads from IndexedDB, so the catalog, dashboard stats, and search suggestions automatically re-render when the local database changes (which happens on every delta sync). The server is the source of truth for chemical/SDS data; the client Dexie DB is a cache that stays in sync via `GET /api/sync?since=<timestamp>`.

### AI Auto-Fill (Provider-Agnostic)
The admin "Auto-fill from PDF" feature reads an uploaded SDS PDF using a vision-language model (VLM) and extracts 15 structured fields. The provider is swappable via the `AI_PROVIDER` env var:
- **`zai`** (default) — in-house `z-ai-web-dev-sdk`, works on the Z.ai sandbox only (auto-configured, free).
- **`gemini`** — Google Gemini via `@google/generative-ai` (pre-installed), free tier, recommended for local dev. Default model: `gemini-3.6-flash`.
- **`openai`** / **`anthropic`** — paid alternatives (SDKs not pre-installed).

See `DEVELOPER_GUIDE.md` §6A for the full architecture and `ADMIN_GUIDE.md` §4.4 for the admin-facing guide.

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout: metadata, theme provider, SW registration
│   ├── page.tsx                # Public PWA single-route SPA (catalog → detail → emergency)
│   ├── globals.css             # Tailwind v4 CSS-first config + custom animations
│   ├── admin/                  # Admin dashboard (login + 6 tabs: Overview/Chemicals/SDS/Users/Audit/System)
│   │   ├── layout.tsx          #   wraps children in <PasswordGuard>
│   │   ├── page.tsx            #   tabs conditionally rendered by role
│   │   ├── login/page.tsx
│   │   └── change-password/page.tsx  # forced password change page
│   └── api/
│       ├── route.ts            # Health check
│       ├── auth/[...nextauth]/ # NextAuth handler
│       ├── sync/route.ts       # GET /api/sync?since=<ts>  (public delta sync)
│       ├── chemicals/          # GET list / GET by id (public)
│       ├── sds/[id]/download/  # GET (stream SDS PDF)
│       └── admin/              # Admin API (auth required)
│           ├── dashboard/      # GET stats
│           ├── chemicals/      # POST create / GET / PUT / DELETE
│           ├── sds/            # POST upload / DELETE revert / POST extract (AI auto-fill)
│           ├── users/          # GET list / POST create / PATCH / DELETE  (SUPER_ADMIN only)
│           ├── audit/          # GET paginated audit log  (SUPER_ADMIN only)
│           ├── system/info/    # GET AI/storage/db/sync/runtime info  (SUPER_ADMIN only)
│           ├── system/test-ai/ # POST probe the configured AI provider  (SUPER_ADMIN only)
│           └── change-password/ # POST change own password  (any authenticated admin)
├── components/
│   ├── catalog/                # Dashboard stats, chemical cards, search, filters
│   ├── detail/                 # Full chemical detail with SDS sections
│   ├── emergency/              # Emergency view + floating action button
│   ├── ghs/                    # 9 GHS pictogram SVG components
│   ├── common/                 # Theme provider/toggle, offline indicator, SW register, sync status
│   ├── layout/                 # Header, footer
│   └── admin/                  # Admin overview, chemical manager, SDS manager, user manager, audit log viewer, system settings, password guard, session provider
├── hooks/                      # useOnlineStatus, useDatabaseReady, useSync, useMobile, useToast
├── lib/
│   ├── db.ts                   # Prisma client (singleton)
│   ├── auth.ts                 # NextAuth options + bcrypt hash/verify (3-tier role, passwordChangeRequired handling)
│   ├── session.ts              # requireAdmin() / requireSuperAdmin() server-side guards (both block passwordChangeRequired users)
│   ├── audit.ts                # logAction() fire-and-forget audit helper + auditContext() builder
│   ├── storage.ts              # Safe SDS file storage (UUID keys, path-traversal guard)
│   ├── validation.ts           # zod schemas for chemical & SDS inputs
│   ├── ai-vlm.ts               # Provider-agnostic VLM abstraction (zai/gemini/openai/anthropic) + getProviderInfo() + testProviderConnection()
│   ├── pdf-rasterize.ts        # PDF → PNG (pdfjs-dist + @napi-rs/canvas, pure JS)
│   ├── pdf-placeholder.ts      # Generates minimal valid placeholder PDFs
│   ├── sync-engine.ts          # Client delta sync engine (mutex, rate-limit, SDS blob caching)
│   ├── local-db.ts             # Dexie schema v2 (chemicals, sdsDocuments, sdsBlobs, syncMeta, ...)
│   ├── seed-data.ts            # 14 chemicals + 7 locations + default prefs
│   ├── serialize.ts            # JSON ↔ DB field (de)serialization helpers
│   └── utils.ts                # cn() and misc
├── store/
│   └── app-store.ts            # Zustand: view routing + search/filter state
└── types/
    └── index.ts                # All TypeScript types + constant lookup tables

prisma/
└── schema.prisma               # User · Chemical · SdsDocument (SQLite)

public/
├── manifest.json               # PWA manifest (installable, standalone)
├── sw.js                       # Vanilla service worker (precache + runtime caching)
└── icons/                      # 192/512 PNG icons (regular + maskable) + SVG source

scripts/
├── seed-db.ts                  # Seeds admin from .env + 14 chemicals into Prisma DB
└── generate-icons.mjs          # Sharp-based icon generator
```

---

## Key Features

- **Catalog & Dashboard** — 14 seeded chemicals with real CAS numbers, accurate GHS classifications, and professional emergency measures. Stats show total count, danger/warning breakdown, pictogram distribution, and department breakdown.
- **Instant Search** — Type-ahead suggestions across chemical name, trade name, CAS number, and formula. Keyboard-navigable.
- **Filters** — Department, signal word, and hazard class multi-select filters with active-filter summary.
- **Chemical Detail** — Full identifiers, large GHS pictograms with labels, hazard classification chips, storage location, PPE list, and SDS section quick-reference (sections 4/5/6 highlighted as emergency-critical).
- **Emergency Mode** — One-tap access via floating button or detail CTA. Full-screen, high-contrast red theme showing first-aid, firefighting, spill measures, PPE, pictogram summary, and emergency contact. Works 100% offline.
- **Offline-First** — All data cached in IndexedDB via Dexie. Delta-synced from the server on startup / online-transition / periodically. Service worker precaches the app shell in production.
- **Admin Dashboard** (`/admin`) — Secure login (NextAuth, bcrypt). Three tabs: Overview (stats), Chemicals (CRUD), SDS (upload/replace/revert PDFs). All admin API routes enforce `requireAdmin()` server-side.
- **AI Auto-Fill from PDF** — Admins upload a manufacturer's SDS PDF and the AI reads it, extracting 15 fields (chemical name, CAS, formula, GHS pictograms, hazard classes, first-aid, firefighting, spill measures, PPE, etc.). Provider-agnostic: works on the sandbox (free `zai` provider) or locally (free Google Gemini tier, `gemini-3.6-flash`).
- **SDS PDF Management** — Upload, replace, view, download, and revert to placeholder. Files validated by magic bytes + MIME + extension + size. Stored with UUID filenames (no path traversal). Versioned for client cache invalidation.
- **PWA** — Installable on Android, iOS (Safari add-to-home-screen), and desktop. Standalone display, teal theme color, maskable icons.
- **Responsive & Accessible** — Mobile-first layout, semantic HTML, ARIA labels, keyboard navigation, focus states, screen-reader text, and `prefers-reduced-motion` support.
- **Dark Mode** — Light / dark / system theme toggle with no hydration flash.

---

## Documentation

| Document | Audience |
|---|---|
| **README.md** (this file) | Overview + quick start |
| **ADMIN_GUIDE.md** | Laboratory administrators / safety officers — how to log in, manage chemicals, upload SDS PDFs, use AI auto-fill |
| **DEVELOPER_GUIDE.md** | Developers — architecture, file map, database schema, API reference, sync engine, AI provider abstraction, security model, anti-hallucination reference |
| **aug12-meeting.md** | August 12 project meeting notes (requirements, action items — preserved for reference) |
