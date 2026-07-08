-- ═══════════════════════════════════════════════════════════════════════════════
-- InventoryOS — Full PostgreSQL Database Schema
-- Generated from Prisma schema (61 models)
-- Compatible with pgAdmin Query Tool
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ═══════════════════════════════════════════════════════════════════════════════
-- DROP ALL EXISTING TABLES (reverse dependency order with CASCADE)
-- ═══════════════════════════════════════════════════════════════════════════════
DROP TABLE IF EXISTS "shelf_scan_items" CASCADE;
DROP TABLE IF EXISTS "report_deliveries" CASCADE;
DROP TABLE IF EXISTS "PurchaseItem" CASCADE;
DROP TABLE IF EXISTS "ReturnItem" CASCADE;
DROP TABLE IF EXISTS "zone_assignment_snapshots" CASCADE;
DROP TABLE IF EXISTS "shelf_scans" CASCADE;
DROP TABLE IF EXISTS "stock_count_lines" CASCADE;
DROP TABLE IF EXISTS "stock_count_product_summaries" CASCADE;
DROP TABLE IF EXISTS "Return" CASCADE;
DROP TABLE IF EXISTS "Payment" CASCADE;
DROP TABLE IF EXISTS "SaleItem" CASCADE;
DROP TABLE IF EXISTS "Batch" CASCADE;
DROP TABLE IF EXISTS "Transaction" CASCADE;
DROP TABLE IF EXISTS "Inventory" CASCADE;
DROP TABLE IF EXISTS "stock_count_zone_sessions" CASCADE;
DROP TABLE IF EXISTS "product_zone_assignments" CASCADE;
DROP TABLE IF EXISTS "payment_transactions" CASCADE;
DROP TABLE IF EXISTS "Sale" CASCADE;
DROP TABLE IF EXISTS "Purchase" CASCADE;
DROP TABLE IF EXISTS "Session" CASCADE;
DROP TABLE IF EXISTS "Product" CASCADE;
DROP TABLE IF EXISTS "generated_reports" CASCADE;
DROP TABLE IF EXISTS "stock_count_days" CASCADE;
DROP TABLE IF EXISTS "storage_zones" CASCADE;
DROP TABLE IF EXISTS "subscription_adjustments" CASCADE;
DROP TABLE IF EXISTS "subscription_invoices" CASCADE;
DROP TABLE IF EXISTS "Supplier" CASCADE;
DROP TABLE IF EXISTS "DiscountRule" CASCADE;
DROP TABLE IF EXISTS "FefoOverride" CASCADE;
DROP TABLE IF EXISTS "AIResponseCache" CASCADE;
DROP TABLE IF EXISTS "BusinessDailyStats" CASCADE;
DROP TABLE IF EXISTS "AIUsageLog" CASCADE;
DROP TABLE IF EXISTS "Customer" CASCADE;
DROP TABLE IF EXISTS "NotificationLog" CASCADE;
DROP TABLE IF EXISTS "AlertPreference" CASCADE;
DROP TABLE IF EXISTS "Category" CASCADE;
DROP TABLE IF EXISTS "BusinessUser" CASCADE;
DROP TABLE IF EXISTS "holiday_calendar" CASCADE;
DROP TABLE IF EXISTS "master_products" CASCADE;
DROP TABLE IF EXISTS "report_schedules" CASCADE;
DROP TABLE IF EXISTS "Business" CASCADE;
DROP TABLE IF EXISTS "PhoneAuthToken" CASCADE;
DROP TABLE IF EXISTS "TrustedDevice" CASCADE;
DROP TABLE IF EXISTS "ai_providers" CASCADE;
DROP TABLE IF EXISTS "master_manufacturers" CASCADE;
DROP TABLE IF EXISTS "smtp_configs" CASCADE;
DROP TABLE IF EXISTS "payment_config" CASCADE;
DROP TABLE IF EXISTS "received_payments" CASCADE;
DROP TABLE IF EXISTS "epidemic_alerts" CASCADE;
DROP TABLE IF EXISTS "report_seasons" CASCADE;
DROP TABLE IF EXISTS "report_occasions" CASCADE;
DROP TABLE IF EXISTS "notification_recipients" CASCADE;
DROP TABLE IF EXISTS "kill_switch_thresholds" CASCADE;
DROP TABLE IF EXISTS "kill_switches" CASCADE;
DROP TABLE IF EXISTS "ai_configs" CASCADE;
DROP TABLE IF EXISTS "CronJobLog" CASCADE;
DROP TABLE IF EXISTS "SuperAdminSession" CASCADE;
DROP TABLE IF EXISTS "SuperAdmin" CASCADE;
DROP TABLE IF EXISTS "OtpVerification" CASCADE;
DROP TABLE IF EXISTS "User" CASCADE;
DROP TABLE IF EXISTS "BusinessType" CASCADE;

-- ═══════════════════════════════════════════════════════════════════════════════
-- DROP existing trigger function if it exists
-- ═══════════════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS "update_updatedAt_column"() CASCADE;

-- ── Helper: auto-update "updatedAt" columns on every row modification ─────────
CREATE OR REPLACE FUNCTION "update_updatedAt_column"()
RETURNS TRIGGER AS $$
BEGIN
  NEW."updatedAt" = CURRENT_TIMESTAMP(3);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════════════
-- TIER 0 — Tables with no foreign-key dependencies
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── BusinessType ──────────────────────────────────────────────────────────────
CREATE TABLE "BusinessType" (
  "id"        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "slug"      TEXT NOT NULL,
  "name"      TEXT NOT NULL,
  "icon"      TEXT NOT NULL,
  "color"     TEXT NOT NULL,
  "isActive"  BOOLEAN NOT NULL DEFAULT false,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "BusinessType_slug_key" UNIQUE ("slug")
);

CREATE TRIGGER "BusinessType_updatedAt"
  BEFORE UPDATE ON "BusinessType"
  FOR EACH ROW EXECUTE FUNCTION "update_updatedAt_column"();

-- ── User ─────────────────────────────────────────────────────────────────────
CREATE TABLE "User" (
  "id"        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "phone"     TEXT NOT NULL,
  "name"      TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "User_phone_key" UNIQUE ("phone")
);

CREATE TRIGGER "User_updatedAt"
  BEFORE UPDATE ON "User"
  FOR EACH ROW EXECUTE FUNCTION "update_updatedAt_column"();

-- ── OtpVerification ──────────────────────────────────────────────────────────
CREATE TABLE "OtpVerification" (
  "id"        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "phone"     TEXT NOT NULL,
  "otp"       TEXT NOT NULL,
  "purpose"   TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "isUsed"    BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);

-- ── SuperAdmin ───────────────────────────────────────────────────────────────
CREATE TABLE "SuperAdmin" (
  "id"           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "username"     TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "fullName"     TEXT,
  "role"         TEXT NOT NULL DEFAULT 'super_admin',
  "isActive"     BOOLEAN NOT NULL DEFAULT true,
  "lastLoginAt"  TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "SuperAdmin_username_key" UNIQUE ("username")
);

CREATE TRIGGER "SuperAdmin_updatedAt"
  BEFORE UPDATE ON "SuperAdmin"
  FOR EACH ROW EXECUTE FUNCTION "update_updatedAt_column"();

-- ── SuperAdminSession ─────────────────────────────────────────────────────────
CREATE TABLE "SuperAdminSession" (
  "id"           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "superAdminId" TEXT NOT NULL,
  "token"        TEXT NOT NULL,
  "expiresAt"    TIMESTAMP(3) NOT NULL,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "SuperAdminSession_token_key" UNIQUE ("token"),
  CONSTRAINT "SuperAdminSession_superAdminId_fkey" FOREIGN KEY ("superAdminId") REFERENCES "SuperAdmin"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "SuperAdminSession_superAdminId_idx" ON "SuperAdminSession"("superAdminId");
CREATE INDEX "SuperAdminSession_token_idx" ON "SuperAdminSession"("token");
CREATE INDEX "SuperAdminSession_expiresAt_idx" ON "SuperAdminSession"("expiresAt");

-- ── CronJobLog ───────────────────────────────────────────────────────────────
CREATE TABLE "CronJobLog" (
  "id"                  TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "jobName"             TEXT NOT NULL,
  "status"              TEXT NOT NULL,
  "startedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  "finishedAt"          TIMESTAMP(3),
  "durationMs"          INTEGER,
  "businessesProcessed" INTEGER NOT NULL DEFAULT 0,
  "recordsWritten"      INTEGER NOT NULL DEFAULT 0,
  "errorMessage"        TEXT,
  "log"                 TEXT
);

-- ── ai_configs (AiConfig) ────────────────────────────────────────────────────
CREATE TABLE "ai_configs" (
  "id"                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "feature"           TEXT NOT NULL,
  "maxOutputTokens"   INTEGER NOT NULL DEFAULT 1024,
  "maxInputBatches"   INTEGER,
  "maxInputProducts"  INTEGER,
  "maxInputImages"    INTEGER,
  "systemPrompt"      TEXT,
  "userPromptTemplate" TEXT,
  "temperature"       DOUBLE PRECISION,
  "disableThinking"   BOOLEAN,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  "updatedBy"         TEXT,

  CONSTRAINT "ai_configs_feature_key" UNIQUE ("feature")
);

CREATE TRIGGER "ai_configs_updatedAt"
  BEFORE UPDATE ON "ai_configs"
  FOR EACH ROW EXECUTE FUNCTION "update_updatedAt_column"();

-- ── kill_switches (KillSwitch) ───────────────────────────────────────────────
CREATE TABLE "kill_switches" (
  "id"             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "trigger"        TEXT NOT NULL,
  "thresholdValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "actualValue"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "triggeredAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  "triggeredBy"    TEXT NOT NULL,
  "isActive"       BOOLEAN NOT NULL DEFAULT true,
  "deactivatedAt"  TIMESTAMP(3),
  "deactivatedBy"  TEXT,
  "notes"          TEXT
);

-- ── kill_switch_thresholds (KillSwitchThreshold) ─────────────────────────────
CREATE TABLE "kill_switch_thresholds" (
  "id"             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "trigger"        TEXT NOT NULL,
  "thresholdValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "unit"           TEXT NOT NULL DEFAULT '',
  "isActive"       BOOLEAN NOT NULL DEFAULT true,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  "updatedBy"      TEXT,

  CONSTRAINT "kill_switch_thresholds_trigger_key" UNIQUE ("trigger")
);

CREATE TRIGGER "kill_switch_thresholds_updatedAt"
  BEFORE UPDATE ON "kill_switch_thresholds"
  FOR EACH ROW EXECUTE FUNCTION "update_updatedAt_column"();

-- ── notification_recipients (NotificationRecipient) ──────────────────────────
CREATE TABLE "notification_recipients" (
  "id"        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "email"     TEXT NOT NULL,
  "label"     TEXT,
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "notification_recipients_email_key" UNIQUE ("email")
);

CREATE TRIGGER "notification_recipients_updatedAt"
  BEFORE UPDATE ON "notification_recipients"
  FOR EACH ROW EXECUTE FUNCTION "update_updatedAt_column"();

-- ── report_occasions (ReportOccasion) ────────────────────────────────────────
CREATE TABLE "report_occasions" (
  "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name"            TEXT NOT NULL,
  "slug"            TEXT NOT NULL,
  "type"            TEXT NOT NULL,
  "datePattern"     TEXT NOT NULL,
  "fixedMonth"      INTEGER,
  "fixedDay"        INTEGER,
  "weeklyDayOfWeek" INTEGER,
  "impactWeight"    DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "durationDays"    INTEGER NOT NULL DEFAULT 1,
  "leadDays"        INTEGER NOT NULL DEFAULT 0,
  "description"     TEXT,
  "isActive"        BOOLEAN NOT NULL DEFAULT true,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "report_occasions_slug_key" UNIQUE ("slug")
);

CREATE TRIGGER "report_occasions_updatedAt"
  BEFORE UPDATE ON "report_occasions"
  FOR EACH ROW EXECUTE FUNCTION "update_updatedAt_column"();

-- ── report_seasons (ReportSeason) ────────────────────────────────────────────
CREATE TABLE "report_seasons" (
  "id"                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name"              TEXT NOT NULL,
  "slug"              TEXT NOT NULL,
  "startMonth"        INTEGER NOT NULL,
  "startDay"          INTEGER NOT NULL DEFAULT 1,
  "endMonth"          INTEGER NOT NULL,
  "endDay"            INTEGER NOT NULL DEFAULT 28,
  "impactWeight"      DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  "affectedCategories" TEXT NOT NULL DEFAULT '[]',
  "description"       TEXT,
  "isActive"          BOOLEAN NOT NULL DEFAULT true,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "report_seasons_slug_key" UNIQUE ("slug")
);

CREATE TRIGGER "report_seasons_updatedAt"
  BEFORE UPDATE ON "report_seasons"
  FOR EACH ROW EXECUTE FUNCTION "update_updatedAt_column"();

-- ── epidemic_alerts (EpidemicAlert) ──────────────────────────────────────────
CREATE TABLE "epidemic_alerts" (
  "id"                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name"              TEXT NOT NULL,
  "slug"              TEXT NOT NULL,
  "diseaseType"       TEXT NOT NULL,
  "severity"          TEXT NOT NULL DEFAULT 'moderate',
  "impactWeight"      DOUBLE PRECISION NOT NULL DEFAULT 2.0,
  "affectedCategories" TEXT NOT NULL DEFAULT '[]',
  "affectedProducts"  TEXT NOT NULL DEFAULT '[]',
  "startDate"         TIMESTAMP(3) NOT NULL,
  "endDate"           TIMESTAMP(3) NOT NULL,
  "isActive"          BOOLEAN NOT NULL DEFAULT true,
  "declaredBy"        TEXT,
  "notes"             TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "epidemic_alerts_slug_key" UNIQUE ("slug")
);

CREATE TRIGGER "epidemic_alerts_updatedAt"
  BEFORE UPDATE ON "epidemic_alerts"
  FOR EACH ROW EXECUTE FUNCTION "update_updatedAt_column"();

-- ── received_payments (ReceivedPayment) ──────────────────────────────────────
CREATE TABLE "received_payments" (
  "id"                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "method"               TEXT NOT NULL,
  "trxId"                TEXT NOT NULL,
  "amount"               DOUBLE PRECISION NOT NULL,
  "receivedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  "uploadedBy"           TEXT,
  "matchedTransactionId" TEXT,
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3)
);

-- ── payment_config (PaymentConfig) ───────────────────────────────────────────
CREATE TABLE "payment_config" (
  "id"             TEXT PRIMARY KEY DEFAULT 'default',
  "sslStoreId"     TEXT,
  "sslStorePasswd" TEXT,
  "sslMode"        TEXT NOT NULL DEFAULT 'sandbox',
  "bkashActive"    BOOLEAN NOT NULL DEFAULT true,
  "nagadActive"    BOOLEAN NOT NULL DEFAULT true,
  "sslActive"      BOOLEAN NOT NULL DEFAULT false,
  "bkashNumber"    TEXT,
  "nagadNumber"    TEXT,
  "proMonthly"     DOUBLE PRECISION NOT NULL DEFAULT 800,
  "proAnnual"      DOUBLE PRECISION NOT NULL DEFAULT 8000,
  "proAiMonthly"   DOUBLE PRECISION NOT NULL DEFAULT 1500,
  "proAiAnnual"    DOUBLE PRECISION NOT NULL DEFAULT 15000,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  "updatedBy"      TEXT
);

CREATE TRIGGER "payment_config_updatedAt"
  BEFORE UPDATE ON "payment_config"
  FOR EACH ROW EXECUTE FUNCTION "update_updatedAt_column"();

-- ── smtp_configs (SmtpConfig) ────────────────────────────────────────────────
CREATE TABLE "smtp_configs" (
  "id"        TEXT PRIMARY KEY DEFAULT 'default',
  "host"      TEXT NOT NULL,
  "port"      INTEGER NOT NULL DEFAULT 587,
  "user"      TEXT NOT NULL,
  "password"  TEXT NOT NULL,
  "fromEmail" TEXT,
  "fromName"  TEXT NOT NULL DEFAULT 'InventoryOS',
  "isActive"  BOOLEAN NOT NULL DEFAULT true,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  "updatedBy" TEXT
);

CREATE TRIGGER "smtp_configs_updatedAt"
  BEFORE UPDATE ON "smtp_configs"
  FOR EACH ROW EXECUTE FUNCTION "update_updatedAt_column"();

-- ── master_manufacturers (MasterManufacturer) ────────────────────────────────
CREATE TABLE "master_manufacturers" (
  "id"           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name"         TEXT NOT NULL,
  "shortCode"    TEXT,
  "country"      TEXT NOT NULL DEFAULT 'Bangladesh',
  "isActive"     BOOLEAN NOT NULL DEFAULT true,
  "productCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "master_manufacturers_name_key" UNIQUE ("name")
);

CREATE TRIGGER "master_manufacturers_updatedAt"
  BEFORE UPDATE ON "master_manufacturers"
  FOR EACH ROW EXECUTE FUNCTION "update_updatedAt_column"();

-- ── ai_providers (AiProvider) ────────────────────────────────────────────────
CREATE TABLE "ai_providers" (
  "id"        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "provider"  TEXT NOT NULL,
  "apiKey"    TEXT,
  "baseUrl"   TEXT,
  "model"     TEXT,
  "isActive"  BOOLEAN NOT NULL DEFAULT false,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  "updatedBy" TEXT,

  CONSTRAINT "ai_providers_provider_key" UNIQUE ("provider")
);

CREATE TRIGGER "ai_providers_updatedAt"
  BEFORE UPDATE ON "ai_providers"
  FOR EACH ROW EXECUTE FUNCTION "update_updatedAt_column"();

-- ═══════════════════════════════════════════════════════════════════════════════
-- TIER 1 — Tables depending on Tier 0
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── TrustedDevice ────────────────────────────────────────────────────────────
CREATE TABLE "TrustedDevice" (
  "id"         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"     TEXT NOT NULL,
  "token"      TEXT NOT NULL,
  "deviceInfo" TEXT,
  "expiresAt"  TIMESTAMP(3) NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "TrustedDevice_token_key" UNIQUE ("token"),
  CONSTRAINT "TrustedDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "TrustedDevice_userId_idx" ON "TrustedDevice"("userId");
CREATE INDEX "TrustedDevice_token_idx" ON "TrustedDevice"("token");
CREATE INDEX "TrustedDevice_expiresAt_idx" ON "TrustedDevice"("expiresAt");

-- ── PhoneAuthToken ───────────────────────────────────────────────────────────
CREATE TABLE "PhoneAuthToken" (
  "id"        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"    TEXT NOT NULL,
  "token"     TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "PhoneAuthToken_token_key" UNIQUE ("token"),
  CONSTRAINT "PhoneAuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "PhoneAuthToken_token_idx" ON "PhoneAuthToken"("token");
CREATE INDEX "PhoneAuthToken_expiresAt_idx" ON "PhoneAuthToken"("expiresAt");

-- ── Business ─────────────────────────────────────────────────────────────────
CREATE TABLE "Business" (
  "id"                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "userId"             TEXT NOT NULL,
  "businessTypeId"     TEXT NOT NULL,
  "name"               TEXT NOT NULL,
  "shopCode"           TEXT,
  "address"            TEXT,
  "phone"              TEXT,
  "isActive"           BOOLEAN NOT NULL DEFAULT true,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  "subscriptionTier"   TEXT NOT NULL DEFAULT 'free',
  "subscriptionStatus" TEXT NOT NULL DEFAULT 'trial',
  "subscriptionStart"  TIMESTAMP(3),
  "subscriptionEnd"    TIMESTAMP(3),
  "subscriptionStage"  TEXT NOT NULL DEFAULT 'active',
  "gracePeriodEnd"     TIMESTAMP(3),
  "dataWipeDate"       TIMESTAMP(3),
  "dataSoftDeletedAt"  TIMESTAMP(3),
  "dataPurgeDate"      TIMESTAMP(3),
  "aiEnabled"          BOOLEAN NOT NULL DEFAULT false,
  "aiDailyLimit"       INTEGER NOT NULL DEFAULT 50,
  "aiMonthlyLimit"     INTEGER NOT NULL DEFAULT 1000,
  "aiTokenBudget"      INTEGER NOT NULL DEFAULT 500000,
  "ownerEmail"         TEXT,
  "ownerWhatsapp"      TEXT,

  CONSTRAINT "Business_shopCode_key" UNIQUE ("shopCode"),
  CONSTRAINT "Business_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Business_businessTypeId_fkey" FOREIGN KEY ("businessTypeId") REFERENCES "BusinessType"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "Business_userId_idx" ON "Business"("userId");
CREATE INDEX "Business_businessTypeId_idx" ON "Business"("businessTypeId");
CREATE INDEX "Business_subscriptionStage_idx" ON "Business"("subscriptionStage");
CREATE INDEX "Business_subscriptionEnd_idx" ON "Business"("subscriptionEnd");

CREATE TRIGGER "Business_updatedAt"
  BEFORE UPDATE ON "Business"
  FOR EACH ROW EXECUTE FUNCTION "update_updatedAt_column"();

-- ── report_schedules (ReportSchedule) ────────────────────────────────────────
CREATE TABLE "report_schedules" (
  "id"                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name"              TEXT NOT NULL,
  "description"       TEXT,
  "frequency"         TEXT NOT NULL,
  "dayOfWeek"         INTEGER,
  "dayOfMonth"        INTEGER,
  "startDate"         TIMESTAMP(3),
  "endDate"           TIMESTAMP(3),
  "occasions"         TEXT NOT NULL DEFAULT '[]',
  "considerSeasons"   BOOLEAN NOT NULL DEFAULT true,
  "considerEpidemics" BOOLEAN NOT NULL DEFAULT true,
  "targetClientMode"  TEXT NOT NULL DEFAULT 'all',
  "targetClientIds"   TEXT,
  "deliveryChannels"  TEXT NOT NULL DEFAULT '["email"]',
  "reportPeriodDays"  INTEGER NOT NULL DEFAULT 7,
  "businessTypeId"    TEXT,
  "isActive"          BOOLEAN NOT NULL DEFAULT true,
  "lastRunAt"         TIMESTAMP(3),
  "nextRunAt"         TIMESTAMP(3),
  "createdBy"         TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "report_schedules_businessTypeId_fkey" FOREIGN KEY ("businessTypeId") REFERENCES "BusinessType"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "report_schedules_isActive_nextRunAt_idx" ON "report_schedules"("isActive", "nextRunAt");
CREATE INDEX "report_schedules_frequency_idx" ON "report_schedules"("frequency");
CREATE INDEX "report_schedules_businessTypeId_idx" ON "report_schedules"("businessTypeId");

CREATE TRIGGER "report_schedules_updatedAt"
  BEFORE UPDATE ON "report_schedules"
  FOR EACH ROW EXECUTE FUNCTION "update_updatedAt_column"();

-- ── master_products (MasterProduct) ──────────────────────────────────────────
CREATE TABLE "master_products" (
  "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "name"            TEXT NOT NULL,
  "genericName"     TEXT,
  "strength"        TEXT,
  "dosageForm"      TEXT,
  "manufacturerId"  TEXT,
  "manufacturerStr" TEXT,
  "categoryName"    TEXT,
  "scheduleType"    TEXT,
  "hsnCode"         TEXT,
  "vatRate"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  "defaultMrp"      DOUBLE PRECISION,
  "dgdaRegNo"       TEXT,
  "barcode"         TEXT,
  "unit"            TEXT NOT NULL DEFAULT 'piece',
  "stripSize"       INTEGER,
  "boxSize"         INTEGER,
  "isActive"        BOOLEAN NOT NULL DEFAULT true,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "master_products_dgdaRegNo_key" UNIQUE ("dgdaRegNo"),
  CONSTRAINT "master_products_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "master_manufacturers"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "master_products_name_idx" ON "master_products"("name");
CREATE INDEX "master_products_genericName_idx" ON "master_products"("genericName");
CREATE INDEX "master_products_manufacturerStr_idx" ON "master_products"("manufacturerStr");
CREATE INDEX "master_products_categoryName_idx" ON "master_products"("categoryName");
CREATE INDEX "master_products_dosageForm_idx" ON "master_products"("dosageForm");
CREATE INDEX "master_products_barcode_idx" ON "master_products"("barcode");
CREATE INDEX "master_products_isActive_idx" ON "master_products"("isActive");

CREATE TRIGGER "master_products_updatedAt"
  BEFORE UPDATE ON "master_products"
  FOR EACH ROW EXECUTE FUNCTION "update_updatedAt_column"();

-- ── holiday_calendar (HolidayCalendar) ───────────────────────────────────────
CREATE TABLE "holiday_calendar" (
  "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "occasionId"  TEXT NOT NULL,
  "date"        TIMESTAMP(3) NOT NULL,
  "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
  "year"        INTEGER NOT NULL,
  "notes"       TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "holiday_calendar_occasionId_date_key" UNIQUE ("occasionId", "date"),
  CONSTRAINT "holiday_calendar_occasionId_fkey" FOREIGN KEY ("occasionId") REFERENCES "report_occasions"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "holiday_calendar_date_idx" ON "holiday_calendar"("date");
CREATE INDEX "holiday_calendar_year_idx" ON "holiday_calendar"("year");

CREATE TRIGGER "holiday_calendar_updatedAt"
  BEFORE UPDATE ON "holiday_calendar"
  FOR EACH ROW EXECUTE FUNCTION "update_updatedAt_column"();

-- ═══════════════════════════════════════════════════════════════════════════════
-- TIER 2 — Tables depending on Tier 1
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── BusinessUser ─────────────────────────────────────────────────────────────
CREATE TABLE "BusinessUser" (
  "id"           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "businessId"   TEXT NOT NULL,
  "username"     TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "role"         TEXT NOT NULL DEFAULT 'admin',
  "isAdmin"      BOOLEAN NOT NULL DEFAULT false,
  "fullName"     TEXT,
  "phone"        TEXT,
  "email"        TEXT,
  "permissions"  TEXT,
  "isActive"     BOOLEAN NOT NULL DEFAULT true,
  "lastLoginAt"  TIMESTAMP(3),
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  "updatedAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "BusinessUser_businessId_username_key" UNIQUE ("businessId", "username"),
  CONSTRAINT "BusinessUser_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "BusinessUser_businessId_idx" ON "BusinessUser"("businessId");
CREATE INDEX "BusinessUser_role_idx" ON "BusinessUser"("role");

CREATE TRIGGER "BusinessUser_updatedAt"
  BEFORE UPDATE ON "BusinessUser"
  FOR EACH ROW EXECUTE FUNCTION "update_updatedAt_column"();

-- ── Category ─────────────────────────────────────────────────────────────────
CREATE TABLE "Category" (
  "id"         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "businessId" TEXT NOT NULL,
  "parentId"   TEXT,
  "name"       TEXT NOT NULL,
  "slug"       TEXT NOT NULL,
  "icon"       TEXT NOT NULL DEFAULT 'Tag',
  "color"      TEXT NOT NULL DEFAULT '#6B7280',
  "type"       TEXT NOT NULL DEFAULT 'medicine',
  "sortOrder"  INTEGER NOT NULL DEFAULT 0,
  "isActive"   BOOLEAN NOT NULL DEFAULT true,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "Category_businessId_slug_key" UNIQUE ("businessId", "slug"),
  CONSTRAINT "Category_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Category_businessId_idx" ON "Category"("businessId");
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");

CREATE TRIGGER "Category_updatedAt"
  BEFORE UPDATE ON "Category"
  FOR EACH ROW EXECUTE FUNCTION "update_updatedAt_column"();

-- ── AlertPreference ─────────────────────────────────────────────────────────
CREATE TABLE "AlertPreference" (
  "id"                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "businessId"        TEXT NOT NULL,
  "expiryCriticalDays" INTEGER NOT NULL DEFAULT 7,
  "expiryWarningDays"  INTEGER NOT NULL DEFAULT 30,
  "expiryNoticeDays"   INTEGER NOT NULL DEFAULT 90,
  "lowStockEnabled"    BOOLEAN NOT NULL DEFAULT true,
  "lowStockThreshold"  INTEGER NOT NULL DEFAULT 10,
  "quarantineAlerts"   BOOLEAN NOT NULL DEFAULT true,
  "emailEnabled"       BOOLEAN NOT NULL DEFAULT false,
  "email"              TEXT,
  "smsEnabled"         BOOLEAN NOT NULL DEFAULT false,
  "phone"              TEXT,
  "digestFrequency"    TEXT NOT NULL DEFAULT 'daily',
  "quietHoursStart"    INTEGER,
  "quietHoursEnd"      INTEGER,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "AlertPreference_businessId_key" UNIQUE ("businessId"),
  CONSTRAINT "AlertPreference_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "AlertPreference_businessId_idx" ON "AlertPreference"("businessId");

CREATE TRIGGER "AlertPreference_updatedAt"
  BEFORE UPDATE ON "AlertPreference"
  FOR EACH ROW EXECUTE FUNCTION "update_updatedAt_column"();

-- ── NotificationLog ──────────────────────────────────────────────────────────
CREATE TABLE "NotificationLog" (
  "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "businessId"  TEXT NOT NULL,
  "type"        TEXT NOT NULL,
  "severity"    TEXT NOT NULL,
  "title"       TEXT NOT NULL,
  "message"     TEXT NOT NULL,
  "entityType"  TEXT NOT NULL,
  "entityId"    TEXT,
  "isRead"      BOOLEAN NOT NULL DEFAULT false,
  "isResolved"  BOOLEAN NOT NULL DEFAULT false,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  "readAt"      TIMESTAMP(3),

  CONSTRAINT "NotificationLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "NotificationLog_businessId_idx" ON "NotificationLog"("businessId");
CREATE INDEX "NotificationLog_type_idx" ON "NotificationLog"("type");
CREATE INDEX "NotificationLog_isRead_idx" ON "NotificationLog"("isRead");
CREATE INDEX "NotificationLog_createdAt_idx" ON "NotificationLog"("createdAt");

-- ── Customer ─────────────────────────────────────────────────────────────────
CREATE TABLE "Customer" (
  "id"                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "businessId"        TEXT NOT NULL,
  "name"              TEXT NOT NULL,
  "phone"             TEXT,
  "email"             TEXT,
  "address"           TEXT,
  "dateOfBirth"       TIMESTAMP(3),
  "gender"            TEXT,
  "chronicConditions" TEXT,
  "allergies"         TEXT,
  "notes"             TEXT,
  "totalSpent"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "visitCount"        INTEGER NOT NULL DEFAULT 0,
  "lastVisitAt"       TIMESTAMP(3),
  "isActive"          BOOLEAN NOT NULL DEFAULT true,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "Customer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Customer_businessId_idx" ON "Customer"("businessId");
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");
CREATE INDEX "Customer_name_idx" ON "Customer"("name");

CREATE TRIGGER "Customer_updatedAt"
  BEFORE UPDATE ON "Customer"
  FOR EACH ROW EXECUTE FUNCTION "update_updatedAt_column"();

-- ── AIUsageLog ───────────────────────────────────────────────────────────────
CREATE TABLE "AIUsageLog" (
  "id"           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "businessId"   TEXT NOT NULL,
  "feature"      TEXT NOT NULL,
  "tokensUsed"   INTEGER NOT NULL DEFAULT 0,
  "costEstimate" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "success"      BOOLEAN NOT NULL DEFAULT true,
  "errorMessage" TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "AIUsageLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "AIUsageLog_businessId_idx" ON "AIUsageLog"("businessId");
CREATE INDEX "AIUsageLog_feature_idx" ON "AIUsageLog"("feature");
CREATE INDEX "AIUsageLog_createdAt_idx" ON "AIUsageLog"("createdAt");
CREATE INDEX "AIUsageLog_businessId_createdAt_idx" ON "AIUsageLog"("businessId", "createdAt");

-- ── BusinessDailyStats ───────────────────────────────────────────────────────
CREATE TABLE "BusinessDailyStats" (
  "id"                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "businessId"         TEXT NOT NULL,
  "date"               TIMESTAMP(3) NOT NULL,
  "salesTotal"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  "salesCount"         INTEGER NOT NULL DEFAULT 0,
  "salesDiscount"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "salesReturns"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "salesReturnsCount"  INTEGER NOT NULL DEFAULT 0,
  "purchasesTotal"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "purchasesCount"     INTEGER NOT NULL DEFAULT 0,
  "paymentsIn"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  "paymentsOut"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "productCount"       INTEGER NOT NULL DEFAULT 0,
  "lowStockCount"      INTEGER NOT NULL DEFAULT 0,
  "outOfStockCount"    INTEGER NOT NULL DEFAULT 0,
  "batchCount"         INTEGER NOT NULL DEFAULT 0,
  "nearExpiryCount"    INTEGER NOT NULL DEFAULT 0,
  "expiredCount"       INTEGER NOT NULL DEFAULT 0,
  "inventoryCostValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "inventoryMrpValue"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "customerCount"      INTEGER NOT NULL DEFAULT 0,
  "supplierCount"      INTEGER NOT NULL DEFAULT 0,
  "receivablesTotal"   DOUBLE PRECISION NOT NULL DEFAULT 0,
  "payablesTotal"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "aiCalls"            INTEGER NOT NULL DEFAULT 0,
  "aiTokens"           INTEGER NOT NULL DEFAULT 0,
  "aiCost"             DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "BusinessDailyStats_businessId_date_key" UNIQUE ("businessId", "date"),
  CONSTRAINT "BusinessDailyStats_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "BusinessDailyStats_businessId_date_idx" ON "BusinessDailyStats"("businessId", "date");
CREATE INDEX "BusinessDailyStats_date_idx" ON "BusinessDailyStats"("date");

-- ── AIResponseCache ──────────────────────────────────────────────────────────
CREATE TABLE "AIResponseCache" (
  "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "businessId"      TEXT NOT NULL,
  "feature"         TEXT NOT NULL,
  "normalizedQuery" TEXT NOT NULL,
  "dataHash"        TEXT NOT NULL,
  "response"        TEXT NOT NULL,
  "tokensUsed"      INTEGER NOT NULL DEFAULT 0,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  "expiresAt"       TIMESTAMP(3) NOT NULL,

  CONSTRAINT "AIResponseCache_businessId_feature_normalizedQuery_dataHash_key" UNIQUE ("businessId", "feature", "normalizedQuery", "dataHash"),
  CONSTRAINT "AIResponseCache_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "AIResponseCache_businessId_feature_normalizedQuery_idx" ON "AIResponseCache"("businessId", "feature", "normalizedQuery");
CREATE INDEX "AIResponseCache_expiresAt_idx" ON "AIResponseCache"("expiresAt");
CREATE INDEX "AIResponseCache_businessId_expiresAt_idx" ON "AIResponseCache"("businessId", "expiresAt");

-- ── FefoOverride ────────────────────────────────────────────────────────────
CREATE TABLE "FefoOverride" (
  "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "businessId"      TEXT NOT NULL,
  "saleId"          TEXT,
  "saleItemId"      TEXT,
  "productId"       TEXT NOT NULL,
  "productName"     TEXT NOT NULL,
  "selectedBatchId" TEXT NOT NULL,
  "selectedBatchNo" TEXT NOT NULL,
  "expectedBatchId" TEXT NOT NULL,
  "expectedBatchNo" TEXT NOT NULL,
  "userId"          TEXT,
  "userName"        TEXT,
  "reason"          TEXT NOT NULL,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "FefoOverride_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "FefoOverride_businessId_createdAt_idx" ON "FefoOverride"("businessId", "createdAt");
CREATE INDEX "FefoOverride_saleId_idx" ON "FefoOverride"("saleId");
CREATE INDEX "FefoOverride_productId_idx" ON "FefoOverride"("productId");

-- ── DiscountRule ─────────────────────────────────────────────────────────────
CREATE TABLE "DiscountRule" (
  "id"                 TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "businessId"         TEXT NOT NULL,
  "name"               TEXT NOT NULL,
  "description"        TEXT,
  "type"               TEXT NOT NULL,
  "value"              DOUBLE PRECISION NOT NULL,
  "conditionType"      TEXT NOT NULL,
  "conditionValue"     TEXT,
  "scope"              TEXT NOT NULL,
  "scopeValue"         TEXT,
  "startDate"          TIMESTAMP(3),
  "endDate"            TIMESTAMP(3),
  "isActive"           BOOLEAN NOT NULL DEFAULT true,
  "priority"           INTEGER NOT NULL DEFAULT 0,
  "timesUsed"          INTEGER NOT NULL DEFAULT 0,
  "totalDiscountGiven" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "createdAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  "updatedAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "DiscountRule_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "DiscountRule_businessId_idx" ON "DiscountRule"("businessId");
CREATE INDEX "DiscountRule_isActive_idx" ON "DiscountRule"("isActive");
CREATE INDEX "DiscountRule_scope_idx" ON "DiscountRule"("scope");

CREATE TRIGGER "DiscountRule_updatedAt"
  BEFORE UPDATE ON "DiscountRule"
  FOR EACH ROW EXECUTE FUNCTION "update_updatedAt_column"();

-- ── Supplier ─────────────────────────────────────────────────────────────────
CREATE TABLE "Supplier" (
  "id"            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "businessId"    TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "code"          TEXT,
  "contactPerson" TEXT,
  "phone"         TEXT,
  "email"         TEXT,
  "address"       TEXT,
  "balance"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalPurchased" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalPaid"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "notes"         TEXT,
  "isActive"      BOOLEAN NOT NULL DEFAULT true,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "Supplier_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Supplier_businessId_idx" ON "Supplier"("businessId");
CREATE INDEX "Supplier_name_idx" ON "Supplier"("name");
CREATE INDEX "Supplier_phone_idx" ON "Supplier"("phone");

CREATE TRIGGER "Supplier_updatedAt"
  BEFORE UPDATE ON "Supplier"
  FOR EACH ROW EXECUTE FUNCTION "update_updatedAt_column"();

-- ── subscription_invoices (SubscriptionInvoice) ──────────────────────────────
CREATE TABLE "subscription_invoices" (
  "id"            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "businessId"    TEXT NOT NULL,
  "tier"          TEXT NOT NULL,
  "billingPeriod" TEXT NOT NULL,
  "amount"        DOUBLE PRECISION NOT NULL,
  "status"        TEXT NOT NULL DEFAULT 'pending',
  "dueDate"       TIMESTAMP(3) NOT NULL,
  "paidAt"        TIMESTAMP(3),
  "paymentMethod" TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "subscription_invoices_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "subscription_invoices_businessId_idx" ON "subscription_invoices"("businessId");
CREATE INDEX "subscription_invoices_status_idx" ON "subscription_invoices"("status");
CREATE INDEX "subscription_invoices_dueDate_idx" ON "subscription_invoices"("dueDate");

CREATE TRIGGER "subscription_invoices_updatedAt"
  BEFORE UPDATE ON "subscription_invoices"
  FOR EACH ROW EXECUTE FUNCTION "update_updatedAt_column"();

-- ── subscription_adjustments (SubscriptionAdjustment) ────────────────────────
CREATE TABLE "subscription_adjustments" (
  "id"            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "businessId"    TEXT NOT NULL,
  "type"          TEXT NOT NULL,
  "daysAdjusted"  INTEGER NOT NULL,
  "amount"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "reason"        TEXT NOT NULL,
  "oldTier"       TEXT,
  "newTier"       TEXT,
  "createdBy"     TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "subscription_adjustments_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "subscription_adjustments_businessId_idx" ON "subscription_adjustments"("businessId");

-- ── storage_zones (StorageZone) ──────────────────────────────────────────────
CREATE TABLE "storage_zones" (
  "id"         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "businessId" TEXT NOT NULL,
  "name"       TEXT NOT NULL,
  "sortOrder"  INTEGER NOT NULL DEFAULT 0,
  "color"      TEXT NOT NULL DEFAULT '#0d9488',
  "isActive"   BOOLEAN NOT NULL DEFAULT true,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "storage_zones_businessId_name_key" UNIQUE ("businessId", "name"),
  CONSTRAINT "storage_zones_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "storage_zones_businessId_idx" ON "storage_zones"("businessId");

CREATE TRIGGER "storage_zones_updatedAt"
  BEFORE UPDATE ON "storage_zones"
  FOR EACH ROW EXECUTE FUNCTION "update_updatedAt_column"();

-- ── stock_count_days (StockCountDay) ─────────────────────────────────────────
CREATE TABLE "stock_count_days" (
  "id"          TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "businessId"  TEXT NOT NULL,
  "name"        TEXT NOT NULL,
  "status"      TEXT NOT NULL DEFAULT 'draft',
  "startedAt"   TIMESTAMP(3),
  "closedAt"    TIMESTAMP(3),
  "appliedAt"   TIMESTAMP(3),
  "startedBy"   TEXT,
  "closedBy"    TEXT,
  "appliedBy"   TEXT,
  "notes"       TEXT,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  "updatedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "stock_count_days_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "stock_count_days_businessId_idx" ON "stock_count_days"("businessId");
CREATE INDEX "stock_count_days_status_idx" ON "stock_count_days"("status");

CREATE TRIGGER "stock_count_days_updatedAt"
  BEFORE UPDATE ON "stock_count_days"
  FOR EACH ROW EXECUTE FUNCTION "update_updatedAt_column"();

-- ── generated_reports (GeneratedReport) ──────────────────────────────────────
CREATE TABLE "generated_reports" (
  "id"                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "scheduleId"           TEXT NOT NULL,
  "businessId"           TEXT NOT NULL,
  "reportDate"           TIMESTAMP(3) NOT NULL,
  "reportPeriodStart"    TIMESTAMP(3) NOT NULL,
  "reportPeriodEnd"      TIMESTAMP(3) NOT NULL,
  "executiveSummary"     TEXT,
  "spikePredictions"     TEXT,
  "topItems"             TEXT,
  "stockRisks"           TEXT,
  "appliedInfluences"    TEXT NOT NULL DEFAULT '{}',
  "aiTokensUsed"         INTEGER NOT NULL DEFAULT 0,
  "aiCostEstimate"       DOUBLE PRECISION NOT NULL DEFAULT 0.0,
  "generationStatus"     TEXT NOT NULL DEFAULT 'pending',
  "errorMessage"         TEXT,
  "pdfUrl"               TEXT,
  "predictionConfidence" TEXT NOT NULL DEFAULT 'medium',
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  "updatedAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "generated_reports_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "report_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "generated_reports_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "generated_reports_scheduleId_reportDate_idx" ON "generated_reports"("scheduleId", "reportDate");
CREATE INDEX "generated_reports_businessId_reportDate_idx" ON "generated_reports"("businessId", "reportDate");
CREATE INDEX "generated_reports_generationStatus_idx" ON "generated_reports"("generationStatus");
CREATE INDEX "generated_reports_reportDate_idx" ON "generated_reports"("reportDate");

CREATE TRIGGER "generated_reports_updatedAt"
  BEFORE UPDATE ON "generated_reports"
  FOR EACH ROW EXECUTE FUNCTION "update_updatedAt_column"();

-- ═══════════════════════════════════════════════════════════════════════════════
-- TIER 3 — Tables depending on Tier 2
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Product ──────────────────────────────────────────────────────────────────
CREATE TABLE "Product" (
  "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "businessId"      TEXT NOT NULL,
  "categoryId"      TEXT,
  "name"            TEXT NOT NULL,
  "genericName"     TEXT,
  "sku"             TEXT,
  "barcode"         TEXT,
  "productType"     TEXT NOT NULL DEFAULT 'medicine',
  "unit"            TEXT NOT NULL DEFAULT 'piece',
  "stripSize"       INTEGER,
  "boxSize"         INTEGER,
  "strength"        TEXT,
  "dosageForm"      TEXT,
  "manufacturer"    TEXT,
  "scheduleType"    TEXT,
  "hsnCode"         TEXT,
  "vatRate"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  "mrp"             DOUBLE PRECISION,
  "isPrescription"  BOOLEAN NOT NULL DEFAULT false,
  "storageCondition" TEXT,
  "rackNo"          TEXT,
  "minStock"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "maxStock"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "reorderLevel"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "masterProductId" TEXT,
  "sellingPrice"    DOUBLE PRECISION,
  "isActive"        BOOLEAN NOT NULL DEFAULT true,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "Product_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Product_businessId_idx" ON "Product"("businessId");
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");
CREATE INDEX "Product_genericName_idx" ON "Product"("genericName");
CREATE INDEX "Product_manufacturer_idx" ON "Product"("manufacturer");
CREATE INDEX "Product_masterProductId_idx" ON "Product"("masterProductId");

CREATE TRIGGER "Product_updatedAt"
  BEFORE UPDATE ON "Product"
  FOR EACH ROW EXECUTE FUNCTION "update_updatedAt_column"();

-- ── Session ──────────────────────────────────────────────────────────────────
CREATE TABLE "Session" (
  "id"             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "businessUserId" TEXT NOT NULL,
  "token"          TEXT NOT NULL,
  "deviceInfo"     TEXT,
  "expiresAt"      TIMESTAMP(3) NOT NULL,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "Session_token_key" UNIQUE ("token"),
  CONSTRAINT "Session_businessUserId_fkey" FOREIGN KEY ("businessUserId") REFERENCES "BusinessUser"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Session_businessUserId_idx" ON "Session"("businessUserId");
CREATE INDEX "Session_token_idx" ON "Session"("token");
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- ── Purchase ─────────────────────────────────────────────────────────────────
CREATE TABLE "Purchase" (
  "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "businessId"      TEXT NOT NULL,
  "supplierId"      TEXT,
  "purchaseNo"      TEXT NOT NULL,
  "status"          TEXT NOT NULL DEFAULT 'received',
  "subtotal"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discountAmount"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "taxAmount"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalAmount"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "paidAmount"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "paymentStatus"   TEXT NOT NULL DEFAULT 'unpaid',
  "invoiceNo"       TEXT,
  "invoiceDate"     TIMESTAMP(3),
  "receivedDate"    TIMESTAMP(3),
  "notes"           TEXT,
  "createdBy"       TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "Purchase_businessId_purchaseNo_key" UNIQUE ("businessId", "purchaseNo"),
  CONSTRAINT "Purchase_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Purchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Purchase_businessId_idx" ON "Purchase"("businessId");
CREATE INDEX "Purchase_supplierId_idx" ON "Purchase"("supplierId");
CREATE INDEX "Purchase_status_idx" ON "Purchase"("status");
CREATE INDEX "Purchase_createdAt_idx" ON "Purchase"("createdAt");

CREATE TRIGGER "Purchase_updatedAt"
  BEFORE UPDATE ON "Purchase"
  FOR EACH ROW EXECUTE FUNCTION "update_updatedAt_column"();

-- ── Sale ─────────────────────────────────────────────────────────────────────
CREATE TABLE "Sale" (
  "id"               TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "businessId"       TEXT NOT NULL,
  "customerId"       TEXT,
  "invoiceNo"        TEXT NOT NULL,
  "status"           TEXT NOT NULL DEFAULT 'completed',
  "paymentMethod"    TEXT NOT NULL DEFAULT 'cash',
  "paymentStatus"    TEXT NOT NULL DEFAULT 'paid',
  "subtotal"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discountAmount"   DOUBLE PRECISION NOT NULL DEFAULT 0,
  "discountPercent"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "taxAmount"        DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalAmount"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "paidAmount"       DOUBLE PRECISION NOT NULL DEFAULT 0,
  "itemCount"        INTEGER NOT NULL DEFAULT 0,
  "totalQuantity"    DOUBLE PRECISION NOT NULL DEFAULT 0,
  "notes"            TEXT,
  "createdBy"        TEXT,
  "cancelledAt"      TIMESTAMP(3),
  "cancelledBy"      TEXT,
  "cancelReason"     TEXT,
  "stockCountDayId"  TEXT,
  "createdAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  "updatedAt"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "Sale_businessId_invoiceNo_key" UNIQUE ("businessId", "invoiceNo"),
  CONSTRAINT "Sale_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "Sale_stockCountDayId_fkey" FOREIGN KEY ("stockCountDayId") REFERENCES "stock_count_days"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Sale_businessId_idx" ON "Sale"("businessId");
CREATE INDEX "Sale_customerId_idx" ON "Sale"("customerId");
CREATE INDEX "Sale_status_idx" ON "Sale"("status");
CREATE INDEX "Sale_paymentStatus_idx" ON "Sale"("paymentStatus");
CREATE INDEX "Sale_createdAt_idx" ON "Sale"("createdAt");

CREATE TRIGGER "Sale_updatedAt"
  BEFORE UPDATE ON "Sale"
  FOR EACH ROW EXECUTE FUNCTION "update_updatedAt_column"();

-- ── payment_transactions (PaymentTransaction) ────────────────────────────────
CREATE TABLE "payment_transactions" (
  "id"            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "businessId"    TEXT NOT NULL,
  "invoiceId"     TEXT,
  "method"        TEXT NOT NULL,
  "trxId"         TEXT NOT NULL,
  "amount"        DOUBLE PRECISION NOT NULL,
  "status"        TEXT NOT NULL DEFAULT 'pending',
  "submittedBy"   TEXT,
  "submittedAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  "matchedAt"     TIMESTAMP(3),
  "matchedBy"     TEXT,
  "notes"         TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "payment_transactions_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "payment_transactions_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "subscription_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "payment_transactions_businessId_idx" ON "payment_transactions"("businessId");
CREATE INDEX "payment_transactions_status_idx" ON "payment_transactions"("status");
CREATE INDEX "payment_transactions_trxId_idx" ON "payment_transactions"("trxId");
CREATE INDEX "payment_transactions_method_idx" ON "payment_transactions"("method");

CREATE TRIGGER "payment_transactions_updatedAt"
  BEFORE UPDATE ON "payment_transactions"
  FOR EACH ROW EXECUTE FUNCTION "update_updatedAt_column"();

-- ── product_zone_assignments (ProductZoneAssignment) ─────────────────────────
CREATE TABLE "product_zone_assignments" (
  "id"         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "businessId" TEXT NOT NULL,
  "productId"  TEXT NOT NULL,
  "zoneId"     TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "product_zone_assignments_productId_zoneId_key" UNIQUE ("productId", "zoneId"),
  CONSTRAINT "product_zone_assignments_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "product_zone_assignments_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "product_zone_assignments_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "storage_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "product_zone_assignments_businessId_idx" ON "product_zone_assignments"("businessId");
CREATE INDEX "product_zone_assignments_zoneId_idx" ON "product_zone_assignments"("zoneId");

-- ── stock_count_zone_sessions (StockCountZoneSession) ────────────────────────
CREATE TABLE "stock_count_zone_sessions" (
  "id"         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "scdId"      TEXT NOT NULL,
  "zoneId"     TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "status"     TEXT NOT NULL DEFAULT 'pending',
  "closedAt"   TIMESTAMP(3),
  "closedBy"   TEXT,
  "sortOrder"  INTEGER NOT NULL DEFAULT 0,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "stock_count_zone_sessions_scdId_zoneId_key" UNIQUE ("scdId", "zoneId"),
  CONSTRAINT "stock_count_zone_sessions_scdId_fkey" FOREIGN KEY ("scdId") REFERENCES "stock_count_days"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "stock_count_zone_sessions_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "storage_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "stock_count_zone_sessions_businessId_idx" ON "stock_count_zone_sessions"("businessId");
CREATE INDEX "stock_count_zone_sessions_scdId_idx" ON "stock_count_zone_sessions"("scdId");

CREATE TRIGGER "stock_count_zone_sessions_updatedAt"
  BEFORE UPDATE ON "stock_count_zone_sessions"
  FOR EACH ROW EXECUTE FUNCTION "update_updatedAt_column"();

-- ═══════════════════════════════════════════════════════════════════════════════
-- TIER 4 — Tables depending on Tier 3
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── Inventory ────────────────────────────────────────────────────────────────
CREATE TABLE "Inventory" (
  "id"         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "businessId" TEXT NOT NULL,
  "productId"  TEXT NOT NULL,
  "quantity"   DOUBLE PRECISION NOT NULL DEFAULT 0,
  "minStock"   DOUBLE PRECISION NOT NULL DEFAULT 0,
  "unitCost"   DOUBLE PRECISION,
  "updatedAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "Inventory_productId_key" UNIQUE ("productId"),
  CONSTRAINT "Inventory_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Inventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Inventory_businessId_idx" ON "Inventory"("businessId");

CREATE TRIGGER "Inventory_updatedAt"
  BEFORE UPDATE ON "Inventory"
  FOR EACH ROW EXECUTE FUNCTION "update_updatedAt_column"();

-- ── Transaction ──────────────────────────────────────────────────────────────
CREATE TABLE "Transaction" (
  "id"         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "businessId" TEXT NOT NULL,
  "productId"  TEXT NOT NULL,
  "batchId"    TEXT,
  "type"       TEXT NOT NULL,
  "quantity"   DOUBLE PRECISION NOT NULL,
  "unitPrice"  DOUBLE PRECISION,
  "note"       TEXT,
  "createdBy"  TEXT,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "Transaction_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Transaction_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "Transaction_businessId_idx" ON "Transaction"("businessId");
CREATE INDEX "Transaction_productId_idx" ON "Transaction"("productId");
CREATE INDEX "Transaction_createdAt_idx" ON "Transaction"("createdAt");

-- ── Batch ────────────────────────────────────────────────────────────────────
CREATE TABLE "Batch" (
  "id"            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "businessId"    TEXT NOT NULL,
  "productId"     TEXT NOT NULL,
  "batchNo"       TEXT NOT NULL,
  "mfgDate"       TIMESTAMP(3),
  "expiryDate"    TIMESTAMP(3) NOT NULL,
  "quantity"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "purchasePrice" DOUBLE PRECISION,
  "mrp"           DOUBLE PRECISION,
  "supplierId"    TEXT,
  "status"        TEXT NOT NULL DEFAULT 'active',
  "notes"         TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  "updatedAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "Batch_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Batch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Batch_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Batch_businessId_idx" ON "Batch"("businessId");
CREATE INDEX "Batch_productId_idx" ON "Batch"("productId");
CREATE INDEX "Batch_expiryDate_idx" ON "Batch"("expiryDate");
CREATE INDEX "Batch_status_idx" ON "Batch"("status");
CREATE INDEX "Batch_supplierId_idx" ON "Batch"("supplierId");

CREATE TRIGGER "Batch_updatedAt"
  BEFORE UPDATE ON "Batch"
  FOR EACH ROW EXECUTE FUNCTION "update_updatedAt_column"();

-- ── SaleItem ─────────────────────────────────────────────────────────────────
CREATE TABLE "SaleItem" (
  "id"             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "saleId"         TEXT NOT NULL,
  "businessId"     TEXT NOT NULL,
  "productId"      TEXT NOT NULL,
  "batchId"        TEXT,
  "productName"    TEXT NOT NULL,
  "genericName"    TEXT,
  "batchNo"        TEXT,
  "quantity"       DOUBLE PRECISION NOT NULL,
  "unit"           TEXT NOT NULL,
  "unitPrice"      DOUBLE PRECISION NOT NULL,
  "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalPrice"     DOUBLE PRECISION NOT NULL,
  "override"       BOOLEAN NOT NULL DEFAULT false,

  CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SaleItem_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");
CREATE INDEX "SaleItem_productId_idx" ON "SaleItem"("productId");
CREATE INDEX "SaleItem_batchId_idx" ON "SaleItem"("batchId");

-- ── Payment ──────────────────────────────────────────────────────────────────
CREATE TABLE "Payment" (
  "id"            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "businessId"    TEXT NOT NULL,
  "saleId"        TEXT NOT NULL,
  "customerId"    TEXT,
  "amount"        DOUBLE PRECISION NOT NULL,
  "paymentMethod" TEXT NOT NULL,
  "reference"     TEXT,
  "notes"         TEXT,
  "receivedBy"    TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "Payment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Payment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Payment_businessId_idx" ON "Payment"("businessId");
CREATE INDEX "Payment_saleId_idx" ON "Payment"("saleId");
CREATE INDEX "Payment_customerId_idx" ON "Payment"("customerId");
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

-- ── Return ───────────────────────────────────────────────────────────────────
CREATE TABLE "Return" (
  "id"            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "businessId"    TEXT NOT NULL,
  "saleId"        TEXT NOT NULL,
  "customerId"    TEXT,
  "returnNo"      TEXT NOT NULL,
  "status"        TEXT NOT NULL DEFAULT 'completed',
  "refundAmount"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "refundMethod"  TEXT NOT NULL DEFAULT 'cash',
  "restockItems"  BOOLEAN NOT NULL DEFAULT true,
  "reason"        TEXT NOT NULL,
  "notes"         TEXT,
  "processedBy"   TEXT,
  "createdAt"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "Return_businessId_returnNo_key" UNIQUE ("businessId", "returnNo"),
  CONSTRAINT "Return_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Return_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "Return_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "Return_businessId_idx" ON "Return"("businessId");
CREATE INDEX "Return_saleId_idx" ON "Return"("saleId");
CREATE INDEX "Return_customerId_idx" ON "Return"("customerId");
CREATE INDEX "Return_createdAt_idx" ON "Return"("createdAt");

-- ── StockCountProductSummary ─────────────────────────────────────────────────
CREATE TABLE "stock_count_product_summaries" (
  "id"                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "scdId"             TEXT NOT NULL,
  "businessId"        TEXT NOT NULL,
  "productId"         TEXT NOT NULL,
  "systemQtyAtStart"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "soldDuringScd"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "totalCountedQty"   DOUBLE PRECISION,
  "variance"          DOUBLE PRECISION,
  "varianceReason"    TEXT,
  "varianceNote"      TEXT,
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "stock_count_product_summaries_scdId_productId_key" UNIQUE ("scdId", "productId"),
  CONSTRAINT "stock_count_product_summaries_scdId_fkey" FOREIGN KEY ("scdId") REFERENCES "stock_count_days"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "stock_count_product_summaries_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "stock_count_product_summaries_businessId_idx" ON "stock_count_product_summaries"("businessId");

CREATE TRIGGER "stock_count_product_summaries_updatedAt"
  BEFORE UPDATE ON "stock_count_product_summaries"
  FOR EACH ROW EXECUTE FUNCTION "update_updatedAt_column"();

-- ── StockCountLine ───────────────────────────────────────────────────────────
CREATE TABLE "stock_count_lines" (
  "id"                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "scdId"             TEXT NOT NULL,
  "zoneSessionId"     TEXT NOT NULL,
  "zoneId"            TEXT NOT NULL,
  "businessId"        TEXT NOT NULL,
  "productId"         TEXT NOT NULL,
  "countedQty"        DOUBLE PRECISION,
  "systemQtyAtStart"  DOUBLE PRECISION NOT NULL DEFAULT 0,
  "soldDuringScd"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "status"            TEXT NOT NULL DEFAULT 'pending',
  "detectedName"      TEXT,
  "confidence"        DOUBLE PRECISION,
  "shelfScanItemId"   TEXT,
  "countedBy"         TEXT,
  "countedAt"         TIMESTAMP(3),
  "notes"             TEXT,
  "autoAssigned"      BOOLEAN NOT NULL DEFAULT false,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "stock_count_lines_scdId_zoneSessionId_productId_key" UNIQUE ("scdId", "zoneSessionId", "productId"),
  CONSTRAINT "stock_count_lines_scdId_fkey" FOREIGN KEY ("scdId") REFERENCES "stock_count_days"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "stock_count_lines_zoneSessionId_fkey" FOREIGN KEY ("zoneSessionId") REFERENCES "stock_count_zone_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "stock_count_lines_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "storage_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "stock_count_lines_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "stock_count_lines_businessId_idx" ON "stock_count_lines"("businessId");
CREATE INDEX "stock_count_lines_scdId_idx" ON "stock_count_lines"("scdId");
CREATE INDEX "stock_count_lines_productId_idx" ON "stock_count_lines"("productId");

CREATE TRIGGER "stock_count_lines_updatedAt"
  BEFORE UPDATE ON "stock_count_lines"
  FOR EACH ROW EXECUTE FUNCTION "update_updatedAt_column"();

-- ── shelf_scans (ShelfScan) ──────────────────────────────────────────────────
CREATE TABLE "shelf_scans" (
  "id"                        TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "businessId"                TEXT NOT NULL,
  "imageCount"                INTEGER NOT NULL,
  "detectedCount"             INTEGER NOT NULL DEFAULT 0,
  "matchedCount"              INTEGER NOT NULL DEFAULT 0,
  "rawResult"                 TEXT,
  "tokensUsed"                INTEGER NOT NULL DEFAULT 0,
  "createdBy"                 TEXT,
  "stockCountZoneSessionId"   TEXT,
  "createdAt"                 TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "shelf_scans_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "shelf_scans_stockCountZoneSessionId_fkey" FOREIGN KEY ("stockCountZoneSessionId") REFERENCES "stock_count_zone_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "shelf_scans_businessId_idx" ON "shelf_scans"("businessId");
CREATE INDEX "shelf_scans_stockCountZoneSessionId_idx" ON "shelf_scans"("stockCountZoneSessionId");
CREATE INDEX "shelf_scans_createdAt_idx" ON "shelf_scans"("createdAt");

-- ── ZoneAssignmentSnapshot ───────────────────────────────────────────────────
CREATE TABLE "zone_assignment_snapshots" (
  "id"         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "scdId"      TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "productId"  TEXT NOT NULL,
  "zoneId"     TEXT NOT NULL,
  "createdAt"  TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "zone_assignment_snapshots_scdId_productId_zoneId_key" UNIQUE ("scdId", "productId", "zoneId"),
  CONSTRAINT "zone_assignment_snapshots_scdId_fkey" FOREIGN KEY ("scdId") REFERENCES "stock_count_days"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "zone_assignment_snapshots_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "zone_assignment_snapshots_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "zone_assignment_snapshots_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "storage_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "zone_assignment_snapshots_businessId_idx" ON "zone_assignment_snapshots"("businessId");
CREATE INDEX "zone_assignment_snapshots_scdId_idx" ON "zone_assignment_snapshots"("scdId");
CREATE INDEX "zone_assignment_snapshots_productId_idx" ON "zone_assignment_snapshots"("productId");
CREATE INDEX "zone_assignment_snapshots_zoneId_idx" ON "zone_assignment_snapshots"("zoneId");

-- ═══════════════════════════════════════════════════════════════════════════════
-- TIER 5 — Tables depending on Tier 4
-- ═══════════════════════════════════════════════════════════════════════════════

-- ── ReturnItem ───────────────────────────────────────────────────────────────
CREATE TABLE "ReturnItem" (
  "id"           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "returnId"     TEXT NOT NULL,
  "saleItemId"   TEXT NOT NULL,
  "businessId"   TEXT NOT NULL,
  "productId"    TEXT NOT NULL,
  "batchId"      TEXT,
  "productName"  TEXT NOT NULL,
  "quantity"     DOUBLE PRECISION NOT NULL,
  "unitPrice"    DOUBLE PRECISION NOT NULL,
  "refundAmount" DOUBLE PRECISION NOT NULL,

  CONSTRAINT "ReturnItem_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "Return"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReturnItem_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "ReturnItem_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "SaleItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "ReturnItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "ReturnItem_returnId_idx" ON "ReturnItem"("returnId");
CREATE INDEX "ReturnItem_saleItemId_idx" ON "ReturnItem"("saleItemId");

-- ── PurchaseItem ─────────────────────────────────────────────────────────────
CREATE TABLE "PurchaseItem" (
  "id"              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "purchaseId"      TEXT NOT NULL,
  "businessId"      TEXT NOT NULL,
  "productId"       TEXT NOT NULL,
  "batchId"         TEXT,
  "productName"     TEXT NOT NULL,
  "quantity"        DOUBLE PRECISION NOT NULL,
  "receivedQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "unit"            TEXT NOT NULL,
  "unitCost"        DOUBLE PRECISION NOT NULL,
  "totalPrice"      DOUBLE PRECISION NOT NULL,
  "batchNo"         TEXT,
  "expiryDate"      TIMESTAMP(3),
  "mfgDate"         TIMESTAMP(3),
  "mrp"             DOUBLE PRECISION,

  CONSTRAINT "PurchaseItem_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PurchaseItem_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PurchaseItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "PurchaseItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "PurchaseItem_purchaseId_idx" ON "PurchaseItem"("purchaseId");
CREATE INDEX "PurchaseItem_productId_idx" ON "PurchaseItem"("productId");

-- ── report_deliveries (ReportDelivery) ───────────────────────────────────────
CREATE TABLE "report_deliveries" (
  "id"                TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "reportId"          TEXT NOT NULL,
  "channel"           TEXT NOT NULL,
  "recipient"         TEXT NOT NULL,
  "status"            TEXT NOT NULL DEFAULT 'queued',
  "sentAt"            TIMESTAMP(3),
  "deliveredAt"       TIMESTAMP(3),
  "readAt"            TIMESTAMP(3),
  "errorMessage"      TEXT,
  "retryCount"        INTEGER NOT NULL DEFAULT 0,
  "providerMessageId" TEXT,
  "createdAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  "updatedAt"         TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "report_deliveries_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "generated_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "report_deliveries_reportId_idx" ON "report_deliveries"("reportId");
CREATE INDEX "report_deliveries_status_idx" ON "report_deliveries"("status");
CREATE INDEX "report_deliveries_channel_status_idx" ON "report_deliveries"("channel", "status");

CREATE TRIGGER "report_deliveries_updatedAt"
  BEFORE UPDATE ON "report_deliveries"
  FOR EACH ROW EXECUTE FUNCTION "update_updatedAt_column"();

-- ── shelf_scan_items (ShelfScanItem) ─────────────────────────────────────────
CREATE TABLE "shelf_scan_items" (
  "id"                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "shelfScanId"          TEXT NOT NULL,
  "productId"            TEXT,
  "masterProductId"      TEXT,
  "detectedName"         TEXT NOT NULL,
  "detectedStrength"     TEXT,
  "detectedForm"         TEXT,
  "detectedManufacturer" TEXT,
  "confidence"           DOUBLE PRECISION NOT NULL DEFAULT 0,
  "matchedMethod"        TEXT NOT NULL DEFAULT 'ai',
  "previousQuantity"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "newQuantity"          DOUBLE PRECISION,
  "appliedAt"            TIMESTAMP(3),
  "createdAt"            TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

  CONSTRAINT "shelf_scan_items_shelfScanId_fkey" FOREIGN KEY ("shelfScanId") REFERENCES "shelf_scans"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "shelf_scan_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "shelf_scan_items_masterProductId_fkey" FOREIGN KEY ("masterProductId") REFERENCES "master_products"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "shelf_scan_items_shelfScanId_idx" ON "shelf_scan_items"("shelfScanId");
CREATE INDEX "shelf_scan_items_productId_idx" ON "shelf_scan_items"("productId");
CREATE INDEX "shelf_scan_items_masterProductId_idx" ON "shelf_scan_items"("masterProductId");

-- ═══════════════════════════════════════════════════════════════════════════════
-- SEED DATA — BusinessType rows
-- ═══════════════════════════════════════════════════════════════════════════════

INSERT INTO "BusinessType" ("id", "slug", "name", "icon", "color", "isActive", "sortOrder", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'pharmacy',       'Pharmacy',      '💊',  'emerald', true,  1, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  (gen_random_uuid()::text, 'cctv-shop',      'CCTV Shop',     '📹',  'violet',  true,  2, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  (gen_random_uuid()::text, 'grocery',        'Grocery',       '🛒',  'orange',  false, 3, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  (gen_random_uuid()::text, 'restaurant',     'Restaurant',    '🍽️', 'red',     false, 4, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  (gen_random_uuid()::text, 'mobile-shop',    'Mobile Shop',   '📱',  'cyan',    false, 5, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  (gen_random_uuid()::text, 'electric-shop',  'Electric Shop', '⚡',  'yellow',  false, 6, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3)),
  (gen_random_uuid()::text, 'bakery',         'Bakery',        '🧁',  'pink',    false, 7, CURRENT_TIMESTAMP(3), CURRENT_TIMESTAMP(3));

-- ═══════════════════════════════════════════════════════════════════════════════
-- ADDITIONAL INDEXES (composite indexes from @@index with multiple fields)
-- ═══════════════════════════════════════════════════════════════════════════════

-- OtpVerification composite indexes
CREATE INDEX "OtpVerification_phone_purpose_idx" ON "OtpVerification"("phone", "purpose");

-- CronJobLog composite indexes
CREATE INDEX "CronJobLog_jobName_startedAt_idx" ON "CronJobLog"("jobName", "startedAt");
CREATE INDEX "CronJobLog_status_idx" ON "CronJobLog"("status");
CREATE INDEX "CronJobLog_startedAt_idx" ON "CronJobLog"("startedAt");

-- KillSwitch composite indexes
CREATE INDEX "kill_switches_trigger_isActive_idx" ON "kill_switches"("trigger", "isActive");
CREATE INDEX "kill_switches_triggeredAt_idx" ON "kill_switches"("triggeredAt");
CREATE INDEX "kill_switches_triggeredBy_idx" ON "kill_switches"("triggeredBy");

-- EpidemicAlert composite indexes
CREATE INDEX "epidemic_alerts_isActive_startDate_endDate_idx" ON "epidemic_alerts"("isActive", "startDate", "endDate");
CREATE INDEX "epidemic_alerts_diseaseType_idx" ON "epidemic_alerts"("diseaseType");

-- ReceivedPayment indexes
CREATE INDEX "received_payments_method_idx" ON "received_payments"("method");
CREATE INDEX "received_payments_matchedTransactionId_idx" ON "received_payments"("matchedTransactionId");

COMMIT;