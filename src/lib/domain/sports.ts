/*
 * Pickleball is unlocked separately on the Aura S (Settings.pickleballEnabled).
 * When it's off, the word disappears from everything the site shows.
 */

type Spec = { label: string; value: string };

/** Drops pickleball from a spec list: whole rows about it, or " · …" parts mentioning it. */
export function specsWithoutPickleball(specs: Spec[]): Spec[] {
  return specs.flatMap((s) => {
    if (/pickleball/i.test(s.label)) return [];
    const parts = s.value.split(" · ").filter((p) => !/pickleball/i.test(p));
    return parts.length ? [{ ...s, value: parts.join(" · ") }] : [];
  });
}

export function forSports<M extends { sports: string[]; specs: Spec[] }>(machine: M, pickleballEnabled: boolean): M {
  if (pickleballEnabled) return machine;
  return {
    ...machine,
    sports: machine.sports.filter((s) => s !== "PICKLEBALL") as M["sports"],
    specs: specsWithoutPickleball(machine.specs),
  };
}
