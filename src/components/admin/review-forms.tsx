"use client";

import { useActionState, useEffect, useRef, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";
import {
  createReviewAction,
  deleteReviewAction,
  setReviewPublishedAction,
  type ReviewState,
} from "@/app/admin/(panel)/reviews/actions";

export function NewReviewForm({ today }: { today: string }) {
  const [state, action, pending] = useActionState<ReviewState, FormData>(createReviewAction, { ok: false });
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.error) toast.error(state.error);
    else if (state.message) toast.success(state.message);
  }, [state]);
  return (
    <form ref={form} action={action} className="grid gap-3 sm:grid-cols-4">
      <div className="space-y-1.5 sm:col-span-2">
        <Label htmlFor="r-name">Customer (as shown)</Label>
        <Input id="r-name" name="customerName" placeholder="Alex M., Fernwood" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="r-date">Date</Label>
        <Input id="r-date" name="reviewedOn" type="date" defaultValue={today} required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="r-rating">Stars</Label>
        <NativeSelect id="r-rating" name="rating" defaultValue="5">
          {[5, 4, 3, 2, 1].map((n) => (
            <option key={n} value={n}>
              {"★".repeat(n)}
            </option>
          ))}
        </NativeSelect>
      </div>
      <div className="space-y-1.5 sm:col-span-4">
        <Label htmlFor="r-text">Review</Label>
        <Textarea id="r-text" name="text" required />
      </div>
      <label className="flex items-center gap-2 text-sm sm:col-span-3">
        <input type="checkbox" name="published" defaultChecked className="size-4 accent-primary" />
        Published (the site shows reviews once 2 or more are published)
      </label>
      <Button type="submit" disabled={pending}>
        Add review
      </Button>
    </form>
  );
}

export function ReviewActions({ id, published }: { id: string; published: boolean }) {
  const [pending, start] = useTransition();
  return (
    <div className="flex gap-2">
      <Button
        size="sm"
        variant="outline"
        disabled={pending}
        onClick={() => start(() => setReviewPublishedAction(id, !published))}
      >
        {published ? "Unpublish" : "Publish"}
      </Button>
      <Button
        size="sm"
        variant="ghost"
        disabled={pending}
        onClick={() => {
          if (confirm("Delete this review?")) start(() => deleteReviewAction(id));
        }}
      >
        Delete
      </Button>
    </div>
  );
}
