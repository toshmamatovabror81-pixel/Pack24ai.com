-- Mas'ul jurnal yozuvlari uchun HQ tasdig'idan keyin qo'llanadigan tahrir so'rovlari
CREATE TABLE "JournalCorrectionRequest" (
    "id" SERIAL NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "entityType" TEXT NOT NULL,
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
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalCorrectionRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "JournalCorrectionRequest_status_createdAt_idx" ON "JournalCorrectionRequest"("status", "createdAt");
CREATE INDEX "JournalCorrectionRequest_supervisorId_status_idx" ON "JournalCorrectionRequest"("supervisorId", "status");

ALTER TABLE "JournalCorrectionRequest" ADD CONSTRAINT "JournalCorrectionRequest_supervisorId_fkey" FOREIGN KEY ("supervisorId") REFERENCES "Supervisor"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "JournalCorrectionRequest" ADD CONSTRAINT "JournalCorrectionRequest_pointId_fkey" FOREIGN KEY ("pointId") REFERENCES "RecyclePoint"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "JournalCorrectionRequest" ADD CONSTRAINT "JournalCorrectionRequest_reviewedByHqAdminId_fkey" FOREIGN KEY ("reviewedByHqAdminId") REFERENCES "TelegramHqAdmin"("id") ON DELETE SET NULL ON UPDATE CASCADE;
