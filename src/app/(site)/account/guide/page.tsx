import type { Metadata } from "next";
import {
  BatteryCharging,
  CircleAlert,
  CloudRain,
  Download,
  PackageCheck,
  Power,
  ScanEye,
  Smartphone,
  Target,
  Wrench,
} from "lucide-react";
import { PageHero, Section } from "@/components/marketing/section";
import { Button } from "@/components/ui/button";
import { PrintButton } from "./print-button";

export const metadata: Metadata = {
  title: "PONGBOT Aura S quick-start guide",
  description: "Power on, pair the app, load the balls, run your first drill, use the Spotter AI camera and fix a jam.",
};

/** Same content as the downloadable PDF in public/guides (re-export it from this page when the text changes). */
const GUIDE_PDF = "/guides/rallydrop-aura-s-quick-start.pdf";

const STEPS = [
  {
    icon: Power,
    title: "1. Power on",
    body: [
      "Check the battery is clicked fully into place.",
      "Press and hold the power button for about 2 seconds until the light comes on.",
      "We hand it over fully charged: up to 5 hours of play. The battery swaps in seconds if you have a spare.",
    ],
  },
  {
    icon: Smartphone,
    title: "2. Pair the app",
    body: [
      "Install the PONGBOT app (App Store or Google Play) and turn on Bluetooth.",
      "Tap Add device and pick the Aura S. Keep your phone within a few metres the first time.",
      "Playing with friends? Take turns: one phone controls the machine at a time.",
    ],
  },
  {
    icon: BatteryCharging,
    title: "3. Load the balls",
    body: [
      "Up to 120 tennis balls. Don't fill above the rim of the hopper.",
      "Only clean, dry balls. Wet, flat or fuzzy-bald balls jam and fly unpredictably.",
    ],
  },
  {
    icon: Target,
    title: "4. Your first drill",
    body: [
      "Put the machine in the middle of the baseline, on a flat surface, at least 1 m from fences.",
      "Start a preset baseline rally at a slow speed (30–40 km/h) and a slow feed. Stand to the side when you press start.",
      "Speed up little by little. Voice works too: “more topspin”, “slower”, “wider angle”.",
    ],
  },
  {
    icon: ScanEye,
    title: "5. The Spotter AI camera",
    body: [
      "Mount the Spotter on the machine and open Spotter in the app: it tracks you and the ball, gives voice tips and builds a movement heatmap.",
      "For a match with friends, set it by the net to call lines and keep score.",
      "Recordings stay on your phone — RallyDrop never sees them. Ask before filming other people.",
    ],
  },
  {
    icon: Wrench,
    title: "6. If a ball jams",
    body: [
      "Pause in the app, then switch the machine off and wait until the wheels stop.",
      "Remove the stuck ball by hand — only with the power off. Take out any wet or damaged balls and restart.",
      "Never open the casing or the Spotter. Still stuck, or an error light? Stop and contact us.",
    ],
  },
  {
    icon: PackageCheck,
    title: "7. Giving it back",
    body: [
      "Power off, collect the balls and wipe the machine dry.",
      "Pack everything we gave you: machine, Spotter module, battery, charger and the ball bucket.",
      "Be there at your collection time, or return it downtown at the time on your booking. Late returns are charged one extra day.",
    ],
  },
];

export default function GuidePage() {
  return (
    <>
      <PageHero title="Quick-start guide" subtitle="PONGBOT Aura S · from the box to your first rally in five minutes.">
        <div className="mt-6 flex flex-wrap gap-2 print:hidden">
          <Button asChild variant="accent">
            <a href={GUIDE_PDF} download>
              <Download /> Download PDF
            </a>
          </Button>
          <PrintButton />
        </div>
      </PageHero>
      <Section className="print:py-4">
        <ol className="grid gap-4 md:grid-cols-2 print:grid-cols-2">
          {STEPS.map((s) => (
            <li key={s.title} className="flex break-inside-avoid gap-4 rounded-2xl border bg-card p-5">
              <s.icon className="size-7 shrink-0 text-primary" aria-hidden />
              <div>
                <h2 className="font-display text-2xl font-extrabold uppercase">{s.title}</h2>
                <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
                  {s.body.map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-8 grid gap-4 md:grid-cols-2 print:grid-cols-2">
          <div className="flex break-inside-avoid gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-5">
            <CircleAlert className="size-6 shrink-0 text-destructive" aria-hidden />
            <p>
              <strong>Safety:</strong> never stand or walk in front of the machine while it&apos;s on, and switch it off
              before collecting balls or moving it. Keep children, pets and bystanders out of the line of fire. Under
              19? Play with an adult around.
            </p>
          </div>
          <div className="flex break-inside-avoid gap-3 rounded-2xl border p-5">
            <CloudRain className="size-6 shrink-0 text-primary" aria-hidden />
            <p>
              <strong>Rain:</strong> stop, switch off and keep the machine dry — never use it on a wet court. Rain on
              your start day? Tap “Rained out?” in My bookings to reschedule free or take a credit.
            </p>
          </div>
        </div>
      </Section>
    </>
  );
}
