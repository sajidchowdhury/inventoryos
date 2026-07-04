// Stock Counting Day (SCD) — business logic for monthly full-stock counts
// while the shop stays open. Products may live in multiple storage zones;
// each zone gets its own count line and totals roll up per product.

import { db } from "@/lib/db";
import type { Prisma, StorageZone } from "@prisma/client";

export type ScdStatus = "draft" | "active" | "closed" | "applied";
export type ZoneSessionStatus = "pending" | "counting" | "review" | "closed";

const SCD_INCLUDE = {
  zoneSessions: {
    orderBy: { sortOrder: "asc" as const },
    include: {
      zone: { select: { id: true, name: true, color: true } },
      _count: { select: { lines: true } },
    },
  },
  summaries: {
    include: {
      product: {
        select: {
          id: true,
          name: true,
          genericName: true,
          unit: true,
          rackNo: true,
        },
      },
    },
  },
} satisfies Prisma.StockCountDayInclude;

export async function getProductStock(
  businessId: string,
  productId: string
): Promise<number> {
  const inv = await db.inventory.findFirst({
    where: { businessId, productId },
    select: { quantity: true },
  });
  return inv?.quantity ?? 0;
}

export async function getActiveStockCountDay(businessId: string) {
  return db.stockCountDay.findFirst({
    where: { businessId, status: "active" },
    include: SCD_INCLUDE,
  });
}

/** Active or closed (awaiting apply) — the current open count session. */
export async function getCurrentStockCountDay(businessId: string) {
  return db.stockCountDay.findFirst({
    where: { businessId, status: { in: ["active", "closed"] } },
    orderBy: { createdAt: "desc" },
    include: SCD_INCLUDE,
  });
}

export async function listStorageZones(businessId: string) {
  return db.storageZone.findMany({
    where: { businessId, isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: {
      _count: { select: { assignments: true } },
    },
  });
}

export async function createStorageZone(
  businessId: string,
  data: { name: string; color?: string; sortOrder?: number }
) {
  const count = await db.storageZone.count({ where: { businessId } });
  return db.storageZone.create({
    data: {
      businessId,
      name: data.name.trim(),
      color: data.color ?? "#0d9488",
      sortOrder: data.sortOrder ?? count,
    },
  });
}

export async function updateStorageZone(
  businessId: string,
  zoneId: string,
  data: Partial<{ name: string; color: string; sortOrder: number; isActive: boolean }>
) {
  const zone = await db.storageZone.findFirst({
    where: { id: zoneId, businessId },
  });
  if (!zone) return null;
  return db.storageZone.update({
    where: { id: zoneId },
    data: {
      ...(data.name !== undefined ? { name: data.name.trim() } : {}),
      ...(data.color !== undefined ? { color: data.color } : {}),
      ...(data.sortOrder !== undefined ? { sortOrder: data.sortOrder } : {}),
      ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
    },
  });
}

/** Replace zone assignments for one product (supports 0, 1, or many zones). */
export async function setProductZoneAssignments(
  businessId: string,
  productId: string,
  zoneIds: string[]
) {
  const product = await db.product.findFirst({
    where: { id: productId, businessId },
    select: { id: true },
  });
  if (!product) return { ok: false as const, error: "Product not found" };

  const uniqueZoneIds = [...new Set(zoneIds)];
  if (uniqueZoneIds.length > 0) {
    const zones = await db.storageZone.count({
      where: { businessId, id: { in: uniqueZoneIds }, isActive: true },
    });
    if (zones !== uniqueZoneIds.length) {
      return { ok: false as const, error: "One or more zones are invalid" };
    }
  }

  await db.$transaction([
    db.productZoneAssignment.deleteMany({ where: { productId, businessId } }),
    ...(uniqueZoneIds.length > 0
      ? [
          db.productZoneAssignment.createMany({
            data: uniqueZoneIds.map((zoneId) => ({
              businessId,
              productId,
              zoneId,
            })),
          }),
        ]
      : []),
  ]);

  return { ok: true as const };
}

export async function getProductZoneMap(businessId: string, productIds: string[]) {
  if (productIds.length === 0) return new Map<string, StorageZone[]>();

  const assignments = await db.productZoneAssignment.findMany({
    where: { businessId, productId: { in: productIds } },
    include: { zone: { select: { id: true, name: true, color: true } } },
  });

  const map = new Map<string, StorageZone[]>();
  for (const a of assignments) {
    const list = map.get(a.productId) ?? [];
    list.push(a.zone);
    map.set(a.productId, list);
  }
  return map;
}

/** Add multiple products to a zone (keeps existing zone assignments on each product). */
export async function addProductsToZone(
  businessId: string,
  zoneId: string,
  productIds: string[]
) {
  const zone = await db.storageZone.findFirst({
    where: { id: zoneId, businessId, isActive: true },
  });
  if (!zone) return { ok: false as const, error: "Zone not found" };

  const uniqueIds = [...new Set(productIds)];
  if (uniqueIds.length === 0) {
    return { ok: true as const, added: 0 };
  }

  const products = await db.product.count({
    where: { businessId, id: { in: uniqueIds }, isActive: true },
  });
  if (products !== uniqueIds.length) {
    return { ok: false as const, error: "One or more products are invalid" };
  }

  const result = await db.productZoneAssignment.createMany({
    data: uniqueIds.map((productId) => ({ businessId, productId, zoneId })),
    skipDuplicates: true,
  });

  return { ok: true as const, added: result.count };
}

/** Ensure a product has an SCD summary row if a count day is active. */
export async function ensureScdProductSummary(businessId: string, productId: string) {
  const active = await getActiveStockCountDay(businessId);
  if (!active) return;

  const existing = await db.stockCountProductSummary.findUnique({
    where: { scdId_productId: { scdId: active.id, productId } },
  });
  if (existing) return;

  const qty = await getProductStock(businessId, productId);
  await db.stockCountProductSummary.create({
    data: {
      scdId: active.id,
      businessId,
      productId,
      systemQtyAtStart: qty,
      soldDuringScd: 0,
    },
  });
}

export async function createStockCountDay(
  businessId: string,
  opts: { name?: string; zoneIds: string[]; startedBy?: string }
) {
  const existing = await getActiveStockCountDay(businessId);
  if (existing) {
    return { ok: false as const, error: "A Stock Count Day is already active" };
  }

  const zones = await db.storageZone.findMany({
    where: { businessId, id: { in: opts.zoneIds }, isActive: true },
    orderBy: { sortOrder: "asc" },
  });
  if (zones.length === 0) {
    return { ok: false as const, error: "Select at least one storage zone" };
  }
  if (zones.length !== opts.zoneIds.length) {
    return { ok: false as const, error: "One or more zones are invalid" };
  }

  const month = new Date().toLocaleString("en-US", { month: "long", year: "numeric" });
  const name = opts.name?.trim() || `Stock Count — ${month}`;

  const scd = await db.stockCountDay.create({
    data: {
      businessId,
      name,
      status: "draft",
      zoneSessions: {
        create: zones.map((z, i) => ({
          businessId,
          zoneId: z.id,
          sortOrder: i,
          status: "pending",
        })),
      },
    },
    include: SCD_INCLUDE,
  });

  return { ok: true as const, scd };
}

export async function startStockCountDay(scdId: string, businessId: string, userId?: string) {
  const scd = await db.stockCountDay.findFirst({
    where: { id: scdId, businessId },
    include: { zoneSessions: true },
  });
  if (!scd) return { ok: false as const, error: "Stock Count Day not found" };
  if (scd.status !== "draft") {
    return { ok: false as const, error: "Only draft sessions can be started" };
  }

  const active = await getActiveStockCountDay(businessId);
  if (active && active.id !== scdId) {
    return { ok: false as const, error: "Another Stock Count Day is already active" };
  }

  const products = await db.product.findMany({
    where: { businessId, isActive: true },
    select: { id: true },
  });

  await db.$transaction(async (tx) => {
    await tx.stockCountDay.update({
      where: { id: scdId },
      data: {
        status: "active",
        startedAt: new Date(),
        startedBy: userId ?? null,
      },
    });

    for (const p of products) {
      const qty = await tx.inventory.findFirst({
        where: { businessId, productId: p.id },
        select: { quantity: true },
      });
      await tx.stockCountProductSummary.create({
        data: {
          scdId,
          businessId,
          productId: p.id,
          systemQtyAtStart: qty?.quantity ?? 0,
          soldDuringScd: 0,
        },
      });
    }
  });

  const updated = await db.stockCountDay.findUnique({
    where: { id: scdId },
    include: SCD_INCLUDE,
  });
  return { ok: true as const, scd: updated! };
}

export async function startZoneCounting(
  zoneSessionId: string,
  businessId: string
) {
  const session = await db.stockCountZoneSession.findFirst({
    where: { id: zoneSessionId, businessId },
    include: {
      scd: { select: { id: true, status: true } },
      zone: true,
    },
  });
  if (!session) return { ok: false as const, error: "Zone session not found" };
  if (session.scd.status !== "active") {
    return { ok: false as const, error: "Stock Count Day is not active" };
  }
  if (session.status === "closed") {
    return { ok: false as const, error: "This zone is already closed" };
  }

  const assignments = await db.productZoneAssignment.findMany({
    where: { businessId, zoneId: session.zoneId },
    select: { productId: true },
  });

  const productIds = assignments.map((a) => a.productId);

  await db.$transaction(async (tx) => {
    if (session.status === "pending") {
      await tx.stockCountZoneSession.update({
        where: { id: zoneSessionId },
        data: { status: "counting" },
      });
    }

    for (const productId of productIds) {
      const existing = await tx.stockCountLine.findUnique({
        where: {
          scdId_zoneSessionId_productId: {
            scdId: session.scdId,
            zoneSessionId,
            productId,
          },
        },
      });
      if (existing) continue;

      await tx.stockCountLine.create({
        data: {
          scdId: session.scdId,
          zoneSessionId,
          zoneId: session.zoneId,
          businessId,
          productId,
          status: "pending",
        },
      });
    }
  });

  return getZoneSessionDetail(zoneSessionId, businessId);
}

export async function getZoneSessionDetail(zoneSessionId: string, businessId: string) {
  const session = await db.stockCountZoneSession.findFirst({
    where: { id: zoneSessionId, businessId },
    include: {
      zone: { select: { id: true, name: true, color: true } },
      scd: { select: { id: true, name: true, status: true } },
      lines: {
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        include: {
          product: {
            select: {
              id: true,
              name: true,
              genericName: true,
              unit: true,
              rackNo: true,
            },
          },
        },
      },
    },
  });
  if (!session) return { ok: false as const, error: "Zone session not found" };

  const productIds = session.lines.map((l) => l.productId);
  const zoneMap = await getProductZoneMap(businessId, productIds);

  const summaries = await db.stockCountProductSummary.findMany({
    where: {
      scdId: session.scdId,
      productId: { in: productIds },
    },
  });
  const summaryByProduct = new Map(summaries.map((s) => [s.productId, s]));

  const otherZoneCounts = await db.stockCountLine.findMany({
    where: {
      scdId: session.scdId,
      productId: { in: productIds },
      zoneSessionId: { not: zoneSessionId },
      countedQty: { not: null },
    },
    include: { zone: { select: { id: true, name: true, color: true } } },
  });
  const otherByProduct = new Map<string, typeof otherZoneCounts>();
  for (const line of otherZoneCounts) {
    const list = otherByProduct.get(line.productId) ?? [];
    list.push(line);
    otherByProduct.set(line.productId, list);
  }

  const lines = session.lines.map((line) => {
    const summary = summaryByProduct.get(line.productId);
    const zones = zoneMap.get(line.productId) ?? [];
    const expectedTotal =
      (summary?.systemQtyAtStart ?? 0) - (summary?.soldDuringScd ?? 0);
    return {
      ...line,
      otherZones: zones.filter((z) => z.id !== session.zoneId),
      countedInOtherZones: (otherByProduct.get(line.productId) ?? []).map((l) => ({
        zoneId: l.zoneId,
        zoneName: l.zone.name,
        zoneColor: l.zone.color,
        countedQty: l.countedQty,
      })),
      expectedTotalQty: expectedTotal,
      isMultiZone: zones.length > 1,
    };
  });

  const counted = lines.filter((l) => l.status === "counted").length;
  const total = lines.length;

  return {
    ok: true as const,
    session: {
      id: session.id,
      status: session.status,
      zone: session.zone,
      scd: session.scd,
      progress: { counted, total, pending: total - counted },
      lines,
    },
  };
}

export async function upsertZoneCountLine(
  businessId: string,
  zoneSessionId: string,
  data: {
    productId: string;
    countedQty: number;
    detectedName?: string;
    confidence?: number;
    shelfScanItemId?: string;
    countedBy?: string;
    notes?: string;
  }
) {
  const session = await db.stockCountZoneSession.findFirst({
    where: { id: zoneSessionId, businessId },
    include: { scd: { select: { id: true, status: true } } },
  });
  if (!session) return { ok: false as const, error: "Zone session not found" };
  if (session.scd.status !== "active") {
    return { ok: false as const, error: "Stock Count Day is not active" };
  }
  if (session.status === "closed") {
    return { ok: false as const, error: "This zone is closed" };
  }

  const product = await db.product.findFirst({
    where: { id: data.productId, businessId },
    select: { id: true },
  });
  if (!product) return { ok: false as const, error: "Product not found" };

  if (session.status === "pending") {
    await startZoneCounting(zoneSessionId, businessId);
  }

  const line = await db.stockCountLine.upsert({
    where: {
      scdId_zoneSessionId_productId: {
        scdId: session.scdId,
        zoneSessionId,
        productId: data.productId,
      },
    },
    create: {
      scdId: session.scdId,
      zoneSessionId,
      zoneId: session.zoneId,
      businessId,
      productId: data.productId,
      countedQty: data.countedQty,
      status: "counted",
      detectedName: data.detectedName ?? null,
      confidence: data.confidence ?? null,
      shelfScanItemId: data.shelfScanItemId ?? null,
      countedBy: data.countedBy ?? null,
      countedAt: new Date(),
      notes: data.notes ?? null,
    },
    update: {
      countedQty: data.countedQty,
      status: "counted",
      detectedName: data.detectedName ?? undefined,
      confidence: data.confidence ?? undefined,
      shelfScanItemId: data.shelfScanItemId ?? undefined,
      countedBy: data.countedBy ?? undefined,
      countedAt: new Date(),
      notes: data.notes ?? undefined,
    },
  });

  await recalcProductSummary(session.scdId, data.productId);

  if (session.status === "counting") {
    const pending = await db.stockCountLine.count({
      where: {
        zoneSessionId,
        status: { not: "counted" },
        countedQty: null,
      },
    });
    if (pending === 0) {
      await db.stockCountZoneSession.update({
        where: { id: zoneSessionId },
        data: { status: "review" },
      });
    }
  }

  return { ok: true as const, line };
}

async function recalcProductSummary(scdId: string, productId: string) {
  const lines = await db.stockCountLine.findMany({
    where: { scdId, productId, countedQty: { not: null } },
    select: { countedQty: true },
  });
  const totalCountedQty = lines.reduce((s, l) => s + (l.countedQty ?? 0), 0);

  const summary = await db.stockCountProductSummary.findUnique({
    where: { scdId_productId: { scdId, productId } },
  });
  if (!summary) return;

  const expected = summary.systemQtyAtStart - summary.soldDuringScd;
  const variance =
    lines.length > 0 ? totalCountedQty - expected : null;

  await db.stockCountProductSummary.update({
    where: { id: summary.id },
    data: {
      totalCountedQty: lines.length > 0 ? totalCountedQty : null,
      variance,
    },
  });
}

export async function closeZoneSession(
  zoneSessionId: string,
  businessId: string,
  userId?: string
) {
  const session = await db.stockCountZoneSession.findFirst({
    where: { id: zoneSessionId, businessId },
    include: { scd: { select: { status: true } } },
  });
  if (!session) return { ok: false as const, error: "Zone session not found" };
  if (session.scd.status !== "active") {
    return { ok: false as const, error: "Stock Count Day is not active" };
  }

  await db.stockCountZoneSession.update({
    where: { id: zoneSessionId },
    data: {
      status: "closed",
      closedAt: new Date(),
      closedBy: userId ?? null,
    },
  });

  return { ok: true as const };
}

export async function closeStockCountDay(
  scdId: string,
  businessId: string,
  userId?: string
) {
  const scd = await db.stockCountDay.findFirst({
    where: { id: scdId, businessId },
    include: { zoneSessions: true },
  });
  if (!scd) return { ok: false as const, error: "Stock Count Day not found" };
  if (scd.status !== "active") {
    return { ok: false as const, error: "Only active sessions can be closed" };
  }

  const openZones = scd.zoneSessions.filter((z) => z.status !== "closed");
  if (openZones.length > 0) {
    return {
      ok: false as const,
      error: `Close all zones first (${openZones.length} still open)`,
    };
  }

  await db.stockCountDay.update({
    where: { id: scdId },
    data: {
      status: "closed",
      closedAt: new Date(),
      closedBy: userId ?? null,
    },
  });

  const updated = await db.stockCountDay.findUnique({
    where: { id: scdId },
    include: SCD_INCLUDE,
  });
  return { ok: true as const, scd: updated! };
}

export async function applyStockCountDay(
  scdId: string,
  businessId: string,
  userId?: string
) {
  const scd = await db.stockCountDay.findFirst({
    where: { id: scdId, businessId },
    include: { summaries: true },
  });
  if (!scd) return { ok: false as const, error: "Stock Count Day not found" };
  if (scd.status !== "closed") {
    return {
      ok: false as const,
      error: "Close the Stock Count Day before applying to inventory",
    };
  }

  let applied = 0;
  let skipped = 0;

  await db.$transaction(async (tx) => {
    for (const summary of scd.summaries) {
      if (summary.totalCountedQty === null) {
        skipped++;
        continue;
      }

      const newQty = summary.totalCountedQty;
      const existing = await tx.inventory.findFirst({
        where: { businessId, productId: summary.productId },
        select: { quantity: true },
      });
      const currentQty = existing?.quantity ?? 0;
      const delta = newQty - currentQty;

      await tx.inventory.upsert({
        where: { productId: summary.productId },
        update: { quantity: newQty },
        create: {
          businessId,
          productId: summary.productId,
          quantity: newQty,
        },
      });

      if (delta !== 0) {
        await tx.transaction.create({
          data: {
            businessId,
            productId: summary.productId,
            type: "ADJUSTMENT",
            quantity: delta,
            note: `Stock Count Day: counted ${newQty}, was ${currentQty} (${delta > 0 ? "+" : ""}${delta})`,
          },
        });
      }
      applied++;
    }

    await tx.stockCountDay.update({
      where: { id: scdId },
      data: {
        status: "applied",
        appliedAt: new Date(),
        appliedBy: userId ?? null,
      },
    });
  });

  const updated = await db.stockCountDay.findUnique({
    where: { id: scdId },
    include: SCD_INCLUDE,
  });
  return { ok: true as const, scd: updated!, applied, skipped };
}

export async function recordSaleForScd(
  scdId: string,
  businessId: string,
  items: { productId: string; quantity: number }[]
) {
  if (items.length === 0) return;

  await db.$transaction(async (tx) => {
    for (const item of items) {
      await tx.stockCountProductSummary.updateMany({
        where: { scdId, businessId, productId: item.productId },
        data: { soldDuringScd: { increment: item.quantity } },
      });

      await tx.stockCountLine.updateMany({
        where: { scdId, businessId, productId: item.productId },
        data: { soldDuringScd: { increment: item.quantity } },
      });

      const summary = await tx.stockCountProductSummary.findUnique({
        where: { scdId_productId: { scdId, productId: item.productId } },
      });
      if (summary && summary.totalCountedQty !== null) {
        const expected = summary.systemQtyAtStart - summary.soldDuringScd;
        await tx.stockCountProductSummary.update({
          where: { id: summary.id },
          data: {
            variance: summary.totalCountedQty - expected,
          },
        });
      }
    }
  });
}

export interface ScdProductExpected {
  expectedTotalQty: number;
  systemQtyAtStart: number;
  soldDuringScd: number;
  otherZones: { id: string; name: string; color: string }[];
  countedInOtherZones: {
    zoneId: string;
    zoneName: string;
    zoneColor: string;
    countedQty: number | null;
  }[];
  isMultiZone: boolean;
}

/** Expected shop-wide qty (system − sales during SCD) for shelf scanner review. */
export async function getScdExpectedQtyForProducts(
  businessId: string,
  zoneSessionId: string,
  productIds: string[]
) {
  if (productIds.length === 0) {
    return { ok: true as const, zoneName: "", byProduct: {} as Record<string, ScdProductExpected> };
  }

  const session = await db.stockCountZoneSession.findFirst({
    where: { id: zoneSessionId, businessId },
    include: { zone: { select: { id: true, name: true } } },
  });
  if (!session) return { ok: false as const, error: "Zone session not found" };

  const summaries = await db.stockCountProductSummary.findMany({
    where: { scdId: session.scdId, productId: { in: productIds } },
  });
  const zoneMap = await getProductZoneMap(businessId, productIds);

  const otherLines = await db.stockCountLine.findMany({
    where: {
      scdId: session.scdId,
      productId: { in: productIds },
      zoneSessionId: { not: zoneSessionId },
      countedQty: { not: null },
    },
    include: { zone: { select: { id: true, name: true, color: true } } },
  });
  const otherByProduct = new Map<string, typeof otherLines>();
  for (const line of otherLines) {
    const list = otherByProduct.get(line.productId) ?? [];
    list.push(line);
    otherByProduct.set(line.productId, list);
  }

  const byProduct: Record<string, ScdProductExpected> = {};
  for (const productId of productIds) {
    const summary = summaries.find((s) => s.productId === productId);
    const zones = zoneMap.get(productId) ?? [];
    byProduct[productId] = {
      expectedTotalQty:
        (summary?.systemQtyAtStart ?? 0) - (summary?.soldDuringScd ?? 0),
      systemQtyAtStart: summary?.systemQtyAtStart ?? 0,
      soldDuringScd: summary?.soldDuringScd ?? 0,
      otherZones: zones.filter((z) => z.id !== session.zoneId),
      countedInOtherZones: (otherByProduct.get(productId) ?? []).map((l) => ({
        zoneId: l.zoneId,
        zoneName: l.zone.name,
        zoneColor: l.zone.color,
        countedQty: l.countedQty,
      })),
      isMultiZone: zones.length > 1,
    };
  }

  return { ok: true as const, zoneName: session.zone.name, byProduct };
}

export async function getStockCountDayDetail(scdId: string, businessId: string) {
  const scd = await db.stockCountDay.findFirst({
    where: { id: scdId, businessId },
    include: {
      ...SCD_INCLUDE,
      summaries: {
        include: {
          product: {
            select: { id: true, name: true, genericName: true, unit: true },
          },
        },
        orderBy: { variance: "desc" },
      },
    },
  });
  if (!scd) return null;

  const zoneProgress = scd.zoneSessions.map((zs) => {
    const counted = zs._count?.lines ?? 0;
    return {
      ...zs,
      lineCount: counted,
    };
  });

  const varianceCount = scd.summaries.filter(
    (s) => s.variance !== null && Math.abs(s.variance) > 0.001
  ).length;

  return {
    ...scd,
    zoneSessions: zoneProgress,
    stats: {
      totalProducts: scd.summaries.length,
      countedProducts: scd.summaries.filter((s) => s.totalCountedQty !== null).length,
      varianceCount,
      zonesClosed: scd.zoneSessions.filter((z) => z.status === "closed").length,
      zonesTotal: scd.zoneSessions.length,
    },
  };
}

export function formatScdStatus(status: string): string {
  switch (status) {
    case "draft":
      return "Draft";
    case "active":
      return "In progress";
    case "closed":
      return "Ready to apply";
    case "applied":
      return "Applied";
    default:
      return status;
  }
}
