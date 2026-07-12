import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

const BUSINESS_ID = 'bus_placeholder';

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: _businessId } = await params;
    const { searchParams } = new URL(_req.url);
    const search = searchParams.get('search') || '';

    const where: Prisma.CCTVHsCodeMappingWhereInput = {
      businessId: BUSINESS_ID,
      isActive: true,
      ...(search && {
        OR: [
          { category: { contains: search, mode: "insensitive" } },
          { hsCode: { contains: search, mode: "insensitive" } },
          { description: { contains: search, mode: "insensitive" } },
        ],
      }),
    };

    const [mappings, total] = await Promise.all([
      db.cCTVHsCodeMapping.findMany({
        where,
        orderBy: [{ isDefault: 'desc' }, { category: 'asc' }],
      }),
      db.cCTVHsCodeMapping.count({ where }),
    ]);

    return NextResponse.json({ success: true, data: mappings, total });
  } catch (error) {
    console.error('[HS-CODES-GET]', error);
    return NextResponse.json({ success: false, error: 'Failed to load HS codes' }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: _businessId } = await params;
    const body = await req.json();
    const { category, hsCode, description, vatRate } = body;

    if (!category || !hsCode) {
      return NextResponse.json({ success: false, error: 'Category and HS Code are required' }, { status: 400 });
    }

    // Ensure config exists
    let config = await db.cCTVNbrConfig.findUnique({ where: { businessId: BUSINESS_ID } });
    if (!config) {
      config = await db.cCTVNbrConfig.create({ data: { businessId: BUSINESS_ID } });
    }

    const mapping = await db.cCTVHsCodeMapping.create({
      data: {
        businessId: BUSINESS_ID,
        configId: config.id,
        category: category.trim(),
        hsCode: hsCode.trim(),
        description: description?.trim() || null,
        vatRate: vatRate ?? 15,
        isDefault: false,
      },
    });

    return NextResponse.json({ success: true, data: mapping });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ success: false, error: 'HS code for this category already exists' }, { status: 409 });
    }
    console.error('[HS-CODES-POST]', error);
    return NextResponse.json({ success: false, error: 'Failed to create HS code mapping' }, { status: 500 });
  }
}