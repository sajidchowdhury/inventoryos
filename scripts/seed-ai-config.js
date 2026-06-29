const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

const DEFAULTS = {
  "chat":              { maxOutputTokens: 1024, maxInputBatches: null, maxInputProducts: null },
  "insights":          { maxOutputTokens: 2048, maxInputBatches: null, maxInputProducts: null },
  "expiry-optimizer":  { maxOutputTokens: 2048, maxInputBatches: 50,   maxInputProducts: null },
  "product-assistant": { maxOutputTokens: 512,  maxInputBatches: null, maxInputProducts: 20 },
};

(async () => {
  for (const [feature, cfg] of Object.entries(DEFAULTS)) {
    await db.aiConfig.upsert({
      where: { feature },
      update: {},
      create: { feature, ...cfg, updatedBy: "seed" },
    });
    console.log(`Seeded ${feature}:`, cfg);
  }
  const rows = await db.aiConfig.findMany();
  console.log(`\nTotal AiConfig rows: ${rows.length}`);
  await db.$disconnect();
})().catch((e) => { console.error(e); process.exit(1); });
