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
  | "dispense"        // Quick dispense / POS with FEFO
  | "sales"           // Sales/invoices list
  | "sale-detail"     // Single sale invoice view
  | "analytics"       // Sales analytics dashboard with charts
  | "customers"       // Customer management
  | "customer-detail" // Single customer view with purchase history
  | "add-customer"    // Add new customer
  | "edit-customer"   // Edit existing customer
  | "customer-credit" // Customer outstanding balance view
  | "payments"        // Payments list + record
  | "returns"         // Returns list + process
  | "discount-rules"  // Discount rules management
  | "suppliers"       // Supplier management
  | "supplier-detail" // Single supplier view with balance + history
  | "purchases"       // Purchase list
  | "purchase-detail" // Single purchase view
  | "add-purchase"    // Create new purchase
  | "expiry"          // Full expiry management dashboard
  | "alerts"          // Combined alerts center
  | "alert-settings"  // Alert preferences configuration
  | "report"          // Printable expiry report
  | "business-dashboard" // Unified business KPI dashboard
  | "profit-loss"     // Profit & Loss report
  | "inventory-value" // Inventory valuation report
  | "business-report" // Comprehensive business report
  | "transactions"    // Activity / audit log
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
  // Sale/Customer navigation
  activeSaleId: string | null;
  setActiveSaleId: (id: string | null) => void;
  activeCustomerId: string | null;
  setActiveCustomerId: (id: string | null) => void;
  editingCustomerId: string | null;
  setEditingCustomerId: (id: string | null) => void;
  // Optional: pre-selected customer for new sale
  saleCustomerId: string | null;
  setSaleCustomerId: (id: string | null) => void;
  // Purchase navigation
  activePurchaseId: string | null;
  setActivePurchaseId: (id: string | null) => void;
  // Supplier navigation
  activeSupplierId: string | null;
  setActiveSupplierId: (id: string | null) => void;
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
  activeSaleId: null,
  setActiveSaleId: (id) => set({ activeSaleId: id }),
  activeCustomerId: null,
  setActiveCustomerId: (id) => set({ activeCustomerId: id }),
  editingCustomerId: null,
  setEditingCustomerId: (id) => set({ editingCustomerId: id }),
  saleCustomerId: null,
  setSaleCustomerId: (id) => set({ saleCustomerId: id }),
  activePurchaseId: null,
  setActivePurchaseId: (id) => set({ activePurchaseId: id }),
  activeSupplierId: null,
  setActiveSupplierId: (id) => set({ activeSupplierId: id }),
}));
