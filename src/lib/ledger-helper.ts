// ── Ledger Entry Helper ──
// Creates balanced double-entry ledger entries inside a Prisma transaction.
// Every financial transaction must create equal DEBIT and CREDIT entries.

import { PrismaClient } from "@prisma/client";

type TransactionClient = PrismaClient | Parameters<Parameters<PrismaClient["$transaction"]>[0]>[0];

interface LedgerEntryInput {
  businessId: string;
  accountId: string;
  entryType: "DEBIT" | "CREDIT";
  amount: number;
  referenceId?: string;
  referenceType?: string;
  description?: string;
}

/**
 * Creates balanced ledger entries inside a transaction.
 * Verifies that total debits = total credits before writing.
 *
 * Example:
 *   await createLedgerEntries(tx, businessId, [
 *     { accountId: "customer_receivable", entryType: "DEBIT", amount: 5000, referenceType: "sale", referenceId: sale.id, description: "Sale to customer" },
 *     { accountId: "sales_revenue", entryType: "CREDIT", amount: 5000, referenceType: "sale", referenceId: sale.id, description: "Sale revenue" },
 *   ]);
 */
export async function createLedgerEntries(
  tx: TransactionClient,
  entries: LedgerEntryInput[]
): Promise<void> {
  if (entries.length === 0) return;

  // Verify balanced: sum of debits = sum of credits
  const totalDebit = entries.filter(e => e.entryType === "DEBIT").reduce((s, e) => s + e.amount, 0);
  const totalCredit = entries.filter(e => e.entryType === "CREDIT").reduce((s, e) => s + e.amount, 0);

  if (Math.abs(totalDebit - totalCredit) > 0.01) {
    throw new Error(
      `Unbalanced ledger entries: debits=${totalDebit}, credits=${totalCredit}. ` +
      `Difference: ${totalDebit - totalCredit}. Every transaction must be balanced.`
    );
  }

  // Create all entries
  for (const entry of entries) {
    await tx.cCTVLedgerEntry.create({
      data: {
        businessId: entry.businessId,
        accountId: entry.accountId,
        entryType: entry.entryType,
        amount: entry.amount,
        referenceId: entry.referenceId || null,
        referenceType: entry.referenceType || null,
        description: entry.description || null,
      },
    });
  }
}

// ── Account definitions ──
export const LEDGER_ACCOUNTS = {
  CASH: "cash",
  BANK: "bank",
  BKASH: "bkash",
  NAGAD: "nagad",
  SALES_REVENUE: "sales_revenue",
  PURCHASE_COST: "purchase_cost",
  CUSTOMER_RECEIVABLE: "customer_receivable",
  SUPPLIER_PAYABLE: "supplier_payable",
  EXPENSE: "expense",
  DISCOUNT_GIVEN: "discount_given",
} as const;

// Map payment method to ledger account
export function paymentMethodToAccount(method: string): string {
  switch (method) {
    case "cash": return LEDGER_ACCOUNTS.CASH;
    case "bank": return LEDGER_ACCOUNTS.BANK;
    case "bkash": return LEDGER_ACCOUNTS.BKASH;
    case "nagad": return LEDGER_ACCOUNTS.NAGAD;
    default: return LEDGER_ACCOUNTS.CASH;
  }
}
