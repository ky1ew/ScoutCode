import { contextBridge, ipcRenderer } from "electron";
import type { DesktopApi } from "../shared/api.js";
import type {
  AddEventToPlaylistInput,
  CreateEventInput,
  CreatePlaylistInput,
  CreateProjectInput,
  ExportReportInput,
  ImportEventsInput,
  ImportVideoInput,
  SaveDrawingInput,
  UpdateEventInput,
} from "../shared/domain.js";

const desktopApi: DesktopApi = {
  project: {
    createProject: (input: CreateProjectInput) => ipcRenderer.invoke("project:create", input),
    openProject: () => ipcRenderer.invoke("project:open"),
    openProjectByPath: (projectPath: string) => ipcRenderer.invoke("project:openByPath", projectPath),
    listRecentProjects: () => ipcRenderer.invoke("project:listRecent"),
  },
  media: {
    importVideo: (input: ImportVideoInput) => ipcRenderer.invoke("media:importVideo", input),
    probeVideo: (filePath: string) => ipcRenderer.invoke("media:probeVideo", filePath),
    getMediaUrl: (mediaId: string) => ipcRenderer.invoke("media:getUrl", mediaId),
  },
  events: {
    listEvents: (projectId: string) => ipcRenderer.invoke("events:list", projectId),
    createEvent: (input: CreateEventInput) => ipcRenderer.invoke("events:create", input),
    updateEvent: (id: string, patch: UpdateEventInput) => ipcRenderer.invoke("events:update", id, patch),
    deleteEvent: (id: string) => ipcRenderer.invoke("events:delete", id),
  },
  templates: {
    loadDefaultFootballTemplate: (projectId: string) =>
      ipcRenderer.invoke("templates:loadDefaultFootball", projectId),
    listTemplates: (projectId: string) => ipcRenderer.invoke("templates:list", projectId),
  },
  playlists: {
    listPlaylists: (projectId: string) => ipcRenderer.invoke("playlists:list", projectId),
    createPlaylist: (input: CreatePlaylistInput) => ipcRenderer.invoke("playlists:create", input),
    addEventToPlaylist: (input: AddEventToPlaylistInput) => ipcRenderer.invoke("playlists:addEvent", input),
    removePlaylistItem: (itemId: string) => ipcRenderer.invoke("playlists:removeItem", itemId),
  },
  drawings: {
    listDrawings: (projectId: string) => ipcRenderer.invoke("drawings:list", projectId),
    saveDrawing: (input: SaveDrawingInput) => ipcRenderer.invoke("drawings:save", input),
    deleteDrawing: (id: string) => ipcRenderer.invoke("drawings:delete", id),
  },
  exports: {
    listExportJobs: (projectId: string) => ipcRenderer.invoke("exports:listJobs", projectId),
    exportCsv: (input: ExportReportInput) => ipcRenderer.invoke("exports:csv", input),
    exportHtml: (input: ExportReportInput) => ipcRenderer.invoke("exports:html", input),
  },
  imports: {
    importCsvEvents: (input: ImportEventsInput) => ipcRenderer.invoke("imports:csvEvents", input),
  },
};

contextBridge.exposeInMainWorld("desktopApi", desktopApi);
