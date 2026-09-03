"use client";

// ============================================================================
// ChemicalManager — admin CRUD table for chemicals
// ============================================================================

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import {
  Plus,
  Search,
  Pencil,
  Trash2,
  RefreshCw,
  Loader2,
  X,
  FileText,
  AlertCircle,
  CheckCircle2,
  Files,
  Sparkles,
  RotateCcw,
} from "lucide-react";
import { BulkImportDialog } from "@/components/admin/bulk-import";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import { DataPagination } from "@/components/common/data-pagination";
import { usePagination } from "@/hooks/use-pagination";
import {
  DEPARTMENTS,
  SIGNAL_WORDS,
  ALL_HAZARD_CLASSES,
  ALL_GHS_PICTOGRAMS,
  HAZARD_CLASS_LABELS,
  GHS_PICTOGRAM_INFO,
  REGULATORY_CLASSIFICATIONS,
} from "@/types";
import type { Department, SignalWord, HazardClass, GhsPictogram } from "@/types";
import { generateChemicalId } from "@/lib/slug";

interface AdminChemical {
  id: string;
  casNumber: string;
  chemicalName: string;
  formula: string;
  tradeName: string | null;
  manufacturer: string;
  supplier: string;
  signalWord: string;
  hazardClasses: string[];
  ghsPictograms: string[];
  storageLocation: string;
  department: string;
  safetyInstructions: string;
  version: string;
  emergencyContact: string;
  personalProtectiveEquipment: string[];
  regulatoryTags?: string[];
  firstAidMeasures: string;
  firefightingMeasures: string;
  accidentalReleaseMeasures: string;
  lastUpdated: number;
  serverVersion: number;
  sds: { status: string; version: number } | null;
  updatedByName: string | null;
  createdAt: number;
}

// Extraction pipeline methods returned by /api/admin/sds/extract.
// "embedded-text" and "ocr" run free + offline locally; "ai" consumed quota.
type ExtractMethod = "embedded-text" | "ocr" | "ai";

const EXTRACT_METHOD_LABELS: Record<ExtractMethod, string> = {
  "embedded-text": "Embedded text · free & offline",
  ocr: "Local OCR · free & offline",
  ai: "Gemini AI",
};

export function ChemicalManager() {
  const [chemicals, setChemicals] = useState<AdminChemical[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<AdminChemical | null>(null);
  const [creating, setCreating] = useState(false);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<AdminChemical | null>(null);

  const fetchChemicals = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/chemicals");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setChemicals(json.chemicals);
    } catch (err) {
      console.error("Failed to load chemicals:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchChemicals();
  }, [fetchChemicals]);

  const filtered = useMemo(() => {
    const term = search.toLowerCase().trim();
    if (!term) return chemicals;
    return chemicals.filter(
      (c) =>
        c.chemicalName.toLowerCase().includes(term) ||
        c.casNumber.toLowerCase().includes(term) ||
        c.formula.toLowerCase().includes(term)
    );
  }, [chemicals, search]);

  const pagination = usePagination({
    pageSize: 10,
    total: filtered.length,
    deps: [search],
  });
  const pageItems = pagination.paginate(filtered);

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, CAS, or formula…"
            className="h-10 pl-9"
          />
        </div>
        <Button onClick={() => setCreating(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Add Chemical
        </Button>
        <Button
          onClick={() => setBulkOpen(true)}
          variant="outline"
          className="gap-2"
        >
          <Files className="h-4 w-4" /> Bulk Import
        </Button>
        <Button onClick={fetchChemicals} variant="outline" size="icon" className="h-10 w-10">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                <tr className="text-left text-xs text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Chemical</th>
                  <th className="px-4 py-3 font-medium">CAS</th>
                  <th className="px-4 py-3 font-medium">Signal</th>
                  <th className="px-4 py-3 font-medium">SDS</th>
                  <th className="px-4 py-3 font-medium">Last Updated</th>
                  <th className="px-4 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-navy-600" />
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      No chemicals found.
                    </td>
                  </tr>
                ) : (
                  pageItems.map((c) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <div className="font-medium">{c.chemicalName}</div>
                        <div className="text-xs text-muted-foreground">{c.formula}</div>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">{c.casNumber}</td>
                      <td className="px-4 py-3">
                        <Badge
                          className={cn(
                            "text-[10px] uppercase",
                            c.signalWord === "danger"
                              ? "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
                              : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
                          )}
                        >
                          {c.signalWord}
                        </Badge>
                      </td>
                      <td className="px-4 py-3">
                        {c.sds?.status === "available" ? (
                          <Badge className="border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">Available</Badge>
                        ) : (
                          <Badge className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">Placeholder</Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(c.lastUpdated).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setEditing(c)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:bg-red-50" onClick={() => setDeleteTarget(c)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination footer */}
      {!loading && filtered.length > 0 && (
        <DataPagination
          page={pagination.page}
          totalPages={pagination.totalPages}
          total={pagination.total}
          count={pagination.count}
          startIndex={pagination.startIndex}
          endIndex={pagination.endIndex}
          onPageChange={pagination.setPage}
          noun="chemical"
        />
      )}

      {/* Create / Edit dialog */}
      {(creating || editing) && (
        <ChemicalFormDialog
          chemical={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            fetchChemicals();
          }}
        />
      )}

      {/* Bulk SDS PDF import */}
      <BulkImportDialog
        open={bulkOpen}
        onOpenChange={setBulkOpen}
        onImported={fetchChemicals}
      />

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete {deleteTarget?.chemicalName}?</AlertDialogTitle>
            <AlertDialogDescription>
              This will soft-delete the chemical and its SDS. The change will propagate to all synced devices. This action can be undone by re-adding the chemical.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  const res = await fetch(`/api/admin/chemicals/${deleteTarget.id}`, { method: "DELETE" });
                  if (!res.ok) throw new Error("Delete failed");
                  setDeleteTarget(null);
                  fetchChemicals();
                } catch (err) {
                  alert("Failed to delete chemical.");
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Chemical Form Dialog — shared by create and edit
// ---------------------------------------------------------------------------

interface FormState {
  id: string;
  casNumber: string;
  chemicalName: string;
  formula: string;
  tradeName: string;
  manufacturer: string;
  supplier: string;
  signalWord: SignalWord;
  hazardClasses: HazardClass[];
  ghsPictograms: GhsPictogram[];
  storageLocation: string;
  department: Department;
  safetyInstructions: string;
  version: string;
  emergencyContact: string;
  personalProtectiveEquipment: string;
  regulatoryTags: string[];
  firstAidMeasures: string;
  firefightingMeasures: string;
  accidentalReleaseMeasures: string;
}

function ChemicalFormDialog({
  chemical,
  onClose,
  onSaved,
}: {
  chemical: AdminChemical | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [form, setForm] = useState<FormState>({
    id: chemical?.id ?? "",
    casNumber: chemical?.casNumber ?? "",
    chemicalName: chemical?.chemicalName ?? "",
    formula: chemical?.formula ?? "",
    tradeName: chemical?.tradeName ?? "",
    manufacturer: chemical?.manufacturer ?? "",
    supplier: chemical?.supplier ?? "",
    signalWord: (chemical?.signalWord as SignalWord) ?? "danger",
    hazardClasses: (chemical?.hazardClasses as HazardClass[]) ?? [],
    ghsPictograms: (chemical?.ghsPictograms as GhsPictogram[]) ?? [],
    storageLocation: chemical?.storageLocation ?? "",
    department: (chemical?.department as Department) ?? "Chemical Analysis",
    safetyInstructions: chemical?.safetyInstructions ?? "",
    version: chemical?.version ?? "1.0",
    emergencyContact: chemical?.emergencyContact ?? "",
    personalProtectiveEquipment: chemical?.personalProtectiveEquipment.join("\n") ?? "",
    regulatoryTags: chemical?.regulatoryTags ?? [],
    firstAidMeasures: chemical?.firstAidMeasures ?? "",
    firefightingMeasures: chemical?.firefightingMeasures ?? "",
    accidentalReleaseMeasures: chemical?.accidentalReleaseMeasures ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // True while the post-save PDF attachment upload is in flight.
  const [attachingPdf, setAttachingPdf] = useState(false);

  // AI auto-fill state.
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [extractedFromPdf, setExtractedFromPdf] = useState(false);
  // Which pipeline produced the current auto-fill ("embedded-text"/"ocr" are
  // free+offline; "ai" consumed quota). Drives the badge + Retry-with-AI.
  const [extractMethod, setExtractMethod] = useState<ExtractMethod | null>(null);
  const [extractNotice, setExtractNotice] = useState<string | null>(null);
  const [extractLabel, setExtractLabel] = useState("Reading SDS document…");
  const lastFileRef = useRef<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEdit = !!chemical;

  // -------------------------------------------------------------------------
  // Auto-ID generation: when the admin types the Chemical Name + Manufacturer,
  // the ID field auto-fills with "{name}{manufacturer}" (e.g. "aceticacid-
  // fisher"). The admin can still override by typing in the ID field directly —
  // once they do, auto-generation pauses until they clear it. This is detected
  // by comparing the current ID against what generateChemicalId() would have
  // produced from the PREVIOUS name + manufacturer (empty also counts as auto).
  // -------------------------------------------------------------------------
  const updateForm = useCallback(
    (
      updatesOrFn:
        | Partial<FormState>
        | ((prev: FormState) => Partial<FormState>)
    ) => {
      setForm((prev) => {
        const updates =
          typeof updatesOrFn === "function" ? updatesOrFn(prev) : updatesOrFn;
        const next = { ...prev, ...updates };
        // Only auto-regenerate the ID in CREATE mode, and only when the
        // chemical name or manufacturer is what changed. If the admin typed a
        // custom ID (it doesn't match the old auto value), preserve it.
        if (
          !isEdit &&
          (updates.chemicalName !== undefined ||
            updates.manufacturer !== undefined)
        ) {
          const oldAutoId = generateChemicalId(
            prev.chemicalName,
            prev.manufacturer
          );
          const idWasAuto = !prev.id || prev.id === oldAutoId;
          if (idWasAuto) {
            next.id = generateChemicalId(next.chemicalName, next.manufacturer);
          }
        }
        return next;
      });
    },
    [isEdit]
  );

  // ---------------------------------------------------------------------------
  // Auto-fill extraction — runs the tiered pipeline on the selected PDF.
  // Default (forceAI=false): free local tiers (embedded text → OCR), AI only
  // fires server-side if those come back empty/garbage. forceAI=true is the
  // "Retry with AI" escape hatch and goes straight to the vision model.
  // ---------------------------------------------------------------------------
  const runExtraction = async (file: File, forceAI: boolean) => {
    setExtracting(true);
    setExtractError(null);
    setExtractLabel(
      forceAI
        ? "Asking Gemini AI to read the SDS… (~10-15 seconds)"
        : "Extracting locally — embedded text / OCR first, AI only if needed…"
    );

    try {
      const fd = new FormData();
      fd.append("file", file);
      if (forceAI) fd.append("forceAI", "true");

      const res = await fetch("/api/admin/sds/extract", {
        method: "POST",
        body: fd,
      });

      const json = await res.json().catch(() => ({ success: false, error: "Invalid response from server" }));

      if (!res.ok || !json.success) {
        throw new Error(json.error || `Extraction failed (HTTP ${res.status})`);
      }

      const d = json.data as {
        chemicalName?: string;
        casNumber?: string;
        formula?: string;
        tradeName?: string;
        manufacturer?: string;
        supplier?: string;
        signalWord?: SignalWord;
        ghsPictograms?: GhsPictogram[];
        hazardClasses?: HazardClass[];
        storageLocation?: string;
        safetyInstructions?: string;
        emergencyContact?: string;
        personalProtectiveEquipment?: string[];
        firstAidMeasures?: string;
        firefightingMeasures?: string;
        accidentalReleaseMeasures?: string;
      };

      // Build the next form state from the extracted fields, then let
      // updateForm() auto-generate the ID from the new name + manufacturer
      // (in create mode, only if the admin hadn't typed a custom ID).
      updateForm((prev) => ({
        chemicalName: d.chemicalName || prev.chemicalName,
        casNumber: d.casNumber || prev.casNumber,
        formula: d.formula || prev.formula,
        tradeName: d.tradeName || prev.tradeName,
        manufacturer: d.manufacturer || prev.manufacturer,
        supplier: d.supplier || prev.supplier,
        signalWord: d.signalWord || prev.signalWord,
        ghsPictograms:
          Array.isArray(d.ghsPictograms) && d.ghsPictograms.length > 0
            ? d.ghsPictograms
            : prev.ghsPictograms,
        hazardClasses:
          Array.isArray(d.hazardClasses) && d.hazardClasses.length > 0
            ? d.hazardClasses
            : prev.hazardClasses,
        storageLocation: d.storageLocation || prev.storageLocation,
        safetyInstructions: d.safetyInstructions || prev.safetyInstructions,
        emergencyContact: d.emergencyContact || prev.emergencyContact,
        // PPE comes back as an array; join with newlines for the textarea.
        personalProtectiveEquipment:
          Array.isArray(d.personalProtectiveEquipment) && d.personalProtectiveEquipment.length > 0
            ? d.personalProtectiveEquipment.join("\n")
            : prev.personalProtectiveEquipment,
        firstAidMeasures: d.firstAidMeasures || prev.firstAidMeasures,
        firefightingMeasures: d.firefightingMeasures || prev.firefightingMeasures,
        accidentalReleaseMeasures:
          d.accidentalReleaseMeasures || prev.accidentalReleaseMeasures,
      }));

      // Record which pipeline produced the result so the UI can badge it and
      // offer "Retry with AI" for free-tier results.
      const rawMethod = typeof json.method === "string" ? json.method : "";
      setExtractMethod(
        rawMethod === "embedded-text" || rawMethod === "ocr" || rawMethod === "ai"
          ? (rawMethod as ExtractMethod)
          : null
      );
      setExtractNotice(typeof json.notice === "string" && json.notice ? json.notice : null);
      setExtractedFromPdf(true);
    } catch (err) {
      setExtractError(err instanceof Error ? err.message : "Auto-fill failed");
      setExtractedFromPdf(false);
    } finally {
      setExtracting(false);
    }
  };

  /** File-input change — first extraction always uses the free local tiers. */
  const handleAutoFill = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // Reset the input value so the same file can be re-selected later.
    if (fileInputRef.current) fileInputRef.current.value = "";
    if (!file) return;
    lastFileRef.current = file;
    await runExtraction(file, false);
  };

  /** Escape hatch — re-run the same file through the vision AI provider. */
  const handleRetryWithAi = async () => {
    const file = lastFileRef.current;
    if (!file || extracting) return;
    await runExtraction(file, true);
  };

  // --- Unsaved-changes guard + Cmd/Ctrl+Enter to save -----------------------
  // Track whether the admin has touched the form so we can warn before closing.
  // We capture a snapshot of the initial form state on mount (no-op for edit
  // mode where "edits" are the meaningful delta). A second ref captures whether
  // ANY field has been touched (including auto-fill), which is the safer
  // trigger for the "discard changes?" confirm.
  const formRef = useRef<HTMLFormElement>(null);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);

  // Submit programmatically when Cmd/Ctrl+Enter is pressed anywhere in the dialog.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
        e.preventDefault();
        formRef.current?.requestSubmit();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Intercept the dialog close: if there are unsaved edits, ask first.
  // The actual dirty-check is a simple ref-flag set by any onChange handler —
  // we don't need a deep equality check; if the user touched anything, confirm.
  const dirtyRef = useRef(false);
  const markDirty = useCallback(() => {
    dirtyRef.current = true;
  }, []);

  const requestClose = useCallback(() => {
    if (dirtyRef.current && !saving && !attachingPdf) {
      setShowDiscardConfirm(true);
    } else {
      onClose();
    }
  }, [saving, attachingPdf, onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const payload = {
        ...form,
        personalProtectiveEquipment: form.personalProtectiveEquipment
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean),
      };

      const url = isEdit ? `/api/admin/chemicals/${form.id}` : "/api/admin/chemicals";
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Request failed" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      // Auto-attach the PDF chosen via Auto-fill so the real document replaces
      // the generated placeholder immediately (same flow as Bulk Import).
      // The chemical itself is already saved at this point — never lose the
      // admin's work over a failed attachment, so failures surface as an
      // alert and leave the record editable for a retry.
      const pdfFile = lastFileRef.current;
      if (pdfFile) {
        setAttachingPdf(true);
        try {
          const fd = new FormData();
          fd.append("file", pdfFile);
          fd.append("chemicalId", form.id);
          const sdsRes = await fetch("/api/admin/sds", { method: "POST", body: fd });
          if (!sdsRes.ok) {
            const sj = await sdsRes.json().catch(() => null);
            throw new Error(sj?.error || `HTTP ${sdsRes.status}`);
          }
        } catch (attachErr) {
          const msg = attachErr instanceof Error ? attachErr.message : String(attachErr);
          window.alert(
            `The chemical was saved, but the SDS PDF could not be attached (${msg}). Open Edit → Auto-fill with the same PDF and save again to retry.`
          );
        } finally {
          setAttachingPdf(false);
        }
      }

      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const toggleArray = <T,>(arr: T[], value: T): T[] => {
    return arr.includes(value) ? arr.filter((x) => x !== value) : [...arr, value];
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && requestClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between gap-2">
            <span>{isEdit ? "Edit Chemical" : "Add New Chemical"}</span>
            <kbd className="hidden items-center gap-0.5 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] font-medium text-muted-foreground sm:inline-flex">
              ⌘/Ctrl + ↵
            </kbd>
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the chemical record. Changes will sync to all devices. Auto-fill from a PDF also attaches the document when you save."
              : "Create a new chemical. Use Auto-fill from PDF below to attach the real document — otherwise a placeholder SDS is generated."}
          </DialogDescription>
        </DialogHeader>

        {/* Hidden file input — triggered by the Auto-fill button. */}
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          hidden
          onChange={handleAutoFill}
        />

        <form ref={formRef} onSubmit={handleSubmit} onChange={markDirty} className="space-y-4">
          {/* Auto-fill from PDF banner / button */}
          <div className="space-y-2 rounded-lg border border-navy-200 bg-navy-50/60 p-3 dark:border-navy-900 dark:bg-navy-950/40">
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-2 border-navy-400 text-navy-700 hover:bg-navy-100 dark:border-navy-800 dark:text-navy-300 dark:hover:bg-navy-900/40"
                onClick={() => fileInputRef.current?.click()}
                disabled={extracting || saving}
              >
                {extracting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <FileText className="h-4 w-4" />
                )}
                {extracting ? "Reading SDS document…" : "Auto-fill from PDF"}
              </Button>
              <span className="text-xs text-muted-foreground">
                Upload an SDS PDF — digital files extract instantly and free; scans run offline OCR. Gemini AI is only used as a fallback. The PDF itself is attached to this chemical when you save.
              </span>
            </div>

            {/* Loading state */}
            {extracting && (
              <div className="flex items-center gap-2 text-xs text-navy-700 dark:text-navy-300">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                {extractLabel}
              </div>
            )}

            {/* Error banner */}
            {extractError && !extracting && (
              <div className="flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="flex-1">
                  <div className="font-semibold">Auto-fill failed</div>
                  <div className="mt-0.5">{extractError}</div>
                </div>
                <button
                  type="button"
                  className="shrink-0 rounded p-0.5 hover:bg-amber-100 dark:hover:bg-amber-900"
                  onClick={() => setExtractError(null)}
                  aria-label="Dismiss error"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}

            {/* Review banner — shows which pipeline ran + Retry-with-AI escape hatch */}
            {extractedFromPdf && !extracting && (
              <div className="flex items-start gap-2 rounded-md border border-navy-300 bg-navy-100/70 px-3 py-2 text-xs text-navy-800 dark:border-navy-700 dark:bg-navy-900/50 dark:text-navy-200">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="flex-1">
                  <div className="font-semibold">
                    Auto-filled from PDF{" "}
                    {extractMethod && (
                      <Badge
                        variant="outline"
                        className={
                          "ml-1 align-middle text-[10px] font-semibold " +
                          (extractMethod === "ai"
                            ? "border-violet-400 bg-violet-50 text-violet-700 dark:border-violet-700 dark:bg-violet-950 dark:text-violet-300"
                            : "border-emerald-400 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950 dark:text-emerald-300")
                        }
                      >
                        {EXTRACT_METHOD_LABELS[extractMethod]}
                      </Badge>
                    )}
                  </div>
                  <div className="mt-0.5">Please review all fields carefully before saving — automated extraction may have errors or omissions.</div>
                  <div className="mt-0.5">This PDF is attached as the SDS document when you save.</div>
                  {extractNotice && (
                    <div className="mt-1 text-amber-700 dark:text-amber-300">{extractNotice}</div>
                  )}
                </div>
                {extractMethod && extractMethod !== "ai" && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-7 shrink-0 gap-1.5 px-2 text-[11px]"
                    onClick={handleRetryWithAi}
                    disabled={extracting || saving}
                  >
                    <RefreshCw className="h-3 w-3" />
                    Retry with AI
                  </Button>
                )}
                <button
                  type="button"
                  className="shrink-0 rounded p-0.5 hover:bg-navy-200 dark:hover:bg-navy-800"
                  onClick={() => setExtractedFromPdf(false)}
                  aria-label="Dismiss review banner"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* ID — only for create. Auto-generated from name + manufacturer. */}
          {!isEdit && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="id">Chemical ID</Label>
                {(() => {
                  const autoId = generateChemicalId(form.chemicalName, form.manufacturer);
                const isAuto = form.id === autoId && autoId !== "";
                const isManual = form.id !== "" && form.id !== autoId;
                return (
                  <span className="flex items-center gap-2">
                    {isAuto && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-mirdc-cyan/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-mirdc-cyan ring-1 ring-mirdc-cyan/30">
                        <Sparkles className="h-3 w-3" />
                        Auto
                      </span>
                    )}
                    {isManual && (
                      <button
                        type="button"
                        onClick={() =>
                          updateForm({ id: generateChemicalId(form.chemicalName, form.manufacturer) })
                        }
                        className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground transition-colors hover:bg-mirdc-cyan/10 hover:text-mirdc-cyan"
                        title="Reset to auto-generated ID"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Reset to auto
                      </button>
                    )}
                  </span>
                );
                })()}
              </div>
              <Input
                id="id"
                value={form.id}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
                placeholder={
                  form.chemicalName || form.manufacturer
                    ? generateChemicalId(form.chemicalName, form.manufacturer) || "Type a name to auto-generate"
                    : "e.g. aceticacid-fisher"
                }
                pattern="[a-z0-9-]*"
                className={cn(
                  form.id && form.id === generateChemicalId(form.chemicalName, form.manufacturer) && form.id !== ""
                    ? "border-mirdc-cyan/40 bg-mirdc-cyan/5"
                    : undefined
                )}
                aria-describedby="id-help"
              />
              <p id="id-help" className="text-[11px] text-muted-foreground">
                {form.id
                  ? form.id === generateChemicalId(form.chemicalName, form.manufacturer)
                    ? <>Auto-generated from <strong className="text-foreground">{form.chemicalName || "name"}</strong> + <strong className="text-foreground">{form.manufacturer || "manufacturer"}</strong>. Edit if you want a custom ID.</>
                    : "Custom ID — you can edit freely."
                  : "Auto-fills as you type the chemical name and manufacturer."}
              </p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="chemicalName">Chemical Name</Label>
              <Input id="chemicalName" value={form.chemicalName} onChange={(e) => updateForm({ chemicalName: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="casNumber">CAS Number</Label>
              <Input id="casNumber" value={form.casNumber} onChange={(e) => setForm({ ...form, casNumber: e.target.value })} required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="formula">Formula</Label>
              <Input id="formula" value={form.formula} onChange={(e) => setForm({ ...form, formula: e.target.value })} required />
            </div>
            <div className="space-y-2">
              <Label htmlFor="tradeName">Trade Name</Label>
              <Input id="tradeName" value={form.tradeName} onChange={(e) => setForm({ ...form, tradeName: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="manufacturer">Manufacturer</Label>
              <Input id="manufacturer" value={form.manufacturer} onChange={(e) => updateForm({ manufacturer: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="supplier">Supplier</Label>
              <Input id="supplier" value={form.supplier} onChange={(e) => setForm({ ...form, supplier: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Signal Word</Label>
              <Select value={form.signalWord} onValueChange={(v) => setForm({ ...form, signalWord: v as SignalWord })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SIGNAL_WORDS.map((sw) => (
                    <SelectItem key={sw} value={sw}>{sw.toUpperCase()}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Department</Label>
              <Select value={form.department} onValueChange={(v) => setForm({ ...form, department: v as Department })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {DEPARTMENTS.map((d) => (
                    <SelectItem key={d} value={d}>{d}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="storageLocation">Storage Location</Label>
              <Input id="storageLocation" value={form.storageLocation} onChange={(e) => setForm({ ...form, storageLocation: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="version">Version</Label>
              <Input id="version" value={form.version} onChange={(e) => setForm({ ...form, version: e.target.value })} />
            </div>
          </div>

          {/* GHS Pictograms */}
          <div className="space-y-2">
            <Label>GHS Pictograms</Label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_GHS_PICTOGRAMS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setForm({ ...form, ghsPictograms: toggleArray(form.ghsPictograms, p) })}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    form.ghsPictograms.includes(p)
                      ? "bg-navy-600 text-white border-navy-600"
                      : "bg-background hover:border-navy-400"
                  )}
                >
                  {GHS_PICTOGRAM_INFO[p].label}
                </button>
              ))}
            </div>
          </div>

          {/* Hazard Classes */}
          <div className="space-y-2">
            <Label>Hazard Classes</Label>
            <div className="flex flex-wrap gap-1.5">
              {ALL_HAZARD_CLASSES.map((hc) => (
                <button
                  key={hc}
                  type="button"
                  onClick={() => setForm({ ...form, hazardClasses: toggleArray(form.hazardClasses, hc) })}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                    form.hazardClasses.includes(hc)
                      ? "bg-navy-600 text-white border-navy-600"
                      : "bg-background hover:border-navy-400"
                  )}
                >
                  {HAZARD_CLASS_LABELS[hc]}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="emergencyContact">Emergency Contact</Label>
            <Input id="emergencyContact" value={form.emergencyContact} onChange={(e) => setForm({ ...form, emergencyContact: e.target.value })} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="regulatoryTags">Regulatory classifications (optional)</Label>
            <div
              id="regulatoryTags"
              className="flex flex-wrap items-center gap-2"
            >
              {REGULATORY_CLASSIFICATIONS.map((tag) => {
                const active = form.regulatoryTags.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        regulatoryTags: toggleArray(form.regulatoryTags, tag),
                      })
                    }
                    className={cn(
                      "rounded-md border px-2.5 py-1 text-xs font-medium transition",
                      active
                        ? "border-sky-600 bg-sky-100 text-sky-900 dark:bg-sky-900/30 dark:text-sky-200"
                        : "border-border bg-background text-muted-foreground hover:bg-muted"
                    )}
                  >
                    {active && (
                      <CheckCircle2 className="mr-1 inline h-3 w-3" />
                    )}
                    {tag}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-muted-foreground">
              Choose from the MIRDC-controlled list (DENR-EMB, PNP, PDEA, FDA,
              DOT, DOH).
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="ppe">PPE (one per line)</Label>
            <p className="text-[11px] text-muted-foreground">
              Add a note in parentheses, e.g. "Nitrile gloves (powder-free, size L)".
            </p>
            <textarea
              id="ppe"
              value={form.personalProtectiveEquipment}
              onChange={(e) => setForm({ ...form, personalProtectiveEquipment: e.target.value })}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Chemical splash goggles&#10;Nitrile gloves (powder-free)&#10;Flame-resistant lab coat"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="safetyInstructions">Safety Instructions</Label>
            <textarea
              id="safetyInstructions"
              value={form.safetyInstructions}
              onChange={(e) => setForm({ ...form, safetyInstructions: e.target.value })}
              className="flex min-h-[60px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="firstAidMeasures">First-Aid Measures (SDS Section 4)</Label>
            <textarea
              id="firstAidMeasures"
              value={form.firstAidMeasures}
              onChange={(e) => setForm({ ...form, firstAidMeasures: e.target.value })}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="firefightingMeasures">Firefighting Measures (SDS Section 5)</Label>
            <textarea
              id="firefightingMeasures"
              value={form.firefightingMeasures}
              onChange={(e) => setForm({ ...form, firefightingMeasures: e.target.value })}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="accidentalReleaseMeasures">Accidental Release Measures (SDS Section 6)</Label>
            <textarea
              id="accidentalReleaseMeasures"
              value={form.accidentalReleaseMeasures}
              onChange={(e) => setForm({ ...form, accidentalReleaseMeasures: e.target.value })}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            />
          </div>

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={requestClose}>Cancel</Button>
            <Button type="submit" disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {attachingPdf ? "Attaching PDF…" : isEdit ? "Save Changes" : "Create Chemical"}
            </Button>
          </div>
        </form>
      </DialogContent>

      {/* Unsaved-changes guard — shows when the admin tries to close with pending edits. */}
      <AlertDialog open={showDiscardConfirm} onOpenChange={setShowDiscardConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard your changes?</AlertDialogTitle>
            <AlertDialogDescription>
              You have unsaved edits to this chemical. Discarding will close
              the form and lose your changes. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                dirtyRef.current = false;
                setShowDiscardConfirm(false);
                onClose();
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Discard changes
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Dialog>
  );
}
