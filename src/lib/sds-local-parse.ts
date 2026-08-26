// ============================================================================
// sds-local-parse.ts — Local (zero-AI) field extraction from SDS text.
// ============================================================================
//
// Takes raw text (embedded-text extraction or OCR) from an SDS document and
// parses out the same structured fields the AI path returns — using only
// deterministic string heuristics. GHS SDS documents follow a standardized
// 16-section layout, which makes this surprisingly tractable:
//
//   Section 1  Identification        → name, trade name, manufacturer/supplier,
//                                      emergency contact
//   Section 2  Hazards               → signal word, pictograms, hazard classes
//   Section 3  Composition           → CAS number, formula
//   Section 4  First aid             → firstAidMeasures
//   Section 5  Firefighting          → firefightingMeasures
//   Section 6  Accidental release    → accidentalReleaseMeasures
//   Section 7  Handling & storage    → storageLocation, safetyInstructions
//   Section 8  Exposure controls     → personalProtectiveEquipment
//
// Accuracy is intentionally conservative: when a field cannot be located with
// confidence we return "" / [] rather than guessing. The admin always reviews
// the auto-filled form before saving.
// ============================================================================

import type {
  GhsPictogram,
  HazardClass,
} from "@/types";

export interface ParsedSdsFields {
  chemicalName: string;
  casNumber: string;
  formula: string;
  tradeName: string;
  manufacturer: string;
  supplier: string;
  signalWord: "" | "danger" | "warning";
  ghsPictograms: GhsPictogram[];
  hazardClasses: HazardClass[];
  storageLocation: string;
  safetyInstructions: string;
  emergencyContact: string;
  personalProtectiveEquipment: string[];
  firstAidMeasures: string;
  firefightingMeasures: string;
  accidentalReleaseMeasures: string;
}

/** Max characters kept for long free-text sections (form textarea sanity). */
const SECTION_TEXT_CAP = 1600;

/** Score how much useful data a parse produced — drives the AI fallback gate. */
export function scoreParse(fields: ParsedSdsFields): number {
  let score = 0;
  if (fields.chemicalName) score++;
  if (fields.casNumber) score++;
  if (
    fields.firstAidMeasures ||
    fields.firefightingMeasures ||
    fields.accidentalReleaseMeasures
  )
    score++;
  if (fields.personalProtectiveEquipment.length > 0) score++;
  if (fields.ghsPictograms.length > 0 || fields.hazardClasses.length > 0) score++;
  return score;
}

// ---------------------------------------------------------------------------
// Text normalization + section splitting
// ---------------------------------------------------------------------------

function normalize(raw: string): string {
  return raw
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

interface SectionSpan {
  id: number;
  start: number;
  end: number;
}

/**
 * Canonical GHS section titles matched by KEYWORD rather than by generic
 * numbered-header shape. Real-world OCR mangles numbering/case ("1.",
 * "l.", lowercase titles, missing punctuation), but the title words survive.
 * Case-insensitive on purpose; false-positive risk is low because these are
 * distinctive multi-word safety-document phrases.
 */
const SECTION_TITLE_PATTERNS: Array<[number, RegExp]> = [
  [1, /\b(?:product|chemical)\s*(?:name)?\s*(?:&|and)?\s*(?:company|supplier)?\s*identificat(?:ion)?\b|\bidentificat(?:ion)?\s+of\s+the\s+(?:substance|chemical|mixture|company)/i],
  [2, /\bhazards?\s+(?:identification|classification)\b/i],
  [3, /\bcomposition\s*\/?\s*(?:information\s+on\s+)?ingredients?\b|\bcomposition\b/i],
  [4, /\bfirst[\s\-]?aid\b/i],
  [5, /\bfire[\s\-]?fighting\b/i],
  [6, /\baccidental\s+release\b/i],
  [7, /\bhandling\s+(?:and|&)\s+storage\b/i],
  [8, /\bexposure\s+controls?\b/i],
  [9, /\bphysical\s+(?:and\s+chemical\s+)?(?:&\s*)?properties\b|\bphysicochemical\s+properties\b/i],
  [10, /\bstability\s+(?:and|&)\s+reactivity\b/i],
  [11, /\btoxicological\b/i],
  [12, /\becological\b/i],
  [13, /\bdisposal\s+considerations?\b/i],
  [14, /\btransport(?:ation)?\s+information\b/i],
  [15, /\bregulatory\s+information\b/i],
  [16, /\bother\s+information\b(?=.*\binclud\w*\s+information\s+on\s+revision|\s*$)|\bother\s+information\b/i],
];

/**
 * Locate the standard GHS sections in normalized text. Each section runs from
 * its header to the next recognized header (by position).
 */
function findSections(text: string): Map<number, SectionSpan> {
  const hits: { num: number; index: number }[] = [];

  for (const [num, re] of SECTION_TITLE_PATTERNS) {
    const m = text.match(re);
    if (m && m.index !== undefined) {
      hits.push({ num, index: m.index });
    }
  }

  // One span per section number, ordered by position in the document.
  const seen = new Set<number>();
  const ordered = hits.filter((h) => {
    if (seen.has(h.num)) return false;
    seen.add(h.num);
    return true;
  });
  ordered.sort((a, b) => a.index - b.index);

  const spans = new Map<number, SectionSpan>();
  for (let i = 0; i < ordered.length; i++) {
    const cur = ordered[i];
    const next = ordered[i + 1];
    spans.set(cur.num, {
      id: cur.num,
      start: cur.index,
      // Cap runaway spans when later sections weren't recognized.
      end: next ? next.index : Math.min(cur.index + 6000, text.length),
    });
  }
  return spans;
}

function sectionText(spans: Map<number, SectionSpan>, id: number, all: string): string {
  const span = spans.get(id);
  if (!span) return "";
  return all.slice(span.start, span.end).trim();
}

// ---------------------------------------------------------------------------
// Field helpers
// ---------------------------------------------------------------------------

function matchLabel(text: string, patterns: RegExp[]): string {
  for (const re of patterns) {
    const m = text.match(re);
    if (m?.[1]) return cleanValue(m[1]);
  }
  return "";
}

/** Trim label-match residue and cap length. */
function cleanValue(v: string, max = 120): string {
  return v
    .split("\n")[0]
    .replace(/[:;,.]+\s*$/, "")
    .trim()
    .slice(0, max)
    .trim();
}

const CAS_RE = /\b(\d{2,7}-\d{2}-\d)\b/;

function findCas(text: string): string {
  const m = text.match(CAS_RE);
  return m ? m[1] : "";
}

// ---------------------------------------------------------------------------
// GHS mappings
// ---------------------------------------------------------------------------

/** GHS pictogram codes/names → our pictogram IDs. */
const PICTOGRAM_PATTERNS: [RegExp, GhsPictogram][] = [
  [/ghs\s*0?6\b|exploding\s*bomb/i, "exploding-bomb"],
  [/flame\s*over\s*circle|flame\s*(?:over|on)\s*(?:a\s*)?circle|oxidiz(?:er|ing)\s*(?:pictogram|symbol)/i, "flame-on-circle"],
  [/\bflame\b(?!.*circle)|flammable\s*(?:pictogram|symbol)/i, "flame"],
  [/gas\s*cylinder|compressed\s*gas\s*(?:pictogram|symbol)/i, "gas"],
  [/\bcorrosion\b/i, "corrosion"],
  [/skull\s*(?:and|\+)\s*crossbones|toxicity\s*pictogram/i, "skull-and-crossbones"],
  [/exclamation\s*mark/i, "exclamation-mark"],
  [/health\s*hazard/i, "health-hazard"],
  [/\benvironment\b(?=.*(?:pictogram|hazard\s*symbol))|aquatic\s*(?:pictogram|symbol)/i, "environment"],
];

/**
 * H-statements → our hazard class IDs. Ranges follow the official GHS H-code
 * numbering; only classes our enum supports are mapped.
 */
const H_CODE_RANGES: [number, number, HazardClass][] = [
  [200, 205, "explosive"],
  [240, 242, "explosive"],
  [220, 228, "flammable"],
  [250, 252, "flammable"],
  [270, 273, "oxidizing"],
  [280, 284, "compressed-gas"],
  [290, 290, "corrosive"],
  [314, 314, "corrosive"],
  [318, 318, "corrosive"],
  [300, 301, "toxic"],
  [310, 311, "toxic"],
  [330, 331, "toxic"],
  [340, 340, "toxic"],
  [302, 302, "harmful"],
  [312, 312, "harmful"],
  [332, 332, "harmful"],
  [315, 315, "irritant"],
  [319, 319, "irritant"],
  [335, 335, "irritant"],
  [317, 317, "sensitizer"],
  [334, 334, "sensitizer"],
  [350, 351, "carcinogen"],
  [360, 361, "reproductive-toxicant"],
  [370, 373, "specific-target-organ-toxicity"],
  [336, 336, "specific-target-organ-toxicity"],
  [304, 304, "specific-target-organ-toxicity"],
  [400, 400, "environmentally-hazardous"],
  [410, 411, "environmentally-hazardous"],
  [420, 420, "environmentally-hazardous"],
];

function hCodeToClass(code: number): HazardClass | null {
  for (const [lo, hi, cls] of H_CODE_RANGES) {
    if (code >= lo && code <= hi) return cls;
  }
  return null;
}

/** Keyword fallbacks used when no H-codes are present in Section 2. */
const HAZARD_KEYWORDS: [RegExp, HazardClass][] = [
  [/explosiv/i, "explosive"],
  [/(?:extremely|highly)?\s*flammable|pyrophoric/i, "flammable"],
  [/oxidiz/i, "oxidizing"],
  [/compressed|liquefied\s*gas|dissolved\s*gas|refrigerated\s*liquefied/i, "compressed-gas"],
  [/skin\s*corrosion|serious\s*eye\s*damage/i, "corrosive"],
  [/fatal\s*(?:if\s*)?(?:swallowed|inhaled|in\s*contact)|acute\s*toxicity\s*(?:category\s*)?[12]\b/i, "toxic"],
  [/harmful\s*(?:if\s*)?(?:swallowed|inhaled|in\s*contact)/i, "harmful"],
  [/skin\s*irritation|eye\s*irritation|respiratory\s*irritation|stot\s*se\s*3/i, "irritant"],
  [/(?:skin\s*)?sensitiz|respiratory\s*sensitization/i, "sensitizer"],
  [/carcinogen/i, "carcinogen"],
  [/reproductive\s*toxicity|germ\s*cell/i, "reproductive-toxicant"],
  [/specific\s*target\s*organ|aspiration\s*hazard/i, "specific-target-organ-toxicity"],
  [/hazardous\s*to\s*the\s*aquatic|aquatic\s*(?:acute|chronic)/i, "environmentally-hazardous"],
];

// ---------------------------------------------------------------------------
// PPE keyword extraction (Section 8)
// ---------------------------------------------------------------------------

const PPE_KEYWORD_RE =
  /(goggles|face\s*shield|gloves|lab\s*coat|apron|respirator|boots|closed[- ]toe|shoes|coverall|helmet|face\s*mask|safety\s* glasses)/i;

function extractPpe(sectionText: string): string[] {
  if (!sectionText) return [];
  const items = new Set<string>();

  // Split into sentence/line candidates and keep those mentioning PPE gear.
  const candidates = sectionText.split(/(?<=[.;])\s+|\n+/);
  for (const raw of candidates) {
    const line = raw.trim().replace(/^[-•*\d.)\s]+/, "").trim();
    if (line.length < 4 || line.length > 140) continue;
    if (PPE_KEYWORD_RE.test(line)) {
      items.add(cleanValue(line, 140));
    }
    if (items.size >= 10) break;
  }

  // Common shorthand normalization for the most frequent items.
  const out: string[] = [];
  for (const item of items) {
    out.push(
      item
        .replace(/^use\s+/i, "")
        .replace(/^wear\s+/i, "Wear ")
        .replace(/^\w/, (c) => c.toUpperCase())
    );
  }
  return out.slice(0, 8);
}

// ---------------------------------------------------------------------------
// Main parser
// ---------------------------------------------------------------------------

export function parseSdsText(pages: string[]): ParsedSdsFields {
  const all = normalize(pages.join("\n\n"));
  const spans = findSections(all);

  const sec1 = sectionText(spans, 1, all);
  const sec2 = sectionText(spans, 2, all);
  const sec3 = sectionText(spans, 3, all);
  const sec4 = sectionText(spans, 4, all);
  const sec5 = sectionText(spans, 5, all);
  const sec6 = sectionText(spans, 6, all);
  const sec7 = sectionText(spans, 7, all);
  const sec8 = sectionText(spans, 8, all);
  const sec9 = sectionText(spans, 9, all);
  const sec16 = sectionText(spans, 16, all);

  // --- Identification -------------------------------------------------------
  // NOTE: real-world OCR frequently drops colons ("Product Name Acetone"), so
  // label separators are optional. Identity labels are LINE-ANCHORED: the word
  // "supplier" appearing mid-sentence ("...from the supplier of the safety
  // data sheet", seen on a real Fisher scan) must not be mistaken for a
  // labeled value. Leading non-word junk (spaces, bullets) is tolerated.
  const lineLabel = (body: string): RegExp =>
    new RegExp(`^[^\\w\\n]*${body}\\s*(?:name)?\\s*[:\\-]?\\s+([^\\n]+)`, "im");

  const nameScope = sec1 || all.slice(0, 1500);
  const chemicalName = matchLabel(nameScope, [
    lineLabel("product\\s*(?:name|identifier)"),
    lineLabel("chemical\\s*name"),
    lineLabel("substance"),
  ]);
  const tradeName =
    matchLabel(nameScope, [
      lineLabel("trade\\s*name"),
      lineLabel("synonyms?"),
    ]) === chemicalName
      ? ""
      : matchLabel(nameScope, [
          lineLabel("trade\\s*name"),
          lineLabel("synonyms?"),
        ]);

  const manufacturer = matchLabel(nameScope, [
    lineLabel("manufacturer"),
    lineLabel("company"),
  ]);
  const supplier = matchLabel(nameScope, [
    lineLabel("supplier"),
    lineLabel("distributor"),
  ]);

  // Emergency contact: labeled line preferred, else first phone-like token in
  // Sections 1 / 16. CHEMTREC / 24-hour patterns cover common vendor formats
  // (Fisher, Sigma-Aldrich) that don't use a simple "Emergency telephone:" label.
  let emergencyContact = matchLabel(sec1 || all.slice(0, 2000), [
    /\bemergency\s*(?:phone|contact|number|telephone|call)?\s*[:\-]?\s*([^\n]*\d[^\n]*)/i,
    /\bpoison\s*(?:control|center)[^\n]*?([+\d][\d\s().\-]{7,}\d)/i,
    /\bchemtrec\b[^\n\d]{0,60}?((?:\+?\d[\d\s().-]{7,})\d)/i,
    /\b(?:24\s*)?hours?\s+emergency[^\n\d]{0,40}?((?:\+?\d[\d\s().-]{7,})\d)/i,
  ]);
  if (!emergencyContact) {
    const scope = `${sec1}\n${sec16}`;
    const phoneMatch = scope.match(/[+()]?\d[\d\s().\-]{7,}\d/);
    emergencyContact = phoneMatch ? cleanValue(phoneMatch[0], 60) : "";
  }

  // --- Hazards (Section 2) ---------------------------------------------------
  // When Section 2's header wasn't recognized in the OCR text, fall back to
  // the FIRST ~2500 chars rather than the whole document: GHS puts hazard
  // info up front, and scanning everything drags in other products' H-codes
  // from Sections 3/11 (e.g. impurity classifications) as false positives.
  const hazardScope = sec2 || all.slice(0, 2500);
  let signalWord: ParsedSdsFields["signalWord"] = "";
  // Prefer exact standalone uppercase words (the GHS convention), then any case.
  if (/\bDANGER\b/.test(hazardScope)) signalWord = "danger";
  else if (/\bWARNING\b/.test(hazardScope)) signalWord = "warning";
  else if (/\bdanger\b/i.test(hazardScope)) signalWord = "danger";
  else if (/\bwarning\b/i.test(hazardScope)) signalWord = "warning";

  const ghsPictograms: GhsPictogram[] = [];
  for (const [re, id] of PICTOGRAM_PATTERNS) {
    if (re.test(hazardScope) && !ghsPictograms.includes(id)) {
      ghsPictograms.push(id);
    }
  }

  const hazardClasses: HazardClass[] = [];
  const hCodes = new Set(
    Array.from(hazardScope.matchAll(/\bH(?:2|3|4)\d\d\b/g)).map((m) =>
      parseInt(m[0].slice(1), 10)
    )
  );
  for (const code of hCodes) {
    const cls = hCodeToClass(code);
    if (cls && !hazardClasses.includes(cls)) hazardClasses.push(cls);
  }
  // Keyword fallback only when the document lists no H-statements at all.
  if (hCodes.size === 0) {
    for (const [re, cls] of HAZARD_KEYWORDS) {
      if (re.test(hazardScope) && !hazardClasses.includes(cls)) {
        hazardClasses.push(cls);
      }
    }
  }

  // --- Composition (Section 3, then 1, then 9, then anywhere) ---------------
  // OCR often mangles section boundaries; the whole-text fallback ensures a
  // clearly-formatted CAS number is still found (format is distinctive enough
  // that false positives are rare).
  const casNumber = findCas(sec3) || findCas(sec1) || findCas(sec9) || findCas(all);
  const formula = matchLabel(`${sec3}\n${sec9}`, [
    /\bmolecular\s*formula\s*[:\-]?\s*([A-Za-z0-9()[\]·.\-\s]{1,40})/i,
    /\bchemical\s*formula\s*[:\-]?\s*([A-Za-z0-9()[\]·.\-\s]{1,40})/,
    /\bformula\s*[:\-]?\s*([A-Za-z0-9()[\]·.\-\s]{1,40})\b/i,
  ]).trim();

  // --- Free-text sections ----------------------------------------------------
  const stripHeader = (t: string) => t.replace(/^[^\n]{0,80}\n/, "");
  const firstAidMeasures = capText(stripHeader(sec4));
  const firefightingMeasures = capText(stripHeader(sec5));
  const accidentalReleaseMeasures = capText(stripHeader(sec6));

  // Storage vs handling split within Section 7. Prefer an explicit
  // "Storage:" label; fall back to the first sentence mentioning storage.
  let storageLocation = "";
  let safetyInstructions = "";
  if (sec7) {
    storageLocation = matchLabel(sec7, [
      /\bstorage\s*[:\-]\s*([^\n]{4,120})/i,
      /\bstore[ds]?\b[^\n.]{0,80}?(?:in|at)\s+([^\n.]{4,90})/i,
    ]);
    safetyInstructions = capText(stripHeader(sec7));
  }

  const personalProtectiveEquipment = extractPpe(sec8);

  return {
    chemicalName,
    casNumber,
    formula,
    tradeName,
    manufacturer,
    supplier,
    signalWord,
    ghsPictograms,
    hazardClasses,
    storageLocation,
    safetyInstructions,
    emergencyContact,
    personalProtectiveEquipment,
    firstAidMeasures,
    firefightingMeasures,
    accidentalReleaseMeasures,
  };
}

/** Collapse whitespace and cap a section's length at SECTION_TEXT_CAP chars. */
function capText(t: string, max = SECTION_TEXT_CAP): string {
  return t.replace(/\s+\n/g, "\n").trim().slice(0, max).trim();
}
