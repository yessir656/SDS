"use client";

// ============================================================================
// ChemicalDetail — "Spec Sheet" with segmented control navbar.
// Editorial header (big name, signal-word spine) + a sticky pill-style navbar
// with 4 tabs: Overview / Hazards / Response / Handling.
//   Overview  → Identifiers, SDS Document, Storage & Department
//   Hazards   → GHS pictograms, Hazard Classification chips
//   Response  → SDS sections 4/5/6 (First-Aid, Firefighting, Spill) + Emergency Contact
//   Handling  → Required PPE + Safety Instructions
// A sticky bottom action bar (mobile) + centered CTA (desktop) holds Emergency.
// Contracts preserved: useAppStore + db.sdsDocuments + getSdsBlobForChemical +
// syncNow + GhsPictogramBadge + PpeList + RegulatoryTags + HAZARD_CLASS_LABELS.
// ============================================================================

import {
  ArrowLeft,
  ShieldAlert,
  MapPin,
  Building2,
  Factory,
  Truck,
  Calendar,
  Tag,
  HardHat,
  FileText,
  Phone,
  FileCheck,
  FileWarning,
  ExternalLink,
  Loader2,
  HeartPulse,
  Flame,
  Droplets,
  Copy,
  Check,
  Info,
  Siren,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { GhsPictogramBadge } from "@/components/ghs/pictograms";
import { PpeList } from "@/components/common/PpeList";
import { RegulatoryTags } from "@/components/common/RegulatoryTags";
import { useAppStore } from "@/store/app-store";
import { HAZARD_CLASS_LABELS } from "@/types";
import type { ChemicalRecord, SdsDocumentRecord } from "@/types";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";
import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/local-db";
import { getSdsBlobForChemical, syncNow } from "@/lib/sync-engine";
import { useRecentlyViewed } from "@/hooks/use-recently-viewed";
import { toast } from "@/hooks/use-toast";

// ---------------------------------------------------------------------------
// Tab definitions — the 4 segmented-control tabs.
// ---------------------------------------------------------------------------

type DetailTab = "overview" | "hazards" | "response" | "handling";

const TABS: { id: DetailTab; label: string; icon: React.ReactNode }[] = [
  { id: "overview", label: "Overview", icon: <Info className="h-3.5 w-3.5" /> },
  { id: "hazards", label: "Hazards", icon: <ShieldAlert className="h-3.5 w-3.5" /> },
  { id: "response", label: "Response", icon: <Siren className="h-3.5 w-3.5" /> },
  { id: "handling", label: "Handling", icon: <Wrench className="h-3.5 w-3.5" /> },
];

// ---------------------------------------------------------------------------

export function ChemicalDetail() {
  const chemical = useAppStore((s) => s.selectedChemical);
  const goCatalog = useAppStore((s) => s.goCatalog);
  const goToEmergency = useAppStore((s) => s.goToEmergency);
  const { pushRecent } = useRecentlyViewed();
  const [copiedField, setCopiedField] = useState<"cas" | "formula" | null>(null);
  const [activeTab, setActiveTab] = useState<DetailTab>("overview");

  const sdsDoc = useLiveQuery(
    async () =>
      chemical ? db.sdsDocuments.where("chemicalId").equals(chemical.id).first() : undefined,
    [chemical?.id],
    undefined
  );
  const [sdsLoading, setSdsLoading] = useState(false);

  // Track this chemical as recently viewed (for the catalog quick-access strip).
  useEffect(() => {
    if (chemical) pushRecent(chemical);
  }, [chemical, pushRecent]);

  // Background sync so the SDS metadata (version, status badge) refreshes.
  useEffect(() => {
    if (!chemical || !navigator.onLine) return;
    syncNow().catch(() => {});
  }, [chemical?.id]);

  /** Copy a value to the clipboard + show a toast + flash a checkmark. */
  const copyValue = async (value: string, field: "cas" | "formula", label: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedField(field);
      toast({
        title: "Copied to clipboard",
        description: `${label}: ${value}`,
      });
      setTimeout(() => setCopiedField((f) => (f === field ? null : f)), 1500);
    } catch {
      toast({
        title: "Couldn't copy",
        description: "Your browser blocked clipboard access.",
        variant: "destructive",
      });
    }
  };

  const handleViewSds = async () => {
    if (!chemical) return;
    setSdsLoading(true);
    try {
      const blob = await getSdsBlobForChemical(chemical.id);
      if (blob) {
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
        setTimeout(() => URL.revokeObjectURL(url), 60000);
      } else {
        // Friendlier toast instead of a jarring browser alert().
        toast({
          title: "SDS not available offline",
          description: "Connect to the internet and try again — the PDF will sync automatically.",
          variant: "destructive",
        });
      }
    } finally {
      setSdsLoading(false);
    }
  };

  if (!chemical) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-20">
        <p className="text-sm text-muted-foreground">No chemical selected.</p>
        <Button onClick={goCatalog}>Back to catalog</Button>
      </div>
    );
  }

  const lastUpdated = new Date(chemical.lastUpdated).toLocaleDateString(
    "en-PH",
    { year: "numeric", month: "long", day: "numeric" }
  );
  const isDanger = chemical.signalWord === "danger";

  return (
    <div className="space-y-5 pb-24">
      {/* Back link */}
      <button
        onClick={goCatalog}
        className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to catalog
      </button>

      {/* Editorial header — full-width with hazard spine */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-panel">
        <div
          className={cn(
            "absolute inset-y-0 left-0 w-2",
            isDanger ? "spine-danger" : "spine-warning"
          )}
          aria-hidden
        />
        <div className="p-6 pl-7 sm:p-7 sm:pl-8">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="flex flex-wrap items-center gap-2.5">
                <span
                  className={cn(
                    "rounded-md px-2.5 py-1 text-[11px] font-bold uppercase tracking-widest",
                    isDanger
                      ? "bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-950/50 dark:text-red-300 dark:ring-red-900"
                      : "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/50 dark:text-amber-300 dark:ring-amber-900"
                  )}
                >
                  {chemical.signalWord}
                </span>
                {chemical.tradeName && chemical.tradeName !== chemical.chemicalName && (
                  <span className="text-xs text-muted-foreground">
                    Also: <span className="font-medium">{chemical.tradeName}</span>
                  </span>
                )}
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-foreground sm:text-4xl">
                {chemical.chemicalName}
              </h1>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1 font-mono text-sm">
                <button
                  type="button"
                  onClick={() => copyValue(chemical.casNumber, "cas", "CAS Number")}
                  className="group flex items-center gap-1.5 rounded-md px-1 py-0.5 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mirdc-cyan"
                  title="Click to copy CAS number"
                  aria-label={`Copy CAS number ${chemical.casNumber}`}
                >
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">CAS</span>
                  <span className="font-semibold">{chemical.casNumber}</span>
                  {copiedField === "cas" ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100" />
                  )}
                </button>
                <span className="h-4 w-px bg-border" />
                <button
                  type="button"
                  onClick={() => copyValue(chemical.formula, "formula", "Formula")}
                  className="group flex items-center gap-1.5 rounded-md px-1 py-0.5 transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-mirdc-cyan"
                  title="Click to copy formula"
                  aria-label={`Copy formula ${chemical.formula}`}
                >
                  <span className="text-xs uppercase tracking-wide text-muted-foreground">Formula</span>
                  <span className="font-semibold">{chemical.formula}</span>
                  {copiedField === "formula" ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-muted-foreground/60 opacity-0 transition-opacity group-hover:opacity-100" />
                  )}
                </button>
              </div>
            </div>
            <div className="flex gap-4 text-xs text-muted-foreground lg:flex-col lg:items-end lg:gap-1.5">
              <span className="flex items-center gap-1">
                <Tag className="h-3 w-3 text-mirdc-cyan" />
                v{chemical.version}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3 text-mirdc-cyan" />
                Updated {lastUpdated}
              </span>
            </div>
          </div>
        </div>
      </div>

            {/* --- Sticky segmented control navbar (pill-style) --- */}
      <div className="sticky top-16 z-20 -mx-4 bg-background/80 px-4 py-2.5 backdrop-blur-md sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        <nav
          aria-label="Chemical detail sections"
          className="mx-auto flex max-w-lg items-center gap-0.5 rounded-full border border-border bg-muted/60 p-1 shadow-panel sm:gap-1"
        >
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "flex flex-1 items-center justify-center gap-1 rounded-full px-2 py-2 text-[11px] font-semibold transition-all min-w-0 sm:gap-1.5 sm:px-3 sm:text-sm",
                  isActive
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <span className={cn("shrink-0", isActive ? "text-mirdc-cyan" : "text-muted-foreground")}>
                  {tab.icon}
                </span>
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* --- Tab content --- */}
      {activeTab === "overview" && (
        <OverviewTab
          chemical={chemical}
          sdsDoc={sdsDoc}
          sdsLoading={sdsLoading}
          onViewSds={handleViewSds}
        />
      )}
      {activeTab === "hazards" && <HazardsTab chemical={chemical} />}
      {activeTab === "response" && <ResponseTab chemical={chemical} />}
      {activeTab === "handling" && <HandlingTab chemical={chemical} />}

      {/* Sticky bottom action bar (mobile only) */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-card/95 backdrop-blur-md lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-2 px-4 py-3">
          <Button
            onClick={() => goToEmergency(chemical)}
            className="flex-1 gap-2 bg-red-600 text-white hover:bg-red-700"
            size="lg"
          >
            <ShieldAlert className="h-5 w-5" />
            Open Emergency Mode
          </Button>
        </div>
      </div>

      {/* Desktop emergency CTA (centered, above footer) */}
      <div className="hidden justify-center pb-2 lg:flex">
        <Button
          onClick={() => goToEmergency(chemical)}
          className="gap-2 bg-red-600 text-white hover:bg-red-700"
          size="lg"
        >
          <ShieldAlert className="h-5 w-5" />
          Open Emergency Mode
        </Button>
      </div>
    </div>
  );
}

// ===========================================================================
// TAB: Overview — Identifiers, Storage & Department, SDS Document
// ===========================================================================

function OverviewTab({
  chemical,
  sdsDoc,
  sdsLoading,
  onViewSds,
}: {
  chemical: ChemicalRecord;
  sdsDoc: SdsDocumentRecord | undefined;
  sdsLoading: boolean;
  onViewSds: () => void;
}) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {/* Identifiers */}
      <Panel title="Identifiers" icon={<Info className="h-4 w-4 text-mirdc-cyan" />}>
        <DetailRow icon={<Factory className="h-3.5 w-3.5" />} label="Manufacturer" value={chemical.manufacturer} />
        <DetailRow icon={<Truck className="h-3.5 w-3.5" />} label="Supplier" value={chemical.supplier} />
        {chemical.sdsDocumentId && (
          <DetailRow icon={<FileText className="h-3.5 w-3.5" />} label="SDS Document" value={chemical.sdsDocumentId} mono />
        )}
      </Panel>

      {/* Storage & Department */}
      <Panel title="Storage & Department" icon={<MapPin className="h-4 w-4 text-mirdc-cyan" />}>
        <DetailRow icon={<MapPin className="h-3.5 w-3.5" />} label="Location" value={chemical.storageLocation} />
        <DetailRow icon={<Building2 className="h-3.5 w-3.5" />} label="Division" value={chemical.department} />
      </Panel>

      {/* SDS Document */}
      <Panel title="SDS Document" icon={<FileText className="h-4 w-4 text-mirdc-cyan" />}>
        {sdsDoc ? (
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              {sdsDoc.status === "available" ? (
                <Badge className="gap-1 border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                  <FileCheck className="h-3 w-3" />
                  Available
                </Badge>
              ) : (
                <Badge className="gap-1 border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
                  <FileWarning className="h-3 w-3" />
                  Placeholder
                </Badge>
              )}
              <span className="font-mono text-xs text-muted-foreground">v{sdsDoc.version}</span>
            </div>
            <p className="text-xs leading-relaxed text-muted-foreground">
              {sdsDoc.status === "available"
                ? "The full Safety Data Sheet is cached for offline viewing."
                : "A placeholder SDS is available. The administrator has not yet uploaded the actual document."}
            </p>
            <Button onClick={onViewSds} disabled={sdsLoading} variant="outline" className="w-full gap-2">
              {sdsLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ExternalLink className="h-4 w-4" />}
              View SDS PDF
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            SDS document metadata is syncing. Please try again in a moment.
          </p>
        )}
      </Panel>

      {/* Quick hazard summary (so Overview isn't too sparse) */}
      <Panel title="At a Glance" icon={<ShieldAlert className="h-4 w-4 text-red-500" />}>
        <div className="space-y-2 text-sm">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Signal Word</span>
            <span
              className={cn(
                "rounded-md px-2 py-0.5 text-xs font-bold uppercase",
                chemical.signalWord === "danger"
                  ? "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                  : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
              )}
            >
              {chemical.signalWord}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">GHS Pictograms</span>
            <span className="font-semibold">{chemical.ghsPictograms.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Hazard Classes</span>
            <span className="font-semibold">{chemical.hazardClasses.length}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Required PPE</span>
            <span className="font-semibold">{chemical.personalProtectiveEquipment.length}</span>
          </div>
        </div>
      </Panel>
    </div>
  );
}

// ===========================================================================
// TAB: Hazards — GHS pictograms + Hazard Classification chips
// ===========================================================================

function HazardsTab({ chemical }: { chemical: ChemicalRecord }) {
  return (
    <div className="space-y-4">
      <Panel title="GHS Hazard Pictograms" icon={<ShieldAlert className="h-4 w-4 text-red-500" />}>
        {chemical.ghsPictograms.length === 0 ? (
          <p className="text-sm text-muted-foreground">No GHS pictograms assigned.</p>
        ) : (
          <div className="flex flex-wrap gap-4">
            {chemical.ghsPictograms.map((p) => (
              <GhsPictogramBadge key={p} pictogram={p} size={72} className="w-24" />
            ))}
          </div>
        )}
      </Panel>

      <Panel title="Hazard Classification" icon={<ShieldAlert className="h-4 w-4 text-red-500" />}>
        {chemical.hazardClasses.length === 0 ? (
          <p className="text-sm text-muted-foreground">No hazard classes assigned.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {chemical.hazardClasses.map((hc) => (
              <span
                key={hc}
                className="rounded-lg bg-navy-50 px-3 py-1.5 text-sm font-medium text-navy-800 dark:bg-navy-950/60 dark:text-navy-200"
              >
                {HAZARD_CLASS_LABELS[hc]}
              </span>
            ))}
          </div>
        )}

        <Separator className="my-4" />

        <h4 className="mb-2.5 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
          Signal Word
        </h4>
        <p className="text-sm text-foreground/90">
          <span
            className={cn(
              "rounded-md px-2 py-0.5 text-xs font-bold uppercase",
              chemical.signalWord === "danger"
                ? "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300"
                : "bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300"
            )}
          >
            {chemical.signalWord}
          </span>
          <span className="ml-2 text-muted-foreground">
            {chemical.signalWord === "danger"
              ? "Severe hazard — immediate danger to health/life."
              : "Moderate hazard — caution advised."}
          </span>
        </p>

        <RegulatoryTags tags={chemical.regulatoryTags} />
      </Panel>
    </div>
  );
}

// ===========================================================================
// TAB: Response — SDS sections 4/5/6 + Emergency Contact
// ===========================================================================

function ResponseTab({ chemical }: { chemical: ChemicalRecord }) {
  return (
    <div className="space-y-4">
      {/* Emergency contact — prominent at the top of the Response tab */}
      <div className="overflow-hidden rounded-2xl border-2 border-red-300 bg-red-50 shadow-panel dark:border-red-900 dark:bg-red-950/30">
        <div className="flex items-start gap-3 p-4">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-red-600 text-white">
            <Phone className="h-4 w-4" />
          </span>
          <div className="min-w-0 flex-1">
            <div className="text-[11px] font-bold uppercase tracking-widest text-red-600 dark:text-red-400">
              Emergency Contact
            </div>
            <EmergencyContactValue value={chemical.emergencyContact} />
          </div>
        </div>
      </div>

      {/* Numbered SDS timeline — emergency-critical sections.
          The first (First-Aid) is expanded by default so the most urgent
          info is immediately visible without a click. */}
      <Panel title="SDS Section Quick-Reference" icon={<FileText className="h-4 w-4 text-mirdc-cyan" />}>
        <Accordion
          type="single"
          collapsible
          defaultValue="sec-4"
          className="w-full space-y-2.5"
        >
          <SdsTimelineItem
            value="sec-4"
            number="4"
            title="First-Aid Measures"
            icon={<HeartPulse className="h-4 w-4" />}
            content={chemical.firstAidMeasures}
          />
          <SdsTimelineItem
            value="sec-5"
            number="5"
            title="Firefighting Measures"
            icon={<Flame className="h-4 w-4" />}
            content={chemical.firefightingMeasures}
          />
          <SdsTimelineItem
            value="sec-6"
            number="6"
            title="Accidental Release (Spill) Measures"
            icon={<Droplets className="h-4 w-4" />}
            content={chemical.accidentalReleaseMeasures}
          />
        </Accordion>
      </Panel>
    </div>
  );
}

// ===========================================================================
// TAB: Handling — Required PPE + Safety Instructions
// ===========================================================================

function HandlingTab({ chemical }: { chemical: ChemicalRecord }) {
  return (
    <div className="space-y-4">
      <Panel title="Required PPE" icon={<HardHat className="h-4 w-4 text-mirdc-cyan" />}>
        <PpeList items={chemical.personalProtectiveEquipment} />
        <RegulatoryTags tags={chemical.regulatoryTags} />
      </Panel>

      <Panel title="Safety Instructions" icon={<FileText className="h-4 w-4 text-mirdc-cyan" />}>
        {chemical.safetyInstructions ? (
          <p className="text-sm leading-relaxed text-foreground/90">
            {chemical.safetyInstructions}
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            No specific safety instructions on file.
          </p>
        )}
      </Panel>
    </div>
  );
}

// ===========================================================================
// Shared helpers
// ===========================================================================

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border border-border bg-card shadow-panel">
      <header className="flex items-center gap-2 border-b border-border/60 px-4 py-2.5">
        {icon}
        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
          {title}
        </h3>
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

function DetailRow({
  icon,
  label,
  value,
  mono,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5 py-1">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className={cn("font-medium", mono && "font-mono text-xs")}>
          {value || "—"}
        </div>
      </div>
    </div>
  );
}

function SdsTimelineItem({
  value,
  number,
  title,
  icon,
  content,
}: {
  value: string;
  number: string;
  title: string;
  icon: React.ReactNode;
  content: string;
}) {
  return (
    <AccordionItem
      value={value}
      className="overflow-hidden rounded-xl border-2 border-red-200 bg-red-50/40 px-3 dark:border-red-900 dark:bg-red-950/20"
    >
      <AccordionTrigger className="hover:no-underline">
        <div className="flex items-center gap-2.5">
          <span className="step-badge flex h-7 w-7 items-center justify-center rounded-lg text-sm font-bold text-white">
            {number}
          </span>
          <span className="text-red-600 dark:text-red-400">{icon}</span>
          <span className="font-semibold">{title}</span>
          <Badge variant="outline" className="ml-1 border-red-300 text-[10px] text-red-700 dark:border-red-700 dark:text-red-300">
            EMERGENCY
          </Badge>
        </div>
      </AccordionTrigger>
      <AccordionContent className="whitespace-pre-line pt-2 text-sm leading-relaxed text-foreground/90">
        {content}
      </AccordionContent>
    </AccordionItem>
  );
}

/**
 * Renders the emergency-contact value. If it looks like a phone number (or
 * contains one), the number becomes a tap-to-call `tel:` link so a mobile
 * user can dial straight from the detail page. Otherwise it renders as plain
 * text. Handles values like "Poison Control: (02) 8521 3225" — only the
 * phone-number part is linked.
 */
function EmergencyContactValue({ value }: { value: string }) {
  const trimmed = value.trim();
  if (!trimmed) {
    return (
      <p className="mt-1 text-sm font-medium text-muted-foreground">
        No emergency contact on file.
      </p>
    );
  }

  // Extract the first phone-number-like substring (handles +63, (02), 166, etc.).
  const phoneMatch = trimmed.match(/(\+?\d[\d\s().-]{6,}\d)/);
  if (!phoneMatch) {
    return (
      <p className="mt-1 text-base font-semibold leading-snug text-red-900 dark:text-red-100">
        {trimmed}
      </p>
    );
  }

  const phone = phoneMatch[0];
  const telHref = `tel:${phone.replace(/[\s().-]/g, "")}`;
  const before = trimmed.slice(0, phoneMatch.index);
  const after = trimmed.slice((phoneMatch.index ?? 0) + phone.length);

  return (
    <p className="mt-1 text-base font-semibold leading-snug text-red-900 dark:text-red-100">
      {before}
      <a
        href={telHref}
        className="rounded-md underline decoration-red-400/50 underline-offset-2 transition-colors hover:bg-red-100 dark:hover:bg-red-900/40"
        title={`Call ${phone}`}
      >
        {phone}
      </a>
      {after}
    </p>
  );
}
