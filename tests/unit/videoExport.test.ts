import { describe, expect, it } from "vitest";
import { normalizeEventRange } from "../../shared/time";
import { buildFfmpegArgs } from "../../electron/services/projectStore";

describe("video export helpers", () => {
  it("normalizes invalid time ranges", () => {
    const range = normalizeEventRange(5000, 3000);
    expect(range.startMs).toBe(3000);
    expect(range.endMs).toBe(5000);
  });

  it("generates ffmpeg concat command", () => {
    const args = buildFfmpegArgs(
      [
        { sourcePath: "/tmp/a.mp4", startMs: 1000, endMs: 2500 },
        { sourcePath: "/tmp/b.mp4", startMs: 4000, endMs: 7000 },
      ],
      "/tmp/out.mp4",
      true,
    );
    expect(args).toContain("-filter_complex");
    expect(args.join(" ")).toContain("concat=n=2");
    expect(args.join(" ")).toContain("drawbox");
  });

  it("fails when clip list is empty", () => {
    expect(() => buildFfmpegArgs([], "/tmp/out.mp4", false)).toThrow("No clips to render");
  });
});
