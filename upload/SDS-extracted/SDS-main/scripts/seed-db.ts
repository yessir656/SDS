// ============================================================================
// Server-side Database Seed Script
// ============================================================================
//
// Run with:  bun run scripts/seed-db.ts
//
// This script:
//   1. Creates or updates the admin user from ADMIN_EMAIL / ADMIN_PASSWORD env vars.
//   2. Imports the 14 seed chemicals from src/lib/seed-data.ts into the Prisma DB.
//   3. Creates a placeholder SDS document (with a real placeholder PDF) for each
//      chemical that doesn't yet have one.
//
// The admin password is hashed with bcrypt (12 rounds) before storage.
// If ADMIN_EMAIL / ADMIN_PASSWORD are not set, the script prints instructions
// and skips admin creation (the chemicals are still seeded).
//
// This script is idempotent: re-running it updates existing records without
// duplicating them.
// ============================================================================

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { promises as fs } from "fs";
import path from "path";
import { SEED_CHEMICALS } from "../src/lib/seed-data";
import { generatePlaceholderPdf } from "../src/lib/pdf-placeholder";
import { generateStorageKey, saveFile, computeHash } from "../src/lib/storage";

const prisma = new PrismaClient();

const STORAGE_DIR = path.join(process.cwd(), "storage", "sds");

async function seedAdmin() {
  const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.ADMIN_PASSWORD;

  if (!email || !password) {
    console.warn("");
    console.warn("⚠  ADMIN_EMAIL / ADMIN_PASSWORD not set — skipping admin creation.");
    console.warn("   To create an admin, add these to your .env file:");
    console.warn("     ADMIN_EMAIL=admin@mirdc.dost.gov.ph");
    console.warn("     ADMIN_PASSWORD=your-secure-password");
    console.warn("");
    return;
  }

  if (password.length < 8) {
    console.warn("⚠  ADMIN_PASSWORD is shorter than 8 characters — skipping for safety.");
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    await prisma.user.update({
      where: { email },
      data: { passwordHash, role: "ADMIN" },
    });
    console.log(`✓ Admin user updated: ${email}`);
  } else {
    await prisma.user.create({
      data: { email, passwordHash, role: "ADMIN", name: "Administrator" },
    });
    console.log(`✓ Admin user created: ${email}`);
  }
}

async function seedChemicalsAndSds() {
  await fs.mkdir(STORAGE_DIR, { recursive: true });

  for (const chem of SEED_CHEMICALS) {
    // Upsert the chemical record.
    const record = await prisma.chemical.upsert({
      where: { id: chem.id },
      create: {
        id: chem.id,
        casNumber: chem.casNumber,
        chemicalName: chem.chemicalName,
        formula: chem.formula,
        tradeName: chem.tradeName ?? null,
        manufacturer: chem.manufacturer,
        supplier: chem.supplier,
        signalWord: chem.signalWord,
        hazardClasses: JSON.stringify(chem.hazardClasses),
        ghsPictograms: JSON.stringify(chem.ghsPictograms),
        storageLocation: chem.storageLocation,
        department: chem.department,
        safetyInstructions: chem.safetyInstructions,
        version: chem.version,
        emergencyContact: chem.emergencyContact,
        personalProtectiveEquipment: JSON.stringify(chem.personalProtectiveEquipment),
        firstAidMeasures: chem.firstAidMeasures,
        firefightingMeasures: chem.firefightingMeasures,
        accidentalReleaseMeasures: chem.accidentalReleaseMeasures,
      },
      update: {
        // Only update data fields if the record already exists — preserve
        // serverVersion/updatedAt so existing client sync states remain valid.
        casNumber: chem.casNumber,
        chemicalName: chem.chemicalName,
        formula: chem.formula,
        tradeName: chem.tradeName ?? null,
        manufacturer: chem.manufacturer,
        supplier: chem.supplier,
        signalWord: chem.signalWord,
        hazardClasses: JSON.stringify(chem.hazardClasses),
        ghsPictograms: JSON.stringify(chem.ghsPictograms),
        storageLocation: chem.storageLocation,
        department: chem.department,
        safetyInstructions: chem.safetyInstructions,
        version: chem.version,
        emergencyContact: chem.emergencyContact,
        personalProtectiveEquipment: JSON.stringify(chem.personalProtectiveEquipment),
        firstAidMeasures: chem.firstAidMeasures,
        firefightingMeasures: chem.firefightingMeasures,
        accidentalReleaseMeasures: chem.accidentalReleaseMeasures,
      },
    });

    // Create a placeholder SDS if none exists for this chemical.
    const existingSds = await prisma.sdsDocument.findUnique({
      where: { chemicalId: chem.id },
    });
    if (!existingSds) {
      const pdfBuffer = generatePlaceholderPdf(chem.chemicalName);
      const storageKey = generateStorageKey();
      await saveFile(pdfBuffer, storageKey);

      await prisma.sdsDocument.create({
        data: {
          chemicalId: chem.id,
          storageKey,
          originalFileName: "placeholder.pdf",
          fileSize: pdfBuffer.length,
          mimeType: "application/pdf",
          contentHash: computeHash(pdfBuffer),
          status: "placeholder",
          version: 1,
        },
      });
      console.log(`  ✓ ${chem.chemicalName} — placeholder SDS created`);
    } else {
      console.log(`  • ${chem.chemicalName} — SDS already exists (${existingSds.status})`);
    }

    // Touch updatedAt so a freshly-seeded DB has a sensible baseline.
    void record;
  }
}

async function main() {
  console.log("SDS-CHEM — Server Database Seed");
  console.log("================================\n");

  console.log("1. Seeding admin user...");
  await seedAdmin();

  console.log("\n2. Seeding chemicals + placeholder SDS documents...");
  await seedChemicalsAndSds();

  console.log("\n✅ Seed complete.");
  console.log(`   Total chemicals: ${await prisma.chemical.count()}`);
  console.log(`   Total SDS docs:  ${await prisma.sdsDocument.count()}`);
  console.log(`   Total admin users: ${await prisma.user.count()}`);
}

main()
  .catch((err) => {
    console.error("Seed failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
