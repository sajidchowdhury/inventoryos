// GET/POST /api/businesses/[id]/cctv/purchases
// CCTV Purchase Order Flow (1B)
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// ── GET: List purchases with filters ──
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const url = req.nextUrl;
    const search = url.searchParams.get("search") || "";
    const status = url.searchParams.get("status") || "";
    const supplierId = url.searchParams.get("supplierId") || "";
    const page = parseInt(url.searchParams.get("page") || "1");
    const limit = parseInt(url.searchParams.get("limit") || "50");
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = { businessId };
    if (search) {
      where.OR = [
        { purchaseNo: { contains: search } },
        { invoiceNo: { contains: search } },
        { supplier: { name: { contains: search } } },
      ];
    }
    if (status) where.status = status;
    if (supplierId) where.supplierId = supplierId;

    const [purchases, total] = await Promise.all([
      db.cCTVPurchase.findMany({
        where,
        include: {
          supplier: { select: { id: true, name: true, code: true } },
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.cCTVPurchase.count({ where }),
    ]);

    // Summary stats
    const summary = await db.cCTVPurchase.aggregate({
      where: { businessId },
      _sum: { totalAmount: true, paidAmount: true },
      _count: true,
    });

    return NextResponse.json({
      success: true,
      purchases,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
      summary: {
        totalCount: summary._count,
        totalValue: summary._sum.totalAmount || 0,
        totalPaid: summary._sum.paidAmount || 0,
      },
    });
  } catch (error) {
    console.error("Get CCTV purchases error:", error);
    return NextResponse.json({ error: "Failed to fetch purchases" }, { status: 500 });
  }
}

// ── POST: Create purchase + generate serial items ──
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: businessId } = await params;
    const body = await req.json();

    const { supplierId, invoiceNo, invoiceDate, notes, items } = body;

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "At least one item is required" }, { status: 400 });
    }

    // Validate items
    for (const item of items) {
      if (!item.productId || !item.quantity || item.quantity < 1) {
        return NextResponse.json({ error: "Each item needs productId and quantity >= 1" }, { status: 400 });
      }
    }

    // Verify all products exist
    const productIds = items.map((i: { productId: string }) => i.productId);
    const products = await db.cCTVProduct.findMany({
      where: { id: { in: productIds }, businessId, isActive: true },
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    for (const item of items) {
      if (!productMap.has(item.productId)) {
        return NextResponse.json({ error: `Product not found: ${item.productId}` }, { status: 400 });
      }
    }

    // Verify supplier exists (if provided)
    if (supplierId) {
      const supplier = await db.supplier.findFirst({
        where: { id: supplierId, businessId, isActive: true },
      });
      if (!supplier) {
        return NextResponse.json({ error: "Supplier not found" }, { status: 404 });
      }
    }

    // Generate purchase number: CPO-YYYY-NNNN
    const now = new Date();
    const year = now.getFullYear();
    const prefix = `CPO-${year}-`;

    // Find the highest existing number for this year
    const lastPurchase = await db.cCTVPurchase.findFirst({
      where: { businessId, purchaseNo: { startsWith: prefix } },
      orderBy: { purchaseNo: "desc" },
      select: { purchaseNo: true },
    });

    let nextNum = 1;
    if (lastPurchase) {
      const lastNumStr = lastPurchase.purchaseNo.replace(prefix, "");
      const lastNum = parseInt(lastNumStr, 10);
      if (!isNaN(lastNum)) nextNum = lastNum + 1;
    }
    const purchaseNo = `${prefix}${nextNum.toString().padStart(4, "0")}`;

    // Calculate totals
    let subtotal = 0;
    const purchaseItems = items.map((item: { productId: string; quantity: number; unitCost: number }) => {
      const product = productMap.get(item.productId)!;
      const unitCost = item.unitCost ?? product.costPrice;
      const quantity = item.quantity;
      const totalPrice = unitCost * quantity;
      subtotal += totalPrice;

      return {
        productId: item.productId,
        productName: product.name,
        productBrand: product.brand,
        quantity,
        receivedQty: 0,
        unitCost,
        totalPrice,
      };
    });

    const discountAmount = body.discountAmount || 0;
    const totalAmount = subtotal - discountAmount;

    // Create purchase with items in a transaction-like flow
    const purchase = await db.cCTVPurchase.create({
      data: {
        businessId,
        supplierId: supplierId || null,
        purchaseNo,
        status: "received",
        subtotal,
        discountAmount,
        totalAmount,
        paidAmount: 0,
        paymentStatus: "unpaid",
        invoiceNo: invoiceNo?.trim() || null,
        invoiceDate: invoiceDate ? new Date(invoiceDate) : null,
        receivedDate: now,
        notes: notes?.trim() || null,
        items: {
          create: purchaseItems.map((pi: { productId: string; productName: string; productBrand: string; quantity: number; receivedQty: number; unitCost: number; totalPrice: number }) => ({
            businessId,
            ...pi,
          })),
        },
      },
      include: {
        supplier: { select: { id: true, name: true, code: true } },
        items: true,
      },
    });

    // ── Create serial items for serial-tracked products ──
    // and increment stock for non-serial products
    const serialResults: { productId: string; productName: string; created: number; method: string }[] = [];

    for (const item of purchase.items) {
      const product = productMap.get(item.productId)!;

      if (product.serialTracked) {
        // Auto-generate serial numbers for serial-tracked products
        for (let i = 0; i < item.quantity; i++) {
          const serialSuffix = (i + 1).toString().padStart(3, "0");
          const serialNumber = `${product.sku || product.name.substring(0, 6).toUpperCase()}-${purchaseNo}-${serialSuffix}`;

          await db.cCTVSerialItem.create({
            data: {
              businessId,
              productId: item.productId,
              serialNumber,
              status: "IN_STOCK",
              grade: "A", // new purchase = grade A
              costPrice: item.unitCost,
              sellPrice: product.sellPrice,
              purchaseId: purchase.id,
              supplierId: supplierId || null,
              purchaseDate: now,
              warrantyMonths: product.warrantyMonths,
              notes: `Auto-generated from ${purchaseNo}`,
            },
          });

          // Create history entry
          // Note: We'd need the serial item ID, but we can't get it easily here in bulk.
          // For now, the history will be created when the serial is first viewed/edited.
        }

        // Update receivedQty
        await db.cCTVPurchaseItem.update({
          where: { id: item.id },
          data: { receivedQty: item.quantity },
        });

        serialResults.push({
          productId: item.productId,
          productName: item.productName,
          created: item.quantity,
          method: "serial-items",
        });
      } else {
        // Non-serial: just increment product stock
        await db.cCTVProduct.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });

        await db.cCTVPurchaseItem.update({
          where: { id: item.id },
          data: { receivedQty: item.quantity },
        });

        serialResults.push({
          productId: item.productId,
          productName: item.productName,
          created: item.quantity,
          method: "stock-increment",
        });
      }
    }

    // ── Update supplier totals if supplier provided ──
    if (supplierId) {
      await db.supplier.update({
        where: { id: supplierId },
        data: {
          totalPurchased: { increment: totalAmount },
          balance: { increment: totalAmount },
        },
      });
    }

    return NextResponse.json({
      success: true,
      purchase,
      serialResults,
      message: `Purchase ${purchaseNo} created with ${purchase.items.length} item(s)`,
    }, { status: 201 });

  } catch (error) {
    console.error("Create CCTV purchase error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to create purchase" },
      { status: 500 }
    );
  }
}