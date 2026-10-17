-- Payme tranzaksiya summasi (tiyin) 32 bitli Int edi: 21 474 836,47 so'mdan katta buyurtmada CreateTransaction xato berardi
-- va bunday buyurtmani Payme orqali to'lab bo'lmasdi. 64 bitga kengaytiriladi; mavjud qiymatlar o'zgarmaydi.
ALTER TABLE "PaymeTransaction" ALTER COLUMN "amount" TYPE BIGINT;

-- Promokod sanalari: admin formasi kunni UTC yarim tun deb saqlardi (Toshkentda soat 05:00). Endi Toshkent kuni saqlanadi
-- (boshlanishi 00:00, tugashi 23:59:59.999 +05:00). Faqat aynan UTC yarim tunda turgan eski qatorlar to'g'rilanadi:
-- tugash kuni oxirigacha, boshlanish kun boshiga.
UPDATE "PromoCode" SET "endsAt" = "endsAt" + interval '18 hours 59 minutes 59.999 seconds'
  WHERE "endsAt" IS NOT NULL AND "endsAt" = date_trunc('day', "endsAt");
UPDATE "PromoCode" SET "startsAt" = "startsAt" - interval '5 hours'
  WHERE "startsAt" IS NOT NULL AND "startsAt" = date_trunc('day', "startsAt");
