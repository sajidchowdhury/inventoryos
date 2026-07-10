// ── Pharmacy Module: Type Definitions ──
// Specific types for pharmacy inventory management

export interface PharmacyProduct {
  id: string;
  productId: string;
  genericName: string;
  batchNo: string;
  manufacturer: string;
  expiryDate: Date;
  hsnCode?: string;
  mrp: number;
  gstRate: number;
  scheduleType?: "OTC" | "Schedule_H" | "Schedule_H1" | "Schedule_X";
  rackNo?: string;
}

export interface PharmacyExpiryAlert {
  productId: string;
  productName: string;
  batchNo: string;
  expiryDate: Date;
  daysUntilExpiry: number;
  severity: "critical" | "warning" | "notice";
}
