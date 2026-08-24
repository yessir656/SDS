# SDS-CHEM — Administrator Guide

**Audience:** Laboratory administrators / Safety officers at DOST-MIRDC responsible for managing the chemical catalog and Safety Data Sheets.

**Purpose:** Everything an admin needs to log in, manage chemicals, upload SDS PDFs, and understand how changes reach the field devices.

> **Branding note (v2):** The system is now themed in **DOST-MIRDC navy blue** (`#0a2540`) with the official DOST-MIRDC logo in the header, footer, login page, and browser tab favicon. The earlier teal theme has been retired.

---

## 1. What is SDS-CHEM?

SDS-CHEM is the Safety Data Sheet Centralized System for Chemical Management. It is a Progressive Web App (PWA) used by laboratory staff to look up chemicals, view GHS hazard classifications, read first-aid / firefighting / spill response guidance, and open the official SDS PDF — **all offline**, once the app has been installed and synced.

As an **administrator**, you control the central catalog:
- Add / edit / remove chemicals
- Upload / replace official SDS PDFs
- Decide which chemicals appear on everyone's device

When you save a change, the public PWA automatically pulls the update the next time it's online.

---

## 2. Your Admin Account & Role

There are **two admin roles** in SDS-CHEM:

| Role | What they can do |
|---|---|
| **ADMIN** | Manage chemicals, upload SDS PDFs, use AI auto-fill. This is the role assigned to laboratory focal persons. |
| **SUPER_ADMIN** | Everything an ADMIN can do, **plus**: create/edit/disable/delete other admin accounts, view the audit log, and view system settings (AI provider, storage, database, sync stats). Reserved for MIS. |

(A third role, `USER`, exists in the database but cannot sign in — it is reserved for future use.)

### Initial admin account

The first admin account is provisioned from the server environment file (`.env`) via the seed script:

```bash
bun run db:seed
```

By default the seeded account is a **`SUPER_ADMIN`** (configurable via the `ADMIN_ROLE` env var if you want to seed as a regular `ADMIN` instead).

> **Default (development):** `admin@mirdc.dost.gov.ph` — change the password before any production deployment.

### Creating additional admins (SUPER_ADMIN only)

Once you're signed in as a SUPER_ADMIN, **do not** share your password. Instead, create a separate account for each person who needs admin access:

1. Open the **Users** tab in the admin dashboard.
2. Click **"Add User"**.
3. Enter their name, email, a temporary password, and choose their role (`ADMIN` or `SUPER_ADMIN`).
4. Leave **"Require password change on next login"** checked (default) — this forces them to set their own password the first time they sign in.
5. Click **Create**.

The new user appears in the table with an amber "PW change" badge. Hand them their temporary credentials over a secure channel; they will be forced to choose a new password on first sign-in.

### Changing your own password

If you ever need to change your own password (e.g. you suspect it was leaked, or your account was flagged for a forced change):

1. Sign in. If your account has `passwordChangeRequired = true`, you will be automatically redirected to `/admin/change-password` and cannot reach the dashboard until you complete it.
2. On the change-password page, enter your **current** password, then your **new** password twice.
3. Click **Change password & continue**. You'll be redirected to the dashboard — no need to sign out and back in.

> The new password must be at least 8 characters long and cannot be the same as the current password.

### To reset a forgotten admin password (SUPER_ADMIN override)

A SUPER_ADMIN can reset any admin's password from the **Users** tab → **Edit** → enter a new temporary password → save. This automatically flags the account with `passwordChangeRequired = true` so the user must choose their own password on next sign-in.

> The seed-script method (`ADMIN_PASSWORD` in `.env` + `bun run db:seed`) still works for the original seeded account, but for all other admins use the in-app Users tab instead.

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

The dashboard at `/admin` has **six tabs** (the last three are visible only to `SUPER_ADMIN`):

### 4.1 Overview  (all admins)
At-a-glance metrics:
- Total chemicals in the catalog
- How many SDS PDFs are uploaded vs. still on placeholder
- Department distribution
- Most recently updated chemicals

Use this to spot chemicals that still need their real SDS PDF uploaded.

### 4.2 Chemicals  (all admins)
A searchable, sortable table of every chemical. Each row shows:
- Chemical name, CAS number, formula
- Signal word (DANGER / WARNING)
- Hazard classes & GHS pictograms
- Storage location & department
- SDS status badge (Placeholder / Available)

> **Pagination:** the table shows **10 chemicals per page**. Use the page-number footer at the bottom to navigate (Previous / 1 / 2 / … / Next). Typing in the search box automatically resets to page 1.

**Actions:**
| Action | What it does |
|---|---|
| **Add chemical** | Opens a form to create a new chemical entry. Fill in identifiers, hazard info, storage, and the emergency-measures text (first-aid / firefighting / spill). On save, an SDS document record is auto-created with `status = placeholder`. |
| **Edit** | Opens the same form pre-filled. Update any field and save. Bumps the chemical's `serverVersion` so devices know to re-sync. |
| **Delete** | Soft-deletes the chemical. It disappears from the public catalog on the next sync, but is recoverable in the DB via `deletedAt`. |

### 4.3 SDS  (all admins)
Manage the actual PDF files. Each chemical has exactly one SDS document (1:1).

> **Pagination:** the SDS table shows **10 rows per page** with the same page-number footer as the Chemicals tab.

**Actions:**
| Action | What it does |
|---|---|
| **Upload** | Replace a chemical's placeholder (or outdated) SDS with a real PDF. Validates that the file is genuinely a PDF (magic bytes + MIME type + `.pdf` extension + size limit). On success, status becomes `available` and the version number increments. |
| **View** | Opens the SDS PDF in a new tab. (For the public PWA, the PDF is streamed from the server and cached locally in the browser for offline use.) |
| **Download** | Downloads the original PDF file to your machine. |
| **Revert to placeholder** | Removes the uploaded PDF and restores the auto-generated placeholder. Use this if a wrong file was uploaded by mistake. |

---

## 4.5 Users Tab  (SUPER_ADMIN only)

Manage admin accounts. Searchable table showing each user's name, email, role, status (Active / Disabled / PW change required), and last login time.

> **Pagination:** the Users table shows **10 users per page**. (Most installations have fewer than 10 admins, so the footer is usually hidden.)

**Actions:**
| Action | What it does |
|---|---|
| **Add User** | Create a new admin account. Choose role (`ADMIN` or `SUPER_ADMIN`), enter a temporary password, and optionally check "Require password change on next login" (on by default). |
| **Edit** | Update name, role, disable/enable the account, or reset the password. Resetting a password automatically flags the account for a forced change unless you explicitly uncheck the box. |
| **Delete** | Permanently remove the account. Cannot delete yourself. |

**Lockout prevention (built-in):**
- You cannot change your own role away from `SUPER_ADMIN`.
- You cannot disable or delete your own account.
- You cannot disable or delete the last remaining active `SUPER_ADMIN` (the system always keeps at least one so nobody gets locked out).

> **Tip:** Use **Disable** (not Delete) for admins who should temporarily lose access — their account stays in the audit trail and can be re-enabled later.

---

## 4.6 Audit Log Tab  (SUPER_ADMIN only)

Every mutating admin action is recorded in an append-only audit log. The viewer shows the newest entries first, with cursor-based pagination (a **"Load older entries"** button at the bottom appends the next 50 entries).

**Filters:**
- **Entity type** — `chemical`, `sds`, `user`, `system`
- **Action prefix** — e.g. `chemical.` to see all chemical mutations, or `user.` for user-management actions

Each row shows: timestamp, actor (email), action, summary, and IP address. Click a row to expand and inspect the **before / after** JSON snapshots (for updates and deletes) or the **after** snapshot (for creates).

**Actions currently logged:**
| Action | When |
|---|---|
| `chemical.create` / `chemical.update` / `chemical.delete` | Admin creates / edits / soft-deletes a chemical |
| `sds.upload` / `sds.replace` / `sds.revert` | Admin uploads / replaces / reverts an SDS PDF |
| `sds.extract` | Admin triggers AI auto-fill on an SDS PDF |
| `user.create` / `user.update` / `user.delete` | SUPER_ADMIN creates / edits / deletes an admin account |
| `user.password-change` | Any admin changes their own password |
| `system.test-ai` | SUPER_ADMIN runs the AI provider connection test |

> The audit log is **fire-and-forget** — it never blocks or breaks the main operation, even if logging itself fails.

---

## 4.7 System Tab  (SUPER_ADMIN only)

Live, read-only system information. Useful for diagnosing issues or verifying the AI provider is configured correctly.

**Five info cards:**
1. **AI Provider** — current provider (`zai` / `gemini` / `openai` / `anthropic`), model, whether the API key is configured (masked hint), and whether the SDK package is installed.
2. **Storage** — total size of all SDS PDFs on disk, file count, largest file, average file size, and the storage directory path.
3. **Database** — SQLite file size, file path, and connection URL.
4. **Sync & Data** — counts of chemicals (active + deleted), SDS documents (placeholder + available), users, and audit log entries; last `updatedAt` timestamp; max `serverVersion`.
5. **System Runtime** — Node.js version, platform/arch, environment (development/production), Next.js version, server uptime, current time, timezone.

**Test Connection button** (in the AI Provider card): sends a minimal probe request to the configured AI provider and reports `OK` (with latency and a response preview) or `Failed` (with the error message). Does **not** send any image and does **not** touch the database. The result is logged to the audit trail as `system.test-ai`.

> All values are **read-only**. To change the AI provider, edit `.env` (`AI_PROVIDER`, `GEMINI_API_KEY`, `GEMINI_MODEL`, etc.) and restart the dev server. Runtime config mutation is a future enhancement.

---

## 4.8 Password Change on Next Login

When a SUPER_ADMIN creates a new admin account or resets an existing admin's password, the account is flagged with `passwordChangeRequired = true`. The next time that user signs in:

1. They enter their credentials on `/admin/login` as usual.
2. Authentication succeeds, but the JWT carries `passwordChangeRequired = true`.
3. A client-side `PasswordGuard` component (mounted in the admin layout) detects the flag and redirects to `/admin/change-password`.
4. The user enters their **current** password + a new password (twice) + clicks **Change password & continue**.
5. The server verifies the current password, hashes the new one, clears the flag, and logs `user.password-change` to the audit trail.
6. The JWT is refreshed in-place via `useSession().update()` — no second sign-in needed.
7. The user lands on the dashboard.

**Defense-in-depth:** even if a user somehow bypasses the client-side guard, every admin API route (except `/api/admin/change-password`) calls `requireAdmin()` / `requireSuperAdmin()`, both of which return 401 for users with `passwordChangeRequired = true`. The change-password endpoint itself uses a direct `getServerSession` check and verifies the current password before accepting the new one.

---

## 4.4 AI Auto-Fill from PDF  ⚡

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

That's it. The default model is `gemini-3.6-flash` (current generation, fast, good vision). This is hardcoded in `src/lib/ai-vlm.ts` as the fallback when `GEMINI_MODEL` is not set, so you only need to set `GEMINI_MODEL` if you want to use a different model. **Do not override it with an older model** — `gemini-1.5-flash`, `gemini-2.0-flash`, and `gemini-2.5-flash` have all been retired by Google and return a "model is no longer available" (404) error.

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
| **NextAuth "Configuration" error after sign-in** | `NEXTAUTH_URL` was hardcoded but the app is accessed via the preview gateway URL | Fixed — the app now uses `trustHost: true`. If you have an old `.env` with `NEXTAUTH_URL=...`, **delete that line** and restart. |
| `/admin` redirects to `/admin/login` in a loop | Session cookie not set | Clear browser cookies for the site, log in again |
| SDS upload rejected with "Invalid file" | File is not a real PDF, or wrong extension | Re-export as PDF from the original source |
| Field device not seeing your changes | Device is offline, or sync error | Have the user open the app while online; tap the sync status indicator to retry |
| Public catalog shows stale data after admin edit | Sync hasn't fired yet | Sync runs on startup / online transition / periodically. A page refresh while online forces a re-check. |
| Field user still sees the old placeholder PDF after you uploaded the real one | IndexedDB cache lag (fixed) | The public "View SDS PDF" button now always fetches fresh from the server when online. Ask the user to hard-refresh once. Confirm the SDS `version` incremented in the admin SDS tab. |
| Dashboard shows 0 chemicals | Database not seeded | `bun run db:push && bun run db:seed`, then restart |
| **Downgraded or disabled admin can still access the dashboard** | ~~Stale JWT~~ **Fixed (Phase E10)** — every admin API call now checks the DB for the user's current `disabled`/`role` state (cached 60s). A disabled user's next API call returns 401 within 60 seconds. | No action needed — the stale-JWT defense is automatic. |
| **Favicon still shows old teal shield icon** | Browser cached the old favicon | Hard-refresh (Ctrl+Shift+R / Cmd+Shift+R) or close & reopen the tab. The server is already serving the DOST-MIRDC logo icon. |
| "Auto-fill failed: spawn pdftoppm ENOENT" | ~~Poppler not installed~~ **Fixed** — the app now uses a pure-JavaScript PDF renderer. If you see this error, pull the latest code and run `bun install`. |
| "Extraction failed: Configuration file not found or invalid" | You're running on a local machine. The default `zai` provider only works on the Z.ai cloud sandbox. Set `AI_PROVIDER=gemini` + `GEMINI_API_KEY` in `.env` (see [§ 4.4 Setup for local development](#setup-for-local-development-when-not-using-the-sandbox)). |
| "AI_PROVIDER=gemini is set but GEMINI_API_KEY is missing" | You set the provider but didn't add the API key. Get a free key at https://aistudio.google.com/apikey, set `GEMINI_API_KEY=...` in `.env`, restart `bun run dev`. |
| "AI_PROVIDER=gemini requires the @google/generative-ai package" | SDK not installed. Run `bun add @google/generative-ai`. |
| "Gemini request failed: ... model is no longer available" (404) | `GEMINI_MODEL` is set to a retired model (1.5 / 2.0 / 2.5). Remove the `GEMINI_MODEL` line from `.env` to use the default `gemini-3.6-flash`, or set it to a currently-served model. Restart `bun run dev`. |
| "Gemini blocked the request" or "returned no candidates" | API key invalid, or the key's project doesn't have access to the model. Verify the key at https://aistudio.google.com/apikey and that the Generative Language API is enabled. |

---

## 8. Quick Reference — Daily Workflow

### For every admin (ADMIN + SUPER_ADMIN)
1. **Log in** at `/admin/login`. If your account was flagged for a password change, you'll be redirected to `/admin/change-password` first — complete it to reach the dashboard.
2. Open the **Chemicals** tab. Search for the chemical you want to update.
3. Click **Edit** → make changes → **Save**.
4. Switch to the **SDS** tab. Find the same chemical.
5. Click **Upload** → choose the official PDF → confirm.
6. Watch the status badge flip from *Placeholder* → *Available*.
7. Done. Devices will pick up both the chemical edit and the new PDF automatically.

### For SUPER_ADMIN only (extra tasks)
8. **Onboard a new admin:** Users tab → Add User → enter their email + a temporary password → leave "Require password change on next login" checked → Create. Hand them the temp credentials securely.
9. **Audit a change:** Audit Log tab → filter by `chemical.` or `user.` → expand a row to inspect before/after JSON.
10. **Verify AI provider:** System tab → review the AI Provider card → click **Test Connection** if anything looks off.

---

## 9. Security Notes for Admins

- **Never share your admin password.** Each admin should have their own account — a SUPER_ADMIN can create accounts from the Users tab.
- **Always log out** from shared / kiosk machines.
- The admin session expires after 30 days of inactivity.
- All admin actions are recorded in the **audit log** (`AuditLog` table) with actor, action, before/after JSON, IP, and timestamp. SUPER_ADMINs can review this in the Audit Log tab.
- Every chemical carries an `updatedById` field; every SDS document carries an `uploadedById` field — both point to the responsible admin.
- New admin accounts (and any account whose password was reset by a SUPER_ADMIN) are forced to change their password on next login.
- If you suspect a credential leak: change your own password via the change-password page (or ask a SUPER_ADMIN to reset it for you), and notify the developer to rotate `NEXTAUTH_SECRET`.

---

*For technical / developer documentation, see `DEVELOPER_GUIDE.md`.*
