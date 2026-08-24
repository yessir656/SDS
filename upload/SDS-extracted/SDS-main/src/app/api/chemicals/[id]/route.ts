import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { serializeChemical } from "@/lib/serialize";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const chemical = await db.chemical.findUnique({ where: { id } });

  if (!chemical || chemical.deletedAt) {
    return NextResponse.json({ error: "Chemical not found" }, { status: 404 });
  }

  return NextResponse.json({ chemical: serializeChemical(chemical) });
}
