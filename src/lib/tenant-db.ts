// ── Tenant-Safe Database Helper ──
// Sets the PostgreSQL session variable 'app.business_id' before queries
// so Row-Level Security (RLS) policies can enforce tenant isolation.
//
// Usage in API routes:
//   import { withTenant } from "@/lib/tenant-db";
//
//   export async function GET(req, { params }) {
//     const { id: businessId } = await params;
//     const result = await withTenant(businessId, async (tx) => {
//       return tx.cCTVSale.findMany({ where: { businessId } });
//     });
//     return NextResponse.json({ sales: result });
//   }
//
// For transactions:
//   const sale = await withTenant(businessId, async (tx) => {
//     // all queries inside use RLS-protected connection
//     const sale = await tx.cCTVSale.create({ ... });
//     await tx.cCTVSaleItem.create({ ... });
//     return sale;
//   });

import { db } from "@/lib/db";

type TransactionCallback<T> = (tx: typeof db) => Promise<T>;

/**
 * Executes a callback with the business_id session variable set.
 * RLS policies on all CCTV tables will filter rows by this business_id.
 *
 * If businessId is null/undefined, no session variable is set (RLS
 * falls back to allowing all rows — useful for admin/super-admin queries).
 */
export async function withTenant<T>(
  businessId: string | null | undefined,
  callback: TransactionCallback<T>
): Promise<T> {
  if (!businessId) {
    // No tenant context — run without RLS restriction
    return callback(db);
  }

  // Set the session variable, then run the callback, then reset
  // We use a transaction to ensure the session variable is scoped
  return db.$transaction(async (tx) => {
    // Set the session variable on this connection
    await tx.$executeRaw`SET LOCAL app.business_id = ${businessId}`;

    // Run the callback — all queries are now RLS-protected
    return callback(tx);
  });
}

/**
 * Sets the tenant context for a raw SQL query.
 * Use this when you need to run raw SQL with RLS protection.
 *
 * Example:
 *   const result = await withTenantRaw(businessId, async (tx) => {
 *     return tx.$queryRaw`SELECT * FROM cctv_sales WHERE "saleDate" >= NOW() - INTERVAL '7 days'`;
 *   });
 */
export async function withTenantRaw<T>(
  businessId: string | null | undefined,
  callback: (tx: typeof db) => Promise<T>
): Promise<T> {
  return withTenant(businessId, callback);
}
