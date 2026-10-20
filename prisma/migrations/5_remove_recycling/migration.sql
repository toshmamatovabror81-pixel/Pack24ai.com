-- Makulatura yo'nalishi butunlay olib tashlandi: jadvallar, enum'lar, User'dagi eko ustunlar.
-- Jadvallar bog'liqlik tartibida o'chiriladi (avval boshqalar murojaat qilmaydiganlari), shuning uchun
-- DROP CONSTRAINT ham, CASCADE ham kerak emas. BotSession qoladi (yangi botlar ham ishlatadi).

-- DropTable
DROP TABLE "EcoAchievement";

-- DropTable
DROP TABLE "RecycleComplaint";

-- DropTable
DROP TABLE "RecycleCollection";

-- DropTable
DROP TABLE "DriverTransaction";

-- DropTable
DROP TABLE "DriverCard";

-- DropTable
DROP TABLE "BotAccessRequest";

-- DropTable
DROP TABLE "JournalCorrectionRequest";

-- DropTable
DROP TABLE "RecycleManualIntake";

-- DropTable
DROP TABLE "RecyclePressLog";

-- DropTable
DROP TABLE "RecycleExpenseLog";

-- DropTable
DROP TABLE "RecycleDailyCash";

-- DropTable
DROP TABLE "RecycleSalesLog";

-- DropTable
DROP TABLE "RecycleRequest";

-- DropTable
DROP TABLE "Driver";

-- DropTable
DROP TABLE "Supervisor";

-- DropTable
DROP TABLE "TelegramHqAdmin";

-- DropTable
DROP TABLE "RecyclePoint";

-- DropTable
DROP TABLE "BotEvent";

-- AlterTable
ALTER TABLE "User" DROP COLUMN "ecoLevel",
DROP COLUMN "ecoPoints",
DROP COLUMN "ecoStreak",
DROP COLUMN "lastEcoActivity",
DROP COLUMN "totalCO2Saved",
DROP COLUMN "totalRecycledWeight",
DROP COLUMN "treesEquivalent";

-- DropEnum
DROP TYPE "RecycleRequestStatus";

-- DropEnum
DROP TYPE "DriverStatus";

-- DropEnum
DROP TYPE "RecyclePaymentStatus";

-- DropEnum
DROP TYPE "RecyclePointStatus";

-- DropEnum
DROP TYPE "BotAccessStatus";

-- DropEnum
DROP TYPE "BotAccessRole";

-- DropEnum
DROP TYPE "ComplaintStatus";

-- DropEnum
DROP TYPE "ComplaintLevel";

-- DropEnum
DROP TYPE "BotEventStatus";

-- DropEnum
DROP TYPE "BotEventSource";

-- DropEnum
DROP TYPE "EventSeverity";

-- DropEnum
DROP TYPE "DriverTransactionType";

-- DropEnum
DROP TYPE "DriverTransactionStatus";

-- DropEnum
DROP TYPE "CardType";

-- DropEnum
DROP TYPE "EcoLevel";

-- DropEnum
DROP TYPE "PickupType";

-- DropEnum
DROP TYPE "VolumeSize";

-- DropEnum
DROP TYPE "PickupLocationMode";

-- DropEnum
DROP TYPE "CustomerLang";

-- DropEnum
DROP TYPE "MaterialType";

-- DropEnum
DROP TYPE "CorrectionEntityType";

-- DropEnum
DROP TYPE "BadgeKey";

-- Data: eski bot suhbat holatlari (haydovchi/masul/rahbariyat rollari va makulatura mijoz oqimi) endi kerak emas
DELETE FROM "BotSession";

-- Data: sayt sozlamalaridan makulatura kalitlari
UPDATE "SiteSetting"
SET "value" = "value" - '{recyclingMinKg,recyclingPickupMinKg,recyclingText}'::text[]
WHERE "key" = 'site';
