-- B2B bosqichi: yuridik shaxs rekvizitlari, shartnomasiz hisob-faktura, buyurtma/arizaga bog'langan ishlab chiqarish
-- DropForeignKey
ALTER TABLE "Contract" DROP CONSTRAINT "Contract_userId_fkey";

-- DropForeignKey
ALTER TABLE "CorporateInvoice" DROP CONSTRAINT "CorporateInvoice_contractId_fkey";

-- AlterTable
ALTER TABLE "Contract" ADD COLUMN     "address" TEXT,
ADD COLUMN     "phone" TEXT,
ALTER COLUMN "userId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "CorporateInvoice" ALTER COLUMN "contractId" DROP NOT NULL;

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "companyInn" TEXT,
ADD COLUMN     "companyName" TEXT;

-- AlterTable
ALTER TABLE "WorkOrder" ADD COLUMN     "customerPhone" TEXT,
ADD COLUMN     "leadId" INTEGER,
ADD COLUMN     "notes" TEXT,
ADD COLUMN     "orderId" INTEGER;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkOrder" ADD CONSTRAINT "WorkOrder_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "Lead"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Contract" ADD CONSTRAINT "Contract_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CorporateInvoice" ADD CONSTRAINT "CorporateInvoice_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- CreateIndex
CREATE INDEX "WorkOrder_orderId_idx" ON "WorkOrder"("orderId");
CREATE INDEX "WorkOrder_leadId_idx" ON "WorkOrder"("leadId");
CREATE INDEX "WorkOrder_status_deadline_idx" ON "WorkOrder"("status", "deadline");
