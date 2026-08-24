# SDS-CHEM — Administrator Guide

**Audience:** Laboratory administrators / Safety officers at MIRDC responsible for managing the chemical catalog and Safety Data Sheets.

**Purpose:** Everything an admin needs to log in, manage chemicals, upload SDS PDFs, and understand how changes reach the field devices.

---

## 1. What is SDS-CHEM?

SDS-CHEM is the Safety Data Sheet Centralized System for Chemical Management. It is a Progressive Web App (PWA) used by laboratory staff to look up chemicals, view GHS hazard classifications, read first-aid / firefighting / spill response guidance, and open the official SDS PDF — **all offline**, once the app has been installed and synced.

As an **administrator**, you control the central catalog:
- Add / edit / remove chemicals
- Upload / replace official SDS PDFs
- Decide which chemicals appear on everyone's device

When you save a change, the public PWA automatically pulls the update the next time it's online.

---

## 2. Your Admin Account

A single initial admin account is provisioned for you. Its credentials are stored in the server environment file (`.env`) as `ADMIN_EMAIL` and `ADMIN_PASSWORD`.

> **Default (development):** `admin@mirdc.dost.gov.ph` — change the password before any production deployment.

### To change the admin password
1. Edit `.env` and set `ADMIN_PASSWORD` to a new strong password.
2. Re-run the seed script (this re-creates / updates the admin record):
   ```bash
   bun run db:seed
   ```
3. Restart the dev server.

> The password is never stored in plaintext — it is hashed with bcrypt (12 rounds) before being written to the database.

---

## 3. Logging In

1. Open the app at the **Preview Panel** (do **not** use `http://localhost:3000` directly — that address is internal to the sandbox). You can click **"Open in New Tab"** above the preview for a separate window.
2. The public catalog loads. Navigate to the admin area by visiting the `/admin/login` route (use the route switcher / URL bar in the preview).
3. Enter your **Email** and **Password**.
4. Click **Sign In**.
5. On success you are redirected to `/admin` — the admin dashboard.

### If you see "Invalid email or password"
- Double-check the email is exactly the one in `.env` (case-insensitive, but spaces matter).
- Re-run `bun run db:seed` to make sure the admin record matches the current `.env`.
- If you forgot the password, set a new one in `.env` and re-seed.

### Logging out
Use the **Sign out** button in the admin dashboard header. The session cookie is cleared and you'll be sent back to the login page.

---

## 4. The Admin Dashboard

The dashboard at `/admin` has three tabs:

### 4.1 Overview
At-a-glance metrics:
- Total chemicals in the catalog
- How many SDS PDFs are uploaded vs. still on placeholder
- Department distribution
- Most recently updated chemicals

Use this to spot chemicals that still need their real SDS PDF uploaded.

### 4.2 Chemicals
A searchable, sortable table of every chemical. Each row shows:
- Chemical name, CAS number, formula
- Signal word (DANGER / WARNING)
- Hazard classes & GHS pictograms
- Storage location & department
- SDS status badge (Placeholder / Available)

**Actions:**
| Action | What it does |
|---|---|
| **Add chemical** | Opens a form to create a new chemical entry. Fill in identifiers, hazard info, storage, and the emergency-measures text (first-aid / firefighting / spill). On save, an SDS document record is auto-created with `status = placeholder`. |
| **Edit** | Opens the same form pre-filled. Update any field and save. Bumps the chemical's `serverVersion` so devices know to re-sync. |
| **Delete** | Soft-deletes the chemical. It disappears from the public catalog on the next sync, but is recoverable in the DB via `deletedAt`. |

### 4.3 SDS
Manage the actual PDF files. Each chemical has exactly one SDS document (1:1).

**Actions:**
| Action | What it does |
|---|---|
| **Upload** | Replace a chemical's placeholder (or outdated) SDS with a real PDF. Validates that the file is genuinely a PDF (magic bytes + MIME type + `.pdf` extension + size limit). On success, status becomes `available` and the version number increments. |
| **View** | Opens the SDS PDF in a new tab. (For the public PWA, the PDF is streamed from the server and cached locally in the browser for offline use.) |
| **Download** | Downloads the original PDF file to your machine. |
| **Revert to placeholder** | Removes the uploaded PDF and restores the auto-generated placeholder. Use this if a wrong file was uploaded by mistake. |

---

## 4.4 AI Auto-Fill from PDF  ⚡ (New!)

**This is the fastest way to add a chemical.** Instead of typing every field by hand, you upload the manufacturer's SDS PDF and the AI reads it for you.

### How it works
1. Click **"Add Chemical"** to open the form.
2. At the top of the form, click the **"Auto-fill from PDF"** button.
3. Select the manufacturer's SDS PDF file from your computer (must be a `.pdf` file, max 10 MB).
4. Wait ~10-15 seconds while the AI:
   - Converts the PDF pages to images
   - Reads the text and hazard information using vision AI
   - Maps the manufacturer's terms to our system's standard fields (GHS pictograms, hazard classes, etc.)
5. The form populates automatically with a **"✓ Auto-filled from PDF — please review all fields"** banner.
6. **Review every field carefully** — AI is smart but not perfect, especially with safety-critical data.
7. Fix any mistakes, enter the **ID** field (the AI can't guess this), then click **Create Chemical**.

### What the AI extracts
| Field | Usually extracted? | Notes |
|---|---|---|
| Chemical Name | ✅ Yes | From Section 1 (Identification) |
| CAS Number | ✅ Yes | From Section 1 or 3 |
| Formula | ✅ Yes | From Section 3 (Composition) |
| Manufacturer / Supplier | ✅ Yes | From Section 1 |
| Signal Word | ✅ Yes | DANGER or WARNING, from Section 2 |
| GHS Pictograms | ✅ Yes | Mapped to our 9 standard pictograms |
| Hazard Classes | ✅ Yes | Mapped to our 13 standard hazard classes |
| First-Aid Measures | ✅ Yes | Section 4 — full text |
| Firefighting Measures | ✅ Yes | Section 5 — full text |
| Accidental Release | ✅ Yes | Section 6 — full text |
| PPE | ⚠️ Sometimes | Section 8 — may need manual review |
| Emergency Contact | ⚠️ Sometimes | From Section 1 if listed |
| Storage Location | ❌ No | This is lab-specific — you must enter it |
| Department | ❌ No | This is lab-specific — you must select it |
| ID | ❌ No | You must enter this (e.g., `chem-toluene`) |

### Important notes
- **Works with both scanned and digital PDFs** — the AI uses OCR (optical character recognition) to read scanned documents.
- **Always review** — the AI is ~90% accurate but safety data must be 100% correct. Check hazard classes and signal words especially carefully.
- **One PDF at a time** — for bulk imports, add chemicals one by one with this feature. (A future Excel bulk-import feature is planned.)
- **No cost** — on the Z.ai cloud sandbox (the Preview Panel), the AI service is built-in and free. On a local installation, set `AI_PROVIDER=gemini` in `.env` for the free Google Gemini tier (1,500 requests/day). See the **Setup for local development** note below.
- **Your PDF is not stored** during extraction — it's converted to images, read by the AI, then the temporary files are deleted. (The PDF is only permanently stored if you also upload it via the SDS tab.)

### Setup for local development (when not using the sandbox)

The default AI provider (`zai`) only works inside the Z.ai cloud sandbox. If you're running the app on your own machine and want the AI auto-fill to work, use **Google Gemini** (free, recommended):

**Gemini setup (3 steps):**

1. **Get a free API key** at https://aistudio.google.com/apikey (1,500 requests/day free — a lab with 200 SDS PDFs will never exhaust this).
2. **Add to your `.env` file:**
   ```bash
   AI_PROVIDER=gemini
   GEMINI_API_KEY=your-key-here
   ```
   The `@google/generative-ai` package is already installed — no need to run `bun add`.
3. **Restart the dev server:** `bun run dev`

That's it. The default model is `gemini-2.5-flash` (current generation, fast, good vision). If you need to override it, add `GEMINI_MODEL=<model>` to `.env`. Note: `gemini-2.0-flash` and `gemini-1.5-flash` have been retired by Google — using them returns a "model is no longer available" error.

**Other providers** (if you prefer paid options):

| Provider | Cost | Setup |
|---|---|---|
| OpenAI | ~$0.01 per SDS | 1. `bun add openai`<br>2. Get a key: https://platform.openai.com/api-keys<br>3. In `.env`: `AI_PROVIDER=openai` and `OPENAI_API_KEY=<your-key>` |
| Anthropic Claude | ~$0.02 per SDS | 1. `bun add @anthropic-ai/sdk`<br>2. Get a key: https://console.anthropic.com/settings/keys<br>3. In `.env`: `AI_PROVIDER=anthropic` and `ANTHROPIC_API_KEY=<your-key>` |

After changing `.env`, restart `bun run dev`. On the sandbox, you don't need to do anything — the default `zai` provider is pre-configured.

---

## 5. How Changes Reach the Field (Sync)

You do **not** need to tell anyone to refresh. The system is **offline-first with automatic delta sync**:

1. You save a change in the admin dashboard.
2. The server updates the database and bumps `updatedAt` / `serverVersion` on the affected record.
3. Each device running the public PWA automatically checks for updates:
   - On app startup
   - When the device goes from offline → online
   - Periodically while online (every few minutes)
4. The device asks the server: *"Give me everything changed since my last sync."* (`GET /api/sync?since=<timestamp>`)
5. Only the **deltas** (new / changed / deleted records) are downloaded — not the whole database.
6. SDS PDFs are versioned. A device only re-downloads a PDF if its version actually changed on the server. Otherwise it reuses the locally cached copy.
7. The sync status indicator in the app header reflects the current state: **Synced / Syncing / Offline / Error**.

**Conflict policy:** The server is the source of truth for chemical and SDS data. User-specific data (favorites, notes, preferences) stays local to each device and is never overwritten by the server.

---

## 6. SDS PDF Best Practices

- **Always upload the manufacturer's official SDS PDF** — not a scanned image, not a Word doc converted on the fly.
- **File must be a real PDF.** The upload rejects anything that isn't a valid PDF (validated by magic bytes, not just the file extension). Renaming a `.docx` to `.pdf` will be rejected.
- **Keep file sizes reasonable** (a few MB is fine). Very large PDFs slow down the first sync for field devices on mobile data.
- **When you replace a PDF**, the version number increments and the new file is visible **immediately** — there is no cache delay. The server marks the download `Cache-Control: no-store`, and the public app always fetches fresh bytes when online (the IndexedDB cache is only used offline).
- **Use "Revert to placeholder"** only to undo a mistaken upload. The placeholder is a minimal valid PDF that says "SDS not yet uploaded" — it should not stay in place for real chemicals.

---

## 7. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| Admin page shows a blank "Z" logo screen | Dev server not running | Run `bun run dev` in the project; check the Preview Panel |
| "Invalid email or password" on login | Wrong credentials, or admin not seeded | Verify `.env`, then `bun run db:seed`, then retry |
| `/admin` redirects to `/admin/login` in a loop | Session cookie not set | Clear browser cookies for the site, log in again |
| SDS upload rejected with "Invalid file" | File is not a real PDF, or wrong extension | Re-export as PDF from the original source |
| Field device not seeing your changes | Device is offline, or sync error | Have the user open the app while online; tap the sync status indicator to retry |
| Public catalog shows stale data after admin edit | Sync hasn't fired yet | Sync runs on startup / online transition / periodically. A page refresh while online forces a re-check. |
| Field user still sees the old placeholder PDF after you uploaded the real one | IndexedDB cache lag (fixed) | The public "View SDS PDF" button now always fetches fresh from the server when online. Ask the user to hard-refresh once. Confirm the SDS `version` incremented in the admin SDS tab. |
| Dashboard shows 0 chemicals | Database not seeded | `bun run db:push && bun run db:seed`, then restart |
| "Auto-fill failed: spawn pdftoppm ENOENT" | ~~Poppler not installed~~ **Fixed** — the app now uses a pure-JavaScript PDF renderer. If you see this error, pull the latest code and run `bun install`. |
| "Extraction failed: Configuration file not found or invalid" | You're running on a local machine. The default `zai` provider only works on the Z.ai cloud sandbox. Set `AI_PROVIDER=gemini` + `GEMINI_API_KEY` in `.env` (see [§ 4.4 Setup for local development](#setup-for-local-development-when-not-using-the-sandbox)). |
| "AI_PROVIDER=gemini is set but GEMINI_API_KEY is missing" | You set the provider but didn't add the API key. Get a free key at https://aistudio.google.com/apikey, set `GEMINI_API_KEY=...` in `.env`, restart `bun run dev`. |
| "AI_PROVIDER=gemini requires the @google/generative-ai package" | SDK not installed. Run `bun add @google/generative-ai`. |

---

## 8. Quick Reference — Daily Workflow

1. **Log in** at `/admin/login`.
2. Open the **Chemicals** tab. Search for the chemical you want to update.
3. Click **Edit** → make changes → **Save**.
4. Switch to the **SDS** tab. Find the same chemical.
5. Click **Upload** → choose the official PDF → confirm.
6. Watch the status badge flip from *Placeholder* → *Available*.
7. Done. Devices will pick up both the chemical edit and the new PDF automatically.

---

## 9. Security Notes for Admins

- **Never share your admin password.** Each admin should have their own account.
- **Always log out** from shared / kiosk machines.
- The admin session expires after 30 days of inactivity.
- All admin actions are auditable via the `updatedById` field on chemicals and the `uploadedById` field on SDS documents.
- If you suspect a credential leak, change `ADMIN_PASSWORD` in `.env`, re-seed, and notify the developer to rotate `NEXTAUTH_SECRET`.

---

*For technical / developer documentation, see `DEVELOPER_GUIDE.md`.*
