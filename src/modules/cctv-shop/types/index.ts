// ── CCTV Module Types ──

// Serial Unit Status (matches Prisma schema CCTVSerialItem.status)
export type SerialItemStatus =
  | 'IN_STOCK'
  | 'IN_TRANSIT'
  | 'SOLD'
  | 'INSTALLED'
  | 'IN_REPAIR'
  | 'RETURNED'
  | 'WARRANTY_ACTIVE'
  | 'WARRANTY_EXPIRED'
  | 'DEFECTIVE'
  | 'DISPOSED';

// History Event Types (matches CCTVSerialItemHistory.event)
export type SerialHistoryEvent =
  | 'STOCKED'
  | 'STATUS_CHANGED'
  | 'SOLD'
  | 'INSTALLED'
  | 'REPAIR_START'
  | 'REPAIR_COMPLETE'
  | 'RETURNED'
  | 'WARRANTY_CLAIM'
  | 'DISPOSED'
  | 'TRANSFERRED';

// Physical Grade
export type SerialGrade = 'A' | 'B' | 'C' | 'D';

export interface CCTVProduct {
  id: string;
  name: string;
  brand: string;
  category?: { id: string; name: string; color: string; icon: string; slug: string } | null;
  model?: string;
  sku?: string;
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
  imei?: string;
  status: SerialItemStatus;
  grade?: string;
  conditionNotes?: string;
  costPrice?: number;
  sellPrice?: number;
  purchaseId?: string;
  supplierId?: string;
  purchaseDate?: string;
  warrantyMonths: number;
  warrantyStart?: string;
  warrantyEnd?: string;
  customerId?: string;
  customerName?: string;
  customerPhone?: string;
  saleId?: string;
  jobCardId?: string;
  projectId?: string;
  branchId?: string;
  currentLocation?: string;
  notes?: string;
  productId: string;
  product?: CCTVProduct;
  businessId: string;
  createdAt: string;
  updatedAt: string;
}

export interface CCTVSerialItemHistory {
  id: string;
  fromStatus?: string;
  toStatus: string;
  event: SerialHistoryEvent;
  userId?: string;
  referenceId?: string;
  referenceType?: string;
  notes?: string;
  serialItemId: string;
  createdAt: string;
}

// Stock-in staging row (before commit)
export interface StockInRow {
  _tempId: string;
  serialNumber: string;
  imei: string;
  costPrice: string;
  sellPrice: string;
  grade: SerialGrade | '';
  notes: string;
  duplicate: boolean;
  duplicateOf?: string; // which existing serialNumber or imei it duplicates
  error?: string;
}

export type CCTVViewType =
  | 'dashboard'
  | 'inventory-hub'
  | 'products'
  | 'serial-items'
  | 'add-product'
  | 'edit-product'
  | 'product-detail'
  | 'stock-in'
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