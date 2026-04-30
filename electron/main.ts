import { app, BrowserWindow, ipcMain, net, protocol } from "electron";
import { createReadStream, statSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { extname, join } from "node:path";
import { ProjectStore } from "./services/projectStore.js";
import type {
  AddEventToPlaylistInput,
  CommitMigrationInput,
  CreateEventInput,
  CreatePlaylistInput,
  CreatePlayerInput,
  CreateProjectInput,
  CreateTrainingTopicInput,
  ExportReportInput,
  ExportPlaylistVideoInput,
  ExportVideoInput,
  ImportEventsInput,
  ImportVideoInput,
  SaveDrawingInput,
  SaveTemplateInput,
  UpdateEventInput,
  UpdatePlayerInput,
} from "../shared/domain.js";

protocol.registerSchemesAsPrivileged([
  {
    scheme: "scoutcode-media",
    privileges: {
      standard: true,
      secure: true,
      stream: true,
      supportFetchAPI: true,
      corsEnabled: true,
    },
  },
]);

const isSmoke = process.argv.includes("--smoke") || process.env.SCOUTCODE_SMOKE === "1";

let mainWindow: BrowserWindow | null = null;
let projectStore: ProjectStore;

if (isSmoke) {
  setTimeout(() => app.exit(0), 5_000);
}

async function createWindow(): Promise<void> {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1180,
    minHeight: 720,
    backgroundColor: "#0f1115",
    title: "ScoutCode",
    webPreferences: {
      preload: join(import.meta.dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
    },
  });

  if (isSmoke) {
    setTimeout(() => app.quit(), 1_500);
  }

  if (!app.isPackaged && !isSmoke) {
    await mainWindow.loadURL("http://127.0.0.1:5173");
    mainWindow.webContents.openDevTools({ mode: "detach" });
  } else {
    await mainWindow.loadFile(join(import.meta.dirname, "../../dist/index.html"));
  }
}

app.whenReady().then(async () => {
  projectStore = new ProjectStore();

  protocol.handle("scoutcode-media", (request) => {
    const mediaId = new URL(request.url).hostname;
    const mediaPath = projectStore.resolveMediaPath(mediaId);

    if (!mediaPath) {
      return new Response("Media not found", { status: 404 });
    }

    return createMediaResponse(request, mediaPath);
  });

  registerIpc();
  await createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      void createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});

function registerIpc(): void {
  ipcMain.handle("project:create", (_event, input: CreateProjectInput) => projectStore.createProject(input));
  ipcMain.handle("project:open", () => projectStore.openProject());
  ipcMain.handle("project:openByPath", (_event, projectPath: string) => projectStore.openProjectByPath(projectPath));
  ipcMain.handle("project:listRecent", () => projectStore.listRecentProjects());

  ipcMain.handle("media:importVideo", (_event, input: ImportVideoInput) => projectStore.importVideo(input));
  ipcMain.handle("media:probeVideo", (_event, filePath: string) => projectStore.probeVideo(filePath));
  ipcMain.handle("media:getUrl", (_event, mediaId: string) => projectStore.getMediaUrl(mediaId));

  ipcMain.handle("events:list", (_event, projectId: string) => projectStore.listEvents(projectId));
  ipcMain.handle("events:create", (_event, input: CreateEventInput) => projectStore.createEvent(input));
  ipcMain.handle("events:update", (_event, id: string, patch: UpdateEventInput) =>
    projectStore.updateEvent(id, patch),
  );
  ipcMain.handle("events:delete", (_event, id: string) => projectStore.deleteEvent(id));

  ipcMain.handle("templates:loadDefaultFootball", (_event, projectId: string) =>
    projectStore.loadDefaultFootballTemplate(projectId),
  );
  ipcMain.handle("templates:list", (_event, projectId: string) => projectStore.listTemplates(projectId));
  ipcMain.handle("templates:save", (_event, input: SaveTemplateInput) => projectStore.saveTemplate(input));
  ipcMain.handle("templates:import", (_event, projectId: string) => projectStore.importTemplate(projectId));

  ipcMain.handle("review:generate", (_event, projectId: string) => projectStore.generateReview(projectId));

  ipcMain.handle("ai:list", (_event, projectId: string) => projectStore.listAiCandidates(projectId));
  ipcMain.handle("ai:generate", (_event, projectId: string) => projectStore.generateAiCandidates(projectId));
  ipcMain.handle("ai:confirm", (_event, id: string) => projectStore.confirmAiCandidate(id));
  ipcMain.handle("ai:ignore", (_event, id: string) => projectStore.ignoreAiCandidate(id));

  ipcMain.handle("players:list", (_event, projectId: string) => projectStore.listPlayers(projectId));
  ipcMain.handle("players:create", (_event, input: CreatePlayerInput) => projectStore.createPlayer(input));
  ipcMain.handle("players:update", (_event, id: string, patch: UpdatePlayerInput) => projectStore.updatePlayer(id, patch));

  ipcMain.handle("training:list", (_event, projectId: string) => projectStore.listTrainingTopics(projectId));
  ipcMain.handle("training:generate", (_event, projectId: string) => projectStore.generateTrainingTopics(projectId));
  ipcMain.handle("training:create", (_event, input: CreateTrainingTopicInput) => projectStore.createTrainingTopic(input));

  ipcMain.handle("playlists:list", (_event, projectId: string) => projectStore.listPlaylists(projectId));
  ipcMain.handle("playlists:create", (_event, input: CreatePlaylistInput) => projectStore.createPlaylist(input));
  ipcMain.handle("playlists:addEvent", (_event, input: AddEventToPlaylistInput) =>
    projectStore.addEventToPlaylist(input),
  );
  ipcMain.handle("playlists:removeItem", (_event, itemId: string) => projectStore.removePlaylistItem(itemId));

  ipcMain.handle("drawings:list", (_event, projectId: string) => projectStore.listDrawings(projectId));
  ipcMain.handle("drawings:save", (_event, input: SaveDrawingInput) => projectStore.saveDrawing(input));
  ipcMain.handle("drawings:delete", (_event, id: string) => projectStore.deleteDrawing(id));

  ipcMain.handle("exports:listJobs", (_event, projectId: string) => projectStore.listExportJobs(projectId));
  ipcMain.handle("exports:csv", (_event, input: ExportReportInput) => projectStore.exportCsv(input));
  ipcMain.handle("exports:html", (_event, input: ExportReportInput) => projectStore.exportHtml(input));
  ipcMain.handle("exports:video", (_event, input: ExportVideoInput) => projectStore.exportVideo(input));
  ipcMain.handle("exports:playlistVideo", (_event, input: ExportPlaylistVideoInput) =>
    projectStore.exportPlaylistVideo(input),
  );
  ipcMain.handle("exports:backup", (_event, projectId: string) => projectStore.exportBackup(projectId));

  ipcMain.handle("imports:csvEvents", (_event, input: ImportEventsInput) => projectStore.importCsvEvents(input));
  ipcMain.handle("imports:previewMigration", (_event, projectId: string) => projectStore.previewMigration(projectId));
  ipcMain.handle("imports:commitMigration", (_event, input: CommitMigrationInput) => projectStore.commitMigration(input));
}

function createMediaResponse(request: GlobalRequest, mediaPath: string): Response | Promise<Response> {
  const range = request.headers.get("range");
  const size = statSync(mediaPath).size;
  const mimeType = mimeTypeFor(mediaPath);

  if (!range) {
    return net.fetch(pathToFileURL(mediaPath).toString());
  }

  const match = /bytes=(\d*)-(\d*)/.exec(range);
  if (!match) {
    return new Response(null, {
      status: 416,
      headers: {
        "Content-Range": `bytes */${size}`,
      },
    });
  }

  const start = match[1] ? Number(match[1]) : 0;
  const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;

  if (!Number.isFinite(start) || !Number.isFinite(end) || start > end || start >= size) {
    return new Response(null, {
      status: 416,
      headers: {
        "Content-Range": `bytes */${size}`,
      },
    });
  }

  const stream = createReadStream(mediaPath, { start, end });
  return new Response(stream as unknown as BodyInit, {
    status: 206,
    headers: {
      "Accept-Ranges": "bytes",
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Type": mimeType,
    },
  });
}

function mimeTypeFor(filePath: string): string {
  switch (extname(filePath).toLowerCase()) {
    case ".mp4":
    case ".m4v":
      return "video/mp4";
    case ".mov":
      return "video/quicktime";
    case ".webm":
      return "video/webm";
    case ".mkv":
      return "video/x-matroska";
    case ".avi":
      return "video/x-msvideo";
    default:
      return "application/octet-stream";
  }
}
