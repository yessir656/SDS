"use client";

// ============================================================================
// SdsManager — admin SDS upload / replace / view / delete
// ============================================================================

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Upload,
  Search,
  FileText,
  FileCheck,
  FileWarning,
  ExternalLink,
  Trash2,
  RefreshCw,
  Loader2,
  X,
} from "lucide-react";
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
import { MAX_SDS_FILE_SIZE } from "@/lib/validation";

interface SdsRow {
  id: string;
  chemicalId: string;
  chemicalName: string;
  casNumber: string;
  originalFileName: string;
  fileSize: number;
  status: string;
  version: number;
  updatedAt: number;
  updatedByName: string | null;
}

export function SdsManager() {
  const [rows, setRows] = useState<SdsRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [uploadTarget, setUploadTarget] = useState<SdsRow | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SdsRow | null>(null);

  const fetchSds = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/chemicals");
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      // Flatten into SDS rows.
      const sdsRows: SdsRow[] = json.chemicals
        .filter((c: { sds: unknown }) => c.sds)
        .map((c: { id: string; chemicalName: string; casNumber: string; sds: { id: string; chemicalId: string; originalFileName: string; fileSize: number; status: string; version: number; updatedAt: number }; updatedByName: string | null }) => ({
          id: c.sds.id,
          chemicalId: c.id,
          chemicalName: c.chemicalName,
          casNumber: c.casNumber,
          originalFileName: c.sds.originalFileName,
          fileSize: c.sds.fileSize,
          status: c.sds.status,
          version: c.sds.version,
          updatedAt: c.sds.updatedAt,
          updatedByName: c.updatedByName,
        }));
      setRows(sdsRows);
    } catch (err) {
      console.error("Failed to load SDS list:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSds();
  }, [fetchSds]);

  const filtered = rows.filter((r) => {
    const term = search.toLowerCase().trim();
    if (!term) return true;
    return r.chemicalName.toLowerCase().includes(term) || r.casNumber.toLowerCase().includes(term);
  });

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search chemicals…"
            className="h-10 pl-9"
          />
        </div>
        <Button onClick={fetchSds} variant="outline" size="icon" className="h-10 w-10">
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
                  <th className="px-4 py-3 font-medium">SDS File</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Version</th>
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
                      No SDS documents found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((r) => (
                    <tr key={r.id} className="border-b last:border-0 hover:bg-muted/20">
                      <td className="px-4 py-3">
                        <div className="font-medium">{r.chemicalName}</div>
                        <div className="text-xs text-muted-foreground font-mono">{r.casNumber}</div>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        {r.originalFileName}
                        <div className="text-muted-foreground">{(r.fileSize / 1024).toFixed(1)} KB</div>
                      </td>
                      <td className="px-4 py-3">
                        {r.status === "available" ? (
                          <Badge className="border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            <FileCheck className="mr-1 h-3 w-3" /> Available
                          </Badge>
                        ) : (
                          <Badge className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            <FileWarning className="mr-1 h-3 w-3" /> Placeholder
                          </Badge>
                        )}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">v{r.version}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {new Date(r.updatedAt).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" })}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <a href={`/api/sds/${r.id}/download?v=${r.version}`} target="_blank" rel="noopener noreferrer">
                            <Button size="icon" variant="ghost" className="h-8 w-8" title="View SDS">
                              <ExternalLink className="h-4 w-4" />
                            </Button>
                          </a>
                          <Button size="icon" variant="ghost" className="h-8 w-8" title="Upload / Replace" onClick={() => setUploadTarget(r)}>
                            <Upload className="h-4 w-4" />
                          </Button>
                          {r.status === "available" && (
                            <Button size="icon" variant="ghost" className="h-8 w-8 text-red-600 hover:bg-red-50" title="Revert to placeholder" onClick={() => setDeleteTarget(r)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
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

      {/* Upload dialog */}
      {uploadTarget && (
        <UploadDialog
          row={uploadTarget}
          onClose={() => setUploadTarget(null)}
          onUploaded={() => {
            setUploadTarget(null);
            fetchSds();
          }}
        />
      )}

      {/* Delete (revert to placeholder) confirmation */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Revert {deleteTarget?.chemicalName} SDS to placeholder?</AlertDialogTitle>
            <AlertDialogDescription>
              The current PDF will be deleted and replaced with a placeholder. All synced devices will receive the change. Users will no longer be able to view the real SDS until you upload a new one.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              onClick={async () => {
                if (!deleteTarget) return;
                try {
                  const res = await fetch(`/api/admin/sds/${deleteTarget.id}`, { method: "DELETE" });
                  if (!res.ok) throw new Error("Revert failed");
                  setDeleteTarget(null);
                  fetchSds();
                } catch {
                  alert("Failed to revert SDS.");
                }
              }}
            >
              Revert to Placeholder
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Upload Dialog
// ---------------------------------------------------------------------------

function UploadDialog({
  row,
  onClose,
  onUploaded,
}: {
  row: SdsRow;
  onClose: () => void;
  onUploaded: () => void;
}) {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) {
      setFile(null);
      return;
    }

    // Client-side validation (server repeats these checks authoritatively).
    if (selected.size > MAX_SDS_FILE_SIZE) {
      setError(`File too large. Maximum is ${MAX_SDS_FILE_SIZE / (1024 * 1024)} MB.`);
      return;
    }
    if (selected.type !== "application/pdf") {
      setError("Only PDF files are allowed.");
      return;
    }
    if (!selected.name.toLowerCase().endsWith(".pdf")) {
      setError("File must have a .pdf extension.");
      return;
    }

    setError(null);
    setFile(selected);
  };

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("chemicalId", row.chemicalId);

      const res = await fetch("/api/admin/sds", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Upload failed" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      onUploaded();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Upload className="h-5 w-5 text-navy-600" />
            Upload SDS for {row.chemicalName}
          </DialogTitle>
          <DialogDescription>
            Upload a PDF Safety Data Sheet. The current {row.status === "available" ? `v${row.version}` : "placeholder"} will be replaced.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="sds-file">PDF File (max {MAX_SDS_FILE_SIZE / (1024 * 1024)} MB)</Label>
            <Input
              ref={inputRef}
              id="sds-file"
              type="file"
              accept="application/pdf,.pdf"
              onChange={handleFileChange}
            />
          </div>

          {file && (
            <div className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm">
              <FileText className="h-4 w-4 text-navy-600" />
              <span className="flex-1 truncate">{file.name}</span>
              <span className="text-xs text-muted-foreground">{(file.size / 1024).toFixed(1)} KB</span>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setFile(null); if (inputRef.current) inputRef.current.value = ""; }}>
                <X className="h-3 w-3" />
              </Button>
            </div>
          )}

          {error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">{error}</p>
          )}

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="button" disabled={!file || uploading} onClick={handleUpload} className="gap-2">
              {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
              {uploading ? "Uploading…" : "Upload SDS"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
