-- CreateTable
CREATE TABLE "PaymeTransaction" (
    "id" TEXT NOT NULL,
    "orderId" INTEGER NOT NULL,
    "amount" INTEGER NOT NULL,
    "state" INTEGER NOT NULL DEFAULT 1,
    "createTime" BIGINT NOT NULL,
    "performTime" BIGINT,
    "cancelTime" BIGINT,
    "reason" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PaymeTransaction_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PaymeTransaction_orderId_idx" ON "PaymeTransaction"("orderId");

-- AddForeignKey
ALTER TABLE "PaymeTransaction" ADD CONSTRAINT "PaymeTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
