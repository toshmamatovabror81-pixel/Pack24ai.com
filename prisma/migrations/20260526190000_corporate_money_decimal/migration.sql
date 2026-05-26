-- Corporate/B2B money fields: Float → Decimal(18,2)
ALTER TABLE "Contract" ALTER COLUMN "creditLimit" TYPE DECIMAL(18,2) USING "creditLimit"::numeric;
ALTER TABLE "Contract" ALTER COLUMN "creditLimit" SET DEFAULT 0;

ALTER TABLE "CorporateInvoice" ALTER COLUMN "subtotal" TYPE DECIMAL(18,2) USING "subtotal"::numeric;
ALTER TABLE "CorporateInvoice" ALTER COLUMN "vatAmount" TYPE DECIMAL(18,2) USING "vatAmount"::numeric;
ALTER TABLE "CorporateInvoice" ALTER COLUMN "totalAmount" TYPE DECIMAL(18,2) USING "totalAmount"::numeric;
ALTER TABLE "CorporateInvoice" ALTER COLUMN "paidAmount" TYPE DECIMAL(18,2) USING "paidAmount"::numeric;
ALTER TABLE "CorporateInvoice" ALTER COLUMN "paidAmount" SET DEFAULT 0;
