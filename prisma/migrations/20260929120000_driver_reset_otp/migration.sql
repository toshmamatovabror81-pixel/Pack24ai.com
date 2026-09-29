-- AlterTable: Driver — parolni tiklash uchun OTP maydonlari
ALTER TABLE "Driver"
    ADD COLUMN IF NOT EXISTS "resetOtpCode" TEXT,
    ADD COLUMN IF NOT EXISTS "resetOtpExpiry" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "resetOtpAttempts" INTEGER NOT NULL DEFAULT 0;
