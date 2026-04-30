import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, describe, expect, it } from "vitest";
import { buildAiSuggestions, buildTrainingTopics, previewMigrationFile } from "../../electron/services/projectStore";
import type { MatchEvent } from "../../shared/domain";

const tempDir = join(tmpdir(), "scoutcode-review-migration-test");

afterEach(() => {
  if (existsSync(tempDir)) {
    rmSync(tempDir, { recursive: true, force: true });
  }
});

describe("review and migration helpers", () => {
  it("creates training topics from coded football phases", () => {
    const events = [
      event("1", "shot", "attack"),
      event("2", "cross", "attack"),
      event("3", "pressing", "defense"),
      event("4", "corner", "set_piece"),
    ];

    const topics = buildTrainingTopics("project-1", events);

    expect(topics.map((topic) => topic.title)).toContain("Final-third decision making");
    expect(topics.some((topic) => topic.phase === "defense")).toBe(true);
    expect(topics.every((topic) => topic.evidenceEventIds.length > 0)).toBe(true);
  });

  it("generates explainable AI candidates without overlapping confirmed events", () => {
    const events = [event("1", "shot", "attack", 90_000, 100_000)];

    const suggestions = buildAiSuggestions("project-1", "media-1", events, 30 * 60 * 1000);

    expect(suggestions.length).toBeGreaterThan(0);
    expect(suggestions.every((candidate) => candidate.status === "pending")).toBe(true);
    expect(suggestions.some((candidate) => candidate.reason.length > 0)).toBe(true);
    expect(suggestions.every((candidate) => candidate.startMs >= 0)).toBe(true);
  });

  it("previews a legacy CSV migration mapping", () => {
    mkdirSync(tempDir, { recursive: true });
    const sourcePath = join(tempDir, "legacy.csv");
    writeFileSync(sourcePath, "start,end,event_type,player\n1,4,shot,9\n", "utf8");

    const preview = previewMigrationFile(sourcePath);

    expect(preview.kind).toBe("csv");
    expect(preview.rowCount).toBe(1);
    expect(preview.mapping.startMs).toBe("start");
    expect(preview.mapping.eventType).toBe("event_type");
  });
});

function event(
  id: string,
  eventType: string,
  phase: MatchEvent["phase"],
  startMs = Number(id) * 10_000,
  endMs = Number(id) * 10_000 + 8_000,
): MatchEvent {
  return {
    id,
    projectId: "project-1",
    mediaId: "media-1",
    startMs,
    endMs,
    eventType,
    phase,
    tags: [],
    source: "manual",
    confirmed: true,
    createdAt: "2026-04-30T00:00:00.000Z",
    updatedAt: "2026-04-30T00:00:00.000Z",
  };
}
