-- ═══════════════════════════════════════════════════════════════════════════════
-- Pack24-web — DB Audit: Legacy String Values
-- P2.3: SELECT DISTINCT bilan noto'g'ri/eskirgan qiymatlarni aniqlash
--
-- Bu skriptni ishga tushiring: psql -f scripts/db-audit.sql  yoki
-- Prisma Studio / pgAdmin da qo'lda ishlatish uchun
-- ═══════════════════════════════════════════════════════════════════════════════

-- ────────────────────────────────────────────────────────────────────
-- 1. User.role — Kutilgan: user, admin, staff, manager
-- ────────────────────────────────────────────────────────────────────
SELECT 'User.role' AS field,
       role AS value,
       COUNT(*) AS count
FROM "User"
GROUP BY role
ORDER BY count DESC;

-- ────────────────────────────────────────────────────────────────────
-- 2. User.customerType — Kutilgan: individual, corporate, wholesale, dealer
-- ────────────────────────────────────────────────────────────────────
SELECT 'User.customerType' AS field,
       "customerType" AS value,
       COUNT(*) AS count
FROM "User"
WHERE "customerType" IS NOT NULL
GROUP BY "customerType"
ORDER BY count DESC;

-- ────────────────────────────────────────────────────────────────────
-- 3. User.customerGroup — Kutilgan: standard, vip, new, inactive, blocked
-- ────────────────────────────────────────────────────────────────────
SELECT 'User.customerGroup' AS field,
       "customerGroup" AS value,
       COUNT(*) AS count
FROM "User"
WHERE "customerGroup" IS NOT NULL
GROUP BY "customerGroup"
ORDER BY count DESC;

-- ────────────────────────────────────────────────────────────────────
-- 4. RecycleRequest.pickupType — Kutilgan: base, pickup
-- ────────────────────────────────────────────────────────────────────
SELECT 'RecycleRequest.pickupType' AS field,
       "pickupType" AS value,
       COUNT(*) AS count
FROM "RecycleRequest"
WHERE "pickupType" IS NOT NULL
GROUP BY "pickupType"
ORDER BY count DESC;

-- ────────────────────────────────────────────────────────────────────
-- 5. RecycleRequest.pickupLocationMode — Kutilgan: gps, map, text
-- ────────────────────────────────────────────────────────────────────
SELECT 'RecycleRequest.pickupLocationMode' AS field,
       "pickupLocationMode" AS value,
       COUNT(*) AS count
FROM "RecycleRequest"
WHERE "pickupLocationMode" IS NOT NULL
GROUP BY "pickupLocationMode"
ORDER BY count DESC;

-- ────────────────────────────────────────────────────────────────────
-- 6. RecycleRequest.status — Prisma enum bo'lishi kerak, lekin
--    legacy qiymatlar bo'lishi mumkin
-- ────────────────────────────────────────────────────────────────────
SELECT 'RecycleRequest.status' AS field,
       status::text AS value,
       COUNT(*) AS count
FROM "RecycleRequest"
GROUP BY status
ORDER BY count DESC;

-- ────────────────────────────────────────────────────────────────────
-- 7. RecycleCollection.paymentStatus — Kutilgan qiymatlar tekshiruvi
-- ────────────────────────────────────────────────────────────────────
SELECT 'RecycleCollection.paymentStatus' AS field,
       "paymentStatus"::text AS value,
       COUNT(*) AS count
FROM "RecycleCollection"
GROUP BY "paymentStatus"
ORDER BY count DESC;

-- ────────────────────────────────────────────────────────────────────
-- 8. Driver.status — Prisma enum DriverStatus
-- ────────────────────────────────────────────────────────────────────
SELECT 'Driver.status' AS field,
       status::text AS value,
       COUNT(*) AS count
FROM "Driver"
GROUP BY status
ORDER BY count DESC;

-- ────────────────────────────────────────────────────────────────────
-- 9. Order.status — Prisma enum OrderStatus
-- ────────────────────────────────────────────────────────────────────
SELECT 'Order.status' AS field,
       status::text AS value,
       COUNT(*) AS count
FROM "Order"
GROUP BY status
ORDER BY count DESC;

-- ────────────────────────────────────────────────────────────────────
-- 10. Product.status — Prisma enum ProductStatus
-- ────────────────────────────────────────────────────────────────────
SELECT 'Product.status' AS field,
       status::text AS value,
       COUNT(*) AS count
FROM "Product"
GROUP BY status
ORDER BY count DESC;

-- ────────────────────────────────────────────────────────────────────
-- 11. Campaign.type — Kutilgan: telegram, sms, email
-- ────────────────────────────────────────────────────────────────────
SELECT 'Campaign.type' AS field,
       type AS value,
       COUNT(*) AS count
FROM "Campaign"
WHERE type IS NOT NULL
GROUP BY type
ORDER BY count DESC;

-- ────────────────────────────────────────────────────────────────────
-- 12. BotAccessRequest.role — Kutilgan: supervisor, driver
-- ────────────────────────────────────────────────────────────────────
SELECT 'BotAccessRequest.role' AS field,
       role AS value,
       COUNT(*) AS count
FROM "BotAccessRequest"
GROUP BY role
ORDER BY count DESC;

-- ────────────────────────────────────────────────────────────────────
-- 13. BotAccessRequest.status — Kutilgan: pending, approved, rejected
-- ────────────────────────────────────────────────────────────────────
SELECT 'BotAccessRequest.status' AS field,
       status AS value,
       COUNT(*) AS count
FROM "BotAccessRequest"
GROUP BY status
ORDER BY count DESC;

-- ────────────────────────────────────────────────────────────────────
-- 14. JournalCorrectionRequest.status — Kutilgan: pending, approved, rejected
-- ────────────────────────────────────────────────────────────────────
SELECT 'JournalCorrectionRequest.status' AS field,
       status AS value,
       COUNT(*) AS count
FROM "JournalCorrectionRequest"
GROUP BY status
ORDER BY count DESC;

-- ────────────────────────────────────────────────────────────────────
-- 15. RecycleRequest.regionId — pointId ga rename bo'lishi kerak
--     Qaysi regionId lar ishlatilgan va RecyclePoint da bormi?
-- ────────────────────────────────────────────────────────────────────
SELECT 'RecycleRequest.regionId (orphaned)' AS field,
       rr."regionId" AS value,
       COUNT(*) AS count
FROM "RecycleRequest" rr
LEFT JOIN "RecyclePoint" rp ON rp.id = rr."regionId"
WHERE rp.id IS NULL AND rr."regionId" IS NOT NULL
GROUP BY rr."regionId"
ORDER BY count DESC;

-- ════════════════════════════════════════════════════════════════════
-- XULOSA: Har bir natijada kutilmagan qiymat ko'rsang, bu legacy
-- ma'lumot. P2.4 da Prisma enum migratsiyasidan oldin tuzatish kerak.
-- ════════════════════════════════════════════════════════════════════
