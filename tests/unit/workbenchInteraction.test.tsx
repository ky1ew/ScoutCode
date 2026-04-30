import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createDefaultFootballTemplate } from "../../shared/defaultTemplate";
import type { Drawing, MatchEvent, MediaAsset, Project } from "../../shared/domain";

const { useProjectMock } = vi.hoisted(() => ({
  useProjectMock: vi.fn(),
}));

vi.mock("../../src/app/ProjectContext", () => ({
  useProject: useProjectMock,
}));

import { AnalysisWorkspace } from "../../src/features/workbench/AnalysisWorkspace";

afterEach(() => {
  vi.clearAllMocks();
});

describe("workbench interaction fixes", () => {
  it("opens the command menu and runs a menu action", () => {
    const state = createState();
    useProjectMock.mockReturnValue(state);

    render(<AnalysisWorkspace />);
    fireEvent.click(screen.getByTitle("打开命令菜单"));
    fireEvent.click(screen.getByText("打开项目"));

    expect(state.openProject).toHaveBeenCalledOnce();
  });

  it("closes the command menu from Escape", () => {
    useProjectMock.mockReturnValue(createState());

    render(<AnalysisWorkspace />);
    fireEvent.click(screen.getByTitle("打开命令菜单"));
    expect(screen.getByRole("menu")).toBeTruthy();
    fireEvent.keyDown(window, { key: "Escape" });

    expect(screen.queryByRole("menu")).toBeNull();
  });

  it("routes the filters panel AI button to the AI candidate panel", () => {
    useProjectMock.mockReturnValue(createState());

    render(<AnalysisWorkspace />);
    fireEvent.click(screen.getByText("筛选"));
    fireEvent.click(screen.getByRole("button", { name: "AI候选" }));

    expect(screen.getByText("生成 AI 候选")).toBeTruthy();
  });

  it("switches the bottom panel into matrix placeholder view", () => {
    useProjectMock.mockReturnValue(createState());

    render(<AnalysisWorkspace />);
    fireEvent.click(screen.getByTitle("显示矩阵占位视图"));

    expect(screen.getByLabelText("矩阵视图占位")).toBeTruthy();
    expect(screen.getByText(/矩阵视图会在后续版本完善/)).toBeTruthy();
  });

  it("selects and deletes a saved drawing from the video overlay", () => {
    const state = createState();
    useProjectMock.mockReturnValue(state);
    const { container } = render(<AnalysisWorkspace />);
    const layer = container.querySelector(".drawing-layer");
    const deleteButton = container.querySelector<HTMLButtonElement>(".drawing-toolbar button[title='删除选中标记']");

    expect(layer).toBeTruthy();
    expect(deleteButton).toBeTruthy();

    fireEvent.click(layer!);
    fireEvent.click(deleteButton!);

    expect(state.deleteDrawing).toHaveBeenCalledWith("drawing-1");
  });

  it("allows the SVG drawing overlay to receive pointer events", () => {
    const css = readFileSync(join(process.cwd(), "src", "index.css"), "utf8");

    expect(css).toMatch(/\.drawing-overlay\s*{[^}]*pointer-events:\s*auto;/s);
  });
});

function createState() {
  const project: Project = {
    id: "project-1",
    name: "Test Match",
    sport: "football",
    createdAt: "2026-04-30T00:00:00.000Z",
    updatedAt: "2026-04-30T00:00:00.000Z",
  };
  const media: MediaAsset = {
    id: "media-1",
    projectId: project.id,
    role: "primary",
    storageMode: "copy",
    originalPath: "test.mp4",
    displayName: "test.mp4",
    durationMs: 90_000,
    createdAt: "2026-04-30T00:00:00.000Z",
  };
  const event: MatchEvent = {
    id: "event-1",
    projectId: project.id,
    mediaId: media.id,
    startMs: 10_000,
    endMs: 18_000,
    eventType: "shot",
    phase: "attack",
    tags: [],
    source: "manual",
    confirmed: true,
    createdAt: "2026-04-30T00:00:00.000Z",
    updatedAt: "2026-04-30T00:00:00.000Z",
  };
  const drawing: Drawing = {
    id: "drawing-1",
    projectId: project.id,
    eventId: event.id,
    mediaId: media.id,
    timeMs: 12_000,
    layers: [{ id: "layer-1", type: "label", x: 0.5, y: 0.5, text: "重点", color: "#22e0cd" }],
    createdAt: "2026-04-30T00:00:00.000Z",
    updatedAt: "2026-04-30T00:00:00.000Z",
  };

  return {
    project,
    projectPath: "C:/tmp/project.scoutcode",
    mediaAssets: [media],
    events: [event],
    templates: [createDefaultFootballTemplate(project.id)],
    playlists: [],
    drawings: [drawing],
    exportJobs: [],
    players: [],
    trainingTopics: [],
    aiCandidates: [],
    reviewSummary: null,
    migrationPreview: null,
    recentProjects: [],
    selectedEventId: event.id,
    selectedMediaId: media.id,
    selectedPlaylistId: null,
    mediaUrl: null,
    loading: false,
    error: null,
    isDesktop: true,
    createProject: vi.fn(),
    openProject: vi.fn(),
    openRecentProject: vi.fn(),
    importPrimaryVideo: vi.fn(),
    importCsvEvents: vi.fn(),
    previewMigration: vi.fn(),
    commitMigration: vi.fn(),
    createMatchEvent: vi.fn(),
    updateMatchEvent: vi.fn(),
    deleteMatchEvent: vi.fn(),
    saveTemplate: vi.fn(),
    importTemplate: vi.fn(),
    createPlaylist: vi.fn(),
    addEventToPlaylist: vi.fn(),
    removePlaylistItem: vi.fn(),
    saveCurrentDrawing: vi.fn(),
    deleteDrawing: vi.fn().mockResolvedValue(undefined),
    generateReview: vi.fn(),
    generateAiCandidates: vi.fn(),
    confirmAiCandidate: vi.fn(),
    ignoreAiCandidate: vi.fn(),
    createPlayer: vi.fn(),
    updatePlayer: vi.fn(),
    generateTrainingTopics: vi.fn(),
    createTrainingTopic: vi.fn(),
    exportCsv: vi.fn(),
    exportHtml: vi.fn(),
    exportVideo: vi.fn(),
    exportPlaylistVideo: vi.fn(),
    exportBackup: vi.fn(),
    selectEvent: vi.fn(),
    selectPlaylist: vi.fn(),
    clearError: vi.fn(),
  };
}
