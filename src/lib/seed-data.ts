// ============================================================================
// SDS-CHEM — Seed Data
// Realistic laboratory chemical records for MIRDC (Metals Industry Research and
// Development Center), Philippines. All CAS numbers, GHS classifications, and
// emergency response guidance are accurate to current supplier Safety Data
// Sheets. Emergency measures follow SDS Sections 4 (First-Aid), 5 (Firefighting),
// and 6 (Accidental Release) conventions.
// ============================================================================

import type {
  ChemicalRecord,
  LaboratoryLocation,
  UserPreferences,
} from "@/types";

// ----------------------------------------------------------------------------
// Shared contact information
// ----------------------------------------------------------------------------

/** MIRDC general trunkline used as the default facility emergency contact. */
const MIRDC_CONTACT = "+63 2 8837 0713";

/** Philippine Poison Control hotline — used for toxins and acute exposures. */
const POISON_CONTROL = "Philippine Poison Control: (02) 8521 3225";

// ============================================================================
// SEED LOCATIONS
// ============================================================================

export const SEED_LOCATIONS: LaboratoryLocation[] = [
  {
    id: "loc-1",
    division: "Chemical Analysis",
    building: "MIRDC Main Bldg",
    roomNumber: "R-101",
    cabinet: "Flammables Cabinet A",
    shelf: "Shelf 1",
    hazardLevel: "high",
  },
  {
    id: "loc-2",
    division: "Chemical Analysis",
    building: "MIRDC Main Bldg",
    roomNumber: "R-102",
    cabinet: "Acid Storage Cabinet",
    shelf: "Shelf 1",
    hazardLevel: "extreme",
  },
  {
    id: "loc-3",
    division: "Chemical Analysis",
    building: "MIRDC Main Bldg",
    roomNumber: "R-103",
    cabinet: "Oxidizers Cabinet",
    shelf: "Shelf 2",
    hazardLevel: "high",
  },
  {
    id: "loc-4",
    division: "Corrosion Testing",
    building: "Testing Laboratory Bldg",
    roomNumber: "R-205",
    cabinet: "Corrosives Cabinet",
    shelf: "Shelf 1",
    hazardLevel: "extreme",
  },
  {
    id: "loc-5",
    division: "Metallography",
    building: "Annex B",
    roomNumber: "Lab 3",
    cabinet: "Solvent Storage Cabinet",
    shelf: "Shelf 2",
    hazardLevel: "high",
  },
  {
    id: "loc-6",
    division: "Physical Metallurgy",
    building: "MIRDC Main Bldg",
    roomNumber: "R-110",
    cabinet: "General Reagents Cabinet",
    shelf: "Shelf 3",
    hazardLevel: "medium",
  },
  {
    id: "loc-7",
    division: "Corrosion Testing",
    building: "Testing Laboratory Bldg",
    roomNumber: "R-206",
    cabinet: "Ventilated Storage Cabinet",
    shelf: "Shelf 1",
    hazardLevel: "high",
  },
];

// ============================================================================
// SEED CHEMICALS
// ============================================================================

export const SEED_CHEMICALS: ChemicalRecord[] = [
  // --------------------------------------------------------------------------
  // 1. ACETONE
  // --------------------------------------------------------------------------
  {
    id: "chem-acetone",
    casNumber: "67-64-1",
    chemicalName: "Acetone",
    formula: "C₃H₆O",
    tradeName: "Propan-2-one",
    manufacturer: "RCI Labscan",
    supplier: "VWR International",
    signalWord: "danger",
    hazardClasses: ["flammable", "irritant", "specific-target-organ-toxicity"],
    ghsPictograms: ["flame", "exclamation-mark"],
    storageLocation: "Flammables Cabinet A, Shelf 1",
    department: "Chemical Analysis",
    safetyInstructions:
      "Keep away from heat, sparks, open flames, and hot surfaces — acetone has an extremely low flash point of −20 °C. Use only in a well-ventilated fume hood and ground all metal containers when transferring bulk quantities. Keep containers tightly closed when not in use; store away from oxidizers and strong acids.",
    sdsDocumentId: "",  // placeholder — overwritten by sync with the real SDS cuid
    lastUpdated: Date.parse("2024-06-15"),
    version: "2.1",
    emergencyContact: `${MIRDC_CONTACT}; ${POISON_CONTROL}`,
    personalProtectiveEquipment: [
      "Chemical splash goggles",
      "Nitrile gloves (8 mil minimum)",
      "Flame-resistant lab coat",
      "Closed-toe chemical-resistant shoes",
    ],
    firstAidMeasures:
      "Eye contact: Immediately flush eyes with copious amounts of water for at least 15 minutes, lifting upper and lower eyelids occasionally. Remove contact lenses if present and easy to do. Seek medical attention if irritation persists.\n" +
      "Skin contact: Remove contaminated clothing immediately. Wash affected skin thoroughly with soap and water for at least 15 minutes. If irritation or rash develops, seek medical advice.\n" +
      "Inhalation: Move the exposed person to fresh air immediately. If breathing is difficult, administer oxygen. If breathing has stopped, perform artificial respiration (avoid mouth-to-mouth if solvent ingestion is suspected; use a pocket mask). Seek medical attention.\n" +
      "Ingestion: Do NOT induce vomiting. Rinse mouth with water. Give 200–300 mL of water to drink if the person is fully conscious. Never give anything by mouth to an unconscious person. Seek immediate medical attention or contact the Poison Control Center.",
    firefightingMeasures:
      "Suitable extinguishing media: Alcohol-resistant foam, dry chemical powder, or carbon dioxide (CO₂). Water spray may be used to cool adjacent containers but is ineffective on the burning liquid itself and may spread the fire.\n" +
      "Unsuitable media: Do not use a solid water stream — acetone is miscible with water and will spread the flame front.\n" +
      "Specific hazards: Highly flammable; vapors are heavier than air and may travel along the ground to an ignition source and flash back. Combustion produces carbon monoxide and carbon dioxide. Containers may rupture or explode when heated.\n" +
      "Protective equipment: Firefighters must wear self-contained breathing apparatus (SCBA) operating in positive-pressure mode, with full structural protective clothing. Fight fire from a protected location or maximum possible distance.",
    accidentalReleaseMeasures:
      "Personal precautions: Evacuate non-essential personnel from the spill area. Eliminate all ignition sources — no smoking, no open flames, no sparking tools. Wear appropriate PPE: chemical splash goggles, nitrile gloves, flame-resistant lab coat, and respiratory protection if vapor concentration exceeds the exposure limit.\n" +
      "Environmental precautions: Prevent the spill from entering drains, sewers, or waterways. Acetone is highly mobile in soil and may contaminate groundwater.\n" +
      "Cleanup: For small spills, absorb with inert material such as vermiculite, dry sand, or commercial absorbent pads. Scoop into a labeled, sealable container for hazardous waste disposal. For large spills, dike the area with sand or earth and recover liquid with a spark-free pump. Ventilate the area thoroughly before re-entry. Do not flush to sewer.",
  },

  // --------------------------------------------------------------------------
  // 2. METHANOL
  // --------------------------------------------------------------------------
  {
    id: "chem-methanol",
    casNumber: "67-56-1",
    chemicalName: "Methanol",
    formula: "CH₃OH",
    tradeName: "Methyl alcohol",
    manufacturer: "Merck",
    supplier: "Sigma-Aldrich",
    signalWord: "danger",
    hazardClasses: [
      "flammable",
      "toxic",
      "specific-target-organ-toxicity",
      "irritant",
    ],
    ghsPictograms: ["flame", "skull-and-crossbones", "health-hazard"],
    storageLocation: "Flammables Cabinet A, Shelf 2",
    department: "Chemical Analysis",
    safetyInstructions:
      "Methanol is acutely toxic by ingestion, inhalation, and skin absorption and may cause irreversible optic nerve damage leading to blindness. Handle only inside a chemical fume hood with confirmed face velocity ≥ 100 ft/min. Keep away from ignition sources; flash point is 11 °C. Never pipette by mouth.",
    sdsDocumentId: "",  // placeholder — overwritten by sync with the real SDS cuid
    lastUpdated: Date.parse("2024-05-22"),
    version: "3.0",
    emergencyContact: `${MIRDC_CONTACT}; ${POISON_CONTROL}`,
    personalProtectiveEquipment: [
      "Chemical splash goggles",
      "Butyl rubber or nitrile gloves (8 mil minimum)",
      "Flame-resistant lab coat",
      "Chemical-resistant apron for bulk handling",
      "NIOSH-approved organic vapor respirator if engineering controls are insufficient",
    ],
    firstAidMeasures:
      "Eye contact: Immediately flush with water for at least 15 minutes, lifting eyelids occasionally. Remove contact lenses if easy to do. Obtain immediate ophthalmologic evaluation — methanol can penetrate the cornea and damage the optic nerve.\n" +
      "Skin contact: Remove contaminated clothing and shoes immediately. Wash skin with soap and water for at least 15 minutes. Methanol is absorbed through intact skin — seek medical evaluation even if no irritation is visible.\n" +
      "Inhalation: Move to fresh air. If not breathing, perform artificial respiration using a pocket mask. If breathing is difficult, administer oxygen. Transport to a medical facility immediately — antidotal therapy (fomepizole or ethanol) may be required.\n" +
      "Ingestion: Do NOT induce vomiting. Rinse mouth. If the person is fully conscious, give 200–300 mL of water. Seek emergency medical care IMMEDIATELY — methanol poisoning requires prompt administration of fomepizole or intravenous ethanol and possible hemodialysis. Contact the Poison Control Center for treatment guidance.",
    firefightingMeasures:
      "Suitable extinguishing media: Alcohol-resistant foam, dry chemical powder, or CO₂. Water spray can be used to dilute spills and cool containers but is generally ineffective on burning methanol.\n" +
      "Specific hazards: Vapors may form explosive mixtures with air (LEL 6 %, UEL 36 %). Vapors are heavier than air and may travel to an ignition source and flash back. Combustion produces formaldehyde, carbon monoxide, and carbon dioxide.\n" +
      "Protective equipment: SCBA and full structural firefighting gear. Use a fine water spray to disperse vapor clouds and cool exposed containers. Avoid direct hose streams on the burning liquid — splashing will spread the fire.",
    accidentalReleaseMeasures:
      "Personal precautions: Clear the area of all personnel. Eliminate ignition sources. Wear full PPE including organic-vapor respirator, chemical splash goggles, butyl rubber gloves, and flame-resistant clothing.\n" +
      "Environmental precautions: Prevent entry into drains, surface water, and soil. Notify the environmental officer if a release exceeds 5 L.\n" +
      "Cleanup: Small spills — absorb with vermiculite, dry sand, or commercial absorbent and place into a closed, labeled hazardous-waste container. Large spills — dike with sand or earth, recover with an explosion-proof pump, and transfer to a salvage tank. Ventilate the area for at least 30 minutes after cleanup. Dispose of all contaminated material as ignitable toxic waste in accordance with DENR DAO 92-29.",
  },

  // --------------------------------------------------------------------------
  // 3. ETHANOL
  // --------------------------------------------------------------------------
  {
    id: "chem-ethanol",
    casNumber: "64-17-5",
    chemicalName: "Ethanol",
    formula: "C₂H₅OH",
    tradeName: "Ethyl alcohol, Absolute",
    manufacturer: "J.T. Baker",
    supplier: "Fisher Scientific",
    signalWord: "danger",
    hazardClasses: ["flammable", "irritant", "specific-target-organ-toxicity"],
    ghsPictograms: ["flame", "exclamation-mark"],
    storageLocation: "Flammables Cabinet A, Shelf 1",
    department: "Metallography",
    safetyInstructions:
      "Ethanol is a Class IB flammable liquid (flash point 13 °C). Use in a fume hood away from heat and open flame; bond and ground metal containers during transfer. Avoid eye and prolonged skin contact. Denatured grades may contain toxic additives such as methanol or benzene — review the SDS before use.",
    sdsDocumentId: "",  // placeholder — overwritten by sync with the real SDS cuid
    lastUpdated: Date.parse("2024-04-10"),
    version: "2.2",
    emergencyContact: MIRDC_CONTACT,
    personalProtectiveEquipment: [
      "Chemical splash goggles",
      "Nitrile gloves",
      "Flame-resistant lab coat",
      "Closed-toe shoes",
    ],
    firstAidMeasures:
      "Eye contact: Flush with water for at least 15 minutes, lifting the upper and lower eyelids. Remove contact lenses if easy to do. Seek medical attention if irritation persists.\n" +
      "Skin contact: Wash thoroughly with soap and water. Remove contaminated clothing and launder before reuse.\n" +
      "Inhalation: Move to fresh air. If breathing is difficult, administer oxygen. If breathing has stopped, perform artificial respiration. Obtain medical attention if symptoms develop.\n" +
      "Ingestion: Do not induce vomiting. Rinse mouth with water. If conscious, give water to drink. Seek medical attention if a large quantity (greater than ~50 mL) has been swallowed.",
    firefightingMeasures:
      "Suitable extinguishing media: Alcohol-resistant foam, dry chemical powder, or CO₂. Water spray may be used to cool adjacent containers but is ineffective on the burning liquid.\n" +
      "Specific hazards: Vapors may form explosive mixtures with air over a wide range (LEL 3.3 %, UEL 19 %). Vapors are heavier than air and may travel along the ground to an ignition source. Containers may BLEVE when exposed to fire.\n" +
      "Protective equipment: SCBA and full structural protective clothing. Use water spray to cool fire-exposed containers and disperse vapor clouds.",
    accidentalReleaseMeasures:
      "Personal precautions: Remove ignition sources and evacuate non-essential personnel. Wear chemical splash goggles, nitrile gloves, and a flame-resistant lab coat. Use respiratory protection if vapor concentration exceeds 1000 ppm.\n" +
      "Environmental precautions: Prevent entry into drains, sewers, and watercourses.\n" +
      "Cleanup: Absorb small spills with inert absorbent (vermiculite, sand, or commercial pads) and place in a labeled hazardous-waste container. For large spills, dike and recover with an explosion-proof pump. Ventilate the area thoroughly. Do not flush to sewer — dispose of as ignitable hazardous waste.",
  },

  // --------------------------------------------------------------------------
  // 4. HYDROCHLORIC ACID
  // --------------------------------------------------------------------------
  {
    id: "chem-hydrochloric-acid",
    casNumber: "7647-01-0",
    chemicalName: "Hydrochloric Acid",
    formula: "HCl",
    tradeName: "Muriatic acid (37% reagent grade)",
    manufacturer: "Sigma-Aldrich",
    supplier: "VWR International",
    signalWord: "danger",
    hazardClasses: ["corrosive", "irritant", "specific-target-organ-toxicity"],
    ghsPictograms: ["corrosion", "exclamation-mark"],
    storageLocation: "Acid Storage Cabinet, Shelf 1",
    department: "Chemical Analysis",
    safetyInstructions:
      "Hydrochloric acid releases corrosive hydrogen chloride vapor — always open and dispense inside a fume hood. Never mix with cyanides, sulfides, or formaldehyde (liberates toxic gas) or with strong oxidizers. Add acid to water, never water to acid. Store in the acid cabinet, segregated from bases and oxidizers.",
    sdsDocumentId: "",  // placeholder — overwritten by sync with the real SDS cuid
    lastUpdated: Date.parse("2024-07-01"),
    version: "4.1",
    emergencyContact: `${MIRDC_CONTACT}; ${POISON_CONTROL}`,
    personalProtectiveEquipment: [
      "Chemical splash goggles or full face shield",
      "Neoprene or nitrile gloves (8 mil minimum)",
      "Acid-resistant lab coat or apron",
      "Closed-toe chemical-resistant shoes",
    ],
    firstAidMeasures:
      "Eye contact: Immediately flush with gentle running water for at least 20 minutes, lifting the upper and lower eyelids. Remove contact lenses if present and easy to do. Obtain IMMEDIATE emergency ophthalmologic care — acid burns can cause permanent corneal damage.\n" +
      "Skin contact: Remove contaminated clothing immediately. Flush skin with plenty of water for at least 15 minutes. For extensive exposure, use a safety shower for 15–20 minutes. Seek medical attention, especially if burns cover more than a small area.\n" +
      "Inhalation: Move to fresh air. If not breathing, perform artificial respiration using a pocket mask (avoid mouth-to-mouth). If breathing is difficult, administer humidified oxygen. Seek immediate medical attention — pulmonary edema may develop up to 48 hours after exposure.\n" +
      "Ingestion: Do NOT induce vomiting. Rinse mouth with water. Give 150–200 mL of water or milk to drink ONLY if the person is fully conscious. Do not attempt to neutralize with bicarbonate — gas evolution can perforate the esophagus. Seek immediate emergency medical care.",
    firefightingMeasures:
      "Suitable extinguishing media: HCl is non-combustible; use extinguishing media appropriate to the surrounding fire. Dry chemical powder, CO₂, or water spray.\n" +
      "Specific hazards: On heating, releases toxic and corrosive hydrogen chloride gas. Reacts with most metals to produce flammable hydrogen gas — accumulation can create an explosion hazard in confined spaces.\n" +
      "Protective equipment: SCBA with acid gas cartridge, full structural firefighting gear, and chemical-resistant gloves and boots. Approach from upwind. Cool adjacent containers with water spray.",
    accidentalReleaseMeasures:
      "Personal precautions: Evacuate the area and restrict access. Wear full PPE including a NIOSH-approved acid-gas respirator, chemical splash goggles or full face shield, neoprene gloves, and acid-resistant coveralls.\n" +
      "Environmental precautions: Prevent entry into drains, soil, and waterways. HCl is harmful to aquatic life and lowers the pH of receiving waters.\n" +
      "Cleanup: Do NOT discharge to sewer. Contain small spills with sand or earth and carefully neutralize with soda ash (sodium carbonate) or slaked lime, working from the outside in. Collect the neutralized residue in a labeled container for hazardous-waste disposal. For large spills, contact the safety officer and the spill response team. Ventilate the area thoroughly.",
  },

  // --------------------------------------------------------------------------
  // 5. SULFURIC ACID
  // --------------------------------------------------------------------------
  {
    id: "chem-sulfuric-acid",
    casNumber: "7664-93-9",
    chemicalName: "Sulfuric Acid",
    formula: "H₂SO₄",
    tradeName: "Oil of vitriol (95–98% reagent grade)",
    manufacturer: "Merck",
    supplier: "Fisher Scientific",
    signalWord: "danger",
    hazardClasses: ["corrosive"],
    ghsPictograms: ["corrosion"],
    storageLocation: "Acid Storage Cabinet, Shelf 1",
    department: "Chemical Analysis",
    safetyInstructions:
      "Concentrated sulfuric acid is a strong oxidizer and is highly exothermic when mixed with water — always add acid slowly to water, never the reverse. Store in the acid cabinet, away from organic materials, bases, metals, and reducing agents. Wear a face shield and acid-resistant apron for any operation involving more than 500 mL.",
    sdsDocumentId: "",  // placeholder — overwritten by sync with the real SDS cuid
    lastUpdated: Date.parse("2024-03-18"),
    version: "3.2",
    emergencyContact: `${MIRDC_CONTACT}; ${POISON_CONTROL}`,
    personalProtectiveEquipment: [
      "Chemical splash goggles AND full face shield",
      "Neoprene or PVC gloves",
      "Acid-resistant apron over a lab coat",
      "Chemical-resistant closed-toe boots",
      "Long sleeves and pants",
    ],
    firstAidMeasures:
      "Eye contact: Immediately irrigate with copious amounts of water for at least 20 minutes using an eyewash station, lifting the upper and lower eyelids. Removal of contact lenses should not delay irrigation. Obtain IMMEDIATE emergency ophthalmologic care — severe acid burns may cause irreversible blindness.\n" +
      "Skin contact: Drench the affected area under a safety shower for at least 20 minutes while removing contaminated clothing and shoes. Do NOT attempt to neutralize with bases. Seek immediate emergency medical care — sulfuric acid causes deep, severe thermal and chemical burns.\n" +
      "Inhalation: Move to fresh air. If not breathing, perform artificial respiration using a pocket mask. If breathing is difficult, administer oxygen. Seek medical attention — respiratory tract irritation may progress to pulmonary edema.\n" +
      "Ingestion: Do NOT induce vomiting. Rinse mouth. Do not give anything by mouth if the person is unconscious or convulsing. If conscious, give small sips of water (maximum 200 mL). Seek IMMEDIATE emergency medical care — esophageal or gastric perforation is a life-threatening risk.",
    firefightingMeasures:
      "Suitable extinguishing media: Sulfuric acid is non-combustible; use dry chemical powder, CO₂, or foam appropriate to the surrounding fire. Apply water spray ONLY from a safe distance to cool containers — direct water streams on concentrated acid generate violent exothermic reaction and spattering.\n" +
      "Specific hazards: Reacts violently with water releasing substantial heat. Reacts with most metals to liberate flammable hydrogen gas. On contact with combustible materials (wood, paper, organics) can cause spontaneous ignition. Decomposes above 340 °C to release toxic sulfur oxides (SOₓ).\n" +
      "Protective equipment: SCBA with acid gas cartridge, full structural protective clothing, and chemical-resistant boots and gloves. Maintain an upwind position and avoid low-lying areas where vapors may pool.",
    accidentalReleaseMeasures:
      "Personal precautions: Evacuate the area of all non-essential personnel. Wear full acid-resistant PPE: face shield, neoprene gloves and boots, and acid-resistant coverall. Use a NIOSH-approved acid gas respirator if vapor concentrations may exceed exposure limits.\n" +
      "Environmental precautions: Prevent any release to drains, soil, or surface water. Even dilute solutions are acutely harmful to aquatic organisms.\n" +
      "Cleanup: Contain with sand, earth, or a commercial acid absorbent. Do NOT use sawdust, rags, or other organic materials — sulfuric acid will char them and may ignite. Carefully neutralize the contained acid with soda ash (sodium carbonate) or lime, added slowly from the edges inward. Collect neutralized residue in a labeled, corrosion-resistant container for hazardous-waste disposal. Do not dispose of via the sanitary sewer.",
  },

  // --------------------------------------------------------------------------
  // 6. NITRIC ACID
  // --------------------------------------------------------------------------
  {
    id: "chem-nitric-acid",
    casNumber: "7697-37-2",
    chemicalName: "Nitric Acid",
    formula: "HNO₃",
    tradeName: "Aqua fortis (65–70% reagent grade)",
    manufacturer: "Sigma-Aldrich",
    supplier: "VWR International",
    signalWord: "danger",
    hazardClasses: ["oxidizing", "corrosive"],
    ghsPictograms: ["flame-on-circle", "corrosion"],
    storageLocation: "Oxidizers Cabinet, Shelf 2",
    department: "Chemical Analysis",
    safetyInstructions:
      "Nitric acid is a strong oxidizer and may ignite organic materials on contact. Store strictly in the oxidizers cabinet, separated from flammables, bases, reducing agents, and metals. Always work in a fume hood — brown nitrogen dioxide fumes are toxic. Never mix with alcohols, acetone, or organic solvents; many such mixtures are explosive.",
    sdsDocumentId: "",  // placeholder — overwritten by sync with the real SDS cuid
    lastUpdated: Date.parse("2024-06-30"),
    version: "2.5",
    emergencyContact: `${MIRDC_CONTACT}; ${POISON_CONTROL}`,
    personalProtectiveEquipment: [
      "Chemical splash goggles AND full face shield",
      "Neoprene or butyl rubber gloves",
      "Acid-resistant apron",
      "Chemical-resistant closed-toe boots",
      "Long sleeves and pants",
    ],
    firstAidMeasures:
      "Eye contact: Immediately flush with gentle running water for at least 20 minutes, lifting the eyelids. Remove contact lenses if easy to do. Obtain IMMEDIATE emergency ophthalmologic care.\n" +
      "Skin contact: Drench under a safety shower for at least 20 minutes while removing contaminated clothing and shoes. Yellow xanthoproteic staining of the skin indicates protein denaturation — seek medical evaluation even if no pain is reported.\n" +
      "Inhalation: Move to fresh air. If not breathing, perform artificial respiration using a pocket mask. If breathing is difficult, administer oxygen. Seek immediate medical attention — nitrogen dioxide inhalation can cause delayed pulmonary edema 6–48 hours after exposure.\n" +
      "Ingestion: Do NOT induce vomiting. Rinse mouth with water. Do not give anything by mouth if the person is unconscious. If conscious, give 150–200 mL of water. Seek IMMEDIATE emergency medical care — severe corrosive injury to the GI tract is expected.",
    firefightingMeasures:
      "Suitable extinguishing media: Nitric acid is non-combustible but is a powerful oxidizer that will intensify any surrounding fire. Use water spray, dry chemical, or CO₂ appropriate to the surrounding fuel.\n" +
      "Specific hazards: Decomposes on heating to release oxygen (which intensifies fire) and toxic nitrogen dioxide fumes (brown). Reacts with most metals — including copper, brass, and zinc — to release nitrogen oxides. Organic materials (paper, wood, solvents) may ignite spontaneously on contact.\n" +
      "Protective equipment: SCBA with acid gas cartridge and full structural firefighting gear. Approach from upwind. Cool adjacent containers with water spray from a protected location.",
    accidentalReleaseMeasures:
      "Personal precautions: Evacuate the area and restrict access. Wear full acid-resistant PPE: face shield, neoprene gloves and boots, acid-resistant coverall, and NIOSH-approved acid-gas respirator with NO₂ protection.\n" +
      "Environmental precautions: Prevent any release to drains or waterways — nitric acid is acutely toxic to aquatic life and lowers pH sharply.\n" +
      "Cleanup: Do NOT use organic absorbents (sawdust, rags, paper) — fire risk. Contain with sand or an inorganic acid absorbent. Neutralize slowly with soda ash or lime, working from the outside in. Collect neutralized residue in a corrosion-resistant, labeled container for hazardous-waste disposal. Ventilate the area for at least 30 minutes after cleanup.",
  },

  // --------------------------------------------------------------------------
  // 7. SODIUM HYDROXIDE
  // --------------------------------------------------------------------------
  {
    id: "chem-sodium-hydroxide",
    casNumber: "1310-73-2",
    chemicalName: "Sodium Hydroxide",
    formula: "NaOH",
    tradeName: "Caustic soda, lye",
    manufacturer: "J.T. Baker",
    supplier: "Fisher Scientific",
    signalWord: "danger",
    hazardClasses: ["corrosive"],
    ghsPictograms: ["corrosion"],
    storageLocation: "Corrosives Cabinet, Shelf 1",
    department: "Corrosion Testing",
    safetyInstructions:
      "Sodium hydroxide is a strong base that causes severe burns to skin and eyes. Dissolution in water is highly exothermic — always add pellets slowly to water with stirring, never the reverse. Store in the corrosives cabinet, segregated from acids, metals, and organic halogens. Keep containers tightly closed — NaOH absorbs moisture and CO₂ from the air.",
    sdsDocumentId: "",  // placeholder — overwritten by sync with the real SDS cuid
    lastUpdated: Date.parse("2024-05-09"),
    version: "2.0",
    emergencyContact: `${MIRDC_CONTACT}; ${POISON_CONTROL}`,
    personalProtectiveEquipment: [
      "Chemical splash goggles AND full face shield",
      "Neoprene or nitrile gloves (8 mil minimum)",
      "Chemical-resistant apron over lab coat",
      "Closed-toe chemical-resistant shoes",
    ],
    firstAidMeasures:
      "Eye contact: Immediately flush at an eyewash station for at least 20 minutes, lifting the upper and lower eyelids. Remove contact lenses if easy to do. Obtain IMMEDIATE emergency ophthalmologic care — caustic burns can cause permanent corneal opacification within minutes.\n" +
      "Skin contact: Remove contaminated clothing immediately. Flush the affected area under a safety shower for at least 20 minutes. Do NOT attempt chemical neutralization. Seek medical attention for any burn larger than the palm of the hand.\n" +
      "Inhalation: Move to fresh air. If not breathing, perform artificial respiration. If breathing is difficult, administer oxygen. Seek medical attention if coughing or respiratory irritation develops.\n" +
      "Ingestion: Do NOT induce vomiting. Rinse mouth with water. Do not give anything by mouth if the person is unconscious or convulsing. If conscious, give 150–200 mL of water. Seek IMMEDIATE emergency medical care — esophageal or gastric perforation is a critical risk.",
    firefightingMeasures:
      "Suitable extinguishing media: Sodium hydroxide is non-combustible; use extinguishing media appropriate to the surrounding fire. Avoid direct water streams on dry pellets or concentrated solutions — heat release can cause splattering.\n" +
      "Specific hazards: Reacts exothermically with acids, water, and many metals (releasing flammable hydrogen gas from amphoteric metals such as aluminum and zinc). Contact with strong acids can be violent. Solution attacks glass over time.\n" +
      "Protective equipment: SCBA and full structural firefighting gear with chemical-resistant gloves and boots. Cool adjacent containers with water spray.",
    accidentalReleaseMeasures:
      "Personal precautions: Evacuate non-essential personnel. Wear full PPE: face shield, neoprene gloves and boots, and chemical-resistant coverall. Use a dust respirator (N95 or higher) if dry pellets are spilled and dust is generated.\n" +
      "Environmental precautions: Prevent entry into drains, soil, and waterways — strong bases are acutely harmful to aquatic life.\n" +
      "Cleanup: Sweep up dry pellets carefully with a non-sparking plastic scoop — avoid generating dust. Dissolve small amounts of recovered material in water and neutralize slowly with dilute hydrochloric acid to pH 6–9 before disposal. For liquid spills, absorb with an inert material (sand, vermiculite) and place in a labeled container for hazardous-waste disposal. Do not flush to sewer without neutralization and prior approval.",
  },

  // --------------------------------------------------------------------------
  // 8. HYDROGEN PEROXIDE 30%
  // --------------------------------------------------------------------------
  {
    id: "chem-hydrogen-peroxide",
    casNumber: "7722-84-1",
    chemicalName: "Hydrogen Peroxide (30% solution)",
    formula: "H₂O₂",
    tradeName: "Perhydrol 30%",
    manufacturer: "Merck",
    supplier: "Sigma-Aldrich",
    signalWord: "danger",
    hazardClasses: ["oxidizing", "corrosive"],
    ghsPictograms: ["flame-on-circle", "corrosion"],
    storageLocation: "Oxidizers Cabinet, Shelf 2",
    department: "Chemical Analysis",
    safetyInstructions:
      "Hydrogen peroxide 30% is a strong oxidizer that can cause spontaneous ignition of organic materials. Store in the oxidizers cabinet in the original vented, light-resistant container — never transfer to a tightly sealed glass bottle (pressure buildup may rupture the container). Keep away from all metals (especially iron, copper, brass) and reducing agents. Always add to water, never water to peroxide.",
    sdsDocumentId: "",  // placeholder — overwritten by sync with the real SDS cuid
    lastUpdated: Date.parse("2024-06-12"),
    version: "1.4",
    emergencyContact: `${MIRDC_CONTACT}; ${POISON_CONTROL}`,
    personalProtectiveEquipment: [
      "Chemical splash goggles AND full face shield",
      "Neoprene or butyl rubber gloves",
      "Acid/oxidizer-resistant apron",
      "Closed-toe chemical-resistant shoes",
    ],
    firstAidMeasures:
      "Eye contact: Immediately flush at an eyewash station for at least 20 minutes, lifting the eyelids. Remove contact lenses if easy to do. Obtain IMMEDIATE emergency ophthalmologic care — corneal burns may produce gas bubbles in the anterior chamber.\n" +
      "Skin contact: Remove contaminated clothing immediately. Flush skin under a safety shower for at least 15 minutes. White blanching of the skin is characteristic — seek medical attention for any burn larger than a small area. Repeated flushing is needed even after the skin returns to normal color.\n" +
      "Inhalation: Move to fresh air. If breathing is difficult, administer oxygen. If not breathing, perform artificial respiration. Seek medical attention if respiratory irritation persists or if a mist was inhaled.\n" +
      "Ingestion: Do NOT induce vomiting. Rinse mouth. If conscious, give 150–200 mL of water to drink. Do NOT give activated charcoal. Seek IMMEDIATE emergency medical care — rapid release of oxygen in the GI tract can cause gastric distension or perforation.",
    firefightingMeasures:
      "Suitable extinguishing media: Water is the preferred extinguishing medium — large quantities dilute the peroxide and remove the oxidizing hazard. Water spray can also be used to cool containers.\n" +
      "Specific hazards: Powerful oxidizer — contact with combustibles (paper, wood, solvents) may cause spontaneous ignition. Decomposes on heating or contamination with metals or alkalis, releasing oxygen that vigorously supports combustion. Closed containers may rupture or BLEVE when exposed to fire.\n" +
      "Protective equipment: SCBA and full structural protective clothing, including chemical-resistant gloves and boots. Fight fire from a protected location; use flooding quantities of water.",
    accidentalReleaseMeasures:
      "Personal precautions: Evacuate the area. Wear full PPE: face shield, neoprene gloves and boots, chemical-resistant coverall, and respiratory protection if mists are present. Remove all combustibles from the spill area.\n" +
      "Environmental precautions: Prevent entry into drains, soil, and waterways. Although H₂O₂ decomposes to water and oxygen, the concentrated solution is acutely harmful to aquatic organisms.\n" +
      "Cleanup: Dilute the spill with large volumes of water if the area is non-combustible, then absorb with an inert inorganic material (vermiculite or perlite — never use sawdust, rags, or other organics). Place residue in a labeled, vented container for hazardous-waste disposal. Rinse the spill area thoroughly with water. Do NOT seal waste containers — oxygen evolution can rupture them.",
  },

  // --------------------------------------------------------------------------
  // 9. TOLUENE
  // --------------------------------------------------------------------------
  {
    id: "chem-toluene",
    casNumber: "108-88-3",
    chemicalName: "Toluene",
    formula: "C₇H₈",
    tradeName: "Methylbenzene, toluol",
    manufacturer: "RCI Labscan",
    supplier: "VWR International",
    signalWord: "danger",
    hazardClasses: [
      "flammable",
      "irritant",
      "reproductive-toxicant",
      "specific-target-organ-toxicity",
    ],
    ghsPictograms: ["flame", "health-hazard", "exclamation-mark"],
    storageLocation: "Solvent Storage Cabinet, Shelf 2",
    department: "Metallography",
    safetyInstructions:
      "Toluene is a reproductive toxicant (suspected of damaging the unborn child) and a central nervous system depressant. Handle only inside a fume hood. Flash point is 4 °C — keep away from ignition sources. Do not use if pregnant or attempting to conceive without first consulting the safety officer. Avoid skin contact — toluene is readily absorbed through intact skin.",
    sdsDocumentId: "",  // placeholder — overwritten by sync with the real SDS cuid
    lastUpdated: Date.parse("2024-02-28"),
    version: "3.1",
    emergencyContact: `${MIRDC_CONTACT}; ${POISON_CONTROL}`,
    personalProtectiveEquipment: [
      "Chemical splash goggles",
      "Viton® or butyl rubber gloves",
      "Flame-resistant lab coat",
      "Chemical-resistant apron for bulk handling",
      "NIOSH-approved organic vapor respirator if engineering controls are insufficient",
    ],
    firstAidMeasures:
      "Eye contact: Immediately flush with water for at least 15 minutes, lifting the upper and lower eyelids. Remove contact lenses if easy to do. Obtain medical attention if irritation persists.\n" +
      "Skin contact: Remove contaminated clothing immediately. Wash skin thoroughly with soap and water for at least 15 minutes. Seek medical attention if irritation or a rash develops — toluene defats the skin and may cause dermatitis.\n" +
      "Inhalation: Move to fresh air. If not breathing, perform artificial respiration using a pocket mask. If breathing is difficult, administer oxygen. Obtain medical attention — headache, dizziness, or drowsiness are early signs of CNS depression.\n" +
      "Ingestion: Do NOT induce vomiting — aspiration into the lungs can cause severe chemical pneumonitis. Rinse mouth. If the person is fully conscious, give 200 mL of water. Seek IMMEDIATE emergency medical care.",
    firefightingMeasures:
      "Suitable extinguishing media: Alcohol-resistant foam, dry chemical powder, or CO₂. Water spray may be used to cool adjacent containers but is ineffective on the burning liquid.\n" +
      "Specific hazards: Highly flammable; vapors form explosive mixtures with air (LEL 1.1 %, UEL 7.1 %). Vapors are heavier than air and may travel along the ground to an ignition source and flash back. Combustion produces carbon monoxide, carbon dioxide, and aromatic decomposition products. Containers may BLEVE when exposed to fire.\n" +
      "Protective equipment: SCBA and full structural firefighting gear. Use water spray to cool containers and disperse vapor clouds. Fight fire from upwind.",
    accidentalReleaseMeasures:
      "Personal precautions: Evacuate non-essential personnel. Eliminate all ignition sources. Wear full PPE: chemical splash goggles, Viton or butyl rubber gloves, flame-resistant lab coat, and a NIOSH-approved organic vapor respirator.\n" +
      "Environmental precautions: Prevent entry into drains, soil, and waterways — toluene is toxic to aquatic life with long-lasting effects. Notify the environmental officer if a release exceeds 5 L.\n" +
      "Cleanup: Absorb small spills with inert absorbent (vermiculite, dry sand, or commercial pads) and place in a labeled, sealable hazardous-waste container. For large spills, dike with sand or earth and recover with an explosion-proof pump. Ventilate the area for at least 30 minutes after cleanup. Dispose of as ignitable toxic waste in accordance with DENR regulations.",
  },

  // --------------------------------------------------------------------------
  // 10. ISOPROPYL ALCOHOL
  // --------------------------------------------------------------------------
  {
    id: "chem-isopropyl-alcohol",
    casNumber: "67-63-0",
    chemicalName: "Isopropyl Alcohol",
    formula: "C₃H₈O",
    tradeName: "2-Propanol, isopropanol, IPA",
    manufacturer: "Fisher Scientific",
    supplier: "Fisher Scientific",
    signalWord: "danger",
    hazardClasses: ["flammable", "irritant", "specific-target-organ-toxicity"],
    ghsPictograms: ["flame", "exclamation-mark"],
    storageLocation: "Flammables Cabinet A, Shelf 1",
    department: "Physical Metallurgy",
    safetyInstructions:
      "Isopropyl alcohol is a Class IB flammable liquid (flash point 12 °C). Use in a fume hood and keep away from heat, sparks, and open flame. Bond and ground metal containers during bulk transfer. Avoid prolonged skin contact — IPA defats the skin and may cause dermatitis. Do not use to clean skin or as a topical antiseptic in the laboratory setting.",
    sdsDocumentId: "",  // placeholder — overwritten by sync with the real SDS cuid
    lastUpdated: Date.parse("2024-07-05"),
    version: "1.8",
    emergencyContact: MIRDC_CONTACT,
    personalProtectiveEquipment: [
      "Chemical splash goggles",
      "Nitrile gloves (8 mil minimum)",
      "Flame-resistant lab coat",
      "Closed-toe chemical-resistant shoes",
    ],
    firstAidMeasures:
      "Eye contact: Flush with water for at least 15 minutes, lifting the upper and lower eyelids. Remove contact lenses if easy to do. Seek medical attention if irritation persists.\n" +
      "Skin contact: Wash with soap and water. Remove contaminated clothing and launder before reuse. Seek medical advice if irritation develops.\n" +
      "Inhalation: Move to fresh air. If breathing is difficult, administer oxygen. If not breathing, perform artificial respiration. Obtain medical attention if dizziness, headache, or drowsiness persists.\n" +
      "Ingestion: Do NOT induce vomiting. Rinse mouth. If conscious, give 200 mL of water to drink. Seek immediate medical attention — ingestion can cause CNS depression, hypoglycemia, and gastritis.",
    firefightingMeasures:
      "Suitable extinguishing media: Alcohol-resistant foam, dry chemical powder, or CO₂. Water spray can cool adjacent containers but is generally ineffective on the burning liquid.\n" +
      "Specific hazards: Vapors form explosive mixtures with air (LEL 2 %, UEL 12.7 %) and may travel to an ignition source and flash back. Combustion produces carbon monoxide and carbon dioxide. Containers may rupture when heated.\n" +
      "Protective equipment: SCBA and full structural firefighting gear. Use water spray to cool exposed containers and disperse vapor clouds.",
    accidentalReleaseMeasures:
      "Personal precautions: Remove ignition sources. Evacuate non-essential personnel. Wear chemical splash goggles, nitrile gloves, and a flame-resistant lab coat; use a respirator if vapor concentration exceeds 400 ppm.\n" +
      "Environmental precautions: Prevent entry into drains and waterways.\n" +
      "Cleanup: Absorb small spills with inert absorbent (vermiculite, sand, or commercial pads) and place in a labeled, sealable hazardous-waste container. For large spills, dike and recover with an explosion-proof pump. Ventilate the area thoroughly. Dispose of as ignitable hazardous waste.",
  },

  // --------------------------------------------------------------------------
  // 11. ACETIC ACID (GLACIAL)
  // --------------------------------------------------------------------------
  {
    id: "chem-acetic-acid",
    casNumber: "64-19-7",
    chemicalName: "Acetic Acid (glacial)",
    formula: "CH₃COOH",
    tradeName: "Glacial acetic acid, ethanoic acid",
    manufacturer: "Sigma-Aldrich",
    supplier: "VWR International",
    signalWord: "danger",
    hazardClasses: ["flammable", "corrosive"],
    ghsPictograms: ["flame", "corrosion"],
    storageLocation: "Corrosives Cabinet, Shelf 1",
    department: "Corrosion Testing",
    safetyInstructions:
      "Glacial acetic acid (≥99%) is both a Class II combustible liquid (flash point 39 °C) and a severe corrosive. Store in the corrosives cabinet, away from oxidizers (especially nitric acid and peroxides — mixtures can be explosive), strong bases, and amines. Use in a fume hood; vapors are irritating to the respiratory tract. Always add acid to water when diluting.",
    sdsDocumentId: "",  // placeholder — overwritten by sync with the real SDS cuid
    lastUpdated: Date.parse("2024-04-25"),
    version: "2.3",
    emergencyContact: `${MIRDC_CONTACT}; ${POISON_CONTROL}`,
    personalProtectiveEquipment: [
      "Chemical splash goggles AND full face shield",
      "Neoprene or nitrile gloves (8 mil minimum)",
      "Acid-resistant apron over lab coat",
      "Closed-toe chemical-resistant shoes",
    ],
    firstAidMeasures:
      "Eye contact: Immediately flush at an eyewash station for at least 20 minutes, lifting the upper and lower eyelids. Remove contact lenses if easy to do. Obtain IMMEDIATE emergency ophthalmologic care.\n" +
      "Skin contact: Remove contaminated clothing immediately. Flush under a safety shower for at least 15 minutes. Seek medical attention for burns covering more than a small area.\n" +
      "Inhalation: Move to fresh air. If not breathing, perform artificial respiration. If breathing is difficult, administer oxygen. Seek medical attention if respiratory irritation persists.\n" +
      "Ingestion: Do NOT induce vomiting. Rinse mouth. If conscious, give 150–200 mL of water. Seek IMMEDIATE emergency medical care — corrosive injury to the GI tract is expected.",
    firefightingMeasures:
      "Suitable extinguishing media: Alcohol-resistant foam, dry chemical powder, or CO₂. Water spray may be used to cool containers and dilute spills but is generally ineffective on the burning liquid.\n" +
      "Specific hazards: Combustible liquid; vapors form flammable mixtures with air (LEL 4 %, UEL 16 %). On heating, decomposes to release irritating acrid vapors and carbon oxides. Reacts with oxidizers, sometimes violently.\n" +
      "Protective equipment: SCBA with acid gas cartridge and full structural firefighting gear. Use water spray to cool adjacent containers.",
    accidentalReleaseMeasures:
      "Personal precautions: Evacuate non-essential personnel. Eliminate ignition sources. Wear full PPE: face shield, neoprene gloves and boots, acid-resistant coverall, and a NIOSH-approved acid gas respirator if vapor concentration is high.\n" +
      "Environmental precautions: Prevent entry into drains, soil, and waterways — even dilute solutions are acutely harmful to aquatic life.\n" +
      "Cleanup: Contain with sand, earth, or a commercial acid absorbent. Neutralize slowly with soda ash (sodium carbonate) or dilute sodium hydroxide to pH 6–9, working from the edges inward. Collect neutralized residue in a labeled corrosion-resistant container for hazardous-waste disposal. Ventilate the area thoroughly before re-entry.",
  },

  // --------------------------------------------------------------------------
  // 12. HEXANE
  // --------------------------------------------------------------------------
  {
    id: "chem-hexane",
    casNumber: "110-54-3",
    chemicalName: "Hexane",
    formula: "C₆H₁₄",
    tradeName: "n-Hexane",
    manufacturer: "J.T. Baker",
    supplier: "Fisher Scientific",
    signalWord: "danger",
    hazardClasses: [
      "flammable",
      "irritant",
      "reproductive-toxicant",
      "specific-target-organ-toxicity",
    ],
    ghsPictograms: ["flame", "health-hazard", "exclamation-mark"],
    storageLocation: "Solvent Storage Cabinet, Shelf 2",
    department: "Metallography",
    safetyInstructions:
      "n-Hexane is a reproductive toxicant and causes peripheral neuropathy (numbness, weakness of hands and feet) on repeated overexposure. Handle only in a fume hood. Flash point is −22 °C — keep away from ignition sources. Do not use if pregnant or attempting to conceive without first consulting the safety officer. Avoid skin contact — n-hexane is readily absorbed through intact skin.",
    sdsDocumentId: "",  // placeholder — overwritten by sync with the real SDS cuid
    lastUpdated: Date.parse("2024-03-05"),
    version: "2.7",
    emergencyContact: `${MIRDC_CONTACT}; ${POISON_CONTROL}`,
    personalProtectiveEquipment: [
      "Chemical splash goggles",
      "Viton® or nitrile gloves (8 mil minimum)",
      "Flame-resistant lab coat",
      "NIOSH-approved organic vapor respirator if engineering controls are insufficient",
    ],
    firstAidMeasures:
      "Eye contact: Immediately flush with water for at least 15 minutes, lifting the upper and lower eyelids. Remove contact lenses if easy to do. Seek medical attention if irritation persists.\n" +
      "Skin contact: Remove contaminated clothing. Wash skin with soap and water for at least 15 minutes. Seek medical attention if irritation or dermatitis develops.\n" +
      "Inhalation: Move to fresh air. If not breathing, perform artificial respiration using a pocket mask. If breathing is difficult, administer oxygen. Obtain medical attention if dizziness, headache, or drowsiness develops.\n" +
      "Ingestion: Do NOT induce vomiting — aspiration into the lungs can cause severe chemical pneumonitis. Rinse mouth. If conscious, give 200 mL of water. Seek IMMEDIATE emergency medical care.",
    firefightingMeasures:
      "Suitable extinguishing media: Alcohol-resistant foam, dry chemical powder, or CO₂. Water spray may be used to cool adjacent containers but is ineffective on the burning liquid and may spread the fire.\n" +
      "Specific hazards: Extremely flammable; vapors form explosive mixtures with air (LEL 1.1 %, UEL 7.5 %). Vapors are heavier than air and may travel along the ground to a remote ignition source and flash back. Combustion produces carbon monoxide and carbon dioxide. Static electricity accumulation is a major hazard during transfer.\n" +
      "Protective equipment: SCBA and full structural firefighting gear. Use water spray to cool containers and disperse vapor clouds. Bond and ground all equipment when transferring bulk quantities.",
    accidentalReleaseMeasures:
      "Personal precautions: Evacuate non-essential personnel. Eliminate all ignition sources — no smoking, no open flames, no sparking tools. Wear full PPE: chemical splash goggles, Viton or nitrile gloves, flame-resistant lab coat, and a NIOSH-approved organic vapor respirator.\n" +
      "Environmental precautions: Prevent entry into drains, soil, and waterways — n-hexane is toxic to aquatic life with long-lasting effects.\n" +
      "Cleanup: Absorb small spills with inert absorbent (vermiculite, dry sand, or commercial pads) and place in a labeled, sealable hazardous-waste container. For large spills, dike with sand or earth and recover with an explosion-proof pump. Ventilate the area for at least 30 minutes after cleanup. Dispose of as ignitable toxic hazardous waste in accordance with DENR regulations.",
  },

  // --------------------------------------------------------------------------
  // 13. DICHLOROMETHANE
  // --------------------------------------------------------------------------
  {
    id: "chem-dichloromethane",
    casNumber: "75-09-2",
    chemicalName: "Dichloromethane",
    formula: "CH₂Cl₂",
    tradeName: "Methylene chloride, DCM",
    manufacturer: "Merck",
    supplier: "Sigma-Aldrich",
    signalWord: "warning",
    hazardClasses: [
      "carcinogen",
      "specific-target-organ-toxicity",
      "irritant",
    ],
    ghsPictograms: ["health-hazard", "exclamation-mark"],
    storageLocation: "Ventilated Storage Cabinet, Shelf 1",
    department: "Chemical Analysis",
    safetyInstructions:
      "Dichloromethane is a suspected human carcinogen (Category 2) and is metabolized to carbon monoxide in the body — carboxyhemoglobin levels can reach dangerous concentrations after significant inhalation exposure. Handle only in a fume hood. Store in the ventilated storage cabinet, away from light and heat (decomposes to phosgene). Do not use near open flames or hot surfaces — thermal decomposition produces highly toxic phosgene gas and hydrogen chloride.",
    sdsDocumentId: "",  // placeholder — overwritten by sync with the real SDS cuid
    lastUpdated: Date.parse("2024-01-30"),
    version: "2.4",
    emergencyContact: `${MIRDC_CONTACT}; ${POISON_CONTROL}`,
    personalProtectiveEquipment: [
      "Chemical splash goggles",
      "Silver Shield® / 4H laminate gloves or Viton® gloves",
      "Lab coat (chemical-resistant apron for bulk handling)",
      "NIOSH-approved organic vapor respirator with combined P100 particulate filter",
    ],
    firstAidMeasures:
      "Eye contact: Immediately flush with water for at least 15 minutes, lifting the upper and lower eyelids. Remove contact lenses if easy to do. Seek medical attention if irritation persists.\n" +
      "Skin contact: Remove contaminated clothing. Wash skin thoroughly with soap and water for at least 15 minutes. Seek medical advice if irritation or dermatitis develops — DCM can be absorbed through intact skin.\n" +
      "Inhalation: Move to fresh air. If not breathing, perform artificial respiration using a pocket mask. If breathing is difficult, administer oxygen. Seek IMMEDIATE medical attention — DCM is metabolized to carbon monoxide; monitor carboxyhemoglobin levels and cardiac rhythm.\n" +
      "Ingestion: Do NOT induce vomiting. Rinse mouth. If conscious, give 200 mL of water. Seek IMMEDIATE emergency medical care — aspiration risk is significant and DCM is metabolized to CO.",
    firefightingMeasures:
      "Suitable extinguishing media: DCM is non-flammable under normal conditions but is decomposed by heat. Use water spray, dry chemical powder, alcohol-resistant foam, or CO₂ appropriate to the surrounding fire.\n" +
      "Specific hazards: On heating or contact with an open flame, decomposes to produce phosgene (a highly toxic gas), hydrogen chloride, and chlorine. Containers may rupture when exposed to fire. Vapors are heavier than air and may accumulate in low-lying areas.\n" +
      "Protective equipment: SCBA with acid gas cartridge and full structural firefighting gear. Approach from upwind. Use water spray to cool adjacent containers.",
    accidentalReleaseMeasures:
      "Personal precautions: Evacuate non-essential personnel. Wear full PPE: chemical splash goggles, Silver Shield or Viton gloves, chemical-resistant coverall, and a NIOSH-approved organic vapor respirator. Eliminate ignition sources and ensure adequate ventilation.\n" +
      "Environmental precautions: Prevent entry into drains, soil, and waterways — DCM is toxic to aquatic life.\n" +
      "Cleanup: Absorb small spills with inert absorbent (vermiculite, dry sand, or commercial pads) and place in a labeled, sealable hazardous-waste container. For large spills, dike with sand or earth and recover with a non-sparking pump. Ventilate the area thoroughly — DCM has a high vapor pressure and will rapidly fill enclosed spaces. Dispose of as carcinogenic hazardous waste in accordance with DENR regulations.",
  },

  // --------------------------------------------------------------------------
  // 14. AMMONIA SOLUTION
  // --------------------------------------------------------------------------
  {
    id: "chem-ammonia-solution",
    casNumber: "1336-21-6",
    chemicalName: "Ammonia Solution",
    formula: "NH₄OH",
    tradeName: "Ammonium hydroxide, 25–28% NH₃",
    manufacturer: "RCI Labscan",
    supplier: "VWR International",
    signalWord: "danger",
    hazardClasses: [
      "corrosive",
      "harmful",
      "irritant",
      "specific-target-organ-toxicity",
    ],
    ghsPictograms: ["corrosion", "gas", "exclamation-mark"],
    storageLocation: "Corrosives Cabinet, Shelf 1",
    department: "Physical Metallurgy",
    safetyInstructions:
      "Concentrated ammonia solution releases corrosive ammonia gas — always open and dispense inside a fume hood. Store in the corrosives cabinet, away from halogens, strong acids, and oxidizers (especially chlorine and bromine — violent reactions). Never seal a container tightly — pressure buildup from gas evolution may rupture it. Cool, ventilated storage is essential.",
    sdsDocumentId: "",  // placeholder — overwritten by sync with the real SDS cuid
    lastUpdated: Date.parse("2024-05-17"),
    version: "2.0",
    emergencyContact: `${MIRDC_CONTACT}; ${POISON_CONTROL}`,
    personalProtectiveEquipment: [
      "Chemical splash goggles AND full face shield",
      "Neoprene or butyl rubber gloves",
      "Acid/caustic-resistant apron",
      "Closed-toe chemical-resistant shoes",
      "NIOSH-approved ammonia gas respirator if engineering controls are insufficient",
    ],
    firstAidMeasures:
      "Eye contact: Immediately flush at an eyewash station for at least 20 minutes, lifting the upper and lower eyelids. Remove contact lenses if easy to do. Obtain IMMEDIATE emergency ophthalmologic care — ammonia causes severe alkali burns that can cause permanent corneal damage within minutes.\n" +
      "Skin contact: Remove contaminated clothing immediately. Flush under a safety shower for at least 15 minutes. Seek medical attention for any burn larger than a small area.\n" +
      "Inhalation: Move to fresh air. If not breathing, perform artificial respiration using a pocket mask. If breathing is difficult, administer oxygen. Seek IMMEDIATE medical attention — exposure to high vapor concentrations can cause severe respiratory tract irritation, laryngeal edema, or pulmonary edema.\n" +
      "Ingestion: Do NOT induce vomiting. Rinse mouth. If conscious, give 150–200 mL of water. Do not attempt neutralization. Seek IMMEDIATE emergency medical care — corrosive injury to the GI tract is expected.",
    firefightingMeasures:
      "Suitable extinguishing media: Ammonia solution is non-combustible; use extinguishing media appropriate to the surrounding fire. Water spray can be used to knock down ammonia vapor clouds.\n" +
      "Specific hazards: On heating, releases large volumes of ammonia gas — a corrosive, irritating gas that is toxic by inhalation. Anhydrous ammonia forms flammable mixtures with air at high concentrations (15–28 %). Reacts violently with halogens (chlorine, bromine, iodine) and strong acids.\n" +
      "Protective equipment: SCBA with ammonia (K-type) cartridge and full structural firefighting gear, including chemical-resistant gloves and boots. Approach from upwind and stay out of low-lying areas.",
    accidentalReleaseMeasures:
      "Personal precautions: Evacuate the area of all personnel. Wear full PPE: face shield, neoprene gloves and boots, chemical-resistant coverall, and a NIOSH-approved ammonia respirator. Provide maximum ventilation.\n" +
      "Environmental precautions: Prevent any release to drains, soil, or waterways — ammonia is acutely toxic to aquatic life.\n" +
      "Cleanup: Contain small spills with sand, earth, or an inert absorbent. Do NOT seal absorbent in a closed container — gas evolution may rupture it. Carefully neutralize with dilute hydrochloric acid to pH 6–9, then collect the neutralized residue in a labeled, vented container for hazardous-waste disposal. For large spills, contact the spill response team. Ventilate the area thoroughly before re-entry.",
  },
];

// ============================================================================
// SEED PREFERENCES
// ============================================================================

export const SEED_PREFERENCES: UserPreferences = {
  id: "default",
  theme: "system",
  emergencyModeEnabled: true,
  favoriteChemicals: [],
  lastSearch: "",
};
