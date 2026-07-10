// GET/POST /api/super-admin/received-payments
// P3: Super-admin uploads received bKash/Nagad payments + lists all.
// On POST (upload), the auto-matching engine runs for each received payment.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { tryMatchReceivedPayment } from "@/lib/payment-matching";

async function verifySuperAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  try {
    const session = await db.superAdminSession.findUnique({
      where: { token },
      select: {
        id: true,
        superAdminId: true,
        expiresAt: true,
        superAdmin: { select: { id: true, isActive: true } },
      },
    });
    if (!session || !session.superAdmin.isActive || session.expiresAt.getTime() <= Date.now()) {
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

// ── GET: list all received payments ──
export async function GET(req: NextRequest) {
  const session = await verifySuperAdmin(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(req.url);
    const filter = url.searchParams.get("filter"); // "matched" | "unmatched" | null
    const method = url.searchParams.get("method"); // "bkash" | "nagad" | null

    const where: Record<string, unknown> = {};
    if (filter === "matched") {
      where.matchedTransactionId = { not: null };
    } else if (filter === "unmatched") {
      where.matchedTransactionId = null;
    }
    if (method) {
      where.method = method;
    }

    const payments = await db.receivedPayment.findMany({
      where,
      orderBy: { receivedAt: "desc" },
      take: 200,
    });

    const matchedCount = payments.filter((p) => p.matchedTransactionId).length;
    const unmatchedCount = payments.length - matchedCount;

    return NextResponse.json({
      success: true,
      payments,
      summary: {
        total: payments.length,
        matched: matchedCount,
        unmatched: unmatchedCount,
      },
    });
  } catch (error) {
    console.error("Received payments GET error:", error);
    return NextResponse.json({ error: "Failed to load received payments" }, { status: 500 });
  }
}

// ── POST: upload received payments (single or bulk) ──
export async function POST(req: NextRequest) {
  const session = await verifySuperAdmin(req);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { payments } = body as { payments?: Array<{ method: string; trxId: string; amount: number }> };

    if (!Array.isArray(payments) || payments.length === 0) {
      return NextResponse.json(
        { error: "Provide a 'payments' array with { method, trxId, amount } objects" },
        { status: 400 }
      );
    }

    let created = 0;
    let matched = 0;
    let unmatched = 0;
    const errors: string[] = [];

    for (const p of payments) {
      if (!p.method || !["bkash", "nagad"].includes(p.method)) {
        errors.push(`Invalid method: ${p.method}`);
        continue;
      }
      if (!p.trxId || p.trxId.trim().length < 6) {
        errors.push(`Invalid TRX ID: ${p.trxId}`);
        continue;
      }
      if (isNaN(p.amount) || p.amount <= 0) {
        errors.push(`Invalid amount: ${p.amount}`);
        continue;
      }

      // Check if this TRX ID was already uploaded
      const existing = await db.receivedPayment.findFirst({
        where: { trxId: p.trxId.trim(), method: p.method },
      });
      if (existing) {
        errors.push(`Already uploaded: ${p.trxId}`);
        continue;
      }

      // Create the received payment
      const received = await db.receivedPayment.create({
        data: {
          method: p.method,
          trxId: p.trxId.trim(),
          amount: p.amount,
          uploadedBy: session.superAdminId,
        },
      });

      created++;

      // Try auto-match
      const result = await tryMatchReceivedPayment(received.id);
      if (result.matched) {
        matched++;
      } else {
        unmatched++;
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        created,
        matched,
        unmatched,
        errors: errors.length,
      },
      errorDetails: errors.length > 0 ? errors : undefined,
      message: `Uploaded ${created} payment(s). ${matched} auto-matched, ${unmatched} pending manual review.`,
    });
  } catch (error) {
    console.error("Received payments POST error:", error);
    return NextResponse.json({ error: "Failed to upload received payments" }, { status: 500 });
  }
}
