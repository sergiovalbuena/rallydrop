export type BookingErrorCode =
  | "SLOT_TAKEN"
  | "SLOT_NOT_ALLOWED"
  | "NOT_FOUND"
  | "CUSTOMER_BLOCKED"
  | "INVALID_STATE"
  | "NO_SESSIONS_LEFT"
  | "GROUP_FULL"
  | "PAYMENT_FAILED"
  | "INVALID_PROMO"
  | "DELIVERY_UNAVAILABLE"
  | "TERMS_REQUIRED";

export class BookingError extends Error {
  constructor(
    public readonly code: BookingErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "BookingError";
  }
}

/**
 * True when Postgres rejected an insert/update because of the occupancy
 * exclusion constraint (SQLSTATE 23P01). Driver adapters wrap the original
 * error in different shapes, so we look at the whole chain.
 */
export function isOverlapError(error: unknown): boolean {
  const seen = new Set<unknown>();
  let current: unknown = error;
  while (current && typeof current === "object" && !seen.has(current)) {
    seen.add(current);
    const text = safeStringify(current);
    if (text.includes("23P01") || text.includes("MachineOccupancy_no_overlap")) return true;
    if (current instanceof Error && current.message.includes("MachineOccupancy_no_overlap")) return true;
    current = (current as { cause?: unknown }).cause;
  }
  return false;
}

/** True for unique-constraint violations (Prisma P2002 / SQLSTATE 23505). */
export function isUniqueViolation(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  if ((error as { code?: unknown }).code === "P2002") return true;
  const text = safeStringify(error);
  return text.includes("P2002") || text.includes("23505");
}

function safeStringify(value: object): string {
  try {
    const props = Object.getOwnPropertyNames(value).reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = (value as Record<string, unknown>)[key];
      return acc;
    }, {});
    return JSON.stringify(props);
  } catch {
    return String(value);
  }
}
