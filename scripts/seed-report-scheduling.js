// scripts/seed-report-scheduling.js
// Seeds the Report Scheduling System with:
//   - 14 Bangladesh occasions (Eid, Puja, Friday, etc.)
//   - 4 Bangladesh seasons (Winter, Summer, Monsoon, Autumn)
//   - 2026-2027 holiday calendar (specific dates)
//   - 2 example epidemic alerts (Dengue + COVID, both inactive)
// Idempotent — safe to run multiple times.

const { PrismaClient } = require("@prisma/client");
const db = new PrismaClient();

// ── 14 Bangladesh Occasions ──
const OCCASIONS = [
  {
    name: "Eid-ul-Fitr",
    slug: "eid-ul-fitr",
    type: "religious",
    datePattern: "lunar_approximate",
    impactWeight: 2.8,
    durationDays: 7,
    leadDays: 5,
    description: "End of Ramadan. Antacids, oral saline, antiemetics spike 200-300% due to iftar overeating.",
  },
  {
    name: "Eid-ul-Adha",
    slug: "eid-ul-adha",
    type: "religious",
    datePattern: "lunar_approximate",
    impactWeight: 2.5,
    durationDays: 5,
    leadDays: 3,
    description: "Cattle slaughtering. Antiseptics, bandages, antibiotics spike due to slaughtering injuries.",
  },
  {
    name: "Durga Puja",
    slug: "durga-puja",
    type: "religious",
    datePattern: "lunar_approximate",
    impactWeight: 2.0,
    durationDays: 5,
    leadDays: 2,
    description: "Crowd injuries at pandals. First-aid, antiseptics, bandages spike.",
  },
  {
    name: "Ramadan",
    slug: "ramadan",
    type: "religious",
    datePattern: "lunar_approximate",
    impactWeight: 1.8,
    durationDays: 30,
    leadDays: 0,
    description: "Month of fasting. Gradual increase in digestive meds. Overlaps with Eid-ul-Fitr at the end.",
  },
  {
    name: "Christmas",
    slug: "christmas",
    type: "religious",
    datePattern: "fixed_date",
    fixedMonth: 12,
    fixedDay: 25,
    impactWeight: 1.3,
    durationDays: 1,
    leadDays: 0,
    description: "Gift items, seasonal meds. Mild increase.",
  },
  {
    name: "New Year",
    slug: "new-year",
    type: "national",
    datePattern: "fixed_date",
    fixedMonth: 1,
    fixedDay: 1,
    impactWeight: 1.2,
    durationDays: 1,
    leadDays: 0,
    description: "Mild increase in footfall.",
  },
  {
    name: "Language Day",
    slug: "language-day",
    type: "national",
    datePattern: "fixed_date",
    fixedMonth: 2,
    fixedDay: 21,
    impactWeight: 0.8,
    durationDays: 1,
    leadDays: 0,
    description: "Morning ceremony at Shaheed Minar. Shops open late. Slight decrease.",
  },
  {
    name: "Independence Day",
    slug: "independence-day",
    type: "national",
    datePattern: "fixed_date",
    fixedMonth: 3,
    fixedDay: 26,
    impactWeight: 0.9,
    durationDays: 1,
    leadDays: 0,
    description: "National holiday. Slight decrease in regular pharmacy footfall.",
  },
  {
    name: "Pohela Boishakh",
    slug: "pohela-boishakh",
    type: "national",
    datePattern: "fixed_date",
    fixedMonth: 4,
    fixedDay: 14,
    impactWeight: 1.5,
    durationDays: 1,
    leadDays: 0,
    description: "Bengali New Year. Mild increase in general merchandise.",
  },
  {
    name: "May Day",
    slug: "may-day",
    type: "national",
    datePattern: "fixed_date",
    fixedMonth: 5,
    fixedDay: 1,
    impactWeight: 0.7,
    durationDays: 1,
    leadDays: 0,
    description: "Government holiday. Many shops closed. Significant decrease.",
  },
  {
    name: "National Mourning Day",
    slug: "national-mourning-day",
    type: "national",
    datePattern: "fixed_date",
    fixedMonth: 8,
    fixedDay: 15,
    impactWeight: 0.9,
    durationDays: 1,
    leadDays: 0,
    description: "Slight decrease in regular footfall.",
  },
  {
    name: "Victory Day",
    slug: "victory-day",
    type: "national",
    datePattern: "fixed_date",
    fixedMonth: 12,
    fixedDay: 16,
    impactWeight: 0.9,
    durationDays: 1,
    leadDays: 0,
    description: "National holiday. Slight decrease.",
  },
  {
    name: "Friday",
    slug: "friday",
    type: "weekly",
    datePattern: "recurring_weekly",
    weeklyDayOfWeek: 5,
    impactWeight: 1.4,
    durationDays: 1,
    leadDays: 0,
    description: "Weekly holiday. Footfall increases 30-50%.",
  },
  {
    name: "Saturday",
    slug: "saturday",
    type: "weekly",
    datePattern: "recurring_weekly",
    weeklyDayOfWeek: 6,
    impactWeight: 1.1,
    durationDays: 1,
    leadDays: 0,
    description: "Half-holiday for some businesses. Mild increase.",
  },
];

// ── 4 Bangladesh Seasons ──
const SEASONS = [
  {
    name: "Winter",
    slug: "winter",
    startMonth: 12, startDay: 1,
    endMonth: 2, endDay: 28,
    impactWeight: 1.5,
    affectedCategories: JSON.stringify(["Cold & Flu", "Respiratory", "Cough Syrups", "Asthma", "Vitamins"]),
    description: "Cold season (Dec-Feb). Cough, cold, asthma, flu medications spike ~50%. Respiratory meds in high demand.",
  },
  {
    name: "Summer",
    slug: "summer",
    startMonth: 3, startDay: 1,
    endMonth: 5, endDay: 31,
    impactWeight: 1.3,
    affectedCategories: JSON.stringify(["Oral Saline", "Antacids", "Heatstroke", "Skin Care", "Sunscreen"]),
    description: "Hot dry season (Mar-May). ORS, antacids, heatstroke meds spike ~30%. Overlaps with Ramadan/Eid often.",
  },
  {
    name: "Monsoon",
    slug: "monsoon",
    startMonth: 6, startDay: 1,
    endMonth: 9, endDay: 30,
    impactWeight: 2.0,
    affectedCategories: JSON.stringify(["Antimalarials", "IV Fluids", "Water-borne Disease", "Antidiarrheal", "Insect Repellent"]),
    description: "Rainy season (Jun-Sep). Dengue/malaria/water-borne disease meds spike 100%. Peak dengue outbreak season.",
  },
  {
    name: "Autumn",
    slug: "autumn",
    startMonth: 10, startDay: 1,
    endMonth: 11, endDay: 30,
    impactWeight: 1.0,
    affectedCategories: JSON.stringify([]),
    description: "Transition season (Oct-Nov). Baseline demand. No significant category shifts.",
  },
];

// ── 2026-2027 Holiday Calendar ──
// Lunar dates (Eid, Puja, Ramadan) are estimates — isConfirmed=false.
// Fixed dates (Christmas, New Year, etc.) are confirmed.
const HOLIDAYS_2026 = [
  // Fixed-date holidays (confirmed)
  { occasionSlug: "new-year", date: "2026-01-01", isConfirmed: true, notes: "Fixed date" },
  { occasionSlug: "language-day", date: "2026-02-21", isConfirmed: true, notes: "Fixed date" },
  { occasionSlug: "independence-day", date: "2026-03-26", isConfirmed: true, notes: "Fixed date" },
  { occasionSlug: "pohela-boishakh", date: "2026-04-14", isConfirmed: true, notes: "Fixed date" },
  { occasionSlug: "may-day", date: "2026-05-01", isConfirmed: true, notes: "Fixed date" },
  { occasionSlug: "national-mourning-day", date: "2026-08-15", isConfirmed: true, notes: "Fixed date" },
  { occasionSlug: "victory-day", date: "2026-12-16", isConfirmed: true, notes: "Fixed date" },
  { occasionSlug: "christmas", date: "2026-12-25", isConfirmed: true, notes: "Fixed date" },
  // Lunar-approximate holidays (NOT confirmed — founder must confirm each year)
  { occasionSlug: "ramadan", date: "2026-02-18", isConfirmed: false, notes: "ESTIMATED start of Ramadan 2026. Confirm with Islamic Foundation BD." },
  { occasionSlug: "eid-ul-fitr", date: "2026-03-20", isConfirmed: false, notes: "ESTIMATED Eid-ul-Fitr 2026. Confirm with Islamic Foundation BD." },
  { occasionSlug: "eid-ul-adha", date: "2026-05-27", isConfirmed: false, notes: "ESTIMATED Eid-ul-Adha 2026. Confirm with Islamic Foundation BD." },
  { occasionSlug: "durga-puja", date: "2026-10-11", isConfirmed: false, notes: "ESTIMATED Durga Puja 2026. Confirm with Bangladesh Hindu Federation." },
];

const HOLIDAYS_2027 = [
  { occasionSlug: "new-year", date: "2027-01-01", isConfirmed: true, notes: "Fixed date" },
  { occasionSlug: "language-day", date: "2027-02-21", isConfirmed: true, notes: "Fixed date" },
  { occasionSlug: "independence-day", date: "2027-03-26", isConfirmed: true, notes: "Fixed date" },
  { occasionSlug: "pohela-boishakh", date: "2027-04-14", isConfirmed: true, notes: "Fixed date" },
  { occasionSlug: "may-day", date: "2027-05-01", isConfirmed: true, notes: "Fixed date" },
  { occasionSlug: "national-mourning-day", date: "2027-08-15", isConfirmed: true, notes: "Fixed date" },
  { occasionSlug: "victory-day", date: "2027-12-16", isConfirmed: true, notes: "Fixed date" },
  { occasionSlug: "christmas", date: "2027-12-25", isConfirmed: true, notes: "Fixed date" },
  { occasionSlug: "ramadan", date: "2027-02-08", isConfirmed: false, notes: "ESTIMATED Ramadan 2027. Confirm in early 2027." },
  { occasionSlug: "eid-ul-fitr", date: "2027-03-10", isConfirmed: false, notes: "ESTIMATED Eid-ul-Fitr 2027. Confirm in early 2027." },
  { occasionSlug: "eid-ul-adha", date: "2027-05-17", isConfirmed: false, notes: "ESTIMATED Eid-ul-Adha 2027. Confirm in early 2027." },
  { occasionSlug: "durga-puja", date: "2027-09-30", isConfirmed: false, notes: "ESTIMATED Durga Puja 2027. Confirm in early 2027." },
];

// ── 2 Example Epidemic Alerts (both inactive — founder activates when needed) ──
const EPIDEMICS = [
  {
    name: "Dengue Outbreak 2026",
    slug: "dengue-outbreak-2026",
    diseaseType: "dengue",
    severity: "severe",
    impactWeight: 4.0,
    affectedCategories: JSON.stringify(["Antimalarials", "IV Fluids", "Platelet Kits", "Fever Reducers", "Mosquito Repellent"]),
    affectedProducts: JSON.stringify([]),
    startDate: new Date("2026-06-01"),
    endDate: new Date("2026-09-30"),
    isActive: false, // Founder activates when outbreak detected
    notes: "TEMPLATE — Dengue outbreaks are annual during monsoon (Jun-Sep). Founder should activate when DGFP reports 100+ cases/week. Adjusts demand 4x for antimalarials + IV fluids.",
  },
  {
    name: "COVID-19 (historical template)",
    slug: "covid-19-template",
    diseaseType: "covid",
    severity: "critical",
    impactWeight: 5.0,
    affectedCategories: JSON.stringify(["Masks", "Sanitizers", "Antivirals", "Immune Boosters", "Fever Reducers", "Vitamins"]),
    affectedProducts: JSON.stringify([]),
    startDate: new Date("2020-03-01"),
    endDate: new Date("2020-12-31"),
    isActive: false, // Historical — kept as template for future pandemic response
    notes: "HISTORICAL TEMPLATE — COVID-19 pandemic. Kept as a reference for future pandemic response. Activate a copy if a new wave occurs. Adjusts demand 5x for masks/sanitizers/antivirals.",
  },
];

async function main() {
  console.log("=== Seeding Report Scheduling System ===\n");

  // ── 1. Occasions ──
  console.log("Seeding occasions...");
  for (const occ of OCCASIONS) {
    await db.reportOccasion.upsert({
      where: { slug: occ.slug },
      update: {},
      create: { ...occ, isActive: true },
    });
  }
  console.log(`  ✓ ${OCCASIONS.length} occasions seeded`);

  // ── 2. Seasons ──
  console.log("\nSeeding seasons...");
  for (const season of SEASONS) {
    await db.reportSeason.upsert({
      where: { slug: season.slug },
      update: {},
      create: { ...season, isActive: true },
    });
  }
  console.log(`  ✓ ${SEASONS.length} seasons seeded`);

  // ── 3. Holiday Calendar ──
  console.log("\nSeeding holiday calendar...");
  const allHolidays = [...HOLIDAYS_2026, ...HOLIDAYS_2027];
  let holidayCount = 0;
  for (const holiday of allHolidays) {
    const occasion = await db.reportOccasion.findUnique({ where: { slug: holiday.occasionSlug } });
    if (!occasion) {
      console.warn(`  ⚠ Occasion "${holiday.occasionSlug}" not found — skipping holiday ${holiday.date}`);
      continue;
    }
    const date = new Date(holiday.date);
    const year = date.getFullYear();
    await db.holidayCalendar.upsert({
      where: { occasionId_date: { occasionId: occasion.id, date } },
      update: {},
      create: {
        occasionId: occasion.id,
        date,
        isConfirmed: holiday.isConfirmed,
        year,
        notes: holiday.notes,
      },
    });
    holidayCount++;
  }
  console.log(`  ✓ ${holidayCount} holidays seeded (2026-2027)`);

  // ── 4. Epidemic Alerts ──
  console.log("\nSeeding epidemic alerts (templates, inactive)...");
  for (const epidemic of EPIDEMICS) {
    await db.epidemicAlert.upsert({
      where: { slug: epidemic.slug },
      update: {},
      create: { ...epidemic, declaredBy: "seed" },
    });
  }
  console.log(`  ✓ ${EPIDEMICS.length} epidemic alert templates seeded (all inactive)`);

  // ── Summary ──
  console.log("\n=== Seed Complete ===");
  console.log(`  Occasions:       ${await db.reportOccasion.count()}`);
  console.log(`  Seasons:         ${await db.reportSeason.count()}`);
  console.log(`  Holiday Calendar:${await db.holidayCalendar.count()}`);
  console.log(`  Epidemic Alerts: ${await db.epidemicAlert.count()} (all inactive)`);
  console.log(`  Schedules:       ${await db.reportSchedule.count()}`);
  console.log(`  Generated Reports: ${await db.generatedReport.count()}`);
  console.log(`  Deliveries:      ${await db.reportDelivery.count()}`);

  console.log("\nNOTE: Lunar occasion dates (Eid, Puja, Ramadan) are ESTIMATES.");
  console.log("      The founder must confirm them each year via /admin → Occasion Manager.");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
