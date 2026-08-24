// ============================================================================
// Storage — secure local file storage for SDS PDFs.
//
// Security principles:
//   - Storage keys are server-generated UUIDs (never user-supplied filenames).
//   - Path traversal is prevented by rejecting keys containing "/" or "..".
//   - Files live OUTSIDE the public/ directory — never directly URL-accessible.
//   - Downloads are gated through an authenticated API route.
// ============================================================================

import { promises as fs } from "fs";
import path from "path";
import crypto from "crypto";

const STORAGE_DIR = path.join(process.cwd(), "storage", "sds");

/** Ensure the storage directory exists. */
async function ensureStorageDir(): Promise<void> {
  await fs.mkdir(STORAGE_DIR, { recursive: true });
}

/** Reject any key that could escape the storage directory. */
function validateKey(key: string): void {
  if (!key || key.includes("/") || key.includes("\\") || key.includes("..")) {
    throw new Error("Invalid storage key");
  }
}

/** Generate a safe, unpredictable storage key for a new file. */
export function generateStorageKey(): string {
  return `${crypto.randomUUID()}.pdf`;
}

/** Persist a file buffer under the given key. */
export async function saveFile(buffer: Buffer, key: string): Promise<void> {
  validateKey(key);
  await ensureStorageDir();
  await fs.writeFile(path.join(STORAGE_DIR, key), buffer);
}

/** Read a file buffer by key. Throws if the file does not exist. */
export async function getFile(key: string): Promise<Buffer> {
  validateKey(key);
  return fs.readFile(path.join(STORAGE_DIR, key));
}

/** Delete a file by key. Silently succeeds if the file does not exist. */
export async function deleteFile(key: string): Promise<void> {
  validateKey(key);
  try {
    await fs.unlink(path.join(STORAGE_DIR, key));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

/** Compute the SHA-256 hash of a file buffer (for integrity / dedup). */
export function computeHash(buffer: Buffer): string {
  return crypto.createHash("sha256").update(buffer).digest("hex");
}

/**
 * Validate that a buffer is a real PDF by checking the magic bytes.
 * PDF files start with `%PDF-`. This prevents disguised executables
 * or scripts from being stored as SDS documents.
 */
export function isPdf(buffer: Buffer): boolean {
  return (
    buffer.length >= 5 &&
    buffer.subarray(0, 5).toString("ascii") === "%PDF-"
  );
}
