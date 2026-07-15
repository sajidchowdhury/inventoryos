"use client";

// /admin/catalog/cctv — CCTV Master Product Catalog page.
// Thin wrapper that renders the shared CCTVCatalogContent component.
// The same component is embedded inside /admin/cctv so the CCTV business
// has a single unified menu (Overview + Catalog tabs).

import { CCTVCatalogContent } from "./CCTVCatalogContent";

export default function CCTVCatalogPage() {
  return <CCTVCatalogContent />;
}
