import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

const BUSINESS_ID = 'bus_placeholder';

// ── Default HS codes seeded on first config creation ──
const SEED_HS_CODES = [
  { category: 'Cameras', hsCode: '8525.89', description: 'Television cameras, digital cameras, CCTV cameras', vatRate: 15, isDefault: true },
  { category: 'NVRs', hsCode: '8521.90', description: 'Video recording or reproducing apparatus (NVR/DVR)', vatRate: 15, isDefault: true },
  { category: 'DVRs', hsCode: '8521.90', description: 'Digital video recorders', vatRate: 15, isDefault: true },
  { category: 'Cables', hsCode: '8544.42', description: 'Electrical connectors, coaxial cables, Cat5e/Cat6', vatRate: 15, isDefault: true },
  { category: 'Hard Drives', hsCode: '8471.70', description: 'Magnetic or optical storage units (HDD/SSD)', vatRate: 15, isDefault: true },
  { category: 'Monitors', hsCode: '8528.72', description: 'Color monitors/TVs with tuner', vatRate: 15, isDefault: true },
  { category: 'Power Supplies', hsCode: '8504.40', description: 'Static converters / power supply units', vatRate: 15, isDefault: true },
  { category: 'Routers & Switches', hsCode: '8517.62', description: 'Machines for reception of data (routers, switches)', vatRate: 15, isDefault: true },
  { category: 'Accessories', hsCode: '8518.90', description: 'CCTV accessories – mounts, housings, connectors', vatRate: 15, isDefault: true },
  { category: 'Mobile Phones', hsCode: '8517.13', description: 'Smartphones', vatRate: 15, isDefault: true },
];

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: _businessId } = await params;

    let config = await db.cCTVNbrConfig.findUnique({
      where: { businessId: BUSINESS_ID },
      include: {
        hsCodeMappings: {
          where: { isActive: true },
          orderBy: { category: 'asc' },
        },
      },
    });

    // Auto-create on first access
    if (!config) {
      config = await db.cCTVNbrConfig.create({
        data: {
          businessId: BUSINESS_ID,
          hsCodeMappings: {
            create: SEED_HS_CODES.map((h) => ({
              businessId: BUSINESS_ID,
              ...h,
            })),
          },
        },
        include: {
          hsCodeMappings: {
            where: { isActive: true },
            orderBy: { category: 'asc' },
          },
        },
      });
    }

    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    console.error('[NBR-CONFIG-GET]', error);
    return NextResponse.json({ success: false, error: 'Failed to load NBR config' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: _businessId } = await params;
    const body = await req.json();

    const {
      bin,
      taxRegistrationStatus,
      applicableVatRate,
      mushakInvoicePrefix,
      legalName,
      legalAddress,
      tradeLicenseNo,
      isVatEnabled,
      autoMushakInvoice,
    } = body;

    // Upsert the config
    const config = await db.cCTVNbrConfig.upsert({
      where: { businessId: BUSINESS_ID },
      create: {
        businessId: BUSINESS_ID,
        bin: bin || null,
        taxRegistrationStatus: taxRegistrationStatus || 'UNREGISTERED',
        applicableVatRate: applicableVatRate ?? 15.0,
        mushakInvoicePrefix: mushakInvoicePrefix || 'MUSHAK',
        legalName: legalName || null,
        legalAddress: legalAddress || null,
        tradeLicenseNo: tradeLicenseNo || null,
        isVatEnabled: isVatEnabled ?? false,
        autoMushakInvoice: autoMushakInvoice ?? false,
      },
      update: {
        ...(bin !== undefined && { bin: bin || null }),
        ...(taxRegistrationStatus !== undefined && { taxRegistrationStatus }),
        ...(applicableVatRate !== undefined && { applicableVatRate }),
        ...(mushakInvoicePrefix !== undefined && { mushakInvoicePrefix }),
        ...(legalName !== undefined && { legalName: legalName || null }),
        ...(legalAddress !== undefined && { legalAddress: legalAddress || null }),
        ...(tradeLicenseNo !== undefined && { tradeLicenseNo: tradeLicenseNo || null }),
        ...(isVatEnabled !== undefined && { isVatEnabled }),
        ...(autoMushakInvoice !== undefined && { autoMushakInvoice }),
      },
    });

    return NextResponse.json({ success: true, data: config });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return NextResponse.json({ success: false, error: 'BIN already in use' }, { status: 409 });
    }
    console.error('[NBR-CONFIG-PUT]', error);
    return NextResponse.json({ success: false, error: 'Failed to update NBR config' }, { status: 500 });
  }
}