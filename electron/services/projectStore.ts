import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { copyFile } from "node:fs/promises";
import { basename, dirname, extname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { app, dialog } from "electron";
import { DatabaseSync } from "node:sqlite";
import { schemaSql } from "../database/schema.js";
import { createDefaultFootballTemplate } from "../../shared/defaultTemplate.js";
import type {
  AddEventToPlaylistInput,
  CodingTemplate,
  CreateEventInput,
  CreatePlaylistInput,
  CreateProjectInput,
  Drawing,
  DrawingLayer,
  ExportJob,
  ExportPlaylistVideoInput,
  ExportReportInput,
  ExportVideoInput,
  ImportEventsInput,
  ImportResult,
  ImportVideoInput,
  MatchEvent,
  MediaAsset,
  MediaProbeResult,
  Playlist,
  PlaylistItem,
  Project,
  ProjectManifest,
  ProjectOpenResult,
  RecentProject,
  SaveDrawingInput,
  UpdateEventInput,
} from "../../shared/domain.js";
import { normalizeEventRange, parseTimecode } from "../../shared/time.js";

const execFileAsync = promisify(execFile);
const mediaExtensions = new Set([".mp4", ".mov", ".mkv", ".avi", ".webm", ".m4v"]);

type ProjectContext = {
  projectId: string;
  projectPath: string;
  db: DatabaseSync;
};

type ProjectRow = {
  id: string;
  name: string;
  sport: "football";
  opponent?: string;
  match_date?: string;
  venue?: string;
  home_team?: string;
  away_team?: string;
  score?: string;
  formation?: string;
  created_at: string;
  updated_at: string;
};

type MediaRow = {
  id: string;
  project_id: string;
  role: "primary" | "secondary";
  storage_mode: "copy" | "link";
  original_path: string;
  project_path?: string;
  display_name: string;
  duration_ms: number;
  width?: number;
  height?: number;
  frame_rate?: number;
  codec?: string;
  created_at: string;
};

type EventRow = {
  id: string;
  project_id: string;
  media_id: string;
  start_ms: number;
  end_ms: number;
  event_type: string;
  phase?: MatchEvent["phase"];
  team?: MatchEvent["team"];
  player_id?: string;
  player_name?: string;
  zone?: string;
  result?: string;
  quality?: MatchEvent["quality"];
  note?: string;
  tags_json: string;
  source: MatchEvent["source"];
  confidence?: number;
  confirmed: number;
  created_at: string;
  updated_at: string;
};

type PlaylistRow = {
  id: string;
  project_id: string;
  name: string;
  purpose: Playlist["purpose"];
  created_at: string;
  updated_at: string;
};

type PlaylistItemRow = {
  id: string;
  playlist_id: string;
  event_id: string;
  item_order: number;
  title?: string;
  note?: string;
  drawing_id?: string;
  pre_roll_ms: number;
  post_roll_ms: number;
};

type DrawingRow = {
  id: string;
  project_id: string;
  event_id?: string;
  media_id: string;
  time_ms: number;
  layers_json: string;
  created_at: string;
  updated_at: string;
};

type ExportJobRow = {
  id: string;
  project_id: string;
  type: ExportJob["type"];
  status: ExportJob["status"];
  progress: number;
  format?: "mp4" | "mov" | "webm";
  duration_ms?: number;
  ffmpeg_args_json?: string;
  metadata_json?: string;
  output_path?: string;
  error_message?: string;
  created_at: string;
  updated_at: string;
};

export class ProjectStore {
  private readonly contexts = new Map<string, ProjectContext>();
  private readonly mediaPaths = new Map<string, string>();
  private readonly recentPath: string;

  constructor() {
    this.recentPath = join(app.getPath("userData"), "recent-projects.json");
  }

  async createProject(input: CreateProjectInput): Promise<ProjectOpenResult> {
    const parentPath = input.directoryPath ?? (await this.chooseDirectory("Select project location"));
    if (!parentPath) {
      throw new Error("No project location selected");
    }

    const now = new Date().toISOString();
    const id = randomUUID();
    const name = input.name?.trim() || "Untitled Match";
    const projectPath = await this.createProjectPath(parentPath, name);

    for (const folder of ["media", "thumbnails", "drawings", "templates", "exports", "backups", "logs"]) {
      mkdirSync(join(projectPath, folder), { recursive: true });
    }

    const manifest: ProjectManifest = {
      schemaVersion: 1,
      projectId: id,
      name,
      sport: "football",
      createdAt: now,
      updatedAt: now,
      database: "project.sqlite",
      mediaMode: input.mediaMode ?? "copy",
    };
    writeFileSync(join(projectPath, "project.json"), JSON.stringify(manifest, null, 2), "utf8");

    const db = this.openDatabase(projectPath);
    const project: Project = {
      id,
      name,
      sport: "football",
      opponent: input.opponent,
      matchDate: input.matchDate,
      homeTeam: input.homeTeam,
      awayTeam: input.awayTeam,
      createdAt: now,
      updatedAt: now,
    };

    db.prepare(
      `INSERT INTO projects (
        id, name, sport, opponent, match_date, home_team, away_team, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      project.id,
      project.name,
      project.sport,
      project.opponent ?? null,
      project.matchDate ?? null,
      project.homeTeam ?? null,
      project.awayTeam ?? null,
      project.createdAt,
      project.updatedAt,
    );

    this.contexts.set(id, { projectId: id, projectPath, db });
    const template = this.ensureDefaultTemplate(db, id);
    this.saveRecentProject({ id, name, path: projectPath, lastOpenedAt: now });

    return {
      projectPath,
      project,
      mediaAssets: [],
      events: [],
      templates: [template],
      playlists: [],
      drawings: [],
      exportJobs: [],
    };
  }

  async openProject(): Promise<ProjectOpenResult | null> {
    const result = await dialog.showOpenDialog({
      title: "Open ScoutCode project",
      properties: ["openDirectory"],
    });

    if (result.canceled || result.filePaths.length === 0) {
      return null;
    }

    return this.openProjectByPath(result.filePaths[0]);
  }

  openProjectByPath(inputPath: string): ProjectOpenResult {
    const projectPath = this.resolveProjectPath(inputPath);
    const manifest = this.readManifest(projectPath);
    const db = this.openDatabase(projectPath);
    const project = this.getProject(db, manifest.projectId);

    if (!project) {
      throw new Error("Project record is missing from database");
    }

    const templates = this.listTemplatesFromDb(db, project.id);
    const mediaAssets = this.listMediaFromDb(db, project.id, projectPath);
    const events = this.listEventsFromDb(db, project.id);
    const playlists = this.listPlaylistsFromDb(db, project.id);
    const drawings = this.listDrawingsFromDb(db, project.id);
    const exportJobs = this.listExportJobsFromDb(db, project.id);
    const finalTemplates = templates.length > 0 ? templates : [this.ensureDefaultTemplate(db, project.id)];

    this.contexts.set(project.id, { projectId: project.id, projectPath, db });
    this.saveRecentProject({
      id: project.id,
      name: project.name,
      path: projectPath,
      lastOpenedAt: new Date().toISOString(),
    });

    return { projectPath, project, mediaAssets, events, templates: finalTemplates, playlists, drawings, exportJobs };
  }

  listRecentProjects(): RecentProject[] {
    if (!existsSync(this.recentPath)) {
      return [];
    }

    try {
      const parsed = JSON.parse(readFileSync(this.recentPath, "utf8")) as RecentProject[];
      return parsed.filter((project) => existsSync(project.path)).slice(0, 12);
    } catch {
      return [];
    }
  }

  async importVideo(input: ImportVideoInput): Promise<MediaAsset> {
    const context = this.requireContext(input.projectId);
    const sourcePath = input.sourcePath ?? (await this.chooseVideoFile());

    if (!sourcePath) {
      throw new Error("No video selected");
    }

    const ext = extname(sourcePath).toLowerCase();
    if (!mediaExtensions.has(ext)) {
      throw new Error("Unsupported video format");
    }

    const mediaId = randomUUID();
    const displayName = basename(sourcePath);
    const projectRelativePath =
      input.storageMode === "copy" ? join("media", `${input.role}-${mediaId}${ext}`) : undefined;
    const storedPath = projectRelativePath ? join(context.projectPath, projectRelativePath) : sourcePath;

    if (projectRelativePath) {
      await copyFile(sourcePath, storedPath);
    }

    const probe = await this.probeVideo(storedPath);
    const createdAt = new Date().toISOString();
    const media: MediaAsset = {
      id: mediaId,
      projectId: input.projectId,
      role: input.role,
      storageMode: input.storageMode,
      originalPath: sourcePath,
      projectPath: projectRelativePath,
      displayName,
      durationMs: probe.durationMs,
      width: probe.width,
      height: probe.height,
      frameRate: probe.frameRate,
      codec: probe.codec,
      createdAt,
    };

    context.db.prepare(
      `INSERT INTO media_assets (
        id, project_id, role, storage_mode, original_path, project_path, display_name,
        duration_ms, width, height, frame_rate, codec, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      media.id,
      media.projectId,
      media.role,
      media.storageMode,
      media.originalPath,
      media.projectPath ?? null,
      media.displayName,
      media.durationMs,
      media.width ?? null,
      media.height ?? null,
      media.frameRate ?? null,
      media.codec ?? null,
      media.createdAt,
    );

    this.mediaPaths.set(media.id, storedPath);
    return media;
  }

  async importCsvEvents(input: ImportEventsInput): Promise<ImportResult> {
    const context = this.requireContext(input.projectId);
    const sourcePath = input.sourcePath ?? (await this.chooseCsvFile());
    if (!sourcePath) {
      throw new Error("No CSV file selected");
    }

    const mediaId = input.mediaId ?? this.listMediaFromDb(context.db, input.projectId, context.projectPath)[0]?.id;
    if (!mediaId) {
      throw new Error("Import needs a project video first");
    }

    const text = readFileSync(sourcePath, "utf8").replace(/^\uFEFF/, "");
    const rows = parseCsv(text);
    const warnings: string[] = [];
    if (rows.length < 2) {
      return { sourcePath, importedCount: 0, skippedCount: 0, events: [], warnings: ["CSV has no data rows"] };
    }

    const headers = rows[0].map(normalizeHeader);
    const created: MatchEvent[] = [];
    let skippedCount = 0;

    for (const [index, row] of rows.slice(1).entries()) {
      const record = recordFromRow(headers, row);
      const startMs = parseCsvTime(firstValue(record, ["start", "start_time", "start_ms", "in", "开始", "开始时间"]));
      const endMs = parseCsvTime(firstValue(record, ["end", "end_time", "end_ms", "out", "结束", "结束时间"]));
      const eventType = firstValue(record, ["event_type", "type", "event", "code", "事件", "事件类型"]);

      if (startMs === null || !eventType) {
        skippedCount += 1;
        warnings.push(`Row ${index + 2} skipped: missing start time or event type`);
        continue;
      }

      const range = normalizeEventRange(
        startMs,
        endMs ?? startMs + (input.defaultDurationMs ?? 10_000),
        startMs,
        input.defaultDurationMs ?? 10_000,
      );
      const event = this.createEvent({
        projectId: input.projectId,
        mediaId,
        startMs: range.startMs,
        endMs: range.endMs,
        eventType,
        phase: parsePhase(firstValue(record, ["phase", "阶段", "所属阶段"])),
        team: parseTeam(firstValue(record, ["team", "球队", "队伍"])),
        playerName: firstValue(record, ["player", "player_name", "球员", "姓名"]),
        zone: firstValue(record, ["zone", "area", "场区", "位置"]),
        result: firstValue(record, ["result", "结果"]),
        note: firstValue(record, ["note", "notes", "备注", "说明"]),
        tags: splitTags(firstValue(record, ["tags", "tag", "标签"])),
        source: "imported",
        confirmed: true,
      });
      created.push(event);
    }

    return {
      sourcePath,
      importedCount: created.length,
      skippedCount,
      events: created,
      warnings,
    };
  }

  async probeVideo(filePath: string): Promise<MediaProbeResult> {
    const ext = extname(filePath).toLowerCase();
    const playable = mediaExtensions.has(ext);

    try {
      const { stdout } = await execFileAsync("ffprobe", [
        "-v",
        "quiet",
        "-print_format",
        "json",
        "-show_streams",
        "-show_format",
        filePath,
      ]);
      const data = JSON.parse(stdout) as {
        streams?: Array<{
          codec_type?: string;
          codec_name?: string;
          width?: number;
          height?: number;
          r_frame_rate?: string;
        }>;
        format?: { duration?: string };
      };
      const video = data.streams?.find((stream) => stream.codec_type === "video");

      return {
        durationMs: Math.round(Number(data.format?.duration ?? 0) * 1000),
        width: video?.width,
        height: video?.height,
        frameRate: parseFrameRate(video?.r_frame_rate),
        codec: video?.codec_name,
        playable,
      };
    } catch {
      const sizeMb = existsSync(filePath) ? Math.round(statSync(filePath).size / 1024 / 1024) : undefined;
      return {
        durationMs: 0,
        playable,
        warning: sizeMb
          ? `ffprobe is unavailable. Imported ${sizeMb} MB; duration will appear after video metadata loads.`
          : "ffprobe is unavailable. Video metadata could not be read.",
      };
    }
  }

  getMediaUrl(mediaId: string): string {
    if (!this.mediaPaths.has(mediaId)) {
      for (const context of this.contexts.values()) {
        const media = this.getMediaById(context.db, mediaId, context.projectPath);
        if (media) {
          break;
        }
      }
    }

    if (!this.mediaPaths.has(mediaId)) {
      throw new Error("Media file not found");
    }

    return `scoutcode-media://${mediaId}`;
  }

  listEvents(projectId: string): MatchEvent[] {
    const context = this.requireContext(projectId);
    return this.listEventsFromDb(context.db, projectId);
  }

  createEvent(input: CreateEventInput): MatchEvent {
    const context = this.requireContext(input.projectId);
    const now = new Date().toISOString();
    const range = normalizeEventRange(input.startMs, input.endMs);
    const event: MatchEvent = {
      id: randomUUID(),
      projectId: input.projectId,
      mediaId: input.mediaId,
      startMs: range.startMs,
      endMs: range.endMs,
      eventType: input.eventType,
      phase: input.phase,
      team: input.team ?? "unknown",
      playerName: input.playerName,
      zone: input.zone,
      result: input.result,
      quality: input.quality,
      note: input.note,
      tags: input.tags ?? [],
      source: input.source ?? "manual",
      confirmed: input.confirmed ?? input.source !== "ai_suggested",
      createdAt: now,
      updatedAt: now,
    };

    context.db.prepare(
      `INSERT INTO events (
        id, project_id, media_id, start_ms, end_ms, event_type, phase, team,
        player_name, zone, result, quality, note, tags_json, source, confirmed,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      event.id,
      event.projectId,
      event.mediaId,
      event.startMs,
      event.endMs,
      event.eventType,
      event.phase ?? null,
      event.team ?? null,
      event.playerName ?? null,
      event.zone ?? null,
      event.result ?? null,
      event.quality ?? null,
      event.note ?? null,
      JSON.stringify(event.tags),
      event.source,
      event.confirmed ? 1 : 0,
      event.createdAt,
      event.updatedAt,
    );

    return event;
  }

  updateEvent(id: string, patch: UpdateEventInput): MatchEvent {
    const context = this.findContextByEvent(id);
    const existing = this.getEventById(context.db, id);

    if (!existing) {
      throw new Error("Event not found");
    }

    const next: MatchEvent = {
      ...existing,
      ...patch,
      tags: patch.tags ?? existing.tags,
      updatedAt: new Date().toISOString(),
    };
    const range = normalizeEventRange(next.startMs, next.endMs, existing.startMs, existing.endMs - existing.startMs);
    next.startMs = range.startMs;
    next.endMs = range.endMs;

    context.db.prepare(
      `UPDATE events SET
        start_ms = ?, end_ms = ?, event_type = ?, phase = ?, team = ?, player_name = ?,
        zone = ?, result = ?, quality = ?, note = ?, tags_json = ?, confirmed = ?, updated_at = ?
      WHERE id = ? AND deleted_at IS NULL`,
    ).run(
      next.startMs,
      next.endMs,
      next.eventType,
      next.phase ?? null,
      next.team ?? null,
      next.playerName ?? null,
      next.zone ?? null,
      next.result ?? null,
      next.quality ?? null,
      next.note ?? null,
      JSON.stringify(next.tags),
      next.confirmed ? 1 : 0,
      next.updatedAt,
      id,
    );

    return next;
  }

  deleteEvent(id: string): void {
    const context = this.findContextByEvent(id);
    context.db
      .prepare("UPDATE events SET deleted_at = ?, updated_at = ? WHERE id = ?")
      .run(new Date().toISOString(), new Date().toISOString(), id);
  }

  loadDefaultFootballTemplate(projectId: string): CodingTemplate {
    const context = this.requireContext(projectId);
    return this.ensureDefaultTemplate(context.db, projectId);
  }

  listTemplates(projectId: string): CodingTemplate[] {
    const context = this.requireContext(projectId);
    return this.listTemplatesFromDb(context.db, projectId);
  }

  listPlaylists(projectId: string): Playlist[] {
    const context = this.requireContext(projectId);
    return this.listPlaylistsFromDb(context.db, projectId);
  }

  createPlaylist(input: CreatePlaylistInput): Playlist {
    const context = this.requireContext(input.projectId);
    const now = new Date().toISOString();
    const playlist: Playlist = {
      id: randomUUID(),
      projectId: input.projectId,
      name: input.name.trim() || "Untitled Playlist",
      purpose: input.purpose,
      items: [],
      createdAt: now,
      updatedAt: now,
    };

    context.db
      .prepare("INSERT INTO playlists (id, project_id, name, purpose, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
      .run(playlist.id, playlist.projectId, playlist.name, playlist.purpose, playlist.createdAt, playlist.updatedAt);

    return playlist;
  }

  addEventToPlaylist(input: AddEventToPlaylistInput): Playlist {
    const context = this.findContextByPlaylist(input.playlistId);
    const playlist = this.getPlaylistById(context.db, input.playlistId);
    const event = this.getEventById(context.db, input.eventId);

    if (!playlist || !event) {
      throw new Error("Playlist or event not found");
    }

    const nextOrder = playlist.items.length;
    context.db.prepare(
      `INSERT INTO playlist_items (
        id, playlist_id, event_id, item_order, title, note, pre_roll_ms, post_roll_ms
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      randomUUID(),
      input.playlistId,
      input.eventId,
      nextOrder,
      input.title ?? event.eventType,
      input.note ?? event.note ?? null,
      input.preRollMs ?? 5_000,
      input.postRollMs ?? 5_000,
    );

    context.db
      .prepare("UPDATE playlists SET updated_at = ? WHERE id = ?")
      .run(new Date().toISOString(), input.playlistId);

    return this.getPlaylistById(context.db, input.playlistId) ?? playlist;
  }

  removePlaylistItem(itemId: string): Playlist {
    const context = this.findContextByPlaylistItem(itemId);
    const row = context.db.prepare("SELECT playlist_id FROM playlist_items WHERE id = ?").get(itemId) as
      | { playlist_id: string }
      | undefined;

    if (!row) {
      throw new Error("Playlist item not found");
    }

    context.db.prepare("DELETE FROM playlist_items WHERE id = ?").run(itemId);
    context.db.prepare("UPDATE playlists SET updated_at = ? WHERE id = ?").run(new Date().toISOString(), row.playlist_id);
    return this.getPlaylistById(context.db, row.playlist_id) ?? this.emptyPlaylist(row.playlist_id);
  }

  listDrawings(projectId: string): Drawing[] {
    const context = this.requireContext(projectId);
    return this.listDrawingsFromDb(context.db, projectId);
  }

  saveDrawing(input: SaveDrawingInput): Drawing {
    const context = this.requireContext(input.projectId);
    const now = new Date().toISOString();
    const drawing: Drawing = {
      id: randomUUID(),
      projectId: input.projectId,
      eventId: input.eventId,
      mediaId: input.mediaId,
      timeMs: input.timeMs,
      layers: input.layers,
      createdAt: now,
      updatedAt: now,
    };

    context.db.prepare(
      `INSERT INTO drawings (
        id, project_id, event_id, media_id, time_ms, layers_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      drawing.id,
      drawing.projectId,
      drawing.eventId ?? null,
      drawing.mediaId,
      drawing.timeMs,
      JSON.stringify(drawing.layers),
      drawing.createdAt,
      drawing.updatedAt,
    );

    writeFileSync(join(context.projectPath, "drawings", `${drawing.id}.json`), JSON.stringify(drawing, null, 2), "utf8");
    return drawing;
  }

  deleteDrawing(id: string): void {
    const context = this.findContextByDrawing(id);
    context.db.prepare("DELETE FROM drawings WHERE id = ?").run(id);
    const drawingPath = join(context.projectPath, "drawings", `${id}.json`);
    if (existsSync(drawingPath)) {
      unlinkSync(drawingPath);
    }
  }

  listExportJobs(projectId: string): ExportJob[] {
    const context = this.requireContext(projectId);
    return this.listExportJobsFromDb(context.db, projectId);
  }

  exportCsv(input: ExportReportInput): ExportJob {
    const context = this.requireContext(input.projectId);
    const events = this.resolveExportEvents(context.db, input);
    const now = new Date().toISOString().replace(/[:.]/g, "-");
    const outputPath = join(context.projectPath, "exports", `events-${now}.csv`);
    const rows = [
      ["start_ms", "end_ms", "event_type", "phase", "team", "player", "zone", "result", "note"],
      ...events.map((event) => [
        event.startMs,
        event.endMs,
        event.eventType,
        event.phase ?? "",
        event.team ?? "",
        event.playerName ?? "",
        event.zone ?? "",
        event.result ?? "",
        event.note ?? "",
      ]),
    ];
    writeFileSync(outputPath, `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\n")}`, "utf8");
    return this.createExportJob(context, input.projectId, "csv", outputPath);
  }

  exportHtml(input: ExportReportInput): ExportJob {
    const context = this.requireContext(input.projectId);
    const project = this.getProject(context.db, input.projectId);
    const events = this.resolveExportEvents(context.db, input);
    const playlist = input.playlistId ? this.getPlaylistById(context.db, input.playlistId) : null;
    const now = new Date().toISOString().replace(/[:.]/g, "-");
    const outputPath = join(context.projectPath, "exports", `report-${now}.html`);
    const html = buildReportHtml(project, playlist, events);
    writeFileSync(outputPath, html, "utf8");
    return this.createExportJob(context, input.projectId, "html", outputPath);
  }

  async exportVideo(input: ExportVideoInput): Promise<ExportJob> {
    const context = this.requireContext(input.projectId);
    const event = this.getEventById(context.db, input.eventId);
    if (!event) throw new Error("Event not found");
    const range = normalizeEventRange(event.startMs - (input.preRollMs ?? 3000), event.endMs + (input.postRollMs ?? 3000));
    return this.renderVideoJob(context, {
      projectId: input.projectId,
      type: "video_clip",
      format: input.format ?? "mp4",
      includeOverlay: input.includeOverlay ?? false,
      ranges: [{ mediaId: event.mediaId, startMs: range.startMs, endMs: range.endMs }],
    });
  }

  async exportPlaylistVideo(input: ExportPlaylistVideoInput): Promise<ExportJob> {
    const context = this.requireContext(input.projectId);
    const playlist = this.getPlaylistById(context.db, input.playlistId);
    if (!playlist) throw new Error("Playlist not found");
    const eventsById = new Map(this.listEventsFromDb(context.db, input.projectId).map((event) => [event.id, event]));
    const ranges = playlist.items
      .map((item) => {
        const event = eventsById.get(item.eventId);
        if (!event) return null;
        const range = normalizeEventRange(event.startMs - item.preRollMs, event.endMs + item.postRollMs);
        return { mediaId: event.mediaId, startMs: range.startMs, endMs: range.endMs };
      })
      .filter((item): item is { mediaId: string; startMs: number; endMs: number } => Boolean(item));
    return this.renderVideoJob(context, {
      projectId: input.projectId,
      type: "video_playlist",
      format: input.format ?? "mp4",
      includeOverlay: input.includeOverlay ?? false,
      playlistId: input.playlistId,
      ranges,
    });
  }

  resolveMediaPath(mediaId: string): string | null {
    if (this.mediaPaths.has(mediaId)) {
      return this.mediaPaths.get(mediaId) ?? null;
    }

    for (const context of this.contexts.values()) {
      const media = this.getMediaById(context.db, mediaId, context.projectPath);
      if (media) {
        return this.mediaPaths.get(mediaId) ?? null;
      }
    }

    return null;
  }

  private async chooseDirectory(title: string): Promise<string | null> {
    const result = await dialog.showOpenDialog({ title, properties: ["openDirectory", "createDirectory"] });
    return result.canceled ? null : result.filePaths[0];
  }

  private async chooseVideoFile(): Promise<string | null> {
    const result = await dialog.showOpenDialog({
      title: "Import match video",
      properties: ["openFile"],
      filters: [{ name: "Video", extensions: [...mediaExtensions].map((ext) => ext.slice(1)) }],
    });
    return result.canceled ? null : result.filePaths[0];
  }

  private async chooseCsvFile(): Promise<string | null> {
    const result = await dialog.showOpenDialog({
      title: "Import event CSV",
      properties: ["openFile"],
      filters: [{ name: "CSV", extensions: ["csv"] }],
    });
    return result.canceled ? null : result.filePaths[0];
  }

  private async createProjectPath(parentPath: string, name: string): Promise<string> {
    const safeName =
      [...name.replace(/[<>:"/\\|?*]/g, "_")].map((char) => (char < " " ? "_" : char)).join("").trim() ||
      "ScoutCode_Project";
    let projectPath = join(parentPath, `${safeName}.scoutcode`);
    let index = 2;

    while (existsSync(projectPath)) {
      projectPath = join(parentPath, `${safeName}_${index}.scoutcode`);
      index += 1;
    }

    mkdirSync(projectPath, { recursive: true });
    return projectPath;
  }

  private openDatabase(projectPath: string): DatabaseSync {
    const db = new DatabaseSync(join(projectPath, "project.sqlite"));
    db.exec("PRAGMA journal_mode = WAL;");
    db.exec("PRAGMA foreign_keys = ON;");
    db.exec(schemaSql);
    return db;
  }

  private resolveProjectPath(inputPath: string): string {
    const absolute = resolve(inputPath);
    const manifestPath = absolute.endsWith("project.json") ? absolute : join(absolute, "project.json");

    if (!existsSync(manifestPath)) {
      throw new Error("Selected folder is not a ScoutCode project");
    }

    return dirname(manifestPath);
  }

  private readManifest(projectPath: string): ProjectManifest {
    return JSON.parse(readFileSync(join(projectPath, "project.json"), "utf8")) as ProjectManifest;
  }

  private getProject(db: DatabaseSync, projectId: string): Project | null {
    const row = db.prepare("SELECT * FROM projects WHERE id = ?").get(projectId) as ProjectRow | undefined;
    return row ? projectFromRow(row) : null;
  }

  private listMediaFromDb(db: DatabaseSync, projectId: string, projectPath: string): MediaAsset[] {
    const rows = db
      .prepare("SELECT * FROM media_assets WHERE project_id = ? ORDER BY created_at")
      .all(projectId) as MediaRow[];

    return rows.map((row) => mediaFromRow(row, projectPath, this.mediaPaths));
  }

  private getMediaById(db: DatabaseSync, mediaId: string, projectPath: string): MediaAsset | null {
    const row = db.prepare("SELECT * FROM media_assets WHERE id = ?").get(mediaId) as MediaRow | undefined;
    return row ? mediaFromRow(row, projectPath, this.mediaPaths) : null;
  }

  private listEventsFromDb(db: DatabaseSync, projectId: string): MatchEvent[] {
    const rows = db
      .prepare("SELECT * FROM events WHERE project_id = ? AND deleted_at IS NULL ORDER BY start_ms")
      .all(projectId) as EventRow[];

    return rows.map(eventFromRow);
  }

  private getEventById(db: DatabaseSync, id: string): MatchEvent | null {
    const row = db
      .prepare("SELECT * FROM events WHERE id = ? AND deleted_at IS NULL")
      .get(id) as EventRow | undefined;
    return row ? eventFromRow(row) : null;
  }

  private findContextByEvent(id: string): ProjectContext {
    for (const context of this.contexts.values()) {
      if (this.getEventById(context.db, id)) {
        return context;
      }
    }
    throw new Error("Event not found or project is not open");
  }

  private findContextByPlaylist(id: string): ProjectContext {
    for (const context of this.contexts.values()) {
      if (this.getPlaylistById(context.db, id)) {
        return context;
      }
    }
    throw new Error("Playlist not found or project is not open");
  }

  private findContextByPlaylistItem(id: string): ProjectContext {
    for (const context of this.contexts.values()) {
      const row = context.db.prepare("SELECT id FROM playlist_items WHERE id = ?").get(id);
      if (row) {
        return context;
      }
    }
    throw new Error("Playlist item not found or project is not open");
  }

  private findContextByDrawing(id: string): ProjectContext {
    for (const context of this.contexts.values()) {
      const row = context.db.prepare("SELECT id FROM drawings WHERE id = ?").get(id);
      if (row) {
        return context;
      }
    }
    throw new Error("Drawing not found or project is not open");
  }

  private requireContext(projectId: string): ProjectContext {
    const context = this.contexts.get(projectId);
    if (!context) {
      throw new Error("Project is not open");
    }
    return context;
  }

  private ensureDefaultTemplate(db: DatabaseSync, projectId: string): CodingTemplate {
    const existing = db
      .prepare("SELECT template_json FROM templates WHERE project_id = ? AND id = ?")
      .get(projectId, "football-default-v1") as { template_json: string } | undefined;

    if (existing) {
      return JSON.parse(existing.template_json) as CodingTemplate;
    }

    const template = createDefaultFootballTemplate(projectId);
    const now = new Date().toISOString();
    template.createdAt = now;
    template.updatedAt = now;

    db.prepare(
      `INSERT INTO templates (
        id, project_id, name, sport, version, template_json, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      template.id,
      projectId,
      template.name,
      template.sport,
      template.version,
      JSON.stringify(template),
      template.createdAt,
      template.updatedAt,
    );

    for (const group of template.groups) {
      for (const button of group.buttons) {
        db.prepare(
          `INSERT INTO template_buttons (
            id, template_id, group_id, label, event_type, phase, hotkey, color, default_duration_ms
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        ).run(
          button.id,
          template.id,
          group.id,
          button.label,
          button.eventType,
          button.phase ?? null,
          button.hotkey ?? null,
          button.color,
          button.defaultDurationMs ?? null,
        );
      }
    }

    return template;
  }

  private listTemplatesFromDb(db: DatabaseSync, projectId: string): CodingTemplate[] {
    const rows = db
      .prepare("SELECT template_json FROM templates WHERE project_id = ? ORDER BY created_at")
      .all(projectId) as Array<{ template_json: string }>;
    return rows.map((row) => JSON.parse(row.template_json) as CodingTemplate);
  }

  private listPlaylistsFromDb(db: DatabaseSync, projectId: string): Playlist[] {
    const rows = db
      .prepare("SELECT * FROM playlists WHERE project_id = ? ORDER BY created_at")
      .all(projectId) as PlaylistRow[];
    return rows.map((row) => playlistFromRow(row, this.listPlaylistItemsFromDb(db, row.id)));
  }

  private getPlaylistById(db: DatabaseSync, id: string): Playlist | null {
    const row = db.prepare("SELECT * FROM playlists WHERE id = ?").get(id) as PlaylistRow | undefined;
    return row ? playlistFromRow(row, this.listPlaylistItemsFromDb(db, id)) : null;
  }

  private listPlaylistItemsFromDb(db: DatabaseSync, playlistId: string): PlaylistItem[] {
    const rows = db
      .prepare("SELECT * FROM playlist_items WHERE playlist_id = ? ORDER BY item_order")
      .all(playlistId) as PlaylistItemRow[];
    return rows.map(playlistItemFromRow);
  }

  private listDrawingsFromDb(db: DatabaseSync, projectId: string): Drawing[] {
    const rows = db
      .prepare("SELECT * FROM drawings WHERE project_id = ? ORDER BY created_at")
      .all(projectId) as DrawingRow[];
    return rows.map(drawingFromRow);
  }

  private listExportJobsFromDb(db: DatabaseSync, projectId: string): ExportJob[] {
    const rows = db
      .prepare("SELECT * FROM export_jobs WHERE project_id = ? ORDER BY created_at DESC")
      .all(projectId) as ExportJobRow[];
    return rows.map(exportJobFromRow);
  }

  private createExportJob(
    context: ProjectContext,
    projectId: string,
    type: ExportJob["type"],
    outputPath: string,
    patch: Partial<Pick<ExportJob, "format" | "durationMs" | "ffmpegArgs" | "metadata">> = {},
  ): ExportJob {
    const now = new Date().toISOString();
    const job: ExportJob = {
      id: randomUUID(),
      projectId,
      type,
      status: "completed",
      progress: 100,
      format: patch.format,
      durationMs: patch.durationMs,
      ffmpegArgs: patch.ffmpegArgs,
      metadata: patch.metadata,
      outputPath,
      createdAt: now,
      updatedAt: now,
    };
    context.db.prepare(
      `INSERT INTO export_jobs (
        id, project_id, type, status, progress, format, duration_ms, ffmpeg_args_json, metadata_json, output_path, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      job.id,
      job.projectId,
      job.type,
      job.status,
      job.progress,
      job.format ?? null,
      job.durationMs ?? null,
      job.ffmpegArgs ? JSON.stringify(job.ffmpegArgs) : null,
      job.metadata ? JSON.stringify(job.metadata) : null,
      job.outputPath ?? null,
      job.createdAt,
      job.updatedAt,
    );
    return job;
  }

  private async renderVideoJob(
    context: ProjectContext,
    input: {
      projectId: string;
      type: ExportJob["type"];
      format: "mp4" | "mov" | "webm";
      includeOverlay: boolean;
      ranges: Array<{ mediaId: string; startMs: number; endMs: number }>;
      playlistId?: string;
    },
  ): Promise<ExportJob> {
    if (input.ranges.length === 0) throw new Error("No clips to export");
    const nowFile = new Date().toISOString().replace(/[:.]/g, "-");
    const outputPath = join(context.projectPath, "exports", `${input.type}-${nowFile}.${input.format}`);
    const args = buildFfmpegArgs(input.ranges.map((r) => ({ ...r, sourcePath: this.resolveMediaPath(r.mediaId) ?? "" })), outputPath, input.includeOverlay);
    try {
      await execFileAsync("ffmpeg", args);
      const durationMs = input.ranges.reduce((sum, r) => sum + Math.max(0, r.endMs - r.startMs), 0);
      return this.createExportJob(context, input.projectId, input.type, outputPath, {
        format: input.format,
        durationMs,
        ffmpegArgs: args,
        metadata: { clipCount: input.ranges.length, playlistId: input.playlistId, includeOverlay: input.includeOverlay },
      });
    } catch (error) {
      const failed = this.createExportJob(context, input.projectId, input.type, outputPath, {
        format: input.format,
        ffmpegArgs: args,
        metadata: { clipCount: input.ranges.length, playlistId: input.playlistId, includeOverlay: input.includeOverlay },
      });
      context.db.prepare("UPDATE export_jobs SET status = ?, progress = ?, error_message = ?, updated_at = ? WHERE id = ?").run(
        "failed",
        0,
        error instanceof Error ? error.message : "ffmpeg failed",
        new Date().toISOString(),
        failed.id,
      );
      return { ...failed, status: "failed", progress: 0, errorMessage: error instanceof Error ? error.message : "ffmpeg failed" };
    }
  }

  private resolveExportEvents(db: DatabaseSync, input: ExportReportInput): MatchEvent[] {
    const events = this.listEventsFromDb(db, input.projectId);
    if (!input.playlistId) {
      return events;
    }

    const playlist = this.getPlaylistById(db, input.playlistId);
    if (!playlist) {
      throw new Error("Playlist not found");
    }

    const byId = new Map(events.map((event) => [event.id, event]));
    return playlist.items.map((item) => byId.get(item.eventId)).filter((event): event is MatchEvent => Boolean(event));
  }

  private emptyPlaylist(id: string): Playlist {
    return {
      id,
      projectId: "",
      name: "",
      purpose: "custom",
      items: [],
      createdAt: "",
      updatedAt: "",
    };
  }

  private saveRecentProject(project: RecentProject): void {
    const existing = this.listRecentProjects().filter((item) => item.path !== project.path);
    const next = [project, ...existing].slice(0, 12);
    mkdirSync(dirname(this.recentPath), { recursive: true });
    writeFileSync(this.recentPath, JSON.stringify(next, null, 2), "utf8");
  }
}

function projectFromRow(row: ProjectRow): Project {
  return {
    id: row.id,
    name: row.name,
    sport: row.sport,
    opponent: row.opponent ?? undefined,
    matchDate: row.match_date ?? undefined,
    venue: row.venue ?? undefined,
    homeTeam: row.home_team ?? undefined,
    awayTeam: row.away_team ?? undefined,
    score: row.score ?? undefined,
    formation: row.formation ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mediaFromRow(row: MediaRow, projectPath: string, mediaPaths: Map<string, string>): MediaAsset {
  const storedPath = row.project_path ? join(projectPath, row.project_path) : row.original_path;
  mediaPaths.set(row.id, storedPath);
  return {
    id: row.id,
    projectId: row.project_id,
    role: row.role,
    storageMode: row.storage_mode,
    originalPath: row.original_path,
    projectPath: row.project_path ?? undefined,
    displayName: row.display_name,
    durationMs: row.duration_ms,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    frameRate: row.frame_rate ?? undefined,
    codec: row.codec ?? undefined,
    createdAt: row.created_at,
  };
}

function eventFromRow(row: EventRow): MatchEvent {
  return {
    id: row.id,
    projectId: row.project_id,
    mediaId: row.media_id,
    startMs: row.start_ms,
    endMs: row.end_ms,
    eventType: row.event_type,
    phase: row.phase ?? undefined,
    team: row.team ?? undefined,
    playerId: row.player_id ?? undefined,
    playerName: row.player_name ?? undefined,
    zone: row.zone ?? undefined,
    result: row.result ?? undefined,
    quality: row.quality ?? undefined,
    note: row.note ?? undefined,
    tags: parseStringArray(row.tags_json),
    source: row.source,
    confidence: row.confidence ?? undefined,
    confirmed: row.confirmed === 1,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function playlistFromRow(row: PlaylistRow, items: PlaylistItem[]): Playlist {
  return {
    id: row.id,
    projectId: row.project_id,
    name: row.name,
    purpose: row.purpose,
    items,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function playlistItemFromRow(row: PlaylistItemRow): PlaylistItem {
  return {
    id: row.id,
    playlistId: row.playlist_id,
    eventId: row.event_id,
    order: row.item_order,
    title: row.title ?? undefined,
    note: row.note ?? undefined,
    drawingId: row.drawing_id ?? undefined,
    preRollMs: row.pre_roll_ms,
    postRollMs: row.post_roll_ms,
  };
}

function drawingFromRow(row: DrawingRow): Drawing {
  return {
    id: row.id,
    projectId: row.project_id,
    eventId: row.event_id ?? undefined,
    mediaId: row.media_id,
    timeMs: row.time_ms,
    layers: parseDrawingLayers(row.layers_json),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function exportJobFromRow(row: ExportJobRow): ExportJob {
  return {
    id: row.id,
    projectId: row.project_id,
    type: row.type,
    status: row.status,
    progress: row.progress,
    format: row.format,
    durationMs: row.duration_ms ?? undefined,
    ffmpegArgs: row.ffmpeg_args_json ? (JSON.parse(row.ffmpeg_args_json) as string[]) : undefined,
    metadata: row.metadata_json
      ? (JSON.parse(row.metadata_json) as { clipCount?: number; playlistId?: string; includeOverlay?: boolean })
      : undefined,
    outputPath: row.output_path ?? undefined,
    errorMessage: row.error_message ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function buildFfmpegArgs(
  clips: Array<{ sourcePath: string; startMs: number; endMs: number }>,
  outputPath: string,
  includeOverlay: boolean,
): string[] {
  if (clips.length === 0) {
    throw new Error("No clips to render");
  }
  const args: string[] = ["-y"];
  const concatInputs: string[] = [];
  clips.forEach((clip, index) => {
    if (!clip.sourcePath) {
      throw new Error("Media path could not be resolved");
    }
    args.push("-ss", String(clip.startMs / 1000), "-to", String(clip.endMs / 1000), "-i", clip.sourcePath);
    concatInputs.push(`[${index}:v:0][${index}:a:0]`);
  });
  const overlayFilter = includeOverlay ? ",drawbox=x=40:y=40:w=280:h=80:color=black@0.35:t=fill" : "";
  args.push(
    "-filter_complex",
    `${concatInputs.join("")}concat=n=${clips.length}:v=1:a=1[v][a];[v]format=yuv420p${overlayFilter}[vout]`,
    "-map",
    "[vout]",
    "-map",
    "[a]",
    "-c:v",
    "libx264",
    "-c:a",
    "aac",
    outputPath,
  );
  return args;
}

function parseStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : [];
  } catch {
    return [];
  }
}

function parseDrawingLayers(value: string): DrawingLayer[] {
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? (parsed as DrawingLayer[]) : [];
  } catch {
    return [];
  }
}

function parseFrameRate(value?: string): number | undefined {
  if (!value) {
    return undefined;
  }

  const [numerator, denominator] = value.split("/").map(Number);
  if (!numerator || !denominator) {
    return undefined;
  }

  return Math.round((numerator / denominator) * 100) / 100;
}

function csvCell(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function buildReportHtml(project: Project | null, playlist: Playlist | null, events: MatchEvent[]): string {
  const title = playlist?.name ?? `${project?.name ?? "ScoutCode"} Report`;
  const rows = events
    .map(
      (event) => `
        <tr>
          <td>${escapeHtml(String(event.startMs))}</td>
          <td>${escapeHtml(String(event.endMs))}</td>
          <td>${escapeHtml(event.eventType)}</td>
          <td>${escapeHtml(event.phase ?? "")}</td>
          <td>${escapeHtml(event.playerName ?? "")}</td>
          <td>${escapeHtml(event.zone ?? "")}</td>
          <td>${escapeHtml(event.result ?? "")}</td>
          <td>${escapeHtml(event.note ?? "")}</td>
        </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { font-family: "Segoe UI", sans-serif; margin: 32px; color: #17202a; }
    h1 { margin-bottom: 4px; }
    .meta { color: #5b6776; margin-bottom: 22px; }
    table { border-collapse: collapse; width: 100%; font-size: 13px; }
    th, td { border: 1px solid #d8dee8; padding: 8px; text-align: left; vertical-align: top; }
    th { background: #eef3f7; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">${escapeHtml(project?.name ?? "ScoutCode")} / ${events.length} events</div>
  <table>
    <thead>
      <tr><th>Start</th><th>End</th><th>Event</th><th>Phase</th><th>Player</th><th>Zone</th><th>Result</th><th>Note</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }

    if (char === '"') {
      quoted = !quoted;
      continue;
    }

    if (char === "," && !quoted) {
      row.push(cell.trim());
      cell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") {
        index += 1;
      }
      row.push(cell.trim());
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      cell = "";
      continue;
    }

    cell += char;
  }

  row.push(cell.trim());
  if (row.some((value) => value.length > 0)) {
    rows.push(row);
  }

  return rows;
}

function normalizeHeader(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, "_");
}

function recordFromRow(headers: string[], row: string[]): Record<string, string> {
  const record: Record<string, string> = {};
  headers.forEach((header, index) => {
    record[header] = row[index]?.trim() ?? "";
  });
  return record;
}

function firstValue(record: Record<string, string>, keys: string[]): string | undefined {
  for (const key of keys.map(normalizeHeader)) {
    const value = record[key];
    if (value) {
      return value;
    }
  }
  return undefined;
}

function parseCsvTime(value?: string): number | null {
  if (!value) {
    return null;
  }

  const numeric = Number(value);
  if (Number.isFinite(numeric)) {
    return numeric < 10_000 ? Math.round(numeric * 1000) : Math.round(numeric);
  }

  return parseTimecode(value);
}

function parsePhase(value?: string): MatchEvent["phase"] | undefined {
  const normalized = normalizeHeader(value ?? "");
  if (["attack", "进攻", "offense"].includes(normalized)) return "attack";
  if (["defense", "防守"].includes(normalized)) return "defense";
  if (["transition", "转换"].includes(normalized)) return "transition";
  if (["set_piece", "setpiece", "定位球"].includes(normalized)) return "set_piece";
  return undefined;
}

function parseTeam(value?: string): MatchEvent["team"] | undefined {
  const normalized = normalizeHeader(value ?? "");
  if (["home", "主队", "本队", "青年队"].includes(normalized)) return "home";
  if (["away", "客队", "对手", "对手队"].includes(normalized)) return "away";
  if (normalized) return "unknown";
  return undefined;
}

function splitTags(value?: string): string[] {
  if (!value) {
    return [];
  }

  return value
    .split(/[;；|,，]/)
    .map((tag) => tag.trim())
    .filter(Boolean);
}
