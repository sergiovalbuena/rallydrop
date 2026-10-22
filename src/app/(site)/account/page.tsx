import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import {
  BookOpen,
  CalendarClock,
  CloudRain,
  CreditCard,
  FileCheck,
  LogOut,
  MapPin,
  Receipt,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { Section } from "@/components/marketing/section";
import { CancelButton } from "@/components/portal/cancel-button";
import { PackageCancel } from "@/components/portal/package-cancel";
import { SignInForm } from "@/components/portal/sign-in-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCents } from "@/lib/money";
import { customerBookings, customerCredits, customerPackage } from "@/lib/services/portal";
import { getPortalCustomer } from "@/lib/services/portal-auth";
import { formatLocal, formatRange } from "@/lib/time";
import { logistics } from "@/lib/domain/logistics";
import { billingPortalAction, signOutAction } from "./actions";

export const metadata: Metadata = { title: "My bookings", robots: { index: false } };

export default function AccountPage({ searchParams }: PageProps<"/account">) {
  return (
    <Section className="pt-8 sm:pt-12">
      <Suspense fallback={<PortalSkeleton />}>
        <Portal searchParams={searchParams} />
      </Suspense>
    </Section>
  );
}

const STATUS_VARIANT = {
  PENDING_PAYMENT: "warning",
  CONFIRMED: "default",
  CHECKED_OUT: "accent",
  RETURNED_OK: "success",
  RETURNED_DAMAGED: "warning",
  COMPLETED: "secondary",
  CANCELLED: "destructive",
  EXPIRED: "secondary",
  NO_SHOW: "destructive",
} as const;

async function Portal({ searchParams }: { searchParams: PageProps<"/account">["searchParams"] }) {
  const customer = await getPortalCustomer();
  if (!customer) {
    const sp = await searchParams;
    return <SignInForm linkExpired={sp.link === "expired"} />;
  }
  const t = await getTranslations("portal");
  const ts = await getTranslations("status");
  const now = new Date();
  const [bookings, pkg, credit] = await Promise.all([
    customerBookings(customer.id, now),
    customerPackage(customer.id),
    customerCredits(customer.id, now),
  ]);
  const upcoming = bookings.filter((b) => b.upcoming).reverse();
  const past = bookings.filter((b) => !b.upcoming);

  return (
    <div className="space-y-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm text-muted-foreground">{customer.email ?? customer.phone}</p>
          <h1 className="font-display text-5xl font-extrabold uppercase">{t("title")}</h1>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/account/guide">
              <BookOpen /> {t("guide")}
            </Link>
          </Button>
          <form action={signOutAction}>
            <Button variant="ghost" type="submit">
              <LogOut /> {t("signOut")}
            </Button>
          </form>
        </div>
      </div>

      {pkg && (
        <div className="court-lines flex flex-col gap-4 rounded-2xl bg-court p-6 text-white sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm font-semibold tracking-wide text-optic uppercase">{t("package")}</p>
            <h2 className="font-display text-3xl font-extrabold uppercase">{pkg.subscription.product.name}</h2>
            <p className="mt-1 text-white/85">
              {t("sessionsLeft", { left: pkg.usage.left, total: pkg.usage.total })}
              {pkg.usage.carried > 0 && ` (${t("carried", { count: pkg.usage.carried })})`} ·{" "}
              {pkg.subscription.cancelAtPeriodEnd
                ? t("endsOn", { date: formatLocal(pkg.usage.periodEnd, "MMM d") })
                : t("renews", { date: formatLocal(pkg.usage.periodEnd, "MMM d") })}
            </p>
            {pkg.subscription.status === "PAST_DUE" && (
              <Badge variant="warning" className="mt-2">
                Payment issue — update your card
              </Badge>
            )}
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            {pkg.usage.left > 0 && pkg.subscription.status === "ACTIVE" && (
              <Button asChild variant="accent">
                <Link href="/account/session">
                  <CalendarClock /> {t("bookSession")}
                </Link>
              </Button>
            )}
            <form action={billingPortalAction}>
              <Button type="submit" variant="inverted">
                <CreditCard /> {t("manageCard")}
              </Button>
            </form>
            {pkg.subscription.status === "ACTIVE" && (
              <PackageCancel
                cancelling={pkg.subscription.cancelAtPeriodEnd}
                endsOn={formatLocal(pkg.usage.periodEnd, "MMM d")}
              />
            )}
          </div>
        </div>
      )}

      {credit.balanceCents > 0 && (
        <section className="flex flex-col gap-3 rounded-2xl border bg-card p-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex gap-3">
            <Wallet className="mt-1 size-6 shrink-0 text-primary" aria-hidden />
            <div>
              <h2 className="font-display text-2xl font-extrabold uppercase">
                {t("creditTitle")} · {formatCents(credit.balanceCents)}
              </h2>
              <p className="text-sm text-muted-foreground">{t("creditBody")}</p>
            </div>
          </div>
          <ul className="space-y-1 text-sm sm:text-right">
            {credit.credits.map((c) => (
              <li key={c.id}>
                <span className="font-medium">{t(`creditReason_${c.reason}`)}</span>{" "}
                {t("creditRow", {
                  amount: formatCents(c.remainingCents),
                  date: formatLocal(c.expiresAt, "MMM d, yyyy"),
                })}
              </li>
            ))}
          </ul>
        </section>
      )}

      {[
        { title: t("upcoming"), items: upcoming },
        { title: t("past"), items: past },
      ].map((group) => (
        <section key={group.title}>
          <h2 className="mb-4 font-display text-3xl font-extrabold uppercase">{group.title}</h2>
          {group.items.length === 0 ? (
            <div className="rounded-2xl border border-dashed p-10 text-center">
              <p className="text-muted-foreground">{t("none")}</p>
              {group.title === t("upcoming") && (
                <Button asChild className="mt-4">
                  <Link href="/book">Book a machine</Link>
                </Button>
              )}
            </div>
          ) : (
            <ul className="grid gap-4 md:grid-cols-2">
              {group.items.map((b) => (
                <li key={b.id} className="flex flex-col gap-3 rounded-2xl border bg-card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-display text-2xl font-extrabold uppercase">{b.product.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {b.machine.name} · <span className="font-mono">{b.code}</span>
                      </p>
                    </div>
                    <Badge variant={STATUS_VARIANT[b.status]}>{ts(b.status)}</Badge>
                  </div>
                  <p className="text-sm">{formatRange(b.startsAt, b.endsAt)}</p>
                  <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                    <MapPin className="size-4" aria-hidden />
                    {logistics(b).short}
                  </p>
                  {b.deposit && (
                    <p className="flex items-center gap-1.5 text-sm">
                      <ShieldCheck className="size-4 text-primary" aria-hidden />
                      {t("deposit")}: {formatCents(b.deposit.amountCents)} · {t(`depositStatus_${b.deposit.status}`)}
                      {b.deposit.capturedCents > 0 && ` (${formatCents(b.deposit.capturedCents)})`}
                    </p>
                  )}
                  {b.deposit?.captureNote && <p className="text-xs text-muted-foreground">“{b.deposit.captureNote}”</p>}
                  {b.creditCents > 0 && (
                    <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
                      <Wallet className="size-4" aria-hidden />
                      {t("creditUsed", { amount: formatCents(b.creditCents) })}
                    </p>
                  )}
                  {b.acceptance && (
                    <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <FileCheck className="size-4" aria-hidden />
                      <Link
                        href={`/legal/terms/${b.acceptance.termsVersion}`}
                        className="underline underline-offset-2 hover:text-foreground"
                      >
                        {t("termsAccepted", { version: b.acceptance.termsVersion })}
                      </Link>
                      · {b.acceptance.acceptedAtLocal}
                    </p>
                  )}
                  <div className="mt-auto flex flex-wrap gap-2 pt-2">
                    {b.receipts.map((url, i) => (
                      <Button key={url} asChild variant="ghost" size="sm">
                        <a href={url} target="_blank" rel="noreferrer">
                          <Receipt /> {t("receipt")}
                          {b.receipts.length > 1 ? ` ${i + 1}` : ""}
                        </a>
                      </Button>
                    ))}
                    {b.rainEligible && (
                      <Button asChild variant="accent" size="sm">
                        <Link href={`/account/rain/${b.id}`}>
                          <CloudRain /> {t("rained")}
                        </Link>
                      </Button>
                    )}
                    {b.canReschedule && (
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/account/reschedule/${b.id}`}>{t("reschedule")}</Link>
                      </Button>
                    )}
                    {b.canCancel && (
                      <CancelButton
                        bookingId={b.id}
                        refundLabel={t("cancelRefund", {
                          amount: formatCents(b.refundIfCancelled.refundCents),
                          tier:
                            b.refundIfCancelled.tier === "full"
                              ? "100%"
                              : b.refundIfCancelled.tier === "partial"
                                ? "partial"
                                : "no refund",
                        })}
                      />
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </div>
  );
}

function PortalSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-12 w-64" />
      <div className="grid gap-4 md:grid-cols-2">
        <Skeleton className="h-48 rounded-2xl" />
        <Skeleton className="h-48 rounded-2xl" />
      </div>
    </div>
  );
}
