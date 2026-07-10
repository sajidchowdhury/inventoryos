// GET/POST /api/businesses/[id]/cctv/sales
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const VALID_METHODS = ["CASH", "CARD", "BKASH", "NAGAD", "ROCKET"];

// GET: List sales with optional filters
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const url = new URL(req.url);
    const status = url.searchParams.get("status")?.trim() || "";
    const search = url.searchParams.get("search")?.trim() || "";
    const from = url.searchParams.get("from")?.trim() || "";
    const to = url.searchParams.get("to")?.trim() || "";
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "20", 10) || 20, 100);
    const offset = Math.max(parseInt(url.searchParams.get("offset") || "0", 10) || 0, 0);

    const where: Record<string, unknown> = { businessId, isActive: true };

    if (status) {
      where.status = status;
    }

    if (search) {
      where.OR = [
        { saleCode: { contains: search } },
        { customerName: { contains: search } },
        { customerPhone: { contains: search } },
      ];
    }

    if (from || to) {
      const createdAtFilter: Record<string, unknown> = {};
      if (from) createdAtFilter.gte = new Date(from);
      if (to) createdAtFilter.lte = new Date(to);
      where.createdAt = createdAtFilter;
    }

    const [sales, total] = await Promise.all([
      db.cCTVSale.findMany({
        where,
        include: {
          _count: {
            select: { items: true, payments: true },
          },
        },
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      db.cCTVSale.count({ where }),
    ]);

    return NextResponse.json({ sales, total, limit, offset });
  } catch (error) {
    console.error("List sales error:", error);
    return NextResponse.json({ error: "Failed to list sales" }, { status: 500 });
  }
}

// POST: Create a sale with items and optional payments in a single transaction
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const body = await req.json();

    const {
      customerName,
      customerPhone,
      customerId,
      discountAmount,
      items,
      payments,
    } = body as {
      customerName?: string;
      customerPhone?: string;
      customerId?: string;
      discountAmount?: number;
      items: { productId: string; serialItemId?: string; quantity: number; unitPrice: number }[];
      payments?: { method: string; amount: number; referenceNumber?: string; receivedBy?: string }[];
    };

    // Validate items
    if (!items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "At least one sale item is required" }, { status: 400 });
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.productId) {
        return NextResponse.json({ error: `Item ${i + 1}: productId is required` }, { status: 400 });
      }
      if (!item.quantity || item.quantity < 1) {
        return NextResponse.json({ error: `Item ${i + 1}: quantity must be at least 1` }, { status: 400 });
      }
      if (item.unitPrice == null || item.unitPrice < 0) {
        return NextResponse.json({ error: `Item ${i + 1}: unitPrice is required and must be >= 0` }, { status: 400 });
      }
    }

    // Validate payments if provided
    if (payments && Array.isArray(payments)) {
      for (let i = 0; i < payments.length; i++) {
        const p = payments[i];
        if (!VALID_METHODS.includes(p.method)) {
          return NextResponse.json(
            { error: `Payment ${i + 1}: invalid method. Must be one of ${VALID_METHODS.join(", ")}` },
            { status: 400 },
          );
        }
        if (!p.amount || p.amount <= 0) {
          return NextResponse.json({ error: `Payment ${i + 1}: amount must be > 0` }, { status: 400 });
        }
      }
    }

    // Auto-generate saleCode: SAL-YYYY-NNN
    const year = new Date().getFullYear();
    const lastSale = await db.cCTVSale.findFirst({
      where: { businessId, saleCode: { startsWith: `SAL-${year}-` } },
      orderBy: { saleCode: "desc" },
      select: { saleCode: true },
    });
    let seq = 1;
    if (lastSale) {
      const parts = lastSale.saleCode.split("-");
      const lastSeq = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }
    const saleCode = `SAL-${year}-${String(seq).padStart(3, "0")}`;

    // Look up all products to get name/brand/serialTracked
    const productIds = items.map((it) => it.productId);
    const productMap = new Map<string, { name: string; brand: string; serialTracked: boolean }>();
    const products = await db.cCTVProduct.findMany({
      where: { id: { in: productIds }, businessId },
      select: { id: true, name: true, brand: true, serialTracked: true, stock: true },
    });
    for (const p of products) {
      productMap.set(p.id, { name: p.name, brand: p.brand, serialTracked: p.serialTracked });
    }

    // Validate all products exist
    for (let i = 0; i < items.length; i++) {
      if (!productMap.has(items[i].productId)) {
        return NextResponse.json({ error: `Item ${i + 1}: product not found` }, { status: 404 });
      }
    }

    // Validate serial items if provided
    if (items.some((it) => it.serialItemId)) {
      const serialItemIds = items.filter((it) => it.serialItemId).map((it) => it.serialItemId!);
      const serialItems = await db.cCTVSerialItem.findMany({
        where: { id: { in: serialItemIds }, businessId, isActive: true, status: "IN_STOCK" },
        select: { id: true, productId: true, status: true },
      });
      const serialMap = new Map(serialItems.map((si) => [si.id, si]));

      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.serialItemId) {
          const si = serialMap.get(item.serialItemId);
          if (!si) {
            return NextResponse.json(
              { error: `Item ${i + 1}: serial item not found, not active, or not IN_STOCK` },
              { status: 400 },
            );
          }
          if (si.productId !== item.productId) {
            return NextResponse.json(
              { error: `Item ${i + 1}: serial item does not belong to this product` },
              { status: 400 },
            );
          }
        }
      }
    }

    // Calculate totals
    const subtotal = items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
    const disc = discountAmount || 0;
    const totalDue = subtotal - disc;

    // Execute in transaction
    const sale = await db.$transaction(async (tx) => {
      // Create the sale
      const createdSale = await tx.cCTVSale.create({
        data: {
          businessId,
          saleCode,
          status: "PENDING",
          customerName: customerName?.trim() || "Walk-in Customer",
          customerPhone: customerPhone?.trim() || null,
          customerId: customerId || null,
          subtotal,
          discountAmount: disc,
          totalDue,
          isActive: true,
        },
      });

      // Create sale items
      for (const item of items) {
        const prod = productMap.get(item.productId)!;
        const totalPrice = item.unitPrice * item.quantity;

        await tx.cCTVSaleItem.create({
          data: {
            businessId,
            saleId: createdSale.id,
            productId: item.productId,
            serialItemId: item.serialItemId || null,
            productName: prod.name,
            productBrand: prod.brand,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice,
            isActive: true,
          },
        });

        // Handle serial item: mark as SOLD + create history
        if (item.serialItemId) {
          await tx.cCTVSerialItem.update({
            where: { id: item.serialItemId },
            data: {
              status: "SOLD",
              saleId: createdSale.id,
              customerName: customerName?.trim() || "Walk-in Customer",
              customerPhone: customerPhone?.trim() || null,
            },
          });

          await tx.cCTVSerialItemHistory.create({
            data: {
              businessId,
              serialItemId: item.serialItemId,
              fromStatus: "IN_STOCK",
              toStatus: "SOLD",
              event: "SOLD",
              referenceId: createdSale.id,
              referenceType: "SALE",
              notes: `Sold via ${saleCode}`,
            },
          });
        }

        // Decrease stock for non-serial-tracked products
        if (!prod.serialTracked) {
          await tx.cCTVProduct.update({
            where: { id: item.productId },
            data: { stock: { decrement: item.quantity } },
          });
        }
      }

      // Create payments if provided
      if (payments && payments.length > 0) {
        for (const p of payments) {
          await tx.cCTVPayment.create({
            data: {
              businessId,
              saleId: createdSale.id,
              method: p.method,
              amount: p.amount,
              referenceNumber: p.referenceNumber?.trim() || null,
              receivedBy: p.receivedBy?.trim() || null,
              isActive: true,
            },
          });
        }

        // Calculate payment status
        const paymentSum = payments.reduce((s, p) => s + p.amount, 0);
        let status = "PENDING";
        let completedAt: Date | null = null;

        if (paymentSum >= totalDue) {
          status = "PAID";
          completedAt = new Date();
        } else if (paymentSum > 0) {
          status = "PARTIALLY_PAID";
        }

        await tx.cCTVSale.update({
          where: { id: createdSale.id },
          data: { status, completedAt },
        });

        createdSale.status = status;
        createdSale.completedAt = completedAt;
      }

      // 3C: Auto-create/lookup customer + earn loyalty points
      let linkedCustomerId = customerId || null;
      const trimmedPhone = customerPhone?.trim() || null;
      const trimmedName = customerName?.trim() || "Walk-in Customer";

      if (trimmedPhone && !linkedCustomerId) {
        // Look up existing customer by phone
        const existingCustomer = await tx.customer.findFirst({
          where: { businessId, phone: trimmedPhone, isActive: true },
        });
        if (existingCustomer) {
          linkedCustomerId = existingCustomer.id;
        } else {
          // Create new customer
          const newCustomer = await tx.customer.create({
            data: {
              businessId,
              name: trimmedName,
              phone: trimmedPhone,
              loyaltyPoints: 0,
              loyaltyTier: "BRONZE",
              totalSpent: 0,
              visitCount: 0,
              isActive: true,
            },
          });
          linkedCustomerId = newCustomer.id;
        }
      }

      // Update sale with linked customerId if found/created
      if (linkedCustomerId && !customerId) {
        await tx.cCTVSale.update({
          where: { id: createdSale.id },
          data: { customerId: linkedCustomerId },
        });
        createdSale.customerId = linkedCustomerId;
      }

      // Earn loyalty points if we have a linked customer and loyalty is active
      if (linkedCustomerId) {
        const loyaltyConfig = await tx.cCTVLoyaltyConfig.findUnique({
          where: { businessId },
        });

        if (loyaltyConfig && loyaltyConfig.isActive && loyaltyConfig.earnRateAmount > 0) {
          const earnedPoints = Math.floor(totalDue / loyaltyConfig.earnRateAmount) * loyaltyConfig.earnRatePoints;

          if (earnedPoints > 0) {
            // Check for active double-points offers
            const now = new Date();
            const activeOffer = await tx.cCTVLoyaltyOffer.findFirst({
              where: {
                businessId,
                configId: loyaltyConfig.id,
                offerType: "DOUBLE_POINTS",
                isActive: true,
                startDate: { lte: now },
                endDate: { gte: now },
              },
            });

            const multiplier = activeOffer ? activeOffer.multiplier : 1;
            const finalPoints = Math.floor(earnedPoints * multiplier);

            const updatedCustomer = await tx.customer.update({
              where: { id: linkedCustomerId },
              data: {
                loyaltyPoints: { increment: finalPoints },
                totalSpent: { increment: totalDue },
                visitCount: { increment: 1 },
                lastVisitAt: now,
              },
            });

            // Recalculate tier
            const newTotal = (updatedCustomer.totalSpent || 0);
            let tier = "BRONZE";
            if (newTotal >= (loyaltyConfig.tierPlatinum || 500000)) tier = "PLATINUM";
            else if (newTotal >= (loyaltyConfig.tierGold || 200000)) tier = "GOLD";
            else if (newTotal >= (loyaltyConfig.tierSilver || 50000)) tier = "SILVER";

            if (tier !== updatedCustomer.loyaltyTier) {
              await tx.customer.update({
                where: { id: linkedCustomerId },
                data: { loyaltyTier: tier },
              });
            }

            // Create loyalty transaction
            await tx.cCTVLoyaltyTransaction.create({
              data: {
                businessId,
                customerId: linkedCustomerId,
                type: "EARN",
                points: finalPoints,
                balanceAfter: (updatedCustomer.loyaltyPoints || 0) + finalPoints,
                saleId: createdSale.id,
                offerId: activeOffer?.id || null,
                description: activeOffer
                  ? `Earned ${finalPoints} pts (${activeOffer.name}) on ${saleCode}`
                  : `Earned ${finalPoints} pts on ${saleCode}`,
              },
            });

            // Check for BONUS_POINTS offers
            const bonusOffer = await tx.cCTVLoyaltyOffer.findFirst({
              where: {
                businessId,
                configId: loyaltyConfig.id,
                offerType: "BONUS_POINTS",
                isActive: true,
                startDate: { lte: now },
                endDate: { gte: now },
              },
            });

            if (bonusOffer && bonusOffer.bonusPoints && bonusOffer.bonusPoints > 0) {
              const bonusBalance = (updatedCustomer.loyaltyPoints || 0) + finalPoints + bonusOffer.bonusPoints;
              await tx.customer.update({
                where: { id: linkedCustomerId },
                data: { loyaltyPoints: { increment: bonusOffer.bonusPoints } },
              });
              await tx.cCTVLoyaltyTransaction.create({
                data: {
                  businessId,
                  customerId: linkedCustomerId,
                  type: "BONUS",
                  points: bonusOffer.bonusPoints,
                  balanceAfter: bonusBalance,
                  saleId: createdSale.id,
                  offerId: bonusOffer.id,
                  description: `Bonus ${bonusOffer.bonusPoints} pts (${bonusOffer.name})`,
                },
              });
            }
          } else {
            // No points earned but still update visit stats
            await tx.customer.update({
              where: { id: linkedCustomerId },
              data: {
                totalSpent: { increment: totalDue },
                visitCount: { increment: 1 },
                lastVisitAt: new Date(),
              },
            });
          }
        } else {
          // No loyalty config — just update visit stats
          await tx.customer.update({
            where: { id: linkedCustomerId },
            data: {
              totalSpent: { increment: totalDue },
              visitCount: { increment: 1 },
              lastVisitAt: new Date(),
            },
          });
        }
      }

      return createdSale;
    });

    // Fetch the complete sale with items and payments
    const fullSale = await db.cCTVSale.findUnique({
      where: { id: sale.id },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, brand: true, imageUrl: true } },
            serialItem: { select: { id: true, serialNumber: true, imei: true, status: true } },
          },
        },
        payments: { orderBy: { createdAt: "asc" } },
      },
    });

    return NextResponse.json(fullSale, { status: 201 });
  } catch (error) {
    console.error("Create sale error:", error);
    return NextResponse.json({ error: "Failed to create sale" }, { status: 500 });
  }
}