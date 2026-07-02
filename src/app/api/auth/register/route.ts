// POST /api/auth/register
// Register a new business + create admin credentials
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { hashPassword, generateShopCode } from "@/lib/auth";

export async function POST(req: NextRequest) {
  try {
    const { userId, businessTypeId, businessName, address, username, password } =
      await req.json();

    if (!userId || !businessTypeId || !businessName || !username || !password) {
      return NextResponse.json(
        { error: "All required fields must be filled" },
        { status: 400 }
      );
    }

    if (password.length < 4) {
      return NextResponse.json(
        { error: "Password must be at least 4 characters" },
        { status: 400 }
      );
    }

    if (username.length < 3) {
      return NextResponse.json(
        { error: "Username must be at least 3 characters" },
        { status: 400 }
      );
    }

    // Resolve business type from slug if needed
    let resolvedBusinessTypeId = businessTypeId;
    if (businessTypeId && !businessTypeId.startsWith("cl")) {
      // It's a slug, look up the ID
      const businessType = await db.businessType.findUnique({
        where: { slug: businessTypeId },
      });
      if (!businessType) {
        return NextResponse.json(
          { error: "Invalid business type" },
          { status: 400 }
        );
      }
      resolvedBusinessTypeId = businessType.id;
    }

    // Look up the type slug so the shop code prefix matches the business type.
    const businessType = await db.businessType.findUnique({
      where: { id: resolvedBusinessTypeId },
      select: { slug: true },
    });

    // Create the business with a unique shop code (retry on the rare collision).
    let business;
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        business = await db.business.create({
          data: {
            userId,
            businessTypeId: resolvedBusinessTypeId,
            name: businessName,
            address: address || null,
            shopCode: generateShopCode(businessType?.slug),
          },
          include: {
            businessType: {
              select: { slug: true, name: true, color: true, icon: true },
            },
          },
        });
        break;
      } catch (err: unknown) {
        // P2002 = unique constraint violation (shopCode collision) → retry.
        const code = (err as { code?: string })?.code;
        if (code === "P2002" && attempt < 5) continue;
        throw err;
      }
    }
    if (!business) {
      return NextResponse.json(
        { error: "Could not allocate a unique shop code. Please try again." },
        { status: 500 }
      );
    }

    // Create admin credentials for this business
    const passwordHash = await hashPassword(password);
    const businessUser = await db.businessUser.create({
      data: {
        businessId: business.id,
        username,
        passwordHash,
        role: "admin",
      },
    });

    return NextResponse.json({
      success: true,
      business: {
        id: business.id,
        name: business.name,
        address: business.address,
        shopCode: business.shopCode,
        businessType: business.businessType,
        hasCredentials: true,
        businessUsers: [
          {
            id: businessUser.id,
            username: businessUser.username,
            role: businessUser.role,
          },
        ],
      },
    });
  } catch (error: unknown) {
    console.error("Register error:", error);
    const message =
      error instanceof Error && error.message.includes("Unique")
        ? "This username is already taken for this business. Try a different one."
        : "Registration failed. Please try again.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
