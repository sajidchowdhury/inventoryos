// CCTV Module Types - Simple, clean

export type CCTVViewType =
  | 'dashboard'
  | 'products'
  | 'add-product'
  | 'edit-product'
  | 'product-detail'
  | 'categories'
  | 'import-products'
  | 'purchase'
  | 'sales'
  | 'sale-detail'
  | 'customers'
  | 'suppliers'
  | 'expenses'
  | 'reports'
  | 'reports-hub'
  | 'stock-report'
  | 'product-movement'
  | 'daily-summary'
  | 'weekly-health'
  | 'sales-report'
  | 'purchase-report'
  | 'profit-loss'
  | 'due-collection'
  | 'top-products'
  | 'expense-summary'
  | 'serial-search'
  | 'repairs'
  | 'repair-detail'
  | 'repair-token'
  | 'replacements'
  | 'warranties'
  | 'estimates'
  | 'settings';

export interface CCTVProduct {
  id: string;
  name: string;
  brand: string;
  model?: string;
  sku?: string;
  costPrice: number;
  sellPrice: number;
  stock: number;
  serialTracked: boolean;
  warrantyMonths: number;
  category?: { id: string; name: string; color: string; icon: string; slug: string } | null;
  businessId: string;
  createdAt: string;
  updatedAt: string;
}
