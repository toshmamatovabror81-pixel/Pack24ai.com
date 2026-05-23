-- AlterTable: Driver.acceptedMaterials (Yandex Pro uslubidagi tariflar)
ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "acceptedMaterials" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
