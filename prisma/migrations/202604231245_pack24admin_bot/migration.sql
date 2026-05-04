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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TelegramHqAdmin_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "BotEvent" (
    "id" SERIAL NOT NULL,
    "sourceBot" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" INTEGER,
    "severity" TEXT NOT NULL DEFAULT 'info',
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'new',
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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TelegramHqAdmin_phone_key" ON "TelegramHqAdmin"("phone");
CREATE UNIQUE INDEX "TelegramHqAdmin_telegramId_key" ON "TelegramHqAdmin"("telegramId");
CREATE UNIQUE INDEX "TelegramHqAdmin_registrationCode_key" ON "TelegramHqAdmin"("registrationCode");

CREATE UNIQUE INDEX "BotEvent_dedupeKey_key" ON "BotEvent"("dedupeKey");
CREATE INDEX "BotEvent_sourceBot_createdAt_idx" ON "BotEvent"("sourceBot", "createdAt");
CREATE INDEX "BotEvent_severity_createdAt_idx" ON "BotEvent"("severity", "createdAt");
CREATE INDEX "BotEvent_status_createdAt_idx" ON "BotEvent"("status", "createdAt");
CREATE INDEX "BotEvent_eventType_createdAt_idx" ON "BotEvent"("eventType", "createdAt");
CREATE INDEX "BotEvent_requestId_createdAt_idx" ON "BotEvent"("requestId", "createdAt");
CREATE INDEX "BotEvent_collectionId_createdAt_idx" ON "BotEvent"("collectionId", "createdAt");
CREATE INDEX "BotEvent_supervisorId_createdAt_idx" ON "BotEvent"("supervisorId", "createdAt");
CREATE INDEX "BotEvent_driverId_createdAt_idx" ON "BotEvent"("driverId", "createdAt");
