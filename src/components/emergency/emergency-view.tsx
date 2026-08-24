"use client";

// ============================================================================
// EmergencyView — full-screen emergency response display
// Optimized for readability and speed under stress. Works 100% offline.
// ============================================================================

import { useEffect } from "react";
import {
  X,
  Phone,
  HeartPulse,
  Flame,
  Droplets,
  HardHat,
  ShieldAlert,
  ArrowLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { GhsPictogram } from "@/components/ghs/pictograms";
import { PpeList } from "@/components/common/PpeList";
import { RegulatoryTags } from "@/components/common/RegulatoryTags";
import { useAppStore } from "@/store/app-store";
import { cn } from "@/lib/utils";
import { EMERGENCY_CONTACTS, EMERGENCY_HOTLINES } from "@/types";

export function EmergencyView() {
  const chemical = useAppStore((s) => s.selectedChemical);
  const goCatalog = useAppStore((s) => s.goCatalog);
  const goToDetail = useAppStore((s) => s.goToDetail);

  // ESC key exits emergency mode.
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (chemical) goToDetail(chemical);
        else goCatalog();
      }
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [chemical, goCatalog, goToDetail]);

  if (!chemical) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
        <p className="text-sm text-muted-foreground">
          No chemical selected for emergency view.
        </p>
        <Button onClick={goCatalog}>Back to catalog</Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-red-950/5 backdrop-blur-sm">
      {/* Top bar */}
      <div className="sticky top-0 z-10 border-b-2 border-red-600 bg-red-600 text-white shadow-lg">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/20">
              <ShieldAlert className="h-5 w-5" />
            </span>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wider opacity-90">
                Emergency Mode
              </div>
              <div className="text-lg font-bold leading-tight">
                {chemical.chemicalName}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => goToDetail(chemical)}
              className="gap-1 bg-white text-red-700 hover:bg-white/90"
            >
              <ArrowLeft className="h-4 w-4" />
              <span className="hidden sm:inline">Back to detail</span>
              <span className="sm:hidden">Detail</span>
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={goCatalog}
              className="bg-white text-red-700 hover:bg-white/90"
              aria-label="Close emergency mode"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-5 sm:px-6">
        {/* Quick identifiers bar */}
        <Card className="border-2 border-red-200 dark:border-red-900">
          <CardContent className="flex flex-wrap items-center gap-x-6 gap-y-2 p-4">
            <QuickStat label="CAS Number" value={chemical.casNumber} mono />
            <QuickStat label="Formula" value={chemical.formula} mono />
            <QuickStat label="Signal Word" value={chemical.signalWord.toUpperCase()} danger />
            <QuickStat label="Location" value={chemical.storageLocation} />
          </CardContent>
        </Card>

        {/* GHS pictogram summary */}
        <Card>
          <CardContent className="p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
              <ShieldAlert className="h-4 w-4 text-red-600" />
              GHS Pictogram Summary
            </h2>
            <div className="flex flex-wrap gap-3">
              {chemical.ghsPictograms.map((p) => (
                <div
                  key={p}
                  className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2"
                >
                  <GhsPictogram pictogram={p} size={40} />
                  <span className="text-sm font-medium">
                    {p
                      .split("-")
                      .map((w) => w[0].toUpperCase() + w.slice(1))
                      .join(" ")}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Emergency-critical sections (large, high-contrast) */}
        <EmergencySection
          icon={<HeartPulse className="h-5 w-5" />}
          title="First-Aid Measures"
          sectionNumber="4"
          content={chemical.firstAidMeasures}
        />

        <EmergencySection
          icon={<Flame className="h-5 w-5" />}
          title="Firefighting Measures"
          sectionNumber="5"
          content={chemical.firefightingMeasures}
        />

        <EmergencySection
          icon={<Droplets className="h-5 w-5" />}
          title="Spill / Accidental Release"
          sectionNumber="6"
          content={chemical.accidentalReleaseMeasures}
        />

        {/* Required PPE */}
        <Card className="border-2 border-navy-300 dark:border-navy-800">
          <CardContent className="p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
              <HardHat className="h-4 w-4 text-navy-600" />
              Required Personal Protective Equipment
            </h2>
            <PpeList items={chemical.personalProtectiveEquipment} />
            <RegulatoryTags tags={chemical.regulatoryTags} />
          </CardContent>
        </Card>

        {/* Emergency contact — large, prominent, with a PPE quick-scan beside it */}
        <Card className="border-2 border-red-600 bg-red-50 dark:bg-red-950/30">
          <CardContent className="p-5">
            <h2 className="mb-2 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-red-700 dark:text-red-300">
              <Phone className="h-4 w-4" />
              Emergency Contact
            </h2>
            <div className="flex flex-wrap items-center gap-4">
              <p className="text-xl font-bold text-red-900 dark:text-red-100">
                {chemical.emergencyContact}
              </p>
              {/* Glanceable PPE reminder, right beside the contact info */}
              <div className="flex items-center gap-2 text-xs uppercase tracking-wider text-red-700/80 dark:text-red-300/80">
                <span>PPE</span>
                <PpeList items={chemical.personalProtectiveEquipment} iconsOnly />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Emergency Contacts — MIRDC-wide designated people + hotlines (Aug-12 meeting 4.1) */}
        <Card className="border-2 border-sky-300 bg-sky-50/40 dark:border-sky-800 dark:bg-sky-950/20">
          <CardContent className="p-4">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">
              <Phone className="h-4 w-4 text-sky-600" />
              Emergency Contacts
            </h2>
            <div className="space-y-3">
              {EMERGENCY_HOTLINES.map((c) => (
                <div
                  key={c.role}
                  className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5"
                >
                  <span className="text-sm">
                    <span className="font-semibold">{c.role}</span>
                    <span className="text-muted-foreground"> · {c.name}</span>
                  </span>
                  <a
                    href={`tel:${(c.phone ?? "").replace(/\s+/g, "")}`}
                    className="font-mono text-sm font-bold text-sky-700 hover:underline dark:text-sky-300"
                  >
                    {c.phone}
                  </a>
                </div>
              ))}

              <div className="space-y-1.5 border-t border-border/50 pt-2">
                {EMERGENCY_CONTACTS.map((c) => (
                  <div
                    key={c.role}
                    className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5"
                  >
                    <span className="text-sm">
                      {c.role} — {c.name}
                    </span>
                    {c.phone ? (
                      <a
                        href={`tel:${c.phone.replace(/\s+/g, "")}`}
                        className="font-mono text-sm font-semibold text-sky-700 hover:underline dark:text-sky-300"
                      >
                        {c.phone}
                      </a>
                    ) : (
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
                        internal line
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Offline notice */}
        <div className="flex items-center justify-center gap-2 pb-6 text-xs text-muted-foreground">
          <ShieldAlert className="h-3.5 w-3.5" />
          <span>This emergency information is stored locally and works without internet.</span>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------

function QuickStat({
  label,
  value,
  mono,
  danger,
}: {
  label: string;
  value: string;
  mono?: boolean;
  danger?: boolean;
}) {
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div
        className={cn(
          "text-sm font-bold",
          mono && "font-mono",
          danger && "text-red-600 dark:text-red-400"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function EmergencySection({
  icon,
  title,
  sectionNumber,
  content,
}: {
  icon: React.ReactNode;
  title: string;
  sectionNumber: string;
  content: string;
}) {
  return (
    <Card className="overflow-hidden border-2 border-red-200 dark:border-red-900">
      <div className="flex items-center gap-3 border-b border-red-100 bg-red-50 px-4 py-3 dark:border-red-900 dark:bg-red-950/30">
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-red-600 text-sm font-bold text-white">
          {sectionNumber}
        </span>
        <span className="text-red-700 dark:text-red-300">{icon}</span>
        <h2 className="text-base font-bold text-red-900 dark:text-red-100">
          {title}
        </h2>
      </div>
      <CardContent className="p-4">
        <p className="whitespace-pre-line text-sm leading-relaxed text-foreground sm:text-base">
          {content}
        </p>
      </CardContent>
    </Card>
  );
}
