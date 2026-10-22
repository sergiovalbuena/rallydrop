/*
 * DRAFT RENTAL TERMS — NOT LEGAL ADVICE. Must be reviewed by a lawyer
 * licensed in British Columbia before launch.
 *
 * This is the starting text: the first time the app runs it is stored as
 * version DEFAULT_LEGAL_VERSION in the LegalDocument table, and from then on
 * the owner edits and publishes new versions in Admin → Legal. Amounts are
 * written in plain numbers on purpose (the customer accepts the exact text);
 * publish a new version whenever deposits, Care or the policies change.
 */

export const TERMS_TITLE = "Rental Terms";

export const TERMS_BODY = `## 1. About these terms

These Rental Terms are an agreement between you (the "renter") and RallyDrop ("we", "us"), a ball machine rental business in Victoria, British Columbia. They apply to every rental you book with us. By ticking the box at checkout you confirm you have read and agree to them, together with our Release of Liability, Waiver of Claims and Assumption of Risk ("the Waiver").

## 2. What we rent

- We rent tennis and pickleball ball machines and their accessories (battery, charger, ball bucket, the Spotter AI camera module where included, and any balls supplied).
- We only rent equipment. We do not provide a venue, coaching or supervision unless a separate lesson is booked.
- **You decide where to use the equipment** — at home, at your club or at a public court — and you are responsible for following the rules of that place, including posted court time limits, municipal court bookings and any rules about ball machines.

## 3. Booking and payment

- Prices are in Canadian dollars. Any taxes we are registered to charge are shown before you pay.
- The rental price, any drop-off or collection trips, RallyDrop Care and other extras are charged to your card when you book. Payments are processed by Stripe; we never see or store your full card number.
- A booking is confirmed when you receive a confirmation email or text with your booking code, and only after you have accepted these Rental Terms and the Waiver.
- Prices follow the season of your rental's start date (high season or off-season prices).

## 4. Drop-off, collection and self-serve

- You can collect and return the equipment at our downtown Victoria pick-up point at no charge, or pay for us to drop it off and/or collect it.
- Drop-off and collection happen at your address or in the parking lot or at the curb next to a court you choose from our list — never inside the court.
- Someone aged 19 or older must be present at drop-off and at collection. At the hand-off we show you how to use the machine and record its condition.
- For week and month rentals we check a government photo ID at hand-off.

## 5. Safe use

You agree to:

- Read the quick-start guide and follow the instructions we give you at hand-off.
- **Never stand or walk in front of the machine while it is running**, and switch it off before collecting balls, adjusting or moving it.
- Keep children, pets and bystanders well away from the machine's line of fire.
- **Not use the machine in the rain, on a wet court or in standing water**, and not leave it outside overnight or in the rain.
- Use only clean pressureless or regular tennis balls (or pickleballs when the machine is set up for pickleball). Do not use damaged, wet or dirty balls.
- **Not open, repair or modify the machine**, its battery or the Spotter module. If something jams or breaks, stop using it and contact us.
- Supervise any person under 19 who uses the machine.
- Keep the equipment secure and never leave it unattended in a public place.

## 6. Security deposit

- **Rentals of up to 6 days:** we place a temporary authorization ("hold") of 400 CAD on your card. It is not a charge. We release it when the equipment comes back in good condition.
- **Week and month rentals:** we save your card securely with Stripe for a deposit of up to 600 CAD instead of a hold, because card holds expire. Nothing is charged unless there is damage, loss or a late return.
- The deposit amount shown at checkout applies. It may be different if we change our prices; the amount shown when you book is the one that applies to your rental.

## 7. Damage, loss and theft

- You are responsible for the equipment from the moment it is handed to you (or dropped off) until it is returned to us (or collected).
- If the equipment is damaged, lost or stolen during your rental, you agree to pay the reasonable cost of repair or, if it can't be repaired or is not returned, its replacement value, less anything already charged from your deposit. Normal wear and tear is our responsibility.
- We inspect the equipment at return and record its condition with notes and photos. If we charge you for damage, we will tell you why in writing.
- Report theft to the police and to us within 24 hours.

## 8. RallyDrop Care

- RallyDrop Care is an optional add-on you can buy at checkout. It is not insurance.
- With Care, the most you pay for **accidental damage** during your rental is **100 CAD**.
- Care does **not** cover: theft, loss, use in the rain or on a wet court, or damage caused by gross negligence or deliberate misuse (for example, opening the machine or ignoring the safety instructions). In those cases section 7 applies in full.
- Care has no cash value and can't be refunded once your rental has started.

## 9. Late returns

- If you **don't return the equipment on time**, or **you are not available for collection at the agreed time**, we may charge one extra rental day at the current day price for each 24 hours (or part of 24 hours) the equipment is late, plus any extra trip needed to collect it.
- If a late return prevents the next customer's rental, we may also charge reasonable costs we incur because of it.
- Please tell us as early as possible if you're running late.

## 10. Cancellations and changes

- Cancel **more than 48 hours** before your rental starts for a **full refund**.
- Cancel **within 48 hours** of the start for a **50% refund**.
- **No refund** once the rental has started.
- You can cancel or reschedule from "My bookings". Rescheduling is free when the new time is available.

## 11. Rain

This is Victoria, so rain happens. If it rains on the day your rental starts and you tell us before your start or drop-off time (or we declare a rain day), you can reschedule for free or take a credit for 100% of what you paid, valid for 6 months.

## 12. Privacy and the AI camera

- We collect the contact details you give us to manage your booking, as described in our Privacy Policy.
- The Spotter AI camera records video to analyse your play. Recordings are processed by the PONGBOT app on your own phone or tablet; **RallyDrop does not access or store those recordings**. Please read PONGBOT's own privacy policy, and get permission before filming other people.

## 13. Limitation of liability

To the extent permitted by the law of British Columbia, our total liability to you for any claim related to a rental is limited to the amount you paid for that rental. Nothing in these terms limits liability that can't be limited by law. The Waiver also applies.

## 14. General

- These terms are governed by the laws of British Columbia and the federal laws of Canada that apply there. Courts in British Columbia have jurisdiction.
- If any part of these terms is found unenforceable, the rest still applies.
- We may update these terms for future bookings. The version you accepted for a booking is the one that applies to it.
`;
