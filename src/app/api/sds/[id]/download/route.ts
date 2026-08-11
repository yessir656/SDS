// ============================================================================
// GET /api/sds/:id/download
//   Public — streams the SDS PDF file. Serves the placeholder PDF if the
//   status is "placeholder". Sets Content-Disposition to inline so the browser
//   can display it, plus a Content-Disposition fallback filename.
//
// CACHING:
//   SDS PDFs are safety-critical — a stale cached placeholder must NEVER be
//   served after an admin uploads the real document. We therefore:
//     • Set Cache-Control: no-store (never cache the raw bytes in the browser
//       HTTP cache). The offline-first client caches blobs in IndexedDB keyed
//       by SDS version, so HTTP caching is redundant and dangerous here.
//     • Emit a strong ETag from contentHash so any intermediate proxy/CDN can
//       still revalidate efficiently.
//   The client may also append ?v=<version> purely as a cache-buster; this
//   handler ignores that query param.
// ============================================================================

import { db } from "@/lib/db";
import { getFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  const sds = await db.sdsDocument.findUnique({ where: { id } });
  if (!sds) {
    return new Response("SDS not found", { status: 404 });
  }

  let buffer: Buffer;
  try {
    buffer = await getFile(sds.storageKey);
  } catch {
    return new Response("SDS file not available", { status: 404 });
  }

  // Sanitize the download filename — strip any path components the admin may
  // have accidentally included, and ensure it ends with .pdf.
  const safeName = sds.originalFileName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const downloadName = safeName.endsWith(".pdf") ? safeName : `${safeName}.pdf`;

  // Build a strong ETag from the stored content hash. Quote per RFC 7232.
  const etag = `"${sds.contentHash}"`;

  // If the client sent If-None-Match and it matches, short-circuit with 304.
  const ifNoneMatch = request.headers.get("if-none-match");
  if (ifNoneMatch && ifNoneMatch === etag) {
    return new Response(null, {
      status: 304,
      headers: {
        ETag: etag,
        "Cache-Control": "no-store",
      },
    });
  }

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(buffer.length),
      "Content-Disposition": `inline; filename="${downloadName}"`,
      // NEVER cache SDS bytes in the browser — admins can replace a
      // placeholder with the real PDF at any time, and serving a stale
      // placeholder is a safety risk. The offline client caches blobs in
      // IndexedDB keyed by SDS version, so HTTP caching is not needed.
      "Cache-Control": "no-store, must-revalidate",
      "Pragma": "no-cache",
      "Expires": "0",
      "ETag": etag,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
