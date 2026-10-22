import { describe, expect, it } from "vitest";
import { CONSENT_BOXES, consentComplete, sha256 } from "@/lib/domain/legal";

describe("clickwrap consent", () => {
  it("needs both boxes", () => {
    expect(consentComplete([])).toBe(false);
    expect(consentComplete(["terms_waiver"])).toBe(false);
    expect(consentComplete(["age_19"])).toBe(false);
    expect(consentComplete([...CONSENT_BOXES])).toBe(true);
  });

  it("hashes documents with SHA-256", () => {
    expect(sha256("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(sha256("a")).not.toBe(sha256("a "));
  });
});
