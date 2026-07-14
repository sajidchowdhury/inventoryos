// CCTV Module Types - Simple, clean

export type CCTVViewType =
  | 'dashboard'
  | 'products'
  | 'add-product'
  | 'edit-product'
  | 'product-detail'
  | 'purchase'
  | 'sales'
  | 'sale-detail'
  | 'customers'
  | 'suppliers'
  | 'expenses'
  | 'reports'
  | 'stock-report'
  | 'product-movement'
  | 'serial-search'
  | 'repairs'
  | 'repair-detail'
  | 'repair-token'
  | 'replacements'
  | 'warranties'
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
