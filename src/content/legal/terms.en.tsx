/*
 * PLACEHOLDER RENTAL TERMS — NOT LEGAL ADVICE.
 * Must be reviewed and adapted by a lawyer licensed in British Columbia
 * before launch. Bump TERMS_VERSION in src/lib/services/bookings.ts whenever
 * this text changes materially.
 */
import { brand } from "@/config/brand";

export const termsUpdated = "October 2026";

export function TermsEn() {
  return (
    <>
      <h2>1. Who we are</h2>
      <p>
        These terms govern rentals of ball machines and related equipment from {brand.name} (&quot;we&quot;, &quot;us&quot;),
        operating in {brand.city}, Canada. By booking you (&quot;the renter&quot;) agree to these terms.
      </p>

      <h2>2. Booking and payment</h2>
      <ul>
        <li>Prices are in Canadian dollars. Applicable taxes (GST/PST) are shown before you pay.</li>
        <li>The rental price is charged by card when you book. Card payments are processed by Stripe; we never store your card number.</li>
        <li>A booking is confirmed only when you receive a confirmation code.</li>
      </ul>

      <h2>3. Security deposit</h2>
      <ul>
        <li>
          For rentals of up to 6 days we place a temporary authorization (&quot;hold&quot;) on your card for the deposit amount shown at
          checkout. The hold is released when the equipment is returned in good condition.
        </li>
        <li>
          For longer rentals we securely save your card with Stripe and may charge up to the deposit amount if the equipment is
          damaged, lost or not returned.
        </li>
        <li>Any deduction will be explained to you in writing with a description of the damage.</li>
      </ul>

      <h2>4. Cancellations and changes</h2>
      <ul>
        <li>Cancel 48 hours or more before the start time for a full refund of the rental price.</li>
        <li>Cancellations within 48 hours are refunded at 50%.</li>
        <li>No refund once the rental has started.</li>
        <li>Rain: if weather makes play impossible on your start day, contact us to reschedule at no charge.</li>
        <li>Monthly packages renew automatically and can be cancelled at any time; cancellation takes effect at the end of the current period.</li>
      </ul>

      <h2>5. Your responsibilities</h2>
      <ul>
        <li>Use the equipment only as instructed and for tennis or pickleball practice.</li>
        <li>Keep the machine dry. Do not operate it in rain or leave it outside unattended.</li>
        <li>Use pressureless balls only, unless we have told you otherwise.</li>
        <li>Do not open, modify or repair the equipment.</li>
        <li>Follow the rules of the court or facility you use, including any time limits.</li>
        <li>You are responsible for the equipment from delivery/pickup until it is collected or returned.</li>
      </ul>

      <h2>6. Damage, loss and theft</h2>
      <p>
        Normal wear and tear is our responsibility. You are responsible for damage caused by misuse, negligence, water exposure,
        or loss/theft while the equipment is in your care, up to the replacement value of the equipment. We may apply the deposit
        towards these costs.
      </p>

      <h2>7. Safe use and assumption of risk</h2>
      <p>
        Ball machines project balls at speed. Never stand in front of the machine while it is running and keep children and pets
        away. Playing tennis or pickleball involves inherent risk of injury. To the extent permitted by law, you assume these risks
        and agree that we are not liable for injury or loss arising from your use of the equipment, except where caused by our
        negligence.
      </p>

      <h2>8. Late returns</h2>
      <p>If the equipment is not available for pickup at the agreed time, we may charge an additional day at the current day rate.</p>

      <h2>9. Privacy</h2>
      <p>We handle your personal information as described in our Privacy Policy.</p>

      <h2>10. Governing law</h2>
      <p>These terms are governed by the laws of British Columbia and the federal laws of Canada that apply there.</p>
    </>
  );
}
