"use client";

// ============================================================================
// BulkImportDialog — batch ingestion of SDS PDFs into the catalog.
// ============================================================================
//
// For each selected PDF, runs the same pipeline as single auto-fill but also
// CREATES the chemical record and attaches the uploaded PDF as its real SDS
// document (replacing the generated placeholder):
//
//   1. POST /api/admin/sds/extract      → tiered fields (embedded text →
//                                          OCR → AI fallback) + method badge
//   2. POST /api/admin/chemicals        → create record (auto-slug id from
//                                          the extracted name; duplicate CAS
//                                          in DB ⇒ skipped as duplicate)
//   3. POST /api/admin/sds (multipart)  → attach the real PDF (status becomes
//                                          "available")
//
// Files are processed sequentially with live per-file status so the admin can
// watch progress. Failures are per-file: one bad PDF never aborts the batch.
// All three endpoints are the existing audited admin APIs, so every created
// chemical + SDS upload lands in the audit log automatically.
// ============================================================================

import { useEffect, useMemo, useRef, useState } from "react";
import { generateChemicalId } from "@/lib/slug";
import { Files, Loader2, RefreshCw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DEPARTMENTS } from "@/types";

type RowStatus =
  | "pending"
  | "extracting"
  | "creating"
  | "created" // chemical + real SDS attached
  | "partial" // chemical created but SDS attach failed
  | "duplicate"
  | "failed";

interface ResultRow {
  fileName: string;
  status: RowStatus;
  method?: string;
  chemicalId?: string;
  error?: string;
  /** True while a per-row "Retry with AI" is running for this row. */
  retrying?: boolean;
}

const STATUS_LABELS: Record<RowStatus, string> = {
  pending: "Queued",
  extracting: "Extracting…",
  creating: "Creating…",
  created: "Imported",
  partial: "Imported (SDS attach failed)",
  duplicate: "Skipped — CAS already in catalog",
  failed: "Failed",
};

/** Derive a schema-valid id slug from an extracted chemical name + manufacturer.
 *  Now uses the shared generateChemicalId helper so bulk-import produces the
 *  same "aceticacid-fisher" format as the manual create form. Falls back to
 *  the filename (minus .pdf) when the name is missing. */
function slugifyId(rawName: string, manufacturer?: string): string {
  const fromName = generateChemicalId(rawName, manufacturer);
  if (fromName) return fromName;
  const fromFile = rawName
    .replace(/\.pdf$/i, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 90);
  return fromFile || "chemical";
}

/** Map extracted fields onto the API payload shape — shared by the create
 *  path and the per-row Retry-with-AI update path. The create path adds `id`. */
function buildFieldsPayload(
  d: Record<string, unknown>,
  baseName: string,
  department: string
) {
  return {
    chemicalName: baseName.slice(0, 200),
    casNumber:
      (typeof d.casNumber === "string" && d.casNumber.trim()) || "Not provided",
    formula:
      (typeof d.formula === "string" && d.formula.trim().slice(0, 100)) ||
      "Not provided",
    tradeName: typeof d.tradeName === "string" ? d.tradeName.trim() : "",
    manufacturer: typeof d.manufacturer === "string" ? d.manufacturer.trim() : "",
    supplier: typeof d.supplier === "string" ? d.supplier.trim() : "",
    signalWord: d.signalWord === "warning" ? "warning" : "danger",
    hazardClasses: Array.isArray(d.hazardClasses) ? d.hazardClasses : [],
    ghsPictograms: Array.isArray(d.ghsPictograms) ? d.ghsPictograms : [],
    storageLocation:
      typeof d.storageLocation === "string" ? d.storageLocation : "",
    department,
    safetyInstructions:
      typeof d.safetyInstructions === "string" ? d.safetyInstructions : "",
    version: "1.0",
    emergencyContact:
      typeof d.emergencyContact === "string" ? d.emergencyContact : "",
    personalProtectiveEquipment: Array.isArray(
      d.personalProtectiveEquipment
    )
      ? d.personalProtectiveEquipment
      : [],
    regulatoryTags: [],
    firstAidMeasures:
      typeof d.firstAidMeasures === "string" ? d.firstAidMeasures : "",
    firefightingMeasures:
      typeof d.firefightingMeasures === "string" ? d.firefightingMeasures : "",
    accidentalReleaseMeasures:
      typeof d.accidentalReleaseMeasures === "string"
        ? d.accidentalReleaseMeasures
        : "",
  };
}

export function BulkImportDialog({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Called after the batch finishes so the parent can refresh its table. */
  onImported: () => void;
}) {
  const [files, setFiles] = useState<File[]>([]);
  const [department, setDepartment] = useState<string>("Chemical Analysis");
  const [running, setRunning] = useState(false);
  const [rows, setRows] = useState<ResultRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // CAS numbers already in the catalog — preloaded when the dialog opens.
  const existingCasRef = useRef<Set<string>>(new Set());

  // Summary is derived from the rows (not incremental counters) so per-row
  // "Retry with AI" keeps the numbers accurate. Shown once every row is done.
  const summary = useMemo(() => {
    if (rows.length === 0) return null;
    const allDone = rows.every((r) =>
      ["created", "partial", "duplicate", "failed"].includes(r.status)
    );
    if (!allDone) return null;
    return {
      created: rows.filter(
        (r) => r.status === "created" || r.status === "partial"
      ).length,
      skipped: rows.filter((r) => r.status === "duplicate").length,
      failed: rows.filter((r) => r.status === "failed").length,
    };
  }, [rows]);

  const anyRetrying = rows.some((r) => r.retrying);

  // Preload existing CAS numbers each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setFiles([]);
    setRows([]);
    setError(null);
    (async () => {
      try {
        const res = await fetch("/api/admin/chemicals");
        if (!res.ok) return;
        const json = await res.json();
        existingCasRef.current = new Set(
          (json.chemicals ?? [])
            .map((c: { casNumber?: string }) => (c.casNumber ?? "").trim())
            .filter(Boolean)
        );
      } catch {
        existingCasRef.current = new Set();
      }
    })();
  }, [open]);

  const updateRow = (index: number, patch: Partial<ResultRow>) => {
    setRows((prev) =>
      prev.map((r, i) => (i === index ? { ...r, ...patch } : r))
    );
  };

  /** Run the full per-file pipeline (extract → duplicate check → create →
   *  attach the real SDS PDF) for one file, updating its row live. Returns
   *  the row's final status. forceAI=true skips the free local tiers and
   *  goes straight to the vision model (the "Retry with AI" path). */
  const processFile = async (
    index: number,
    forceAI: boolean
  ): Promise<RowStatus> => {
    const file = files[index];

    // ---- Step 1: tiered extraction ---------------------------------------
    updateRow(index, { status: "extracting", error: undefined });
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (forceAI) fd.append("forceAI", "true");
      const exRes = await fetch("/api/admin/sds/extract", {
        method: "POST",
        body: fd,
      });
      const exJson = await exRes.json().catch(() => null);
      if (!exRes.ok || !exJson?.success) {
        throw new Error(exJson?.error || `Extraction failed (HTTP ${exRes.status})`);
      }
      const d = exJson.data as Record<string, unknown>;
      updateRow(index, { method: String(exJson.method ?? "ai") });

      // ---- Duplicate check by CAS ---------------------------------------
      const cas = typeof d.casNumber === "string" ? d.casNumber.trim() : "";
      if (cas && existingCasRef.current.has(cas)) {
        updateRow(index, { status: "duplicate" });
        return "duplicate";
      }

      // ---- Step 2: create the chemical ----------------------------------
      updateRow(index, { status: "creating" });
      const baseName =
        (typeof d.chemicalName === "string" && d.chemicalName.trim()) ||
        file.name.replace(/\.pdf$/i, "");

      const payload = {
        id: "", // filled below with dedupe retry
        ...buildFieldsPayload(d, baseName, department),
      };

      let finalId = "";
      let createRes: Response | null = null;
      let createJson: { error?: string } | null = null;
      const base = slugifyId(
        baseName,
        typeof payload.manufacturer === "string" && payload.manufacturer
          ? payload.manufacturer
          : undefined
      );
      for (let attempt = 1; attempt <= 5; attempt++) {
        const candidate = attempt === 1 ? base : `${base}-${attempt}`;
        payload.id = candidate;
        const r = await fetch("/api/admin/chemicals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (r.status === 409) continue; // id collision → next suffix
        createRes = r;
        break;
      }

      if (!createRes || !createRes.ok) {
        createJson = createRes
          ? await createRes.json().catch(() => null)
          : null;
        throw new Error(
          createJson?.error ||
            `Create failed${createRes ? ` (HTTP ${createRes.status})` : " — ID collisions"}`
        );
      }

      finalId = payload.id as string;
      existingCasRef.current.add(cas || `id:${finalId}`);

      // ---- Step 3: attach the REAL uploaded PDF as its SDS ---------------
      let attachError: string | null = null;
      try {
        const sfd = new FormData();
        sfd.append("file", file);
        sfd.append("chemicalId", finalId);
        const sdsRes = await fetch("/api/admin/sds", {
          method: "POST",
          body: sfd,
        });
        if (!sdsRes.ok) {
          const sj = await sdsRes.json().catch(() => null);
          attachError = sj?.error || `HTTP ${sdsRes.status}`;
        }
      } catch (e) {
        attachError = e instanceof Error ? e.message : String(e);
      }

      if (attachError) {
        updateRow(index, {
          status: "partial",
          chemicalId: finalId,
          error: attachError,
        });
        return "partial";
      }
      updateRow(index, { status: "created", chemicalId: finalId });
      return "created";
    } catch (err) {
      updateRow(index, {
        status: "failed",
        error: err instanceof Error ? err.message : String(err),
      });
      return "failed";
    }
  };

  const runBatch = async () => {
    if (files.length === 0 || running) return;
    setRunning(true);
    setError(null);

    let failedCount = 0;
    for (let i = 0; i < files.length; i++) {
      const status = await processFile(i, false);
      if (status === "failed") failedCount++;
    }

    setRunning(false);
    if (failedCount > 0) {
      setError(
        `${failedCount} of ${files.length} file(s) failed — see rows below. Individual rows can be retried with AI.`
      );
    }
    onImported();
  };

  /** Per-row "Retry with AI".
   *  • failed rows: re-run the whole pipeline, forced through the AI tier.
   *  • created/partial rows: re-extract with AI and UPDATE the existing
   *    chemical (no duplicate). For partial rows the SDS attach is retried
   *    too, since the originally selected file is still available. */
  const retryRowWithAi = async (index: number) => {
    const row = rows[index];
    const file = files[index];
    if (!row || !file || row.retrying || running) return;

    if (row.status === "failed") {
      updateRow(index, { retrying: true, error: undefined });
      try {
        await processFile(index, true);
      } finally {
        updateRow(index, { retrying: false });
      }
      return;
    }

    if (!row.chemicalId) return;
    const originalStatus = row.status;
    updateRow(index, {
      retrying: true,
      error: undefined,
      status: "extracting",
    });
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("forceAI", "true");
      const exRes = await fetch("/api/admin/sds/extract", {
        method: "POST",
        body: fd,
      });
      const exJson = await exRes.json().catch(() => null);
      if (!exRes.ok || !exJson?.success) {
        throw new Error(
          exJson?.error || `Extraction failed (HTTP ${exRes.status})`
        );
      }
      const d = exJson.data as Record<string, unknown>;
      const baseName =
        (typeof d.chemicalName === "string" && d.chemicalName.trim()) ||
        file.name.replace(/\.pdf$/i, "");

      const res = await fetch(`/api/admin/chemicals/${row.chemicalId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildFieldsPayload(d, baseName, department)),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error || `Update failed (HTTP ${res.status})`);
      }

      // A partial row's SDS attach failed earlier — retry it with the file
      // we still have.
      let attachError: string | null = null;
      if (originalStatus === "partial") {
        try {
          const sfd = new FormData();
          sfd.append("file", file);
          sfd.append("chemicalId", row.chemicalId);
          const sdsRes = await fetch("/api/admin/sds", {
            method: "POST",
            body: sfd,
          });
          if (!sdsRes.ok) {
            const sj = await sdsRes.json().catch(() => null);
            attachError = sj?.error || `HTTP ${sdsRes.status}`;
          }
        } catch (e) {
          attachError = e instanceof Error ? e.message : String(e);
        }
      }

      updateRow(index, {
        method: String(exJson.method ?? "ai"),
        status:
          originalStatus === "partial" && attachError
            ? "partial"
            : "created",
        error: attachError ?? undefined,
        retrying: false,
      });
    } catch (err) {
      updateRow(index, {
        status: originalStatus,
        error: err instanceof Error ? err.message : String(err),
        retrying: false,
      });
    }
  };

  const doneCount = rows.filter((r) =>
    ["created", "partial", "duplicate", "failed"].includes(r.status)
  ).length;

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => !running && !anyRetrying && onOpenChange(o)}
    >
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Files className="h-5 w-5 text-navy-600" />
            Bulk Import SDS PDFs
          </DialogTitle>
          <DialogDescription>
            Select multiple SDS PDFs. Each file is read locally (free text/OCR
            first), then added to the catalog with the actual PDF attached.
            Review each entry afterwards and fix any OCR quirks.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* File picker */}
          <div className="space-y-2">
            <Label htmlFor="bulk-files">PDF files</Label>
            <Input
              id="bulk-files"
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              multiple
              disabled={running}
              onChange={(e) => {
                const list = Array.from(e.target.files ?? []);
                setFiles(list);
                setRows(
                  list.map((f) => ({ fileName: f.name, status: "pending" }))
                );
                setError(null);
              }}
            />
            {files.length > 0 && (
              <p className="text-xs text-muted-foreground">
                {files.length} file{files.length > 1 ? "s" : ""} selected
              </p>
            )}
          </div>

          {/* Department applied to all imports */}
          <div className="space-y-2">
            <Label htmlFor="bulk-dept">Department (applied to all)</Label>
            <select
              id="bulk-dept"
              value={department}
              disabled={running}
              onChange={(e) => setDepartment(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              {DEPARTMENTS.map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground">
              You can reassign departments individually later via Edit.
            </p>
          </div>

          {/* Progress list */}
          {rows.length > 0 && (
            <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-2">
              {rows.map((r, i) => {
                const canRetry =
                  !running &&
                  !r.retrying &&
                  (r.status === "failed" ||
                    ((r.status === "created" || r.status === "partial") &&
                      !!r.chemicalId &&
                      r.method !== "ai"));
                return (
                  <div
                    key={`${r.fileName}-${i}`}
                    className="flex items-center gap-2 text-xs"
                  >
                    <span className="min-w-0 flex-1 truncate" title={r.fileName}>
                      {r.fileName}
                    </span>
                    {r.method && (
                      <Badge variant="outline" className="shrink-0 text-[9px]">
                        {r.method}
                      </Badge>
                    )}
                    <span
                      className={
                        "shrink-0 font-medium " +
                        (r.status === "created"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : r.status === "failed" || r.status === "partial"
                            ? "text-red-600 dark:text-red-400"
                            : r.status === "duplicate"
                              ? "text-amber-600 dark:text-amber-400"
                              : "text-muted-foreground")
                      }
                    >
                      {(r.status === "extracting" || r.status === "creating") && (
                        <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                      )}
                      {STATUS_LABELS[r.status]}
                      {r.chemicalId ? ` · ${r.chemicalId}` : ""}
                      {r.error ? ` — ${r.error}` : ""}
                    </span>
                    {canRetry && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="h-6 shrink-0 gap-1 px-1.5 text-[10px]"
                        onClick={() => retryRowWithAi(i)}
                        disabled={anyRetrying}
                        title={
                          r.status === "failed"
                            ? "Re-run this file through the AI extraction and import it"
                            : "Re-read this file with AI and update the imported chemical"
                        }
                      >
                        <RefreshCw className="h-3 w-3" />
                        Retry with AI
                      </Button>
                    )}
                    {r.retrying && (
                      <span className="shrink-0 font-medium text-violet-700 dark:text-violet-300">
                        <Loader2 className="mr-1 inline h-3 w-3 animate-spin" />
                        Retrying with AI…
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {/* Batch summary */}
          {summary && !running && !anyRetrying && (
            <p className="text-xs font-medium text-emerald-700 dark:text-emerald-400">
              Done: {summary.created} imported
              {summary.skipped > 0 ? `, ${summary.skipped} skipped (duplicate CAS)` : ""}
              {summary.failed > 0 ? `, ${summary.failed} failed` : ""}.
            </p>
          )}

          {/* Batch-level error banner */}
          {error && !running && (
            <div className="rounded-md border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={running || anyRetrying}
            >
              {running || anyRetrying
                ? "Importing…"
                : doneCount > 0
                  ? "Close"
                  : "Cancel"}
            </Button>
            <Button
              onClick={runBatch}
              disabled={running || files.length === 0}
              className="gap-2"
            >
              {running && <Loader2 className="h-4 w-4 animate-spin" />}
              {running
                ? `Importing ${doneCount}/${files.length}…`
                : `Import ${files.length || ""} file${files.length === 1 ? "" : "s"}`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
