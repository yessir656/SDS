# SDS-CHEM — Safety Data Sheet Centralized System

A centralized, offline-first Progressive Web App for managing Safety Data Sheets (SDS) in a chemical research laboratory. Built for **MIRDC** (Metal Industries Research and Development Center), Philippines.

## Problem Solved

Safety Data Sheets were previously kept on paper, stored separately by each lab unit — limiting access, slowing emergency response, and risking outdated/lost documents. SDS-CHEM provides a centralized digital system accessible to **all personnel**, with **no accounts**, **offline capability**, and **zero app-store distribution cost**.

---

## Run Commands

```bash
# Install dependencies
bun install

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

> The service worker is **disabled in dev** (to avoid stale-cache churn) and **active in production builds**. To verify PWA installability, use `bun run build && bun run start`.

---

## Tech Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router) + TypeScript (strict) |
| Client storage | Dexie (IndexedDB wrapper) — full local database, no backend |
| PWA | Vanilla service worker + web manifest + generated icons |
| Styling | Tailwind CSS v4 (CSS-first config) + shadcn/ui (New York) |
| State management | Zustand (view routing) + Dexie `useLiveQuery` (reactive data) |
| Theming | next-themes (light / dark / system) |
| Icons | Lucide React + custom inline SVG GHS pictograms |

---

## Design Decisions

### Visual Direction
The design uses a **teal-emerald primary** (safety/lab connotation) with **red** reserved exclusively for danger signal words and the emergency system, creating an immediate visual hierarchy where red always means "act now." GHS pictograms are rendered as inline SVG with the official red-diamond/black-symbol standard. Cards use left border-accent color-coding (red for DANGER, amber for WARNING) so hazard level is scannable at a glance. The emergency view inverts to a high-contrast red header with large, plain-language text optimized for readability under stress.

### Component Approach
Components are grouped by feature domain (`catalog/`, `detail/`, `emergency/`, `ghs/`, `common/`, `layout/`). The app is a **single-route SPA** — the catalog, detail, and emergency views all render on `/` with Zustand controlling which view is visible. This keeps the offline model simple (one HTML shell cached by the service worker). Chemical cards, the search bar, and the emergency FAB are independently reusable. The floating emergency button is context-aware: it jumps directly to the selected chemical's emergency info in detail view, or opens a quick-select search dialog in the catalog.

### State Management
**Zustand** manages ephemeral UI state (current view, selected chemical, search query, active filters) — lightweight, no boilerplate, survives view switches. **Dexie's `useLiveQuery`** provides reactive reads from IndexedDB, so the catalog, dashboard stats, and search suggestions automatically re-render when the database changes. No server state or caching layer is needed because all data lives locally. The database auto-seeds 14 realistic chemicals on first launch and persists across sessions.

---

## Project Structure

```
src/
├── app/
│   ├── layout.tsx          # Root layout: metadata, theme provider, SW registration
│   ├── page.tsx            # Single-route SPA (catalog → detail → emergency)
│   └── globals.css         # Tailwind v4 CSS-first config + custom animations
├── components/
│   ├── catalog/            # Dashboard stats, chemical cards, search, filters
│   ├── detail/             # Full chemical detail with SDS sections
│   ├── emergency/          # Emergency view + floating action button
│   ├── ghs/                # 9 GHS pictogram SVG components
│   ├── common/             # Theme provider/toggle, offline indicator, SW register
│   └── layout/             # Header, footer
├── hooks/                  # useOnlineStatus, useDatabaseReady
├── lib/
│   ├── local-db.ts         # Dexie database: schema, CRUD, search, stats, seeding
│   └── seed-data.ts        # 14 realistic chemicals + 7 locations + preferences
├── store/
│   └── app-store.ts        # Zustand: view routing + search/filter state
└── types/
    └── index.ts            # All TypeScript types + constant lookup tables

public/
├── manifest.json           # PWA manifest (installable, standalone)
├── sw.js                   # Vanilla service worker (precache + runtime caching)
└── icons/                  # 192/512 PNG icons (regular + maskable) + SVG source

scripts/
└── generate-icons.mjs      # Sharp-based icon generator
```

---

## Key Features

- **Catalog & Dashboard** — 14 seeded chemicals with real CAS numbers, accurate GHS classifications, and professional emergency measures. Stats show total count, danger/warning breakdown, pictogram distribution, and department breakdown.
- **Instant Search** — Type-ahead suggestions across chemical name, trade name, CAS number, and formula. Keyboard-navigable.
- **Filters** — Department, signal word, and hazard class multi-select filters with active-filter summary.
- **Chemical Detail** — Full identifiers, large GHS pictograms with labels, hazard classification chips, storage location, PPE list, and SDS section quick-reference (sections 4/5/6 highlighted as emergency-critical).
- **Emergency Mode** — One-tap access via floating button or detail CTA. Full-screen, high-contrast red theme showing first-aid, firefighting, spill measures, PPE, pictogram summary, and emergency contact. Works 100% offline.
- **Offline-First** — All data in IndexedDB via Dexie. Service worker precaches the app shell in production. Online/offline indicator in the header.
- **PWA** — Installable on Android, iOS (Safari add-to-home-screen), and desktop. Standalone display, teal theme color, maskable icons.
- **Responsive & Accessible** — Mobile-first layout, semantic HTML, ARIA labels, keyboard navigation, focus states, screen-reader text, and `prefers-reduced-motion` support.
- **Dark Mode** — Light / dark / system theme toggle with no hydration flash.
