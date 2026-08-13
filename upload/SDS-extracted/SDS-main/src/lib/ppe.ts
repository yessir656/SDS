// ============================================================================
// PPE helpers
// ----------------------------------------------------------------------------
// PPE is stored as a JSON-encoded string[] in the DB (one short phrase per
// item, e.g. "Nitrile gloves (powder-free)"). These helpers turn that raw data
// into normalized { code, label, note } objects so the UI can render an inline
// icon per item plus an optional note badge.
//
// Why normalize at render time instead of storing structured PPE?
//   - Keeps full backwards compatibility: legacy seed data, AI-extracted data,
//     and the admin textarea all keep working unchanged.
//   - A single normalization boundary guarantees every consumer sees the same
//     { code, label, note } shape.
// ============================================================================

import type { PpeCode, PpeItem } from "@/types";

// Map a canonical keyword to a PPE icon code. Order matters: more specific
// tokens are checked first (e.g. "powder-free" must win over plain "gloves").
const PPE_CODE_KEYWORDS: ReadonlyArray<readonly [PpeCode, string[]]> = [
  ["gloves-powderfree", ["powder-free", "powder free", "powder-free nitrile", "powder free nitrile"]],
  ["gloves", ["glove", "nitrile", "neoprene", "latex glove"]],
  ["goggles", ["goggle", "safety goggle"]],
  ["face-shield", ["face shield", "faceshield"]],
  ["respirator", ["respirator", "n95", "n99", "p100", "cartridge"]],
  ["mask", ["mask", "surgical mask", "dust mask"]],
  ["lab-coat", ["lab coat", "labcoat"]],
  ["apron", ["apron", "bib"]],
  ["boots", ["boot", "shoe", "sneaker"]],
  ["coverall", ["coverall", "boiler suit", "hazmat suit"]],
  ["hearing", ["hearing", "earplug", "ear muff", "ear-muff"]],
];

/**
 * Derive the canonical PPE code from a label string.
 * Falls back to "other" when no keyword matches.
 */
export function detectPpeCode(label: string): PpeCode {
  const hay = label.toLowerCase();
  for (const [code, keywords] of PPE_CODE_KEYWORDS) {
    for (const kw of keywords) {
      if (hay.includes(kw)) return code;
    }
  }
  return "other";
}

/**
 * Parse a single PPE line ("Label" or "Label (note)") into a PpeItem.
 * The note is whatever was wrapped in parentheses.
 */
export function parsePpeText(line: string): PpeItem {
  const trimmed = line.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return { code: "other", label: "" };
  }
  // Split "Nitrile gloves (powder-free)" → label "Nitrile gloves", note "powder-free"
  const m = /^(.+?)\s*\(([^)]*)\)\s*$/.exec(trimmed);
  if (m) {
    const label = m[1].trim();
    return {
      code: detectPpeCode(label),
      label,
      note: m[2].trim(),
    };
  }
  return { code: detectPpeCode(trimmed), label: trimmed };
}

/**
 * Normalize the stored PPE value into a canonical PpeItem[] array.
 * Accepts any shape we might encounter:
 *   - PpeItem[]           (already normalized) -> returned as-is
 *   - string[]            -> each line parsed via parsePpeText
 *   - string              -> parsed as a single line
 *   - undefined/null      -> []
 */
export function normalizePpe(input: unknown): PpeItem[] {
  if (input == null) return [];

  if (typeof input === "string") {
    return input
      .split("\n")
      .map(parsePpeText)
      .filter((p) => p.label.length > 0);
  }

  if (Array.isArray(input)) {
    return input
      .map((item) => {
        if (item == null) return null;
        // Already a normalized object with a code we recognize.
        if (
          typeof item === "object" &&
          !Array.isArray(item) &&
          "code" in item
        ) {
          return item as PpeItem;
        }
        // Plain string entry.
        if (typeof item === "string") return parsePpeText(item);
        return null;
      })
      .filter((p): p is PpeItem => p !== null && p.label.length > 0);
  }

  return [];
}
