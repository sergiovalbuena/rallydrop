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
  captureDepositAction,
  inspectionAction,
  recordManualPaymentAction,
  refundAction,
  releaseDepositAction,
  setStatusAction,
} from "@/app/admin/(panel)/bookings/actions";
import type { BookingStatus, DepositStatus } from "@/generated/prisma/client";
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
}: {
  bookingId: string;
  status: DepositStatus;
  amount: number;
  canCharge: boolean;
}) {
  const { run, pending } = useAdminAction();
  const [captureAmount, setCaptureAmount] = useState((amount / 100).toFixed(2));
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
              if (await run(() => captureDepositAction(bookingId, captureAmount, note))) setNote("");
            }}
          >
            Charge deposit
          </Button>
          <p className="text-xs text-muted-foreground">
            A hold can only be captured once — any remaining amount is released automatically.
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

export function InspectionForm({
  bookingId,
  kind,
  defaults,
}: {
  bookingId: string;
  kind: "CHECK_OUT" | "CHECK_IN";
  defaults?: { condition: string; batteryPercent: number | null; ballsCount: number | null; notes: string | null };
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
