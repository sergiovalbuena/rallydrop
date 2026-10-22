"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import { FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { ConsentBox } from "@/lib/domain/legal";
import { LegalText } from "./legal-text";

export type ConsentDoc = { id: string; version: string; title: string; body: string };
export type ConsentDocs = { terms: ConsentDoc; waiver: ConsentDoc };
export type ConsentValue = Record<ConsentBox, boolean>;

export const EMPTY_CONSENT: ConsentValue = { terms_waiver: false, age_19: false };

export function consentBoxes(v: ConsentValue): ConsentBox[] {
  return (Object.keys(v) as ConsentBox[]).filter((k) => v[k]);
}

/**
 * Last thing before paying: key terms in five bullets, then two required,
 * unticked boxes. The full documents open in a modal so the customer never
 * leaves checkout. No signature, no retyping the name (clickwrap).
 */
export function TermsConsent({
  docs,
  value,
  onChange,
  depositNote,
  showSummary = true,
}: {
  docs: ConsentDocs;
  value: ConsentValue;
  onChange: (v: ConsentValue) => void;
  /** e.g. "400 CAD hold" — shown in the deposit bullet. */
  depositNote?: string;
  showSummary?: boolean;
}) {
  const t = useTranslations("consent");
  const id = useId();
  const [open, setOpen] = useState<ConsentDoc | null>(null);
  const missing = !value.terms_waiver || !value.age_19;

  const DocLink = ({ doc, label }: { doc: ConsentDoc; label: string }) => (
    <button
      type="button"
      onClick={() => setOpen(doc)}
      className="font-semibold text-primary underline underline-offset-2 hover:no-underline"
    >
      {label}
    </button>
  );

  return (
    <div className="space-y-4 rounded-2xl border bg-muted/30 p-4 sm:p-5">
      {showSummary && (
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold">
            <FileText className="size-4 text-primary" aria-hidden /> {t("summaryTitle")}
          </p>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            <li>{t("bulletDeposit", { deposit: depositNote ?? t("depositDefault") })}</li>
            <li>{t("bulletDamage")}</li>
            <li>{t("bulletRain")}</li>
            <li>{t("bulletLate")}</li>
            <li>{t("bulletCancel")}</li>
          </ul>
        </div>
      )}

      <div className="space-y-3">
        <label htmlFor={`${id}-terms`} className="flex cursor-pointer items-start gap-3 text-sm">
          <Checkbox
            id={`${id}-terms`}
            checked={value.terms_waiver}
            onCheckedChange={(c) => onChange({ ...value, terms_waiver: c === true })}
            className="mt-0.5"
            aria-required
          />
          <span>
            {t.rich("agree", {
              terms: () => <DocLink doc={docs.terms} label={t("termsLink")} />,
              waiver: () => <DocLink doc={docs.waiver} label={t("waiverLink")} />,
            })}
          </span>
        </label>
        <label htmlFor={`${id}-age`} className="flex cursor-pointer items-start gap-3 text-sm">
          <Checkbox
            id={`${id}-age`}
            checked={value.age_19}
            onCheckedChange={(c) => onChange({ ...value, age_19: c === true })}
            className="mt-0.5"
            aria-required
          />
          <span>{t.rich("age", { b: (chunks) => <strong>{chunks}</strong> })}</span>
        </label>
      </div>
      {missing && (
        <p className="text-xs font-medium text-muted-foreground" role="status">
          {t("missing")}
        </p>
      )}

      <Dialog open={!!open} onOpenChange={(o) => !o && setOpen(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="pr-6 text-xl uppercase">{open?.title}</DialogTitle>
            <p className="text-xs text-muted-foreground">{t("version", { version: open?.version ?? "" })}</p>
          </DialogHeader>
          {open && <LegalText body={open.body} className="legal-prose text-sm" />}
          <DialogClose asChild>
            <Button variant="outline" className="justify-self-end">
              {t("close")}
            </Button>
          </DialogClose>
        </DialogContent>
      </Dialog>
    </div>
  );
}
