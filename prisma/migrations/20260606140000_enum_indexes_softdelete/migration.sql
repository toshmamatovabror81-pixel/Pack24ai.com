-- CreateEnum: MaterialType, MediaType, BotAccessRole, PerformanceKind

-- 1. Yangi enumlar yaratish
CREATE TYPE "MaterialType" AS ENUM ('qogoz', 'karton', 'gazeta', 'jurnal', 'ofis', 'kitob', 'aralash', 'sellofan', 'plastik');
CREATE TYPE "MediaType" AS ENUM ('image', 'video');
CREATE TYPE "BotAccessRole" AS ENUM ('driver', 'supervisor');
CREATE TYPE "PerformanceKind" AS ENUM ('quality', 'speed', 'discipline', 'initiative', 'penalty');

-- 2. String → Enum migratsiya (mavjud ma'lumotlarni cast qilish bilan)

-- BotAccessRequest.role: String → BotAccessRole
ALTER TABLE "BotAccessRequest" ALTER COLUMN "role" TYPE "BotAccessRole" USING "role"::"BotAccessRole";

-- RecycleRequest.material: String → MaterialType (nullable)
-- Avval noto'g'ri qiymatlarni tozalash
UPDATE "RecycleRequest" SET "material" = NULL WHERE "material" IS NOT NULL AND "material" NOT IN ('qogoz', 'karton', 'gazeta', 'jurnal', 'ofis', 'kitob', 'aralash', 'sellofan', 'plastik');
ALTER TABLE "RecycleRequest" ALTER COLUMN "material" TYPE "MaterialType" USING "material"::"MaterialType";

-- RecycleCollection.materialType: String → MaterialType (nullable)
UPDATE "RecycleCollection" SET "materialType" = NULL WHERE "materialType" IS NOT NULL AND "materialType" NOT IN ('qogoz', 'karton', 'gazeta', 'jurnal', 'ofis', 'kitob', 'aralash', 'sellofan', 'plastik');
ALTER TABLE "RecycleCollection" ALTER COLUMN "materialType" TYPE "MaterialType" USING "materialType"::"MaterialType";

-- TaskPerformanceEntry.kind: String → PerformanceKind
UPDATE "TaskPerformanceEntry" SET "kind" = 'quality' WHERE "kind" NOT IN ('quality', 'speed', 'discipline', 'initiative', 'penalty');
ALTER TABLE "TaskPerformanceEntry" ALTER COLUMN "kind" TYPE "PerformanceKind" USING "kind"::"PerformanceKind";

-- Story.mediaType: String → MediaType
UPDATE "Story" SET "mediaType" = 'image' WHERE "mediaType" NOT IN ('image', 'video');
ALTER TABLE "Story" ALTER COLUMN "mediaType" DROP DEFAULT;
ALTER TABLE "Story" ALTER COLUMN "mediaType" TYPE "MediaType" USING "mediaType"::"MediaType";
ALTER TABLE "Story" ALTER COLUMN "mediaType" SET DEFAULT 'image'::"MediaType";

-- 3. Yangi indekslar
CREATE INDEX IF NOT EXISTS "Order_status_createdAt_idx" ON "Order"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "Order_paymentStatus_idx" ON "Order"("paymentStatus");
CREATE INDEX IF NOT EXISTS "RecycleRequest_status_createdAt_idx" ON "RecycleRequest"("status", "createdAt");
CREATE INDEX IF NOT EXISTS "RecycleRequest_pointId_status_idx" ON "RecycleRequest"("regionId", "status");

-- 4. Soft delete maydonlari
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3);

-- 5. Cascade rules
-- OrderItem.product → Restrict (default CASCADE dan Restrict ga)
-- Bu alohida ALTER qilib bo'lmaydi — Prisma o'zi boshqaradi
-- RecycleCollection.driver → Restrict (xuddi shunday)
