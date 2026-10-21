-- Constraints Prisma cannot express. Appended to the initial migration
-- (prisma migrate dev --create-only, then paste this at the end).

-- 1) No two ACTIVE occupancy rows for the same machine may overlap.
--    Ranges are half-open [start, end) so back-to-back blocks are allowed.
CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE "MachineOccupancy"
  ADD CONSTRAINT "MachineOccupancy_no_overlap"
  EXCLUDE USING gist (
    "machineId" WITH =,
    tstzrange("blockStart", "blockEnd", '[)') WITH &&
  ) WHERE ("active");

ALTER TABLE "MachineOccupancy"
  ADD CONSTRAINT "MachineOccupancy_valid_range" CHECK ("blockEnd" > "blockStart");

ALTER TABLE "Booking"
  ADD CONSTRAINT "Booking_valid_range" CHECK ("endsAt" > "startsAt");

-- 2) A customer needs at least one way to be reached.
ALTER TABLE "Customer"
  ADD CONSTRAINT "Customer_contact_required" CHECK ("email" IS NOT NULL OR "phone" IS NOT NULL);

-- 3) Captured deposit amounts need a note and cannot exceed the deposit.
ALTER TABLE "Deposit"
  ADD CONSTRAINT "Deposit_capture_note" CHECK ("capturedCents" = 0 OR "captureNote" IS NOT NULL),
  ADD CONSTRAINT "Deposit_capture_max" CHECK ("capturedCents" >= 0 AND "capturedCents" <= "amountCents");
