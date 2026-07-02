// scripts/seed-kill-switch-defaults.js
// Seeds the 4 default kill-switch thresholds. Idempotent.
const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

const DEFAULTS = [
  { trigger: "per_pharmacy_monthly", thresholdValue: 200,   unit: "BDT" },
  { trigger: "per_pharmacy_24h",     thresholdValue: 50000, unit: "tokens" },
  { trigger: "platform_monthly",     thresholdValue: 100000, unit: "BDT" },
  { trigger: "zai_error_rate",       thresholdValue: 10,    unit: "%" },
];

(async () => {
  for (const d of DEFAULTS) {
    await db.killSwitchThreshold.upsert({
      where: { trigger: d.trigger },
      update: {},
      create: { ...d, isActive: true, updatedBy: "seed" },
    });
    console.log(`Seeded ${d.trigger}: ${d.thresholdValue} ${d.unit}`);
  }
  console.log(`\nTotal KillSwitchThreshold rows: ${await db.killSwitchThreshold.count()}`);
  await db.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
