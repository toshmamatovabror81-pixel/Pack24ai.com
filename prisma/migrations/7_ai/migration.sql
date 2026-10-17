-- Sun'iy intellekt: kunlik tekshiruv hisobotlari (AuditReport) va AI so'rovlari hisobi (AiUsage)
-- CreateTable
CREATE TABLE "AuditReport" (
    "id" SERIAL NOT NULL,
    "trigger" TEXT NOT NULL,
    "checks" JSONB NOT NULL,
    "summary" JSONB,
    "model" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiUsage" (
    "day" TEXT NOT NULL,
    "requests" INTEGER NOT NULL DEFAULT 0,
    "inputTokens" INTEGER NOT NULL DEFAULT 0,
    "outputTokens" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AiUsage_pkey" PRIMARY KEY ("day")
);

-- CreateIndex
CREATE INDEX "AuditReport_createdAt_idx" ON "AuditReport"("createdAt");

