-- CreateEnum
CREATE TYPE "IdentityCheck" AS ENUM ('MANUAL', 'STRIPE_IDENTITY');

-- CreateEnum
CREATE TYPE "LegalKind" AS ENUM ('TERMS', 'WAIVER');

-- CreateEnum
CREATE TYPE "CareExclusion" AS ENUM ('THEFT', 'LOSS', 'RAIN', 'GROSS_NEGLIGENCE');

-- Balls are now included in every rental; the add-on becomes an optional extra bucket.
ALTER TYPE "AddOnKind" RENAME VALUE 'BALLS' TO 'EXTRA_BALLS';
UPDATE "AddOn" SET "name" = 'Extra bucket (+50 balls)', "priceCents" = 800,
  "description" = '50 more pressureless balls on top of the ones included.' WHERE "kind" = 'EXTRA_BALLS';

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "care" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "careCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "offSeason" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "Deposit" ADD COLUMN     "careExclusion" "CareExclusion";

-- AlterTable
ALTER TABLE "Inspection" ADD COLUMN     "batteryOk" BOOLEAN,
ADD COLUMN     "chargerOk" BOOLEAN,
ADD COLUMN     "idVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "licenceLast4" TEXT,
ADD COLUMN     "machineOk" BOOLEAN,
ADD COLUMN     "spotterOk" BOOLEAN;

-- AlterTable
ALTER TABLE "Machine" ADD COLUMN     "depositLongCents" INTEGER NOT NULL DEFAULT 60000,
ADD COLUMN     "isPublic" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "purchaseCostCents" INTEGER,
ALTER COLUMN "depositCents" SET DEFAULT 40000;

-- AlterTable
ALTER TABLE "Product" ADD COLUMN     "offSeasonPriceCents" INTEGER;

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "businessLicenceMunicipality" TEXT,
ADD COLUMN     "businessLicenceNumber" TEXT,
ADD COLUMN     "careCapCents" INTEGER NOT NULL DEFAULT 10000,
ADD COLUMN     "careEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "careMonthCents" INTEGER NOT NULL DEFAULT 2500,
ADD COLUMN     "careShortCents" INTEGER NOT NULL DEFAULT 800,
ADD COLUMN     "careWeekCents" INTEGER NOT NULL DEFAULT 1500,
ADD COLUMN     "chargeGst" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "chargePst" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "gstNumber" TEXT,
ADD COLUMN     "highSeasonMonthCap" INTEGER DEFAULT 1,
ADD COLUMN     "hubAddress" TEXT,
ADD COLUMN     "identityCheck" "IdentityCheck" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN     "instagramUrl" TEXT,
ADD COLUMN     "insuranceCoverageCents" INTEGER,
ADD COLUMN     "insurancePolicyNumber" TEXT,
ADD COLUMN     "insuranceProvider" TEXT,
ADD COLUMN     "pstNumber" TEXT,
ADD COLUMN     "seasonEnd" TEXT NOT NULL DEFAULT '09-30',
ADD COLUMN     "seasonStart" TEXT NOT NULL DEFAULT '04-01',
ADD COLUMN     "siteDomain" TEXT;

-- Months → inclusive MM-DD dates, then drop the old columns.
UPDATE "Settings" SET
  "seasonStart" = lpad("seasonStartMonth"::text, 2, '0') || '-01',
  "seasonEnd" = to_char((make_date(2026, "seasonEndMonth", 1) + interval '1 month' - interval '1 day'), 'MM-DD');
ALTER TABLE "Settings" DROP COLUMN "seasonEndMonth", DROP COLUMN "seasonStartMonth";

-- CreateTable
CREATE TABLE "LegalDocument" (
    "id" TEXT NOT NULL,
    "kind" "LegalKind" NOT NULL,
    "version" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "draft" BOOLEAN NOT NULL DEFAULT true,
    "publishedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LegalDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaiverAcceptance" (
    "id" TEXT NOT NULL,
    "bookingId" TEXT,
    "customerId" TEXT,
    "name" TEXT NOT NULL,
    "contact" TEXT NOT NULL,
    "termsId" TEXT NOT NULL,
    "waiverId" TEXT NOT NULL,
    "termsVersion" TEXT NOT NULL,
    "termsSha256" TEXT NOT NULL,
    "waiverVersion" TEXT NOT NULL,
    "waiverSha256" TEXT NOT NULL,
    "checkboxes" JSONB NOT NULL,
    "method" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "acceptedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "acceptedAtLocal" TEXT NOT NULL,

    CONSTRAINT "WaiverAcceptance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Review" (
    "id" TEXT NOT NULL,
    "customerName" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "rating" INTEGER NOT NULL DEFAULT 5,
    "reviewedOn" DATE NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Review_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LegalDocument_kind_publishedAt_idx" ON "LegalDocument"("kind", "publishedAt");

-- CreateIndex
CREATE UNIQUE INDEX "LegalDocument_kind_version_key" ON "LegalDocument"("kind", "version");

-- CreateIndex
CREATE INDEX "WaiverAcceptance_bookingId_idx" ON "WaiverAcceptance"("bookingId");

-- CreateIndex
CREATE INDEX "WaiverAcceptance_customerId_acceptedAt_idx" ON "WaiverAcceptance"("customerId", "acceptedAt");

-- AddForeignKey
ALTER TABLE "WaiverAcceptance" ADD CONSTRAINT "WaiverAcceptance_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaiverAcceptance" ADD CONSTRAINT "WaiverAcceptance_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaiverAcceptance" ADD CONSTRAINT "WaiverAcceptance_termsId_fkey" FOREIGN KEY ("termsId") REFERENCES "LegalDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaiverAcceptance" ADD CONSTRAINT "WaiverAcceptance_waiverId_fkey" FOREIGN KEY ("waiverId") REFERENCES "LegalDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- v2 launch values (only rows still on the old defaults are touched).
UPDATE "Machine" SET "depositCents" = 40000 WHERE "depositCents" = 30000;
UPDATE "Machine" SET "isPublic" = false WHERE "slug" = 'pongbot-pace-s';
UPDATE "Product" SET "priceCents" = 5000, "offSeasonPriceCents" = 4500 WHERE "slug" = 'day';
UPDATE "Product" SET "priceCents" = 8500, "offSeasonPriceCents" = 7500 WHERE "slug" = 'weekend';
UPDATE "Product" SET "priceCents" = 16000, "offSeasonPriceCents" = 14000 WHERE "slug" = 'week';
UPDATE "Product" SET "priceCents" = 42000, "offSeasonPriceCents" = 30000 WHERE "slug" = 'month';
