// Shared super-admin auth helper for master-catalog endpoints.
import { NextRequest } from "next/server";
import { db } from "@/lib/db";

export async function verifySuperAdmin(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const token = match[1].trim();
  try {
    const session = await db.superAdminSession.findUnique({
      where: { token },
      select: { superAdminId: true, expiresAt: true, superAdmin: { select: { id: true, isActive: true, username: true } } },
    });
    if (!session || !session.superAdmin.isActive || session.expiresAt.getTime() <= Date.now()) return null;
    return session;
  } catch { return null; }
}
