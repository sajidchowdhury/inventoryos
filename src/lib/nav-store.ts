// ── InventoryOS: Navigation Store ──
// Manages which view is active within the pharmacy module

import { create } from "zustand";

export type PharmacyView =
  | "dashboard"     // Main dashboard with stats
  | "products"      // Product list with search
  | "add-product"   // Add new product form
  | "edit-product"  // Edit existing product
  | "categories"    // Category management
  | "import"        // CSV bulk import
  | "profile";      // Business profile / settings

interface NavState {
  activeView: PharmacyView;
  setActiveView: (view: PharmacyView) => void;
  editingProductId: string | null;
  setEditingProductId: (id: string | null) => void;
}

export const useNavStore = create<NavState>((set) => ({
  activeView: "dashboard",
  setActiveView: (view) => set({ activeView: view }),
  editingProductId: null,
  setEditingProductId: (id) => set({ editingProductId: id }),
}));
