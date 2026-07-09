import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

const BUSINESS_ID = 'bus_placeholder';

// ── Mushak 6.1: Purchase Register ──
// Auto-populated from Purchase + PurchaseItem + Supplier records.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: _businessId } = await params;
    const { searchParams } = new URL(_req.url);
    const fromDate = searchParams.get('from') || '';
    const toDate = searchParams.get('to') || '';

    const dateFilter: Record<string, unknown> = {};
    if (fromDate) dateFilter.gte = new Date(fromDate);
    if (toDate) dateFilter.lte = new Date(toDate + 'T23:59:59');

    const purchases = await db.purchase.findMany({
      where: {
        businessId: BUSINESS_ID,
        status: 'received',
        ...(Object.keys(dateFilter).length > 0 && { createdAt: dateFilter }),
      },
      include: {
        supplier: { select: { name: true, phone: true } },
        items: { where: { businessId: BUSINESS_ID } },
      },
      orderBy: { createdAt: 'asc' },
    });

    // Flatten: one row per purchase item
    const rows = purchases.flatMap((p) =>
      (p.items || []).map((item) => ({
        date: (p.receivedDate || p.invoiceDate || p.createdAt).toISOString().split('T')[0],
        chalanNo: p.invoiceNo || p.purchaseNo,
        supplierName: p.supplier?.name || 'Unknown',
        supplierBin: '', // Supplier model does not have BIN field yet
        productName: item.productName,
        hsCode: '', // HS codes not tracked on purchases yet
        quantity: item.receivedQuantity || item.quantity,
        unitCost: item.unitCost,
        totalValue: item.totalPrice,
        vatRate: 0,
        vatAmount: 0, // taxAmount is at purchase level, not per-item
      })),
    );

    const summary = {
      totalPurchases: purchases.length,
      totalPurchaseValue: purchases.reduce((s, p) => s + p.totalAmount, 0),
      totalTax: purchases.reduce((s, p) => s + p.taxAmount, 0),
      grandTotal: purchases.reduce((s, p) => s + p.totalAmount + p.taxAmount, 0),
    };

    return NextResponse.json({ success: true, data: rows, summary });
  } catch (error) {
    console.error('[MUSHAK-6.1]', error);
    return NextResponse.json({ success: false, error: 'Failed to load purchase register' }, { status: 500 });
  }
}