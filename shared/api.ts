import type {
  CodingTemplate,
  AddEventToPlaylistInput,
  AiCandidate,
  CommitMigrationInput,
  CreateEventInput,
  CreatePlaylistInput,
  CreatePlayerInput,
  CreateProjectInput,
  CreateTrainingTopicInput,
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
  MigrationPreview,
  Playlist,
  Player,
  ProjectOpenResult,
  RecentProject,
  ReviewSummary,
  SaveDrawingInput,
  SaveTemplateInput,
  TrainingTopic,
  UpdateEventInput,
  UpdatePlayerInput,
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
    saveTemplate(input: SaveTemplateInput): Promise<CodingTemplate>;
    importTemplate(projectId: string): Promise<CodingTemplate | null>;
  };
  review: {
    generateReview(projectId: string): Promise<ReviewSummary>;
  };
  ai: {
    listCandidates(projectId: string): Promise<AiCandidate[]>;
    generateCandidates(projectId: string): Promise<AiCandidate[]>;
    confirmCandidate(id: string): Promise<{ event: MatchEvent; candidates: AiCandidate[] }>;
    ignoreCandidate(id: string): Promise<AiCandidate[]>;
  };
  players: {
    listPlayers(projectId: string): Promise<Player[]>;
    createPlayer(input: CreatePlayerInput): Promise<Player>;
    updatePlayer(id: string, patch: UpdatePlayerInput): Promise<Player>;
  };
  training: {
    listTopics(projectId: string): Promise<TrainingTopic[]>;
    generateTopics(projectId: string): Promise<TrainingTopic[]>;
    createTopic(input: CreateTrainingTopicInput): Promise<TrainingTopic>;
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
    exportBackup(projectId: string): Promise<ExportJob>;
  };
  imports: {
    importCsvEvents(input: ImportEventsInput): Promise<ImportResult>;
    previewMigration(projectId: string): Promise<MigrationPreview | null>;
    commitMigration(input: CommitMigrationInput): Promise<ImportResult>;
  };
};
