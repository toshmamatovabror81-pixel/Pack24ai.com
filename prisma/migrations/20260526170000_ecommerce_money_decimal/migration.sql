-- E-commerce money fields: Float → Decimal(18,2)
ALTER TABLE "Product" ALTER COLUMN "price" TYPE DECIMAL(18,2) USING "price"::numeric;
ALTER TABLE "Product" ALTER COLUMN "originalPrice" TYPE DECIMAL(18,2) USING "originalPrice"::numeric;

ALTER TABLE "Order" ALTER COLUMN "totalAmount" TYPE DECIMAL(18,2) USING "totalAmount"::numeric;
ALTER TABLE "Order" ALTER COLUMN "totalAmount" SET DEFAULT 0;

ALTER TABLE "OrderItem" ALTER COLUMN "price" TYPE DECIMAL(18,2) USING "price"::numeric;
