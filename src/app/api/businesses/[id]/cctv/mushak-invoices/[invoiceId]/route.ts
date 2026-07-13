import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

const BUSINESS_ID = 'bus_placeholder';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; invoiceId: string }> }) {
  try {
    const { invoiceId } = await params;

    const invoice = await db.mSMushakInvoice.findFirst({
      where: { id: invoiceId, businessId: BUSINESS_ID, isActive: true },
      include: {
        lineItems: { where: { isActive: true }, orderBy: { slNo: 'asc' } },
      },
    });

    if (!invoice) {
      return NextResponse.json({ success: false, error: 'Invoice not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, data: invoice });
  } catch (error) {
    console.error('[MUSHAK-GET]', error);
    return NextResponse.json({ success: false, error: 'Failed to load invoice' }, { status: 500 });
  }
}