import { describe, expect, it } from "vitest";
import { turkeyDeadlineToIso, turkeyToday } from "../src/lib/assignments/deadline.ts";

describe("Türkiye deadline conversion", () => {
  it("treats the picked time as UTC+03:00 regardless of the runtime time zone", () => {
    expect(turkeyDeadlineToIso("2026-10-08", "17", "30")).toBe("2026-10-08T14:30:00.000Z");
    expect(turkeyDeadlineToIso("2026-10-09", "00", "05")).toBe("2026-10-08T21:05:00.000Z");
  });
  it("returns empty for missing or invalid parts", () => {
    expect(turkeyDeadlineToIso("", "17", "00")).toBe("");
    expect(turkeyDeadlineToIso("2026-10-08", "24", "00")).toBe("");
  });
  it("computes today's date in Türkiye", () => {
    expect(turkeyToday(new Date("2026-10-07T22:30:00Z"))).toBe("2026-10-08");
    expect(turkeyToday(new Date("2026-10-07T20:30:00Z"))).toBe("2026-10-07");
  });
});
