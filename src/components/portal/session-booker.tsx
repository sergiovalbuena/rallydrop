"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { DateTimePicker } from "@/components/booking/date-time-picker";
import type { CatalogCourt, Slot } from "@/components/booking/types";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { bookSessionAction } from "@/app/(site)/account/actions";

export function SessionBooker({ productId, courts }: { productId: string; courts: CatalogCourt[] }) {
  const router = useRouter();
  const [when, setWhen] = useState<{ date: string | null; slot: Slot | null }>({ date: null, slot: null });
  const [courtId, setCourtId] = useState(courts[0]?.id ?? "");
  const [busy, setBusy] = useState(false);
  return (
    <div className="space-y-6">
      <div className="max-w-sm space-y-2">
        <Label htmlFor="court">Court</Label>
        <NativeSelect id="court" value={courtId} onChange={(e) => setCourtId(e.target.value)}>
          {courts.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </NativeSelect>
      </div>
      <DateTimePicker productId={productId} machineId={null} value={when} onChange={setWhen} />
      <Button
        size="lg"
        disabled={!when.slot || !courtId || busy}
        onClick={async () => {
          if (!when.slot) return;
          setBusy(true);
          const r = await bookSessionAction({ startsAt: when.slot.start, courtId });
          setBusy(false);
          if (r.ok) {
            toast.success(`Session booked · ${r.message}`);
            router.push("/account");
          } else toast.error(r.error);
        }}
      >
        Book this session
      </Button>
    </div>
  );
}
