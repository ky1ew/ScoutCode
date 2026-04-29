import { describe, expect, it } from "vitest";
import { schemaSql } from "../../electron/database/schema";

describe("database schema", () => {
  it("includes M3 playlist, drawing, and export tables", () => {
    expect(schemaSql).toContain("CREATE TABLE IF NOT EXISTS playlists");
    expect(schemaSql).toContain("CREATE TABLE IF NOT EXISTS playlist_items");
    expect(schemaSql).toContain("CREATE TABLE IF NOT EXISTS drawings");
    expect(schemaSql).toContain("CREATE TABLE IF NOT EXISTS export_jobs");
  });
});
