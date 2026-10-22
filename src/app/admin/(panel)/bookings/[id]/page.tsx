import { connection } from "next/server";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink, Mail, MapPin, Phone } from "lucide-react";
import {
  CancelBookingButton,
  RainCreditAdminButton,
  DepositControls,
  AcceptanceLinkControls,
  InspectionForm,
  ManualPaymentForm,
  RefundForm,
  StatusSelect,
} from "@/components/admin/booking-controls";
import { DepositBadge, PageHeader, Panel, StatusBadge } from "@/components/admin/ui";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/lib/db";
import { formatCents } from "@/lib/money";
import { logistics } from "@/lib/domain/logistics";
import { getSettings } from "@/lib/services/settings";
import { acceptanceToken } from "@/lib/services/legal";
import { siteUrl } from "@/lib/site-url";
import { holdLapsesBeforeReturn } from "@/lib/domain/deposit";
import { formatLocal, formatRange } from "@/lib/time";

/** Internal admin: always rendered per request, no instant-navigation shell. */
export const instant = false;

export default async function BookingDetailPage({ params }: PageProps<"/admin/bookings/[id]">) {
  await connection();
  const { id } = await params;
  const b = await db.booking.findUnique({
    where: { id },
    include: {
      customer: true,
      machine: true,
      product: true,
      court: true,
      deposit: true,
      addOns: { include: { addOn: true } },
      promoCode: { select: { code: true } },
      payments: { include: { refunds: true }, orderBy: { createdAt: "asc" } },
      inspections: true,
      acceptances: { orderBy: { acceptedAt: "desc" } },
      events: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!b) notFound();
  const settings = await getSettings();

  const rental = b.payments.filter(
    (p) => p.kind === "RENTAL" && (p.status === "SUCCEEDED" || p.status === "PARTIALLY_REFUNDED"),
  );
  const refundable = rental.reduce((s, p) => s + p.amountCents - p.refundedCents, 0);
  const checkOut = b.inspections.find((i) => i.kind === "CHECK_OUT");
  const checkIn = b.inspections.find((i) => i.kind === "CHECK_IN");
  const closed = ["CANCELLED", "EXPIRED", "COMPLETED"].includes(b.status);
  const how = logistics(b);
  const where = how.place ?? "Self-serve at the hub";

  return (
    <>
      <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
        <Link href="/admin/bookings">
          <ArrowLeft /> Bookings
        </Link>
      </Button>
      <PageHeader
        title={b.code}
        description={`${b.product.name} · ${b.machine.name} · ${b.channel === "ADMIN" ? "Phone booking" : "Online"}`}
        actions={
          <>
            <StatusBadge status={b.status} />
            {b.status === "CONFIRMED" && <RainCreditAdminButton bookingId={b.id} />}
            {!closed && <CancelBookingButton bookingId={b.id} />}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <Panel title="Rental">
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">When</dt>
                <dd className="font-medium">{formatRange(b.startsAt, b.endsAt)}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Where</dt>
                <dd className="flex items-center gap-1.5 font-medium">
                  <MapPin className="size-4" aria-hidden />
                  {where}
                  {b.deliveryLat && b.deliveryLng && (
                    <a
                      className="text-primary"
                      href={`https://www.google.com/maps?q=${b.deliveryLat},${b.deliveryLng}`}
                      target="_blank"
                      rel="noreferrer"
                      aria-label="Open in Google Maps"
                    >
                      <ExternalLink className="size-3.5" />
                    </a>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Trips</dt>
                <dd className="font-medium">
                  {how.start} → {how.end}
                  {(b.dropoff || b.collection) && (
                    <span className="block text-muted-foreground">
                      {b.deliveryZone ? `Zone ${b.deliveryZone}` : "Zone not set"}
                      {b.deliveryKm !== null && ` · ${Number(b.deliveryKm)} km`} · {formatCents(b.deliveryFeeCents)}
                    </span>
                  )}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Add-ons</dt>
                <dd className="font-medium">
                  {b.addOns.length
                    ? b.addOns.map((a) => `${a.addOn.name} (${formatCents(a.priceCents)})`).join(", ")
                    : "None"}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Customer notes</dt>
                <dd className="font-medium">{b.customerNotes ?? "—"}</dd>
              </div>
            </dl>
            <div className="mt-6 border-t pt-5">
              <StatusSelect bookingId={b.id} status={b.status} />
            </div>
          </Panel>

          <Panel title="Check-out">
            {checkOut && (
              <p className="mb-3 text-xs text-muted-foreground">
                Last saved {formatLocal(checkOut.performedAt, "MMM d, h:mm a")}
              </p>
            )}
            <InspectionForm
              bookingId={b.id}
              kind="CHECK_OUT"
              defaults={checkOut ?? undefined}
              requireId={b.deposit?.strategy === "SAVED_CARD"}
              spotter={b.machine.aiCoach}
            />
            <Photos urls={checkOut?.photoUrls ?? []} />
          </Panel>

          <Panel title="Check-in">
            {checkIn && (
              <p className="mb-3 text-xs text-muted-foreground">
                Last saved {formatLocal(checkIn.performedAt, "MMM d, h:mm a")}
              </p>
            )}
            <InspectionForm
              bookingId={b.id}
              kind="CHECK_IN"
              defaults={checkIn ?? undefined}
              spotter={b.machine.aiCoach}
            />
            <Photos urls={checkIn?.photoUrls ?? []} />
          </Panel>
        </div>

        <div className="space-y-6">
          <Panel title="Rental Terms & Waiver">
            {b.acceptances[0] ? (
              <div className="space-y-1 text-sm">
                <p className="font-semibold text-success">Terms accepted ✓</p>
                <p className="text-muted-foreground">
                  {b.acceptances[0].acceptedAtLocal} · Terms v{b.acceptances[0].termsVersion} · Waiver v
                  {b.acceptances[0].waiverVersion} · {b.acceptances[0].method.replace("_", " ")}
                </p>
                <p className="text-xs break-all text-muted-foreground">
                  IP {b.acceptances[0].ip ?? "—"} · SHA-256 {b.acceptances[0].termsSha256.slice(0, 12)}… /{" "}
                  {b.acceptances[0].waiverSha256.slice(0, 12)}…
                </p>
              </div>
            ) : (
              <div className="space-y-3 text-sm">
                <p className="font-semibold text-destructive">Not accepted yet</p>
                <p className="text-muted-foreground">
                  Send the customer the link (or copy it) — the booking isn&apos;t complete until they tick both boxes.
                </p>
                <AcceptanceLinkControls bookingId={b.id} url={siteUrl(`/accept/${acceptanceToken(b.id)}`)} />
              </div>
            )}
          </Panel>

          <Panel title="Customer">
            <p className="font-semibold">
              <Link href={`/admin/customers/${b.customer.id}`} className="hover:underline">
                {b.customer.name}
              </Link>
              {b.customer.trusted && (
                <Badge variant="success" className="ml-2">
                  Trusted
                </Badge>
              )}
              {b.customer.blocked && (
                <Badge variant="destructive" className="ml-2">
                  Blocked
                </Badge>
              )}
            </p>
            {b.customer.email && (
              <a
                href={`mailto:${b.customer.email}`}
                className="mt-2 flex items-center gap-2 text-sm hover:text-primary"
              >
                <Mail className="size-4" /> {b.customer.email}
              </a>
            )}
            {b.customer.phone && (
              <a href={`tel:${b.customer.phone}`} className="mt-1 flex items-center gap-2 text-sm hover:text-primary">
                <Phone className="size-4" /> {b.customer.phone}
              </a>
            )}
            {b.customer.skillLevel && (
              <p className="mt-2 text-sm text-muted-foreground">Level: {b.customer.skillLevel.toLowerCase()}</p>
            )}
          </Panel>

          <Panel title="Payment">
            <dl className="space-y-1.5 text-sm">
              {b.discountCents > 0 && (
                <Row label={`Promo ${b.promoCode?.code ?? ""}`} value={formatCents(-b.discountCents)} />
              )}
              {b.care && <Row label="RallyDrop Care" value={formatCents(b.careCents)} />}
              {b.deliveryFeeCents > 0 && <Row label="Drop-off / collection" value={formatCents(b.deliveryFeeCents)} />}
              <Row label={`Subtotal${b.offSeason ? " (off-season)" : ""}`} value={formatCents(b.subtotalCents)} />
              {b.gstBps > 0 && <Row label={`GST ${b.gstBps / 100}%`} value={formatCents(b.gstCents)} />}
              {b.pstBps > 0 && <Row label={`PST ${b.pstBps / 100}%`} value={formatCents(b.pstCents)} />}
              {b.creditCents > 0 && <Row label="Customer credit" value={formatCents(-b.creditCents)} />}
              <Row label={b.creditCents > 0 ? "Charged to card" : "Total"} value={formatCents(b.totalCents)} strong />
            </dl>
            <ul className="mt-4 space-y-2 border-t pt-4 text-sm">
              {b.payments.length === 0 && <li className="text-muted-foreground">No payments yet.</li>}
              {b.payments.map((p) => (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-2">
                  <span>
                    {p.kind.replace("_", " ").toLowerCase()} · {formatCents(p.amountCents)}
                    {p.refundedCents > 0 && (
                      <span className="text-muted-foreground"> (−{formatCents(p.refundedCents)})</span>
                    )}
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge variant={p.status === "SUCCEEDED" ? "success" : "secondary"}>{p.status.toLowerCase()}</Badge>
                    {p.receiptUrl && (
                      <a
                        href={p.receiptUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-primary"
                        aria-label="Receipt"
                      >
                        <ExternalLink className="size-4" />
                      </a>
                    )}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-5 space-y-4 border-t pt-5">
              <RefundForm bookingId={b.id} maxCents={refundable} />
              {b.channel === "ADMIN" && <ManualPaymentForm bookingId={b.id} />}
            </div>
          </Panel>

          {b.deposit && (
            <Panel title="Deposit" actions={<DepositBadge status={b.deposit.status} />}>
              <dl className="mb-4 space-y-1.5 text-sm">
                <Row label="Amount" value={formatCents(b.deposit.amountCents)} />
                <Row
                  label="Method"
                  value={b.deposit.strategy === "AUTH_HOLD" ? "Card hold (manual capture)" : "Saved card"}
                />
                {b.deposit.authScheduledFor && b.deposit.status === "PENDING" && (
                  <Row label="Hold placed" value={formatLocal(b.deposit.authScheduledFor, "MMM d, h:mm a")} />
                )}
                {b.deposit.authExpiresAt && b.deposit.status === "HELD" && (
                  <Row
                    label="Hold expires"
                    value={`${formatLocal(b.deposit.authExpiresAt, "MMM d, h:mm a")}${
                      holdLapsesBeforeReturn(b.deposit.authExpiresAt, b.endsAt) ? " — before the return!" : ""
                    }`}
                  />
                )}
                {b.deposit.status === "FAILED" && (
                  <p className="rounded-lg bg-destructive/10 p-2 text-destructive">
                    Deposit pending: the card hold failed. The customer was emailed a link to update their card and we
                    retry as soon as they do. The machine can&apos;t be checked out until then (or release the deposit
                    to waive it).
                  </p>
                )}
                {b.deposit.capturedCents > 0 && <Row label="Charged" value={formatCents(b.deposit.capturedCents)} />}
                {b.deposit.captureNote && <Row label="Note" value={b.deposit.captureNote} />}
              </dl>
              <DepositControls
                bookingId={b.id}
                status={b.deposit.status}
                amount={b.deposit.amountCents - b.deposit.capturedCents}
                canCharge={!!b.deposit.stripePaymentMethodId || b.deposit.status === "HELD"}
                careCapCents={b.care ? settings.careCapCents : null}
              />
            </Panel>
          )}

          <Panel title="History">
            <ol className="space-y-3 text-sm">
              {b.events.map((e) => (
                <li key={e.id} className="flex gap-3">
                  <span className="w-24 shrink-0 text-xs text-muted-foreground">
                    {formatLocal(e.createdAt, "MMM d h:mm a")}
                  </span>
                  <span>
                    <span className="font-medium">{e.type.replaceAll("_", " ")}</span>{" "}
                    <span className="text-muted-foreground">· {e.actor.startsWith("admin:") ? "admin" : e.actor}</span>
                  </span>
                </li>
              ))}
            </ol>
          </Panel>
        </div>
      </div>
    </>
  );
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={strong ? "font-display text-xl font-bold" : "text-right"}>{value}</dd>
    </div>
  );
}

function Photos({ urls }: { urls: string[] }) {
  if (urls.length === 0) return null;
  return (
    <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
      {urls.map((u) => (
        <a key={u} href={u} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={u} alt="Inspection photo" className="aspect-square w-full object-cover" />
        </a>
      ))}
    </div>
  );
}
