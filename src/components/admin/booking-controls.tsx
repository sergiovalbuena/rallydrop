"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  cancelAdminAction,
  rainCreditAdminAction,
  captureDepositAction,
  inspectionAction,
  recordManualPaymentAction,
  refundAction,
  releaseDepositAction,
  sendAcceptanceLinkAction,
  setStatusAction,
} from "@/app/admin/(panel)/bookings/actions";
import type { BookingStatus, DepositStatus } from "@/generated/prisma/client";
import { formatCents } from "@/lib/money";
import { STATUS_LABEL } from "./ui";
import { useAdminAction } from "./use-action";

const SELECTABLE: BookingStatus[] = [
  "CONFIRMED",
  "CHECKED_OUT",
  "RETURNED_OK",
  "RETURNED_DAMAGED",
  "COMPLETED",
  "NO_SHOW",
  "CANCELLED",
];

export function StatusSelect({ bookingId, status }: { bookingId: string; status: BookingStatus }) {
  const { run, pending } = useAdminAction();
  const [value, setValue] = useState<BookingStatus>(status);
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="status">Booking status</Label>
        <NativeSelect id="status" value={value} onChange={(e) => setValue(e.target.value as BookingStatus)}>
          {!SELECTABLE.includes(status) && <option value={status}>{STATUS_LABEL[status]}</option>}
          {SELECTABLE.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABEL[s]}
            </option>
          ))}
        </NativeSelect>
      </div>
      <Button disabled={pending || value === status} onClick={() => run(() => setStatusAction(bookingId, value))}>
        Update status
      </Button>
      <p className="text-xs text-muted-foreground sm:hidden">“Returned – OK” releases the deposit automatically.</p>
    </div>
  );
}

export function DepositControls({
  bookingId,
  status,
  amount,
  canCharge,
  careCapCents,
}: {
  bookingId: string;
  status: DepositStatus;
  amount: number;
  canCharge: boolean;
  /** Set when the customer bought RallyDrop Care: charges are capped unless an exclusion applies. */
  careCapCents?: number | null;
}) {
  const { run, pending } = useAdminAction();
  const [exclusion, setExclusion] = useState("");
  const capped = careCapCents != null && !exclusion;
  const max = capped ? Math.min(amount, careCapCents) : amount;
  const [captureAmount, setCaptureAmount] = useState((max / 100).toFixed(2));
  const [note, setNote] = useState("");
  const open = ["HELD", "CARD_SAVED", "PENDING", "FAILED"].includes(status);
  if (!open) return null;
  return (
    <div className="space-y-4">
      <Button variant="outline" disabled={pending} onClick={() => run(() => releaseDepositAction(bookingId))}>
        Release deposit
      </Button>
      {canCharge && (
        <div className="space-y-3 rounded-lg border p-4">
          <p className="text-sm font-semibold">Charge for damage</p>
          {careCapCents != null && (
            <div className="space-y-2 rounded-md bg-primary/5 p-3 text-sm">
              <p>
                <strong>RallyDrop Care:</strong> accidental damage is capped at {formatCents(careCapCents)}. Choose an
                exclusion (and explain it in the note) to charge more.
              </p>
              <NativeSelect
                aria-label="Care exclusion"
                value={exclusion}
                onChange={(e) => {
                  setExclusion(e.target.value);
                  if (!e.target.value) setCaptureAmount((Math.min(amount, careCapCents) / 100).toFixed(2));
                }}
              >
                <option value="">No exclusion — accidental damage (capped)</option>
                <option value="THEFT">Theft</option>
                <option value="LOSS">Loss</option>
                <option value="RAIN">Used in the rain / wet court</option>
                <option value="GROSS_NEGLIGENCE">Gross negligence</option>
              </NativeSelect>
            </div>
          )}
          <div className="grid gap-3 sm:grid-cols-[140px_1fr]">
            <div className="space-y-1.5">
              <Label htmlFor="capture-amount">Amount (CAD)</Label>
              <Input
                id="capture-amount"
                inputMode="decimal"
                value={captureAmount}
                onChange={(e) => setCaptureAmount(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="capture-note">Note for the customer (required)</Label>
              <Textarea
                id="capture-note"
                className="min-h-11"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Describe the damage"
              />
            </div>
          </div>
          <Button
            variant="destructive"
            disabled={pending || !note.trim()}
            onClick={async () => {
              if (await run(() => captureDepositAction(bookingId, captureAmount, note, exclusion || undefined)))
                setNote("");
            }}
          >
            Charge deposit
          </Button>
          <p className="text-xs text-muted-foreground">
            Up to {formatCents(max)} now. A hold can only be captured once — any remaining amount is released
            automatically.
          </p>
        </div>
      )}
    </div>
  );
}

export function RefundForm({ bookingId, maxCents }: { bookingId: string; maxCents: number }) {
  const { run, pending } = useAdminAction();
  const [amount, setAmount] = useState((maxCents / 100).toFixed(2));
  const [reason, setReason] = useState("");
  if (maxCents <= 0) return <p className="text-sm text-muted-foreground">Nothing left to refund.</p>;
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <div className="space-y-1.5">
        <Label htmlFor="refund-amount">Refund (CAD)</Label>
        <Input
          id="refund-amount"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="sm:w-32"
        />
      </div>
      <div className="flex-1 space-y-1.5">
        <Label htmlFor="refund-reason">Reason</Label>
        <Input
          id="refund-reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Rain, goodwill…"
        />
      </div>
      <Button variant="outline" disabled={pending} onClick={() => run(() => refundAction(bookingId, amount, reason))}>
        Refund
      </Button>
    </div>
  );
}

export function CancelBookingButton({ bookingId }: { bookingId: string }) {
  const { run, pending } = useAdminAction();
  const [refund, setRefund] = useState<"policy" | "full" | "none">("policy");
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="destructive">Cancel booking</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this booking?</DialogTitle>
          <DialogDescription>The machine is freed, the deposit released and the customer emailed.</DialogDescription>
        </DialogHeader>
        <div className="space-y-1.5">
          <Label htmlFor="refund-mode">Refund</Label>
          <NativeSelect id="refund-mode" value={refund} onChange={(e) => setRefund(e.target.value as typeof refund)}>
            <option value="policy">By cancellation policy</option>
            <option value="full">Full refund</option>
            <option value="none">No refund</option>
          </NativeSelect>
        </div>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Keep booking</Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={pending}
            onClick={async () => {
              if (await run(() => cancelAdminAction(bookingId, refund))) setOpen(false);
            }}
          >
            Cancel booking
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** Owner's call: rained out → cancel and give a 100% credit (any day). */
export function RainCreditAdminButton({ bookingId }: { bookingId: string }) {
  const { run, pending } = useAdminAction();
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline">Rain credit</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Turn this booking into a rain credit?</DialogTitle>
          <DialogDescription>
            Cancels it with no cash refund, frees the machine, releases the deposit and gives the customer a credit for
            100% of what they paid (Settings → rain credit validity). The customer is emailed.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">Keep booking</Button>
          </DialogClose>
          <Button
            disabled={pending}
            onClick={async () => {
              if (await run(() => rainCreditAdminAction(bookingId))) setOpen(false);
            }}
          >
            Give rain credit
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function InspectionForm({
  bookingId,
  kind,
  defaults,
  requireId = false,
  spotter = true,
}: {
  bookingId: string;
  kind: "CHECK_OUT" | "CHECK_IN";
  defaults?: {
    condition: string;
    batteryPercent: number | null;
    ballsCount: number | null;
    notes: string | null;
    machineOk: boolean | null;
    spotterOk: boolean | null;
    batteryOk: boolean | null;
    chargerOk: boolean | null;
    idVerified: boolean;
    licenceLast4: string | null;
  };
  /** Week & month rentals: ID check required at check-out. */
  requireId?: boolean;
  /** Machine has the Spotter AI camera module. */
  spotter?: boolean;
}) {
  const { run, pending } = useAdminAction();
  const id = (s: string) => `${kind}-${s}`;
  return (
    <form
      className="space-y-3"
      action={async (formData) => {
        await run(() => inspectionAction(formData));
      }}
    >
      <input type="hidden" name="bookingId" value={bookingId} />
      <input type="hidden" name="kind" value={kind} />
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="space-y-1.5">
          <Label htmlFor={id("condition")}>Condition</Label>
          <NativeSelect id={id("condition")} name="condition" defaultValue={defaults?.condition ?? "GOOD"}>
            <option value="EXCELLENT">Excellent</option>
            <option value="GOOD">Good</option>
            <option value="MINOR_WEAR">Minor wear</option>
            <option value="DAMAGED">Damaged</option>
          </NativeSelect>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id("battery")}>Battery %</Label>
          <Input
            id={id("battery")}
            name="batteryPercent"
            type="number"
            min={0}
            max={100}
            defaultValue={defaults?.batteryPercent ?? undefined}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id("balls")}>Balls {kind === "CHECK_OUT" ? "delivered" : "returned"}</Label>
          <Input
            id={id("balls")}
            name="ballsCount"
            type="number"
            min={0}
            defaultValue={defaults?.ballsCount ?? undefined}
          />
        </div>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">
          Checklist — each item {kind === "CHECK_OUT" ? "handed over" : "back"} and OK
        </legend>
        <div className="grid gap-2 sm:grid-cols-2">
          {[
            ["machineOk", "Machine"],
            ...(spotter ? [["spotterOk", "Spotter camera module"]] : []),
            ["batteryOk", "Battery"],
            ["chargerOk", "Charger"],
          ].map(([name, label]) => (
            <label key={name} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                name={name}
                defaultChecked={!!defaults?.[name as "machineOk"]}
                className="size-4 accent-primary"
              />
              {label}
            </label>
          ))}
        </div>
      </fieldset>
      {kind === "CHECK_OUT" && (
        <fieldset className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
          <legend className="px-1 text-sm font-medium">
            ID check {requireId ? "(required — week/month rental)" : "(optional)"}
          </legend>
          <label className="flex items-center gap-2 self-end pb-2 text-sm">
            <input
              type="checkbox"
              name="idVerified"
              defaultChecked={defaults?.idVerified}
              required={requireId}
              className="size-4 accent-primary"
            />
            ID verified
          </label>
          <div className="space-y-1.5">
            <Label htmlFor={id("licence")}>Driver&apos;s licence — last 4</Label>
            <Input
              id={id("licence")}
              name="licenceLast4"
              maxLength={4}
              required={requireId}
              defaultValue={defaults?.licenceLast4 ?? ""}
            />
          </div>
        </fieldset>
      )}
      <div className="space-y-1.5">
        <Label htmlFor={id("notes")}>Notes</Label>
        <Textarea id={id("notes")} name="notes" defaultValue={defaults?.notes ?? ""} className="min-h-16" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={id("photos")}>Photos</Label>
        <Input id={id("photos")} name="photos" type="file" accept="image/*" capture="environment" multiple />
      </div>
      <Button type="submit" disabled={pending}>
        Save {kind === "CHECK_OUT" ? "check-out" : "check-in"}
      </Button>
      {kind === "CHECK_IN" && (
        <p className="text-xs text-muted-foreground">
          Saving sets the status to “Returned – OK” (deposit released) or “Returned – damage” if the condition is
          Damaged.
        </p>
      )}
    </form>
  );
}

export function ManualPaymentForm({ bookingId }: { bookingId: string }) {
  const { run, pending } = useAdminAction();
  const [amount, setAmount] = useState("");
  return (
    <div className="flex items-end gap-2">
      <div className="space-y-1.5">
        <Label htmlFor="manual-amount">Record cash / e-transfer (CAD)</Label>
        <Input
          id="manual-amount"
          inputMode="decimal"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
          className="w-40"
        />
      </div>
      <Button
        variant="outline"
        disabled={pending || !amount}
        onClick={() => run(() => recordManualPaymentAction(bookingId, amount))}
      >
        Record
      </Button>
    </div>
  );
}

export function AcceptanceLinkControls({ bookingId, url }: { bookingId: string; url: string }) {
  const { run, pending } = useAdminAction();
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" disabled={pending} onClick={() => run(() => sendAcceptanceLinkAction(bookingId))}>
        Send link to customer
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={async () => {
          await navigator.clipboard.writeText(url);
          setCopied(true);
        }}
      >
        {copied ? "Copied ✓" : "Copy link"}
      </Button>
    </div>
  );
}
