-- Botlar: mijoz botidan foydalanuvchilar (TelegramCustomer), buyurtma tarixi (OrderEvent) va bot so'rovlari uchun indekslar
-- CreateTable
CREATE TABLE "OrderEvent" (
    "id" SERIAL NOT NULL,
    "orderId" INTEGER NOT NULL,
    "kind" TEXT NOT NULL,
    "fromValue" TEXT,
    "toValue" TEXT NOT NULL,
    "actor" TEXT,
    "via" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrderEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TelegramCustomer" (
    "id" SERIAL NOT NULL,
    "telegramId" TEXT NOT NULL,
    "phone" TEXT,
    "name" TEXT,
    "lang" TEXT NOT NULL DEFAULT 'uz',
    "notify" BOOLEAN NOT NULL DEFAULT true,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TelegramCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "OrderEvent_orderId_createdAt_idx" ON "OrderEvent"("orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "TelegramCustomer_telegramId_key" ON "TelegramCustomer"("telegramId");

-- CreateIndex
CREATE INDEX "TelegramCustomer_phone_idx" ON "TelegramCustomer"("phone");

-- CreateIndex
CREATE INDEX "Order_contactPhone_idx" ON "Order"("contactPhone");

-- CreateIndex
CREATE INDEX "Order_telegramUserId_idx" ON "Order"("telegramUserId");

-- AddForeignKey
ALTER TABLE "OrderEvent" ADD CONSTRAINT "OrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Eski tizimdan qolgan Telegram ulanishlari bekor qilinadi: bu ustunlarni eski botlar zaifroq tekshiruv bilan
-- to'ldirgan (user_id'siz kontakt ham qabul qilingan). Boshqaruv boti endi faqat o'z kontakti yoki bir martalik kod bilan ulaydi.
UPDATE "User"
SET "telegramId" = NULL, "telegramVerifiedAt" = NULL, "telegramCode" = NULL, "otpExpiry" = NULL
WHERE "telegramId" IS NOT NULL OR "telegramCode" IS NOT NULL OR "otpExpiry" IS NOT NULL;
