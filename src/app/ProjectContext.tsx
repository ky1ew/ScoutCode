import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { createDefaultFootballTemplate } from "../../shared/defaultTemplate";
import type {
  AddEventToPlaylistInput,
  CodingTemplate,
  CreateEventInput,
  Drawing,
  DrawingLayer,
  ExportJob,
  MatchEvent,
  MediaAsset,
  Playlist,
  PlaylistPurpose,
  Project,
  ProjectOpenResult,
  RecentProject,
  UpdateEventInput,
} from "../../shared/domain";

type ProjectState = {
  project: Project | null;
  projectPath: string | null;
  mediaAssets: MediaAsset[];
  events: MatchEvent[];
  templates: CodingTemplate[];
  playlists: Playlist[];
  drawings: Drawing[];
  exportJobs: ExportJob[];
  recentProjects: RecentProject[];
  selectedEventId: string | null;
  selectedMediaId: string | null;
  selectedPlaylistId: string | null;
  mediaUrl: string | null;
  loading: boolean;
  error: string | null;
  isDesktop: boolean;
  createProject(name: string): Promise<void>;
  openProject(): Promise<void>;
  openRecentProject(projectPath: string): Promise<void>;
  importPrimaryVideo(storageMode: "copy" | "link"): Promise<void>;
  importCsvEvents(): Promise<void>;
  createMatchEvent(input: CreateEventInput): Promise<MatchEvent | null>;
  updateMatchEvent(id: string, patch: UpdateEventInput): Promise<void>;
  deleteMatchEvent(id: string): Promise<void>;
  createPlaylist(name: string, purpose: PlaylistPurpose): Promise<Playlist | null>;
  addEventToPlaylist(input: AddEventToPlaylistInput): Promise<void>;
  removePlaylistItem(itemId: string): Promise<void>;
  saveCurrentDrawing(input: { eventId?: string; mediaId: string; timeMs: number; layers: DrawingLayer[] }): Promise<void>;
  deleteDrawing(id: string): Promise<void>;
  exportCsv(playlistId?: string): Promise<void>;
  exportHtml(playlistId?: string): Promise<void>;
  exportVideo(eventId: string): Promise<void>;
  exportPlaylistVideo(playlistId: string): Promise<void>;
  selectEvent(id: string | null): void;
  selectPlaylist(id: string | null): void;
  clearError(): void;
};

const ProjectContext = createContext<ProjectState | null>(null);

const demoProject: Project = {
  id: "demo-project",
  name: "比赛复盘",
  sport: "football",
  opponent: "对手队",
  matchDate: "2026-04-29",
  homeTeam: "青年队",
  awayTeam: "对手队",
  score: "1-0",
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export function ProjectProvider({ children }: { children: ReactNode }) {
  const api = window.desktopApi;
  const isDesktop = Boolean(api);
  const [project, setProject] = useState<Project | null>(() => (window.desktopApi ? null : demoProject));
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [mediaAssets, setMediaAssets] = useState<MediaAsset[]>([]);
  const [events, setEvents] = useState<MatchEvent[]>([]);
  const [templates, setTemplates] = useState<CodingTemplate[]>([createDefaultFootballTemplate("demo-project")]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [drawings, setDrawings] = useState<Drawing[]>([]);
  const [exportJobs, setExportJobs] = useState<ExportJob[]>([]);
  const [recentProjects, setRecentProjects] = useState<RecentProject[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedMediaId, setSelectedMediaId] = useState<string | null>(null);
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!api) {
      return;
    }

    api.project
      .listRecentProjects()
      .then(setRecentProjects)
      .catch((reason: unknown) => setError(errorMessage(reason)));
  }, [api]);

  const applyOpenResult = useCallback(
    async (result: ProjectOpenResult) => {
      setProject(result.project);
      setProjectPath(result.projectPath);
      setMediaAssets(result.mediaAssets);
      setEvents(result.events);
      setTemplates(result.templates);
      setPlaylists(result.playlists);
      setDrawings(result.drawings);
      setExportJobs(result.exportJobs);
      setSelectedEventId(result.events[0]?.id ?? null);
      setSelectedMediaId(result.mediaAssets[0]?.id ?? null);
      setSelectedPlaylistId(result.playlists[0]?.id ?? null);

      if (api && result.mediaAssets[0]) {
        setMediaUrl(await api.media.getMediaUrl(result.mediaAssets[0].id));
      } else {
        setMediaUrl(null);
      }
    },
    [api],
  );

  const run = useCallback(async (operation: () => Promise<void>) => {
    setLoading(true);
    setError(null);
    try {
      await operation();
    } catch (reason) {
      setError(errorMessage(reason));
    } finally {
      setLoading(false);
    }
  }, []);

  const createProject = useCallback(
    async (name: string) => {
      await run(async () => {
        if (!api) {
          setProject({ ...demoProject, name: name.trim() || demoProject.name });
          return;
        }

        const result = await api.project.createProject({ name });
        await applyOpenResult(result);
        setRecentProjects(await api.project.listRecentProjects());
      });
    },
    [api, applyOpenResult, run],
  );

  const openProject = useCallback(async () => {
    await run(async () => {
      if (!api) {
        setProject(demoProject);
        return;
      }

      const result = await api.project.openProject();
      if (result) {
        await applyOpenResult(result);
        setRecentProjects(await api.project.listRecentProjects());
      }
    });
  }, [api, applyOpenResult, run]);

  const openRecentProject = useCallback(
    async (path: string) => {
      await run(async () => {
        if (!api) {
          return;
        }

        const result = await api.project.openProjectByPath(path);
        await applyOpenResult(result);
        setRecentProjects(await api.project.listRecentProjects());
      });
    },
    [api, applyOpenResult, run],
  );

  const importPrimaryVideo = useCallback(
    async (storageMode: "copy" | "link") => {
      await run(async () => {
        if (!api || !project) {
          return;
        }

        const media = await api.media.importVideo({ projectId: project.id, role: "primary", storageMode });
        setMediaAssets((current) => [media, ...current.filter((item) => item.id !== media.id)]);
        setSelectedMediaId(media.id);
        setMediaUrl(await api.media.getMediaUrl(media.id));
      });
    },
    [api, project, run],
  );

  const createMatchEvent = useCallback(
    async (input: CreateEventInput): Promise<MatchEvent | null> => {
      if (!api) {
        const now = new Date().toISOString();
        const event: MatchEvent = {
          ...input,
          id: crypto.randomUUID(),
          tags: input.tags ?? [],
          source: "manual",
          confirmed: true,
          createdAt: now,
          updatedAt: now,
        };
        setEvents((current) => [...current, event].toSorted((a, b) => a.startMs - b.startMs));
        setSelectedEventId(event.id);
        return event;
      }

      let created: MatchEvent | null = null;
      await run(async () => {
        created = await api.events.createEvent(input);
        setEvents((current) => [...current, created!].toSorted((a, b) => a.startMs - b.startMs));
        setSelectedEventId(created!.id);
      });
      return created;
    },
    [api, run],
  );

  const importCsvEvents = useCallback(async () => {
    if (!api || !project) {
      return;
    }

    await run(async () => {
      const result = await api.imports.importCsvEvents({
        projectId: project.id,
        mediaId: selectedMediaId ?? undefined,
      });
      setEvents((current) => [...current, ...result.events].toSorted((a, b) => a.startMs - b.startMs));
      setSelectedEventId(result.events[0]?.id ?? selectedEventId);
      if (result.warnings.length > 0) {
        setError(`已导入 ${result.importedCount} 条，跳过 ${result.skippedCount} 条。${result.warnings[0]}`);
      }
    });
  }, [api, project, run, selectedEventId, selectedMediaId]);

  const updateMatchEvent = useCallback(
    async (id: string, patch: UpdateEventInput) => {
      await run(async () => {
        if (!api) {
          setEvents((current) =>
            current.map((event) => (event.id === id ? { ...event, ...patch, updatedAt: new Date().toISOString() } : event)),
          );
          return;
        }

        const updated = await api.events.updateEvent(id, patch);
        setEvents((current) => current.map((event) => (event.id === id ? updated : event)));
      });
    },
    [api, run],
  );

  const deleteMatchEvent = useCallback(
    async (id: string) => {
      await run(async () => {
        if (api) {
          await api.events.deleteEvent(id);
        }
        setEvents((current) => current.filter((event) => event.id !== id));
        setSelectedEventId((current) => (current === id ? null : current));
      });
    },
    [api, run],
  );

  const createPlaylist = useCallback(
    async (name: string, purpose: PlaylistPurpose): Promise<Playlist | null> => {
      if (!project) {
        return null;
      }

      if (!api) {
        const now = new Date().toISOString();
        const playlist: Playlist = {
          id: crypto.randomUUID(),
          projectId: project.id,
          name,
          purpose,
          items: [],
          createdAt: now,
          updatedAt: now,
        };
        setPlaylists((current) => [playlist, ...current]);
        setSelectedPlaylistId(playlist.id);
        return playlist;
      }

      let created: Playlist | null = null;
      await run(async () => {
        created = await api.playlists.createPlaylist({ projectId: project.id, name, purpose });
        setPlaylists((current) => [created!, ...current]);
        setSelectedPlaylistId(created!.id);
      });
      return created;
    },
    [api, project, run],
  );

  const addEventToPlaylist = useCallback(
    async (input: AddEventToPlaylistInput) => {
      await run(async () => {
        if (!api) {
          setPlaylists((current) =>
            current.map((playlist) =>
              playlist.id === input.playlistId
                ? {
                    ...playlist,
                    items: [
                      ...playlist.items,
                      {
                        id: crypto.randomUUID(),
                        playlistId: playlist.id,
                        eventId: input.eventId,
                        order: playlist.items.length,
                        title: input.title,
                        note: input.note,
                        preRollMs: input.preRollMs ?? 5_000,
                        postRollMs: input.postRollMs ?? 5_000,
                      },
                    ],
                  }
                : playlist,
            ),
          );
          return;
        }

        const updated = await api.playlists.addEventToPlaylist(input);
        setPlaylists((current) => current.map((playlist) => (playlist.id === updated.id ? updated : playlist)));
      });
    },
    [api, run],
  );

  const removePlaylistItem = useCallback(
    async (itemId: string) => {
      await run(async () => {
        if (!api) {
          setPlaylists((current) =>
            current.map((playlist) => ({
              ...playlist,
              items: playlist.items.filter((item) => item.id !== itemId),
            })),
          );
          return;
        }

        const updated = await api.playlists.removePlaylistItem(itemId);
        setPlaylists((current) => current.map((playlist) => (playlist.id === updated.id ? updated : playlist)));
      });
    },
    [api, run],
  );

  const saveCurrentDrawing = useCallback(
    async (input: { eventId?: string; mediaId: string; timeMs: number; layers: DrawingLayer[] }) => {
      if (!project) {
        return;
      }

      await run(async () => {
        if (!api) {
          const now = new Date().toISOString();
          const drawing: Drawing = {
            id: crypto.randomUUID(),
            projectId: project.id,
            eventId: input.eventId,
            mediaId: input.mediaId,
            timeMs: input.timeMs,
            layers: input.layers,
            createdAt: now,
            updatedAt: now,
          };
          setDrawings((current) => [drawing, ...current]);
          return;
        }

        const drawing = await api.drawings.saveDrawing({ projectId: project.id, ...input });
        setDrawings((current) => [drawing, ...current.filter((item) => item.id !== drawing.id)]);
      });
    },
    [api, project, run],
  );

  const deleteDrawing = useCallback(
    async (id: string) => {
      await run(async () => {
        if (api) {
          await api.drawings.deleteDrawing(id);
        }
        setDrawings((current) => current.filter((drawing) => drawing.id !== id));
      });
    },
    [api, run],
  );

  const exportCsv = useCallback(
    async (playlistId?: string) => {
      if (!api || !project) {
        return;
      }
      await run(async () => {
        const job = await api.exports.exportCsv({ projectId: project.id, playlistId });
        setExportJobs((current) => [job, ...current]);
      });
    },
    [api, project, run],
  );

  const exportHtml = useCallback(
    async (playlistId?: string) => {
      if (!api || !project) {
        return;
      }
      await run(async () => {
        const job = await api.exports.exportHtml({ projectId: project.id, playlistId });
        setExportJobs((current) => [job, ...current]);
      });
    },
    [api, project, run],
  );

  const exportVideo = useCallback(
    async (eventId: string) => {
      if (!api || !project) return;
      await run(async () => {
        const job = await api.exports.exportVideo({ projectId: project.id, eventId, includeOverlay: true });
        setExportJobs((current) => [job, ...current.filter((item) => item.id !== job.id)]);
      });
    },
    [api, project, run],
  );

  const exportPlaylistVideo = useCallback(
    async (playlistId: string) => {
      if (!api || !project) return;
      await run(async () => {
        const job = await api.exports.exportPlaylistVideo({ projectId: project.id, playlistId, includeOverlay: true });
        setExportJobs((current) => [job, ...current.filter((item) => item.id !== job.id)]);
      });
    },
    [api, project, run],
  );

  const value = useMemo<ProjectState>(
    () => ({
      project,
      projectPath,
      mediaAssets,
      events,
      templates,
      playlists,
      drawings,
      exportJobs,
      recentProjects,
      selectedEventId,
      selectedMediaId,
      selectedPlaylistId,
      mediaUrl,
      loading,
      error,
      isDesktop,
      createProject,
      openProject,
      openRecentProject,
      importPrimaryVideo,
      importCsvEvents,
      createMatchEvent,
      updateMatchEvent,
      deleteMatchEvent,
      createPlaylist,
      addEventToPlaylist,
      removePlaylistItem,
      saveCurrentDrawing,
      deleteDrawing,
      exportCsv,
      exportHtml,
      exportVideo,
      exportPlaylistVideo,
      selectEvent: setSelectedEventId,
      selectPlaylist: setSelectedPlaylistId,
      clearError: () => setError(null),
    }),
    [
      project,
      projectPath,
      mediaAssets,
      events,
      templates,
      playlists,
      drawings,
      exportJobs,
      recentProjects,
      selectedEventId,
      selectedMediaId,
      selectedPlaylistId,
      mediaUrl,
      loading,
      error,
      isDesktop,
      createProject,
      openProject,
      openRecentProject,
      importPrimaryVideo,
      importCsvEvents,
      createMatchEvent,
      updateMatchEvent,
      deleteMatchEvent,
      createPlaylist,
      addEventToPlaylist,
      removePlaylistItem,
      saveCurrentDrawing,
      deleteDrawing,
      exportCsv,
      exportHtml,
      exportVideo,
      exportPlaylistVideo,
    ],
  );

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
}

export function useProject() {
  const context = useContext(ProjectContext);

  if (!context) {
    throw new Error("useProject must be used within ProjectProvider");
  }

  return context;
}

function errorMessage(reason: unknown): string {
  if (reason instanceof Error) {
    return reason.message;
  }

  return typeof reason === "string" ? reason : "操作失败";
}
