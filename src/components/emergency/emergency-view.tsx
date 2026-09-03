"use client";

// ============================================================================
// EmergencyView — "Crisis Console"
// Fresh: full-bleed red gradient, oversized chemical name, big quick-stat bar,
// large numbered procedure cards, prominent tap-to-call contact tiles.
// Contracts preserved: useAppStore + GhsPictogram + PpeList + RegulatoryTags +
// EMERGENCY_CONTACTS + EMERGENCY_HOTLINES.
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
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-gradient-to-b from-red-950 via-red-900 to-red-950">
      {/* Top bar — bold red with the chemical name front-and-center */}
      <div className="sticky top-0 z-10 border-b-2 border-red-400/40 bg-red-700/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/20 ring-1 ring-white/30">
              <ShieldAlert className="h-6 w-6 text-white" />
            </span>
            <div className="min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-red-100">
                Emergency Mode
              </div>
              <div className="truncate text-xl font-bold leading-tight text-white">
                {chemical.chemicalName}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => goToDetail(chemical)}
              className="gap-1.5 bg-white text-red-700 hover:bg-white/90"
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
      <div className="mx-auto max-w-5xl space-y-4 px-4 py-6 sm:px-6">
        {/* Quick-stat bar — identifiers at a glance */}
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
          <QuickStat label="CAS Number" value={chemical.casNumber} mono />
          <QuickStat label="Formula" value={chemical.formula} mono />
          <QuickStat label="Signal Word" value={chemical.signalWord.toUpperCase()} danger />
          <QuickStat label="Location" value={chemical.storageLocation} />
        </div>

        {/* GHS pictogram summary */}
        <section className="rounded-2xl border border-white/15 bg-white/95 p-5 backdrop-blur-sm">
          <h2 className="mb-3.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-red-700">
            <ShieldAlert className="h-4 w-4" />
            GHS Pictogram Summary
          </h2>
          <div className="flex flex-wrap gap-3">
            {chemical.ghsPictograms.map((p) => (
              <div
                key={p}
                className="flex items-center gap-2.5 rounded-xl border border-red-100 bg-card px-3.5 py-2.5"
              >
                <GhsPictogram pictogram={p} size={42} />
                <span className="text-sm font-semibold">
                  {p
                    .split("-")
                    .map((w) => w[0].toUpperCase() + w.slice(1))
                    .join(" ")}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Emergency-critical procedure cards (numbered, large) */}
        <EmergencyProcedure
          number="4"
          icon={<HeartPulse className="h-5 w-5" />}
          title="First-Aid Measures"
          content={chemical.firstAidMeasures}
        />
        <EmergencyProcedure
          number="5"
          icon={<Flame className="h-5 w-5" />}
          title="Firefighting Measures"
          content={chemical.firefightingMeasures}
        />
        <EmergencyProcedure
          number="6"
          icon={<Droplets className="h-5 w-5" />}
          title="Spill / Accidental Release"
          content={chemical.accidentalReleaseMeasures}
        />

        {/* Required PPE */}
        <section className="rounded-2xl border-2 border-navy-300 bg-white/95 p-5 backdrop-blur-sm dark:border-navy-700">
          <h2 className="mb-3.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-navy-700 dark:text-navy-300">
            <HardHat className="h-4 w-4 text-navy-600 dark:text-navy-300" />
            Required Personal Protective Equipment
          </h2>
          <PpeList items={chemical.personalProtectiveEquipment} />
          <RegulatoryTags tags={chemical.regulatoryTags} />
        </section>

        {/* Emergency contact — huge, prominent */}
        <section className="rounded-2xl border-2 border-red-500 bg-red-50/95 p-5 backdrop-blur-sm">
          <h2 className="mb-2 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-red-700">
            <Phone className="h-4 w-4" />
            Emergency Contact
          </h2>
          <div className="flex flex-wrap items-center gap-4">
            <p className="text-2xl font-bold text-red-900 dark:text-red-100">
              {chemical.emergencyContact}
            </p>
            <div className="flex items-center gap-2 text-[11px] uppercase tracking-wider text-red-700/80 dark:text-red-300/80">
              <span>PPE</span>
              <PpeList items={chemical.personalProtectiveEquipment} iconsOnly />
            </div>
          </div>
        </section>

        {/* Hotlines + designated contacts — big tap targets */}
        <section className="rounded-2xl border border-white/15 bg-white/95 p-5 backdrop-blur-sm">
          <h2 className="mb-3.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
            <Phone className="h-4 w-4 text-mirdc-cyan" />
            Emergency Contacts
          </h2>
          <div className="space-y-2.5">
            {EMERGENCY_HOTLINES.map((c) => (
              <a
                key={c.role}
                href={`tel:${(c.phone ?? "").replace(/\s+/g, "")}`}
                className="group flex items-center justify-between gap-3 rounded-xl border border-mirdc-cyan/30 bg-mirdc-cyan/5 p-3 transition-colors hover:bg-mirdc-cyan/10"
              >
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{c.role}</div>
                  <div className="text-xs text-muted-foreground">{c.name}</div>
                </div>
                <span className="flex items-center gap-2 font-mono text-sm font-bold text-mirdc-cyan">
                  {c.phone}
                  <Phone className="h-3.5 w-3.5" />
                </span>
              </a>
            ))}

            <div className="space-y-1.5 border-t border-border/50 pt-2.5">
              {EMERGENCY_CONTACTS.map((c) => (
                <div
                  key={c.role}
                  className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5"
                >
                  <span className="text-sm">
                    <span className="font-semibold">{c.role}</span>
                    <span className="text-muted-foreground"> — {c.name}</span>
                  </span>
                  {c.phone ? (
                    <a
                      href={`tel:${c.phone.replace(/\s+/g, "")}`}
                      className="font-mono text-sm font-semibold text-mirdc-cyan hover:underline"
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
        </section>

        {/* Offline notice */}
        <div className="flex items-center justify-center gap-2 pb-6 text-xs text-red-100/80">
          <WifiOff className="h-3.5 w-3.5" />
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
    <div className="rounded-xl border border-white/15 bg-white/10 px-3.5 py-2.5 backdrop-blur-sm">
      <div className="text-[10px] font-bold uppercase tracking-wider text-red-100/80">
        {label}
      </div>
      <div
        className={cn(
          "mt-0.5 text-sm font-bold text-white",
          mono && "font-mono",
          danger && "text-amber-300"
        )}
      >
        {value}
      </div>
    </div>
  );
}

function EmergencyProcedure({
  number,
  icon,
  title,
  content,
}: {
  number: string;
  icon: React.ReactNode;
  title: string;
  content: string;
}) {
  return (
    <section className="overflow-hidden rounded-2xl border-2 border-red-400/60 bg-white/95 backdrop-blur-sm">
      <header className="flex items-center gap-3 border-b-2 border-red-400/40 bg-red-600 px-5 py-3.5">
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-lg font-bold text-red-700 shadow-lg">
          {number}
        </span>
        <span className="text-white">{icon}</span>
        <h2 className="text-lg font-bold text-white">{title}</h2>
      </header>
      <div className="p-5">
        <p className="whitespace-pre-line text-sm leading-relaxed text-foreground sm:text-base">
          {content}
        </p>
      </div>
    </section>
  );
}