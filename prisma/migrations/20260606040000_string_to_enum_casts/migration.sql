-- 1. Create enum types if they don't exist

DO $$ BEGIN
    CREATE TYPE "public"."BotEventSource" AS ENUM ('customer', 'driver', 'supervisor', 'pack24admin', 'platform', 'system');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."EventSeverity" AS ENUM ('info', 'success', 'warning', 'error');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."StockMovementType" AS ENUM ('IN', 'OUT', 'TRANSFER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."NotificationChannel" AS ENUM ('telegram', 'sms', 'call');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE "public"."ProductionStage" AS ENUM ('gofra', 'pechat', 'yiguv', 'qc');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Alter columns from text to enum using cast

ALTER TABLE "BotEvent" ALTER COLUMN "sourceBot" TYPE "public"."BotEventSource" USING "sourceBot"::"public"."BotEventSource";

ALTER TABLE "StockMovement" ALTER COLUMN "type" TYPE "public"."StockMovementType" USING "type"::"public"."StockMovementType";

ALTER TABLE "TaskNotification" ALTER COLUMN "channel" TYPE "public"."NotificationChannel" USING "channel"::"public"."NotificationChannel";

ALTER TABLE "WorkOrderStage" ALTER COLUMN "stage" TYPE "public"."ProductionStage" USING "stage"::"public"."ProductionStage";
