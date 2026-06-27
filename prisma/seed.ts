// ── InventoryOS: Database Seed ──
// Populates the database with initial business types

import { db } from "../src/lib/db";

async function main() {
  console.log("Seeding database...");

  // Seed business types
  const businessTypes = await Promise.all([
    db.businessType.upsert({
      where: { slug: "pharmacy" },
      update: {},
      create: {
        slug: "pharmacy",
        name: "Pharmacy",
        icon: "Pill",
        color: "#16A34A",
        isActive: true,
        sortOrder: 1,
      },
    }),
    db.businessType.upsert({
      where: { slug: "grocery" },
      update: {},
      create: {
        slug: "grocery",
        name: "Grocery Shop",
        icon: "ShoppingCart",
        color: "#EA580C",
        isActive: false,
        sortOrder: 2,
      },
    }),
    db.businessType.upsert({
      where: { slug: "restaurant" },
      update: {},
      create: {
        slug: "restaurant",
        name: "Restaurant",
        icon: "UtensilsCrossed",
        color: "#DC2626",
        isActive: false,
        sortOrder: 3,
      },
    }),
    db.businessType.upsert({
      where: { slug: "cctv" },
      update: {},
      create: {
        slug: "cctv",
        name: "CCTV Shop",
        icon: "Camera",
        color: "#7C3AED",
        isActive: false,
        sortOrder: 4,
      },
    }),
    db.businessType.upsert({
      where: { slug: "mobile" },
      update: {},
      create: {
        slug: "mobile",
        name: "Mobile Shop",
        icon: "Smartphone",
        color: "#0891B2",
        isActive: false,
        sortOrder: 5,
      },
    }),
    db.businessType.upsert({
      where: { slug: "electric" },
      update: {},
      create: {
        slug: "electric",
        name: "Electric Shop",
        icon: "Zap",
        color: "#CA8A04",
        isActive: false,
        sortOrder: 6,
      },
    }),
    db.businessType.upsert({
      where: { slug: "bakery" },
      update: {},
      create: {
        slug: "bakery",
        name: "Bakery",
        icon: "Cake",
        color: "#DB2777",
        isActive: false,
        sortOrder: 7,
      },
    }),
  ]);

  console.log(`Seeded ${businessTypes.length} business types`);
  console.log("Done!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
