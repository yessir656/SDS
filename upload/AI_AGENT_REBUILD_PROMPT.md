# SDS-CHEM PWA — Rebuild Prompt for AI Agent

> Send this entire file to the AI agent. It is fully self-contained — no other context needed.

---

## Your Role

You are a senior full-stack developer. Build a complete, working **offline-first Progressive Web App (PWA)** called **SDS-CHEM** — a centralized Safety Data Sheet (SDS) management system for a chemical research laboratory. Build it end-to-end, including the data layer, all screens, and PWA configuration. Do not use placeholder stubs — every feature below must work.

## Important instruction

**The visual design is YOUR decision.** You are given functional requirements, a data model, and constraints — not a design mockup. Design a clean, modern, professional UI that fits a lab-safety application. You may choose any styling approach that satisfies the constraints (component library, hand-rolled CSS, utility framework, etc.). Requirements that mention specific UI elements (search, cards, pictograms, emergency button) describe FUNCTIONALITY, not appearance.

---

## 1. Project Background

- **Organization:** MIRDC (Metal Industries Research and Development Center), Philippines
- **Project:** SDS-CHEM — "Safety Data Sheet Centralized System for Chemical Management"
- **Problem being solved:** Safety Data Sheets are currently kept on paper, stored separately by each lab unit. This limits access, slows emergency response, and risks outdated/lost documents.
- **Goal:** A centralized digital SDS system — accessible to ALL personnel, no accounts, works offline, low cost to distribute (no app stores).

## 2. Non-Negotiable Tech Stack

- **Framework:** Next.js (App Router) + **TypeScript** (strict mode)
- **Client storage:** Dexie (IndexedDB wrapper) — full local database, no backend required for core features
- **PWA:** Installable, offline-capable (manifest + service worker, precache app shell)
- **No authentication** — zero login, zero signup, instant read-only access
- Use whatever styling/state-management libraries you prefer.

## 3. Functional Requirements

### 3.1 Catalog & Dashboard
- Chemical catalog screen listing all chemicals from the local database.
- Each chemical shows: name, CAS number, formula, GHS hazard pictograms, signal word (DANGER/WARNING), storage location, and department.
- Statistics/overview area: total chemical count, danger vs warning counts, most common hazard pictograms.

### 3.2 Search & Filters
- Instant search by: chemical name, trade name, CAS number, formula.
- Filters by: department (e.g., Chemical Analysis, Corrosion Testing, Metallography, Physical Metallurgy), signal word (danger/warning), hazard class.
- Type-ahead suggestions while typing.

### 3.3 Chemical Detail View
- Full detail view for a selected chemical:
  - All identifiers (name, CAS, formula, trade name, manufacturer, supplier)
  - GHS pictograms (large, with labels)
  - Hazard classification chips
  - Storage location + department
  - Version + last updated
  - Required PPE list
  - SDS section quick-reference (standard GHS 16-section structure; sections 4 First-Aid, 5 Firefighting, 6 Spill Response are emergency-critical)
- A clear path from detail → emergency mode.

### 3.4 Emergency Mode
- A persistent, high-visibility **emergency button** (e.g., floating action button) leading to a full-screen emergency response view for the currently selected chemical.
- Emergency view must show, for the selected chemical:
  - First Aid measures (SDS section 4)
  - Firefighting measures (SDS section 5)
  - Spill/accidental release measures (SDS section 6)
  - Required PPE
  - GHS pictogram summary
  - Emergency contact
- Must work 100% offline.

### 3.5 Offline Behavior
- App shell (layout, styles, JS) fully cached by the service worker.
- All chemical data readable from the local database with no network.
- Online/offline status indicator in the UI.
- If offline, show a clear notice that data is being read from the local cache.

### 3.6 Data Seeding
- On first launch (empty database), automatically seed **at least 10 realistic laboratory chemicals** with complete data (see data model below): CAS numbers must be real, GHS pictograms/hazard classes accurate, and emergency measures (first aid, firefighting, spill, PPE) written as a lab professional would.
- Suggested starting set: Acetone, Methanol, Ethanol, Hydrochloric Acid, Sulfuric Acid, Nitric Acid, Sodium Hydroxide, Hydrogen Peroxide, Toluene, Isopropyl Alcohol.

## 4. Data Model

Define TypeScript types and a Dexie schema for at least:

```
ChemicalRecord:
  id, casNumber, chemicalName, formula, tradeName, manufacturer, supplier,
  signalWord ("danger" | "warning"), hazardClasses[], ghsPictograms[],
  storageLocation, department, safetyInstructions, sdsDocumentId,
  lastUpdated (timestamp), version,
  emergencyContact, personalProtectiveEquipment[],
  firstAidMeasures, firefightingMeasures, accidentalReleaseMeasures

SdsDocument:
  id, chemicalId, fileName, fileSize, mimeType, contentHash,
  uploadDate, version, sections[], localPath, isCached

LaboratoryLocation: id, division, building, roomNumber, cabinet, shelf, hazardLevel

EmergencyAction: id, chemicalId, actionType, title, description, priority

UserPreferences: id, theme, emergencyModeEnabled, favoriteChemicals[], lastSearch

SyncStatus type: "synced" | "local-changes" | "syncing" | "offline" | "error"

GHS pictogram enum (9 standard): exploding-bomb, flame, flame-on-circle, gas,
  corrosion, skull-and-crossbones, exclamation-mark, health-hazard, environment

HazardClass enum: explosive, flammable, oxidizing, compressed-gas, corrosive,
  toxic, harmful, irritant, sensitizer, carcinogen, reproductive-toxicant,
  specific-target-organ-toxicity, environmentally-hazardous
```

## 5. PWA Requirements

- `manifest.json`: standalone display, app name "SDS-CHEM", theme color suitable for a safety app, 192px + 512px icons (generate simple placeholder icons — do not leave the manifest pointing at missing files).
- Service worker: precache app shell; runtime caching strategy for static assets; skip-waiting/clients-claim behavior appropriate for an installable app.
- Works when installed on Android, iOS (Safari add-to-home-screen), and desktop browsers.
- Note: service worker should be active in production builds; keep it disabled in dev for easier debugging.

## 6. Project Structure

Use a clean, maintainable structure, for example:
```
src/
  app/           (Next.js App Router pages + root layout + global styles)
  components/    (feature + UI components, grouped by feature)
  lib/           (database, hooks, utilities)
  types/         (TypeScript types)
public/          (manifest, icons, static assets)
```
Use a path alias (`@/*`) for imports.

## 7. Development Phases (build in this order)

1. **Foundation:** project scaffold, types, Dexie schema + CRUD + search, seed data, PWA manifest + icons, base layout.
2. **Core UI:** catalog/dashboard, search + filters, chemical detail.
3. **Safety features:** emergency mode + floating emergency button, offline indicators.
4. **Polish:** loading states, empty states, responsive mobile layout, accessibility basics (labels, focus states), dark-mode support (optional but recommended), subtle animations (respect `prefers-reduced-motion`).
5. **Verify:** TypeScript compiles with zero errors; run the dev server and confirm the app loads, seeds data, searches, and the emergency flow works.

## 8. Technical Gotchas (read before writing code)

1. **If you use Tailwind CSS, use v4 (CSS-first config):** `@import "tailwindcss";` in your global CSS. Custom tokens go in an `@theme {}` block (colors, shadows, animations). **Do NOT use the old v3 syntax** (`@tailwind base; @tailwind components; @tailwind utilities;`) — on v4 it silently generates zero CSS. A `tailwind.config.js` is not required.
2. If you add a class-based dark mode with Tailwind v4, you must declare `@custom-variant dark (&:where(.dark, .dark *));` — otherwise `dark:` classes follow the OS theme and a manual toggle does nothing.
3. React 19 + TypeScript: files containing JSX must be `.tsx`; components/hooks using hooks need `"use client"` at the top in App Router. Avoid the global `JSX.Element` namespace — import `ReactNode` instead.
4. Dexie: use `await db.open()` (do not rely on a `db.ready` instance property).
5. Verify your work: `npx tsc --noEmit` must pass with 0 errors before you finish.
6. Provide clear instructions for running: `npm install`, `npm run dev`, and (for PWA verification) `npm run build && npm start`.

## 9. Acceptance Criteria

The final deliverable is a working project that:
- [ ] Installs and runs with the documented commands
- [ ] TypeScript strict passes with 0 errors
- [ ] Seeds 10+ realistic chemicals on first launch
- [ ] Search + filters work against the local database
- [ ] Chemical detail shows all identifiers, pictograms, hazards, PPE, SDS sections
- [ ] Emergency mode is one tap away and shows first-aid/fire/spill/PPE offline
- [ ] Online/offline status is visible; app shell works with network disabled
- [ ] PWA manifest + icons valid; installable after production build
- [ ] Mobile-friendly responsive layout
- [ ] No placeholder TODOs or dead code

## 10. Delivery Format

Return the completed project as a clear file tree, with each file's full code. Include a short README section with run commands and a summary of your design decisions (one short paragraph each: visual direction, component approach, state management).