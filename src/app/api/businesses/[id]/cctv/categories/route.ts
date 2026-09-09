// GET/POST /api/businesses/[id]/cctv/categories
// SUB-1: Guarded by requireActiveSubscription — blocked in read_only / data_wiped
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { requireActiveSubscription } from "@/lib/subscription-guard";
import { slugify, uniqueCategorySlug } from "@/lib/cctv-slug";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;
  const categories = await db.cCTVCategory.findMany({
    where: { businessId, isActive: true },
    orderBy: { sortOrder: "asc" },
    include: { _count: { select: { products: true } } },
  });
  return NextResponse.json({ success: true, categories });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: businessId } = await params;

  // SUB-1: Block writes if subscription is in read_only or data_wiped stage.
  const guard = await requireActiveSubscription(businessId);
  if (!guard.allowed) return guard.error!;

  const body = await req.json();
  const name = String(body.name || "").trim();
  if (!name) return NextResponse.json({ error: "Name required" }, { status: 400 });

  // C-2: Pre-check slug uniqueness and append -2, -3, ... if needed.
  // Previously the POST would just create with `slug = name.toLowerCase()...`
  // and let the @@unique([businessId, slug]) constraint throw P2002 → generic
  // "Failed" toast. Now we resolve a free slug up-front.
  const requestedSlug = body.slug ? slugify(body.slug) : slugify(name);
  const slug = await uniqueCategorySlug(businessId, requestedSlug);

  try {
    const category = await db.cCTVCategory.create({
      data: { businessId, name, slug, icon: body.icon || "Package", color: body.color || "#7c3aed" },
    });
    // C-1 fix: wrap response in { success: true, category } for consistency
    return NextResponse.json({ success: true, category }, { status: 201 });
  } catch (err: any) {
    // Race: another category with the same slug was created between our
    // pre-check and the INSERT. Surface a friendly error.
    if (err?.code === "P2002") {
      return NextResponse.json(
        { error: "A category with that name already exists. Try a different name." },
        { status: 409 },
      );
    }
    throw err;
  }
}
