import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

const BUSINESS_ID = 'bus_placeholder';

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string; codeId: string }> }) {
  try {
    const { codeId } = await params;
    const body = await req.json();
    const { category, hsCode, description, vatRate } = body;

    // Verify ownership
    const existing = await db.cCTVHsCodeMapping.findFirst({
      where: { id: codeId, businessId: BUSINESS_ID, isActive: true },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'HS code not found' }, { status: 404 });
    }

    const updated = await db.cCTVHsCodeMapping.update({
      where: { id: codeId },
      data: {
        ...(category !== undefined && { category: category.trim() }),
        ...(hsCode !== undefined && { hsCode: hsCode.trim() }),
        ...(description !== undefined && { description: description?.trim() || null }),
        ...(vatRate !== undefined && { vatRate }),
      },
    });

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('[HS-CODE-PUT]', error);
    return NextResponse.json({ success: false, error: 'Failed to update HS code' }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; codeId: string }> }) {
  try {
    const { codeId } = await params;

    const existing = await db.cCTVHsCodeMapping.findFirst({
      where: { id: codeId, businessId: BUSINESS_ID, isActive: true },
    });
    if (!existing) {
      return NextResponse.json({ success: false, error: 'HS code not found' }, { status: 404 });
    }

    await db.cCTVHsCodeMapping.update({
      where: { id: codeId },
      data: { isActive: false },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[HS-CODE-DELETE]', error);
    return NextResponse.json({ success: false, error: 'Failed to delete HS code' }, { status: 500 });
  }
}