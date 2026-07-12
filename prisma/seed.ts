// ── InventoryOS: Database Seed ──
// Seeds business types + pharmacy categories + default super-admin account

import { db } from "../src/lib/db";
import { hashPassword } from "../src/lib/auth";

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

  // Seed default super-admin (only on first run — never overwrites an existing password)
  const superAdminUsername = process.env.SUPER_ADMIN_USERNAME || "superadmin";
  const superAdminPassword = process.env.SUPER_ADMIN_DEFAULT_PASSWORD || "admin123";
  const existingSuperAdmin = await db.superAdmin.findFirst({
    where: { username: { equals: superAdminUsername } },
    select: { id: true },
  });

  if (!existingSuperAdmin) {
    const passwordHash = await hashPassword(superAdminPassword);
    await db.superAdmin.create({
      data: {
        username: superAdminUsername,
        passwordHash,
        fullName: "Super Admin",
        role: "super_admin",
        isActive: true,
      },
    });
    console.log(`Seeded super-admin account "${superAdminUsername}"`);
  } else {
    console.log(`Super-admin "${superAdminUsername}" already exists — password left unchanged`);
  }

  // ── Seed CCTV Master Products (catalog) ──
  // A small starter catalog so the master catalog is not empty on first run.
  // Super-admin can add more via /admin/catalog/cctv (Phase 3B).
  const cctvMasterProducts = [
    {
      name: "DS-2CD2143G2-I 4MP Bullet Camera",
      brand: "Hikvision",
      model: "DS-2CD2143G2-I",
      description: "4MP AcuSense Gen-2 Bullet Network Camera, 2.8mm lens, DarkFighter, IR up to 40m",
      hsnCode: "8525.89.00",
      defaultCategoryName: "Cameras",
      defaultWarrantyMonths: 12,
      defaultSerialTracked: true,
      defaultUnit: "piece",
      defaultVatRate: 15,
      defaultMrp: 6500,
    },
    {
      name: "DS-7608NI-K2/8P 8-Ch 4K NVR",
      brand: "Hikvision",
      model: "DS-7608NI-K2/8P",
      description: "8-Channel 4K NVR, 8 PoE ports, supports up to 8MP cameras, 2x HDD bays",
      hsnCode: "8517.62.00",
      defaultCategoryName: "DVR/NVR",
      defaultWarrantyMonths: 24,
      defaultSerialTracked: true,
      defaultUnit: "piece",
      defaultVatRate: 15,
      defaultMrp: 11500,
    },
    {
      name: "IPC-HFW2431S 4MP Bullet Camera",
      brand: "Dahua",
      model: "IPC-HFW2431S",
      description: "4MP Starlight Bullet Camera, 2.8mm fixed lens, IR LED up to 50m, ePoE",
      hsnCode: "8525.89.00",
      defaultCategoryName: "Cameras",
      defaultWarrantyMonths: 12,
      defaultSerialTracked: true,
      defaultUnit: "piece",
      defaultVatRate: 15,
      defaultMrp: 5500,
    },
    {
      name: "VIGI C400HP 4MP Bullet Camera",
      brand: "TP-Link",
      model: "VIGI-C400HP",
      description: "4MP Bullet Camera, 2.8mm lens, Smart Detection, IR up to 30m, PoE",
      hsnCode: "8525.89.00",
      defaultCategoryName: "Cameras",
      defaultWarrantyMonths: 12,
      defaultSerialTracked: true,
      defaultUnit: "piece",
      defaultVatRate: 15,
      defaultMrp: 4200,
    },
    {
      name: "RG59 Siamese Cable 100m Roll",
      brand: "Generic",
      model: "RG59-100M",
      description: "RG59 Siamese Coaxial + 2C Power Cable, 100m roll, for CCTV installations",
      hsnCode: "8544.70.00",
      defaultCategoryName: "Cables",
      defaultWarrantyMonths: 0,
      defaultSerialTracked: false,
      defaultUnit: "roll",
      defaultVatRate: 15,
      defaultMrp: 1200,
    },
  ];

  for (const mp of cctvMasterProducts) {
    await db.cCTVMasterProduct.upsert({
      where: { brand_model: { brand: mp.brand, model: mp.model } },
      update: {},
      create: mp,
    });
  }
  console.log(`Seeded ${cctvMasterProducts.length} CCTV master products`);

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
