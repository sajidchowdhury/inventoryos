// src/lib/payment-config.ts
// ── InventoryOS: Payment Configuration Helper (P5) ──
// Reads/writes the PaymentConfig singleton (SSL Commerz creds, method toggles,
// account numbers, editable tier prices). Falls back to env vars + feature-gate.ts
// defaults if no DB row exists.

import { db } from "@/lib/db";

export interface PaymentConfigValue {
  sslStoreId: string | null;
  sslStorePasswd: string | null;
  sslMode: "sandbox" | "production";
  bkashActive: boolean;
  nagadActive: boolean;
  sslActive: boolean;
  bkashNumber: string | null;
  nagadNumber: string | null;
  proMonthly: number;
  proAnnual: number;
  proAiMonthly: number;
  proAiAnnual: number;
}

const DEFAULTS: PaymentConfigValue = {
  sslStoreId: null,
  sslStorePasswd: null,
  sslMode: "sandbox",
  bkashActive: true,
  nagadActive: true,
  sslActive: false,
  bkashNumber: null,
  nagadNumber: null,
  proMonthly: 800,
  proAnnual: 8000,
  proAiMonthly: 1500,
  proAiAnnual: 15000,
};

export async function getPaymentConfig(): Promise<PaymentConfigValue> {
  try {
    const row = await db.paymentConfig.findUnique({ where: { id: "default" } });
    if (!row) {
      // Fall back to env vars for SSL Commerz
      return {
        ...DEFAULTS,
        sslStoreId: process.env.SSL_STORE_ID || null,
        sslStorePasswd: process.env.SSL_STORE_PASSWD || null,
        sslMode: (process.env.SSL_MODE as "sandbox" | "production") || "sandbox",
        sslActive: process.env.SSL_STORE_ID ? true : false,
      };
    }
    return {
      sslStoreId: row.sslStoreId,
      sslStorePasswd: row.sslStorePasswd,
      sslMode: row.sslMode as "sandbox" | "production",
      bkashActive: row.bkashActive,
      nagadActive: row.nagadActive,
      sslActive: row.sslActive,
      bkashNumber: row.bkashNumber,
      nagadNumber: row.nagadNumber,
      proMonthly: row.proMonthly,
      proAnnual: row.proAnnual,
      proAiMonthly: row.proAiMonthly,
      proAiAnnual: row.proAiAnnual,
    };
  } catch {
    return DEFAULTS;
  }
}

export async function updatePaymentConfig(
  data: Partial<PaymentConfigValue>,
  updatedBy: string
): Promise<PaymentConfigValue> {
  const current = await getPaymentConfig();
  const merged = { ...current, ...data };

  await db.paymentConfig.upsert({
    where: { id: "default" },
    create: {
      id: "default",
      sslStoreId: merged.sslStoreId,
      sslStorePasswd: merged.sslStorePasswd,
      sslMode: merged.sslMode,
      bkashActive: merged.bkashActive,
      nagadActive: merged.nagadActive,
      sslActive: merged.sslActive,
      bkashNumber: merged.bkashNumber,
      nagadNumber: merged.nagadNumber,
      proMonthly: merged.proMonthly,
      proAnnual: merged.proAnnual,
      proAiMonthly: merged.proAiMonthly,
      proAiAnnual: merged.proAiAnnual,
      updatedBy,
    },
    update: {
      sslStoreId: merged.sslStoreId,
      sslStorePasswd: merged.sslStorePasswd,
      sslMode: merged.sslMode,
      bkashActive: merged.bkashActive,
      nagadActive: merged.nagadActive,
      sslActive: merged.sslActive,
      bkashNumber: merged.bkashNumber,
      nagadNumber: merged.nagadNumber,
      proMonthly: merged.proMonthly,
      proAnnual: merged.proAnnual,
      proAiMonthly: merged.proAiMonthly,
      proAiAnnual: merged.proAiAnnual,
      updatedBy,
    },
  });

  return merged;
}

/** Returns the active payment methods based on config */
export async function getActivePaymentMethods(): Promise<{
  bkash: boolean;
  nagad: boolean;
  ssl: boolean;
}> {
  const config = await getPaymentConfig();
  return {
    bkash: config.bkashActive,
    nagad: config.nagadActive,
    ssl: config.sslActive && !!config.sslStoreId,
  };
}
