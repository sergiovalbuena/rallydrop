import "server-only";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/notify/email";
import { waitlistEmail } from "@/lib/notify/templates";
import { isUniqueViolation } from "./errors";

/** What the person agrees to; stored with each sign-up as proof of consent (CASL). */
export const WAITLIST_CONSENT = "Email me when this machine is available to rent. Unsubscribe anytime.";

export type WaitlistResult = { ok: true; already: boolean } | { ok: false; error: string };

export async function joinWaitlist(input: {
  machineId: string;
  email: string;
  source?: string;
}): Promise<WaitlistResult> {
  const email = input.email.trim().toLowerCase();
  const machine = await db.machine.findUnique({
    where: { id: input.machineId },
    select: { id: true, name: true, bookable: true, status: true },
  });
  if (!machine || machine.status === "RETIRED") return { ok: false, error: "That machine isn't listed anymore." };
  try {
    await db.waitlistSignup.create({
      data: { machineId: machine.id, email, source: input.source ?? null, consent: WAITLIST_CONSENT },
    });
  } catch (e) {
    if (isUniqueViolation(e)) return { ok: true, already: true };
    throw e;
  }
  await sendEmail({
    to: email,
    template: "waitlist_joined",
    dedupeKey: `waitlist:${machine.id}:${email}`,
    content: waitlistEmail({ machineName: machine.name }),
  }).catch((e) => console.error("waitlist email", e));
  return { ok: true, already: false };
}

/** Admin: sign-ups per machine (newest first) and how many came in the last 7 days. */
export async function waitlistSummary(now = new Date()) {
  const machines = await waitlistByMachine();
  const since = now.getTime() - 7 * 86_400_000;
  return {
    machines,
    total: machines.reduce((s, m) => s + m.waitlist.length, 0),
    lastWeek: machines.reduce((s, m) => s + m.waitlist.filter((w) => w.createdAt.getTime() >= since).length, 0),
  };
}

async function waitlistByMachine() {
  const machines = await db.machine.findMany({
    where: { waitlist: { some: {} } },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      bookable: true,
      waitlist: {
        orderBy: { createdAt: "desc" },
        select: { id: true, email: true, source: true, createdAt: true, notifiedAt: true },
      },
    },
  });
  return machines;
}
