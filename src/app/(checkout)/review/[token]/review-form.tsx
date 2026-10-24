"use client";

import { useActionState } from "react";
import { CircleCheck, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitReviewAction, type ReviewState } from "./actions";

/** Stars + a few words. Saved hidden; the owner publishes it from Admin → Reviews. */
export function ReviewForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(submitReviewAction, { status: "idle" });
  if (state.status === "done") {
    return (
      <p className="flex items-center gap-2 rounded-2xl bg-success/10 p-4 font-medium text-success" role="status">
        <CircleCheck className="size-5 shrink-0" aria-hidden /> Thanks for the review! It means a lot to a small local
        business.
      </p>
    );
  }
  return (
    <form action={action} className="space-y-5 rounded-2xl border bg-card p-6">
      <input type="hidden" name="token" value={token} />
      <fieldset>
        <legend className="mb-2 text-sm font-medium">Your rating</legend>
        {/* Reversed order + peer selectors: hovering/checking a star lights it and the ones before it. */}
        <div className="flex flex-row-reverse justify-end gap-1">
          {[5, 4, 3, 2, 1].map((n) => (
            <label
              key={n}
              className="group/star peer cursor-pointer text-muted-foreground peer-hover:text-warning peer-has-checked:text-warning hover:text-warning has-checked:text-warning"
            >
              <input type="radio" name="rating" value={n} defaultChecked={n === 5} required className="sr-only" />
              <Star className="size-9 fill-current" aria-hidden />
              <span className="sr-only">{n} stars</span>
            </label>
          ))}
        </div>
      </fieldset>
      <div className="space-y-2">
        <Label htmlFor="review-text">Your review</Label>
        <Textarea id="review-text" name="text" rows={4} maxLength={1000} required placeholder="What was it like?" />
      </div>
      {state.status === "error" && (
        <p className="text-sm text-destructive" role="alert">
          {state.message}
        </p>
      )}
      <Button type="submit" disabled={pending}>
        {pending ? "Sending…" : "Send review"}
      </Button>
    </form>
  );
}
