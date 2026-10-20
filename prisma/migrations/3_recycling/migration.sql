-- Makulatura bosqichi: mehmon kuzatuv havolasi, bekor qilingan vaqt, Telegram bot sessiyalari
-- AlterTable
ALTER TABLE "RecycleRequest" ADD COLUMN     "accessToken" TEXT,
ADD COLUMN     "cancelledAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "RecycleRequest_accessToken_key" ON "RecycleRequest"("accessToken");

-- CreateTable
CREATE TABLE "BotSession" (
    "id" SERIAL NOT NULL,
    "bot" TEXT NOT NULL,
    "telegramId" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BotSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BotSession_bot_telegramId_key" ON "BotSession"("bot", "telegramId");

-- CreateIndex
CREATE INDEX "BotSession_updatedAt_idx" ON "BotSession"("updatedAt");
