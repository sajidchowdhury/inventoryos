import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { numberToWords } from '@/modules/cctv-shop/types';

// GET /api/businesses/[id]/cctv/vat-returns?year=X&month=Y
// - Without year/month: list all saved returns (latest first)
// - With year+month: return auto-calculated data for that month (includes existing saved record if any)
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: businessId } = await params;
  const { searchParams } = new URL(request.url);
  const yearParam = searchParams.get('year');
  const monthParam = searchParams.get('month');

  // ── List all saved returns ──
  if (!yearParam || !monthParam) {
    const returns = await db.mSVatReturn.findMany({
      where: { businessId, isActive: true },
      orderBy: [{ taxYear: 'desc' }, { taxMonth: 'desc' }],
    });
    return NextResponse.json({ success: true, data: returns });
  }

  // ── Auto-calculate for a specific month ──
  const taxYear = parseInt(yearParam, 10);
  const taxMonth = parseInt(monthParam, 10);
  if (isNaN(taxYear) || isNaN(taxMonth) || taxMonth < 1 || taxMonth > 12) {
    return NextResponse.json({ success: false, error: 'Invalid year or month' }, { status: 400 });
  }

  const monthStart = new Date(taxYear, taxMonth - 1, 1);
  const monthEnd = new Date(taxYear, taxMonth, 0, 23, 59, 59, 999);
  // Previous month end for opening credit
  const prevMonthStart = new Date(taxYear, taxMonth - 2, 1);
  const prevMonthEnd = new Date(taxYear, taxMonth - 1, 0, 23, 59, 59, 999);

  // Section E: Output tax from Mushak 6.3 invoices (sales)
  const salesInvoices = await db.mSMushakInvoice.findMany({
    where: {
      businessId,
      isActive: true,
      issueDate: { gte: monthStart, lte: monthEnd },
    },
  });

  const outputTax = salesInvoices.reduce((sum, inv) => sum + inv.totalVat, 0);
  const salesValue = salesInvoices.reduce((sum, inv) => sum + inv.subtotal, 0);
  const salesCount = salesInvoices.length;

  // Section B: Input tax credit from local purchases
  // We aggregate from MSSaleItems linked to completed sales in the period.
  // For purchases, we look at serial items stocked in during the period (costPrice × qty).
  // Since there is no MSPurchase model yet, we use MSMushakInvoice for supplier-side
  // and fall back to cost-based calculation from serial items.
  const serialItemsInPeriod = await db.mSSerialItem.findMany({
    where: {
      businessId,
      purchaseDate: { gte: monthStart, lte: monthEnd },
      status: { in: ['IN_STOCK', 'SOLD', 'INSTALLED', 'WARRANTY_ACTIVE'] },
      isActive: true,
    },
  });

  const localPurchaseValue = serialItemsInPeriod.reduce((sum, item) => sum + (item.costPrice || 0), 0);
  const localPurchaseCount = new Set(serialItemsInPeriod.map((item) => item.purchaseId || item.id)).size;

  // Use the NBR config VAT rate for purchase credit calculation
  const nbrConfig = await db.mSNbrConfig.findUnique({
    where: { businessId },
  });
  const vatRate = nbrConfig?.applicableVatRate || 15;
  const localPurchaseCredit = localPurchaseValue * (vatRate / 100);

  // Section C: Imports (not applicable for most CCTV shops – set to 0)
  const importCredit = 0;
  const importValue = 0;
  const importCount = 0;

  // Section A: Opening credit = adjustedNetVat from previous month's return (if negative = refundable = credit)
  // If no previous return, opening credit = 0
  let openingCredit = 0;
  const prevReturn = await db.mSVatReturn.findFirst({
    where: { businessId, isActive: true, taxYear, taxMonth: taxMonth - 1 },
  });
  if (prevReturn) {
    // If previous month had a refundable amount (negative netVatPayable), it carries forward as credit
    openingCredit = Math.max(0, -prevReturn.adjustedNetVat);
  }

  // Section D: Total input credit
  const totalInputCredit = openingCredit + localPurchaseCredit + importCredit;

  // Section F: Net VAT payable
  const netVatPayable = outputTax - totalInputCredit;

  // Check if a saved return already exists for this month
  const existingReturn = await db.mSVatReturn.findUnique({
    where: { businessId_taxYear_taxMonth: { businessId, taxYear, taxMonth } },
  });

  return NextResponse.json({
    success: true,
    data: {
      calculated: {
        openingCredit,
        localPurchaseCredit,
        localPurchaseValue,
        localPurchaseCount,
        importCredit,
        importValue,
        importCount,
        totalInputCredit,
        outputTax,
        salesValue,
        salesCount,
        netVatPayable,
      },
      saved: existingReturn,
    },
  });
}

// POST /api/businesses/[id]/cctv/vat-returns
// Create or re-create a VAT return for a specific month
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: businessId } = await params;
  const body = await request.json();
  const {
    taxYear, taxMonth,
    openingCredit, localPurchaseCredit, localPurchaseValue, localPurchaseCount,
    importCredit, importValue, importCount, totalInputCredit,
    outputTax, salesValue, salesCount, netVatPayable,
    adjustmentAmount, adjustmentNote, declaredBy, status,
  } = body;

  if (!taxYear || !taxMonth || taxMonth < 1 || taxMonth > 12) {
    return NextResponse.json({ success: false, error: 'Valid taxYear and taxMonth (1-12) are required' }, { status: 400 });
  }

  const adjustedNetVat = netVatPayable + (adjustmentAmount || 0);
  const amountInWords = numberToWords(Math.abs(adjustedNetVat));

  const vatReturn = await db.mSVatReturn.upsert({
    where: { businessId_taxYear_taxMonth: { businessId, taxYear, taxMonth } },
    create: {
      businessId,
      taxYear, taxMonth,
      openingCredit: openingCredit || 0,
      localPurchaseCredit: localPurchaseCredit || 0,
      localPurchaseValue: localPurchaseValue || 0,
      localPurchaseCount: localPurchaseCount || 0,
      importCredit: importCredit || 0,
      importValue: importValue || 0,
      importCount: importCount || 0,
      totalInputCredit: totalInputCredit || 0,
      outputTax: outputTax || 0,
      salesValue: salesValue || 0,
      salesCount: salesCount || 0,
      netVatPayable: netVatPayable || 0,
      adjustmentAmount: adjustmentAmount || 0,
      adjustmentNote: adjustmentNote || null,
      adjustedNetVat,
      declaredBy: declaredBy || null,
      declaredAt: status === 'SUBMITTED' ? new Date() : null,
      submittedAt: status === 'SUBMITTED' ? new Date() : null,
      status: status || 'DRAFT',
      amountInWords: adjustedNetVat >= 0 ? amountInWords : `Minus ${amountInWords}`,
    },
    update: {
      openingCredit: openingCredit || 0,
      localPurchaseCredit: localPurchaseCredit || 0,
      localPurchaseValue: localPurchaseValue || 0,
      localPurchaseCount: localPurchaseCount || 0,
      importCredit: importCredit || 0,
      importValue: importValue || 0,
      importCount: importCount || 0,
      totalInputCredit: totalInputCredit || 0,
      outputTax: outputTax || 0,
      salesValue: salesValue || 0,
      salesCount: salesCount || 0,
      netVatPayable: netVatPayable || 0,
      adjustmentAmount: adjustmentAmount || 0,
      adjustmentNote: adjustmentNote ?? undefined,
      adjustedNetVat,
      declaredBy: declaredBy ?? undefined,
      declaredAt: status === 'SUBMITTED' ? new Date() : undefined,
      submittedAt: status === 'SUBMITTED' ? new Date() : undefined,
      status: status || 'DRAFT',
      amountInWords: adjustedNetVat >= 0 ? amountInWords : `Minus ${amountInWords}`,
    },
  });

  return NextResponse.json({ success: true, data: vatReturn });
}