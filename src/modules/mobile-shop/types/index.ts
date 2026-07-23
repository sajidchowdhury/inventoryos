// ── CCTV Module Types ──

// Serial Unit Status (matches Prisma schema MSSerialItem.status)
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

// History Event Types (matches MSSerialItemHistory.event)
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

export interface MSProduct {
  id: string;
  name: string;
  brand: string;
  category?: { id: string; name: string; color: string; icon: string; slug: string } | null;
  masterProductId?: string | null;
  masterProduct?: {
    id: string;
    name: string;
    brand: string;
    model: string;
    hsnCode?: string | null;
    defaultWarrantyMonths: number;
    defaultSerialTracked: boolean;
    defaultImageUrl?: string | null;
  } | null;
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

// ── CCTV Master Product (shared catalog) ──
export interface MSMasterProduct {
  id: string;
  manufacturerId?: string | null;
  name: string;
  brand: string;
  model: string;
  sku?: string | null;
  description?: string | null;
  hsnCode?: string | null;
  defaultCategoryName?: string | null;
  defaultWarrantyMonths: number;
  defaultSerialTracked: boolean;
  defaultUnit: string;
  defaultImageUrl?: string | null;
  defaultVatRate: number;
  defaultMrp?: number | null;
  specs?: unknown;
  isActive: boolean;
  isApproved: boolean;
  submittedByBusinessId?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MSSerialItem {
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
  product?: MSProduct;
  businessId: string;
  createdAt: string;
  updatedAt: string;
}

export interface MSSerialItemHistory {
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

export interface MSBranch {
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

export interface MSTransferItem {
  id: string;
  transferId: string;
  businessId: string;
  serialItemId: string;
  status: TransferItemStatus;
  createdAt: string;
  serialItem?: MSSerialItem;
}

export interface MSTransfer {
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
  fromBranch?: MSBranch;
  toBranch?: MSBranch;
  items?: MSTransferItem[];
  _count?: { items: number };
}

// ── 1E: Kit and Bundle Management ──

export interface MSKitComponent {
  id: string;
  kitId: string;
  businessId: string;
  productId: string;
  quantity: number;
  componentLabel?: string;
  isRequired: boolean;
  sortOrder: number;
  createdAt: string;
  product?: MSProduct;
}

export interface MSKitDefinition {
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
  components?: MSKitComponent[];
  _count?: { components: number };
}

// Availability check result per component
export interface KitComponentAvailability {
  component: MSKitComponent;
  product?: MSProduct;
  required: number;
  available: number;
  sufficient: boolean;
}

export interface KitAvailabilityResult {
  kit: MSKitDefinition;
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

export interface MSJobCard {
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
  serialItem?: MSSerialItem;
  parts?: MSJobCardPart[];
  outsourcedVendor?: MSOutsourcedVendor;
}

// ── 2B: Spare Parts Integration ──

export interface MSJobCardPart {
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
  serialItem?: MSSerialItem;
}

// ── 2C: Technician Performance and Commissions ──

export type CommissionRuleType = 'FIXED_PER_TYPE' | 'PERCENT_LABOR' | 'PERCENT_PROFIT';

export interface MSTechnician {
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

export interface MSCommissionRule {
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

export interface MSCommissionRecord {
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

export interface MSOutsourcedVendor {
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

export type MSViewType =
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
  | 'loyalty-center'
  | 'amc'
  | 'amc-detail'
  | 'create-amc'
  | 'mushak-report'
  | 'purchase-orders'
  | 'create-purchase'
  | 'purchase-detail'
  | 'suppliers'
  | 'supplier-detail'
  | 'edit-supplier'
  | 'categories'
  | 'create-category'
  | 'edit-category'
  | 'kits'
  | 'kit-detail'
  | 'create-kit'
  | 'edit-kit'
  | 'sell-kit'
  | 'import-products'
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
  | 'help'
  | 'storage-calculator'
  | 'installation-tasks'
  | 'create-task'
  | 'task-detail'
  | 'nbr-setup'
  | 'mushak-invoices'
  | 'mushak-invoice-detail'
  | 'mushak-registers'
  | 'create-mushak'
  | 'vat-return'
  | 'cloud-dashboard'
  | 'due-book'
  | 'expenses'
  | 'ledger'
  | 'stock-report'
  | 'profit-loss';

// ── 3A: Payment Integration ──

export type PaymentMethod = 'CASH' | 'CARD' | 'BKASH' | 'NAGAD' | 'ROCKET';
export type SaleStatus = 'PENDING' | 'PARTIALLY_PAID' | 'PAID';

export interface MSSale {
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
  items?: MSSaleItem[];
  payments?: MSPayment[];
  _count?: { items: number; payments: number };
}

export interface MSSaleItem {
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
  product?: MSProduct;
  serialItem?: MSSerialItem;
}

export interface MSPayment {
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

// ── 2A: Sales Return Flow ──

export type RefundMethod = 'CASH' | 'CARD' | 'BKASH' | 'NAGAD' | 'ROCKET' | 'STORE_CREDIT' | 'NO_REFUND';
export type SerialRestoreStatus = 'IN_STOCK' | 'RETURNED';

export interface MSReturn {
  id: string;
  businessId: string;
  saleId: string;
  returnCode: string;
  status: string;
  refundMethod?: string;
  refundAmount: number;
  refundReference?: string;
  customerName: string;
  customerPhone?: string;
  reason?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  items?: MSReturnItem[];
  _count?: { items: number };
}

export interface MSReturnItem {
  id: string;
  businessId: string;
  returnId: string;
  saleItemId: string;
  saleId: string;
  productId: string;
  productName: string;
  productBrand?: string;
  serialItemId?: string;
  quantity: number;
  unitPrice: number;
  refundAmount: number;
  serialRestoredTo?: string;
  isActive: boolean;
  createdAt: string;
}

// ── 3B: EMI Sales Management ──

export type EmiStatus = 'ACTIVE' | 'COMPLETED' | 'DEFAULTED' | 'CANCELLED';
export type EmiInterestType = 'REDUCING' | 'FLAT';
export type InstallmentStatus = 'PENDING' | 'PAID' | 'OVERDUE' | 'WAIVED';

export interface MSEmiPlan {
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
  installments?: MSEmiInstallment[];
  _count?: { installments: number };
}

export interface MSEmiInstallment {
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

// ── 3C: Customer Loyalty and CRM ──

export type LoyaltyTier = 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
export type LoyaltyTransactionType = 'EARN' | 'REDEEM' | 'BONUS' | 'ADJUST';
export type LoyaltyOfferType = 'DOUBLE_POINTS' | 'BONUS_POINTS';

export interface MSCustomer {
  id: string;
  businessId: string;
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  totalSpent: number;
  visitCount: number;
  lastVisitAt?: string;
  loyaltyPoints: number;
  loyaltyTier: LoyaltyTier;
  preferredPaymentMethod?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    sales: number;
    emiPlans: number;
  };
}

export interface MSLoyaltyConfig {
  id: string;
  businessId: string;
  earnRatePoints: number;
  earnRateAmount: number;
  redeemPointsRequired: number;
  redeemRateValue: number;
  tierBronze: number;
  tierSilver: number;
  tierGold: number;
  tierPlatinum: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { offers: number };
}

export interface MSLoyaltyTransaction {
  id: string;
  businessId: string;
  customerId: string;
  type: LoyaltyTransactionType;
  points: number;
  balanceAfter: number;
  saleId?: string;
  offerId?: string;
  description?: string;
  createdAt: string;
}

export interface MSLoyaltyOffer {
  id: string;
  businessId: string;
  configId: string;
  name: string;
  offerType: LoyaltyOfferType;
  multiplier: number;
  bonusPoints?: number;
  startDate: string;
  endDate: string;
  description?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// ── 3D: Warranty Tracking and Alerts ──

export type WarrantyStatus = 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED';
export type WarrantyClaimStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

export interface MSWarranty {
  id: string;
  businessId: string;
  serialItemId: string;
  serialNumber: string;
  imei?: string;
  productId: string;
  productName: string;
  productBrand?: string;
  status: string;
  customerName?: string;
  customerPhone?: string;
  saleId?: string;
  warrantyMonths: number;
  warrantyStart?: string;
  warrantyEnd?: string;
  warrantyStatus: WarrantyStatus;
  daysRemaining: number;
  _count?: { warrantyClaims: number };
  createdAt: string;
  updatedAt: string;
}

export interface MSWarrantyClaim {
  id: string;
  businessId: string;
  serialItemId: string;
  customerName: string;
  customerPhone?: string;
  issueDescription: string;
  status: WarrantyClaimStatus;
  resolutionNotes?: string;
  approvedAt?: string;
  completedAt?: string;
  approvedById?: string;
  jobCardId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  serialItem?: {
    id: string;
    serialNumber: string;
    imei?: string;
    productName?: string;
    productBrand?: string;
  };
}

// ── 4A: Project and Site Survey Management ──

export type ProjectStatus = 'PLANNING' | 'SURVEY' | 'PROCUREMENT' | 'INSTALLATION' | 'TESTING' | 'HANDOVER' | 'COMPLETED' | 'CANCELLED';
export type ProjectType = 'INSTALLATION' | 'MAINTENANCE' | 'UPGRADE' | 'REPAIR';
export type CameraType = 'Bullet' | 'Dome' | 'PTZ' | 'Box' | 'Turret';
export type CableType = 'Cat5e' | 'Cat6' | 'Coaxial' | 'Fiber';

export interface MSProject {
  id: string;
  businessId: string;
  projectName: string;
  projectCode: string;
  clientId?: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  clientAddress?: string;
  status: ProjectStatus;
  projectType: ProjectType;
  totalItems: number;
  completedItems: number;
  projectValue: number;
  startDate?: string;
  deadline?: string;
  completedAt?: string;
  siteAddress?: string;
  siteContact?: string;
  siteContactPhone?: string;
  saleId?: string;
  notes?: string;
  internalNotes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: {
    surveys: number;
  };
}

export interface MSSiteSurvey {
  id: string;
  businessId: string;
  projectId: string;
  floorPlanData?: string;
  floorPlanName?: string;
  surveyDate: string;
  surveyorName?: string;
  notes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  cameraPositions?: MSCameraPosition[];
  cableRoutes?: MSCableRoute[];
  _count?: {
    cameraPositions: number;
    cableRoutes: number;
  };
}

export interface MSCameraPosition {
  id: string;
  businessId: string;
  surveyId: string;
  posX: number;
  posY: number;
  label: string;
  cameraType: CameraType;
  resolution?: string;
  notes?: string;
  sortOrder: number;
  createdAt: string;
}

export interface MSCableRoute {
  id: string;
  businessId: string;
  surveyId: string;
  label: string;
  points: string; // JSON: [{x,y},...]
  cableType: CableType;
  cableLength?: number;
  notes?: string;
  sortOrder: number;
  createdAt: string;
}

// ── 4C: Annual Maintenance Contracts ──

export type AmcStatus = 'ACTIVE' | 'EXPIRING_SOON' | 'EXPIRED' | 'CANCELLED';
export type AmcCoverageType = 'Basic' | 'Standard' | 'Premium';
export type AmcPaymentFrequency = 'MONTHLY' | 'QUARTERLY' | 'ANNUAL';
export type AmcVisitType = 'SCHEDULED' | 'EMERGENCY' | 'RENEWAL';

export interface MSAmcContract {
  id: string;
  businessId: string;
  contractCode: string;
  clientId?: string;
  clientName: string;
  clientPhone?: string;
  clientEmail?: string;
  clientAddress?: string;
  coverageType: AmcCoverageType;
  startDate: string;
  endDate: string;
  totalAmount: number;
  paymentFrequency: AmcPaymentFrequency;
  paymentAmount: number;
  visitsIncluded: number;
  slaTerms?: string;
  responseHours: number;
  status: AmcStatus;
  totalVisitsUsed: number;
  totalRevenue: number;
  notes?: string;
  internalNotes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  _count?: { visits: number };
  visits?: MSAmcVisit[];
}

export interface MSAmcVisit {
  id: string;
  businessId: string;
  contractId: string;
  visitDate: string;
  technicianName?: string;
  technicianId?: string;
  visitType: AmcVisitType;
  workPerformed?: string;
  partsReplaced?: string;
  partsCost: number;
  findings?: string;
  customerSignOff: boolean;
  visitNotes?: string;
  isActive: boolean;
  createdAt: string;
}

// ── 4D: Installation Task Scheduling ──

export type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'OVERDUE' | 'CANCELLED';
export type TaskPriority = 'LOW' | 'NORMAL' | 'HIGH' | 'URGENT';

export interface MSInstallationTask {
  id: string;
  businessId: string;
  projectId: string;
  taskTitle: string;
  scheduledDate: string;
  completedDate?: string;
  assignedToId?: string;
  assignedToName?: string;
  location?: string;
  siteAddress?: string;
  status: TaskStatus;
  priority: TaskPriority;
  totalChecklist: number;
  completedChecklist: number;
  notes?: string;
  internalNotes?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  project?: {
    id: string;
    projectName: string;
    projectCode: string;
    clientName: string;
    siteAddress?: string;
  };
  checklists?: MSTaskChecklist[];
  _count?: { checklists: number };
}

export interface MSTaskChecklist {
  id: string;
  businessId: string;
  taskId: string;
  itemText: string;
  isCompleted: boolean;
  sortOrder: number;
  notes?: string;
  completedAt?: string;
  isActive: boolean;
  createdAt: string;
}

// ── 5A: NBR Compliance – BIN & Tax Configuration ──

export type TaxRegistrationStatus = 'UNREGISTERED' | 'REGISTERED' | 'EXEMPT';

export interface MSNbrConfig {
  id: string;
  businessId: string;
  bin?: string;
  taxRegistrationStatus: TaxRegistrationStatus;
  applicableVatRate: number;
  mushakInvoicePrefix: string;
  mushakInvoiceSeq: number;
  legalName?: string;
  legalAddress?: string;
  tradeLicenseNo?: string;
  isVatEnabled: boolean;
  autoMushakInvoice: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  hsCodeMappings?: MSHsCodeMapping[];
  _count?: { hsCodeMappings: number };
}

export interface MSHsCodeMapping {
  id: string;
  businessId: string;
  configId: string;
  category: string;
  hsCode: string;
  description?: string;
  vatRate: number;
  isDefault: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// Default HS codes for Bangladesh electronics
export const DEFAULT_HS_CODES: Omit<MSHsCodeMapping, 'id' | 'businessId' | 'configId' | 'isActive' | 'createdAt' | 'updatedAt'>[] = [
  { category: 'Cameras', hsCode: '8525.89', description: 'Television cameras, digital cameras, CCTV cameras', vatRate: 15, isDefault: true },
  { category: 'NVRs', hsCode: '8521.90', description: 'Video recording or reproducing apparatus (NVR/DVR)', vatRate: 15, isDefault: true },
  { category: 'DVRs', hsCode: '8521.90', description: 'Digital video recorders', vatRate: 15, isDefault: true },
  { category: 'Cables', hsCode: '8544.42', description: 'Electrical connectors, coaxial cables, Cat5e/Cat6', vatRate: 15, isDefault: true },
  { category: 'Hard Drives', hsCode: '8471.70', description: 'Magnetic or optical storage units (HDD/SSD)', vatRate: 15, isDefault: true },
  { category: 'Monitors', hsCode: '8528.72', description: 'Color monitors/TVs with tuner', vatRate: 15, isDefault: true },
  { category: 'Power Supplies', hsCode: '8504.40', description: 'Static converters / power supply units', vatRate: 15, isDefault: true },
  { category: 'Routers & Switches', hsCode: '8517.62', description: 'Machines for reception of data (routers, switches)', vatRate: 15, isDefault: true },
  { category: 'Accessories', hsCode: '8518.90', description: 'CCTV accessories – mounts, housings, connectors', vatRate: 15, isDefault: true },
  { category: 'Mobile Phones', hsCode: '8517.13', description: 'Smartphones', vatRate: 15, isDefault: true },
];

// ── 5B: Mushak 6.3 Tax Invoice ──

export interface MSMushakInvoice {
  id: string;
  businessId: string;
  saleId: string;
  invoiceNumber: string;
  issueDate: string;
  sellerName: string;
  sellerAddress?: string;
  sellerBin?: string;
  buyerName: string;
  buyerAddress?: string;
  buyerBin?: string;
  subtotal: number;
  totalVat: number;
  grandTotal: number;
  discountAmount: number;
  amountInWords?: string;
  isActive: boolean;
  createdAt: string;
  lineItems?: MSMushakLineItem[];
  _count?: { lineItems: number };
}

export interface MSMushakLineItem {
  id: string;
  businessId: string;
  invoiceId: string;
  slNo: number;
  productName: string;
  hsCode?: string;
  quantity: number;
  unitPrice: number;
  totalPrice: number;
  vatRate: number;
  vatAmount: number;
  warrantyMonths?: number;    // Warranty duration in months
  warrantyEnd?: string;       // ISO date string for warranty expiry
  warrantyNote?: string;      // Human-readable warranty note
  isActive: boolean;
  createdAt: string;
}

// ── 5D: Monthly VAT Return (Mushak 9.1) ──

export type VatReturnStatus = 'DRAFT' | 'SUBMITTED' | 'APPROVED';

export interface MSVatReturn {
  id: string;
  businessId: string;
  taxYear: number;
  taxMonth: number;
  openingCredit: number;
  localPurchaseCredit: number;
  localPurchaseValue: number;
  localPurchaseCount: number;
  importCredit: number;
  importValue: number;
  importCount: number;
  totalInputCredit: number;
  outputTax: number;
  salesValue: number;
  salesCount: number;
  netVatPayable: number;
  adjustmentAmount: number;
  adjustmentNote?: string;
  adjustedNetVat: number;
  status: VatReturnStatus;
  declaredBy?: string;
  declaredAt?: string;
  submittedAt?: string;
  amountInWords?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface VatReturnCalcResult {
  // Auto-calculated from data
  openingCredit: number;
  localPurchaseCredit: number;
  localPurchaseValue: number;
  localPurchaseCount: number;
  importCredit: number;
  importValue: number;
  importCount: number;
  totalInputCredit: number;
  outputTax: number;
  salesValue: number;
  salesCount: number;
  netVatPayable: number;
}

// Bangla month names for Mushak 9.1
export const BANGLA_MONTHS: Record<number, string> = {
  1: 'January', 2: 'February', 3: 'March', 4: 'April',
  5: 'May', 6: 'June', 7: 'July', 8: 'August',
  9: 'September', 10: 'October', 11: 'November', 12: 'December',
};

// Number to English words (for BDT amount)
export function numberToWords(num: number): string {
  if (num === 0) return 'Zero Taka Only';
  const isNegative = num < 0;
  const absNum = Math.abs(Math.round(num * 100) / 100);
  const taka = Math.floor(absNum);
  const poisha = Math.round((absNum - taka) * 100);

  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
    'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  function convert(n: number): string {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : '');
    if (n < 1000) return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' and ' + convert(n % 100) : '');
    if (n < 100000) return convert(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + convert(n % 1000) : '');
    if (n < 10000000) return convert(Math.floor(n / 100000)) + ' Lakh' + (n % 100000 ? ' ' + convert(n % 100000) : '');
    if (n < 1000000000) return convert(Math.floor(n / 10000000)) + ' Crore' + (n % 10000000 ? ' ' + convert(n % 10000000) : '');
    return convert(Math.floor(n / 1000000000)) + ' Billion' + (n % 1000000000 ? ' ' + convert(n % 1000000000) : '');
  }

  let result = '';
  if (taka > 0) result += convert(taka) + ' Taka';
  if (poisha > 0) result += (taka > 0 ? ' and ' : '') + convert(poisha) + ' Poisha';
  result += ' Only';
  if (isNegative) result = 'Minus ' + result;
  return result;
}