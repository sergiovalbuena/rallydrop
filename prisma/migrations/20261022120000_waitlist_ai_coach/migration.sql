-- AlterTable
ALTER TABLE "Machine" ADD COLUMN     "aiCoach" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "WaitlistSignup" (
    "id" TEXT NOT NULL,
    "machineId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "source" TEXT,
    "consent" TEXT NOT NULL,
    "notifiedAt" TIMESTAMPTZ,
    "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaitlistSignup_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WaitlistSignup_machineId_createdAt_idx" ON "WaitlistSignup"("machineId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WaitlistSignup_machineId_email_key" ON "WaitlistSignup"("machineId", "email");

-- AddForeignKey
ALTER TABLE "WaitlistSignup" ADD CONSTRAINT "WaitlistSignup_machineId_fkey" FOREIGN KEY ("machineId") REFERENCES "Machine"("id") ON DELETE CASCADE ON UPDATE CASCADE;

