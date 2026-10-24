/*
 * DRAFT RENTAL TERMS — NOT LEGAL ADVICE. Must be reviewed by a lawyer
 * licensed in British Columbia before launch.
 *
 * This is the starting text: the first time the app runs it is stored as
 * version DEFAULT_LEGAL_VERSIONS.TERMS in the LegalDocument table, and from then on
 * the owner edits and publishes new versions in Admin → Legal. Amounts are
 * written in plain numbers on purpose (the customer accepts the exact text);
 * publish a new version whenever deposits, Care, late fees or the policies
 * change. Bumping DEFAULT_LEGAL_VERSIONS.TERMS (lib/services/legal.ts)
 * publishes this text once on the next deploy.
 */

export const TERMS_TITLE = "Rental Terms";

export const TERMS_BODY = `## 1. About these terms

These Rental Terms are an agreement between you (the "renter") and RallyDrop ("we", "us"), a ball machine rental business in Victoria, British Columbia. They apply to every rental you book with us. By ticking the boxes at checkout you confirm that you have read and agree to them, together with our Release of Liability, Waiver of Claims and Assumption of Risk ("the Waiver"), and that you are 19 or older.

## 2. What we rent — and what we don't

- **RallyDrop only rents equipment**: a PONGBOT ball machine and its accessories (battery, charger, ball bucket, the Spotter AI camera module and the balls supplied).
- We do not provide a venue, lessons, coaching or supervision. The AI coach built into the machine is a practice assistant, not a coach.
- **You decide where to use the equipment** — at home, at your club or at a public court — and you are responsible for the rules of that place, including posted court time limits, court bookings and whether ball machines are allowed.

## 3. Who can rent

- You must be **19 or older** (the age of majority in British Columbia).
- A parent or guardian may rent for a minor who uses the machine under their supervision.
- **You are responsible for anyone who uses the machine during your rental**, and for making sure they follow these terms and the safety instructions.

## 4. Booking and payment

- Prices are in Canadian dollars. Any taxes we are registered to charge are shown before you pay.
- The rental, any drop-off or collection trips, RallyDrop Care and other extras are charged to your card when you book. Payments are processed by Stripe; we never see or store your full card number.
- Prices follow the season of your rental's start date (high season or off-season prices).
- A booking is confirmed when you receive a confirmation with your booking code, and only after you have accepted these terms and the Waiver.

## 5. Drop-off, collection and self-serve

- You can collect and return the equipment at our downtown pick-up point at no charge, or pay for us to drop it off and/or collect it.
- Drop-off and collection happen at your door (home or club) or in the parking lot or at the curb next to a court you choose — never on the court itself.
- Someone aged 19 or older must be present at drop-off and collection. We show you how the machine works and record its condition.
- For week and month rentals we check a government photo ID at hand-off.

## 6. Safe use

You agree to:

- Read the quick-start guide and follow the instructions we give you.
- **Never stand or walk in front of the machine while it is running**, and switch it off before collecting balls, adjusting or moving it.
- Keep children, pets and bystanders out of the machine's line of fire.
- **Not use the machine in the rain, on a wet court or in standing water**, and not leave it outside overnight or in the rain.
- Use only clean, dry balls in good condition.
- **Not open, repair or modify the machine**, its battery or the Spotter module. If something jams or breaks, stop and contact us.
- Keep the equipment secure and never leave it unattended in a public place.

## 7. Security deposit

- The deposit is **held on your card — only charged for damage, loss or a late return**.
- **Day and weekend rentals:** we place a temporary authorization ("hold") of 400 CAD on your card **24 hours before your rental starts** (or at checkout if it starts sooner). It is not a charge, and we release it when the equipment is back in good condition.
- **Week and month rentals:** card holds expire too soon, so we keep your card saved securely with Stripe for up to 600 CAD instead. There is no hold and nothing is charged unless there is damage, loss or a late return.
- If the hold can't be placed (for example, the card is declined or expired), we ask you to update your card and we don't hand over the equipment until the deposit is in place.

## 8. Damage, loss and theft

- You are responsible for the equipment from the moment it is handed to you (or dropped off) until it is returned to us (or collected).
- **Your responsibility goes up to the equipment's replacement value.** If it is damaged, lost or stolen, you agree to pay the reasonable cost of repair or, if it can't be repaired or isn't returned, its replacement value. **The deposit does not limit this amount**: we may charge the deposit and ask you to pay any difference.
- Normal wear and tear is our responsibility.
- We inspect the equipment at return and record its condition with notes and photos. If we charge you, we tell you why in writing.
- Report theft to the police and to us within 24 hours.

## 9. RallyDrop Care

- RallyDrop Care is an optional add-on you can buy at checkout. It is not insurance.
- **With Care, the most you pay for accidental damage during your rental is 100 CAD.**
- Care does not cover theft, loss, use in the rain or on a wet court, or damage caused by gross negligence or deliberate misuse (for example, opening the machine or ignoring the safety instructions). In those cases section 8 applies in full.
- Care can't be refunded once your rental has started.

## 10. Late returns

- There is a **30-minute grace period** after your rental ends (or after the agreed collection time).
- After that we charge **15 CAD per hour late, up to the price of one rental day**, plus any extra trip needed to collect the equipment.
- If we hear nothing from you for **24 hours** after your rental ends, the equipment is considered not returned: we may charge the deposit and section 8 applies.
- Please tell us as early as possible if you're running late.

## 11. Cancellations and changes

- Cancel **48 hours or more** before your rental starts for a **full refund**.
- Cancel **less than 48 hours** before the start for a **50% refund**.
- **No refund** once the rental has started.
- You can cancel or reschedule from "My bookings". Rescheduling is free when the new time is available.

## 12. Rain

This is Victoria, so rain happens. If it rains on the day your rental starts and you tell us before your start time (or we declare a rain day), you can reschedule for free or take a credit for 100% of what you paid, valid for 6 months and applied automatically to your next booking.

## 13. Privacy and the Spotter AI camera

- We collect the contact details you give us to manage your booking, as described in our Privacy Policy.
- The Spotter camera records video and movement data to analyse your play. It is processed by the PONGBOT app on your own phone or tablet; **RallyDrop does not access or store those recordings**. PONGBOT's own privacy policy applies to the app. Please get permission before filming other people.

## 14. Limitation of liability

To the extent permitted by the law of British Columbia, our total liability to you for any claim related to a rental is limited to the amount you paid for that rental. Nothing in these terms limits liability that can't be limited by law. The Waiver also applies.

## 15. General

- These terms are governed by the laws of British Columbia and the federal laws of Canada that apply there. Courts in British Columbia have jurisdiction.
- If any part of these terms is found unenforceable, the rest still applies.
- We may update these terms for future bookings. The version you accepted for a booking is the one that applies to it.
`;
