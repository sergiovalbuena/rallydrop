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
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cancelPackageAction } from "@/app/(site)/account/actions";

/** Cancel at the end of the paid month — or undo it while it's pending. */
export function PackageCancel({ cancelling, endsOn }: { cancelling: boolean; endsOn: string }) {
  const t = useTranslations("portal");
  const tc = useTranslations("common");
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);

  const run = async (cancel: boolean) => {
    setBusy(true);
    const r = await cancelPackageAction(cancel);
    setBusy(false);
    setOpen(false);
    if (r.ok) {
      toast.success(cancel ? t("endsOn", { date: endsOn }) : t("keepPackage"));
      router.refresh();
    } else toast.error(r.error);
  };

  if (cancelling) {
    return (
      <Button variant="accent" disabled={busy} onClick={() => run(false)}>
        {t("keepPackage")}
      </Button>
    );
  }
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" className="text-white hover:bg-white/10 hover:text-white">
          {t("cancelPackage")}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("cancelPackage")}</DialogTitle>
          <DialogDescription>{t("cancelPackageConfirm", { date: endsOn })}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <DialogClose asChild>
            <Button variant="ghost">{tc("back")}</Button>
          </DialogClose>
          <Button variant="destructive" disabled={busy} onClick={() => run(true)}>
            {t("cancelPackage")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
