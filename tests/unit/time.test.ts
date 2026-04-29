import { describe, expect, it } from "vitest";
import { formatTimecode, normalizeEventRange, parseTimecode } from "../../shared/time";

describe("time utilities", () => {
  it("formats millisecond timecodes", () => {
    expect(formatTimecode(3_725_045, true)).toBe("01:02:05:045");
    expect(formatTimecode(65_000)).toBe("00:01:05");
  });

  it("parses valid timecodes and rejects invalid values", () => {
    expect(parseTimecode("01:02:05:045")).toBe(3_725_045);
    expect(parseTimecode("00:61:00")).toBeNull();
    expect(parseTimecode("bad")).toBeNull();
  });

  it("normalizes invalid event ranges around a fallback center", () => {
    expect(normalizeEventRange(0, 0, 20_000, 10_000)).toEqual({
      startMs: 15_000,
      endMs: 25_000,
    });
  });
});
