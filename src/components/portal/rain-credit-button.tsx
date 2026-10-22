"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { rainCreditAction } from "@/app/(site)/account/actions";

export function RainCreditButton({ bookingId, code }: { bookingId: string; code: string }) {
  const t = useTranslations("rain");
  const tc = useTranslations("common");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="mt-auto">
          {t("creditCta")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("creditConfirm", { code })}</DialogTitle>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">{tc("back")}</Button>
          </DialogClose>
          <Button
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              const r = await rainCreditAction(bookingId);
              setBusy(false);
              setOpen(false);
              if (r.ok) {
                toast.success(t("done"));
                router.push("/account");
              } else toast.error(r.error);
            }}
          >
            {t("creditCta")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
