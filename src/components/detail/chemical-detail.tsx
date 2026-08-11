"use client";

// ============================================================================
// ChemicalDetail — full detail view for a selected chemical
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
  Clock,
  Phone,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { GhsPictogramBadge } from "@/components/ghs/pictograms";
import { useAppStore } from "@/store/app-store";
import { GHS_PICTOGRAM_INFO, HAZARD_CLASS_LABELS } from "@/types";
import { cn } from "@/lib/utils";

export function ChemicalDetail() {
  const chemical = useAppStore((s) => s.selectedChemical);
  const goCatalog = useAppStore((s) => s.goCatalog);
  const goToEmergency = useAppStore((s) => s.goToEmergency);

  if (!chemical) {
    // Safety fallback — should never happen, but if it does, return to catalog.
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
    <div className="space-y-5">
      {/* Top bar: back + emergency CTA */}
      <div className="flex items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={goCatalog}
          className="gap-1"
        >
          <ArrowLeft className="h-4 w-4" />
          Catalog
        </Button>

        <Button
          onClick={() => goToEmergency(chemical)}
          className="gap-2 bg-red-600 text-white hover:bg-red-700"
          size="lg"
        >
          <ShieldAlert className="h-5 w-5" />
          Emergency Info
        </Button>
      </div>

      {/* Header card: identifiers */}
      <Card className={cn("overflow-hidden", isDanger && "border-l-4 border-l-red-500", !isDanger && "border-l-4 border-l-amber-400")}>
        <CardContent className="p-5 sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold tracking-tight text-foreground">
                  {chemical.chemicalName}
                </h1>
                <Badge
                  variant="outline"
                  className={cn(
                    "text-xs font-bold uppercase",
                    isDanger
                      ? "border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
                      : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  )}
                >
                  {chemical.signalWord}
                </Badge>
              </div>
              {chemical.tradeName && chemical.tradeName !== chemical.chemicalName && (
                <p className="text-sm text-muted-foreground">
                  Also known as: <span className="font-medium">{chemical.tradeName}</span>
                </p>
              )}
              <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1 text-sm">
                <span className="flex items-center gap-1">
                  <span className="text-muted-foreground">CAS:</span>
                  <span className="font-mono font-medium">{chemical.casNumber}</span>
                </span>
                <span className="flex items-center gap-1">
                  <span className="text-muted-foreground">Formula:</span>
                  <span className="font-mono font-medium">{chemical.formula}</span>
                </span>
              </div>
            </div>

            {/* Version + last updated */}
            <div className="flex gap-4 text-xs text-muted-foreground lg:flex-col lg:items-end lg:gap-1">
              <span className="flex items-center gap-1">
                <Tag className="h-3 w-3" />
                v{chemical.version}
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                Updated {lastUpdated}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* Left column: GHS + hazards + PPE */}
        <div className="space-y-4 lg:col-span-2">
          {/* GHS pictograms */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <ShieldAlert className="h-4 w-4 text-red-600" />
                GHS Hazard Pictograms
              </CardTitle>
            </CardHeader>
            <CardContent>
              {chemical.ghsPictograms.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No GHS pictograms assigned.
                </p>
              ) : (
                <div className="flex flex-wrap gap-4">
                  {chemical.ghsPictograms.map((p) => (
                    <GhsPictogramBadge
                      key={p}
                      pictogram={p}
                      size={64}
                      className="w-20"
                    />
                  ))}
                </div>
              )}

              <Separator className="my-4" />

              {/* Hazard classes */}
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Hazard Classification
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {chemical.hazardClasses.map((hc) => (
                  <Badge
                    key={hc}
                    variant="secondary"
                    className="text-xs"
                  >
                    {HAZARD_CLASS_LABELS[hc]}
                  </Badge>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* SDS sections quick reference */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-4 w-4 text-teal-600" />
                SDS Section Quick-Reference
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion type="single" collapsible className="w-full">
                {/* Emergency-critical sections first */}
                <AccordionItem
                  value="sec-4"
                  className="overflow-hidden rounded-md border border-red-200 bg-red-50/50 px-3 dark:border-red-900 dark:bg-red-950/20"
                >
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded bg-red-600 text-xs font-bold text-white">
                        4
                      </span>
                      <span className="font-medium">First-Aid Measures</span>
                      <Badge variant="outline" className="ml-1 border-red-300 text-[10px] text-red-700 dark:border-red-700 dark:text-red-300">
                        EMERGENCY
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="whitespace-pre-line pt-2 text-sm leading-relaxed text-foreground/90">
                    {chemical.firstAidMeasures}
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem
                  value="sec-5"
                  className="mt-2 overflow-hidden rounded-md border border-red-200 bg-red-50/50 px-3 dark:border-red-900 dark:bg-red-950/20"
                >
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded bg-red-600 text-xs font-bold text-white">
                        5
                      </span>
                      <span className="font-medium">Firefighting Measures</span>
                      <Badge variant="outline" className="ml-1 border-red-300 text-[10px] text-red-700 dark:border-red-700 dark:text-red-300">
                        EMERGENCY
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="whitespace-pre-line pt-2 text-sm leading-relaxed text-foreground/90">
                    {chemical.firefightingMeasures}
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem
                  value="sec-6"
                  className="mt-2 overflow-hidden rounded-md border border-red-200 bg-red-50/50 px-3 dark:border-red-900 dark:bg-red-950/20"
                >
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-2">
                      <span className="flex h-6 w-6 items-center justify-center rounded bg-red-600 text-xs font-bold text-white">
                        6
                      </span>
                      <span className="font-medium">Accidental Release (Spill) Measures</span>
                      <Badge variant="outline" className="ml-1 border-red-300 text-[10px] text-red-700 dark:border-red-700 dark:text-red-300">
                        EMERGENCY
                      </Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent className="whitespace-pre-line pt-2 text-sm leading-relaxed text-foreground/90">
                    {chemical.accidentalReleaseMeasures}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>
        </div>

        {/* Right column: identifiers + storage + PPE + contact */}
        <div className="space-y-4">
          {/* Identifiers */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Identifiers</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              <DetailRow
                icon={<Factory className="h-3.5 w-3.5" />}
                label="Manufacturer"
                value={chemical.manufacturer}
              />
              <DetailRow
                icon={<Truck className="h-3.5 w-3.5" />}
                label="Supplier"
                value={chemical.supplier}
              />
              <DetailRow
                icon={<FileText className="h-3.5 w-3.5" />}
                label="SDS Document"
                value={chemical.sdsDocumentId}
                mono
              />
            </CardContent>
          </Card>

          {/* Storage */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Storage &amp; Department</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5 text-sm">
              <DetailRow
                icon={<MapPin className="h-3.5 w-3.5" />}
                label="Location"
                value={chemical.storageLocation}
              />
              <DetailRow
                icon={<Building2 className="h-3.5 w-3.5" />}
                label="Department"
                value={chemical.department}
              />
            </CardContent>
          </Card>

          {/* PPE */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <HardHat className="h-4 w-4 text-teal-600" />
                Required PPE
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1.5">
                {chemical.personalProtectiveEquipment.map((ppe, idx) => (
                  <li
                    key={idx}
                    className="flex items-start gap-2 text-sm"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600" />
                    <span>{ppe}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          {/* Emergency contact */}
          <Card className="border-red-200 dark:border-red-900">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-600 text-white">
                  <Phone className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <div className="text-xs font-semibold uppercase tracking-wide text-red-600 dark:text-red-400">
                    Emergency Contact
                  </div>
                  <p className="mt-0.5 text-sm font-medium leading-snug">
                    {chemical.emergencyContact}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Safety instructions */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <Clock className="h-4 w-4 text-teal-600" />
            Safety Instructions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed text-foreground/90">
            {chemical.safetyInstructions}
          </p>
        </CardContent>
      </Card>

      {/* Bottom emergency CTA (mobile-friendly) */}
      <div className="flex justify-center pb-4">
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

// ---------------------------------------------------------------------------

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
    <div className="flex items-start gap-2">
      <span className="mt-0.5 text-muted-foreground">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={cn("font-medium", mono && "font-mono text-xs")}>
          {value}
        </div>
      </div>
    </div>
  );
}
