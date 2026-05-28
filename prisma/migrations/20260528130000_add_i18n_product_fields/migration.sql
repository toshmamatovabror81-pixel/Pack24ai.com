-- AlterTable: Product modeliga i18n maydonlarini qo'shish
ALTER TABLE "Product" ADD COLUMN "nameI18n" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "Product" ADD COLUMN "descriptionI18n" JSONB NOT NULL DEFAULT '{}';
