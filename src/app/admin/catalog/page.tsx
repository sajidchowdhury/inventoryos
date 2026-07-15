"use client";

// /admin/catalog — Master Product Catalog page.
// Thin wrapper that renders the shared PharmacyCatalogContent component.
// The same component is embedded inside /admin/pharmacy so the Pharmacy
// business has a single unified menu (Overview + Catalog tabs).

import { PharmacyCatalogContent } from "./PharmacyCatalogContent";

export default function CatalogPage() {
  return <PharmacyCatalogContent />;
}
