-- Ishonchlilik: darhol yuborib bo'lmagan bot xabarlari navbati (BotOutbox) — Telegram vaqtincha ishlamaganda xabar yo'qolmaydi
-- CreateTable
CREATE TABLE "BotOutbox" (
    "id" SERIAL NOT NULL,
    "bot" TEXT NOT NULL,
    "chatId" TEXT NOT NULL,
    "topic" TEXT,
    "html" TEXT NOT NULL,
    "inline" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 1,
    "nextAt" TIMESTAMP(3) NOT NULL,
    "lastError" TEXT,
    "sentAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BotOutbox_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "BotOutbox_sentAt_failedAt_nextAt_idx" ON "BotOutbox"("sentAt", "failedAt", "nextAt");

-- CreateIndex
CREATE INDEX "BotOutbox_bot_chatId_topic_idx" ON "BotOutbox"("bot", "chatId", "topic");
