import { describe, expect, it } from "vitest";
import { createDefaultFootballTemplate } from "../../shared/defaultTemplate";

describe("default football template", () => {
  it("contains the MVP football coding phases and useful hotkeys", () => {
    const template = createDefaultFootballTemplate("project-1");
    expect(template.sport).toBe("football");
    expect(template.groups.map((group) => group.phase)).toEqual(["attack", "defense", "transition", "set_piece"]);
    expect(template.groups.flatMap((group) => group.buttons).length).toBeGreaterThanOrEqual(20);
    expect(template.groups.flatMap((group) => group.buttons).some((button) => button.label === "射门")).toBe(true);
    expect(template.groups.flatMap((group) => group.buttons).every((button) => button.defaultDurationMs === 10_000)).toBe(
      true,
    );
  });
});
