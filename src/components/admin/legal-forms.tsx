"use client";

import { useActionState, useEffect, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  markReviewedAction,
  publishLegalVersionAction,
  saveLegalVersionAction,
  type LegalState,
} from "@/app/admin/(panel)/legal/actions";

export function NewLegalVersionForm({
  kind,
  title,
  body,
  suggestedVersion,
}: {
  kind: "TERMS" | "WAIVER";
  title: string;
  body: string;
  suggestedVersion: string;
}) {
  const [state, action, pending] = useActionState<LegalState, FormData>(saveLegalVersionAction, { ok: false });
  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.message) toast.success(state.message);
  }, [state]);
  const id = (s: string) => `${kind}-${s}`;
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="kind" value={kind} />
      <div className="grid gap-3 sm:grid-cols-[180px_1fr]">
        <div className="space-y-1.5">
          <Label htmlFor={id("version")}>New version</Label>
          <Input id={id("version")} name="version" defaultValue={suggestedVersion} required />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor={id("title")}>Title</Label>
          <Input id={id("title")} name="title" defaultValue={title} required />
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor={id("body")}>Text</Label>
        <Textarea id={id("body")} name="body" defaultValue={body} className="min-h-96 font-mono text-xs" required />
        <p className="text-xs text-muted-foreground">
          Formatting: “## ” for headings, “- ” for list items, **bold**, [link](https://…). A blank line starts a new
          paragraph.
        </p>
      </div>
      <div className="flex flex-wrap gap-4 text-sm">
        <label className="flex items-center gap-2">
          <input type="checkbox" name="reviewed" className="size-4 accent-primary" />
          Reviewed by a BC lawyer
        </label>
        <label className="flex items-center gap-2">
          <input type="checkbox" name="publish" className="size-4 accent-primary" />
          Publish now (becomes the live version)
        </label>
      </div>
      <Button type="submit" disabled={pending}>
        Save new version
      </Button>
    </form>
  );
}

export function LegalVersionActions({ id, published, draft }: { id: string; published: boolean; draft: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2">
      {!published && (
        <Button size="sm" disabled={pending} onClick={() => start(() => publishLegalVersionAction(id))}>
          Publish
        </Button>
      )}
      {draft && (
        <Button size="sm" variant="outline" disabled={pending} onClick={() => start(() => markReviewedAction(id))}>
          Mark lawyer-reviewed
        </Button>
      )}
    </div>
  );
}
