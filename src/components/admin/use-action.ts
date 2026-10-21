"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

type Result = { ok: true; message?: string } | { ok: false; error: string };

/** Runs a server action, shows a toast and refreshes the page data. */
export function useAdminAction() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  async function run(fn: () => Promise<Result>, success = "Saved."): Promise<boolean> {
    setPending(true);
    try {
      const r = await fn();
      if (r.ok) {
        toast.success(r.message ?? success);
        router.refresh();
        return true;
      }
      toast.error(r.error);
      return false;
    } catch {
      toast.error("Something went wrong.");
      return false;
    } finally {
      setPending(false);
    }
  }
  return { run, pending };
}
