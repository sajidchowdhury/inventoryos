// ── InventoryOS: Database Seed ──
// Seeds business types + pharmacy categories

import { db } from "../src/lib/db";

async function main() {
  console.log("Seeding database...");

  // Seed business types
  const businessTypes = [
    { slug: "pharmacy", name: "Pharmacy", icon: "Pill", color: "#16A34A", isActive: true, sortOrder: 1 },
    { slug: "grocery", name: "Grocery Shop", icon: "ShoppingCart", color: "#EA580C", isActive: false, sortOrder: 2 },
    { slug: "restaurant", name: "Restaurant", icon: "UtensilsCrossed", color: "#DC2626", isActive: false, sortOrder: 3 },
    { slug: "cctv", name: "CCTV Shop", icon: "Camera", color: "#7C3AED", isActive: false, sortOrder: 4 },
    { slug: "mobile", name: "Mobile Shop", icon: "Smartphone", color: "#0891B2", isActive: false, sortOrder: 5 },
    { slug: "electric", name: "Electric Shop", icon: "Zap", color: "#CA8A04", isActive: false, sortOrder: 6 },
    { slug: "bakery", name: "Bakery", icon: "Cake", color: "#DB2777", isActive: false, sortOrder: 7 },
  ];

  for (const bt of businessTypes) {
    await db.businessType.upsert({
      where: { slug: bt.slug },
      update: {},
      create: bt,
    });
  }
  console.log(`Seeded ${businessTypes.length} business types`);

  // Seed pharmacy categories for existing pharmacy businesses
  const pharmacyCategories = [
    { name: "Antibiotics", slug: "antibiotics", icon: "ShieldAlert", color: "#EF4444", type: "medicine", sortOrder: 1 },
    { name: "Pain & Fever", slug: "pain-fever", icon: "Thermometer", color: "#F97316", type: "medicine", sortOrder: 2 },
    { name: "Cold & Flu", slug: "cold-flu", icon: "Wind", color: "#3B82F6", type: "medicine", sortOrder: 3 },
    { name: "Digestive Health", slug: "digestive", icon: "Pill", color: "#10B981", type: "medicine", sortOrder: 4 },
    { name: "Diabetes", slug: "diabetes", icon: "Droplets", color: "#8B5CF6", type: "medicine", sortOrder: 5 },
    { name: "Heart & BP", slug: "heart-bp", icon: "Heart", color: "#EC4899", type: "medicine", sortOrder: 6 },
    { name: "Vitamins & Supplements", slug: "vitamins", icon: "Sparkles", color: "#F59E0B", type: "supplement", sortOrder: 7 },
    { name: "Skin Care", slug: "skin-care", icon: "Droplet", color: "#06B6D4", type: "medicine", sortOrder: 8 },
    { name: "Eye & Ear", slug: "eye-ear", icon: "Eye", color: "#6366F1", type: "medicine", sortOrder: 9 },
    { name: "Baby Care", slug: "baby-care", icon: "Baby", color: "#F472B6", type: "baby-care", sortOrder: 10 },
    { name: "Surgical Items", slug: "surgical", icon: "Scissors", color: "#64748B", type: "surgical", sortOrder: 11 },
    { name: "Cosmetics & Beauty", slug: "cosmetics", icon: "Flower2", color: "#A855F7", type: "cosmetic", sortOrder: 12 },
    { name: "Personal Care", slug: "personal-care", icon: "Hand", color: "#14B8A6", type: "other", sortOrder: 13 },
    { name: "First Aid", slug: "first-aid", icon: "Cross", color: "#DC2626", type: "other", sortOrder: 14 },
    { name: "Herbal & Homeopathy", slug: "herbal", icon: "Leaf", color: "#22C55E", type: "medicine", sortOrder: 15 },
    { name: "Medical Devices", slug: "medical-devices", icon: "Activity", color: "#0EA5E9", type: "surgical", sortOrder: 16 },
    { name: "Orthopedic", slug: "orthopedic", icon: "Bone", color: "#78716C", type: "surgical", sortOrder: 17 },
    { name: "Respiratory", slug: "respiratory", icon: "Cloud", color: "#6D28D9", type: "medicine", sortOrder: 18 },
  ];

  // Find all pharmacy businesses and seed categories
  const pharmacyBizType = await db.businessType.findUnique({ where: { slug: "pharmacy" } });
  if (pharmacyBizType) {
    const pharmacies = await db.business.findMany({
      where: { businessTypeId: pharmacyBizType.id },
    });

    for (const pharmacy of pharmacies) {
      for (const cat of pharmacyCategories) {
        await db.category.upsert({
          where: {
            businessId_slug: { businessId: pharmacy.id, slug: cat.slug },
          },
          update: {},
          create: {
            businessId: pharmacy.id,
            name: cat.name,
            slug: cat.slug,
            icon: cat.icon,
            color: cat.color,
            type: cat.type,
            sortOrder: cat.sortOrder,
          },
        });
      }
      console.log(`Seeded ${pharmacyCategories.length} categories for ${pharmacy.name}`);
    }
  }

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
