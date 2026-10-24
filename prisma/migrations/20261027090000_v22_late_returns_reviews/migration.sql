-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "reviewRequestedAt" TIMESTAMPTZ;

-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "bookingId" TEXT;

-- AlterTable
ALTER TABLE "Settings" ADD COLUMN     "lateGraceMinutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "lateHourlyCents" INTEGER NOT NULL DEFAULT 1500,
ADD COLUMN     "lateUnreturnedHours" INTEGER NOT NULL DEFAULT 24;

-- CreateIndex
CREATE UNIQUE INDEX "Review_bookingId_key" ON "Review"("bookingId");

