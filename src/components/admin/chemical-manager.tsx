"use client";

// ============================================================================
// ChemicalManager — admin CRUD table for chemicals
// ============================================================================

import { useEffect, useState, useCallback } from "react";
import {
  Plus,
  Search,
  Pencil,
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
import {
  DEPARTMENTS,
  SIGNAL_WORDS,
  ALL_HAZARD_CLASSES,
  ALL_GHS_PICTOGRAMS,
  HAZARD_CLASS_LABELS,
  GHS_PICTOGRAM_INFO,
} from "@/types";
import type { Department, SignalWord, HazardClass, GhsPictogram } from "@/types";

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
  firstAidMeasures: string;
  firefightingMeasures: string;
  accidentalReleaseMeasures: string;
  lastUpdated: number;
  serverVersion: number;
  sds: { status: string; version: number } | null;
  updatedByName: string | null;
  createdAt: number;
}

export function ChemicalManager() {
  const [chemicals, setChemicals] = useState<AdminChemical[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<AdminChemical | null>(null);
  const [creating, setCreating] = useState(false);
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

  const filtered = chemicals.filter((c) => {
    const term = search.toLowerCase().trim();
    if (!term) return true;
    return (
      c.chemicalName.toLowerCase().includes(term) ||
      c.casNumber.toLowerCase().includes(term) ||
      c.formula.toLowerCase().includes(term)
    );
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
            placeholder="Search by name, CAS, or formula…"
            className="h-10 pl-9"
          />
        </div>
        <Button onClick={() => setCreating(true)} className="gap-2">
          <Plus className="h-4 w-4" /> Add Chemical
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
                      <Loader2 className="mx-auto h-6 w-6 animate-spin text-teal-600" />
                    </td>
                  </tr>
                ) : filtered.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-muted-foreground">
                      No chemicals found.
                    </td>
                  </tr>
                ) : (
                  filtered.map((c) => (
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
    firstAidMeasures: chemical?.firstAidMeasures ?? "",
    firefightingMeasures: chemical?.firefightingMeasures ?? "",
    accidentalReleaseMeasures: chemical?.accidentalReleaseMeasures ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isEdit = !!chemical;

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
    <Dialog open={true} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Chemical" : "Add New Chemical"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the chemical record. Changes will sync to all devices."
              : "Create a new chemical. A placeholder SDS will be generated automatically."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* ID — only for create */}
          {!isEdit && (
            <div className="space-y-2">
              <Label htmlFor="id">ID (lowercase, dashes only)</Label>
              <Input
                id="id"
                value={form.id}
                onChange={(e) => setForm({ ...form, id: e.target.value })}
                required
                placeholder="e.g. chem-acetone"
                pattern="[a-z0-9-]+"
              />
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="chemicalName">Chemical Name</Label>
              <Input id="chemicalName" value={form.chemicalName} onChange={(e) => setForm({ ...form, chemicalName: e.target.value })} required />
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
              <Input id="manufacturer" value={form.manufacturer} onChange={(e) => setForm({ ...form, manufacturer: e.target.value })} />
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
                      ? "bg-teal-600 text-white border-teal-600"
                      : "bg-background hover:border-teal-400"
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
                      ? "bg-teal-600 text-white border-teal-600"
                      : "bg-background hover:border-teal-400"
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
            <Label htmlFor="ppe">PPE (one per line)</Label>
            <textarea
              id="ppe"
              value={form.personalProtectiveEquipment}
              onChange={(e) => setForm({ ...form, personalProtectiveEquipment: e.target.value })}
              className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              placeholder="Chemical splash goggles&#10;Nitrile gloves&#10;Flame-resistant lab coat"
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
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={saving} className="gap-2">
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Create Chemical"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
