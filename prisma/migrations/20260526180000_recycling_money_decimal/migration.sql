-- Recycling money fields: Float → Decimal(18,2)
ALTER TABLE "RecyclePoint" ALTER COLUMN "pricePerKg" TYPE DECIMAL(18,2) USING "pricePerKg"::numeric;
ALTER TABLE "RecyclePoint" ALTER COLUMN "pricePerKg" SET DEFAULT 800;
ALTER TABLE "RecyclePoint" ALTER COLUMN "driverRatePerKg" TYPE DECIMAL(18,2) USING "driverRatePerKg"::numeric;
ALTER TABLE "RecyclePoint" ALTER COLUMN "driverRatePerKg" SET DEFAULT 100;

ALTER TABLE "DriverTransaction" ALTER COLUMN "amount" TYPE DECIMAL(18,2) USING "amount"::numeric;

ALTER TABLE "RecycleCollection" ALTER COLUMN "pricePerKg" TYPE DECIMAL(18,2) USING "pricePerKg"::numeric;
ALTER TABLE "RecycleCollection" ALTER COLUMN "totalAmount" TYPE DECIMAL(18,2) USING "totalAmount"::numeric;
ALTER TABLE "RecycleCollection" ALTER COLUMN "paymentToDriver" TYPE DECIMAL(18,2) USING "paymentToDriver"::numeric;
ALTER TABLE "RecycleCollection" ALTER COLUMN "paymentToCustomer" TYPE DECIMAL(18,2) USING "paymentToCustomer"::numeric;

ALTER TABLE "RecycleManualIntake" ALTER COLUMN "pricePerKg" TYPE DECIMAL(18,2) USING "pricePerKg"::numeric;
ALTER TABLE "RecycleManualIntake" ALTER COLUMN "totalAmount" TYPE DECIMAL(18,2) USING "totalAmount"::numeric;

ALTER TABLE "RecycleExpenseLog" ALTER COLUMN "expenseAmount" TYPE DECIMAL(18,2) USING "expenseAmount"::numeric;
ALTER TABLE "RecycleExpenseLog" ALTER COLUMN "expenseAmount" SET DEFAULT 0;
ALTER TABLE "RecycleExpenseLog" ALTER COLUMN "advanceAmount" TYPE DECIMAL(18,2) USING "advanceAmount"::numeric;
ALTER TABLE "RecycleExpenseLog" ALTER COLUMN "advanceAmount" SET DEFAULT 0;

ALTER TABLE "RecycleDailyCash" ALTER COLUMN "openingBalance" TYPE DECIMAL(18,2) USING "openingBalance"::numeric;

ALTER TABLE "RecycleSalesLog" ALTER COLUMN "pricePerKg" TYPE DECIMAL(18,2) USING "pricePerKg"::numeric;
ALTER TABLE "RecycleSalesLog" ALTER COLUMN "totalAmount" TYPE DECIMAL(18,2) USING "totalAmount"::numeric;
