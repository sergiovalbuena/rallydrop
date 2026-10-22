-- CreateEnum
CREATE TYPE "CreditReason" AS ENUM ('RAIN', 'GOODWILL');

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "creditCents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "packageRollover" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "rainCreditMonths" INTEGER NOT NULL DEFAULT 6;

-- CreateTable
CREATE TABLE "CustomerCredit" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "reason" "CreditReason" NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "remainingCents" INTEGER NOT NULL,
    "expiresAt" TIMESTAMPTZ NOT NULL,
    "sourceBookingId" TEXT,
    "note" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerCredit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CreditUse" (
    "id" TEXT NOT NULL,
    "creditId" TEXT NOT NULL,
    "bookingId" TEXT NOT NULL,
    "amountCents" INTEGER NOT NULL,
    "restoredCents" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CreditUse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RainDay" (
    "id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "note" TEXT,
    "notifiedCount" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RainDay_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerCredit_customerId_expiresAt_idx" ON "CustomerCredit"("customerId", "expiresAt");

-- CreateIndex
CREATE INDEX "CreditUse_bookingId_idx" ON "CreditUse"("bookingId");

-- CreateIndex
CREATE UNIQUE INDEX "RainDay_date_key" ON "RainDay"("date");

-- AddForeignKey
ALTER TABLE "CustomerCredit" ADD CONSTRAINT "CustomerCredit_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditUse" ADD CONSTRAINT "CreditUse_creditId_fkey" FOREIGN KEY ("creditId") REFERENCES "CustomerCredit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CreditUse" ADD CONSTRAINT "CreditUse_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- A credit can never go negative or above what was issued.
ALTER TABLE "CustomerCredit" ADD CONSTRAINT "CustomerCredit_remaining_check"
  CHECK ("remainingCents" >= 0 AND "remainingCents" <= "amountCents");

-- Packages: $49 / $89 a month, self-serve downtown (delivery is paid per session).
UPDATE "Product" SET "priceCents" = 4900,
  "description" = '4 sessions of 1.5 h per month. Pick up and return downtown, or add delivery to your court per session.'
  WHERE "slug" = 'package-basic';
UPDATE "Product" SET "priceCents" = 8900,
  "description" = '8 sessions of 1.5 h per month. Pick up and return downtown, or add delivery to your court per session.'
  WHERE "slug" = 'package-frequent';
