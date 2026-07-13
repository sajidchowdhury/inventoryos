// GET /api/businesses/[id]/cctv/transfers/[transferId]
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; transferId: string }> }
) {
  try {
    const { id: businessId, transferId } = await params;

    const transfer = await db.mSTransfer.findFirst({
      where: { id: transferId, businessId },
      include: {
        fromBranch: { select: { id: true, name: true, code: true, address: true, phone: true } },
        toBranch: { select: { id: true, name: true, code: true, address: true, phone: true } },
        items: {
          include: {
            serialItem: {
              include: {
                product: { select: { id: true, name: true, brand: true, imageUrl: true } },
              },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });

    if (!transfer) {
      return NextResponse.json({ error: "Transfer not found" }, { status: 404 });
    }

    return NextResponse.json(transfer);
  } catch (error) {
    console.error("Get transfer error:", error);
    return NextResponse.json({ error: "Failed to get transfer" }, { status: 500 });
  }
}