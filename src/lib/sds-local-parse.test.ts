/// <reference types="bun-types" />
// ============================================================================
// sds-local-parse.test.ts — spec for the zero-AI SDS field extractor.
//
// Seams under test (agreed):
//   1. parseSdsText(pages: string[]) -> ParsedSdsFields
//   2. scoreParse(fields)            -> 0..5 quality gate
//
// Fixtures encode REAL document shapes: a clean digital GHS SDS, and (later)
// the noisy OCR text observed from an actual Fisher Scientific scan.
// ============================================================================

import { describe, test, expect } from "bun:test";
import { parseSdsText, scoreParse } from "./sds-local-parse";

// A clean, digitally-generated SDS (colon labels, uppercase section headers).
const CANONICAL_DIGITAL_SDS = [
  `SAFETY DATA SHEET
Revision Date: 15-Mar-2026     Version 2.1

SECTION 1: IDENTIFICATION OF THE SUBSTANCE AND OF THE COMPANY
Product Name: Acetone Technical Grade
Trade name: Propan-2-one
CAS-No: 67-64-1
Manufacturer: RCI Labscan Limited
Supplier: VWR International B.V.
Emergency telephone: +63 2 8837 0713

SECTION 2: HAZARDS IDENTIFICATION
DANGER
H225 Highly flammable liquid and vapour.
H319 Causes serious eye irritation.
H336 May cause drowsiness or dizziness.
GHS02 Flame
GHS07 Exclamation mark

SECTION 3: COMPOSITION / INFORMATION ON INGREDIENTS
Chemical name: acetone
Molecular Formula: C3H6O`,
  `SECTION 4: FIRST AID MEASURES
Eye contact: Rinse immediately with plenty of water for 15 minutes.
Skin contact: Wash off with soap and plenty of water.
Inhalation: Move to fresh air. If breathing is difficult give oxygen.

SECTION 5: FIREFIGHTING MEASURES
Suitable extinguishing media: Use dry chemical, CO2, alcohol-resistant foam.
Wear self-contained breathing apparatus when fighting fires.

SECTION 6: ACCIDENTAL RELEASE MEASURES
Eliminate all ignition sources. Absorb spill with inert material and
place in suitable chemical waste container. Prevent entry into drains.

SECTION 7: HANDLING AND STORAGE
Handling: Use only in a well-ventilated fume hood away from ignition sources.
Storage: Flammables cabinet A, keep container tightly closed in a cool dry place.

SECTION 8: EXPOSURE CONTROLS AND PERSONAL PROTECTION
Chemical splash goggles are required at all times during handling.
Nitrile gloves 8 mil minimum must be worn.
Flame-resistant lab coat and closed-toe chemical-resistant shoes required.`,
];

describe("parseSdsText — canonical digital SDS", () => {
  const fields = parseSdsText(CANONICAL_DIGITAL_SDS);

  test("extracts the product identity from Section 1 labels", () => {
    expect(fields.chemicalName).toBe("Acetone Technical Grade");
    expect(fields.casNumber).toBe("67-64-1");
    expect(fields.tradeName).toBe("Propan-2-one");
  });
});

describe("parseSdsText — noisy real-world OCR text", () => {
  test("does not capture 'supplier' when the word appears mid-sentence", () => {
    // Observed live on the Fisher Scientific scan: prose like
    // "...from the supplier of the safety data sheet" appears BEFORE the
    // real labeled line, and the old regex matched the prose first.
    const fields = parseSdsText([
      `SECTION 1: IDENTIFICATION
Product Name: Methanol
For further information, obtain an SDS from the supplier of the safety data sheet.
Manufacturer: Merck
Supplier: Sigma-Aldrich`,
    ]);
    expect(fields.supplier).toBe("Sigma-Aldrich");
    expect(fields.manufacturer).toBe("Merck");
  });

  test("does not mistake calendar dates for CAS numbers", () => {
    // CAS format (NNN-NN-N) is close enough to date fragments that a naive
    // scan could match. A document whose only dash-groups are dates must
    // yield an empty CAS rather than a bogus one.
    const fields = parseSdsText([
      `SECTION 1: IDENTIFICATION
Product Name: Sodium Chloride
Revision Date: 2026-08-24
Created: 14-Oct-2009`,
    ]);
    expect(fields.casNumber).toBe("");
  });

  test("extracts identity from the actual Fisher Scientific OCR output", () => {
    // Verbatim shapes from the real scanned Fisher SDS (colonless labels,
    // lowercase section header, OCR noise). This is the document that
    // originally scored too low and fell back to AI.
    const fields = parseSdsText([
      `SCIENTIFIE
Creation Date 14-Oct-2009 Revision Date 17-Jan-2018 Revision Number 3
1. identification
Product Name Ammonium iron (ll) sulfate hexahydrate
Cat No. : 177-212; 177-500
CAS-No 7783-85-9
Synonyms Mohr's salt; Iron(II) ammonium sulfate
Manufacturer Fisher Scientific
Emergency telephone CHEMTREC 800-424-9300
2. Hazard identification
Warning
H315 Causes skin irritation.
H319 Causes serious eye irritation.
H335 May cause respiratory irritation.
GHS07 Exclamation mark`,
    ]);
    expect(fields.chemicalName).toContain("Ammonium iron");
    expect(fields.casNumber).toBe("7783-85-9");
    expect(fields.signalWord).toBe("warning");
    expect(fields.hazardClasses).toContain("irritant");
    // The whole point of the tiered pipeline: this must clear the gate
    // locally so no AI quota is spent.
    expect(scoreParse(fields)).toBeGreaterThanOrEqual(2);
  });
});

describe("scoreParse — AI-fallback quality gate", () => {
  test("scores an empty parse 0 and a complete parse 5", () => {
    const empty = parseSdsText(["lorem ipsum dolor sit amet"]);
    expect(scoreParse(empty)).toBe(0);

    const full = parseSdsText(CANONICAL_DIGITAL_SDS);
    expect(scoreParse(full)).toBe(5);
  });
});
