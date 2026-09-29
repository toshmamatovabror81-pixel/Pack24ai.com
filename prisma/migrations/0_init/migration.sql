-- Boshlang'ich migratsiya: bo'sh bazada barcha jadvallarni yaratadi.
-- prisma migrate diff --from-empty --to-schema-datamodel prisma/schema.prisma --script
-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "OrderStatus" AS ENUM ('draft', 'new', 'processing', 'shipping', 'delivered', 'cancelled');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'processing', 'paid', 'failed', 'refunded');

-- CreateEnum
CREATE TYPE "ProductStatus" AS ENUM ('active', 'draft', 'archived');

-- CreateEnum
CREATE TYPE "RecycleRequestStatus" AS ENUM ('new', 'dispatched', 'assigned', 'en_route', 'arrived', 'collecting', 'collected', 'confirmed', 'completed', 'cancelled', 'disputed');

-- CreateEnum
CREATE TYPE "DriverStatus" AS ENUM ('active', 'inactive', 'on_route', 'busy');

-- CreateEnum
CREATE TYPE "RecyclePaymentStatus" AS ENUM ('pending', 'paid_to_driver', 'paid_to_customer', 'paid_both', 'completed');

-- CreateEnum
CREATE TYPE "WorkOrderStatus" AS ENUM ('planned', 'in_progress', 'completed', 'paused', 'cancelled');

-- CreateEnum
CREATE TYPE "WorkOrderStageStatus" AS ENUM ('pending', 'in_progress', 'completed');

-- CreateEnum
CREATE TYPE "RecyclePointStatus" AS ENUM ('active', 'planned');

-- CreateEnum
CREATE TYPE "CampaignStatus" AS ENUM ('draft', 'scheduled', 'sent');

-- CreateEnum
CREATE TYPE "BotAccessStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('pending', 'in_progress', 'review', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "TaskPriority" AS ENUM ('low', 'normal', 'high', 'urgent');

-- CreateEnum
CREATE TYPE "TaskAssigneeRole" AS ENUM ('assignee', 'reviewer', 'observer');

-- CreateEnum
CREATE TYPE "TaskAssigneeStatus" AS ENUM ('assigned', 'in_progress', 'completed', 'declined');

-- CreateEnum
CREATE TYPE "ComplaintStatus" AS ENUM ('open', 'in_progress', 'resolved', 'closed');

-- CreateEnum
CREATE TYPE "ComplaintLevel" AS ENUM ('supervisor', 'director');

-- CreateEnum
CREATE TYPE "NotificationStatus" AS ENUM ('sent', 'delivered', 'read', 'accepted', 'failed', 'escalated');

-- CreateEnum
CREATE TYPE "ContractStatus" AS ENUM ('active', 'suspended', 'closed');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('issued', 'paid', 'partial', 'overdue', 'cancelled');

-- CreateEnum
CREATE TYPE "BotEventStatus" AS ENUM ('new', 'processed');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('user', 'staff', 'manager', 'admin');

-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('individual', 'corporate', 'wholesale', 'dealer');

-- CreateEnum
CREATE TYPE "CustomerGroup" AS ENUM ('standard', 'vip', 'new', 'inactive', 'blocked');

-- CreateEnum
CREATE TYPE "CampaignType" AS ENUM ('telegram', 'sms', 'email');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('IN', 'OUT', 'TRANSFER');

-- CreateEnum
CREATE TYPE "DriverTransactionType" AS ENUM ('earning', 'withdrawal', 'bonus');

-- CreateEnum
CREATE TYPE "DriverTransactionStatus" AS ENUM ('pending', 'completed', 'failed');

-- CreateEnum
CREATE TYPE "CardType" AS ENUM ('uzcard', 'humo', 'visa', 'mastercard', 'other');

-- CreateEnum
CREATE TYPE "EcoLevel" AS ENUM ('seed', 'sprout', 'sapling', 'tree', 'forest', 'guardian', 'legend');

-- CreateEnum
CREATE TYPE "PickupType" AS ENUM ('base', 'pickup');

-- CreateEnum
CREATE TYPE "VolumeSize" AS ENUM ('small', 'medium', 'large');

-- CreateEnum
CREATE TYPE "AssignmentType" AS ENUM ('individual', 'group');

-- CreateEnum
CREATE TYPE "TaskDepartment" AS ENUM ('warehouse', 'logistics', 'production', 'household', 'general');

-- CreateEnum
CREATE TYPE "NotificationChannel" AS ENUM ('telegram', 'sms', 'call');

-- CreateEnum
CREATE TYPE "BotEventSource" AS ENUM ('customer', 'driver', 'supervisor', 'pack24admin', 'platform', 'system');

-- CreateEnum
CREATE TYPE "EventSeverity" AS ENUM ('info', 'success', 'warning', 'error');

-- CreateEnum
CREATE TYPE "PushPlatform" AS ENUM ('web', 'ios', 'android');

-- CreateEnum
CREATE TYPE "AppType" AS ENUM ('web', 'customer', 'driver');

-- CreateEnum
CREATE TYPE "ProductionStage" AS ENUM ('gofra', 'pechat', 'yiguv', 'qc');

-- CreateEnum
CREATE TYPE "CorrectionEntityType" AS ENUM ('manual_intake', 'press_log', 'expense_log', 'daily_cash', 'sales_log');

-- CreateEnum
CREATE TYPE "DeliveryMethod" AS ENUM ('courier', 'pickup');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('cash', 'click', 'payme', 'bank_transfer');

-- CreateEnum
CREATE TYPE "BadgeKey" AS ENUM ('first_step', '10kg_club', '50kg_hero', '100kg_warrior', 'streak_7', 'streak_30', 'multi_material', 'referral_first', 'tree_saver', 'co2_warrior', 'early_bird', 'eco_legend');

-- CreateEnum
CREATE TYPE "PickupLocationMode" AS ENUM ('gps', 'map', 'text');

-- CreateEnum
CREATE TYPE "CustomerLang" AS ENUM ('uz', 'ru', 'en');

-- CreateEnum
CREATE TYPE "MaterialType" AS ENUM ('qogoz', 'karton', 'gazeta', 'jurnal', 'ofis', 'kitob', 'aralash', 'sellofan', 'plastik');

-- CreateEnum
CREATE TYPE "MediaType" AS ENUM ('image', 'video');

-- CreateEnum
CREATE TYPE "BotAccessRole" AS ENUM ('driver', 'supervisor');

-- CreateEnum
CREATE TYPE "PerformanceKind" AS ENUM ('quality', 'speed', 'discipline', 'initiative', 'penalty');

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'user',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "department" TEXT,
    "position" TEXT,
    "telegramNotify" BOOLEAN NOT NULL DEFAULT true,
    "smsNotify" BOOLEAN NOT NULL DEFAULT true,
    "telegramId" TEXT,
    "telegramCode" TEXT,
    "telegramVerifiedAt" TIMESTAMP(3),
    "otpCode" TEXT,
    "otpExpiry" TIMESTAMP(3),
    "otpAttempts" INTEGER NOT NULL DEFAULT 0,
    "customerType" "CustomerType" NOT NULL DEFAULT 'individual',
    "customerGroup" "CustomerGroup" NOT NULL DEFAULT 'standard',
    "companyName" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "ecoPoints" INTEGER NOT NULL DEFAULT 0,
    "totalRecycledWeight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ecoLevel" "EcoLevel" NOT NULL DEFAULT 'seed',
    "ecoStreak" INTEGER NOT NULL DEFAULT 0,
    "lastEcoActivity" TIMESTAMP(3),
    "totalCO2Saved" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "treesEquivalent" INTEGER NOT NULL DEFAULT 0,
    "referralCode" TEXT,
    "referredById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PushSubscription" (
    "id" SERIAL NOT NULL,
    "endpoint" TEXT,
    "p256dh" TEXT,
    "auth" TEXT,
    "token" TEXT,
    "userId" INTEGER,
    "driverId" INTEGER,
    "platform" "PushPlatform" NOT NULL DEFAULT 'web',
    "appType" "AppType" NOT NULL DEFAULT 'web',
    "userAgent" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PushSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campaign" (
    "id" SERIAL NOT NULL,
    "type" "CampaignType" NOT NULL,
    "content" TEXT NOT NULL,
    "audience" TEXT NOT NULL,
    "status" "CampaignStatus" NOT NULL,
    "sentAt" TIMESTAMP(3),
    "receivers" INTEGER NOT NULL DEFAULT 0,
    "views" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramConfig" (
    "id" SERIAL NOT NULL,
    "botToken" TEXT NOT NULL DEFAULT '',
    "botUsername" TEXT NOT NULL DEFAULT '',
    "welcomeMessage" TEXT NOT NULL DEFAULT 'Assalomu alaykum! Xush kelibsiz.',
    "mainButton" TEXT NOT NULL DEFAULT 'Katalog',
    "isActive" BOOLEAN NOT NULL DEFAULT false,
    "salesChatId" TEXT NOT NULL DEFAULT '',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramHqAdmin" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "telegramId" TEXT,
    "telegramName" TEXT,
    "registrationCode" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "registeredAt" TIMESTAMP(3),
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramHqAdmin_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotAccessRequest" (
    "id" SERIAL NOT NULL,
    "role" "BotAccessRole" NOT NULL,
    "status" "BotAccessStatus" NOT NULL DEFAULT 'pending',
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "telegramId" TEXT,
    "telegramName" TEXT,
    "vehicleInfo" TEXT,
    "requestedPointId" INTEGER,
    "requestedSupervisorId" INTEGER,
    "approvedByHqAdminId" INTEGER,
    "approvedBySupervisorId" INTEGER,
    "approvedAt" TIMESTAMP(3),
    "rejectedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "createdSupervisorId" INTEGER,
    "createdDriverId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotAccessRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BotEvent" (
    "id" SERIAL NOT NULL,
    "sourceBot" "BotEventSource" NOT NULL,
    "eventType" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" INTEGER,
    "severity" "EventSeverity" NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" "BotEventStatus" NOT NULL DEFAULT 'new',
    "dedupeKey" TEXT,
    "payload" JSONB,
    "requestId" INTEGER,
    "collectionId" INTEGER,
    "supervisorId" INTEGER,
    "driverId" INTEGER,
    "pointId" INTEGER,
    "userId" INTEGER,
    "processedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "nameI18n" JSONB NOT NULL DEFAULT '{}',
    "descriptionI18n" JSONB NOT NULL DEFAULT '{}',
    "price" DECIMAL(18,2) NOT NULL,
    "originalPrice" DECIMAL(18,2),
    "sku" TEXT,
    "category" TEXT,
    "categoryId" INTEGER,
    "image" TEXT NOT NULL,
    "gallery" JSONB NOT NULL DEFAULT '[]',
    "videoUrl" TEXT,
    "specifications" JSONB NOT NULL DEFAULT '{}',
    "tags" JSONB NOT NULL DEFAULT '[]',
    "minQuantity" INTEGER NOT NULL DEFAULT 1,
    "inStock" BOOLEAN NOT NULL DEFAULT true,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviews" INTEGER NOT NULL DEFAULT 0,
    "status" "ProductStatus" NOT NULL DEFAULT 'active',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "sourceUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "image" TEXT,
    "parentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Order" (
    "id" SERIAL NOT NULL,
    "telegramUserId" TEXT,
    "customerName" TEXT,
    "contactPhone" TEXT,
    "userId" INTEGER,
    "status" "OrderStatus" NOT NULL DEFAULT 'draft',
    "totalAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "shippingAddress" TEXT,
    "shippingLocation" TEXT,
    "comment" TEXT,
    "deliveryMethod" "DeliveryMethod",
    "paymentMethod" "PaymentMethod",
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "confirmedAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Order_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "price" DECIMAL(18,2) NOT NULL,

    CONSTRAINT "OrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PaymeTransaction" (
    "id" TEXT NOT NULL,
    "orderId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "state" INTEGER NOT NULL DEFAULT 1,
    "createTime" BIGINT NOT NULL,
    "performTime" BIGINT,
    "cancelTime" BIGINT,
    "reason" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymeTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "isMain" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER NOT NULL,
    "warehouseId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockMovement" (
    "id" SERIAL NOT NULL,
    "type" "StockMovementType" NOT NULL,
    "productId" INTEGER NOT NULL,
    "fromWarehouseId" INTEGER,
    "toWarehouseId" INTEGER,
    "quantity" INTEGER NOT NULL,
    "reason" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrder" (
    "id" SERIAL NOT NULL,
    "orderNo" TEXT NOT NULL,
    "clientName" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL,
    "deadline" TIMESTAMP(3) NOT NULL,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'planned',
    "priority" "TaskPriority" NOT NULL DEFAULT 'normal',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "currentStage" "ProductionStage" NOT NULL DEFAULT 'gofra',
    "size" TEXT,
    "sheetLength" DOUBLE PRECISION,
    "sheetWidth" DOUBLE PRECISION,
    "areaPerPiece" DOUBLE PRECISION,
    "totalArea" DOUBLE PRECISION,
    "layerCount" INTEGER,
    "layer1" TEXT,
    "layer2" TEXT,
    "layer3" TEXT,
    "layer4" TEXT,
    "layer5" TEXT,
    "printType" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkOrderStage" (
    "id" SERIAL NOT NULL,
    "workOrderId" INTEGER NOT NULL,
    "stage" "ProductionStage" NOT NULL,
    "status" "WorkOrderStageStatus" NOT NULL DEFAULT 'pending',
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "operator" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkOrderStage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "News" (
    "id" SERIAL NOT NULL,
    "titleUz" TEXT NOT NULL,
    "titleRu" TEXT NOT NULL,
    "descUz" TEXT NOT NULL DEFAULT '',
    "descRu" TEXT NOT NULL DEFAULT '',
    "emoji" TEXT NOT NULL DEFAULT '📰',
    "badge" TEXT NOT NULL DEFAULT 'Новость',
    "publishedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "News_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecyclePoint" (
    "id" SERIAL NOT NULL,
    "regionUz" TEXT NOT NULL,
    "regionRu" TEXT NOT NULL,
    "cityUz" TEXT NOT NULL,
    "cityRu" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "pricePerKg" DECIMAL(18,2) NOT NULL DEFAULT 800,
    "driverRatePerKg" DECIMAL(18,2) NOT NULL DEFAULT 100,
    "status" "RecyclePointStatus" NOT NULL DEFAULT 'active',
    "color" TEXT NOT NULL DEFAULT 'bg-emerald-500',
    "workingHours" TEXT NOT NULL DEFAULT '08:00-18:00',
    "isAccepting" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecyclePoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supervisor" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "telegramId" TEXT,
    "telegramName" TEXT,
    "pointId" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "registrationCode" TEXT,
    "registeredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supervisor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JournalCorrectionRequest" (
    "id" SERIAL NOT NULL,
    "status" "BotAccessStatus" NOT NULL DEFAULT 'pending',
    "entityType" "CorrectionEntityType" NOT NULL,
    "entityId" INTEGER NOT NULL,
    "supervisorId" INTEGER NOT NULL,
    "pointId" INTEGER,
    "previousPayload" JSONB NOT NULL,
    "proposedPayload" JSONB NOT NULL,
    "summaryLine" TEXT NOT NULL,
    "reviewedByHqAdminId" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "rejectReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalCorrectionRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Driver" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "passwordHash" TEXT,
    "telegramId" TEXT,
    "telegramName" TEXT,
    "supervisorId" INTEGER,
    "pointId" INTEGER,
    "status" "DriverStatus" NOT NULL DEFAULT 'active',
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "vehicleInfo" TEXT,
    "lastSeenAt" TIMESTAMP(3),
    "lastLat" DOUBLE PRECISION,
    "lastLng" DOUBLE PRECISION,
    "acceptedMaterials" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "registrationCode" TEXT,
    "registeredAt" TIMESTAMP(3),
    "invitedBySupervisorId" INTEGER,
    "invitedByPointId" INTEGER,
    "invitedAt" TIMESTAMP(3),
    "passwordSetByBotAt" TIMESTAMP(3),
    "resetOtpCode" TEXT,
    "resetOtpExpiry" TIMESTAMP(3),
    "resetOtpAttempts" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Driver_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverCard" (
    "id" SERIAL NOT NULL,
    "driverId" INTEGER NOT NULL,
    "cardNumber" TEXT NOT NULL,
    "cardHolder" TEXT NOT NULL,
    "expiryMonth" INTEGER NOT NULL,
    "expiryYear" INTEGER NOT NULL,
    "cardType" "CardType" NOT NULL DEFAULT 'uzcard',
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DriverTransaction" (
    "id" SERIAL NOT NULL,
    "driverId" INTEGER NOT NULL,
    "type" "DriverTransactionType" NOT NULL,
    "amount" DECIMAL(18,2) NOT NULL,
    "description" TEXT,
    "status" "DriverTransactionStatus" NOT NULL DEFAULT 'completed',
    "cardId" INTEGER,
    "collectionId" INTEGER,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DriverTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecycleRequest" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "regionId" INTEGER NOT NULL,
    "material" "MaterialType",
    "volume" INTEGER,
    "volumeSize" "VolumeSize",
    "photoUrl" TEXT,
    "pickupType" "PickupType" NOT NULL DEFAULT 'base',
    "pickupLocationMode" "PickupLocationMode",
    "address" TEXT,
    "pickupLat" DOUBLE PRECISION,
    "pickupLng" DOUBLE PRECISION,
    "customerTgId" TEXT,
    "customerLang" "CustomerLang" NOT NULL DEFAULT 'uz',
    "userId" INTEGER,
    "status" "RecycleRequestStatus" NOT NULL DEFAULT 'new',
    "supervisorId" INTEGER,
    "dispatchedAt" TIMESTAMP(3),
    "assignedDriverId" INTEGER,
    "assignedAt" TIMESTAMP(3),
    "driverEnRouteAt" TIMESTAMP(3),
    "driverArrivedAt" TIMESTAMP(3),
    "collectedAt" TIMESTAMP(3),
    "confirmedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "completedNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecycleRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecycleCollection" (
    "id" SERIAL NOT NULL,
    "requestId" INTEGER NOT NULL,
    "driverId" INTEGER NOT NULL,
    "actualWeight" DOUBLE PRECISION NOT NULL,
    "discountPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "effectiveWeight" DOUBLE PRECISION NOT NULL,
    "pricePerKg" DECIMAL(18,2) NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "discountReason" TEXT,
    "materialType" "MaterialType",
    "notes" TEXT,
    "customerConfirmed" BOOLEAN,
    "customerComment" TEXT,
    "deliveredToPoint" BOOLEAN NOT NULL DEFAULT false,
    "deliveredAt" TIMESTAMP(3),
    "paymentStatus" "RecyclePaymentStatus" NOT NULL DEFAULT 'pending',
    "paymentToDriver" DECIMAL(18,2),
    "paymentToCustomer" DECIMAL(18,2),
    "paymentNote" TEXT,
    "paidAt" TIMESTAMP(3),
    "paidBy" TEXT,
    "collectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecycleCollection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecycleManualIntake" (
    "id" SERIAL NOT NULL,
    "supervisorId" INTEGER NOT NULL,
    "pointId" INTEGER,
    "date" TIMESTAMP(3) NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "pricePerKg" DECIMAL(18,2) NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecycleManualIntake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecyclePressLog" (
    "id" SERIAL NOT NULL,
    "supervisorId" INTEGER NOT NULL,
    "pointId" INTEGER,
    "date" TIMESTAMP(3) NOT NULL,
    "pressedKg" DOUBLE PRECISION NOT NULL,
    "baleCount" INTEGER NOT NULL,
    "operators" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecyclePressLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecycleExpenseLog" (
    "id" SERIAL NOT NULL,
    "supervisorId" INTEGER NOT NULL,
    "pointId" INTEGER,
    "date" TIMESTAMP(3) NOT NULL,
    "expenseAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "advanceAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecycleExpenseLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecycleDailyCash" (
    "id" SERIAL NOT NULL,
    "supervisorId" INTEGER NOT NULL,
    "pointId" INTEGER,
    "date" TIMESTAMP(3) NOT NULL,
    "openingBalance" DECIMAL(18,2) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecycleDailyCash_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecycleSalesLog" (
    "id" SERIAL NOT NULL,
    "supervisorId" INTEGER NOT NULL,
    "pointId" INTEGER,
    "date" TIMESTAMP(3) NOT NULL,
    "customerName" TEXT NOT NULL,
    "weightKg" DOUBLE PRECISION NOT NULL,
    "baleCount" INTEGER NOT NULL DEFAULT 0,
    "pricePerKg" DECIMAL(18,2) NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "vehicleType" TEXT,
    "plateNumber" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecycleSalesLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecycleComplaint" (
    "id" SERIAL NOT NULL,
    "requestId" INTEGER NOT NULL,
    "fromPhone" TEXT NOT NULL,
    "fromName" TEXT NOT NULL,
    "level" "ComplaintLevel" NOT NULL DEFAULT 'supervisor',
    "message" TEXT NOT NULL,
    "status" "ComplaintStatus" NOT NULL DEFAULT 'open',
    "response" TEXT,
    "respondedBy" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RecycleComplaint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EcoAchievement" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "badgeKey" "BadgeKey" NOT NULL,
    "earnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EcoAchievement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" SERIAL NOT NULL,
    "publicCode" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "department" "TaskDepartment" NOT NULL DEFAULT 'general',
    "assignmentType" "AssignmentType" NOT NULL DEFAULT 'individual',
    "status" "TaskStatus" NOT NULL DEFAULT 'pending',
    "priority" "TaskPriority" NOT NULL DEFAULT 'normal',
    "dueAt" TIMESTAMP(3),
    "estimatedMinutes" INTEGER,
    "progress" INTEGER NOT NULL DEFAULT 0,
    "orderId" INTEGER,
    "createdById" INTEGER,
    "qualityScore" INTEGER,
    "evaluationNote" TEXT,
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskAssignee" (
    "id" SERIAL NOT NULL,
    "taskId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "role" "TaskAssigneeRole" NOT NULL DEFAULT 'assignee',
    "status" "TaskAssigneeStatus" NOT NULL DEFAULT 'assigned',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "TaskAssignee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskSubtask" (
    "id" SERIAL NOT NULL,
    "taskId" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TaskSubtask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskComment" (
    "id" SERIAL NOT NULL,
    "taskId" INTEGER NOT NULL,
    "authorId" INTEGER NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskPerformanceEntry" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "taskId" INTEGER,
    "kind" "PerformanceKind" NOT NULL,
    "points" INTEGER,
    "label" TEXT NOT NULL,
    "details" TEXT,
    "createdById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskPerformanceEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskAttachment" (
    "id" SERIAL NOT NULL,
    "taskId" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "fileSize" INTEGER,
    "mimeType" TEXT,
    "uploadedById" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TaskNotification" (
    "id" SERIAL NOT NULL,
    "taskId" INTEGER NOT NULL,
    "userId" INTEGER NOT NULL,
    "channel" "NotificationChannel" NOT NULL,
    "status" "NotificationStatus" NOT NULL DEFAULT 'sent',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "escalatedToSms" BOOLEAN NOT NULL DEFAULT false,
    "escalatedToCall" BOOLEAN NOT NULL DEFAULT false,
    "escalationNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TaskNotification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Contract" (
    "id" SERIAL NOT NULL,
    "contractNo" TEXT NOT NULL,
    "userId" INTEGER NOT NULL,
    "companyName" TEXT NOT NULL,
    "inn" TEXT,
    "mfo" TEXT,
    "bankAccount" TEXT,
    "bankName" TEXT,
    "directorName" TEXT,
    "creditLimit" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "paymentTermDays" INTEGER NOT NULL DEFAULT 15,
    "status" "ContractStatus" NOT NULL DEFAULT 'active',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CorporateInvoice" (
    "id" SERIAL NOT NULL,
    "invoiceNo" TEXT NOT NULL,
    "contractId" INTEGER NOT NULL,
    "orderId" INTEGER NOT NULL,
    "subtotal" DECIMAL(18,2) NOT NULL,
    "vatPercent" DOUBLE PRECISION NOT NULL DEFAULT 12,
    "vatAmount" DECIMAL(18,2) NOT NULL,
    "totalAmount" DECIMAL(18,2) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'issued',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "paidAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CorporateInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Story" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "mediaUrl" TEXT NOT NULL,
    "mediaType" "MediaType" NOT NULL DEFAULT 'image',
    "caption" TEXT,
    "textOverlay" JSONB,
    "viewCount" INTEGER NOT NULL DEFAULT 0,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Story_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StoryView" (
    "id" SERIAL NOT NULL,
    "storyId" INTEGER NOT NULL,
    "viewerId" INTEGER NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoryView_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "User_telegramId_key" ON "User"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "User_referralCode_key" ON "User"("referralCode");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_endpoint_key" ON "PushSubscription"("endpoint");

-- CreateIndex
CREATE UNIQUE INDEX "PushSubscription_token_key" ON "PushSubscription"("token");

-- CreateIndex
CREATE INDEX "PushSubscription_driverId_idx" ON "PushSubscription"("driverId");

-- CreateIndex
CREATE INDEX "PushSubscription_appType_isActive_idx" ON "PushSubscription"("appType", "isActive");

-- CreateIndex
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramHqAdmin_phone_key" ON "TelegramHqAdmin"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramHqAdmin_telegramId_key" ON "TelegramHqAdmin"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramHqAdmin_registrationCode_key" ON "TelegramHqAdmin"("registrationCode");

-- CreateIndex
CREATE INDEX "BotAccessRequest_role_status_createdAt_idx" ON "BotAccessRequest"("role", "status", "createdAt");

-- CreateIndex
CREATE INDEX "BotAccessRequest_phone_role_idx" ON "BotAccessRequest"("phone", "role");

-- CreateIndex
CREATE INDEX "BotAccessRequest_telegramId_role_idx" ON "BotAccessRequest"("telegramId", "role");

-- CreateIndex
CREATE INDEX "BotAccessRequest_requestedSupervisorId_status_idx" ON "BotAccessRequest"("requestedSupervisorId", "status");

-- CreateIndex
CREATE INDEX "BotAccessRequest_requestedPointId_status_idx" ON "BotAccessRequest"("requestedPointId", "status");

-- CreateIndex
CREATE INDEX "BotAccessRequest_approvedByHqAdminId_createdAt_idx" ON "BotAccessRequest"("approvedByHqAdminId", "createdAt");

-- CreateIndex
CREATE INDEX "BotAccessRequest_approvedBySupervisorId_createdAt_idx" ON "BotAccessRequest"("approvedBySupervisorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "BotEvent_dedupeKey_key" ON "BotEvent"("dedupeKey");

-- CreateIndex
CREATE INDEX "BotEvent_sourceBot_createdAt_idx" ON "BotEvent"("sourceBot", "createdAt");

-- CreateIndex
CREATE INDEX "BotEvent_severity_createdAt_idx" ON "BotEvent"("severity", "createdAt");

-- CreateIndex
CREATE INDEX "BotEvent_status_createdAt_idx" ON "BotEvent"("status", "createdAt");

-- CreateIndex
CREATE INDEX "BotEvent_eventType_createdAt_idx" ON "BotEvent"("eventType", "createdAt");

-- CreateIndex
CREATE INDEX "BotEvent_requestId_createdAt_idx" ON "BotEvent"("requestId", "createdAt");

-- CreateIndex
CREATE INDEX "BotEvent_collectionId_createdAt_idx" ON "BotEvent"("collectionId", "createdAt");

-- CreateIndex
CREATE INDEX "BotEvent_supervisorId_createdAt_idx" ON "BotEvent"("supervisorId", "createdAt");

-- CreateIndex
CREATE INDEX "BotEvent_driverId_createdAt_idx" ON "BotEvent"("driverId", "createdAt");

-- CreateIndex
CREATE INDEX "Product_status_createdAt_idx" ON "Product"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Product_category_status_idx" ON "Product"("category", "status");

-- CreateIndex
CREATE INDEX "Product_categoryId_idx" ON "Product"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "Category_slug_key" ON "Category"("slug");

-- CreateIndex
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");

-- CreateIndex
CREATE INDEX "Order_userId_idx" ON "Order"("userId");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Order_paymentStatus_idx" ON "Order"("paymentStatus");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_idx" ON "OrderItem"("productId");

-- CreateIndex
CREATE INDEX "PaymeTransaction_orderId_idx" ON "PaymeTransaction"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_productId_warehouseId_key" ON "Inventory"("productId", "warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkOrder_orderNo_key" ON "WorkOrder"("orderNo");

-- CreateIndex
CREATE UNIQUE INDEX "Supervisor_phone_key" ON "Supervisor"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Supervisor_telegramId_key" ON "Supervisor"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "Supervisor_registrationCode_key" ON "Supervisor"("registrationCode");

-- CreateIndex
CREATE INDEX "Supervisor_pointId_idx" ON "Supervisor"("pointId");

-- CreateIndex
CREATE INDEX "JournalCorrectionRequest_status_createdAt_idx" ON "JournalCorrectionRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "JournalCorrectionRequest_supervisorId_status_idx" ON "JournalCorrectionRequest"("supervisorId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_phone_key" ON "Driver"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_email_key" ON "Driver"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_telegramId_key" ON "Driver"("telegramId");

-- CreateIndex
CREATE UNIQUE INDEX "Driver_registrationCode_key" ON "Driver"("registrationCode");

-- CreateIndex
CREATE INDEX "Driver_supervisorId_idx" ON "Driver"("supervisorId");

-- CreateIndex
CREATE INDEX "Driver_pointId_idx" ON "Driver"("pointId");

-- CreateIndex
CREATE INDEX "DriverCard_driverId_idx" ON "DriverCard"("driverId");

-- CreateIndex
CREATE INDEX "DriverTransaction_driverId_idx" ON "DriverTransaction"("driverId");

-- CreateIndex
CREATE INDEX "DriverTransaction_createdAt_idx" ON "DriverTransaction"("createdAt");

-- CreateIndex
CREATE INDEX "RecycleRequest_userId_idx" ON "RecycleRequest"("userId");

-- CreateIndex
CREATE INDEX "RecycleRequest_supervisorId_idx" ON "RecycleRequest"("supervisorId");

-- CreateIndex
CREATE INDEX "RecycleRequest_assignedDriverId_idx" ON "RecycleRequest"("assignedDriverId");

-- CreateIndex
CREATE INDEX "RecycleRequest_status_createdAt_idx" ON "RecycleRequest"("status", "createdAt");

-- CreateIndex
CREATE INDEX "RecycleRequest_regionId_status_idx" ON "RecycleRequest"("regionId", "status");

-- CreateIndex
CREATE INDEX "RecycleCollection_requestId_idx" ON "RecycleCollection"("requestId");

-- CreateIndex
CREATE INDEX "RecycleCollection_driverId_idx" ON "RecycleCollection"("driverId");

-- CreateIndex
CREATE INDEX "RecycleManualIntake_supervisorId_date_idx" ON "RecycleManualIntake"("supervisorId", "date");

-- CreateIndex
CREATE INDEX "RecycleManualIntake_pointId_date_idx" ON "RecycleManualIntake"("pointId", "date");

-- CreateIndex
CREATE INDEX "RecyclePressLog_supervisorId_date_idx" ON "RecyclePressLog"("supervisorId", "date");

-- CreateIndex
CREATE INDEX "RecyclePressLog_pointId_date_idx" ON "RecyclePressLog"("pointId", "date");

-- CreateIndex
CREATE INDEX "RecycleExpenseLog_supervisorId_date_idx" ON "RecycleExpenseLog"("supervisorId", "date");

-- CreateIndex
CREATE INDEX "RecycleExpenseLog_pointId_date_idx" ON "RecycleExpenseLog"("pointId", "date");

-- CreateIndex
CREATE INDEX "RecycleDailyCash_pointId_date_idx" ON "RecycleDailyCash"("pointId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "RecycleDailyCash_supervisorId_date_key" ON "RecycleDailyCash"("supervisorId", "date");

-- CreateIndex
CREATE INDEX "RecycleSalesLog_supervisorId_date_idx" ON "RecycleSalesLog"("supervisorId", "date");

-- CreateIndex
CREATE INDEX "RecycleSalesLog_pointId_date_idx" ON "RecycleSalesLog"("pointId", "date");

-- CreateIndex
CREATE INDEX "RecycleSalesLog_customerName_idx" ON "RecycleSalesLog"("customerName");

-- CreateIndex
CREATE INDEX "RecycleComplaint_requestId_idx" ON "RecycleComplaint"("requestId");

-- CreateIndex
CREATE INDEX "EcoAchievement_userId_idx" ON "EcoAchievement"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "EcoAchievement_userId_badgeKey_key" ON "EcoAchievement"("userId", "badgeKey");

-- CreateIndex
CREATE UNIQUE INDEX "Task_publicCode_key" ON "Task"("publicCode");

-- CreateIndex
CREATE INDEX "Task_status_dueAt_idx" ON "Task"("status", "dueAt");

-- CreateIndex
CREATE INDEX "Task_department_status_idx" ON "Task"("department", "status");

-- CreateIndex
CREATE INDEX "Task_orderId_idx" ON "Task"("orderId");

-- CreateIndex
CREATE INDEX "TaskAssignee_userId_idx" ON "TaskAssignee"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "TaskAssignee_taskId_userId_key" ON "TaskAssignee"("taskId", "userId");

-- CreateIndex
CREATE INDEX "TaskComment_taskId_createdAt_idx" ON "TaskComment"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "TaskPerformanceEntry_userId_createdAt_idx" ON "TaskPerformanceEntry"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "TaskPerformanceEntry_taskId_idx" ON "TaskPerformanceEntry"("taskId");

-- CreateIndex
CREATE INDEX "TaskAttachment_taskId_idx" ON "TaskAttachment"("taskId");

-- CreateIndex
CREATE INDEX "TaskNotification_taskId_userId_idx" ON "TaskNotification"("taskId", "userId");

-- CreateIndex
CREATE INDEX "TaskNotification_status_sentAt_idx" ON "TaskNotification"("status", "sentAt");

-- CreateIndex
CREATE INDEX "TaskNotification_userId_channel_idx" ON "TaskNotification"("userId", "channel");

-- CreateIndex
CREATE UNIQUE INDEX "Contract_contractNo_key" ON "Contract"("contractNo");

-- CreateIndex
CREATE INDEX "Contract_userId_idx" ON "Contract"("userId");

-- CreateIndex
CREATE INDEX "Contract_status_idx" ON "Contract"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CorporateInvoice_invoiceNo_key" ON "CorporateInvoice"("invoiceNo");

-- CreateIndex
CREATE INDEX "CorporateInvoice_contractId_status_idx" ON "CorporateInvoice"("contractId", "status");

-- CreateIndex
CREATE INDEX "CorporateInvoice_orderId_idx" ON "CorporateInvoice"("orderId");

-- CreateIndex
CREATE INDEX "CorporateInvoice_dueDate_status_idx" ON "CorporateInvoice"("dueDate", "status");

-- CreateIndex
CREATE INDEX "Story_userId_expiresAt_idx" ON "Story"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "Story_expiresAt_idx" ON "Story"("expiresAt");

-- CreateIndex
CREATE INDEX "StoryView_viewerId_idx" ON "StoryView"("viewerId");

-- CreateIndex
CREATE UNIQUE INDEX "StoryView_storyId_viewerId_key" ON "StoryView"("storyId", "viewerId");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_referredById_fkey" FOREIGN KEY ("referredById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PushSubscription" ADD CONSTRAINT "PushSubscription_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotAccessRequest" ADD CONSTRAINT "BotAccessRequest_requestedPointId_fkey" FOREIGN KEY ("requestedPointId") REFERENCES "RecyclePoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotAccessRequest" ADD CONSTRAINT "BotAccessRequest_requestedSupervisorId_fkey" FOREIGN KEY ("requestedSupervisorId") REFERENCES "Supervisor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotAccessRequest" ADD CONSTRAINT "BotAccessRequest_approvedByHqAdminId_fkey" FOREIGN KEY ("approvedByHqAdminId") REFERENCES "TelegramHqAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotAccessRequest" ADD CONSTRAINT "BotAccessRequest_approvedBySupervisorId_fkey" FOREIGN KEY ("approvedBySupervisorId") REFERENCES "Supervisor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotAccessRequest" ADD CONSTRAINT "BotAccessRequest_createdSupervisorId_fkey" FOREIGN KEY ("createdSupervisorId") REFERENCES "Supervisor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BotAccessRequest" ADD CONSTRAINT "BotAccessRequest_createdDriverId_fkey" FOREIGN KEY ("createdDriverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Order" ADD CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrderItem" ADD CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PaymeTransaction" ADD CONSTRAINT "PaymeTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_fromWarehouseId_fkey" FOREIGN KEY ("fromWarehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockMovement" ADD CONSTRAINT "StockMovement_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrderStage" ADD CONSTRAINT "WorkOrderStage_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Supervisor" ADD CONSTRAINT "Supervisor_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "RecyclePoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalCorrectionRequest" ADD CONSTRAINT "JournalCorrectionRequest_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Supervisor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalCorrectionRequest" ADD CONSTRAINT "JournalCorrectionRequest_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "RecyclePoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JournalCorrectionRequest" ADD CONSTRAINT "JournalCorrectionRequest_reviewedByHqAdminId_fkey" FOREIGN KEY ("reviewedByHqAdminId") REFERENCES "TelegramHqAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Supervisor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "RecyclePoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_invitedBySupervisorId_fkey" FOREIGN KEY ("invitedBySupervisorId") REFERENCES "Supervisor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Driver" ADD CONSTRAINT "Driver_invitedByPointId_fkey" FOREIGN KEY ("invitedByPointId") REFERENCES "RecyclePoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverCard" ADD CONSTRAINT "DriverCard_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverTransaction" ADD CONSTRAINT "DriverTransaction_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DriverTransaction" ADD CONSTRAINT "DriverTransaction_cardId_fkey" FOREIGN KEY ("cardId") REFERENCES "DriverCard"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecycleRequest" ADD CONSTRAINT "RecycleRequest_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "RecyclePoint"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecycleRequest" ADD CONSTRAINT "RecycleRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecycleRequest" ADD CONSTRAINT "RecycleRequest_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Supervisor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecycleRequest" ADD CONSTRAINT "RecycleRequest_assignedDriverId_fkey" FOREIGN KEY ("assignedDriverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecycleCollection" ADD CONSTRAINT "RecycleCollection_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RecycleRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecycleCollection" ADD CONSTRAINT "RecycleCollection_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecycleManualIntake" ADD CONSTRAINT "RecycleManualIntake_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Supervisor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecycleManualIntake" ADD CONSTRAINT "RecycleManualIntake_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "RecyclePoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecyclePressLog" ADD CONSTRAINT "RecyclePressLog_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Supervisor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecyclePressLog" ADD CONSTRAINT "RecyclePressLog_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "RecyclePoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecycleExpenseLog" ADD CONSTRAINT "RecycleExpenseLog_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Supervisor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecycleExpenseLog" ADD CONSTRAINT "RecycleExpenseLog_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "RecyclePoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecycleDailyCash" ADD CONSTRAINT "RecycleDailyCash_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Supervisor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecycleDailyCash" ADD CONSTRAINT "RecycleDailyCash_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "RecyclePoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecycleSalesLog" ADD CONSTRAINT "RecycleSalesLog_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Supervisor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecycleSalesLog" ADD CONSTRAINT "RecycleSalesLog_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "RecyclePoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecycleComplaint" ADD CONSTRAINT "RecycleComplaint_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "RecycleRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EcoAchievement" ADD CONSTRAINT "EcoAchievement_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignee" ADD CONSTRAINT "TaskAssignee_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAssignee" ADD CONSTRAINT "TaskAssignee_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskSubtask" ADD CONSTRAINT "TaskSubtask_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskComment" ADD CONSTRAINT "TaskComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskPerformanceEntry" ADD CONSTRAINT "TaskPerformanceEntry_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskPerformanceEntry" ADD CONSTRAINT "TaskPerformanceEntry_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskPerformanceEntry" ADD CONSTRAINT "TaskPerformanceEntry_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskAttachment" ADD CONSTRAINT "TaskAttachment_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskNotification" ADD CONSTRAINT "TaskNotification_taskId_fkey" FOREIGN KEY ("taskId") REFERENCES "Task"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TaskNotification" ADD CONSTRAINT "TaskNotification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorporateInvoice" ADD CONSTRAINT "CorporateInvoice_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorporateInvoice" ADD CONSTRAINT "CorporateInvoice_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Story" ADD CONSTRAINT "Story_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryView" ADD CONSTRAINT "StoryView_storyId_fkey" FOREIGN KEY ("storyId") REFERENCES "Story"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StoryView" ADD CONSTRAINT "StoryView_viewerId_fkey" FOREIGN KEY ("viewerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

