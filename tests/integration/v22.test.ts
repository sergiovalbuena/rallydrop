import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { setStripeClient } from "@/lib/stripe";
import { createBooking } from "@/lib/services/bookings";
import { DEFAULT_LEGAL_VERSIONS, currentLegal } from "@/lib/services/legal";
import { handleRentalSucceeded, setBookingStatus, startRentalPayment } from "@/lib/services/payments";
import { reviewTarget, runReviewRequests, submitReview } from "@/lib/services/review-requests";
import { REVIEW, signedId } from "@/lib/services/links";
import { localDateMinuteToUtc } from "@/lib/time";
import { createFakeStripe } from "../helpers/fake-stripe";
import { acceptTerms, hasTestDb, resetDb, seedCatalog } from "../helpers/fixtures";

const HOUR = 3_600_000;

describe.skipIf(!hasTestDb)("v2.2", () => {
  let catalog: Awaited<ReturnType<typeof seedCatalog>>;
  let fake: ReturnType<typeof createFakeStripe>;

  beforeEach(async () => {
    await resetDb();
    catalog = await seedCatalog();
    fake = createFakeStripe({ declineOffSession: false });
    setStripeClient(fake.client);
  });
  afterEach(() => setStripeClient(null));

  /** A paid week rental (saved-card deposit, so it can go out right away). */
  async function rentedAndReturned() {
    const booking = await createBooking({
      productId: catalog.week.id,
      machineId: catalog.aura.id,
      startsAt: localDateMinuteToUtc("2027-03-10", 600),
      customer: { name: "Robin Lee Smith", email: "robin@example.com" },
      fulfillment: "PICKUP",
      channel: "ONLINE",
      skipSlotRules: true,
      now: localDateMinuteToUtc("2027-03-01", 600),
    });
    await startRentalPayment(booking.id);
    await acceptTerms(booking.id);
    const payment = await db.payment.findFirstOrThrow({ where: { bookingId: booking.id } });
    const pi = fake.succeed(payment.stripePaymentIntentId!);
    await handleRentalSucceeded(pi as unknown as Parameters<typeof handleRentalSucceeded>[0], { offSession: false });
    await setBookingStatus(booking.id, "CHECKED_OUT", "admin:test");
    await setBookingStatus(booking.id, "RETURNED_OK", "admin:test");
    return booking;
  }

  describe("review requests", () => {
    it("emails once, 24 h after the machine came back OK", async () => {
      const b = await rentedAndReturned();
      expect((await db.deposit.findUniqueOrThrow({ where: { bookingId: b.id } })).status).toBe("RELEASED");

      expect(await runReviewRequests(new Date(Date.now() + 23 * HOUR))).toEqual({ reviewRequests: 0 });
      expect(await runReviewRequests(new Date(Date.now() + 25 * HOUR))).toEqual({ reviewRequests: 1 });
      expect(await runReviewRequests(new Date(Date.now() + 26 * HOUR))).toEqual({ reviewRequests: 0 });
      expect(await db.notificationLog.count({ where: { template: "review_request" } })).toBe(1);
    });

    it("never asks about rentals returned long ago", async () => {
      await rentedAndReturned();
      expect(await runReviewRequests(new Date(Date.now() + 20 * 24 * HOUR))).toEqual({ reviewRequests: 0 });
    });

    it("the link saves one hidden review with a short name", async () => {
      const b = await rentedAndReturned();
      const token = signedId(REVIEW, b.id);
      expect(await submitReview(token, { rating: 5, text: "Great machine!" })).toEqual({ ok: true });
      expect(await submitReview(token, { rating: 1, text: "Second try" })).toEqual({ ok: true });
      const reviews = await db.review.findMany();
      expect(reviews).toHaveLength(1);
      expect(reviews[0]).toMatchObject({ bookingId: b.id, rating: 5, customerName: "Robin S.", published: false });
      expect((await reviewTarget(token))?.done).toBe(true);
    });

    it("rejects forged links and bookings that aren't returned", async () => {
      const b = await rentedAndReturned();
      expect(await reviewTarget(`${b.id}.forged`)).toBeNull();
      await db.booking.update({ where: { id: b.id }, data: { status: "CONFIRMED" } });
      expect(await reviewTarget(signedId(REVIEW, b.id))).toBeNull();
    });
  });

  describe("legal", () => {
    it("publishes the terms version that ships in the code", async () => {
      const live = await currentLegal();
      expect(live.terms.version).toBe(DEFAULT_LEGAL_VERSIONS.TERMS);
      expect(live.terms.body).toMatch(/19/);
      expect(live.terms.body).toMatch(/late/i);
      expect(live.terms.body).not.toMatch(/placeholder/i);
    });
  });
});
