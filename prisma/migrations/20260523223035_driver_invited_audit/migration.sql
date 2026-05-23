-- AlterTable: Driver — audit fields for "kim taqdim etgani"
ALTER TABLE "Driver"
    ADD COLUMN IF NOT EXISTS "invitedBySupervisorId" INTEGER,
    ADD COLUMN IF NOT EXISTS "invitedByPointId" INTEGER,
    ADD COLUMN IF NOT EXISTS "invitedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "passwordSetByBotAt" TIMESTAMP(3);

-- Foreign keys
ALTER TABLE "Driver"
    ADD CONSTRAINT "Driver_invitedBySupervisorId_fkey"
    FOREIGN KEY ("invitedBySupervisorId") REFERENCES "Supervisor"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Driver"
    ADD CONSTRAINT "Driver_invitedByPointId_fkey"
    FOREIGN KEY ("invitedByPointId") REFERENCES "RecyclePoint"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: hozirgi ma'lumotlar bilan to'ldirish (current supervisor/point as invited by)
UPDATE "Driver"
SET "invitedBySupervisorId" = "supervisorId",
    "invitedByPointId" = "pointId",
    "invitedAt" = "registeredAt"
WHERE "invitedBySupervisorId" IS NULL
  AND "supervisorId" IS NOT NULL;
