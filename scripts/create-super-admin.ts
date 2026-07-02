// scripts/create-super-admin.ts
// ── Create or reset the super-admin account ──
//
// Usage:
//   bunx tsx scripts/create-super-admin.ts <username> <password>
//
// Examples:
//   bunx tsx scripts/create-super-admin.ts admin mySecretPass123
//   bunx tsx scripts/create-super-admin.ts founder newPassword456
//
// If the username already exists, this resets its password.
// If it doesn't exist, this creates it.
//
// Run this on your server from the project root.

import { db } from "../src/lib/db";
import bcrypt from "bcryptjs";

async function main() {
  const username = process.argv[2];
  const password = process.argv[3];

  if (!username || !password) {
    console.error("Usage: bunx tsx scripts/create-super-admin.ts <username> <password>");
    console.error("Example: bunx tsx scripts/create-super-admin.ts admin mySecretPass123");
    process.exit(1);
  }

  if (password.length < 6) {
    console.error("Password must be at least 6 characters.");
    process.exit(1);
  }

  console.log(`Creating/resetting super-admin "${username}"...`);

  const passwordHash = await bcrypt.hash(password, 12);

  const result = await db.superAdmin.upsert({
    where: { username },
    update: {
      passwordHash,
      isActive: true,
    },
    create: {
      username,
      passwordHash,
      fullName: username,
      role: "super_admin",
      isActive: true,
    },
    select: { id: true, username: true, role: true, isActive: true },
  });

  console.log("\n✅ Super-admin saved successfully:");
  console.log("   Username:", result.username);
  console.log("   Role:    ", result.role);
  console.log("   Active:  ", result.isActive);
  console.log("\nYou can now log in at /admin with these credentials.");

  await db.$disconnect();
}

main().catch((err) => {
  console.error("❌ Failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
