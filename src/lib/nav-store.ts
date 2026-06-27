// ── InventoryOS: Navigation Store ──
// Manages which view is active within the pharmacy module

import { create } from "zustand";

export type PharmacyView =
  | "dashboard"       // Main dashboard with stats
  | "products"        // Product list with search
  | "product-detail"  // Single product with batches & stock info
  | "add-product"     // Add new product form
  | "edit-product"    // Edit existing product
  | "batches"         // All batches list with filters
  | "add-batch"       // Add batch to a product
  | "edit-batch"      // Edit existing batch
  | "categories"      // Category management
  | "import"          // CSV bulk import
  | "profile";        // Business profile / settings

interface NavState {
  activeView: PharmacyView;
  setActiveView: (view: PharmacyView) => void;
  editingProductId: string | null;
  setEditingProductId: (id: string | null) => void;
  // Product whose detail/batch we are viewing or adding a batch to
  activeProductId: string | null;
  setActiveProductId: (id: string | null) => void;
  editingBatchId: string | null;
  setEditingBatchId: (id: string | null) => void;
}

export const useNavStore = create<NavState>((set) => ({
  activeView: "dashboard",
  setActiveView: (view) => set({ activeView: view }),
  editingProductId: null,
  setEditingProductId: (id) => set({ editingProductId: id }),
  activeProductId: null,
  setActiveProductId: (id) => set({ activeProductId: id }),
  editingBatchId: null,
  setEditingBatchId: (id) => set({ editingBatchId: id }),
}));
