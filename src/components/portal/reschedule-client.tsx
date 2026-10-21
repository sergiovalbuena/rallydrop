"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { DateTimePicker } from "@/components/booking/date-time-picker";
import type { Slot } from "@/components/booking/types";
import { Button } from "@/components/ui/button";
import { rescheduleAction } from "@/app/(site)/account/actions";

export function RescheduleClient({
  bookingId,
  productId,
  machineId,
}: {
  bookingId: string;
  productId: string;
  machineId: string;
}) {
  const router = useRouter();
  const [when, setWhen] = useState<{ date: string | null; slot: Slot | null }>({ date: null, slot: null });
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-6">
      <DateTimePicker
        productId={productId}
        machineId={machineId}
        excludeBookingId={bookingId}
        value={when}
        onChange={setWhen}
      />
      <Button
        size="lg"
        disabled={!when.slot || busy}
        onClick={async () => {
          if (!when.slot) return;
          setBusy(true);
          const r = await rescheduleAction(bookingId, when.slot.start);
          setBusy(false);
          if (r.ok) {
            toast.success("Booking moved.");
            router.push("/account");
          } else toast.error(r.error);
        }}
      >
        Confirm new time
      </Button>
    </div>
  );
}
