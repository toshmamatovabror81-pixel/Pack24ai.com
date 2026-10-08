-- CreateEnum
CREATE TYPE "DiscountType" AS ENUM ('percent', 'fixed');

-- CreateEnum
CREATE TYPE "ReviewStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "LeadType" AS ENUM ('wholesale', 'custom_box', 'callback', 'contact', 'recycling');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('new', 'in_progress', 'done', 'rejected');

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "priceTiers" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "descriptionI18n" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "nameI18n" JSONB NOT NULL DEFAULT '{}',
ADD COLUMN     "sortOrder" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "accessToken" TEXT,
ADD COLUMN     "deliveryFee" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "discountAmount" DECIMAL(18,2) NOT NULL DEFAULT 0,
ADD COLUMN     "landingPage" TEXT,
ADD COLUMN     "promoCode" TEXT,
ADD COLUMN     "referrer" TEXT,
ADD COLUMN     "source" TEXT,
ADD COLUMN     "subtotal" DECIMAL(18,2),
ADD COLUMN     "utmCampaign" TEXT,
ADD COLUMN     "utmContent" TEXT,
ADD COLUMN     "utmMedium" TEXT,
ADD COLUMN     "utmSource" TEXT,
ADD COLUMN     "utmTerm" TEXT;

-- CreateTable
CREATE TABLE "PromoCode" (
    "id" SERIAL NOT NULL,
    "code" TEXT NOT NULL,
    "type" "DiscountType" NOT NULL DEFAULT 'percent',
    "value" DECIMAL(18,2) NOT NULL,
    "minSubtotal" DECIMAL(18,2) NOT NULL DEFAULT 0,
    "maxUses" INTEGER,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "startsAt" TIMESTAMP(3),
    "endsAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromoCode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Banner" (
    "id" SERIAL NOT NULL,
    "titleI18n" JSONB NOT NULL DEFAULT '{}',
    "textI18n" JSONB NOT NULL DEFAULT '{}',
    "image" TEXT,
    "href" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Banner_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" SERIAL NOT NULL,
    "productId" INTEGER,
    "authorName" TEXT NOT NULL,
    "company" TEXT,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "text" TEXT NOT NULL,
    "status" "ReviewStatus" NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Post" (
    "id" SERIAL NOT NULL,
    "slug" TEXT NOT NULL,
    "titleI18n" JSONB NOT NULL DEFAULT '{}',
    "excerptI18n" JSONB NOT NULL DEFAULT '{}',
    "bodyI18n" JSONB NOT NULL DEFAULT '{}',
    "cover" TEXT,
    "isPublished" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Post_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FaqItem" (
    "id" SERIAL NOT NULL,
    "questionI18n" JSONB NOT NULL DEFAULT '{}',
    "answerI18n" JSONB NOT NULL DEFAULT '{}',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FaqItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" SERIAL NOT NULL,
    "type" "LeadType" NOT NULL,
    "status" "LeadStatus" NOT NULL DEFAULT 'new',
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "company" TEXT,
    "message" TEXT,
    "details" JSONB NOT NULL DEFAULT '{}',
    "productId" INTEGER,
    "managerNote" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "landingPage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteSetting" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteSetting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "PromoCode_code_key" ON "PromoCode"("code");

-- CreateIndex
CREATE INDEX "Review_status_createdAt_idx" ON "Review"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Review_productId_idx" ON "Review"("productId");

-- CreateIndex
CREATE UNIQUE INDEX "Post_slug_key" ON "Post"("slug");

-- CreateIndex
CREATE INDEX "Post_isPublished_publishedAt_idx" ON "Post"("isPublished", "publishedAt");

-- CreateIndex
CREATE INDEX "Lead_type_status_createdAt_idx" ON "Lead"("type", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Order_accessToken_key" ON "Order"("accessToken");


-- Data: eski "havo-yostigʼi-lentasi" slug'ini tozalash
UPDATE "Product" SET "category" = 'havo-yostigi-lentasi' WHERE "category" = 'havo-yostigʼi-lentasi';

-- Data: kategoriyalar ilgari faqat brauzer xotirasida edi; endi bazada.
INSERT INTO "Category" ("name", "slug", "nameI18n", "sortOrder", "updatedAt") VALUES
('Doy-Pak (Doy Pack)', 'doy-pak', '{"uz": "Doy-Pak (Doy Pack)", "ru": "Дой-пак", "en": "Doy Pack"}'::jsonb, 0, CURRENT_TIMESTAMP),
('Karton Qutilar', 'karton-qutilar', '{"uz": "Karton Qutilar", "ru": "Картонные коробки", "en": "Cardboard Boxes"}'::jsonb, 1, CURRENT_TIMESTAMP),
('Kuryer Paketlari', 'kuryer-paketlari', '{"uz": "Kuryer Paketlari", "ru": "Курьерские пакеты", "en": "Courier Bags"}'::jsonb, 2, CURRENT_TIMESTAMP),
('Kraft Paketlar', 'kraft-paketlar', '{"uz": "Kraft Paketlar", "ru": "Крафт пакеты", "en": "Kraft Bags"}'::jsonb, 3, CURRENT_TIMESTAMP),
('Havo Yostiqli Paketlar', 'havo-yostiqli-paketlar', '{"uz": "Havo Yostiqli Paketlar", "ru": "Пакеты с воздушной подушкой", "en": "Air Cushion Bags"}'::jsonb, 4, CURRENT_TIMESTAMP),
('BOPP Paketlar', 'bopp-paketlar', '{"uz": "BOPP Paketlar", "ru": "БОПП пакеты", "en": "BOPP Bags"}'::jsonb, 5, CURRENT_TIMESTAMP),
('Plombalar', 'plombalar', '{"uz": "Plombalar", "ru": "Пломбы", "en": "Seals"}'::jsonb, 6, CURRENT_TIMESTAMP),
('Qog''oz Konvertlar', 'qogoz-konvertlar', '{"uz": "Qog''oz Konvertlar", "ru": "Бумажные конверты", "en": "Paper Envelopes"}'::jsonb, 7, CURRENT_TIMESTAMP),
('Polietilen Paketlar', 'polietilen-paketlar', '{"uz": "Polietilen Paketlar", "ru": "Полиэтиленовые пакеты", "en": "Polyethylene Bags"}'::jsonb, 8, CURRENT_TIMESTAMP),
('Vakuum Paketlar', 'vakuum-paketlar', '{"uz": "Vakuum Paketlar", "ru": "Вакуумные пакеты", "en": "Vacuum Bags"}'::jsonb, 9, CURRENT_TIMESTAMP),
('Zip-Lock Paketlar', 'zip-lock-paketlar', '{"uz": "Zip-Lock Paketlar", "ru": "Зип-лок пакеты", "en": "Zip-Lock Bags"}'::jsonb, 10, CURRENT_TIMESTAMP),
('Qadoqlash Plyonkasi', 'qadoqlash-plyonkasi', '{"uz": "Qadoqlash Plyonkasi", "ru": "Упаковочная пленка", "en": "Packaging Film"}'::jsonb, 11, CURRENT_TIMESTAMP),
('Qadoqlash Qog''ozi', 'qadoqlash-qogozi', '{"uz": "Qadoqlash Qog''ozi", "ru": "Упаковочная бумага", "en": "Packaging Paper"}'::jsonb, 12, CURRENT_TIMESTAMP),
('PET Bankalar', 'pet-bankalar', '{"uz": "PET Bankalar", "ru": "ПЭТ банки", "en": "PET Cans"}'::jsonb, 13, CURRENT_TIMESTAMP),
('Oziq-ovqat Konteynerlari', 'oziq-ovqat-konteynerlari', '{"uz": "Oziq-ovqat Konteynerlari", "ru": "Пищевые контейнеры", "en": "Food Containers"}'::jsonb, 14, CURRENT_TIMESTAMP),
('PVD Paketlar (Marketpleys)', 'pvd-paketlar-marketpleys', '{"uz": "PVD Paketlar (Marketpleys)", "ru": "ПВД пакеты", "en": "PVD Bags"}'::jsonb, 15, CURRENT_TIMESTAMP),
('PP Lenta (Tasma)', 'pp-lenta', '{"uz": "PP Lenta (Tasma)", "ru": "ПП лента", "en": "PP Tape"}'::jsonb, 16, CURRENT_TIMESTAMP),
('Slayder Paketlar', 'slayder-paketlar', '{"uz": "Slayder Paketlar", "ru": "Пакеты со слайдером", "en": "Slider Bags"}'::jsonb, 17, CURRENT_TIMESTAMP),
('Termo-qisqaruvchi Plyonka', 'termo-qisqaruvchi-plyonka', '{"uz": "Termo-qisqaruvchi Plyonka", "ru": "Термоусадочная пленка", "en": "Shrink Film"}'::jsonb, 18, CURRENT_TIMESTAMP),
('Himoya Vositalari', 'himoya-vositalari', '{"uz": "Himoya Vositalari", "ru": "Средства защиты", "en": "Protective Equipment"}'::jsonb, 19, CURRENT_TIMESTAMP),
('Gofrokarton', 'gofrokarton', '{"uz": "Gofrokarton", "ru": "Гофрокартон", "en": "Corrugated Cardboard"}'::jsonb, 20, CURRENT_TIMESTAMP),
('Termoetiketkalar', 'termoetiketkalar', '{"uz": "Termoetiketkalar", "ru": "Термоэтикетки", "en": "Thermal Labels"}'::jsonb, 21, CURRENT_TIMESTAMP),
('Do''konlar uchun mollar', 'dokonlar-uchun-mollar', '{"uz": "Do''konlar uchun mollar", "ru": "Товары для магазинов", "en": "Goods for Shops"}'::jsonb, 22, CURRENT_TIMESTAMP),
('Termo Paketlar (Sumka)', 'termo-paketlar', '{"uz": "Termo Paketlar (Sumka)", "ru": "Термопакеты", "en": "Thermal Bags"}'::jsonb, 23, CURRENT_TIMESTAMP),
('Streich-Plyonka', 'streich-plyonka', '{"uz": "Streich-Plyonka", "ru": "Стретч-пленка", "en": "Stretch Film"}'::jsonb, 24, CURRENT_TIMESTAMP),
('Palletlar', 'palletlar', '{"uz": "Palletlar", "ru": "Паллеты", "en": "Pallets"}'::jsonb, 25, CURRENT_TIMESTAMP),
('Havo Yostig''i Lentasi', 'havo-yostigi-lentasi', '{"uz": "Havo Yostig''i Lentasi", "ru": "Лента воздушной подушки", "en": "Air Cushion Tape"}'::jsonb, 26, CURRENT_TIMESTAMP),
('Rossiya Pochta Paketlari', 'rossiya-pochta-paketlari', '{"uz": "Rossiya Pochta Paketlari", "ru": "Пакеты Почта России", "en": "Russian Post Bags"}'::jsonb, 27, CURRENT_TIMESTAMP),
('Skotch va Yelim Lenta', 'skotch-yelim-lenta', '{"uz": "Skotch va Yelim Lenta", "ru": "Скотч и клейкая лента", "en": "Scotch & Adhesive Tape"}'::jsonb, 28, CURRENT_TIMESTAMP),
('Karton Tubuslar', 'karton-tubuslar', '{"uz": "Karton Tubuslar", "ru": "Картонные тубусы", "en": "Cardboard Tubes"}'::jsonb, 29, CURRENT_TIMESTAMP),
('Chiqindi Paketlari', 'chiqindi-paketlari', '{"uz": "Chiqindi Paketlari", "ru": "Мешки для мусора", "en": "Garbage Bags"}'::jsonb, 30, CURRENT_TIMESTAMP),
('PP Qoplar', 'pp-qoplar', '{"uz": "PP Qoplar", "ru": "ПП мешки", "en": "PP Bags"}'::jsonb, 31, CURRENT_TIMESTAMP),
('Arxiv Qutilari', 'arxiv-qutilar', '{"uz": "Arxiv Qutilari", "ru": "Архивные коробки", "en": "Archive Boxes"}'::jsonb, 32, CURRENT_TIMESTAMP),
('Kanselyariya', 'kanselyariya', '{"uz": "Kanselyariya", "ru": "Канцелярия", "en": "Stationery"}'::jsonb, 33, CURRENT_TIMESTAMP),
('Paket Payvandlagichlar', 'paket-payvandlagichlar', '{"uz": "Paket Payvandlagichlar", "ru": "Запайщики пакетов", "en": "Bag Sealers"}'::jsonb, 34, CURRENT_TIMESTAMP),
('Yelimli Cho''ntaklar', 'yelimli-chontaklar', '{"uz": "Yelimli Cho''ntaklar", "ru": "Самоклеящиеся карманы", "en": "Adhesive Pockets"}'::jsonb, 35, CURRENT_TIMESTAMP),
('Himoya Profili', 'himoya-profili', '{"uz": "Himoya Profili", "ru": "Защитный профиль", "en": "Protective Profile"}'::jsonb, 36, CURRENT_TIMESTAMP),
('Pufakchali Plyonka', 'pufakchali-plyonka', '{"uz": "Pufakchali Plyonka", "ru": "Пузырчатая пленка", "en": "Bubble Wrap"}'::jsonb, 37, CURRENT_TIMESTAMP),
('Gofrokoroblar', 'gofrokoroblar', '{"uz": "Gofrokoroblar", "ru": "Гофрокороба", "en": "Corrugated Boxes"}'::jsonb, 38, CURRENT_TIMESTAMP),
('To''ldiruvchilar', 'toldiruvchilar', '{"uz": "To''ldiruvchilar", "ru": "Наполнители", "en": "Fillers"}'::jsonb, 39, CURRENT_TIMESTAMP),
('Ko''pikli Polietilen', 'kopikli-polietilen', '{"uz": "Ko''pikli Polietilen", "ru": "Вспененный полиэтилен", "en": "Foam Polyethylene"}'::jsonb, 40, CURRENT_TIMESTAMP),
('Ko''pikli PE Paketlar', 'kopikli-pe-paketlar', '{"uz": "Ko''pikli PE Paketlar", "ru": "Пакеты из вспененного ПЭ", "en": "PE Foam Bags"}'::jsonb, 41, CURRENT_TIMESTAMP),
('Iplar va Arqonlar', 'iplar-arqonlar', '{"uz": "Iplar va Arqonlar", "ru": "Нитки и веревки", "en": "Threads and Ropes"}'::jsonb, 42, CURRENT_TIMESTAMP)
ON CONFLICT ("slug") DO NOTHING;

UPDATE "Product" p SET "categoryId" = c."id" FROM "Category" c WHERE p."category" = c."slug" AND p."categoryId" IS NULL;

-- Xavfsizlik: yangi jadvallar ham faqat server (Prisma) orqali ishlaydi
ALTER TABLE "PromoCode" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Banner" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Review" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Post" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "FaqItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "Lead" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "SiteSetting" ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON "PromoCode", "Banner", "Review", "Post", "FaqItem", "Lead", "SiteSetting" FROM anon, authenticated;
  END IF;
END $$;
