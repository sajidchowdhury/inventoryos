import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { numberToWords } from '@/modules/mobile-shop/types';

// GET /api/businesses/[id]/mobile-shop/vat-returns/[returnId]
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; returnId: string }> }
) {
  const { id: businessId, returnId } = await params;

  const vatReturn = await db.mSVatReturn.findFirst({
    where: { id: returnId, businessId, isActive: true },
  });

  if (!vatReturn) {
    return NextResponse.json({ success: false, error: 'VAT return not found' }, { status: 404 });
  }

  return NextResponse.json({ success: true, data: vatReturn });
}

// PUT /api/businesses/[id]/mobile-shop/vat-returns/[returnId]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; returnId: string }> }
) {
  const { id: businessId, returnId } = await params;
  const body = await request.json();

  const existing = await db.mSVatReturn.findFirst({
    where: { id: returnId, businessId, isActive: true },
  });
  if (!existing) {
    return NextResponse.json({ success: false, error: 'VAT return not found' }, { status: 404 });
  }

  const {
    openingCredit, localPurchaseCredit, localPurchaseValue, localPurchaseCount,
    importCredit, importValue, importCount, totalInputCredit,
    outputTax, salesValue, salesCount, netVatPayable,
    adjustmentAmount, adjustmentNote, declaredBy, status,
  } = body;

  const adjAmount = adjustmentAmount !== undefined ? adjustmentAmount : existing.adjustmentAmount;
  const newNet = (netVatPayable !== undefined ? netVatPayable : existing.netVatPayable) + adjAmount;
  const amountInWords = numberToWords(Math.abs(newNet));

  const updated = await db.mSVatReturn.update({
    where: { id: returnId },
    data: {
      ...(openingCredit !== undefined && { openingCredit }),
      ...(localPurchaseCredit !== undefined && { localPurchaseCredit }),
      ...(localPurchaseValue !== undefined && { localPurchaseValue }),
      ...(localPurchaseCount !== undefined && { localPurchaseCount }),
      ...(importCredit !== undefined && { importCredit }),
      ...(importValue !== undefined && { importValue }),
      ...(importCount !== undefined && { importCount }),
      ...(totalInputCredit !== undefined && { totalInputCredit }),
      ...(outputTax !== undefined && { outputTax }),
      ...(salesValue !== undefined && { salesValue }),
      ...(salesCount !== undefined && { salesCount }),
      ...(netVatPayable !== undefined && { netVatPayable }),
      ...(adjustmentAmount !== undefined && { adjustmentAmount: adjAmount }),
      ...(adjustmentNote !== undefined && { adjustmentNote: adjustmentNote || null }),
      ...(declaredBy !== undefined && { declaredBy: declaredBy || null }),
      ...(status !== undefined && {
        status,
        declaredAt: status === 'SUBMITTED' && !existing.declaredAt ? new Date() : undefined,
        submittedAt: status === 'SUBMITTED' && !existing.submittedAt ? new Date() : undefined,
      }),
      adjustedNetVat: newNet,
      amountInWords: newNet >= 0 ? amountInWords : `Minus ${amountInWords}`,
    },
  });

  return NextResponse.json({ success: true, data: updated });
}

// DELETE /api/businesses/[id]/mobile-shop/vat-returns/[returnId] (soft delete)
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; returnId: string }> }
) {
  const { id: businessId, returnId } = await params;

  const existing = await db.mSVatReturn.findFirst({
    where: { id: returnId, businessId, isActive: true },
  });
  if (!existing) {
    return NextResponse.json({ success: false, error: 'VAT return not found' }, { status: 404 });
  }

  if (existing.status === 'SUBMITTED' || existing.status === 'APPROVED') {
    return NextResponse.json(
      { success: false, error: 'Cannot delete a submitted or approved return' },
      { status: 400 }
    );
  }

  await db.mSVatReturn.update({
    where: { id: returnId },
    data: { isActive: false },
  });

  return NextResponse.json({ success: true, message: 'VAT return deleted' });
}