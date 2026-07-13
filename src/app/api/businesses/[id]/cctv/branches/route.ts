// GET/POST /api/businesses/[id]/cctv/branches
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const branches = await db.mSBranch.findMany({
      where: { businessId, isActive: true },
      include: {
        _count: { select: { serialItems: { where: { status: "IN_STOCK" } } } },
      },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
    });
    return NextResponse.json(branches);
  } catch (error) {
    console.error("List branches error:", error);
    return NextResponse.json({ error: "Failed to list branches" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const body = await req.json();
    const { name, code: inputCode, address, phone } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: "Branch name is required" }, { status: 400 });
    }

    // Auto-generate code from name if not provided
    let code = (inputCode || "").trim().toUpperCase();
    if (!code) {
      code = name.trim().replace(/[^a-zA-Z]/g, "").substring(0, 3).toUpperCase();
    }

    if (code.length < 2 || code.length > 10) {
      return NextResponse.json({ error: "Branch code must be 2-10 characters" }, { status: 400 });
    }

    // Check uniqueness
    const existing = await db.mSBranch.findFirst({
      where: { businessId, code, isActive: true },
    });
    if (existing) {
      return NextResponse.json({ error: `Branch code "${code}" is already in use` }, { status: 409 });
    }

    // Check if this is the first branch
    const branchCount = await db.mSBranch.count({ where: { businessId } });
    const isDefault = branchCount === 0;

    const branch = await db.mSBranch.create({
      data: {
        businessId,
        name: name.trim(),
        code,
        address: address?.trim() || null,
        phone: phone?.trim() || null,
        isDefault,
      },
    });

    return NextResponse.json(branch, { status: 201 });
  } catch (error) {
    console.error("Create branch error:", error);
    return NextResponse.json({ error: "Failed to create branch" }, { status: 500 });
  }
}