// ── Decimal Serialization Helper ──
// Prisma returns Decimal fields as Prisma.Decimal objects.
// JSON.stringify converts them to strings like "100.00".
// This helper converts all Decimal values in an object to numbers
// so the frontend receives proper numbers, not strings.

type DecimalLike = {
  toNumber: () => number;
};

function isDecimal(value: unknown): value is DecimalLike {
  return (
    typeof value === "object" &&
    value !== null &&
    typeof (value as DecimalLike).toNumber === "function"
  );
}

/**
 * Recursively converts all Prisma.Decimal values in an object to numbers.
 * Use this before returning data from API routes.
 *
 * Example:
 *   const sale = await db.cCTVSale.findUnique({ ... });
 *   return NextResponse.json(serializeDecimals(sale));
 */
export function serializeDecimals<T>(obj: T): T {
  if (obj === null || obj === undefined) return obj;

  if (isDecimal(obj)) {
    return obj.toNumber() as unknown as T;
  }

  if (Array.isArray(obj)) {
    return obj.map(serializeDecimals) as unknown as T;
  }

  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    for (const key of Object.keys(obj as Record<string, unknown>)) {
      result[key] = serializeDecimals((obj as Record<string, unknown>)[key]);
    }
    return result as unknown as T;
  }

  return obj;
}
