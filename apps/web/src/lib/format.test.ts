import { describe, expect, it } from "vitest";
import { formatFunding, formatPercent, titleCase, toCsv } from "./format";

describe("formatting", () => {
  it("formats game values", () => {
    expect(formatFunding(1250)).toMatch(/₵1.?250/);
    expect(formatPercent(0.5)).toBe("50%");
    expect(formatPercent(null)).toBe("—");
    expect(titleCase("mission_attempt")).toBe("Mission Attempt");
  });

  it("builds CSV with quoting and neutralises spreadsheet formulas", () => {
    const csv = toCsv([
      { name: 'Dr "Ama"', note: '=HYPERLINK("http://x")', n: 3 },
      { name: "+cmd", note: null, n: { a: 1 } },
    ]);
    const lines = csv.split("\r\n");
    expect(lines[0]).toBe('"name","note","n"');
    expect(lines[1]).toBe('"Dr ""Ama""","\'=HYPERLINK(""http://x"")","3"');
    expect(lines[2]).toBe('"\'+cmd","","{""a"":1}"');
    expect(toCsv([])).toBe("");
  });
});
