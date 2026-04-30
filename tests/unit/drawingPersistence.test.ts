import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("drawing persistence safety", () => {
  it("removes drawing JSON files when deleting saved drawings", () => {
    const source = readFileSync(join(process.cwd(), "electron", "services", "projectStore.ts"), "utf8");
    const deleteDrawingBlock = source.match(/deleteDrawing\(id: string\): void \{[\s\S]*?\n {2}\}/)?.[0] ?? "";

    expect(deleteDrawingBlock).toContain("DELETE FROM drawings");
    expect(deleteDrawingBlock).toContain('join(context.projectPath, "drawings", `${id}.json`)');
    expect(deleteDrawingBlock).toContain("unlinkSync(drawingPath)");
  });
});
