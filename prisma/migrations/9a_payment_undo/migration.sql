-- Xato qo'yilgan "to'landi" belgisini bekor qilish: to'lov tarixida shu amal yopgan hisob-fakturalarning avvalgi holati saqlanadi
-- AlterTable
ALTER TABLE "OrderEvent" ADD COLUMN     "meta" JSONB;
