import { db } from '@/lib/db';
import { NextRequest, NextResponse } from 'next/server';

const BUSINESS_ID = 'bus_placeholder';

const SEED_HS_CODES = [
  { category: 'Cameras', hsCode: '8525.89', description: 'Television cameras, digital cameras, CCTV cameras', vatRate: 15 },
  { category: 'NVRs', hsCode: '8521.90', description: 'Video recording or reproducing apparatus (NVR/DVR)', vatRate: 15 },
  { category: 'DVRs', hsCode: '8521.90', description: 'Digital video recorders', vatRate: 15 },
  { category: 'Cables', hsCode: '8544.42', description: 'Electrical connectors, coaxial cables, Cat5e/Cat6', vatRate: 15 },
  { category: 'Hard Drives', hsCode: '8471.70', description: 'Magnetic or optical storage units (HDD/SSD)', vatRate: 15 },
  { category: 'Monitors', hsCode: '8528.72', description: 'Color monitors/TVs with tuner', vatRate: 15 },
  { category: 'Power Supplies', hsCode: '8504.40', description: 'Static converters / power supply units', vatRate: 15 },
  { category: 'Routers & Switches', hsCode: '8517.62', description: 'Machines for reception of data (routers, switches)', vatRate: 15 },
  { category: 'Accessories', hsCode: '8518.90', description: 'CCTV accessories – mounts, housings, connectors', vatRate: 15 },
  { category: 'Mobile Phones', hsCode: '8517.13', description: 'Smartphones', vatRate: 15 },
];

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: _businessId } = await params;

    // Ensure config exists
    let config = await db.cCTVNbrConfig.findUnique({ where: { businessId: BUSINESS_ID } });
    if (!config) {
      config = await db.cCTVNbrConfig.create({ data: { businessId: BUSINESS_ID } });
    }

    // Soft-delete existing non-default mappings
    await db.cCTVHsCodeMapping.updateMany({
      where: { businessId: BUSINESS_ID, isDefault: true, isActive: true },
      data: { isActive: false },
    });

    // Re-seed defaults
    const created = await db.cCTVHsCodeMapping.createMany({
      data: SEED_HS_CODES.map((h) => ({
        businessId: BUSINESS_ID,
        configId: config.id,
        ...h,
        isDefault: true,
      })),
    });

    return NextResponse.json({
      success: true,
      message: `Seeded ${created.count} default HS codes`,
    });
  } catch (error) {
    console.error('[HS-CODES-SEED]', error);
    return NextResponse.json({ success: false, error: 'Failed to seed defaults' }, { status: 500 });
  }
}