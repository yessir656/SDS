// ============================================================================
// Draft storage for the Add-Chemical auto-fill flow.
//
// Why: the auto-filled form lives only in React state — closing the dialog
// mid-extraction (or closing the tab) used to lose everything. We persist:
//   • the form fields + extraction metadata → localStorage (sync, cheap)
//   • the selected PDF File → IndexedDB (Files are Blobs; localStorage can't
//     hold them). Keeping the file lets a restored draft still run
//     "Retry with AI" and still auto-attach the PDF on save.
//
// Create-mode only: edit-mode drafts are deliberately not persisted (the
// record already exists server-side; restoring stale data would risk
// overwriting newer changes).
// ============================================================================

const DRAFT_KEY = "sds-chem:create-draft";
const DRAFT_PDF_DB = "sds-chem-drafts";
const DRAFT_PDF_STORE = "files";
const DRAFT_PDF_KEY = "create-draft-pdf";

export interface ChemicalDraft {
  /** Serialized FormState from ChemicalFormDialog (plain JSON). */
  form: Record<string, unknown>;
  extractedFromPdf: boolean;
  extractMethod: string | null;
  extractNotice: string | null;
  savedAt: number;
}

// ---------------------------------------------------------------------------
// localStorage — form fields + extraction metadata
// ---------------------------------------------------------------------------

export function loadChemicalDraft(): ChemicalDraft | null {
  try {
    const raw = window.localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as ChemicalDraft;
    if (!parsed || typeof parsed !== "object" || !parsed.form) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveChemicalDraft(draft: ChemicalDraft): void {
  try {
    window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // Quota errors etc. — the draft is best-effort, never block the admin.
  }
}

export function clearChemicalDraft(): void {
  try {
    window.localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

// ---------------------------------------------------------------------------
// IndexedDB — the selected PDF File
// ---------------------------------------------------------------------------

function openDraftDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DRAFT_PDF_DB, 1);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(DRAFT_PDF_STORE)) {
        req.result.createObjectStore(DRAFT_PDF_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function saveDraftPdf(file: File): Promise<void> {
  try {
    const db = await openDraftDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DRAFT_PDF_STORE, "readwrite");
      tx.objectStore(DRAFT_PDF_STORE).put(file, DRAFT_PDF_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Best-effort — a failed file persist only means no Retry-with-AI/Auto-
    // attach after a restore; the restored fields are still safe.
  }
}

export async function loadDraftPdf(): Promise<File | null> {
  try {
    const db = await openDraftDb();
    const file = await new Promise<File | null>((resolve, reject) => {
      const tx = db.transaction(DRAFT_PDF_STORE, "readonly");
      const req = tx.objectStore(DRAFT_PDF_STORE).get(DRAFT_PDF_KEY);
      req.onsuccess = () => resolve((req.result as File | undefined) ?? null);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return file;
  } catch {
    return null;
  }
}

export async function clearDraftPdf(): Promise<void> {
  try {
    const db = await openDraftDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(DRAFT_PDF_STORE, "readwrite");
      tx.objectStore(DRAFT_PDF_STORE).delete(DRAFT_PDF_KEY);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore
  }
}
