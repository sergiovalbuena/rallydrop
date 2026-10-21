import type { Metadata } from "next";
import { BatteryCharging, CircleAlert, CloudRain, Power, Smartphone, Target } from "lucide-react";
import { PageHero, Section } from "@/components/marketing/section";
import { PrintButton } from "./print-button";

export const metadata: Metadata = { title: "Quick-start guide" };

const STEPS = [
  {
    icon: Target,
    title: "1. Position",
    body: "Place the machine behind the baseline, centred, on a flat surface. Keep it at least 1 m from fences.",
  },
  {
    icon: Power,
    title: "2. Load & power on",
    body: "Fill the hopper with pressureless balls (no more than the top ring). Press and hold the power button for 2 seconds.",
  },
  {
    icon: Smartphone,
    title: "3. Connect the app",
    body: "Open the PONGBOT app, turn on Bluetooth and pick your machine. Start with a slow speed and low frequency.",
  },
  {
    icon: Target,
    title: "4. Pick a drill",
    body: "Try the preset drills (baseline rally, volleys, random) or build your own. Use the remote to pause anytime.",
  },
  {
    icon: BatteryCharging,
    title: "5. Battery",
    body: "A full charge lasts around 2–3 hours. The indicator turns red at ~15%. We deliver it fully charged.",
  },
  {
    icon: Power,
    title: "6. Finish",
    body: "Pause, power off, collect the balls back into the bucket and keep the machine dry until pickup.",
  },
];

export default function GuidePage() {
  return (
    <>
      <PageHero title="Quick-start guide" subtitle="Everything you need to start hitting in five minutes.">
        <PrintButton />
      </PageHero>
      <Section className="print:py-4">
        <ol className="grid gap-4 md:grid-cols-2 print:grid-cols-2">
          {STEPS.map((s) => (
            <li key={s.title} className="flex break-inside-avoid gap-4 rounded-2xl border bg-card p-5">
              <s.icon className="size-7 shrink-0 text-primary" aria-hidden />
              <div>
                <h2 className="font-display text-2xl font-extrabold uppercase">{s.title}</h2>
                <p className="mt-1 text-muted-foreground">{s.body}</p>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-8 grid gap-4 md:grid-cols-2">
          <div className="flex gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
            <CircleAlert className="size-6 shrink-0 text-destructive" aria-hidden />
            <p>
              <strong>Safety:</strong> never stand in front of the machine or look into the launcher while it&apos;s on.
              Keep children and pets away.
            </p>
          </div>
          <div className="flex gap-3 rounded-2xl border p-5">
            <CloudRain className="size-6 shrink-0 text-primary" aria-hidden />
            <p>
              <strong>Rain:</strong> stop and cover the machine. Water damage isn&apos;t normal wear — message us and
              we&apos;ll reschedule.
            </p>
          </div>
        </div>
      </Section>
    </>
  );
}
