import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { BookingStatus, DepositStatus } from "@/generated/prisma/client";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="font-display text-4xl font-extrabold uppercase">{title}</h1>
        {description && <p className="mt-1 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border bg-card p-5", className)}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="mt-1 font-display text-4xl font-extrabold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Panel({
  title,
  children,
  actions,
  className,
}: {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("rounded-xl border bg-card", className)}>
      <div className="flex items-center justify-between gap-3 border-b px-5 py-3">
        <h2 className="font-display text-xl font-bold uppercase">{title}</h2>
        {actions}
      </div>
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Empty({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{children}</p>;
}

export const STATUS_LABEL: Record<BookingStatus, string> = {
  PENDING_PAYMENT: "Awaiting payment",
  CONFIRMED: "Confirmed",
  CHECKED_OUT: "Checked out",
  RETURNED_OK: "Returned – OK",
  RETURNED_DAMAGED: "Returned – damage",
  COMPLETED: "Completed",
  CANCELLED: "Cancelled",
  EXPIRED: "Expired",
  NO_SHOW: "No-show",
};

const STATUS_VARIANT: Record<
  BookingStatus,
  "default" | "secondary" | "accent" | "success" | "warning" | "destructive" | "outline"
> = {
  PENDING_PAYMENT: "warning",
  CONFIRMED: "default",
  CHECKED_OUT: "accent",
  RETURNED_OK: "success",
  RETURNED_DAMAGED: "warning",
  COMPLETED: "secondary",
  CANCELLED: "destructive",
  EXPIRED: "outline",
  NO_SHOW: "destructive",
};

export function StatusBadge({ status }: { status: BookingStatus }) {
  return <Badge variant={STATUS_VARIANT[status]}>{STATUS_LABEL[status]}</Badge>;
}

const DEPOSIT_VARIANT: Record<
  DepositStatus,
  "default" | "secondary" | "accent" | "success" | "warning" | "destructive" | "outline"
> = {
  PENDING: "outline",
  CARD_SAVED: "secondary",
  HELD: "accent",
  RELEASED: "success",
  CAPTURED: "destructive",
  PARTIALLY_CAPTURED: "warning",
  FAILED: "destructive",
  WAIVED: "outline",
};

/** FAILED reads as "Deposit pending": the hold didn't go through, the machine waits. */
export function DepositBadge({ status }: { status: DepositStatus }) {
  const label = status === "FAILED" ? "deposit pending" : status.replace("_", " ").toLowerCase();
  return <Badge variant={DEPOSIT_VARIANT[status]}>{label}</Badge>;
}
