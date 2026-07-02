// One-off / idempotent backfill: assign a unique shopCode to any Business that
// doesn't have one yet. Safe to re-run. Usage: node scripts/backfill-shop-codes.js
const { PrismaClient } = require("@prisma/client");
const crypto = require("crypto");

const db = new PrismaClient();
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function genCode(slug) {
  const prefix = (slug || "SHP").replace(/[^a-zA-Z]/g, "").slice(0, 3).toUpperCase().padEnd(3, "X");
  const bytes = crypto.randomBytes(4);
  let suffix = "";
  for (let i = 0; i < 4; i++) suffix += ALPHABET[bytes[i] % ALPHABET.length];
  return `${prefix}-${suffix}`;
}

async function main() {
  const businesses = await db.business.findMany({
    where: { shopCode: null },
    include: { businessType: { select: { slug: true } } },
  });
  console.log(`Backfilling ${businesses.length} business(es)...`);
  for (const b of businesses) {
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        const code = genCode(b.businessType?.slug);
        await db.business.update({ where: { id: b.id }, data: { shopCode: code } });
        console.log(`  ${b.name} -> ${code}`);
        break;
      } catch (err) {
        if (err.code === "P2002" && attempt < 5) continue;
        throw err;
      }
    }
  }
  console.log("Done.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
