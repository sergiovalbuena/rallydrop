import "server-only";
import { db } from "@/lib/db";
import { sendEmail } from "@/lib/notify/email";
import { waitlistEmail } from "@/lib/notify/templates";
import { isUniqueViolation } from "./errors";

/** What the person agrees to; stored with each sign-up as proof of consent (CASL). */
export const WAITLIST_CONSENT = "Email me when this machine is available to rent. Unsubscribe anytime.";
export const NEW_MACHINES_CONSENT = "Email me when RallyDrop adds a new machine. Unsubscribe anytime.";

export type WaitlistResult = { ok: true; already: boolean } | { ok: false; error: string };

export async function joinWaitlist(input: {
  /** Empty or missing = new machines in general. */
  machineId?: string | null;
  email: string;
  source?: string;
}): Promise<WaitlistResult> {
  const email = input.email.trim().toLowerCase();
  if (!input.machineId) return joinNewMachines(email, input.source);
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

/** "Get notified about new machines" (no specific machine). */
async function joinNewMachines(email: string, source?: string): Promise<WaitlistResult> {
  // machineId is null here, so the unique index doesn't apply: check first.
  if (await db.waitlistSignup.findFirst({ where: { machineId: null, email } })) return { ok: true, already: true };
  await db.waitlistSignup.create({
    data: { machineId: null, email, source: source ?? null, consent: NEW_MACHINES_CONSENT },
  });
  await sendEmail({
    to: email,
    template: "waitlist_joined",
    dedupeKey: `waitlist:new:${email}`,
    content: waitlistEmail({ machineName: "next machine" }),
  }).catch((e) => console.error("waitlist email", e));
  return { ok: true, already: false };
}

/** Admin: sign-ups per machine (newest first) and how many came in the last 7 days. */
export async function waitlistSummary(now = new Date()) {
  const [machines, general] = await Promise.all([
    waitlistByMachine(),
    db.waitlistSignup.findMany({
      where: { machineId: null },
      orderBy: { createdAt: "desc" },
      select: { id: true, email: true, source: true, createdAt: true, notifiedAt: true },
    }),
  ]);
  const since = now.getTime() - 7 * 86_400_000;
  const all = [...machines.flatMap((m) => m.waitlist), ...general];
  return {
    machines,
    general,
    total: all.length,
    lastWeek: all.filter((w) => w.createdAt.getTime() >= since).length,
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
