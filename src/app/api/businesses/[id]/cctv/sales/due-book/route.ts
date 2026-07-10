// GET /api/businesses/[id]/cctv/sales/due-book
// Phase 2B: Customer Due Book
// Aggregates PARTIALLY_PAID sales grouped by customer with aging buckets.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const url = req.nextUrl;
    const search = (url.searchParams.get("search") || "").trim();

    // Fetch all PARTIALLY_PAID sales with payments
    const sales = await db.cCTVSale.findMany({
      where: {
        businessId,
        isActive: true,
        status: "PARTIALLY_PAID",
        ...(search
          ? {
              OR: [
                { customerName: { contains: search } },
                { customerPhone: { contains: search } },
              ],
            }
          : {}),
      },
      include: {
        payments: {
          where: { isActive: true },
          select: { amount: true, createdAt: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const now = new Date();

    // Group by customer
    const customerMap = new Map<string, {
      customerName: string;
      customerPhone: string | null;
      sales: {
        id: string;
        saleCode: string;
        totalDue: number;
        saleDate: string;
        totalPaid: number;
        balance: number;
      }[];
      aging: { bucket0_30: number; bucket31_60: number; bucket61_90: number; bucket90plus: number };
      totalDue: number;
      totalPaid: number;
      totalBalance: number;
    }>();

    for (const sale of sales) {
      const key = sale.customerPhone || sale.customerName || "__walkin__";

      let entry = customerMap.get(key);
      if (!entry) {
        entry = {
          customerName: sale.customerName || "Walk-in Customer",
          customerPhone: sale.customerPhone || null,
          sales: [],
          aging: { bucket0_30: 0, bucket31_60: 0, bucket61_90: 0, bucket90plus: 0 },
          totalDue: 0,
          totalPaid: 0,
          totalBalance: 0,
        };
        customerMap.set(key, entry);
      }

      const totalPaid = sale.payments.reduce((sum, p) => sum + p.amount, 0);
      const balance = sale.totalDue - totalPaid;

      // Calculate aging based on sale date
      const saleDate = new Date(sale.createdAt);
      const daysDiff = Math.floor((now.getTime() - saleDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff <= 30) {
        entry.aging.bucket0_30 += balance;
      } else if (daysDiff <= 60) {
        entry.aging.bucket31_60 += balance;
      } else if (daysDiff <= 90) {
        entry.aging.bucket61_90 += balance;
      } else {
        entry.aging.bucket90plus += balance;
      }

      entry.sales.push({
        id: sale.id,
        saleCode: sale.saleCode,
        totalDue: sale.totalDue,
        saleDate: sale.createdAt,
        totalPaid: Math.round(totalPaid * 100) / 100,
        balance: Math.round(balance * 100) / 100,
      });

      entry.totalDue += sale.totalDue;
      entry.totalPaid += totalPaid;
      entry.totalBalance += balance;
    }

    // Convert to array and sort by total balance descending
    const customers = Array.from(customerMap.values())
      .map((c) => ({
        ...c,
        totalDue: Math.round(c.totalDue * 100) / 100,
        totalPaid: Math.round(c.totalPaid * 100) / 100,
        totalBalance: Math.round(c.totalBalance * 100) / 100,
        aging: {
          bucket0_30: Math.round(c.aging.bucket0_30 * 100) / 100,
          bucket31_60: Math.round(c.aging.bucket31_60 * 100) / 100,
          bucket61_90: Math.round(c.aging.bucket61_90 * 100) / 100,
          bucket90plus: Math.round(c.aging.bucket90plus * 100) / 100,
        },
      }))
      .sort((a, b) => b.totalBalance - a.totalBalance);

    // Summary stats
    const summary = {
      totalCustomers: customers.length,
      totalOutstanding: Math.round(customers.reduce((s, c) => s + c.totalBalance, 0) * 100) / 100,
      totalSales: customers.reduce((s, c) => s + c.sales.length, 0),
      aging: {
        bucket0_30: Math.round(customers.reduce((s, c) => s + c.aging.bucket0_30, 0) * 100) / 100,
        bucket31_60: Math.round(customers.reduce((s, c) => s + c.aging.bucket31_60, 0) * 100) / 100,
        bucket61_90: Math.round(customers.reduce((s, c) => s + c.aging.bucket61_90, 0) * 100) / 100,
        bucket90plus: Math.round(customers.reduce((s, c) => s + c.aging.bucket90plus, 0) * 100) / 100,
      },
    };

    return NextResponse.json({ customers, summary });
  } catch (error) {
    console.error("Due book error:", error);
    return NextResponse.json({ error: "Failed to load due book" }, { status: 500 });
  }
}