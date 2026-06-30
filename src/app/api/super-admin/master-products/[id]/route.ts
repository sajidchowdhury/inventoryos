// GET/PUT/DELETE /api/super-admin/master-products/[id]

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { verifySuperAdmin } from "../_shared";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const product = await db.masterProduct.findUnique({ where: { id }, include: { manufacturer: true } });
  if (!product) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ success: true, product });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  try {
    const body = await req.json();
    const allowed = ["name","genericName","strength","dosageForm","manufacturerStr","categoryName","scheduleType","hsnCode","vatRate","defaultMrp","dgdaRegNo","barcode","unit","stripSize","boxSize","isActive"];
    const data: any = {};
    for (const k of allowed) if (body[k] !== undefined) data[k] = body[k];
    const product = await db.masterProduct.update({ where: { id }, data });
    return NextResponse.json({ success: true, product });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await verifySuperAdmin(req);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await db.masterProduct.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}
