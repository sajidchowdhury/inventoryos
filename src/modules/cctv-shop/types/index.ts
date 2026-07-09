export interface CCTVProduct {
  id: string;
  name: string;
  brand: string;
  category: string;
  model?: string;
  sku: string;
  costPrice: number;
  sellPrice: number;
  stock: number;
  serialTracked: boolean;
  warrantyMonths: number;
  imageUrl?: string;
  businessId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CCTVSerialItem {
  id: string;
  serialNumber: string;
  productId: string;
  product: CCTVProduct;
  status: 'in-stock' | 'sold' | 'installed' | 'in-repair' | 'warranty-claim' | 'defective';
  soldTo?: string;
  customerId?: string;
  installationDate?: string;
  warrantyExpiry?: string;
  businessId: string;
  createdAt: string;
  updatedAt: string;
}

export type CCTVViewType =
  | 'dashboard'
  | 'inventory-hub'
  | 'products'
  | 'serial-items'
  | 'add-product'
  | 'edit-product'
  | 'product-detail'
  | 'sell'
  | 'new-sale'
  | 'sale-detail'
  | 'sales-history'
  | 'customers'
  | 'customer-detail'
  | 'job-cards'
  | 'job-card-detail'
  | 'create-job-card'
  | 'warranties'
  | 'warranty-detail'
  | 'projects'
  | 'project-detail'
  | 'create-project'
  | 'emi'
  | 'emi-detail'
  | 'amc'
  | 'amc-detail'
  | 'create-amc'
  | 'mushak-report'
  | 'purchase-orders'
  | 'suppliers'
  | 'categories'
  | 'ai-hub'
  | 'ai-chat'
  | 'ai-insights'
  | 'more-hub'
  | 'settings'
  | 'profile'
  | 'subscription'
  | 'reports'
  | 'help';