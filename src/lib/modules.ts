// ── InventoryOS: Module Registry ──
// Central registry for all business modules.
// Adding a new module = adding an entry here.

import { type BusinessModuleConfig, type BusinessSlug } from "@/types";

const moduleRegistry: Record<BusinessSlug, BusinessModuleConfig> = {
  pharmacy: {
    slug: "pharmacy",
    name: "Pharmacy",
    description: "Track medicines, batch numbers, expiry dates, and GST compliance with ease.",
    icon: "Pill",
    color: "#16A34A",
    isActive: true,
    sortOrder: 1,
    features: [
      "Batch & expiry tracking",
      "Low stock alerts",
      "GST/VAT calculations",
      "Manufacturer management",
      "Schedule type categorization",
    ],
  },
  grocery: {
    slug: "grocery",
    name: "Grocery Shop",
    description: "Manage daily stock, wholesale prices, and perishable goods effortlessly.",
    icon: "ShoppingCart",
    color: "#EA580C",
    isActive: false,
    sortOrder: 2,
    features: [
      "Barcode scanning",
      "Wholesale & retail pricing",
      "Perishable tracking",
      "Shelf life monitoring",
    ],
  },
  restaurant: {
    slug: "restaurant",
    name: "Restaurant",
    description: "Link recipes to ingredients, track waste, and manage daily prep lists.",
    icon: "UtensilsCrossed",
    color: "#DC2626",
    isActive: false,
    sortOrder: 3,
    features: [
      "Recipe management",
      "Ingredient linking",
      "Daily prep lists",
      "Waste tracking",
    ],
  },
  cctv: {
    slug: "cctv",
    name: "CCTV Shop",
    description: "Track camera models, DVR compatibility, warranties, and installations.",
    icon: "Camera",
    color: "#7C3AED",
    isActive: false,
    sortOrder: 4,
    features: [
      "Model & brand tracking",
      "DVR compatibility",
      "Warranty management",
      "Installation records",
    ],
  },
  mobile: {
    slug: "mobile",
    name: "Mobile Shop",
    description: "Track IMEI numbers, warranties, accessories, and purchase invoices.",
    icon: "Smartphone",
    color: "#0891B2",
    isActive: false,
    sortOrder: 5,
    features: [
      "IMEI tracking",
      "Warranty periods",
      "Accessory bundling",
      "Purchase invoices",
    ],
  },
  electric: {
    slug: "electric",
    name: "Electric Shop",
    description: "Manage wiring, fixtures, certifications, and warranty periods.",
    icon: "Zap",
    color: "#CA8A04",
    isActive: false,
    sortOrder: 6,
    features: [
      "Wattage & voltage specs",
      "Certification tracking",
      "Warranty management",
      "Wire length inventory",
    ],
  },
  bakery: {
    slug: "bakery",
    name: "Bakery",
    description: "Track recipes, production dates, allergens, and custom orders.",
    icon: "Cake",
    color: "#DB2777",
    isActive: false,
    sortOrder: 7,
    features: [
      "Recipe management",
      "Production dating",
      "Allergen tracking",
      "Custom order handling",
    ],
  },
};

export function getModule(slug: BusinessSlug): BusinessModuleConfig {
  return moduleRegistry[slug];
}

export function getAllModules(): BusinessModuleConfig[] {
  return Object.values(moduleRegistry).sort((a, b) => a.sortOrder - b.sortOrder);
}

export function getActiveModules(): BusinessModuleConfig[] {
  return Object.values(moduleRegistry)
    .filter((m) => m.isActive)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export default moduleRegistry;
