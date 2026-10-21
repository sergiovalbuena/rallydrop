import { describe, expect, it } from "vitest";
import { toCsv } from "@/lib/csv";

describe("csv", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(toCsv(["a", "b"], [["x,y", 'say "hi"'], ["line\nbreak", 3]])).toBe('a,b\r\n"x,y","say ""hi"""\r\n"line\nbreak",3\r\n');
  });
  it("neutralises spreadsheet formulas", () => {
    expect(toCsv(["a"], [["=HYPERLINK(1)"]])).toBe("a\r\n'=HYPERLINK(1)\r\n");
  });
});
