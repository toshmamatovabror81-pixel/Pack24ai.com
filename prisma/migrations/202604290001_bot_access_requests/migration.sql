CREATE TABLE "BotAccessRequest" (
    "id" SERIAL NOT NULL,
    "role" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotAccessRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "BotAccessRequest_role_status_createdAt_idx" ON "BotAccessRequest"("role", "status", "createdAt");
CREATE INDEX "BotAccessRequest_phone_role_idx" ON "BotAccessRequest"("phone", "role");
CREATE INDEX "BotAccessRequest_telegramId_role_idx" ON "BotAccessRequest"("telegramId", "role");
CREATE INDEX "BotAccessRequest_requestedSupervisorId_status_idx" ON "BotAccessRequest"("requestedSupervisorId", "status");
CREATE INDEX "BotAccessRequest_requestedPointId_status_idx" ON "BotAccessRequest"("requestedPointId", "status");
CREATE INDEX "BotAccessRequest_approvedByHqAdminId_createdAt_idx" ON "BotAccessRequest"("approvedByHqAdminId", "createdAt");
CREATE INDEX "BotAccessRequest_approvedBySupervisorId_createdAt_idx" ON "BotAccessRequest"("approvedBySupervisorId", "createdAt");

ALTER TABLE "BotAccessRequest" ADD CONSTRAINT "BotAccessRequest_requestedPointId_fkey"
    FOREIGN KEY ("requestedPointId") REFERENCES "RecyclePoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BotAccessRequest" ADD CONSTRAINT "BotAccessRequest_requestedSupervisorId_fkey"
    FOREIGN KEY ("requestedSupervisorId") REFERENCES "Supervisor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BotAccessRequest" ADD CONSTRAINT "BotAccessRequest_approvedByHqAdminId_fkey"
    FOREIGN KEY ("approvedByHqAdminId") REFERENCES "TelegramHqAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BotAccessRequest" ADD CONSTRAINT "BotAccessRequest_approvedBySupervisorId_fkey"
    FOREIGN KEY ("approvedBySupervisorId") REFERENCES "Supervisor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BotAccessRequest" ADD CONSTRAINT "BotAccessRequest_createdSupervisorId_fkey"
    FOREIGN KEY ("createdSupervisorId") REFERENCES "Supervisor"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "BotAccessRequest" ADD CONSTRAINT "BotAccessRequest_createdDriverId_fkey"
    FOREIGN KEY ("createdDriverId") REFERENCES "Driver"("id") ON DELETE SET NULL ON UPDATE CASCADE;
