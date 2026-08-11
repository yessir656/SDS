// ============================================================================
// GET /api/sds/:id/download
//   Public — streams the SDS PDF file. Serves the placeholder PDF if the
//   status is "placeholder". Sets Content-Disposition to inline so the browser
//   can display it, plus a Content-Disposition fallback filename.
// ============================================================================

import { db } from "@/lib/db";
import { getFile } from "@/lib/storage";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
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

  return new Response(new Uint8Array(buffer), {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Length": String(buffer.length),
      "Content-Disposition": `inline; filename="${downloadName}"`,
      "Cache-Control": "public, max-age=3600",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
