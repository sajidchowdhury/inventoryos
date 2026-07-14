// POST /api/businesses/[id]/mobile-shop/job-cards/[jobCardId]/otp
// OTP-Based Secure Delivery (Segment 2D)
// Actions: "generate" — creates OTP, "verify" — validates OTP
// OTP is hardcoded to 999999 for development

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const HARDCODED_OTP = "999999";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; jobCardId: string }> }
) {
  try {
    const { id: businessId, jobCardId } = await params;
    const body = await req.json();
    const { action, code } = body;

    if (!action || !["generate", "verify"].includes(action)) {
      return NextResponse.json(
        { error: "Action must be 'generate' or 'verify'" },
        { status: 400 }
      );
    }

    const jobCard = await db.mSJobCard.findFirst({
      where: { id: jobCardId, businessId, isActive: true },
    });

    if (!jobCard) {
      return NextResponse.json({ error: "Job card not found" }, { status: 404 });
    }

    if (jobCard.status !== "READY_FOR_DELIVERY") {
      return NextResponse.json(
        { error: "OTP can only be used when job is READY_FOR_DELIVERY" },
        { status: 409 }
      );
    }

    // ── GENERATE OTP ──
    if (action === "generate") {
      // Update collector info if provided
      const updateData: Record<string, unknown> = {
        otpCode: HARDCODED_OTP,
        otpGeneratedAt: new Date(),
        otpVerified: false,
        otpVerifiedAt: null,
      };

      if (body.collectorName) updateData.collectorName = body.collectorName;
      if (body.collectorPhone) updateData.collectorPhone = body.collectorPhone;
      if (body.collectorNid) updateData.collectorNid = body.collectorNid;

      const updated = await db.mSJobCard.update({
        where: { id: jobCardId },
        data: updateData,
      });

      return NextResponse.json({
        success: true,
        message: "OTP generated successfully",
        otpGenerated: true,
        collectorInfo: {
          collectorName: updated.collectorName,
          collectorPhone: updated.collectorPhone,
          collectorNid: updated.collectorNid,
        },
      });
    }

    // ── VERIFY OTP ──
    if (action === "verify") {
      if (!code) {
        return NextResponse.json(
          { error: "OTP code is required" },
          { status: 400 }
        );
      }

      if (!jobCard.otpCode) {
        return NextResponse.json(
          { error: "OTP has not been generated yet. Please generate OTP first." },
          { status: 409 }
        );
      }

      if (jobCard.otpVerified) {
        return NextResponse.json({
          success: true,
          message: "OTP already verified",
          alreadyVerified: true,
          otpVerified: true,
        });
      }

      // Check if OTP is expired (10 minutes)
      if (jobCard.otpGeneratedAt) {
        const elapsed = Date.now() - new Date(jobCard.otpGeneratedAt).getTime();
        const TEN_MINUTES = 10 * 60 * 1000;
        if (elapsed > TEN_MINUTES) {
          return NextResponse.json(
            { error: "OTP has expired. Please generate a new one." },
            { status: 410 }
          );
        }
      }

      if (code !== jobCard.otpCode) {
        return NextResponse.json(
          { error: "Invalid OTP. Please try again." },
          { status: 401 }
        );
      }

      // Mark as verified
      const updated = await db.mSJobCard.update({
        where: { id: jobCardId },
        data: {
          otpVerified: true,
          otpVerifiedAt: new Date(),
        },
      });

      return NextResponse.json({
        success: true,
        message: "OTP verified successfully",
        otpVerified: true,
        verifiedAt: updated.otpVerifiedAt,
      });
    }

    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  } catch (error) {
    console.error("OTP API error:", error);
    return NextResponse.json({ error: "OTP operation failed" }, { status: 500 });
  }
}