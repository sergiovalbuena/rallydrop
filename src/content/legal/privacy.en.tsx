/*
 * PLACEHOLDER PRIVACY POLICY — NOT LEGAL ADVICE.
 * Must be reviewed for compliance with BC PIPA and federal PIPEDA before launch.
 */

export const privacyUpdated = "October 24, 2026";

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
        <li>
          For week and month rentals, that we checked your photo ID and the last four digits of your driver&apos;s
          licence (we don&apos;t copy or store the ID itself).
        </li>
        <li>
          When you accept our Rental Terms and Waiver: the version accepted, the date and time, your IP address and
          browser — our record that you agreed.
        </li>
        <li>Basic, anonymous website analytics (pages visited, no personal data).</li>
      </ul>

      <h2>The Spotter AI camera</h2>
      <ul>
        <li>
          The Aura S&apos;s Spotter camera records <strong>video and movement data</strong> (your swings, your position
          on court and the ball) to coach you and build heatmaps.
        </li>
        <li>
          Those recordings are stored and processed on <strong>your own phone or tablet, in the PONGBOT app</strong>,
          under your account. <strong>RallyDrop does not access, receive or store them.</strong>
        </li>
        <li>
          <strong>PONGBOT&apos;s privacy policy applies to the app</strong> and to anything it collects. Read it before
          you use the camera, and get permission before filming other people.
        </li>
        <li>
          We reset the machine between rentals; if the app lets you, sign out or remove the machine from your account
          when you give it back.
        </li>
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
        You can ask to see, correct or delete your personal information by replying to any of our emails or through our{" "}
        <a href="/contact">contact page</a>.
      </p>
    </>
  );
}
