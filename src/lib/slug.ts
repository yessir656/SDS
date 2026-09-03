// ============================================================================
// Slug helpers — derive schema-valid chemical IDs from human-readable names.
// Format: "Acetic Acid" + "Fisher" → "aceticacid-fisher"
// ============================================================================

/**
 * Slugify a single segment: lowercase, strip ALL non-alphanumeric chars.
 * "Acetic Acid" → "aceticacid", "Fisher Scientific" → "fisherscientific"
 */
export function slugifyForId(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "")
    .slice(0, 50);
}

/**
 * Generate a chemical ID from the chemical name + manufacturer.
 * "Acetic Acid" + "Fisher" → "aceticacid-fisher"
 * "Acetone" + ""           → "acetone"
 * "" + anything            → ""
 */
export function generateChemicalId(
  chemicalName: string,
  manufacturer?: string
): string {
  const name = slugifyForId(chemicalName);
  if (!name) return "";
  const mfr = manufacturer ? slugifyForId(manufacturer) : "";
  if (mfr) return `${name}-${mfr}`.slice(0, 100);
  return name.slice(0, 100);
}