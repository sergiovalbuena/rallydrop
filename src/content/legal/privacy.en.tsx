/*
 * PLACEHOLDER PRIVACY POLICY — NOT LEGAL ADVICE.
 * Must be reviewed for compliance with BC PIPA and federal PIPEDA before launch.
 */
import { brand } from "@/config/brand";

export const privacyUpdated = "October 2026";

export function PrivacyEn() {
  return (
    <>
      <h2>What we collect</h2>
      <ul>
        <li>Contact details you give us: name, email and/or phone number, delivery address or court.</li>
        <li>Booking details: dates, equipment, add-ons, notes, and your optional playing level.</li>
        <li>
          Payment information is collected and stored by Stripe. We only receive a reference to your payment, the card
          brand and last four digits.
        </li>
        <li>Photos of the equipment taken at drop-off and return.</li>
      </ul>

      <h2>Why we use it</h2>
      <ul>
        <li>To deliver, manage and support your rentals and packages.</li>
        <li>
          To send booking confirmations, reminders and receipts by email and, if you provide a phone number, by SMS.
        </li>
        <li>To process payments, refunds and deposits.</li>
        <li>To meet our legal and accounting obligations.</li>
      </ul>

      <h2>Who we share it with</h2>
      <p>
        Only with service providers that help us run the business: Stripe (payments), Resend (email), Twilio (SMS, if
        enabled) and our hosting/database providers. Some of these may store data outside Canada.
      </p>

      <h2>How long we keep it</h2>
      <p>Booking and payment records are kept as long as required for tax purposes (generally 6 years in Canada).</p>

      <h2>Your rights</h2>
      <p>
        You can ask to see, correct or delete your personal information by emailing{" "}
        <a href={`mailto:${brand.contact.email}`}>{brand.contact.email}</a>.
      </p>
    </>
  );
}
