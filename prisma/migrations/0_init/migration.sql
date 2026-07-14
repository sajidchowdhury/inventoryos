-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "BusinessType" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrustedDevice" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "deviceInfo" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TrustedDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhoneAuthToken" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhoneAuthToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Business" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "businessTypeId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shopCode" TEXT,
    "address" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "subscriptionTier" TEXT NOT NULL DEFAULT 'free',
    "subscriptionStatus" TEXT NOT NULL DEFAULT 'trial',
    "subscriptionStart" TIMESTAMP(3),
    "subscriptionEnd" TIMESTAMP(3),
    "subscriptionStage" TEXT NOT NULL DEFAULT 'active',
    "gracePeriodEnd" TIMESTAMP(3),
    "dataWipeDate" TIMESTAMP(3),
    "dataSoftDeletedAt" TIMESTAMP(3),
    "dataPurgeDate" TIMESTAMP(3),
    "aiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "aiDailyLimit" INTEGER NOT NULL DEFAULT 50,
    "aiMonthlyLimit" INTEGER NOT NULL DEFAULT 1000,
    "aiTokenBudget" INTEGER NOT NULL DEFAULT 500000,
    "ownerEmail" TEXT,
    "ownerWhatsapp" TEXT,

    CONSTRAINT "Business_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessUser" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "isAdmin" BOOLEAN NOT NULL DEFAULT false,
    "fullName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "permissions" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BusinessUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "parentId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'Tag',
    "color" TEXT NOT NULL DEFAULT '#6B7280',
    "type" TEXT NOT NULL DEFAULT 'medicine',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "categoryId" TEXT,
    "name" TEXT NOT NULL,
    "genericName" TEXT,
    "sku" TEXT,
    "barcode" TEXT,
    "productType" TEXT NOT NULL DEFAULT 'medicine',
    "unit" TEXT NOT NULL DEFAULT 'piece',
    "stripSize" INTEGER,
    "boxSize" INTEGER,
    "strength" TEXT,
    "dosageForm" TEXT,
    "manufacturer" TEXT,
    "scheduleType" TEXT,
    "hsnCode" TEXT,
    "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mrp" DOUBLE PRECISION,
    "isPrescription" BOOLEAN NOT NULL DEFAULT false,
    "storageCondition" TEXT,
    "rackNo" TEXT,
    "minStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "maxStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reorderLevel" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "masterProductId" TEXT,
    "sellingPrice" DOUBLE PRECISION,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchNo" TEXT NOT NULL,
    "mfgDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "purchasePrice" DOUBLE PRECISION,
    "mrp" DOUBLE PRECISION,
    "supplierId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minStock" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unitCost" DOUBLE PRECISION,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchId" TEXT,
    "type" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OtpVerification" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "otp" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "isUsed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OtpVerification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "businessUserId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "deviceInfo" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AlertPreference" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "expiryCriticalDays" INTEGER NOT NULL DEFAULT 7,
    "expiryWarningDays" INTEGER NOT NULL DEFAULT 30,
    "expiryNoticeDays" INTEGER NOT NULL DEFAULT 90,
    "lowStockEnabled" BOOLEAN NOT NULL DEFAULT true,
    "lowStockThreshold" INTEGER NOT NULL DEFAULT 10,
    "quarantineAlerts" BOOLEAN NOT NULL DEFAULT true,
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "email" TEXT,
    "smsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "phone" TEXT,
    "digestFrequency" TEXT NOT NULL DEFAULT 'daily',
    "quietHoursStart" INTEGER,
    "quietHoursEnd" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationLog" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "readAt" TIMESTAMP(3),

    CONSTRAINT "NotificationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "gender" TEXT,
    "chronicConditions" TEXT,
    "allergies" TEXT,
    "notes" TEXT,
    "totalSpent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "visitCount" INTEGER NOT NULL DEFAULT 0,
    "lastVisitAt" TIMESTAMP(3),
    "loyaltyPoints" INTEGER NOT NULL DEFAULT 0,
    "loyaltyTier" TEXT NOT NULL DEFAULT 'BRONZE',
    "preferredPaymentMethod" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Sale" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT,
    "invoiceNo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "paymentMethod" TEXT NOT NULL DEFAULT 'cash',
    "paymentStatus" TEXT NOT NULL DEFAULT 'paid',
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "itemCount" INTEGER NOT NULL DEFAULT 0,
    "totalQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdBy" TEXT,
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" TEXT,
    "cancelReason" TEXT,
    "stockCountDayId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Sale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleItem" (
    "id" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchId" TEXT,
    "productName" TEXT NOT NULL,
    "genericName" TEXT,
    "batchNo" TEXT,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "override" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "SaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "customerId" TEXT,
    "amount" DOUBLE PRECISION NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "receivedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Return" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "customerId" TEXT,
    "returnNo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'completed',
    "refundAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "refundMethod" TEXT NOT NULL DEFAULT 'cash',
    "restockItems" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "processedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Return_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReturnItem" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "saleItemId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchId" TEXT,
    "productName" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "refundAmount" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "ReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DiscountRule" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "value" DOUBLE PRECISION NOT NULL,
    "conditionType" TEXT NOT NULL,
    "conditionValue" TEXT,
    "scope" TEXT NOT NULL,
    "scopeValue" TEXT,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "timesUsed" INTEGER NOT NULL DEFAULT 0,
    "totalDiscountGiven" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DiscountRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPurchased" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalPaid" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Purchase" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "supplierId" TEXT,
    "purchaseNo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "taxAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentStatus" TEXT NOT NULL DEFAULT 'unpaid',
    "invoiceNo" TEXT,
    "invoiceDate" TIMESTAMP(3),
    "receivedDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Purchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseItem" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "batchId" TEXT,
    "productName" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "receivedQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL,
    "unitCost" DOUBLE PRECISION NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "batchNo" TEXT,
    "expiryDate" TIMESTAMP(3),
    "mfgDate" TIMESTAMP(3),
    "mrp" DOUBLE PRECISION,

    CONSTRAINT "PurchaseItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIUsageLog" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "costEstimate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "success" BOOLEAN NOT NULL DEFAULT true,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AIUsageLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuperAdmin" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT,
    "role" TEXT NOT NULL DEFAULT 'super_admin',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastLoginAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SuperAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SuperAdminSession" (
    "id" TEXT NOT NULL,
    "superAdminId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SuperAdminSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BusinessDailyStats" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "salesTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "salesCount" INTEGER NOT NULL DEFAULT 0,
    "salesDiscount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "salesReturns" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "salesReturnsCount" INTEGER NOT NULL DEFAULT 0,
    "purchasesTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "purchasesCount" INTEGER NOT NULL DEFAULT 0,
    "paymentsIn" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentsOut" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "productCount" INTEGER NOT NULL DEFAULT 0,
    "lowStockCount" INTEGER NOT NULL DEFAULT 0,
    "outOfStockCount" INTEGER NOT NULL DEFAULT 0,
    "batchCount" INTEGER NOT NULL DEFAULT 0,
    "nearExpiryCount" INTEGER NOT NULL DEFAULT 0,
    "expiredCount" INTEGER NOT NULL DEFAULT 0,
    "inventoryCostValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "inventoryMrpValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "customerCount" INTEGER NOT NULL DEFAULT 0,
    "supplierCount" INTEGER NOT NULL DEFAULT 0,
    "receivablesTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "payablesTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "aiCalls" INTEGER NOT NULL DEFAULT 0,
    "aiTokens" INTEGER NOT NULL DEFAULT 0,
    "aiCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BusinessDailyStats_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CronJobLog" (
    "id" TEXT NOT NULL,
    "jobName" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "durationMs" INTEGER,
    "businessesProcessed" INTEGER NOT NULL DEFAULT 0,
    "recordsWritten" INTEGER NOT NULL DEFAULT 0,
    "errorMessage" TEXT,
    "log" TEXT,

    CONSTRAINT "CronJobLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AIResponseCache" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "normalizedQuery" TEXT NOT NULL,
    "dataHash" TEXT NOT NULL,
    "response" TEXT NOT NULL,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AIResponseCache_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FefoOverride" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "saleId" TEXT,
    "saleItemId" TEXT,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "selectedBatchId" TEXT NOT NULL,
    "selectedBatchNo" TEXT NOT NULL,
    "expectedBatchId" TEXT NOT NULL,
    "expectedBatchNo" TEXT NOT NULL,
    "userId" TEXT,
    "userName" TEXT,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FefoOverride_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_configs" (
    "id" TEXT NOT NULL,
    "feature" TEXT NOT NULL,
    "maxOutputTokens" INTEGER NOT NULL DEFAULT 1024,
    "maxInputBatches" INTEGER,
    "maxInputProducts" INTEGER,
    "maxInputImages" INTEGER,
    "systemPrompt" TEXT,
    "userPromptTemplate" TEXT,
    "temperature" DOUBLE PRECISION,
    "disableThinking" BOOLEAN,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "ai_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kill_switches" (
    "id" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "thresholdValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "actualValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "triggeredBy" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deactivatedAt" TIMESTAMP(3),
    "deactivatedBy" TEXT,
    "notes" TEXT,

    CONSTRAINT "kill_switches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kill_switch_thresholds" (
    "id" TEXT NOT NULL,
    "trigger" TEXT NOT NULL,
    "thresholdValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT '',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "kill_switch_thresholds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_recipients" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "label" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_recipients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_schedules" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "frequency" TEXT NOT NULL,
    "dayOfWeek" INTEGER,
    "dayOfMonth" INTEGER,
    "startDate" TIMESTAMP(3),
    "endDate" TIMESTAMP(3),
    "occasions" TEXT NOT NULL DEFAULT '[]',
    "considerSeasons" BOOLEAN NOT NULL DEFAULT true,
    "considerEpidemics" BOOLEAN NOT NULL DEFAULT true,
    "targetClientMode" TEXT NOT NULL DEFAULT 'all',
    "targetClientIds" TEXT,
    "deliveryChannels" TEXT NOT NULL DEFAULT '["email"]',
    "reportPeriodDays" INTEGER NOT NULL DEFAULT 7,
    "businessTypeId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastRunAt" TIMESTAMP(3),
    "nextRunAt" TIMESTAMP(3),
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_occasions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "datePattern" TEXT NOT NULL,
    "fixedMonth" INTEGER,
    "fixedDay" INTEGER,
    "weeklyDayOfWeek" INTEGER,
    "impactWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "durationDays" INTEGER NOT NULL DEFAULT 1,
    "leadDays" INTEGER NOT NULL DEFAULT 0,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_occasions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_seasons" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "startMonth" INTEGER NOT NULL,
    "startDay" INTEGER NOT NULL DEFAULT 1,
    "endMonth" INTEGER NOT NULL,
    "endDay" INTEGER NOT NULL DEFAULT 28,
    "impactWeight" DOUBLE PRECISION NOT NULL DEFAULT 1.0,
    "affectedCategories" TEXT NOT NULL DEFAULT '[]',
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "holiday_calendar" (
    "id" TEXT NOT NULL,
    "occasionId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "isConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "year" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "holiday_calendar_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "epidemic_alerts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "diseaseType" TEXT NOT NULL,
    "severity" TEXT NOT NULL DEFAULT 'moderate',
    "impactWeight" DOUBLE PRECISION NOT NULL DEFAULT 2.0,
    "affectedCategories" TEXT NOT NULL DEFAULT '[]',
    "affectedProducts" TEXT NOT NULL DEFAULT '[]',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "declaredBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "epidemic_alerts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_reports" (
    "id" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "reportDate" TIMESTAMP(3) NOT NULL,
    "reportPeriodStart" TIMESTAMP(3) NOT NULL,
    "reportPeriodEnd" TIMESTAMP(3) NOT NULL,
    "executiveSummary" TEXT,
    "spikePredictions" TEXT,
    "topItems" TEXT,
    "stockRisks" TEXT,
    "appliedInfluences" TEXT NOT NULL DEFAULT '{}',
    "aiTokensUsed" INTEGER NOT NULL DEFAULT 0,
    "aiCostEstimate" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "generationStatus" TEXT NOT NULL DEFAULT 'pending',
    "errorMessage" TEXT,
    "pdfUrl" TEXT,
    "predictionConfidence" TEXT NOT NULL DEFAULT 'medium',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "generated_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "report_deliveries" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "errorMessage" TEXT,
    "retryCount" INTEGER NOT NULL DEFAULT 0,
    "providerMessageId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "report_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_invoices" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "tier" TEXT NOT NULL,
    "billingPeriod" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAt" TIMESTAMP(3),
    "paymentMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "subscription_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_transactions" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "method" TEXT NOT NULL,
    "trxId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "submittedBy" TEXT,
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matchedAt" TIMESTAMP(3),
    "matchedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payment_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "received_payments" (
    "id" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "trxId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "uploadedBy" TEXT,
    "matchedTransactionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "received_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_config" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "sslStoreId" TEXT,
    "sslStorePasswd" TEXT,
    "sslMode" TEXT NOT NULL DEFAULT 'sandbox',
    "bkashActive" BOOLEAN NOT NULL DEFAULT true,
    "nagadActive" BOOLEAN NOT NULL DEFAULT true,
    "sslActive" BOOLEAN NOT NULL DEFAULT false,
    "bkashNumber" TEXT,
    "nagadNumber" TEXT,
    "proMonthly" DOUBLE PRECISION NOT NULL DEFAULT 800,
    "proAnnual" DOUBLE PRECISION NOT NULL DEFAULT 8000,
    "proAiMonthly" DOUBLE PRECISION NOT NULL DEFAULT 1500,
    "proAiAnnual" DOUBLE PRECISION NOT NULL DEFAULT 15000,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "payment_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_adjustments" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "daysAdjusted" INTEGER NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reason" TEXT NOT NULL,
    "oldTier" TEXT,
    "newTier" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_adjustments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "smtp_configs" (
    "id" TEXT NOT NULL DEFAULT 'default',
    "host" TEXT NOT NULL,
    "port" INTEGER NOT NULL DEFAULT 587,
    "user" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "fromEmail" TEXT,
    "fromName" TEXT NOT NULL DEFAULT 'InventoryOS',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "smtp_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_manufacturers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "shortCode" TEXT,
    "country" TEXT NOT NULL DEFAULT 'Bangladesh',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "productCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_manufacturers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "master_products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "genericName" TEXT,
    "strength" TEXT,
    "dosageForm" TEXT,
    "manufacturerId" TEXT,
    "manufacturerStr" TEXT,
    "categoryName" TEXT,
    "scheduleType" TEXT,
    "hsnCode" TEXT,
    "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "defaultMrp" DOUBLE PRECISION,
    "dgdaRegNo" TEXT,
    "barcode" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'piece',
    "stripSize" INTEGER,
    "boxSize" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "master_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shelf_scans" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "imageCount" INTEGER NOT NULL,
    "detectedCount" INTEGER NOT NULL DEFAULT 0,
    "matchedCount" INTEGER NOT NULL DEFAULT 0,
    "rawResult" TEXT,
    "tokensUsed" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "stockCountZoneSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shelf_scans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "shelf_scan_items" (
    "id" TEXT NOT NULL,
    "shelfScanId" TEXT NOT NULL,
    "productId" TEXT,
    "masterProductId" TEXT,
    "detectedName" TEXT NOT NULL,
    "detectedStrength" TEXT,
    "detectedForm" TEXT,
    "detectedManufacturer" TEXT,
    "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "matchedMethod" TEXT NOT NULL DEFAULT 'ai',
    "previousQuantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "newQuantity" DOUBLE PRECISION,
    "appliedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "shelf_scan_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "storage_zones" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "color" TEXT NOT NULL DEFAULT '#0d9488',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "storage_zones_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_zone_assignments" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_zone_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_count_days" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "startedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "appliedAt" TIMESTAMP(3),
    "startedBy" TEXT,
    "closedBy" TEXT,
    "appliedBy" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_count_days_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_count_zone_sessions" (
    "id" TEXT NOT NULL,
    "scdId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "closedAt" TIMESTAMP(3),
    "closedBy" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_count_zone_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_count_product_summaries" (
    "id" TEXT NOT NULL,
    "scdId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "systemQtyAtStart" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "soldDuringScd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalCountedQty" DOUBLE PRECISION,
    "variance" DOUBLE PRECISION,
    "varianceReason" TEXT,
    "varianceNote" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_count_product_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_count_lines" (
    "id" TEXT NOT NULL,
    "scdId" TEXT NOT NULL,
    "zoneSessionId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "countedQty" DOUBLE PRECISION,
    "systemQtyAtStart" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "soldDuringScd" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "detectedName" TEXT,
    "confidence" DOUBLE PRECISION,
    "shelfScanItemId" TEXT,
    "countedBy" TEXT,
    "countedAt" TIMESTAMP(3),
    "notes" TEXT,
    "autoAssigned" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_count_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "zone_assignment_snapshots" (
    "id" TEXT NOT NULL,
    "scdId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "zone_assignment_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_providers" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "apiKey" TEXT,
    "baseUrl" TEXT,
    "model" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedBy" TEXT,

    CONSTRAINT "ai_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cctv_categories" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT 'Package',
    "color" TEXT NOT NULL DEFAULT '#7c3aed',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cctv_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cctv_products" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "categoryId" TEXT,
    "name" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "model" TEXT,
    "sku" TEXT,
    "description" TEXT,
    "hsnCode" TEXT,
    "costPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sellPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "mrp" DOUBLE PRECISION,
    "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stock" INTEGER NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'piece',
    "minStock" INTEGER NOT NULL DEFAULT 0,
    "maxStock" INTEGER NOT NULL DEFAULT 0,
    "serialTracked" BOOLEAN NOT NULL DEFAULT false,
    "warrantyMonths" INTEGER NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cctv_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cctv_serial_items" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "imei" TEXT,
    "status" TEXT NOT NULL DEFAULT 'IN_STOCK',
    "grade" TEXT,
    "conditionNotes" TEXT,
    "costPrice" DOUBLE PRECISION,
    "sellPrice" DOUBLE PRECISION,
    "purchaseId" TEXT,
    "supplierId" TEXT,
    "purchaseDate" TIMESTAMP(3),
    "warrantyMonths" INTEGER NOT NULL DEFAULT 0,
    "warrantyStart" TIMESTAMP(3),
    "warrantyEnd" TIMESTAMP(3),
    "customerId" TEXT,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "saleId" TEXT,
    "jobCardId" TEXT,
    "projectId" TEXT,
    "branchId" TEXT,
    "currentLocation" TEXT,
    "source" TEXT NOT NULL DEFAULT 'STOCK_IN',
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cctv_serial_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cctv_serial_item_history" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "serialItemId" TEXT NOT NULL,
    "fromStatus" TEXT,
    "toStatus" TEXT NOT NULL,
    "event" TEXT NOT NULL,
    "userId" TEXT,
    "referenceId" TEXT,
    "referenceType" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cctv_serial_item_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cctv_kit_definitions" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "kitPrice" DOUBLE PRECISION,
    "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cctv_kit_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cctv_kit_components" (
    "id" TEXT NOT NULL,
    "kitId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "componentLabel" TEXT,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cctv_kit_components_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cctv_branches" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "phone" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cctv_branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cctv_transfers" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "transferCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "fromBranchId" TEXT NOT NULL,
    "toBranchId" TEXT NOT NULL,
    "notes" TEXT,
    "createdById" TEXT,
    "receivedById" TEXT,
    "receivedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cctv_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cctv_transfer_items" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "serialItemId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'IN_TRANSIT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cctv_transfer_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cctv_job_cards" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "jobCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'RECEIVED',
    "jobType" TEXT NOT NULL DEFAULT 'REPAIR',
    "customerId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "serialItemId" TEXT,
    "productId" TEXT,
    "deviceName" TEXT,
    "serialNumber" TEXT,
    "imei" TEXT,
    "conditionNotes" TEXT,
    "photoUrls" TEXT,
    "reportedFault" TEXT NOT NULL,
    "diagnosis" TEXT,
    "repairNotes" TEXT,
    "estimatedCost" DOUBLE PRECISION,
    "finalCost" DOUBLE PRECISION,
    "laborCharge" DOUBLE PRECISION,
    "assignedToId" TEXT,
    "assignedToName" TEXT,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "diagnosedAt" TIMESTAMP(3),
    "startedAt" TIMESTAMP(3),
    "testedAt" TIMESTAMP(3),
    "readyAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "outsourcedAt" TIMESTAMP(3),
    "collectorName" TEXT,
    "collectorNid" TEXT,
    "collectorPhone" TEXT,
    "otpCode" TEXT,
    "otpGeneratedAt" TIMESTAMP(3),
    "otpVerified" BOOLEAN NOT NULL DEFAULT false,
    "otpVerifiedAt" TIMESTAMP(3),
    "satisfactionRating" INTEGER,
    "vendorId" TEXT,
    "vendorName" TEXT,
    "vendorPhone" TEXT,
    "vendorCost" DOUBLE PRECISION,
    "expectedReturn" TIMESTAMP(3),
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "internalNotes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cctv_job_cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cctv_job_card_parts" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "jobCardId" TEXT NOT NULL,
    "serialItemId" TEXT NOT NULL,
    "unitCost" DOUBLE PRECISION,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cctv_job_card_parts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cctv_technicians" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "userId" TEXT,
    "displayName" TEXT NOT NULL,
    "phone" TEXT,
    "specialization" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cctv_technicians_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cctv_commission_rules" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ruleType" TEXT NOT NULL,
    "jobType" TEXT,
    "fixedAmount" DOUBLE PRECISION,
    "percentRate" DOUBLE PRECISION,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cctv_commission_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cctv_commission_records" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "technicianId" TEXT NOT NULL,
    "jobCardId" TEXT NOT NULL,
    "ruleId" TEXT,
    "commissionAmount" DOUBLE PRECISION NOT NULL,
    "ruleType" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "laborCharge" DOUBLE PRECISION,
    "partsCost" DOUBLE PRECISION,
    "profitMargin" DOUBLE PRECISION,
    "month" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cctv_commission_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cctv_outsourced_vendors" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "specialization" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cctv_outsourced_vendors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cctv_sales" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "saleCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "customerId" TEXT,
    "customerName" TEXT NOT NULL DEFAULT 'Walk-in Customer',
    "customerPhone" TEXT,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalDue" DOUBLE PRECISION NOT NULL,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cctv_sales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cctv_sale_items" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "serialItemId" TEXT,
    "kitId" TEXT,
    "productName" TEXT NOT NULL,
    "productBrand" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cctv_sale_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cctv_payments" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "referenceNumber" TEXT,
    "receivedBy" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cctv_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cctv_emi_plans" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "saleId" TEXT,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "productBrand" TEXT,
    "productId" TEXT,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "downPayment" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "financedAmount" DOUBLE PRECISION NOT NULL,
    "interestRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "interestType" TEXT NOT NULL DEFAULT 'REDUCING',
    "totalInterest" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grandTotal" DOUBLE PRECISION NOT NULL,
    "months" INTEGER NOT NULL,
    "monthlyPayment" DOUBLE PRECISION NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "graceDays" INTEGER NOT NULL DEFAULT 3,
    "paidInstallments" INTEGER NOT NULL DEFAULT 0,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "remainingAmount" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "completedAt" TIMESTAMP(3),
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cctv_emi_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cctv_emi_installments" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "emiPlanId" TEXT NOT NULL,
    "installmentNo" INTEGER NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "dueAmount" DOUBLE PRECISION NOT NULL,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paidAt" TIMESTAMP(3),
    "receivedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "waiverAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cctv_emi_installments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cctv_loyalty_configs" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "earnRatePoints" INTEGER NOT NULL DEFAULT 1,
    "earnRateAmount" DOUBLE PRECISION NOT NULL DEFAULT 100,
    "redeemPointsRequired" INTEGER NOT NULL DEFAULT 100,
    "redeemRateValue" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "tierBronze" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tierSilver" DOUBLE PRECISION NOT NULL DEFAULT 50000,
    "tierGold" DOUBLE PRECISION NOT NULL DEFAULT 200000,
    "tierPlatinum" DOUBLE PRECISION NOT NULL DEFAULT 500000,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cctv_loyalty_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cctv_loyalty_transactions" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "saleId" TEXT,
    "offerId" TEXT,
    "description" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cctv_loyalty_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cctv_loyalty_offers" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "offerType" TEXT NOT NULL,
    "multiplier" DOUBLE PRECISION NOT NULL DEFAULT 2,
    "bonusPoints" INTEGER,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cctv_loyalty_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cctv_warranty_claims" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "serialItemId" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "customerPhone" TEXT,
    "issueDescription" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "resolutionNotes" TEXT,
    "approvedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "approvedById" TEXT,
    "jobCardId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cctv_warranty_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cctv_projects" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "projectName" TEXT NOT NULL,
    "projectCode" TEXT NOT NULL,
    "clientId" TEXT,
    "clientName" TEXT NOT NULL,
    "clientPhone" TEXT,
    "clientEmail" TEXT,
    "clientAddress" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PLANNING',
    "projectType" TEXT NOT NULL DEFAULT 'INSTALLATION',
    "totalItems" INTEGER NOT NULL DEFAULT 0,
    "completedItems" INTEGER NOT NULL DEFAULT 0,
    "projectValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "startDate" TIMESTAMP(3),
    "deadline" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "siteAddress" TEXT,
    "siteContact" TEXT,
    "siteContactPhone" TEXT,
    "saleId" TEXT,
    "notes" TEXT,
    "internalNotes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cctv_projects_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cctv_site_surveys" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "floorPlanData" TEXT,
    "floorPlanName" TEXT,
    "surveyDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "surveyorName" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cctv_site_surveys_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cctv_camera_positions" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "posX" DOUBLE PRECISION NOT NULL,
    "posY" DOUBLE PRECISION NOT NULL,
    "label" TEXT NOT NULL,
    "cameraType" TEXT NOT NULL DEFAULT 'Bullet',
    "resolution" TEXT,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cctv_camera_positions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cctv_cable_routes" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "surveyId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "points" TEXT NOT NULL,
    "cableType" TEXT NOT NULL DEFAULT 'Cat6',
    "cableLength" DOUBLE PRECISION,
    "notes" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cctv_cable_routes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cctv_amc_contracts" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "contractCode" TEXT NOT NULL,
    "clientId" TEXT,
    "clientName" TEXT NOT NULL,
    "clientPhone" TEXT,
    "clientEmail" TEXT,
    "clientAddress" TEXT,
    "coverageType" TEXT NOT NULL DEFAULT 'Standard',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "totalAmount" DOUBLE PRECISION NOT NULL,
    "paymentFrequency" TEXT NOT NULL DEFAULT 'MONTHLY',
    "paymentAmount" DOUBLE PRECISION NOT NULL,
    "visitsIncluded" INTEGER NOT NULL DEFAULT 1,
    "slaTerms" TEXT,
    "responseHours" INTEGER NOT NULL DEFAULT 48,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "totalVisitsUsed" INTEGER NOT NULL DEFAULT 0,
    "totalRevenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "internalNotes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cctv_amc_contracts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cctv_amc_visits" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "visitDate" TIMESTAMP(3) NOT NULL,
    "technicianName" TEXT,
    "technicianId" TEXT,
    "visitType" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "workPerformed" TEXT,
    "partsReplaced" TEXT,
    "partsCost" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "findings" TEXT,
    "customerSignOff" BOOLEAN NOT NULL DEFAULT false,
    "visitNotes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cctv_amc_visits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cctv_installation_tasks" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "taskTitle" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "completedDate" TIMESTAMP(3),
    "assignedToId" TEXT,
    "assignedToName" TEXT,
    "location" TEXT,
    "siteAddress" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "priority" TEXT NOT NULL DEFAULT 'NORMAL',
    "totalChecklist" INTEGER NOT NULL DEFAULT 0,
    "completedChecklist" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "internalNotes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cctv_installation_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cctv_task_checklists" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "itemText" TEXT NOT NULL,
    "isCompleted" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "completedAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cctv_task_checklists_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cctv_nbr_configs" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "bin" TEXT,
    "taxRegistrationStatus" TEXT NOT NULL DEFAULT 'UNREGISTERED',
    "applicableVatRate" DOUBLE PRECISION NOT NULL DEFAULT 15.0,
    "mushakInvoicePrefix" TEXT NOT NULL DEFAULT 'MUSHAK',
    "mushakInvoiceSeq" INTEGER NOT NULL DEFAULT 0,
    "legalName" TEXT,
    "legalAddress" TEXT,
    "tradeLicenseNo" TEXT,
    "isVatEnabled" BOOLEAN NOT NULL DEFAULT false,
    "autoMushakInvoice" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cctv_nbr_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cctv_hs_code_mappings" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "configId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "hsCode" TEXT NOT NULL,
    "description" TEXT,
    "vatRate" DOUBLE PRECISION NOT NULL DEFAULT 15.0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cctv_hs_code_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cctv_mushak_invoices" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sellerName" TEXT NOT NULL,
    "sellerAddress" TEXT,
    "sellerBin" TEXT,
    "buyerName" TEXT NOT NULL,
    "buyerAddress" TEXT,
    "buyerBin" TEXT,
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalVat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "grandTotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "amountInWords" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cctv_mushak_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cctv_mushak_line_items" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "slNo" INTEGER NOT NULL,
    "productName" TEXT NOT NULL,
    "hsCode" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,
    "vatRate" DOUBLE PRECISION NOT NULL,
    "vatAmount" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cctv_mushak_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cctv_vat_returns" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "taxYear" INTEGER NOT NULL,
    "taxMonth" INTEGER NOT NULL,
    "openingCredit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "localPurchaseCredit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "localPurchaseValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "localPurchaseCount" INTEGER NOT NULL DEFAULT 0,
    "importCredit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "importValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "importCount" INTEGER NOT NULL DEFAULT 0,
    "totalInputCredit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "outputTax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "salesValue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "salesCount" INTEGER NOT NULL DEFAULT 0,
    "netVatPayable" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "adjustmentAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "adjustmentNote" TEXT,
    "adjustedNetVat" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "declaredBy" TEXT,
    "declaredAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "amountInWords" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cctv_vat_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cctv_purchases" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "supplierId" TEXT,
    "purchaseNo" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discountAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "totalAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "paymentStatus" TEXT NOT NULL DEFAULT 'unpaid',
    "invoiceNo" TEXT,
    "invoiceDate" TIMESTAMP(3),
    "receivedDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cctv_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cctv_purchase_items" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "productBrand" TEXT,
    "quantity" INTEGER NOT NULL,
    "receivedQty" INTEGER NOT NULL DEFAULT 0,
    "unitCost" DOUBLE PRECISION NOT NULL,
    "totalPrice" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "cctv_purchase_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_serial_numbers" (
    "id" TEXT NOT NULL,
    "purchaseOrderItemId" TEXT NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "purchase_order_serial_numbers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cctv_returns" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "returnCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "refundMethod" TEXT,
    "refundAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "refundReference" TEXT,
    "customerName" TEXT NOT NULL DEFAULT '',
    "customerPhone" TEXT,
    "reason" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cctv_returns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cctv_return_items" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "saleItemId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "productBrand" TEXT,
    "serialItemId" TEXT,
    "quantity" INTEGER NOT NULL,
    "unitPrice" DOUBLE PRECISION NOT NULL,
    "refundAmount" DOUBLE PRECISION NOT NULL,
    "serialRestoredTo" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cctv_return_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cctv_expenses" (
    "id" TEXT NOT NULL,
    "businessId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "category" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "description" TEXT,
    "paymentMethod" TEXT,
    "reference" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cctv_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BusinessType_slug_key" ON "BusinessType"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "TrustedDevice_token_key" ON "TrustedDevice"("token");

-- CreateIndex
CREATE INDEX "TrustedDevice_userId_idx" ON "TrustedDevice"("userId");

-- CreateIndex
CREATE INDEX "TrustedDevice_token_idx" ON "TrustedDevice"("token");

-- CreateIndex
CREATE INDEX "TrustedDevice_expiresAt_idx" ON "TrustedDevice"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "PhoneAuthToken_token_key" ON "PhoneAuthToken"("token");

-- CreateIndex
CREATE INDEX "PhoneAuthToken_token_idx" ON "PhoneAuthToken"("token");

-- CreateIndex
CREATE INDEX "PhoneAuthToken_expiresAt_idx" ON "PhoneAuthToken"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Business_shopCode_key" ON "Business"("shopCode");

-- CreateIndex
CREATE INDEX "Business_userId_idx" ON "Business"("userId");

-- CreateIndex
CREATE INDEX "Business_businessTypeId_idx" ON "Business"("businessTypeId");

-- CreateIndex
CREATE INDEX "Business_subscriptionStage_idx" ON "Business"("subscriptionStage");

-- CreateIndex
CREATE INDEX "Business_subscriptionEnd_idx" ON "Business"("subscriptionEnd");

-- CreateIndex
CREATE INDEX "BusinessUser_businessId_idx" ON "BusinessUser"("businessId");

-- CreateIndex
CREATE INDEX "BusinessUser_role_idx" ON "BusinessUser"("role");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessUser_businessId_username_key" ON "BusinessUser"("businessId", "username");

-- CreateIndex
CREATE INDEX "Category_businessId_idx" ON "Category"("businessId");

-- CreateIndex
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_businessId_slug_key" ON "Category"("businessId", "slug");

-- CreateIndex
CREATE INDEX "Product_businessId_idx" ON "Product"("businessId");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE INDEX "Product_genericName_idx" ON "Product"("genericName");

-- CreateIndex
CREATE INDEX "Product_manufacturer_idx" ON "Product"("manufacturer");

-- CreateIndex
CREATE INDEX "Product_masterProductId_idx" ON "Product"("masterProductId");

-- CreateIndex
CREATE INDEX "Batch_businessId_idx" ON "Batch"("businessId");

-- CreateIndex
CREATE INDEX "Batch_productId_idx" ON "Batch"("productId");

-- CreateIndex
CREATE INDEX "Batch_expiryDate_idx" ON "Batch"("expiryDate");

-- CreateIndex
CREATE INDEX "Batch_status_idx" ON "Batch"("status");

-- CreateIndex
CREATE INDEX "Batch_supplierId_idx" ON "Batch"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_productId_key" ON "Inventory"("productId");

-- CreateIndex
CREATE INDEX "Inventory_businessId_idx" ON "Inventory"("businessId");

-- CreateIndex
CREATE INDEX "Transaction_businessId_idx" ON "Transaction"("businessId");

-- CreateIndex
CREATE INDEX "Transaction_productId_idx" ON "Transaction"("productId");

-- CreateIndex
CREATE INDEX "Transaction_createdAt_idx" ON "Transaction"("createdAt");

-- CreateIndex
CREATE INDEX "OtpVerification_phone_purpose_idx" ON "OtpVerification"("phone", "purpose");

-- CreateIndex
CREATE INDEX "OtpVerification_expiresAt_idx" ON "OtpVerification"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "Session_token_key" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_businessUserId_idx" ON "Session"("businessUserId");

-- CreateIndex
CREATE INDEX "Session_token_idx" ON "Session"("token");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AlertPreference_businessId_key" ON "AlertPreference"("businessId");

-- CreateIndex
CREATE INDEX "AlertPreference_businessId_idx" ON "AlertPreference"("businessId");

-- CreateIndex
CREATE INDEX "NotificationLog_businessId_idx" ON "NotificationLog"("businessId");

-- CreateIndex
CREATE INDEX "NotificationLog_type_idx" ON "NotificationLog"("type");

-- CreateIndex
CREATE INDEX "NotificationLog_isRead_idx" ON "NotificationLog"("isRead");

-- CreateIndex
CREATE INDEX "NotificationLog_createdAt_idx" ON "NotificationLog"("createdAt");

-- CreateIndex
CREATE INDEX "Customer_businessId_idx" ON "Customer"("businessId");

-- CreateIndex
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "Customer_name_idx" ON "Customer"("name");

-- CreateIndex
CREATE INDEX "Sale_businessId_idx" ON "Sale"("businessId");

-- CreateIndex
CREATE INDEX "Sale_customerId_idx" ON "Sale"("customerId");

-- CreateIndex
CREATE INDEX "Sale_status_idx" ON "Sale"("status");

-- CreateIndex
CREATE INDEX "Sale_paymentStatus_idx" ON "Sale"("paymentStatus");

-- CreateIndex
CREATE INDEX "Sale_createdAt_idx" ON "Sale"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_businessId_invoiceNo_key" ON "Sale"("businessId", "invoiceNo");

-- CreateIndex
CREATE INDEX "SaleItem_saleId_idx" ON "SaleItem"("saleId");

-- CreateIndex
CREATE INDEX "SaleItem_productId_idx" ON "SaleItem"("productId");

-- CreateIndex
CREATE INDEX "SaleItem_batchId_idx" ON "SaleItem"("batchId");

-- CreateIndex
CREATE INDEX "Payment_businessId_idx" ON "Payment"("businessId");

-- CreateIndex
CREATE INDEX "Payment_saleId_idx" ON "Payment"("saleId");

-- CreateIndex
CREATE INDEX "Payment_customerId_idx" ON "Payment"("customerId");

-- CreateIndex
CREATE INDEX "Payment_createdAt_idx" ON "Payment"("createdAt");

-- CreateIndex
CREATE INDEX "Return_businessId_idx" ON "Return"("businessId");

-- CreateIndex
CREATE INDEX "Return_saleId_idx" ON "Return"("saleId");

-- CreateIndex
CREATE INDEX "Return_customerId_idx" ON "Return"("customerId");

-- CreateIndex
CREATE INDEX "Return_createdAt_idx" ON "Return"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Return_businessId_returnNo_key" ON "Return"("businessId", "returnNo");

-- CreateIndex
CREATE INDEX "ReturnItem_returnId_idx" ON "ReturnItem"("returnId");

-- CreateIndex
CREATE INDEX "ReturnItem_saleItemId_idx" ON "ReturnItem"("saleItemId");

-- CreateIndex
CREATE INDEX "DiscountRule_businessId_idx" ON "DiscountRule"("businessId");

-- CreateIndex
CREATE INDEX "DiscountRule_isActive_idx" ON "DiscountRule"("isActive");

-- CreateIndex
CREATE INDEX "DiscountRule_scope_idx" ON "DiscountRule"("scope");

-- CreateIndex
CREATE INDEX "Supplier_businessId_idx" ON "Supplier"("businessId");

-- CreateIndex
CREATE INDEX "Supplier_name_idx" ON "Supplier"("name");

-- CreateIndex
CREATE INDEX "Supplier_phone_idx" ON "Supplier"("phone");

-- CreateIndex
CREATE INDEX "Purchase_businessId_idx" ON "Purchase"("businessId");

-- CreateIndex
CREATE INDEX "Purchase_supplierId_idx" ON "Purchase"("supplierId");

-- CreateIndex
CREATE INDEX "Purchase_status_idx" ON "Purchase"("status");

-- CreateIndex
CREATE INDEX "Purchase_createdAt_idx" ON "Purchase"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Purchase_businessId_purchaseNo_key" ON "Purchase"("businessId", "purchaseNo");

-- CreateIndex
CREATE INDEX "PurchaseItem_purchaseId_idx" ON "PurchaseItem"("purchaseId");

-- CreateIndex
CREATE INDEX "PurchaseItem_productId_idx" ON "PurchaseItem"("productId");

-- CreateIndex
CREATE INDEX "AIUsageLog_businessId_idx" ON "AIUsageLog"("businessId");

-- CreateIndex
CREATE INDEX "AIUsageLog_feature_idx" ON "AIUsageLog"("feature");

-- CreateIndex
CREATE INDEX "AIUsageLog_createdAt_idx" ON "AIUsageLog"("createdAt");

-- CreateIndex
CREATE INDEX "AIUsageLog_businessId_createdAt_idx" ON "AIUsageLog"("businessId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SuperAdmin_username_key" ON "SuperAdmin"("username");

-- CreateIndex
CREATE UNIQUE INDEX "SuperAdminSession_token_key" ON "SuperAdminSession"("token");

-- CreateIndex
CREATE INDEX "SuperAdminSession_superAdminId_idx" ON "SuperAdminSession"("superAdminId");

-- CreateIndex
CREATE INDEX "SuperAdminSession_token_idx" ON "SuperAdminSession"("token");

-- CreateIndex
CREATE INDEX "SuperAdminSession_expiresAt_idx" ON "SuperAdminSession"("expiresAt");

-- CreateIndex
CREATE INDEX "BusinessDailyStats_businessId_date_idx" ON "BusinessDailyStats"("businessId", "date");

-- CreateIndex
CREATE INDEX "BusinessDailyStats_date_idx" ON "BusinessDailyStats"("date");

-- CreateIndex
CREATE UNIQUE INDEX "BusinessDailyStats_businessId_date_key" ON "BusinessDailyStats"("businessId", "date");

-- CreateIndex
CREATE INDEX "CronJobLog_jobName_startedAt_idx" ON "CronJobLog"("jobName", "startedAt");

-- CreateIndex
CREATE INDEX "CronJobLog_status_idx" ON "CronJobLog"("status");

-- CreateIndex
CREATE INDEX "CronJobLog_startedAt_idx" ON "CronJobLog"("startedAt");

-- CreateIndex
CREATE INDEX "AIResponseCache_businessId_feature_normalizedQuery_idx" ON "AIResponseCache"("businessId", "feature", "normalizedQuery");

-- CreateIndex
CREATE INDEX "AIResponseCache_expiresAt_idx" ON "AIResponseCache"("expiresAt");

-- CreateIndex
CREATE INDEX "AIResponseCache_businessId_expiresAt_idx" ON "AIResponseCache"("businessId", "expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "AIResponseCache_businessId_feature_normalizedQuery_dataHash_key" ON "AIResponseCache"("businessId", "feature", "normalizedQuery", "dataHash");

-- CreateIndex
CREATE INDEX "FefoOverride_businessId_createdAt_idx" ON "FefoOverride"("businessId", "createdAt");

-- CreateIndex
CREATE INDEX "FefoOverride_saleId_idx" ON "FefoOverride"("saleId");

-- CreateIndex
CREATE INDEX "FefoOverride_productId_idx" ON "FefoOverride"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_configs_feature_key" ON "ai_configs"("feature");

-- CreateIndex
CREATE INDEX "kill_switches_trigger_isActive_idx" ON "kill_switches"("trigger", "isActive");

-- CreateIndex
CREATE INDEX "kill_switches_triggeredAt_idx" ON "kill_switches"("triggeredAt");

-- CreateIndex
CREATE INDEX "kill_switches_triggeredBy_idx" ON "kill_switches"("triggeredBy");

-- CreateIndex
CREATE UNIQUE INDEX "kill_switch_thresholds_trigger_key" ON "kill_switch_thresholds"("trigger");

-- CreateIndex
CREATE UNIQUE INDEX "notification_recipients_email_key" ON "notification_recipients"("email");

-- CreateIndex
CREATE INDEX "report_schedules_isActive_nextRunAt_idx" ON "report_schedules"("isActive", "nextRunAt");

-- CreateIndex
CREATE INDEX "report_schedules_frequency_idx" ON "report_schedules"("frequency");

-- CreateIndex
CREATE INDEX "report_schedules_businessTypeId_idx" ON "report_schedules"("businessTypeId");

-- CreateIndex
CREATE UNIQUE INDEX "report_occasions_slug_key" ON "report_occasions"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "report_seasons_slug_key" ON "report_seasons"("slug");

-- CreateIndex
CREATE INDEX "holiday_calendar_date_idx" ON "holiday_calendar"("date");

-- CreateIndex
CREATE INDEX "holiday_calendar_year_idx" ON "holiday_calendar"("year");

-- CreateIndex
CREATE UNIQUE INDEX "holiday_calendar_occasionId_date_key" ON "holiday_calendar"("occasionId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "epidemic_alerts_slug_key" ON "epidemic_alerts"("slug");

-- CreateIndex
CREATE INDEX "epidemic_alerts_isActive_startDate_endDate_idx" ON "epidemic_alerts"("isActive", "startDate", "endDate");

-- CreateIndex
CREATE INDEX "epidemic_alerts_diseaseType_idx" ON "epidemic_alerts"("diseaseType");

-- CreateIndex
CREATE INDEX "generated_reports_scheduleId_reportDate_idx" ON "generated_reports"("scheduleId", "reportDate");

-- CreateIndex
CREATE INDEX "generated_reports_businessId_reportDate_idx" ON "generated_reports"("businessId", "reportDate");

-- CreateIndex
CREATE INDEX "generated_reports_generationStatus_idx" ON "generated_reports"("generationStatus");

-- CreateIndex
CREATE INDEX "generated_reports_reportDate_idx" ON "generated_reports"("reportDate");

-- CreateIndex
CREATE INDEX "report_deliveries_reportId_idx" ON "report_deliveries"("reportId");

-- CreateIndex
CREATE INDEX "report_deliveries_status_idx" ON "report_deliveries"("status");

-- CreateIndex
CREATE INDEX "report_deliveries_channel_status_idx" ON "report_deliveries"("channel", "status");

-- CreateIndex
CREATE INDEX "subscription_invoices_businessId_idx" ON "subscription_invoices"("businessId");

-- CreateIndex
CREATE INDEX "subscription_invoices_status_idx" ON "subscription_invoices"("status");

-- CreateIndex
CREATE INDEX "subscription_invoices_dueDate_idx" ON "subscription_invoices"("dueDate");

-- CreateIndex
CREATE INDEX "payment_transactions_businessId_idx" ON "payment_transactions"("businessId");

-- CreateIndex
CREATE INDEX "payment_transactions_status_idx" ON "payment_transactions"("status");

-- CreateIndex
CREATE INDEX "payment_transactions_trxId_idx" ON "payment_transactions"("trxId");

-- CreateIndex
CREATE INDEX "payment_transactions_method_idx" ON "payment_transactions"("method");

-- CreateIndex
CREATE INDEX "received_payments_trxId_idx" ON "received_payments"("trxId");

-- CreateIndex
CREATE INDEX "received_payments_method_idx" ON "received_payments"("method");

-- CreateIndex
CREATE INDEX "received_payments_matchedTransactionId_idx" ON "received_payments"("matchedTransactionId");

-- CreateIndex
CREATE INDEX "subscription_adjustments_businessId_idx" ON "subscription_adjustments"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "master_manufacturers_name_key" ON "master_manufacturers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "master_products_dgdaRegNo_key" ON "master_products"("dgdaRegNo");

-- CreateIndex
CREATE INDEX "master_products_name_idx" ON "master_products"("name");

-- CreateIndex
CREATE INDEX "master_products_genericName_idx" ON "master_products"("genericName");

-- CreateIndex
CREATE INDEX "master_products_manufacturerStr_idx" ON "master_products"("manufacturerStr");

-- CreateIndex
CREATE INDEX "master_products_categoryName_idx" ON "master_products"("categoryName");

-- CreateIndex
CREATE INDEX "master_products_dosageForm_idx" ON "master_products"("dosageForm");

-- CreateIndex
CREATE INDEX "master_products_barcode_idx" ON "master_products"("barcode");

-- CreateIndex
CREATE INDEX "master_products_isActive_idx" ON "master_products"("isActive");

-- CreateIndex
CREATE INDEX "shelf_scans_businessId_idx" ON "shelf_scans"("businessId");

-- CreateIndex
CREATE INDEX "shelf_scans_stockCountZoneSessionId_idx" ON "shelf_scans"("stockCountZoneSessionId");

-- CreateIndex
CREATE INDEX "shelf_scans_createdAt_idx" ON "shelf_scans"("createdAt");

-- CreateIndex
CREATE INDEX "shelf_scan_items_shelfScanId_idx" ON "shelf_scan_items"("shelfScanId");

-- CreateIndex
CREATE INDEX "shelf_scan_items_productId_idx" ON "shelf_scan_items"("productId");

-- CreateIndex
CREATE INDEX "shelf_scan_items_masterProductId_idx" ON "shelf_scan_items"("masterProductId");

-- CreateIndex
CREATE INDEX "storage_zones_businessId_idx" ON "storage_zones"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "storage_zones_businessId_name_key" ON "storage_zones"("businessId", "name");

-- CreateIndex
CREATE INDEX "product_zone_assignments_businessId_idx" ON "product_zone_assignments"("businessId");

-- CreateIndex
CREATE INDEX "product_zone_assignments_zoneId_idx" ON "product_zone_assignments"("zoneId");

-- CreateIndex
CREATE UNIQUE INDEX "product_zone_assignments_productId_zoneId_key" ON "product_zone_assignments"("productId", "zoneId");

-- CreateIndex
CREATE INDEX "stock_count_days_businessId_idx" ON "stock_count_days"("businessId");

-- CreateIndex
CREATE INDEX "stock_count_days_status_idx" ON "stock_count_days"("status");

-- CreateIndex
CREATE INDEX "stock_count_zone_sessions_businessId_idx" ON "stock_count_zone_sessions"("businessId");

-- CreateIndex
CREATE INDEX "stock_count_zone_sessions_scdId_idx" ON "stock_count_zone_sessions"("scdId");

-- CreateIndex
CREATE UNIQUE INDEX "stock_count_zone_sessions_scdId_zoneId_key" ON "stock_count_zone_sessions"("scdId", "zoneId");

-- CreateIndex
CREATE INDEX "stock_count_product_summaries_businessId_idx" ON "stock_count_product_summaries"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "stock_count_product_summaries_scdId_productId_key" ON "stock_count_product_summaries"("scdId", "productId");

-- CreateIndex
CREATE INDEX "stock_count_lines_businessId_idx" ON "stock_count_lines"("businessId");

-- CreateIndex
CREATE INDEX "stock_count_lines_scdId_idx" ON "stock_count_lines"("scdId");

-- CreateIndex
CREATE INDEX "stock_count_lines_productId_idx" ON "stock_count_lines"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "stock_count_lines_scdId_zoneSessionId_productId_key" ON "stock_count_lines"("scdId", "zoneSessionId", "productId");

-- CreateIndex
CREATE INDEX "zone_assignment_snapshots_businessId_idx" ON "zone_assignment_snapshots"("businessId");

-- CreateIndex
CREATE INDEX "zone_assignment_snapshots_scdId_idx" ON "zone_assignment_snapshots"("scdId");

-- CreateIndex
CREATE INDEX "zone_assignment_snapshots_productId_idx" ON "zone_assignment_snapshots"("productId");

-- CreateIndex
CREATE INDEX "zone_assignment_snapshots_zoneId_idx" ON "zone_assignment_snapshots"("zoneId");

-- CreateIndex
CREATE UNIQUE INDEX "zone_assignment_snapshots_scdId_productId_zoneId_key" ON "zone_assignment_snapshots"("scdId", "productId", "zoneId");

-- CreateIndex
CREATE UNIQUE INDEX "ai_providers_provider_key" ON "ai_providers"("provider");

-- CreateIndex
CREATE INDEX "cctv_categories_businessId_idx" ON "cctv_categories"("businessId");

-- CreateIndex
CREATE UNIQUE INDEX "cctv_categories_businessId_slug_key" ON "cctv_categories"("businessId", "slug");

-- CreateIndex
CREATE INDEX "cctv_products_businessId_idx" ON "cctv_products"("businessId");

-- CreateIndex
CREATE INDEX "cctv_products_categoryId_idx" ON "cctv_products"("categoryId");

-- CreateIndex
CREATE INDEX "cctv_products_brand_idx" ON "cctv_products"("brand");

-- CreateIndex
CREATE INDEX "cctv_products_name_idx" ON "cctv_products"("name");

-- CreateIndex
CREATE INDEX "cctv_products_serialTracked_idx" ON "cctv_products"("serialTracked");

-- CreateIndex
CREATE INDEX "cctv_serial_items_businessId_idx" ON "cctv_serial_items"("businessId");

-- CreateIndex
CREATE INDEX "cctv_serial_items_productId_idx" ON "cctv_serial_items"("productId");

-- CreateIndex
CREATE INDEX "cctv_serial_items_status_idx" ON "cctv_serial_items"("status");

-- CreateIndex
CREATE INDEX "cctv_serial_items_imei_idx" ON "cctv_serial_items"("imei");

-- CreateIndex
CREATE INDEX "cctv_serial_items_customerId_idx" ON "cctv_serial_items"("customerId");

-- CreateIndex
CREATE INDEX "cctv_serial_items_saleId_idx" ON "cctv_serial_items"("saleId");

-- CreateIndex
CREATE INDEX "cctv_serial_items_warrantyEnd_idx" ON "cctv_serial_items"("warrantyEnd");

-- CreateIndex
CREATE INDEX "cctv_serial_items_purchaseId_idx" ON "cctv_serial_items"("purchaseId");

-- CreateIndex
CREATE INDEX "cctv_serial_items_branchId_idx" ON "cctv_serial_items"("branchId");

-- CreateIndex
CREATE INDEX "cctv_serial_items_source_idx" ON "cctv_serial_items"("source");

-- CreateIndex
CREATE UNIQUE INDEX "cctv_serial_items_businessId_serialNumber_key" ON "cctv_serial_items"("businessId", "serialNumber");

-- CreateIndex
CREATE INDEX "cctv_serial_item_history_businessId_idx" ON "cctv_serial_item_history"("businessId");

-- CreateIndex
CREATE INDEX "cctv_serial_item_history_serialItemId_idx" ON "cctv_serial_item_history"("serialItemId");

-- CreateIndex
CREATE INDEX "cctv_serial_item_history_toStatus_idx" ON "cctv_serial_item_history"("toStatus");

-- CreateIndex
CREATE INDEX "cctv_serial_item_history_createdAt_idx" ON "cctv_serial_item_history"("createdAt");

-- CreateIndex
CREATE INDEX "cctv_kit_definitions_businessId_idx" ON "cctv_kit_definitions"("businessId");

-- CreateIndex
CREATE INDEX "cctv_kit_definitions_isActive_idx" ON "cctv_kit_definitions"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "cctv_kit_definitions_businessId_slug_key" ON "cctv_kit_definitions"("businessId", "slug");

-- CreateIndex
CREATE INDEX "cctv_kit_components_kitId_idx" ON "cctv_kit_components"("kitId");

-- CreateIndex
CREATE INDEX "cctv_kit_components_businessId_idx" ON "cctv_kit_components"("businessId");

-- CreateIndex
CREATE INDEX "cctv_kit_components_productId_idx" ON "cctv_kit_components"("productId");

-- CreateIndex
CREATE INDEX "cctv_branches_businessId_idx" ON "cctv_branches"("businessId");

-- CreateIndex
CREATE INDEX "cctv_branches_isActive_idx" ON "cctv_branches"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "cctv_branches_businessId_code_key" ON "cctv_branches"("businessId", "code");

-- CreateIndex
CREATE INDEX "cctv_transfers_businessId_idx" ON "cctv_transfers"("businessId");

-- CreateIndex
CREATE INDEX "cctv_transfers_fromBranchId_idx" ON "cctv_transfers"("fromBranchId");

-- CreateIndex
CREATE INDEX "cctv_transfers_toBranchId_idx" ON "cctv_transfers"("toBranchId");

-- CreateIndex
CREATE INDEX "cctv_transfers_status_idx" ON "cctv_transfers"("status");

-- CreateIndex
CREATE INDEX "cctv_transfers_createdAt_idx" ON "cctv_transfers"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "cctv_transfers_businessId_transferCode_key" ON "cctv_transfers"("businessId", "transferCode");

-- CreateIndex
CREATE INDEX "cctv_transfer_items_transferId_idx" ON "cctv_transfer_items"("transferId");

-- CreateIndex
CREATE INDEX "cctv_transfer_items_businessId_idx" ON "cctv_transfer_items"("businessId");

-- CreateIndex
CREATE INDEX "cctv_transfer_items_serialItemId_idx" ON "cctv_transfer_items"("serialItemId");

-- CreateIndex
CREATE UNIQUE INDEX "cctv_transfer_items_transferId_serialItemId_key" ON "cctv_transfer_items"("transferId", "serialItemId");

-- CreateIndex
CREATE INDEX "cctv_job_cards_businessId_idx" ON "cctv_job_cards"("businessId");

-- CreateIndex
CREATE INDEX "cctv_job_cards_status_idx" ON "cctv_job_cards"("status");

-- CreateIndex
CREATE INDEX "cctv_job_cards_jobType_idx" ON "cctv_job_cards"("jobType");

-- CreateIndex
CREATE INDEX "cctv_job_cards_customerId_idx" ON "cctv_job_cards"("customerId");

-- CreateIndex
CREATE INDEX "cctv_job_cards_serialItemId_idx" ON "cctv_job_cards"("serialItemId");

-- CreateIndex
CREATE INDEX "cctv_job_cards_assignedToId_idx" ON "cctv_job_cards"("assignedToId");

-- CreateIndex
CREATE INDEX "cctv_job_cards_customerPhone_idx" ON "cctv_job_cards"("customerPhone");

-- CreateIndex
CREATE INDEX "cctv_job_cards_receivedAt_idx" ON "cctv_job_cards"("receivedAt");

-- CreateIndex
CREATE INDEX "cctv_job_cards_priority_idx" ON "cctv_job_cards"("priority");

-- CreateIndex
CREATE INDEX "cctv_job_cards_vendorId_idx" ON "cctv_job_cards"("vendorId");

-- CreateIndex
CREATE UNIQUE INDEX "cctv_job_cards_businessId_jobCode_key" ON "cctv_job_cards"("businessId", "jobCode");

-- CreateIndex
CREATE INDEX "cctv_job_card_parts_businessId_idx" ON "cctv_job_card_parts"("businessId");

-- CreateIndex
CREATE INDEX "cctv_job_card_parts_jobCardId_idx" ON "cctv_job_card_parts"("jobCardId");

-- CreateIndex
CREATE INDEX "cctv_job_card_parts_serialItemId_idx" ON "cctv_job_card_parts"("serialItemId");

-- CreateIndex
CREATE UNIQUE INDEX "cctv_job_card_parts_jobCardId_serialItemId_key" ON "cctv_job_card_parts"("jobCardId", "serialItemId");

-- CreateIndex
CREATE INDEX "cctv_technicians_businessId_idx" ON "cctv_technicians"("businessId");

-- CreateIndex
CREATE INDEX "cctv_technicians_userId_idx" ON "cctv_technicians"("userId");

-- CreateIndex
CREATE INDEX "cctv_commission_rules_businessId_idx" ON "cctv_commission_rules"("businessId");

-- CreateIndex
CREATE INDEX "cctv_commission_records_businessId_idx" ON "cctv_commission_records"("businessId");

-- CreateIndex
CREATE INDEX "cctv_commission_records_technicianId_idx" ON "cctv_commission_records"("technicianId");

-- CreateIndex
CREATE INDEX "cctv_commission_records_month_idx" ON "cctv_commission_records"("month");

-- CreateIndex
CREATE INDEX "cctv_commission_records_createdAt_idx" ON "cctv_commission_records"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "cctv_commission_records_jobCardId_key" ON "cctv_commission_records"("jobCardId");

-- CreateIndex
CREATE INDEX "cctv_outsourced_vendors_businessId_idx" ON "cctv_outsourced_vendors"("businessId");

-- CreateIndex
CREATE INDEX "cctv_sales_businessId_idx" ON "cctv_sales"("businessId");

-- CreateIndex
CREATE INDEX "cctv_sales_status_idx" ON "cctv_sales"("status");

-- CreateIndex
CREATE UNIQUE INDEX "cctv_sales_businessId_saleCode_key" ON "cctv_sales"("businessId", "saleCode");

-- CreateIndex
CREATE INDEX "cctv_sale_items_businessId_idx" ON "cctv_sale_items"("businessId");

-- CreateIndex
CREATE INDEX "cctv_sale_items_saleId_idx" ON "cctv_sale_items"("saleId");

-- CreateIndex
CREATE INDEX "cctv_sale_items_kitId_idx" ON "cctv_sale_items"("kitId");

-- CreateIndex
CREATE INDEX "cctv_payments_businessId_idx" ON "cctv_payments"("businessId");

-- CreateIndex
CREATE INDEX "cctv_payments_saleId_idx" ON "cctv_payments"("saleId");

-- CreateIndex
CREATE INDEX "cctv_emi_plans_businessId_idx" ON "cctv_emi_plans"("businessId");

-- CreateIndex
CREATE INDEX "cctv_emi_plans_status_idx" ON "cctv_emi_plans"("status");

-- CreateIndex
CREATE INDEX "cctv_emi_plans_customerPhone_idx" ON "cctv_emi_plans"("customerPhone");

-- CreateIndex
CREATE UNIQUE INDEX "cctv_emi_plans_saleId_key" ON "cctv_emi_plans"("saleId");

-- CreateIndex
CREATE INDEX "cctv_emi_installments_businessId_idx" ON "cctv_emi_installments"("businessId");

-- CreateIndex
CREATE INDEX "cctv_emi_installments_emiPlanId_idx" ON "cctv_emi_installments"("emiPlanId");

-- CreateIndex
CREATE INDEX "cctv_emi_installments_status_idx" ON "cctv_emi_installments"("status");

-- CreateIndex
CREATE INDEX "cctv_emi_installments_dueDate_idx" ON "cctv_emi_installments"("dueDate");

-- CreateIndex
CREATE UNIQUE INDEX "cctv_emi_installments_emiPlanId_installmentNo_key" ON "cctv_emi_installments"("emiPlanId", "installmentNo");

-- CreateIndex
CREATE UNIQUE INDEX "cctv_loyalty_configs_businessId_key" ON "cctv_loyalty_configs"("businessId");

-- CreateIndex
CREATE INDEX "cctv_loyalty_configs_businessId_idx" ON "cctv_loyalty_configs"("businessId");

-- CreateIndex
CREATE INDEX "cctv_loyalty_transactions_businessId_idx" ON "cctv_loyalty_transactions"("businessId");

-- CreateIndex
CREATE INDEX "cctv_loyalty_transactions_customerId_idx" ON "cctv_loyalty_transactions"("customerId");

-- CreateIndex
CREATE INDEX "cctv_loyalty_transactions_type_idx" ON "cctv_loyalty_transactions"("type");

-- CreateIndex
CREATE INDEX "cctv_loyalty_offers_businessId_idx" ON "cctv_loyalty_offers"("businessId");

-- CreateIndex
CREATE INDEX "cctv_loyalty_offers_configId_idx" ON "cctv_loyalty_offers"("configId");

-- CreateIndex
CREATE INDEX "cctv_warranty_claims_businessId_idx" ON "cctv_warranty_claims"("businessId");

-- CreateIndex
CREATE INDEX "cctv_warranty_claims_serialItemId_idx" ON "cctv_warranty_claims"("serialItemId");

-- CreateIndex
CREATE INDEX "cctv_warranty_claims_status_idx" ON "cctv_warranty_claims"("status");

-- CreateIndex
CREATE INDEX "cctv_warranty_claims_customerPhone_idx" ON "cctv_warranty_claims"("customerPhone");

-- CreateIndex
CREATE UNIQUE INDEX "cctv_projects_saleId_key" ON "cctv_projects"("saleId");

-- CreateIndex
CREATE INDEX "cctv_projects_businessId_idx" ON "cctv_projects"("businessId");

-- CreateIndex
CREATE INDEX "cctv_projects_status_idx" ON "cctv_projects"("status");

-- CreateIndex
CREATE INDEX "cctv_projects_clientId_idx" ON "cctv_projects"("clientId");

-- CreateIndex
CREATE INDEX "cctv_projects_deadline_idx" ON "cctv_projects"("deadline");

-- CreateIndex
CREATE UNIQUE INDEX "cctv_projects_businessId_projectCode_key" ON "cctv_projects"("businessId", "projectCode");

-- CreateIndex
CREATE INDEX "cctv_site_surveys_businessId_idx" ON "cctv_site_surveys"("businessId");

-- CreateIndex
CREATE INDEX "cctv_site_surveys_projectId_idx" ON "cctv_site_surveys"("projectId");

-- CreateIndex
CREATE INDEX "cctv_camera_positions_businessId_idx" ON "cctv_camera_positions"("businessId");

-- CreateIndex
CREATE INDEX "cctv_camera_positions_surveyId_idx" ON "cctv_camera_positions"("surveyId");

-- CreateIndex
CREATE INDEX "cctv_cable_routes_businessId_idx" ON "cctv_cable_routes"("businessId");

-- CreateIndex
CREATE INDEX "cctv_cable_routes_surveyId_idx" ON "cctv_cable_routes"("surveyId");

-- CreateIndex
CREATE INDEX "cctv_amc_contracts_businessId_idx" ON "cctv_amc_contracts"("businessId");

-- CreateIndex
CREATE INDEX "cctv_amc_contracts_clientId_idx" ON "cctv_amc_contracts"("clientId");

-- CreateIndex
CREATE INDEX "cctv_amc_contracts_status_idx" ON "cctv_amc_contracts"("status");

-- CreateIndex
CREATE INDEX "cctv_amc_visits_businessId_idx" ON "cctv_amc_visits"("businessId");

-- CreateIndex
CREATE INDEX "cctv_amc_visits_contractId_idx" ON "cctv_amc_visits"("contractId");

-- CreateIndex
CREATE INDEX "cctv_installation_tasks_businessId_idx" ON "cctv_installation_tasks"("businessId");

-- CreateIndex
CREATE INDEX "cctv_installation_tasks_projectId_idx" ON "cctv_installation_tasks"("projectId");

-- CreateIndex
CREATE INDEX "cctv_installation_tasks_status_idx" ON "cctv_installation_tasks"("status");

-- CreateIndex
CREATE INDEX "cctv_installation_tasks_scheduledDate_idx" ON "cctv_installation_tasks"("scheduledDate");

-- CreateIndex
CREATE INDEX "cctv_installation_tasks_assignedToId_idx" ON "cctv_installation_tasks"("assignedToId");

-- CreateIndex
CREATE INDEX "cctv_task_checklists_businessId_idx" ON "cctv_task_checklists"("businessId");

-- CreateIndex
CREATE INDEX "cctv_task_checklists_taskId_idx" ON "cctv_task_checklists"("taskId");

-- CreateIndex
CREATE UNIQUE INDEX "cctv_nbr_configs_businessId_key" ON "cctv_nbr_configs"("businessId");

-- CreateIndex
CREATE INDEX "cctv_nbr_configs_businessId_idx" ON "cctv_nbr_configs"("businessId");

-- CreateIndex
CREATE INDEX "cctv_hs_code_mappings_businessId_idx" ON "cctv_hs_code_mappings"("businessId");

-- CreateIndex
CREATE INDEX "cctv_hs_code_mappings_configId_idx" ON "cctv_hs_code_mappings"("configId");

-- CreateIndex
CREATE UNIQUE INDEX "cctv_hs_code_mappings_configId_category_key" ON "cctv_hs_code_mappings"("configId", "category");

-- CreateIndex
CREATE INDEX "cctv_mushak_invoices_businessId_idx" ON "cctv_mushak_invoices"("businessId");

-- CreateIndex
CREATE INDEX "cctv_mushak_invoices_saleId_idx" ON "cctv_mushak_invoices"("saleId");

-- CreateIndex
CREATE INDEX "cctv_mushak_invoices_issueDate_idx" ON "cctv_mushak_invoices"("issueDate");

-- CreateIndex
CREATE UNIQUE INDEX "cctv_mushak_invoices_businessId_invoiceNumber_key" ON "cctv_mushak_invoices"("businessId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "cctv_mushak_line_items_businessId_idx" ON "cctv_mushak_line_items"("businessId");

-- CreateIndex
CREATE INDEX "cctv_mushak_line_items_invoiceId_idx" ON "cctv_mushak_line_items"("invoiceId");

-- CreateIndex
CREATE INDEX "cctv_vat_returns_businessId_idx" ON "cctv_vat_returns"("businessId");

-- CreateIndex
CREATE INDEX "cctv_vat_returns_taxYear_taxMonth_idx" ON "cctv_vat_returns"("taxYear", "taxMonth");

-- CreateIndex
CREATE UNIQUE INDEX "cctv_vat_returns_businessId_taxYear_taxMonth_key" ON "cctv_vat_returns"("businessId", "taxYear", "taxMonth");

-- CreateIndex
CREATE INDEX "cctv_purchases_businessId_idx" ON "cctv_purchases"("businessId");

-- CreateIndex
CREATE INDEX "cctv_purchases_supplierId_idx" ON "cctv_purchases"("supplierId");

-- CreateIndex
CREATE INDEX "cctv_purchases_status_idx" ON "cctv_purchases"("status");

-- CreateIndex
CREATE INDEX "cctv_purchases_createdAt_idx" ON "cctv_purchases"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "cctv_purchases_businessId_purchaseNo_key" ON "cctv_purchases"("businessId", "purchaseNo");

-- CreateIndex
CREATE INDEX "cctv_purchase_items_purchaseId_idx" ON "cctv_purchase_items"("purchaseId");

-- CreateIndex
CREATE INDEX "cctv_purchase_items_productId_idx" ON "cctv_purchase_items"("productId");

-- CreateIndex
CREATE INDEX "cctv_purchase_items_businessId_idx" ON "cctv_purchase_items"("businessId");

-- CreateIndex
CREATE INDEX "purchase_order_serial_numbers_purchaseOrderItemId_idx" ON "purchase_order_serial_numbers"("purchaseOrderItemId");

-- CreateIndex
CREATE INDEX "purchase_order_serial_numbers_serialNumber_idx" ON "purchase_order_serial_numbers"("serialNumber");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_order_serial_numbers_purchaseOrderItemId_serialNum_key" ON "purchase_order_serial_numbers"("purchaseOrderItemId", "serialNumber");

-- CreateIndex
CREATE INDEX "cctv_returns_businessId_idx" ON "cctv_returns"("businessId");

-- CreateIndex
CREATE INDEX "cctv_returns_saleId_idx" ON "cctv_returns"("saleId");

-- CreateIndex
CREATE UNIQUE INDEX "cctv_returns_businessId_returnCode_key" ON "cctv_returns"("businessId", "returnCode");

-- CreateIndex
CREATE INDEX "cctv_return_items_returnId_idx" ON "cctv_return_items"("returnId");

-- CreateIndex
CREATE INDEX "cctv_return_items_saleItemId_idx" ON "cctv_return_items"("saleItemId");

-- CreateIndex
CREATE INDEX "cctv_return_items_businessId_idx" ON "cctv_return_items"("businessId");

-- CreateIndex
CREATE INDEX "cctv_expenses_businessId_idx" ON "cctv_expenses"("businessId");

-- CreateIndex
CREATE INDEX "cctv_expenses_businessId_date_idx" ON "cctv_expenses"("businessId", "date");

-- CreateIndex
CREATE INDEX "cctv_expenses_businessId_category_idx" ON "cctv_expenses"("businessId", "category");

-- AddForeignKey
ALTER TABLE "TrustedDevice" ADD CONSTRAINT "TrustedDevice_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PhoneAuthToken" ADD CONSTRAINT "PhoneAuthToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Business" ADD CONSTRAINT "Business_businessTypeId_fkey" FOREIGN KEY ("businessTypeId") REFERENCES "BusinessType"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessUser" ADD CONSTRAINT "BusinessUser_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_businessUserId_fkey" FOREIGN KEY ("businessUserId") REFERENCES "BusinessUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AlertPreference" ADD CONSTRAINT "AlertPreference_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationLog" ADD CONSTRAINT "NotificationLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_stockCountDayId_fkey" FOREIGN KEY ("stockCountDayId") REFERENCES "stock_count_days"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleItem" ADD CONSTRAINT "SaleItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Return" ADD CONSTRAINT "Return_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Return" ADD CONSTRAINT "Return_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Return" ADD CONSTRAINT "Return_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "Return"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "SaleItem"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReturnItem" ADD CONSTRAINT "ReturnItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DiscountRule" ADD CONSTRAINT "DiscountRule_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Purchase" ADD CONSTRAINT "Purchase_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "Purchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIUsageLog" ADD CONSTRAINT "AIUsageLog_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SuperAdminSession" ADD CONSTRAINT "SuperAdminSession_superAdminId_fkey" FOREIGN KEY ("superAdminId") REFERENCES "SuperAdmin"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BusinessDailyStats" ADD CONSTRAINT "BusinessDailyStats_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AIResponseCache" ADD CONSTRAINT "AIResponseCache_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FefoOverride" ADD CONSTRAINT "FefoOverride_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "holiday_calendar" ADD CONSTRAINT "holiday_calendar_occasionId_fkey" FOREIGN KEY ("occasionId") REFERENCES "report_occasions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "report_schedules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_reports" ADD CONSTRAINT "generated_reports_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "report_deliveries" ADD CONSTRAINT "report_deliveries_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "generated_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_invoices" ADD CONSTRAINT "subscription_invoices_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_transactions" ADD CONSTRAINT "payment_transactions_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "subscription_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_adjustments" ADD CONSTRAINT "subscription_adjustments_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "master_products" ADD CONSTRAINT "master_products_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "master_manufacturers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shelf_scans" ADD CONSTRAINT "shelf_scans_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shelf_scans" ADD CONSTRAINT "shelf_scans_stockCountZoneSessionId_fkey" FOREIGN KEY ("stockCountZoneSessionId") REFERENCES "stock_count_zone_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shelf_scan_items" ADD CONSTRAINT "shelf_scan_items_shelfScanId_fkey" FOREIGN KEY ("shelfScanId") REFERENCES "shelf_scans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shelf_scan_items" ADD CONSTRAINT "shelf_scan_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "shelf_scan_items" ADD CONSTRAINT "shelf_scan_items_masterProductId_fkey" FOREIGN KEY ("masterProductId") REFERENCES "master_products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "storage_zones" ADD CONSTRAINT "storage_zones_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_zone_assignments" ADD CONSTRAINT "product_zone_assignments_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_zone_assignments" ADD CONSTRAINT "product_zone_assignments_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_zone_assignments" ADD CONSTRAINT "product_zone_assignments_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "storage_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_days" ADD CONSTRAINT "stock_count_days_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_zone_sessions" ADD CONSTRAINT "stock_count_zone_sessions_scdId_fkey" FOREIGN KEY ("scdId") REFERENCES "stock_count_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_zone_sessions" ADD CONSTRAINT "stock_count_zone_sessions_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "storage_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_product_summaries" ADD CONSTRAINT "stock_count_product_summaries_scdId_fkey" FOREIGN KEY ("scdId") REFERENCES "stock_count_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_product_summaries" ADD CONSTRAINT "stock_count_product_summaries_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_scdId_fkey" FOREIGN KEY ("scdId") REFERENCES "stock_count_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_zoneSessionId_fkey" FOREIGN KEY ("zoneSessionId") REFERENCES "stock_count_zone_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "storage_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_count_lines" ADD CONSTRAINT "stock_count_lines_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone_assignment_snapshots" ADD CONSTRAINT "zone_assignment_snapshots_scdId_fkey" FOREIGN KEY ("scdId") REFERENCES "stock_count_days"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone_assignment_snapshots" ADD CONSTRAINT "zone_assignment_snapshots_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone_assignment_snapshots" ADD CONSTRAINT "zone_assignment_snapshots_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zone_assignment_snapshots" ADD CONSTRAINT "zone_assignment_snapshots_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "storage_zones"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_categories" ADD CONSTRAINT "cctv_categories_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_products" ADD CONSTRAINT "cctv_products_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_products" ADD CONSTRAINT "cctv_products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "cctv_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_serial_items" ADD CONSTRAINT "cctv_serial_items_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_serial_items" ADD CONSTRAINT "cctv_serial_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "cctv_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_serial_items" ADD CONSTRAINT "cctv_serial_items_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "cctv_branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_serial_item_history" ADD CONSTRAINT "cctv_serial_item_history_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_serial_item_history" ADD CONSTRAINT "cctv_serial_item_history_serialItemId_fkey" FOREIGN KEY ("serialItemId") REFERENCES "cctv_serial_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_kit_definitions" ADD CONSTRAINT "cctv_kit_definitions_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_kit_components" ADD CONSTRAINT "cctv_kit_components_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "cctv_kit_definitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_kit_components" ADD CONSTRAINT "cctv_kit_components_productId_fkey" FOREIGN KEY ("productId") REFERENCES "cctv_products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_branches" ADD CONSTRAINT "cctv_branches_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_transfers" ADD CONSTRAINT "cctv_transfers_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_transfers" ADD CONSTRAINT "cctv_transfers_fromBranchId_fkey" FOREIGN KEY ("fromBranchId") REFERENCES "cctv_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_transfers" ADD CONSTRAINT "cctv_transfers_toBranchId_fkey" FOREIGN KEY ("toBranchId") REFERENCES "cctv_branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_transfer_items" ADD CONSTRAINT "cctv_transfer_items_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "cctv_transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_transfer_items" ADD CONSTRAINT "cctv_transfer_items_serialItemId_fkey" FOREIGN KEY ("serialItemId") REFERENCES "cctv_serial_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_job_cards" ADD CONSTRAINT "cctv_job_cards_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_job_cards" ADD CONSTRAINT "cctv_job_cards_serialItemId_fkey" FOREIGN KEY ("serialItemId") REFERENCES "cctv_serial_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_job_cards" ADD CONSTRAINT "cctv_job_cards_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "cctv_outsourced_vendors"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_job_card_parts" ADD CONSTRAINT "cctv_job_card_parts_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_job_card_parts" ADD CONSTRAINT "cctv_job_card_parts_jobCardId_fkey" FOREIGN KEY ("jobCardId") REFERENCES "cctv_job_cards"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_job_card_parts" ADD CONSTRAINT "cctv_job_card_parts_serialItemId_fkey" FOREIGN KEY ("serialItemId") REFERENCES "cctv_serial_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_technicians" ADD CONSTRAINT "cctv_technicians_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_commission_rules" ADD CONSTRAINT "cctv_commission_rules_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_commission_records" ADD CONSTRAINT "cctv_commission_records_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_commission_records" ADD CONSTRAINT "cctv_commission_records_technicianId_fkey" FOREIGN KEY ("technicianId") REFERENCES "cctv_technicians"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_commission_records" ADD CONSTRAINT "cctv_commission_records_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "cctv_commission_rules"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_commission_records" ADD CONSTRAINT "cctv_commission_records_jobCardId_fkey" FOREIGN KEY ("jobCardId") REFERENCES "cctv_job_cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_outsourced_vendors" ADD CONSTRAINT "cctv_outsourced_vendors_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_sales" ADD CONSTRAINT "cctv_sales_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_sale_items" ADD CONSTRAINT "cctv_sale_items_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_sale_items" ADD CONSTRAINT "cctv_sale_items_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "cctv_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_sale_items" ADD CONSTRAINT "cctv_sale_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "cctv_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_sale_items" ADD CONSTRAINT "cctv_sale_items_serialItemId_fkey" FOREIGN KEY ("serialItemId") REFERENCES "cctv_serial_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_sale_items" ADD CONSTRAINT "cctv_sale_items_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "cctv_kit_definitions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_payments" ADD CONSTRAINT "cctv_payments_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_payments" ADD CONSTRAINT "cctv_payments_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "cctv_sales"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_emi_plans" ADD CONSTRAINT "cctv_emi_plans_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_emi_plans" ADD CONSTRAINT "cctv_emi_plans_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "cctv_sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_emi_installments" ADD CONSTRAINT "cctv_emi_installments_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_emi_installments" ADD CONSTRAINT "cctv_emi_installments_emiPlanId_fkey" FOREIGN KEY ("emiPlanId") REFERENCES "cctv_emi_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_loyalty_configs" ADD CONSTRAINT "cctv_loyalty_configs_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_loyalty_transactions" ADD CONSTRAINT "cctv_loyalty_transactions_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_loyalty_offers" ADD CONSTRAINT "cctv_loyalty_offers_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_loyalty_offers" ADD CONSTRAINT "cctv_loyalty_offers_configId_fkey" FOREIGN KEY ("configId") REFERENCES "cctv_loyalty_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_warranty_claims" ADD CONSTRAINT "cctv_warranty_claims_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_warranty_claims" ADD CONSTRAINT "cctv_warranty_claims_serialItemId_fkey" FOREIGN KEY ("serialItemId") REFERENCES "cctv_serial_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_projects" ADD CONSTRAINT "cctv_projects_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_projects" ADD CONSTRAINT "cctv_projects_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "cctv_sales"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_site_surveys" ADD CONSTRAINT "cctv_site_surveys_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_site_surveys" ADD CONSTRAINT "cctv_site_surveys_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "cctv_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_camera_positions" ADD CONSTRAINT "cctv_camera_positions_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_camera_positions" ADD CONSTRAINT "cctv_camera_positions_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "cctv_site_surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_cable_routes" ADD CONSTRAINT "cctv_cable_routes_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_cable_routes" ADD CONSTRAINT "cctv_cable_routes_surveyId_fkey" FOREIGN KEY ("surveyId") REFERENCES "cctv_site_surveys"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_amc_contracts" ADD CONSTRAINT "cctv_amc_contracts_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_amc_visits" ADD CONSTRAINT "cctv_amc_visits_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "cctv_amc_contracts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_installation_tasks" ADD CONSTRAINT "cctv_installation_tasks_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_installation_tasks" ADD CONSTRAINT "cctv_installation_tasks_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "cctv_projects"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_task_checklists" ADD CONSTRAINT "cctv_task_checklists_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_task_checklists" ADD CONSTRAINT "cctv_task_checklists_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "cctv_installation_tasks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_nbr_configs" ADD CONSTRAINT "cctv_nbr_configs_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_hs_code_mappings" ADD CONSTRAINT "cctv_hs_code_mappings_configId_fkey" FOREIGN KEY ("configId") REFERENCES "cctv_nbr_configs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_mushak_invoices" ADD CONSTRAINT "cctv_mushak_invoices_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_mushak_invoices" ADD CONSTRAINT "cctv_mushak_invoices_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "cctv_sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_mushak_line_items" ADD CONSTRAINT "cctv_mushak_line_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "cctv_mushak_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_vat_returns" ADD CONSTRAINT "cctv_vat_returns_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_purchases" ADD CONSTRAINT "cctv_purchases_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_purchases" ADD CONSTRAINT "cctv_purchases_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_purchase_items" ADD CONSTRAINT "cctv_purchase_items_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "cctv_purchases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_purchase_items" ADD CONSTRAINT "cctv_purchase_items_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_purchase_items" ADD CONSTRAINT "cctv_purchase_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "cctv_products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_serial_numbers" ADD CONSTRAINT "purchase_order_serial_numbers_purchaseOrderItemId_fkey" FOREIGN KEY ("purchaseOrderItemId") REFERENCES "cctv_purchase_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_returns" ADD CONSTRAINT "cctv_returns_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_returns" ADD CONSTRAINT "cctv_returns_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "cctv_sales"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_return_items" ADD CONSTRAINT "cctv_return_items_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "cctv_returns"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_return_items" ADD CONSTRAINT "cctv_return_items_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_return_items" ADD CONSTRAINT "cctv_return_items_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "cctv_sale_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cctv_expenses" ADD CONSTRAINT "cctv_expenses_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

