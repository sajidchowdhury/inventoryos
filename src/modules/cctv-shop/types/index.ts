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
  | 'DISPOSED'
  | 'CONSUMED';

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
  | 'TRANSFERRED'
  | 'CONSUMED';

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

// ── 1D: Multi-Branch Inventory and Transfers ──

export type TransferStatus = 'DRAFT' | 'IN_TRANSIT' | 'RECEIVED' | 'CANCELLED';
export type TransferItemStatus = 'IN_TRANSIT' | 'RECEIVED' | 'RETURNED';

export interface CCTVBranch {
  id: string;
  name: string;
  code: string;
  address?: string;
  phone?: string;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
  businessId: string;
  _count?: {
    serialItems: number;
    transfersFrom: number;
    transfersTo: number;
  };
  createdAt: string;
  updatedAt: string;
}

export interface CCTVTransferItem {
  id: string;
  transferId: string;
  businessId: string;
  serialItemId: string;
  status: TransferItemStatus;
  createdAt: string;
  serialItem?: CCTVSerialItem;
}

export interface CCTVTransfer {
  id: string;
  businessId: string;
  transferCode: string;
  status: TransferStatus;
  fromBranchId: string;
  toBranchId: string;
  notes?: string;
  createdById?: string;
  receivedById?: string;
  receivedAt?: string;
  cancelledAt?: string;
  createdAt: string;
  updatedAt: string;
  fromBranch?: CCTVBranch;
  toBranch?: CCTVBranch;
  items?: CCTVTransferItem[];
  _count?: { items: number };
}

// ── 1E: Kit and Bundle Management ──

export interface CCTVKitComponent {
  id: string;
  kitId: string;
  businessId: string;
  productId: string;
  quantity: number;
  componentLabel?: string;
  isRequired: boolean;
  sortOrder: number;
  createdAt: string;
  product?: CCTVProduct;
}

export interface CCTVKitDefinition {
  id: string;
  businessId: string;
  name: string;
  slug: string;
  description?: string;
  kitPrice?: number;
  discountPercent: number;
  imageUrl?: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  components?: CCTVKitComponent[];
  _count?: { components: number };
}

// Availability check result per component
export interface KitComponentAvailability {
  component: CCTVKitComponent;
  product?: CCTVProduct;
  required: number;
  available: number;
  sufficient: boolean;
}

export interface KitAvailabilityResult {
  kit: CCTVKitDefinition;
  canFulfill: boolean;
  components: KitComponentAvailability[];
  individualTotal: number;   // sum of (component sell price * quantity)
  kitPrice: number;          // kitPrice or discounted total
  maxComplete: number;       // how many full kits can be assembled
}

// ── 2A: Job Card Management ──

export type JobCardStatus =
  | 'RECEIVED'
  | 'DIAGNOSING'
  | 'AWAITING_PARTS'
  | 'IN_PROGRESS'
  | 'TESTING'
  | 'READY_FOR_DELIVERY'
  | 'DELIVERED'
  | 'OUTSOURCED'
  | 'CANCELLED';

export type JobType = 'REPAIR' | 'INSTALLATION' | 'MAINTENANCE' | 'DIAGNOSTIC';
export type JobPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface CCTVJobCard {
  id: string;
  businessId: string;
  jobCode: string;
  status: JobCardStatus;
  jobType: JobType;
  customerId?: string;
  customerName: string;
  customerPhone: string;
  serialItemId?: string;
  productId?: string;
  deviceName?: string;
  serialNumber?: string;
  imei?: string;
  conditionNotes?: string;
  photoUrls?: string;
  reportedFault: string;
  diagnosis?: string;
  repairNotes?: string;
  estimatedCost?: number;
  finalCost?: number;
  laborCharge?: number;
  assignedToId?: string;
  assignedToName?: string;
  receivedAt: string;
  diagnosedAt?: string;
  startedAt?: string;
  testedAt?: string;
  readyAt?: string;
  deliveredAt?: string;
  outsourcedAt?: string;
  collectorName?: string;
  collectorNid?: string;
  collectorPhone?: string;
  otpCode?: string;
  otpGeneratedAt?: string;
  otpVerified: boolean;
  otpVerifiedAt?: string;
  vendorId?: string;
  vendorName?: string;
  vendorPhone?: string;
  vendorCost?: number;
  expectedReturn?: string;
  priority: JobPriority;
  internalNotes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  serialItem?: CCTVSerialItem;
  parts?: CCTVJobCardPart[];
  outsourcedVendor?: CCTVOutsourcedVendor;
}

// ── 2B: Spare Parts Integration ──

export interface CCTVJobCardPart {
  id: string;
  businessId: string;
  jobCardId: string;
  serialItemId: string;
  unitCost?: number;
  quantity: number;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  serialItem?: CCTVSerialItem;
}

// ── 2C: Technician Performance and Commissions ──

export type CommissionRuleType = 'FIXED_PER_TYPE' | 'PERCENT_LABOR' | 'PERCENT_PROFIT';

export interface CCTVTechnician {
  id: string;
  businessId: string;
  userId?: string;
  displayName: string;
  phone?: string;
  specialization?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { commissionRecords: number };
}

export interface CCTVCommissionRule {
  id: string;
  businessId: string;
  name: string;
  ruleType: CommissionRuleType;
  jobType?: string;
  fixedAmount?: number;
  percentRate?: number;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CCTVCommissionRecord {
  id: string;
  businessId: string;
  technicianId: string;
  jobCardId: string;
  ruleId?: string;
  commissionAmount: number;
  ruleType: string;
  jobType: string;
  laborCharge?: number;
  partsCost?: number;
  profitMargin?: number;
  month: string;
  createdAt: string;
  technician?: { id: string; displayName: string };
  jobCard?: { id: string; jobCode: string; customerName: string };
}

export interface TechnicianPerformance {
  totalJobs: number;
  completedJobs: number;
  avgTatHours: number;
  avgTatLabel: string;
  totalCommission: number;
  avgRating: number | null;
  jobTypeBreakdown: Record<string, number>;
}

// ── 2E: Outsourced Repair Tracking ──

export interface CCTVOutsourcedVendor {
  id: string;
  businessId: string;
  name: string;
  phone?: string;
  address?: string;
  specialization?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { jobCards: number };
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
  | 'create-emi'
  | 'amc'
  | 'amc-detail'
  | 'create-amc'
  | 'mushak-report'
  | 'purchase-orders'
  | 'suppliers'
  | 'categories'
  | 'kits'
  | 'kit-detail'
  | 'create-kit'
  | 'edit-kit'
  | 'branches'
  | 'branch-detail'
  | 'transfers'
  | 'create-transfer'
  | 'transfer-detail'
  | 'ai-hub'
  | 'ai-chat'
  | 'ai-insights'
  | 'more-hub'
  | 'settings'
  | 'profile'
  | 'subscription'
  | 'reports'
  | 'technicians'
  | 'technician-detail'
  | 'commission-report'
  | 'help';

// ── 3A: Payment Integration ──

export type PaymentMethod = 'CASH' | 'CARD' | 'BKASH' | 'NAGAD' | 'ROCKET';
export type SaleStatus = 'PENDING' | 'PARTIALLY_PAID' | 'PAID';

export interface CCTVSale {
  id: string;
  businessId: string;
  saleCode: string;
  status: SaleStatus;
  customerId?: string;
  customerName: string;
  customerPhone?: string;
  subtotal: number;
  discountAmount: number;
  totalDue: number;
  notes?: string;
  isActive: boolean;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  items?: CCTVSaleItem[];
  payments?: CCTVPayment[];
  _count?: { items: number; payments: number };
}

export interface CCTVSaleItem {
  id: string;
  businessId: string;
  saleId: string;
  productId: string;
  serialItemId?: string;
  productName: string;
  productBrand?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  createdAt: string;
  product?: CCTVProduct;
  serialItem?: CCTVSerialItem;
}

export interface CCTVPayment {
  id: string;
  businessId: string;
  saleId: string;
  method: PaymentMethod;
  amount: number;
  referenceNumber?: string;
  receivedBy?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
}

// ── 3B: EMI Sales Management ──

export type EmiStatus = 'ACTIVE' | 'COMPLETED' | 'DEFAULTED' | 'CANCELLED';
export type EmiInterestType = 'REDUCING' | 'FLAT';
export type InstallmentStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'WAIVED';

export interface CCTVEmiPlan {
  id: string;
  businessId: string;
  saleId?: string;
  customerName: string;
  customerPhone: string;
  productName: string;
  productBrand?: string;
  totalAmount: number;
  downPayment: number;
  financedAmount: number;
  interestRate: number;
  interestType: EmiInterestType;
  totalInterest: number;
  grandTotal: number;
  months: number;
  monthlyPayment: number;
  startDate: string;
  graceDays: number;
  paidInstallments: number;
  paidAmount: number;
  remainingAmount: number;
  status: EmiStatus;
  completedAt?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  installments?: CCTVEmiInstallment[];
  _count?: { installments: number };
}

export interface CCTVEmiInstallment {
  id: string;
  businessId: string;
  emiPlanId: string;
  installmentNo: number;
  dueDate: string;
  dueAmount: number;
  paidAmount: number;
  paidAt?: string;
  receivedBy?: string;
  status: InstallmentStatus;
  waiverAmount: number;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}