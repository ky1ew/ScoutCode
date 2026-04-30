export type EventSource = "manual" | "imported" | "ai_suggested";

export type MatchPhase = "attack" | "defense" | "transition" | "set_piece";

export type TeamSide = "home" | "away" | "unknown";

export type EventQuality = "excellent" | "good" | "average" | "needs_work";

export type Project = {
  id: string;
  name: string;
  sport: "football";
  opponent?: string;
  matchDate?: string;
  venue?: string;
  homeTeam?: string;
  awayTeam?: string;
  score?: string;
  formation?: string;
  createdAt: string;
  updatedAt: string;
};

export type ProjectManifest = {
  schemaVersion: 1;
  projectId: string;
  name: string;
  sport: "football";
  createdAt: string;
  updatedAt: string;
  database: "project.sqlite";
  mediaMode: "copy" | "link";
};

export type RecentProject = {
  id: string;
  name: string;
  path: string;
  lastOpenedAt: string;
};

export type MediaAsset = {
  id: string;
  projectId: string;
  role: "primary" | "secondary";
  storageMode: "copy" | "link";
  originalPath: string;
  projectPath?: string;
  displayName: string;
  durationMs: number;
  width?: number;
  height?: number;
  frameRate?: number;
  codec?: string;
  createdAt: string;
};

export type MediaProbeResult = {
  durationMs: number;
  width?: number;
  height?: number;
  frameRate?: number;
  codec?: string;
  playable: boolean;
  warning?: string;
};

export type MatchEvent = {
  id: string;
  projectId: string;
  mediaId: string;
  startMs: number;
  endMs: number;
  eventType: string;
  phase?: MatchPhase;
  team?: TeamSide;
  playerId?: string;
  playerName?: string;
  zone?: string;
  result?: string;
  quality?: EventQuality;
  note?: string;
  tags: string[];
  source: EventSource;
  confidence?: number;
  confirmed: boolean;
  createdAt: string;
  updatedAt: string;
};

export type CodingTemplate = {
  id: string;
  name: string;
  sport: "football";
  version: number;
  groups: CodingGroup[];
  createdAt: string;
  updatedAt: string;
};

export type CodingGroup = {
  id: string;
  name: string;
  color: string;
  phase: MatchPhase;
  buttons: CodingButton[];
};

export type CodingButton = {
  id: string;
  label: string;
  eventType: string;
  phase?: MatchPhase;
  hotkey?: string;
  color: string;
  defaultDurationMs?: number;
  requiredFields?: string[];
};

export type PlaylistPurpose =
  | "coach_review"
  | "player_feedback"
  | "training_theme"
  | "opponent_analysis"
  | "custom";

export type Playlist = {
  id: string;
  projectId: string;
  name: string;
  purpose: PlaylistPurpose;
  items: PlaylistItem[];
  createdAt: string;
  updatedAt: string;
};

export type PlaylistItem = {
  id: string;
  playlistId: string;
  eventId: string;
  order: number;
  title?: string;
  note?: string;
  drawingId?: string;
  preRollMs: number;
  postRollMs: number;
};

export type Player = {
  id: string;
  projectId: string;
  name: string;
  number?: string;
  position?: string;
  strengths?: string;
  improvements?: string;
  coachNote?: string;
  createdAt: string;
  updatedAt: string;
};

export type EventPlayerLink = {
  eventId: string;
  playerId: string;
  role: "primary" | "secondary" | "mentioned";
};

export type TrainingTopic = {
  id: string;
  projectId: string;
  title: string;
  phase?: MatchPhase;
  priority: "high" | "medium" | "low";
  evidenceEventIds: string[];
  recommendation: string;
  createdAt: string;
  updatedAt: string;
};

export type AiCandidateStatus = "pending" | "confirmed" | "ignored";

export type AiCandidate = {
  id: string;
  projectId: string;
  mediaId: string;
  startMs: number;
  endMs: number;
  eventType: string;
  phase?: MatchPhase;
  confidence: number;
  reason: string;
  status: AiCandidateStatus;
  createdAt: string;
  updatedAt: string;
};

export type ReviewSummary = {
  projectId: string;
  generatedAt: string;
  phaseCards: Array<{
    phase: MatchPhase;
    label: string;
    count: number;
    keyEventIds: string[];
    coachingPoint: string;
  }>;
  coachPlaylistName: string;
  playerReports: Array<{
    playerName: string;
    eventCount: number;
    keyEventIds: string[];
    feedback: string;
  }>;
  trainingTopics: TrainingTopic[];
};

export type DrawingTool = "arrow" | "line" | "zone" | "label";

export type Drawing = {
  id: string;
  projectId: string;
  eventId?: string;
  mediaId: string;
  timeMs: number;
  layers: DrawingLayer[];
  createdAt: string;
  updatedAt: string;
};

export type DrawingLayer =
  | { id: string; type: "arrow"; points: Point[]; color: string; width: number }
  | { id: string; type: "line"; points: Point[]; color: string; width: number; dashed?: boolean }
  | { id: string; type: "zone"; x: number; y: number; width: number; height: number; color: string }
  | { id: string; type: "label"; x: number; y: number; text: string; color: string };

export type Point = {
  x: number;
  y: number;
};

export type ExportJob = {
  id: string;
  projectId: string;
  type: "csv" | "html" | "pdf" | "mp4" | "zip" | "video_clip" | "video_playlist";
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  progress: number;
  format?: "mp4" | "mov" | "webm";
  durationMs?: number;
  ffmpegArgs?: string[];
  metadata?: {
    clipCount?: number;
    playlistId?: string;
    includeOverlay?: boolean;
  };
  outputPath?: string;
  errorMessage?: string;
  createdAt: string;
  updatedAt: string;
};

export type CreateProjectInput = {
  name: string;
  directoryPath?: string;
  matchDate?: string;
  opponent?: string;
  homeTeam?: string;
  awayTeam?: string;
  mediaMode?: "copy" | "link";
};

export type ProjectOpenResult = {
  projectPath: string;
  project: Project;
  mediaAssets: MediaAsset[];
  events: MatchEvent[];
  templates: CodingTemplate[];
  playlists: Playlist[];
  drawings: Drawing[];
  exportJobs: ExportJob[];
  players: Player[];
  trainingTopics: TrainingTopic[];
  aiCandidates: AiCandidate[];
};

export type ImportVideoInput = {
  projectId: string;
  sourcePath?: string;
  role: "primary" | "secondary";
  storageMode: "copy" | "link";
};

export type ImportEventsInput = {
  projectId: string;
  mediaId?: string;
  sourcePath?: string;
  defaultDurationMs?: number;
};

export type CreateEventInput = {
  projectId: string;
  mediaId: string;
  startMs: number;
  endMs: number;
  eventType: string;
  phase?: MatchPhase;
  team?: TeamSide;
  playerName?: string;
  zone?: string;
  result?: string;
  quality?: EventQuality;
  note?: string;
  tags?: string[];
  source?: EventSource;
  confirmed?: boolean;
};

export type UpdateEventInput = Partial<
  Pick<
    MatchEvent,
    | "startMs"
    | "endMs"
    | "eventType"
    | "phase"
    | "team"
    | "playerName"
    | "zone"
    | "result"
    | "quality"
    | "note"
    | "tags"
    | "confirmed"
  >
>;

export type CreatePlaylistInput = {
  projectId: string;
  name: string;
  purpose: PlaylistPurpose;
};

export type AddEventToPlaylistInput = {
  playlistId: string;
  eventId: string;
  title?: string;
  note?: string;
  preRollMs?: number;
  postRollMs?: number;
};

export type SaveDrawingInput = {
  projectId: string;
  eventId?: string;
  mediaId: string;
  timeMs: number;
  layers: DrawingLayer[];
};

export type ExportReportInput = {
  projectId: string;
  playlistId?: string;
};

export type ExportVideoInput = {
  projectId: string;
  eventId: string;
  format?: "mp4" | "mov" | "webm";
  preRollMs?: number;
  postRollMs?: number;
  includeOverlay?: boolean;
};

export type ExportPlaylistVideoInput = {
  projectId: string;
  playlistId: string;
  format?: "mp4" | "mov" | "webm";
  includeOverlay?: boolean;
};

export type SaveTemplateInput = {
  projectId: string;
  template: CodingTemplate;
};

export type CreatePlayerInput = {
  projectId: string;
  name: string;
  number?: string;
  position?: string;
  strengths?: string;
  improvements?: string;
  coachNote?: string;
};

export type UpdatePlayerInput = Partial<Omit<CreatePlayerInput, "projectId">>;

export type CreateTrainingTopicInput = {
  projectId: string;
  title: string;
  phase?: MatchPhase;
  priority: TrainingTopic["priority"];
  evidenceEventIds?: string[];
  recommendation: string;
};

export type MigrationPreview = {
  sourcePath: string;
  kind: "csv" | "xml" | "template_json" | "unknown";
  detectedFields: string[];
  rowCount: number;
  mapping: Record<string, string>;
  warnings: string[];
};

export type CommitMigrationInput = {
  projectId: string;
  mediaId?: string;
  sourcePath: string;
  kind: MigrationPreview["kind"];
  mapping?: Record<string, string>;
};

export type ImportResult = {
  sourcePath: string;
  importedCount: number;
  skippedCount: number;
  events: MatchEvent[];
  warnings: string[];
};

export type AppError = {
  code: string;
  message: string;
  detail?: string;
  recoverable: boolean;
  actionLabel?: string;
};
