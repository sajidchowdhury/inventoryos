// GET /api/businesses?phone=...
// Get all businesses linked to a phone number
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const phone = req.nextUrl.searchParams.get("phone");

    if (!phone) {
      return NextResponse.json(
        { error: "Phone number is required" },
        { status: 400 }
      );
    }

    const cleanPhone = phone.replace(/[\s\-()]/g, "");

    const user = await db.user.findUnique({
      where: { phone: cleanPhone },
      include: {
        businesses: {
          where: { isActive: true },
          include: {
            businessType: {
              select: { slug: true, name: true, color: true, icon: true },
            },
            businessUsers: {
              where: { isActive: true },
              select: { id: true, username: true, role: true },
            },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!user) {
      return NextResponse.json({
        success: true,
        user: null,
        businesses: [],
      });
    }

    return NextResponse.json({
      success: true,
      user: { id: user.id, phone: user.phone, name: user.name },
      businesses: user.businesses.map((b) => ({
        id: b.id,
        name: b.name,
        address: b.address,
        businessType: b.businessType,
        hasCredentials: b.businessUsers.length > 0,
        businessUsers: b.businessUsers,
      })),
    });
  } catch (error) {
    console.error("Get businesses error:", error);
    return NextResponse.json(
      { error: "Failed to fetch businesses" },
      { status: 500 }
    );
  }
}
