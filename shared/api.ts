import type {
  CodingTemplate,
  AddEventToPlaylistInput,
  CreateEventInput,
  CreatePlaylistInput,
  CreateProjectInput,
  Drawing,
  ExportJob,
  ExportReportInput,
  ExportPlaylistVideoInput,
  ExportVideoInput,
  ImportEventsInput,
  ImportResult,
  ImportVideoInput,
  MatchEvent,
  MediaAsset,
  MediaProbeResult,
  Playlist,
  ProjectOpenResult,
  RecentProject,
  SaveDrawingInput,
  UpdateEventInput,
} from "./domain.js";

export type DesktopApi = {
  project: {
    createProject(input: CreateProjectInput): Promise<ProjectOpenResult>;
    openProject(): Promise<ProjectOpenResult | null>;
    openProjectByPath(projectPath: string): Promise<ProjectOpenResult>;
    listRecentProjects(): Promise<RecentProject[]>;
  };
  media: {
    importVideo(input: ImportVideoInput): Promise<MediaAsset>;
    probeVideo(filePath: string): Promise<MediaProbeResult>;
    getMediaUrl(mediaId: string): Promise<string>;
  };
  events: {
    listEvents(projectId: string): Promise<MatchEvent[]>;
    createEvent(input: CreateEventInput): Promise<MatchEvent>;
    updateEvent(id: string, patch: UpdateEventInput): Promise<MatchEvent>;
    deleteEvent(id: string): Promise<void>;
  };
  templates: {
    loadDefaultFootballTemplate(projectId: string): Promise<CodingTemplate>;
    listTemplates(projectId: string): Promise<CodingTemplate[]>;
  };
  playlists: {
    listPlaylists(projectId: string): Promise<Playlist[]>;
    createPlaylist(input: CreatePlaylistInput): Promise<Playlist>;
    addEventToPlaylist(input: AddEventToPlaylistInput): Promise<Playlist>;
    removePlaylistItem(itemId: string): Promise<Playlist>;
  };
  drawings: {
    listDrawings(projectId: string): Promise<Drawing[]>;
    saveDrawing(input: SaveDrawingInput): Promise<Drawing>;
    deleteDrawing(id: string): Promise<void>;
  };
  exports: {
    listExportJobs(projectId: string): Promise<ExportJob[]>;
    exportCsv(input: ExportReportInput): Promise<ExportJob>;
    exportHtml(input: ExportReportInput): Promise<ExportJob>;
    exportVideo(input: ExportVideoInput): Promise<ExportJob>;
    exportPlaylistVideo(input: ExportPlaylistVideoInput): Promise<ExportJob>;
  };
  imports: {
    importCsvEvents(input: ImportEventsInput): Promise<ImportResult>;
  };
};
