import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

const BUSINESS_ID = 'bus_placeholder';

// ── Mushak 6.2: Sales Register ──
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: _businessId } = await params;
    const { searchParams } = new URL(_req.url);
    const fromDate = searchParams.get('from') || '';
    const toDate = searchParams.get('to') || '';

    const dateFilter: Record<string, unknown> = {};
    if (fromDate) dateFilter.gte = new Date(fromDate);
    if (toDate) dateFilter.lte = new Date(toDate + 'T23:59:59');

    const invoices = await db.cCTVMushakInvoice.findMany({
      where: {
        businessId: BUSINESS_ID,
        isActive: true,
        ...(Object.keys(dateFilter).length > 0 && { issueDate: dateFilter }),
      },
      include: {
        lineItems: { where: { isActive: true }, orderBy: { slNo: 'asc' } },
      },
      orderBy: { issueDate: 'asc' },
    });

    // Flatten: one row per line item
    const rows = invoices.flatMap((inv) =>
      (inv.lineItems || []).map((item) => ({
        date: inv.issueDate.toISOString().split('T')[0],
        invoiceNumber: inv.invoiceNumber,
        buyerName: inv.buyerName,
        buyerBin: inv.buyerBin || '',
        productName: item.productName,
        hsCode: item.hsCode || '',
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        totalPrice: item.totalPrice,
        vatRate: item.vatRate,
        vatAmount: item.vatAmount,
      })),
    );

    const summary = {
      totalInvoices: invoices.length,
      totalSaleValue: invoices.reduce((s, i) => s + i.subtotal, 0),
      totalVat: invoices.reduce((s, i) => s + i.totalVat, 0),
      grandTotal: invoices.reduce((s, i) => s + i.grandTotal, 0),
    };

    return NextResponse.json({ success: true, data: rows, summary });
  } catch (error) {
    console.error('[MUSHAK-6.2]', error);
    return NextResponse.json({ success: false, error: 'Failed to load sales register' }, { status: 500 });
  }
}