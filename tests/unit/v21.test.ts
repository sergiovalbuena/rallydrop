import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { holdLapsesBeforeReturn, planDeposit } from "@/lib/domain/deposit";
import { inPassWindow, passWindow, passesLeft } from "@/lib/domain/spring-pass";
import { specsWithoutPickleball } from "@/lib/domain/sports";

const d = (iso: string) => new Date(iso);

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === "generated" ? [] : files(path);
    return /\.(tsx?|json)$/.test(name) ? [path] : [];
  });
}

describe("RallyDrop only rents the machine", () => {
  it("has no group sessions, lessons, human coach or pre-launch mode left", () => {
    const banned =
      /group[ _-]?session|GroupSession|groupEnrollment|private lesson|group lesson|meet your coach|coach profile|pre-?launch|early ?bird/i;
    const offenders = [...files("src"), "messages/en.json", "prisma/schema.prisma"].filter((f) =>
      banned.test(readFileSync(f, "utf8")),
    );
    expect(offenders).toEqual([]);
  });
});

describe("deposit timing", () => {
  const plan = (startsAt: string, hours: number, now: string) =>
    planDeposit({
      startsAt: d(startsAt),
      endsAt: new Date(d(startsAt).getTime() + hours * 3_600_000),
      now: d(now),
      authMaxDays: 6,
      leadHours: 24,
    });

  it("holds day and weekend rentals 24 h before the start, or right away inside 24 h", () => {
    expect(plan("2027-05-20T17:00:00Z", 25, "2027-05-10T17:00:00Z")).toEqual({
      strategy: "AUTH_HOLD",
      placeNow: false,
      authScheduledFor: d("2027-05-19T17:00:00Z"),
    });
    expect(plan("2027-05-20T17:00:00Z", 48, "2027-05-20T08:00:00Z")).toMatchObject({ placeNow: true });
  });

  it("never holds week and month rentals (saved card only)", () => {
    expect(plan("2027-05-20T17:00:00Z", 168, "2027-05-20T08:00:00Z").strategy).toBe("SAVED_CARD");
    expect(plan("2027-05-20T17:00:00Z", 720, "2027-05-01T08:00:00Z").strategy).toBe("SAVED_CARD");
  });

  it("flags holds that lapse before the machine is back and inspected", () => {
    const ends = d("2027-05-22T17:00:00Z");
    expect(holdLapsesBeforeReturn(d("2027-05-22T20:00:00Z"), ends)).toBe(true);
    expect(holdLapsesBeforeReturn(d("2027-05-24T12:00:00Z"), ends)).toBe(false);
    expect(holdLapsesBeforeReturn(null, ends)).toBe(false);
  });
});

describe("pickleball switch", () => {
  it("drops pickleball rows and mentions from the specs", () => {
    expect(
      specsWithoutPickleball([
        { label: "Capacity", value: "120 tennis balls · 100 pickleballs" },
        { label: "Pickleball", value: "Plays pickleball too" },
        { label: "Speed", value: "Up to 100 km/h" },
      ]),
    ).toEqual([
      { label: "Capacity", value: "120 tennis balls" },
      { label: "Speed", value: "Up to 100 km/h" },
    ]);
  });
});

describe("Spring Pass", () => {
  const s = { springPassEnabled: true, springPassLimit: 20, springPassStart: "04-01", springPassEnd: "06-30" };

  it("is for this spring, or next spring once this one is over", () => {
    expect(passWindow(s, "2027-01-15")).toEqual({ from: "2027-04-01", to: "2027-06-30" });
    expect(passWindow(s, "2027-05-15")).toEqual({ from: "2027-04-01", to: "2027-06-30" });
    expect(passWindow(s, "2027-07-01")).toEqual({ from: "2028-04-01", to: "2028-06-30" });
  });

  it("isn't sold when switched off, and stops at the limit", () => {
    expect(passesLeft({ ...s, springPassEnabled: false }, 0)).toBeNull();
    expect(passesLeft(s, 18)).toBe(2);
    expect(passesLeft(s, 25)).toBe(0);
  });

  it("only takes weekends that start inside the window", () => {
    const pass = { validFrom: "2027-04-01", validTo: "2027-06-30" };
    expect(inPassWindow("2027-04-01", pass)).toBe(true);
    expect(inPassWindow("2027-06-30", pass)).toBe(true);
    expect(inPassWindow("2027-07-02", pass)).toBe(false);
  });
});
