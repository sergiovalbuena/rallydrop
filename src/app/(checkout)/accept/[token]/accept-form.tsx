"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { CircleCheck, TriangleAlert } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  EMPTY_CONSENT,
  TermsConsent,
  consentBoxes,
  type ConsentDocs,
  type ConsentValue,
} from "@/components/legal/terms-consent";
import { acceptViaLinkAction } from "./actions";

export function AcceptForm({ token, docs }: { token: string; docs: ConsentDocs }) {
  const t = useTranslations("accept");
  const [consent, setConsent] = useState<ConsentValue>(EMPTY_CONSENT);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ok = consent.terms_waiver && consent.age_19;

  if (done) {
    return (
      <p className="flex items-center gap-2 rounded-2xl bg-success/10 p-4 font-medium text-success" role="status">
        <CircleCheck className="size-5 shrink-0" aria-hidden /> {t("done")}
      </p>
    );
  }
  return (
    <div className="space-y-4">
      <TermsConsent docs={docs} value={consent} onChange={setConsent} />
      {error && (
        <Alert variant="destructive">
          <TriangleAlert />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      <Button
        size="lg"
        className="w-full"
        disabled={!ok || pending}
        onClick={() =>
          start(async () => {
            const r = await acceptViaLinkAction(token, {
              termsId: docs.terms.id,
              waiverId: docs.waiver.id,
              boxes: consentBoxes(consent),
            });
            if (r.ok) setDone(true);
            else setError(r.error);
          })
        }
      >
        {pending ? t("saving") : t("cta")}
      </Button>
    </div>
  );
}
