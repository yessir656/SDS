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

import { useEffect, useRef, useState } from "react";
import { Files, Loader2, X } from "lucide-react";
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

/** Derive a schema-valid id slug from an extracted chemical name or filename. */
function slugifyId(raw: string): string {
  const base = raw
    .toLowerCase()
    .replace(/\.pdf$/i, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90)
    .replace(/-+$/g, "");
  return base || "chemical";
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
  const [summary, setSummary] = useState<{
    created: number;
    skipped: number;
    failed: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // CAS numbers already in the catalog — preloaded when the dialog opens.
  const existingCasRef = useRef<Set<string>>(new Set());

  // Preload existing CAS numbers each time the dialog opens.
  useEffect(() => {
    if (!open) return;
    setFiles([]);
    setRows([]);
    setSummary(null);
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

  const runBatch = async () => {
    if (files.length === 0 || running) return;
    setRunning(true);
    setError(null);

    let created = 0;
    let skipped = 0;
    let failed = 0;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // ---- Step 1: tiered extraction -------------------------------------
      updateRow(i, { status: "extracting", error: undefined });
      try {
        const fd = new FormData();
        fd.append("file", file);
        const exRes = await fetch("/api/admin/sds/extract", {
          method: "POST",
          body: fd,
        });
        const exJson = await exRes.json().catch(() => null);
        if (!exRes.ok || !exJson?.success) {
          throw new Error(exJson?.error || `Extraction failed (HTTP ${exRes.status})`);
        }
        const d = exJson.data as Record<string, unknown>;
        updateRow(i, { method: String(exJson.method ?? "ai") });

        // ---- Duplicate check by CAS ---------------------------------------
        const cas = typeof d.casNumber === "string" ? d.casNumber.trim() : "";
        if (cas && existingCasRef.current.has(cas)) {
          updateRow(i, { status: "duplicate" });
          skipped++;
          continue;
        }

        // ---- Step 2: create the chemical ----------------------------------
        updateRow(i, { status: "creating" });
        const baseName =
          (typeof d.chemicalName === "string" && d.chemicalName.trim()) ||
          file.name.replace(/\.pdf$/i, "");

        const payload = {
          id: "", // filled below with dedupe retry
          chemicalName: baseName.slice(0, 200),
          casNumber: cas || "Not provided",
          formula:
            (typeof d.formula === "string" && d.formula.trim().slice(0, 100)) ||
            "Not provided",
          tradeName: typeof d.tradeName === "string" ? d.tradeName.trim() : "",
          manufacturer:
            typeof d.manufacturer === "string" ? d.manufacturer.trim() : "",
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
            typeof d.firefightingMeasures === "string"
              ? d.firefightingMeasures
              : "",
          accidentalReleaseMeasures:
            typeof d.accidentalReleaseMeasures === "string"
              ? d.accidentalReleaseMeasures
              : "",
        };

        let finalId = "";
        let createRes: Response | null = null;
        let createJson: { error?: string } | null = null;
        const base = slugifyId(baseName);
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

        finalId = payload.id;
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
          updateRow(i, {
            status: "partial",
            chemicalId: finalId,
            error: attachError,
          });
        } else {
          updateRow(i, { status: "created", chemicalId: finalId });
        }
        created++;
      } catch (err) {
        updateRow(i, {
          status: "failed",
          error: err instanceof Error ? err.message : String(err),
        });
        failed++;
      }
    }

    setRunning(false);
    if (failed > 0) {
      setError(`${failed} of ${files.length} file(s) failed — see rows below.`);
    }
    setSummary({ created, skipped, failed });
    onImported();
  };

  const doneCount = rows.filter((r) =>
    ["created", "partial", "duplicate", "failed"].includes(r.status)
  ).length;

  return (
    <Dialog open={open} onOpenChange={(o) => !running && onOpenChange(o)}>
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
              {rows.map((r, i) => (
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
                </div>
              ))}
            </div>
          )}

          {/* Batch summary */}
          {summary && !running && (
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
              disabled={running}
            >
              {running ? "Importing…" : doneCount > 0 ? "Close" : "Cancel"}
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
