// POST /api/businesses/[id]/cctv/kits/[kitId]/sell
// Phase 6d: Sell a kit — expands components into individual sale items
// with automatic stock deduction and serial item handling.
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

const VALID_METHODS = ["CASH", "CARD", "BKASH", "NAGAD", "ROCKET"];

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; kitId: string }> }
) {
  try {
    const { id: businessId, kitId } = await params;
    const body = await req.json();

    const {
      customerName,
      customerPhone,
      customerId,
      discountAmount,
      payments,
      // Phase 6e: serial items per component index
      // serialSelections: { [componentIndex]: serialItemId }
      // For serial-tracked components, the user picks which specific serial to use
      serialSelections,
    } = body as {
      customerName?: string;
      customerPhone?: string;
      customerId?: string;
      discountAmount?: number;
      payments?: { method: string; amount: number; referenceNumber?: string }[];
      serialSelections?: Record<string, string>;
    };

    // ── Validate kit ──
    const kit = await db.cCTVKitDefinition.findFirst({
      where: { id: kitId, businessId, isActive: true },
      include: {
        components: {
          where: { isRequired: true },
          include: {
            product: {
              select: {
                id: true, name: true, brand: true, serialTracked: true,
                stock: true, sellPrice: true, costPrice: true,
              },
            },
          },
          orderBy: { sortOrder: "asc" },
        },
      },
    });

    if (!kit) {
      return NextResponse.json({ error: "Kit not found or inactive" }, { status: 404 });
    }

    if (kit.components.length === 0) {
      return NextResponse.json({ error: "Kit has no required components" }, { status: 400 });
    }

    // ── Check component stock availability ──
    for (let i = 0; i < kit.components.length; i++) {
      const comp = kit.components[i];
      const prod = comp.product;

      if (prod.serialTracked) {
        // For serial-tracked, count IN_STOCK items
        const inStockCount = await db.cCTVSerialItem.count({
          where: { productId: prod.id, businessId, status: "IN_STOCK", isActive: true },
        });
        if (inStockCount < comp.quantity) {
          return NextResponse.json({
            error: `Insufficient stock for "${prod.name}": need ${comp.quantity}, have ${inStockCount}`,
            componentIndex: i,
            productId: prod.id,
            required: comp.quantity,
            available: inStockCount,
          }, { status: 409 });
        }
      } else {
        if (prod.stock < comp.quantity) {
          return NextResponse.json({
            error: `Insufficient stock for "${prod.name}": need ${comp.quantity}, have ${prod.stock}`,
            componentIndex: i,
            productId: prod.id,
            required: comp.quantity,
            available: prod.stock,
          }, { status: 409 });
        }
      }
    }

    // ── Validate serial selections ──
    // For serial-tracked components, the client may provide specific serial item IDs
    if (serialSelections) {
      for (const [idxStr, serialItemId] of Object.entries(serialSelections)) {
        const idx = parseInt(idxStr, 10);
        if (isNaN(idx) || idx < 0 || idx >= kit.components.length) continue;

        const comp = kit.components[idx];
        if (!comp.product.serialTracked) continue;

        const si = await db.cCTVSerialItem.findFirst({
          where: { id: serialItemId, businessId, productId: comp.product.id, status: "IN_STOCK", isActive: true },
        });
        if (!si) {
          return NextResponse.json({
            error: `Serial item not found, not in stock, or wrong product for "${comp.product.name}"`,
            componentIndex: idx,
          }, { status: 400 });
        }
      }
    }

    // ── Calculate pricing ──
    const componentTotal = kit.components.reduce(
      (sum, c) => sum + c.product.sellPrice * c.quantity,
      0
    );
    const discount = kit.discountPercent > 0
      ? componentTotal * (kit.discountPercent / 100)
      : 0;
    const kitSellPrice = kit.kitPrice != null && kit.kitPrice > 0
      ? kit.kitPrice
      : componentTotal - discount;

    // ── Generate sale code ──
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

    // Validate payments if provided
    if (payments && Array.isArray(payments)) {
      for (let i = 0; i < payments.length; i++) {
        const p = payments[i];
        if (!VALID_METHODS.includes(p.method)) {
          return NextResponse.json(
            { error: `Payment ${i + 1}: invalid method` },
            { status: 400 },
          );
        }
        if (!p.amount || p.amount <= 0) {
          return NextResponse.json({ error: `Payment ${i + 1}: amount must be > 0` }, { status: 400 });
        }
      }
    }

    const disc = discountAmount || 0;
    const totalDue = kitSellPrice - disc;
    const trimmedName = customerName?.trim() || "Walk-in Customer";
    const trimmedPhone = customerPhone?.trim() || null;

    // ── Execute in transaction ──
    const sale = await db.$transaction(async (tx) => {
      const createdSale = await tx.cCTVSale.create({
        data: {
          businessId,
          saleCode,
          status: "PENDING",
          customerName: trimmedName,
          customerPhone: trimmedPhone,
          customerId: customerId || null,
          subtotal: kitSellPrice,
          discountAmount: disc,
          totalDue,
          isActive: true,
        },
      });

      // Create sale items for each component
      for (let i = 0; i < kit.components.length; i++) {
        const comp = kit.components[i];
        const prod = comp.product;

        // Price per unit for this component: proportional to kit price
        const componentShare = componentTotal > 0
          ? (prod.sellPrice * comp.quantity) / componentTotal
          : 1 / kit.components.length;
        const unitPrice = Math.round((kitSellPrice * componentShare) / comp.quantity);

        const selectedSerialId = serialSelections?.[String(i)] || null;

        await tx.cCTVSaleItem.create({
          data: {
            businessId,
            saleId: createdSale.id,
            productId: prod.id,
            serialItemId: selectedSerialId,
            kitId: kit.id,
            productName: prod.name,
            productBrand: prod.brand,
            quantity: comp.quantity,
            unitPrice,
            totalPrice: unitPrice * comp.quantity,
            isActive: true,
          },
        });

        // Handle serial item
        if (selectedSerialId) {
          await tx.cCTVSerialItem.update({
            where: { id: selectedSerialId },
            data: {
              status: "SOLD",
              saleId: createdSale.id,
              customerName: trimmedName,
              customerPhone: trimmedPhone,
            },
          });
          await tx.cCTVSerialItemHistory.create({
            data: {
              businessId,
              serialItemId: selectedSerialId,
              fromStatus: "IN_STOCK",
              toStatus: "SOLD",
              event: "SOLD",
              referenceId: createdSale.id,
              referenceType: "SALE",
              notes: `Sold as part of kit "${kit.name}" via ${saleCode}`,
            },
          });
        } else if (prod.serialTracked) {
          // Auto-pick serial items for serial-tracked products without explicit selection
          const serialsToSell = await tx.cCTVSerialItem.findMany({
            where: {
              productId: prod.id,
              businessId,
              status: "IN_STOCK",
              isActive: true,
            },
            take: comp.quantity,
            orderBy: { createdAt: "asc" },
          });

          for (const si of serialsToSell) {
            await tx.cCTVSaleItem.create({
              data: {
                businessId,
                saleId: createdSale.id,
                productId: prod.id,
                serialItemId: si.id,
                kitId: kit.id,
                productName: prod.name,
                productBrand: prod.brand,
                quantity: 1,
                unitPrice,
                totalPrice: unitPrice,
                isActive: true,
              },
            });
            await tx.cCTVSerialItem.update({
              where: { id: si.id },
              data: {
                status: "SOLD",
                saleId: createdSale.id,
                customerName: trimmedName,
                customerPhone: trimmedPhone,
              },
            });
            await tx.cCTVSerialItemHistory.create({
              data: {
                businessId,
                serialItemId: si.id,
                fromStatus: "IN_STOCK",
                toStatus: "SOLD",
                event: "SOLD",
                referenceId: createdSale.id,
                referenceType: "SALE",
                notes: `Sold as part of kit "${kit.name}" via ${saleCode}`,
              },
            });
          }
        } else {
          // Non-serial: decrement stock
          await tx.cCTVProduct.update({
            where: { id: prod.id },
            data: { stock: { decrement: comp.quantity } },
          });
        }
      }

      // Create payments
      if (payments && payments.length > 0) {
        for (const p of payments) {
          await tx.cCTVPayment.create({
            data: {
              businessId,
              saleId: createdSale.id,
              method: p.method,
              amount: p.amount,
              referenceNumber: p.referenceNumber?.trim() || null,
              receivedBy: null,
              isActive: true,
            },
          });
        }

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

      // Auto-create/lookup customer
      let linkedCustomerId = customerId || null;
      if (trimmedPhone && !linkedCustomerId) {
        const existing = await tx.customer.findFirst({
          where: { businessId, phone: trimmedPhone, isActive: true },
        });
        if (existing) {
          linkedCustomerId = existing.id;
        } else {
          const newCustomer = await tx.customer.create({
            data: {
              businessId, name: trimmedName, phone: trimmedPhone,
              loyaltyPoints: 0, loyaltyTier: "BRONZE", totalSpent: 0,
              visitCount: 0, isActive: true,
            },
          });
          linkedCustomerId = newCustomer.id;
        }
      }
      if (linkedCustomerId && !customerId) {
        await tx.cCTVSale.update({
          where: { id: createdSale.id },
          data: { customerId: linkedCustomerId },
        });
        createdSale.customerId = linkedCustomerId;
      }

      // Loyalty points (simplified — same logic as sales route)
      if (linkedCustomerId) {
        const loyaltyConfig = await tx.cCTVLoyaltyConfig.findUnique({
          where: { businessId },
        });
        if (loyaltyConfig && loyaltyConfig.isActive && loyaltyConfig.earnRateAmount > 0) {
          const earnedPoints = Math.floor(totalDue / loyaltyConfig.earnRateAmount) * loyaltyConfig.earnRatePoints;
          if (earnedPoints > 0) {
            await tx.customer.update({
              where: { id: linkedCustomerId },
              data: {
                loyaltyPoints: { increment: earnedPoints },
                totalSpent: { increment: totalDue },
                visitCount: { increment: 1 },
                lastVisitAt: new Date(),
              },
            });
            await tx.cCTVLoyaltyTransaction.create({
              data: {
                businessId,
                customerId: linkedCustomerId,
                type: "EARN",
                points: earnedPoints,
                balanceAfter: earnedPoints, // simplified
                saleId: createdSale.id,
                description: `Earned ${earnedPoints} pts on kit sale ${saleCode}`,
              },
            });
          } else {
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

    // Fetch complete sale
    const fullSale = await db.cCTVSale.findUnique({
      where: { id: sale.id },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, brand: true, imageUrl: true } },
            serialItem: { select: { id: true, serialNumber: true, imei: true, status: true } },
            kit: { select: { id: true, name: true } },
          },
        },
        payments: { orderBy: { createdAt: "asc" } },
      },
    });

    return NextResponse.json(fullSale, { status: 201 });
  } catch (error) {
    console.error("Kit sell error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to sell kit" },
      { status: 500 }
    );
  }
}