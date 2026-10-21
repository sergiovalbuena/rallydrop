import { randomInt } from "node:crypto";
import { brand } from "@/config/brand";

// No 0/O, 1/I/L — easy to read out over the phone.
const ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";

export function generateBookingCode(length = 5): string {
  let out = "";
  for (let i = 0; i < length; i++) out += ALPHABET[randomInt(ALPHABET.length)];
  return `${brand.codePrefix}-${out}`;
}

export function normalizeBookingCode(input: string): string {
  return input.trim().toUpperCase().replace(/\s+/g, "");
}
