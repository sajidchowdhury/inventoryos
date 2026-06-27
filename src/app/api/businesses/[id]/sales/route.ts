// GET/POST /api/businesses/[id]/sales
// POST creates a sale (invoice) with FEFO allocation per line item
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

function calculateBatchStatus(expiryDate: Date): string {
  const diffDays = (expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  if (diffDays < 0) return "expired";
  if (diffDays <= 90) return "near_expiry";
  return "active";
}

// Generate sequential invoice number: INV-YYYY-NNNN
async function generateInvoiceNo(businessId: string): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `INV-${year}-`;

  // Find the highest existing invoice number for this year
  const lastSale = await db.sale.findFirst({
    where: {
      businessId,
      invoiceNo: { startsWith: prefix },
    },
    orderBy: { invoiceNo: "desc" },
    select: { invoiceNo: true },
  });

  let nextNum = 1;
  if (lastSale) {
    const match = lastSale.invoiceNo.match(/INV-\d{4}-(\d+)/);
    if (match) nextNum = parseInt(match[1]) + 1;
  }

  return `${prefix}${nextNum.toString().padStart(4, "0")}`;
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const url = req.nextUrl;
    const customerId = url.searchParams.get("customerId") || "";
    const status = url.searchParams.get("status") || "";
    const paymentStatus = url.searchParams.get("paymentStatus") || "";
    const startDate = url.searchParams.get("startDate") || "";
    const endDate = url.searchParams.get("endDate") || "";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "20");
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { businessId };
    if (customerId) where.customerId = customerId;
    if (status) where.status = status;
    if (paymentStatus) where.paymentStatus = paymentStatus;
    if (startDate || endDate) {
      const dateFilter: Record<string, Date> = {};
      if (startDate) dateFilter.gte = new Date(startDate);
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
      where.createdAt = dateFilter;
    }

    const [sales, total] = await Promise.all([
      db.sale.findMany({
        where,
        include: {
          customer: { select: { id: true, name: true, phone: true } },
          items: {
            select: {
              id: true, productName: true, genericName: true, batchNo: true,
              quantity: true, unit: true, unitPrice: true, discountPercent: true, totalPrice: true,
            },
          },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.sale.count({ where }),
    ]);

    // Summary
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todaySales = await db.sale.aggregate({
      where: {
        businessId,
        status: "completed",
        createdAt: { gte: todayStart, lte: todayEnd },
      },
      _sum: { totalAmount: true },
      _count: true,
    });

    const allTimeSales = await db.sale.aggregate({
      where: { businessId, status: "completed" },
      _sum: { totalAmount: true },
      _count: true,
    });

    return NextResponse.json({
      success: true,
      sales,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      summary: {
        today: {
          count: todaySales._count,
          total: todaySales._sum.totalAmount || 0,
        },
        allTime: {
          count: allTimeSales._count,
          total: allTimeSales._sum.totalAmount || 0,
        },
      },
    });
  } catch (error) {
    console.error("Get sales error:", error);
    return NextResponse.json({ error: "Failed to fetch sales" }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const body = await req.json();

    // Validate items
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
    }

    // Validate each item
    for (const item of body.items) {
      const qty = parseFloat(item.quantity);
      if (!item.productId || isNaN(qty) || qty <= 0) {
        return NextResponse.json(
          { error: "Each item needs productId and positive quantity" },
          { status: 400 }
        );
      }
    }

    // Generate invoice number
    const invoiceNo = await generateInvoiceNo(businessId);

    // Step 1: Run FEFO allocation for each item (dry-run first to validate)
    const allocations = [];
    let subtotal = 0;
    let totalQuantity = 0;

    for (const item of body.items) {
      const requestedQty = parseFloat(item.quantity);

      // Fetch product
      const product = await db.product.findFirst({
        where: { id: item.productId, businessId, isActive: true },
        select: {
          id: true, name: true, genericName: true, unit: true, mrp: true,
          strength: true, dosageForm: true,
        },
      });
      if (!product) {
        return NextResponse.json(
          { error: `Product not found: ${item.productId}` },
          { status: 404 }
        );
      }

      // Fetch batches in FEFO order
      const batches = await db.batch.findMany({
        where: {
          businessId,
          productId: item.productId,
          quantity: { gt: 0 },
          status: { in: ["active", "near_expiry"] },
        },
        orderBy: [{ expiryDate: "asc" }, { createdAt: "asc" }],
      });

      // Run FEFO
      let remaining = requestedQty;
      const itemAllocations = [];
      let totalAvailable = 0;

      for (const batch of batches) {
        totalAvailable += batch.quantity;
        if (remaining <= 0) continue;
        const take = Math.min(batch.quantity, remaining);
        itemAllocations.push({
          batchId: batch.id,
          batchNo: batch.batchNo,
          expiryDate: batch.expiryDate,
          allocated: take,
          mrp: batch.mrp || product.mrp || 0,
        });
        remaining -= take;
      }

      const allocated = requestedQty - remaining;
      if (allocated < requestedQty) {
        return NextResponse.json(
          {
            error: `Insufficient stock for ${product.name}: requested ${requestedQty} ${product.unit}, only ${allocated} available`,
            productId: product.id,
            requested: requestedQty,
            available: allocated,
          },
          { status: 409 }
        );
      }

      // Determine unit price: item.unitPrice override, else MRP from batch, else product.mrp
      const unitPrice = item.unitPrice !== undefined
        ? parseFloat(item.unitPrice)
        : (itemAllocations[0]?.mrp || product.mrp || 0);
      const discountPercent = parseFloat(item.discountPercent) || 0;
      const lineTotal = requestedQty * unitPrice * (1 - discountPercent / 100);

      subtotal += lineTotal;
      totalQuantity += requestedQty;

      allocations.push({
        product,
        quantity: requestedQty,
        unitPrice,
        discountPercent,
        lineTotal,
        batchAllocations: itemAllocations,
      });
    }

    // Step 2: Calculate totals
    const discountPercent = parseFloat(body.discountPercent) || 0;
    const discountAmount = parseFloat(body.discountAmount) || 0;
    const taxRate = parseFloat(body.taxRate) || 0; // percentage

    const afterPercentDiscount = subtotal * (1 - discountPercent / 100);
    const afterFlatDiscount = afterPercentDiscount - discountAmount;
    const taxAmount = afterFlatDiscount * (taxRate / 100);
    const totalAmount = afterFlatDiscount + taxAmount;

    const paidAmount = body.paidAmount !== undefined
      ? parseFloat(body.paidAmount)
      : totalAmount;
    let paymentStatus = "paid";
    if (paidAmount < totalAmount) paymentStatus = "partial";
    if (paidAmount <= 0) paymentStatus = "unpaid";

    // Step 3: Create the sale in a transaction (atomic)
    const sale = await db.$transaction(async (tx) => {
      // Create Sale record
      const newSale = await tx.sale.create({
        data: {
          businessId,
          customerId: body.customerId || null,
          invoiceNo,
          status: "completed",
          paymentMethod: body.paymentMethod || "cash",
          paymentStatus,
          subtotal,
          discountAmount,
          discountPercent,
          taxAmount,
          totalAmount,
          paidAmount,
          itemCount: body.items.length,
          totalQuantity,
          notes: body.notes || null,
          createdBy: body.createdBy || null,
        },
      });

      // Create SaleItems + reduce batch quantities + create audit transactions
      for (const alloc of allocations) {
        let itemBatchId: string | null = null;
        let itemBatchNo: string | null = null;

        for (const ba of alloc.batchAllocations) {
          if (ba.allocated <= 0) continue;

          // Update batch quantity
          const updatedBatch = await tx.batch.update({
            where: { id: ba.batchId },
            data: { quantity: { decrement: ba.allocated } },
          });

          // Recalc status
          const newStatus = calculateBatchStatus(updatedBatch.expiryDate);
          if (updatedBatch.status !== newStatus) {
            await tx.batch.update({
              where: { id: updatedBatch.id },
              data: { status: newStatus },
            });
          }

          // Decrement inventory
          await tx.inventory.updateMany({
            where: { productId: alloc.product.id },
            data: { quantity: { decrement: ba.allocated } },
          });

          // Audit transaction
          await tx.transaction.create({
            data: {
              businessId,
              productId: alloc.product.id,
              batchId: ba.batchId,
              type: "SALE",
              quantity: ba.allocated,
              unitPrice: ba.mrp,
              note: `Sale ${invoiceNo} (batch ${ba.batchNo})`,
            },
          });

          // Use first batch for SaleItem snapshot (if multiple batches, create separate items)
          if (!itemBatchId) {
            itemBatchId = ba.batchId;
            itemBatchNo = ba.batchNo;
          } else {
            // Create additional SaleItem for this batch
            await tx.saleItem.create({
              data: {
                saleId: newSale.id,
                businessId,
                productId: alloc.product.id,
                batchId: ba.batchId,
                productName: alloc.product.name,
                genericName: alloc.product.genericName,
                batchNo: ba.batchNo,
                quantity: ba.allocated,
                unit: alloc.product.unit,
                unitPrice: alloc.unitPrice,
                discountPercent: alloc.discountPercent,
                totalPrice: ba.allocated * alloc.unitPrice * (1 - alloc.discountPercent / 100),
              },
            });
          }
        }

        // Create primary SaleItem (or first one if only one batch)
        const firstAlloc = alloc.batchAllocations.find((a) => a.allocated > 0);
        if (firstAlloc) {
          // Check if we already created additional items (above) — if firstAlloc was used as primary
          const totalAllocated = alloc.batchAllocations.reduce((s, a) => s + a.allocated, 0);
          const additionalItems = alloc.batchAllocations.filter((a) => a.allocated > 0 && a.batchId !== firstAlloc.batchId);
          const primaryQty = firstAlloc.allocated;

          await tx.saleItem.create({
            data: {
              saleId: newSale.id,
              businessId,
              productId: alloc.product.id,
              batchId: firstAlloc.batchId,
              productName: alloc.product.name,
              genericName: alloc.product.genericName,
              batchNo: firstAlloc.batchNo,
              quantity: primaryQty,
              unit: alloc.product.unit,
              unitPrice: alloc.unitPrice,
              discountPercent: alloc.discountPercent,
              totalPrice: primaryQty * alloc.unitPrice * (1 - alloc.discountPercent / 100),
            },
          });
          // Note: additional batch items already created above
          // totalAllocated is the sum for verification
        }
      }

      // Update customer stats if customer linked
      if (body.customerId) {
        await tx.customer.update({
          where: { id: body.customerId },
          data: {
            totalSpent: { increment: totalAmount },
            visitCount: { increment: 1 },
            lastVisitAt: new Date(),
          },
        });
      }

      return newSale;
    });

    // Fetch the complete sale with items
    const completeSale = await db.sale.findUnique({
      where: { id: sale.id },
      include: {
        customer: { select: { id: true, name: true, phone: true } },
        items: true,
      },
    });

    return NextResponse.json({
      success: true,
      sale: completeSale,
      message: `Invoice ${invoiceNo} created — Total: ৳${totalAmount.toFixed(2)}`,
    }, { status: 201 });
  } catch (error) {
    console.error("Create sale error:", error);
    return NextResponse.json({ error: "Failed to create sale" }, { status: 500 });
  }
}
