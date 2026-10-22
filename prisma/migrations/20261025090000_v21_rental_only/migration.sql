-- RallyDrop only rents the machine: remove group sessions and their data
-- before the enum values they use go away.
DELETE FROM "MachineOccupancy" WHERE "source" = 'GROUP_SESSION';
DELETE FROM "Payment" WHERE "kind" = 'GROUP_SESSION';
UPDATE "PromoCode" SET "productKinds" = array_remove("productKinds", 'GROUP_SESSION');
DELETE FROM "Product" WHERE "kind" = 'GROUP_SESSION' AND NOT EXISTS (SELECT 1 FROM "Booking" b WHERE b."productId" = "Product"."id");

-- CreateEnum
CREATE TYPE "SpringPassStatus" AS ENUM ('PENDING_PAYMENT', 'ACTIVE', 'CANCELLED');

-- AlterEnum
BEGIN;
CREATE TYPE "OccupancySource_new" AS ENUM ('BOOKING', 'BLACKOUT');
ALTER TABLE "MachineOccupancy" ALTER COLUMN "source" TYPE "OccupancySource_new" USING ("source"::text::"OccupancySource_new");
ALTER TYPE "OccupancySource" RENAME TO "OccupancySource_old";
ALTER TYPE "OccupancySource_new" RENAME TO "OccupancySource";
DROP TYPE "public"."OccupancySource_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "PaymentKind_new" AS ENUM ('RENTAL', 'DEPOSIT_CAPTURE', 'SUBSCRIPTION_INVOICE', 'SPRING_PASS', 'MANUAL');
ALTER TABLE "Payment" ALTER COLUMN "kind" TYPE "PaymentKind_new" USING ("kind"::text::"PaymentKind_new");
ALTER TYPE "PaymentKind" RENAME TO "PaymentKind_old";
ALTER TYPE "PaymentKind_new" RENAME TO "PaymentKind";
DROP TYPE "public"."PaymentKind_old";
COMMIT;

-- AlterEnum
BEGIN;
CREATE TYPE "ProductKind_new" AS ENUM ('DAY', 'WEEKEND', 'WEEK', 'MONTH', 'PACKAGE');
ALTER TABLE "Product" ALTER COLUMN "kind" TYPE "ProductKind_new" USING ("kind"::text::"ProductKind_new");
ALTER TABLE "PromoCode" ALTER COLUMN "productKinds" TYPE "ProductKind_new"[] USING ("productKinds"::text::"ProductKind_new"[]);
ALTER TYPE "ProductKind" RENAME TO "ProductKind_old";
ALTER TYPE "ProductKind_new" RENAME TO "ProductKind";
DROP TYPE "public"."ProductKind_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "GroupEnrollment" DROP CONSTRAINT "GroupEnrollment_customerId_fkey";

-- DropForeignKey
ALTER TABLE "GroupEnrollment" DROP CONSTRAINT "GroupEnrollment_groupSessionId_fkey";

-- DropForeignKey
ALTER TABLE "GroupSession" DROP CONSTRAINT "GroupSession_courtId_fkey";

-- DropForeignKey
ALTER TABLE "GroupSession" DROP CONSTRAINT "GroupSession_machineId_fkey";

-- DropForeignKey
ALTER TABLE "MachineOccupancy" DROP CONSTRAINT "MachineOccupancy_groupSessionId_fkey";

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_enrollmentId_fkey";

-- DropIndex
DROP INDEX "MachineOccupancy_groupSessionId_key";

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "springPassId" TEXT;

-- AlterTable
ALTER TABLE "MachineOccupancy" DROP COLUMN "groupSessionId";

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "enrollmentId",
ADD COLUMN     "springPassId" TEXT;

-- AlterTable
ALTER TABLE "Product" DROP COLUMN "groupCapacity";

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "courtBookingUrl" TEXT,
ADD COLUMN     "pickleballEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "springPassEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "springPassEnd" TEXT NOT NULL DEFAULT '06-30',
ADD COLUMN     "springPassLimit" INTEGER NOT NULL DEFAULT 20,
ADD COLUMN     "springPassPriceCents" INTEGER NOT NULL DEFAULT 19900,
ADD COLUMN     "springPassStart" TEXT NOT NULL DEFAULT '04-01',
ADD COLUMN     "springPassWeekends" INTEGER NOT NULL DEFAULT 3;

-- AlterTable
ALTER TABLE "WaitlistSignup" ALTER COLUMN "machineId" DROP NOT NULL;

-- DropTable
DROP TABLE "GroupEnrollment";

-- DropTable
DROP TABLE "GroupSession";

-- DropEnum
DROP TYPE "EnrollmentStatus";

-- DropEnum
DROP TYPE "GroupSessionStatus";

-- CreateTable
CREATE TABLE "SpringPass" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" "SpringPassStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "weekends" INTEGER NOT NULL,
    "priceCents" INTEGER NOT NULL,
    "validFrom" DATE NOT NULL,
    "validTo" DATE NOT NULL,
    "stripePaymentIntentId" TEXT,
    "stripePaymentMethodId" TEXT,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SpringPass_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SpringPass_stripePaymentIntentId_key" ON "SpringPass"("stripePaymentIntentId");

-- CreateIndex
CREATE INDEX "SpringPass_status_createdAt_idx" ON "SpringPass"("status", "createdAt");

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_springPassId_fkey" FOREIGN KEY ("springPassId") REFERENCES "SpringPass"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_springPassId_fkey" FOREIGN KEY ("springPassId") REFERENCES "SpringPass"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SpringPass" ADD CONSTRAINT "SpringPass_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

