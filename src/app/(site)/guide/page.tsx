import type { Metadata } from "next";
import Link from "next/link";
import {
  BatteryCharging,
  CircleAlert,
  CloudRain,
  Download,
  Mic,
  PackageCheck,
  Power,
  ScanEye,
  ShieldAlert,
  Smartphone,
  Target,
  Wrench,
} from "lucide-react";
import { PageHero, Section } from "@/components/marketing/section";
import { PhotoSlot } from "@/components/marketing/photo-slot";
import { Button } from "@/components/ui/button";
import { GUIDE_MEDIA } from "@/config/photos";
import { formatCentsShort } from "@/lib/money";
import { publicPolicies } from "@/lib/services/public-data";
import { PrintButton } from "./print-button";

export const metadata: Metadata = {
  title: "PONGBOT Aura S quick-start guide",
  description:
    "Power on, load the balls, pair the app, run your first drill, use the Spotter AI camera and voice commands, fix a jam and return the machine.",
};

/** Same content as the downloadable PDF in public/guides (re-export it from this page when the text changes). */
const GUIDE_PDF = "/guides/rallydrop-aura-s-quick-start.pdf";

export default async function GuidePage() {
  const p = await publicPolicies();
  const steps = [
    {
      id: "power",
      icon: Power,
      title: "Power on",
      body: [
        "Check the battery is clicked fully into place.",
        "Press and hold the power button for about 2 seconds until the light comes on.",
        "We hand it over fully charged: up to 5 hours of play.",
      ],
    },
    {
      id: "balls",
      icon: BatteryCharging,
      title: "Load the balls",
      body: [
        "Up to 120 tennis balls. Don't fill above the rim of the hopper.",
        "Only clean, dry balls. Wet, flat or bald balls jam and fly unpredictably.",
      ],
    },
    {
      id: "app",
      icon: Smartphone,
      title: "Pair the app",
      body: [
        "Install the PONGBOT app (App Store or Google Play) and turn on Bluetooth.",
        "Tap Add device and pick the Aura S. Keep your phone within a few metres the first time.",
        "Playing with friends? One phone controls the machine at a time.",
      ],
    },
    {
      id: "drill",
      icon: Target,
      title: "Your first drill",
      body: [
        "Put the machine in the middle of the baseline, on a flat surface, at least 1 m from fences.",
        "Start a preset baseline rally at a slow speed (30–40 km/h) and a slow feed. Stand to the side when you press start.",
        "Speed up little by little once you're grooving the ball.",
      ],
    },
    {
      id: "spotter",
      icon: ScanEye,
      title: "The Spotter AI camera",
      body: [
        "Mount the Spotter on the machine and open Spotter in the app: it tracks you and the ball, gives tips and builds a movement heatmap.",
        "For a match with friends, set it by the net to call lines and keep score.",
        "Recordings stay on your phone and in the PONGBOT app — RallyDrop never sees them. Ask before filming other people.",
      ],
    },
    {
      id: "voice",
      icon: Mic,
      title: "Voice commands",
      body: [
        "With the app open, just say what you want: “start”, “stop”, “faster”, “slower”.",
        "Shape the ball: “more topspin”, “more slice”, “wider angle”, “deeper”.",
        "“Stop” always works first — use it whenever someone walks onto the court.",
      ],
    },
    {
      id: "jam",
      icon: Wrench,
      title: "If a ball jams",
      body: [
        "Pause in the app, then switch the machine off and wait until the wheels stop.",
        "Remove the stuck ball by hand — only with the power off. Take out wet or damaged balls and restart.",
        "Never open the casing or the Spotter. Still stuck, or an error light? Stop and contact us.",
      ],
    },
    {
      id: "return",
      icon: PackageCheck,
      title: "Giving it back",
      body: [
        "Power off, collect the balls and wipe the machine dry.",
        "Pack everything we gave you: machine, Spotter module, battery, charger and the ball bucket.",
        `Be there at your collection time, or return it downtown at the time on your booking. After a ${p.lateGraceMinutes}-minute grace period, late returns are ${formatCentsShort(p.lateHourlyCents)}/hour, up to one day's price.`,
      ],
    },
  ];

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
        <nav aria-label="Guide steps" className="mb-8 flex flex-wrap gap-2 print:hidden">
          {[
            ...steps.map((s, i) => ({ id: s.id, title: `${i + 1}. ${s.title}` })),
            { id: "safety", title: "Safety" },
          ].map((s) => (
            <a key={s.id} href={`#${s.id}`} className="rounded-full border px-3 py-1 text-sm hover:bg-secondary">
              {s.title}
            </a>
          ))}
        </nav>
        <ol className="grid gap-4 md:grid-cols-2 print:grid-cols-2">
          {steps.map((s, i) => (
            <li
              key={s.id}
              id={s.id}
              className="flex scroll-mt-24 break-inside-avoid flex-col gap-4 rounded-2xl border bg-card p-5"
            >
              <div className="flex gap-4">
                <s.icon className="size-7 shrink-0 text-primary" aria-hidden />
                <div>
                  <h2 className="font-display text-2xl font-extrabold uppercase">
                    {i + 1}. {s.title}
                  </h2>
                  <ul className="mt-2 list-disc space-y-1 pl-4 text-muted-foreground">
                    {s.body.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="mt-auto grid grid-cols-2 gap-3 print:hidden">
                <PhotoSlot
                  media={GUIDE_MEDIA[s.id]?.photo ?? null}
                  label={s.title}
                  sizes="(min-width: 768px) 20vw, 45vw"
                  className="aspect-video"
                />
                <PhotoSlot
                  kind="video"
                  media={GUIDE_MEDIA[s.id]?.video ?? null}
                  label={s.title}
                  sizes="(min-width: 768px) 20vw, 45vw"
                  className="aspect-video"
                />
              </div>
            </li>
          ))}
        </ol>
        <div className="mt-8 grid gap-4 md:grid-cols-2 print:grid-cols-2">
          <div
            id="safety"
            className="flex scroll-mt-24 break-inside-avoid gap-3 rounded-2xl border border-destructive/30 bg-destructive/5 p-5"
          >
            <ShieldAlert className="size-6 shrink-0 text-destructive" aria-hidden />
            <div>
              <h2 className="font-display text-2xl font-extrabold uppercase">Safety</h2>
              <ul className="mt-2 list-disc space-y-1 pl-4">
                <li>Never stand or walk in front of the machine while it&apos;s on.</li>
                <li>Switch it off before collecting balls, clearing a jam or moving it.</li>
                <li>Keep children, pets and bystanders out of the line of fire.</li>
                <li>Renters must be 19+ and are responsible for everyone who uses the machine.</li>
                <li>Delivered next to a court, never on it — carry it on yourself.</li>
              </ul>
            </div>
          </div>
          <div className="flex break-inside-avoid gap-3 rounded-2xl border p-5">
            <CloudRain className="size-6 shrink-0 text-primary" aria-hidden />
            <p>
              <strong>Rain:</strong> stop, switch off and keep the machine dry — never use it on a wet court. Rain on
              your start day? Open{" "}
              <Link href="/account" className="text-primary underline">
                My bookings
              </Link>{" "}
              to reschedule free or take a credit.
            </p>
          </div>
          <div className="flex break-inside-avoid gap-3 rounded-2xl border p-5 md:col-span-2">
            <CircleAlert className="size-6 shrink-0 text-primary" aria-hidden />
            <p>
              Something not right?{" "}
              <Link href="/contact" className="text-primary underline">
                Contact us
              </Link>{" "}
              — don&apos;t try to repair the machine yourself.
            </p>
          </div>
        </div>
      </Section>
    </>
  );
}
