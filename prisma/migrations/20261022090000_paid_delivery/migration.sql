-- Delivery is no longer an add-on: it's priced per trip by zone (Settings.deliveryZones)
-- and snapshotted on the booking. Move old delivery add-on lines onto the booking.
ALTER TABLE "Booking" ADD COLUMN     "collection" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "deliveryFeeCents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "deliveryKm" DECIMAL(5,2),
ADD COLUMN     "deliveryZone" INTEGER,
ADD COLUMN     "dropoff" BOOLEAN NOT NULL DEFAULT false;

-- Bookings made before this change: delivered bookings were round trips.
UPDATE "Booking" SET "dropoff" = true, "collection" = true WHERE "fulfillment" <> 'PICKUP';
UPDATE "Booking" b SET "deliveryFeeCents" = ba."priceCents"
FROM "BookingAddOn" ba JOIN "AddOn" a ON a."id" = ba."addOnId"
WHERE ba."bookingId" = b."id" AND a."kind" = 'DELIVERY';
DELETE FROM "BookingAddOn" ba USING "AddOn" a WHERE a."id" = ba."addOnId" AND a."kind" = 'DELIVERY';
DELETE FROM "AddOn" WHERE "kind" = 'DELIVERY';

-- AlterEnum
BEGIN;
CREATE TYPE "AddOnKind_new" AS ENUM ('BALLS');
ALTER TABLE "AddOn" ALTER COLUMN "kind" TYPE "AddOnKind_new" USING ("kind"::text::"AddOnKind_new");
ALTER TYPE "AddOnKind" RENAME TO "AddOnKind_old";
ALTER TYPE "AddOnKind_new" RENAME TO "AddOnKind";
DROP TYPE "public"."AddOnKind_old";
COMMIT;

-- The free-delivery centre becomes the delivery hub; the free radius is replaced by zones.
ALTER TABLE "Settings" RENAME COLUMN "freeDeliveryCenterLat" TO "deliveryHubLat";
ALTER TABLE "Settings" RENAME COLUMN "freeDeliveryCenterLng" TO "deliveryHubLng";
ALTER TABLE "Settings" DROP COLUMN "freeDeliveryRadiusKm",
ADD COLUMN     "deliveryZones" JSONB NOT NULL DEFAULT '[{"maxKm":5,"tripCents":1500,"roundTripCents":2500},{"maxKm":12,"tripCents":2500,"roundTripCents":4000},{"maxKm":20,"tripCents":3500,"roundTripCents":6000}]';
