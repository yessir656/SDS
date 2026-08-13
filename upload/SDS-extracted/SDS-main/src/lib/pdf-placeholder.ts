// ============================================================================
// PDF Placeholder Generator — produces a minimal valid PDF for chemicals that
// don't yet have a real SDS uploaded. The placeholder clearly states it is not
// the actual SDS, so lab staff are never confused into thinking they're reading
// real hazard data.
// ============================================================================

function escapePdf(text: string): string {
  return text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

/**
 * Generate a minimal but valid PDF buffer for a placeholder SDS.
 * The PDF contains the chemical name and a clear "not yet uploaded" notice.
 */
export function generatePlaceholderPdf(chemicalName: string): Buffer {
  const parts: string[] = [];
  const offsets: number[] = [];
  let pos = 0;

  const add = (s: string) => {
    parts.push(s);
    pos += Buffer.byteLength(s, "latin1");
  };

  add("%PDF-1.4\n");

  offsets.push(pos);
  add("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  offsets.push(pos);
  add("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");

  offsets.push(pos);
  add(
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\nendobj\n"
  );

  const stream = [
    "BT",
    "/F1 22 Tf",
    "72 720 Td",
    `(${escapePdf(chemicalName)}) Tj`,
    "0 -36 Td",
    "/F2 14 Tf",
    "(Safety Data Sheet — PLACEHOLDER) Tj",
    "0 -24 Td",
    "(This document is a placeholder. The actual SDS has not yet been) Tj",
    "0 -18 Td",
    "(uploaded by the administrator.) Tj",
    "0 -36 Td",
    "(Do NOT use this document for emergency response.) Tj",
    "0 -18 Td",
    "(Contact your laboratory supervisor or the MIRDC safety officer if you) Tj",
    "0 -18 Td",
    "(need the current SDS for this chemical.) Tj",
    "ET",
  ].join("\n");

  offsets.push(pos);
  add(
    `4 0 obj\n<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream\nendobj\n`
  );

  offsets.push(pos);
  add("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\nendobj\n");

  offsets.push(pos);
  add("6 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");

  const xrefStart = pos;
  add("xref\n");
  add(`0 ${offsets.length + 1}\n`);
  add("0000000000 65535 f \n");
  for (const off of offsets) {
    add(String(off).padStart(10, "0") + " 00000 n \n");
  }
  add("trailer\n");
  add(`<< /Size ${offsets.length + 1} /Root 1 0 R >>\n`);
  add("startxref\n");
  add(`${xrefStart}\n`);
  add("%%EOF\n");

  return Buffer.from(parts.join(""), "latin1");
}
