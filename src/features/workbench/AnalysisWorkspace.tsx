import {
  Bookmark,
  Brain,
  ChevronDown,
  Circle,
  ClipboardList,
  Download,
  FastForward,
  FileJson,
  FileVideo,
  FolderOpen,
  Import,
  Menu,
  MousePointer2,
  Pause,
  Play,
  Plus,
  Rewind,
  Save,
  Scissors,
  Search,
  Settings,
  SkipBack,
  SkipForward,
  Square,
  Trash2,
  Undo2,
  Upload,
  Wand2,
  Users,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode } from "react";
import { useProject } from "../../app/ProjectContext";
import type {
  CodingButton,
  CodingTemplate,
  AiCandidate,
  Drawing,
  DrawingLayer,
  DrawingTool,
  ExportJob,
  MatchEvent,
  MatchPhase,
  Playlist,
  Player,
  RecentProject,
  ReviewSummary,
  TrainingTopic,
  UpdateEventInput,
  UpdatePlayerInput,
  MigrationPreview,
} from "../../../shared/domain";
import { clampTimeMs, formatTimecode, normalizeEventRange } from "../../../shared/time";

const phaseLabels: Record<MatchPhase, string> = {
  attack: "进攻",
  defense: "防守",
  transition: "转换",
  set_piece: "定位球",
};

const phaseClass: Record<MatchPhase, string> = {
  attack: "phase-attack",
  defense: "phase-defense",
  transition: "phase-transition",
  set_piece: "phase-set-piece",
};

export function AnalysisWorkspace() {
  const {
    project,
    projectPath,
    mediaAssets,
    mediaUrl,
    events,
    templates,
    playlists,
    drawings,
    exportJobs,
    players,
    trainingTopics,
    aiCandidates,
    reviewSummary,
    migrationPreview,
    recentProjects,
    selectedEventId,
    selectedMediaId,
    selectedPlaylistId,
    loading,
    error,
    isDesktop,
    createProject,
    openProject,
    openRecentProject,
    importPrimaryVideo,
    importCsvEvents,
    previewMigration,
    commitMigration,
    createMatchEvent,
    updateMatchEvent,
    deleteMatchEvent,
    saveTemplate,
    importTemplate,
    createPlaylist,
    addEventToPlaylist,
    removePlaylistItem,
    saveCurrentDrawing,
    deleteDrawing,
    generateReview,
    generateAiCandidates,
    confirmAiCandidate,
    ignoreAiCandidate,
    createPlayer,
    updatePlayer,
    generateTrainingTopics,
    createTrainingTopic,
    exportCsv,
    exportHtml,
    exportVideo,
    exportPlaylistVideo,
    exportBackup,
    selectEvent,
    selectPlaylist,
    clearError,
  } = useProject();
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [projectName, setProjectName] = useState("比赛复盘");
  const [currentMs, setCurrentMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playbackError, setPlaybackError] = useState<string | null>(null);
  const [markInMs, setMarkInMs] = useState<number | null>(null);
  const [markOutMs, setMarkOutMs] = useState<number | null>(null);
  const [filterPhase, setFilterPhase] = useState<MatchPhase | "all">("all");
  const [rightTab, setRightTab] = useState<
    "detail" | "events" | "filters" | "playlist" | "review" | "ai" | "players" | "training" | "template" | "migration"
  >("detail");
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [timelineView, setTimelineView] = useState<"timeline" | "matrix">("timeline");
  const [drawingTool, setDrawingTool] = useState<DrawingTool | "select">("select");
  const [draftLayers, setDraftLayers] = useState<DrawingLayer[]>([]);
  const [selectedDraftLayerId, setSelectedDraftLayerId] = useState<string | null>(null);
  const [selectedSavedDrawingId, setSelectedSavedDrawingId] = useState<string | null>(null);
  const [collapsedCodeGroups, setCollapsedCodeGroups] = useState<Set<string>>(() => new Set());
  const [commandMenuOpen, setCommandMenuOpen] = useState(false);

  const activeTemplate = templates[0];
  const selectedEvent = useMemo(
    () => events.find((event) => event.id === selectedEventId) ?? null,
    [events, selectedEventId],
  );
  const selectedMedia = useMemo(
    () => mediaAssets.find((asset) => asset.id === selectedMediaId) ?? mediaAssets[0] ?? null,
    [mediaAssets, selectedMediaId],
  );
  const selectedPlaylist = useMemo(
    () => playlists.find((playlist) => playlist.id === selectedPlaylistId) ?? playlists[0] ?? null,
    [playlists, selectedPlaylistId],
  );
  const visibleEvents = useMemo(
    () => (filterPhase === "all" ? events : events.filter((event) => event.phase === filterPhase)),
    [events, filterPhase],
  );
  const groupedEvents = useMemo(() => {
    const groups: Record<MatchPhase, MatchEvent[]> = {
      attack: [],
      defense: [],
      transition: [],
      set_piece: [],
    };
    for (const event of visibleEvents) {
      if (event.phase) {
        groups[event.phase].push(event);
      }
    }
    return groups;
  }, [visibleEvents]);
  const visibleDrawings = useMemo(() => {
    if (!selectedMedia) {
      return [];
    }

    return drawings
      .filter((drawing) => drawing.mediaId === selectedMedia.id)
      .filter((drawing) => {
        if (selectedEvent) {
          return drawing.eventId === selectedEvent.id;
        }

        return Math.abs(drawing.timeMs - currentMs) <= 1_000;
      })
      .toSorted((a, b) => a.timeMs - b.timeMs);
  }, [currentMs, drawings, selectedEvent, selectedMedia]);
  const activeDraftLayerId = useMemo(
    () => (selectedDraftLayerId && draftLayers.some((layer) => layer.id === selectedDraftLayerId) ? selectedDraftLayerId : null),
    [draftLayers, selectedDraftLayerId],
  );
  const activeSavedDrawingId = useMemo(
    () =>
      selectedSavedDrawingId && visibleDrawings.some((drawing) => drawing.id === selectedSavedDrawingId)
        ? selectedSavedDrawingId
        : null,
    [selectedSavedDrawingId, visibleDrawings],
  );

  const seekTo = useCallback((ms: number) => {
    const video = videoRef.current;
    const next = Math.max(0, ms);
    if (video) {
      video.currentTime = next / 1000;
    }
    setCurrentMs(next);
  }, []);

  const togglePlayback = useCallback(() => {
    const video = videoRef.current;
    if (!video) {
      return;
    }

    if (video.paused) {
      void video.play();
    } else {
      video.pause();
    }
  }, []);

  const createFromButton = useCallback(
    async (button: CodingButton) => {
      if (!project || !selectedMedia) {
        return;
      }

      const range =
        markInMs !== null && markOutMs !== null
          ? normalizeEventRange(markInMs, markOutMs, currentMs, button.defaultDurationMs ?? 10_000)
          : normalizeEventRange(0, 0, currentMs, button.defaultDurationMs ?? 10_000);

      await createMatchEvent({
        projectId: project.id,
        mediaId: selectedMedia.id,
        startMs: range.startMs,
        endMs: range.endMs,
        eventType: button.eventType,
        phase: button.phase,
        team: "home",
        note: "",
      });
    },
    [createMatchEvent, currentMs, markInMs, markOutMs, project, selectedMedia],
  );

  const createQuickEvent = useCallback(() => {
    if (!project || !selectedMedia) {
      return;
    }

    const range = normalizeEventRange(0, 0, currentMs, 10_000);
    void createMatchEvent({
      projectId: project.id,
      mediaId: selectedMedia.id,
      startMs: range.startMs,
      endMs: range.endMs,
      eventType: "自定义事件",
      phase: "attack",
      team: "home",
      note: "",
    });
  }, [createMatchEvent, currentMs, project, selectedMedia]);

  const deleteSelectedDrawing = useCallback(() => {
    if (activeDraftLayerId) {
      setDraftLayers((current) => current.filter((layer) => layer.id !== activeDraftLayerId));
      setSelectedDraftLayerId(null);
      return;
    }

    if (activeSavedDrawingId) {
      void deleteDrawing(activeSavedDrawingId).then(() => setSelectedSavedDrawingId(null));
    }
  }, [activeDraftLayerId, activeSavedDrawingId, deleteDrawing]);

  const undoDraftLayer = useCallback(() => {
    setDraftLayers((current) => {
      const next = current.slice(0, -1);
      setSelectedDraftLayerId(next.at(-1)?.id ?? null);
      return next;
    });
    setSelectedSavedDrawingId(null);
  }, []);

  const clearDraftLayers = useCallback(() => {
    setDraftLayers([]);
    setSelectedDraftLayerId(null);
  }, []);

  const toggleCodeGroup = useCallback((groupId: string) => {
    setCollapsedCodeGroups((current) => {
      const next = new Set(current);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) {
        return;
      }

      if (event.code === "Space") {
        event.preventDefault();
        togglePlayback();
        return;
      }

      if (event.key.toLowerCase() === "i") {
        setMarkInMs(currentMs);
        return;
      }

      if (event.key.toLowerCase() === "o") {
        setMarkOutMs(currentMs);
        return;
      }

      if (event.key === "ArrowLeft") {
        seekTo(currentMs - 5_000);
        return;
      }

      if (event.key === "ArrowRight") {
        seekTo(currentMs + 5_000);
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        event.preventDefault();
        deleteSelectedDrawing();
        return;
      }

      if (event.key === "Escape") {
        setDrawingTool("select");
        setSelectedDraftLayerId(null);
        setSelectedSavedDrawingId(null);
        return;
      }

      const button = activeTemplate?.groups
        .flatMap((group) => group.buttons)
        .find((item) => item.hotkey?.toLowerCase() === event.key.toLowerCase());
      if (button) {
        void createFromButton(button);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [activeTemplate, createFromButton, currentMs, deleteSelectedDrawing, seekTo, togglePlayback]);

  const selectAndSeekEvent = useCallback(
    (id: string) => {
      selectEvent(id);
      setSelectedDraftLayerId(null);
      setSelectedSavedDrawingId(null);
      const event = events.find((item) => item.id === id);
      if (event) {
        seekTo(event.startMs);
      }
    },
    [events, seekTo, selectEvent],
  );

  const runCommand = useCallback((command: () => void) => {
    setCommandMenuOpen(false);
    command();
  }, []);

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="brand-block">
          <button
            className="icon-button"
            type="button"
            aria-expanded={commandMenuOpen}
            title="打开命令菜单"
            onClick={() => setCommandMenuOpen((current) => !current)}
          >
            <Menu size={18} />
          </button>
          {commandMenuOpen ? (
            <div className="command-menu" role="menu">
              <button type="button" role="menuitem" onClick={() => runCommand(() => void openProject())}>
                <FolderOpen size={15} />
                打开项目
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={!project || loading}
                onClick={() => runCommand(() => void importPrimaryVideo("copy"))}
              >
                <Upload size={15} />
                导入视频
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={!project || !selectedMedia || loading}
                onClick={() => runCommand(() => void importCsvEvents())}
              >
                <Import size={15} />
                导入 CSV
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={!project || events.length === 0 || loading}
                onClick={() => runCommand(() => void exportHtml(selectedPlaylist?.id))}
              >
                <Download size={15} />
                导出报告
              </button>
              <button
                type="button"
                role="menuitem"
                disabled={!project || loading}
                onClick={() => runCommand(() => void exportBackup())}
              >
                <Save size={15} />
                项目备份
              </button>
            </div>
          ) : null}
          <span className="brand">ScoutCode</span>
          <span className="divider" />
          <FolderOpen size={17} />
          <span className="project-title">{project?.name ?? "未打开项目"}</span>
          <ChevronDown size={16} />
        </div>
        <div className="top-actions">
          <button className="toolbar-button" type="button" onClick={() => void openProject()}>
            <FolderOpen size={16} />
            打开
          </button>
          <button
            className="toolbar-button"
            type="button"
            disabled={!project || loading}
            onClick={() => void importPrimaryVideo("copy")}
          >
            <Upload size={16} />
            导入视频
          </button>
          <button
            className="toolbar-button"
            type="button"
            disabled={!project || !selectedMedia || loading}
            onClick={() => void importCsvEvents()}
            title="导入 CSV 事件表"
          >
            <Import size={16} />
            导入CSV
          </button>
          <button
            className="toolbar-button"
            type="button"
            disabled={!project || events.length === 0 || loading}
            onClick={() => void exportHtml(selectedPlaylist?.id)}
            title="导出 HTML 报告"
          >
            <Download size={16} />
            导出
          </button>
          <button className="toolbar-button" type="button" disabled={!selectedEvent} onClick={() => selectedEvent && void exportVideo(selectedEvent.id)} title="导出当前事件视频">
            <Settings size={16} />
            导出片段
          </button>
          <span className="status-dot" />
          <span className="status-text">{project ? "已保存" : isDesktop ? "等待项目" : "浏览器预览"}</span>
        </div>
      </header>

      {error ? (
        <div className="error-banner">
          <span>{error}</span>
          <button type="button" onClick={clearError}>
            关闭
          </button>
        </div>
      ) : null}

      <main className="workspace-grid">
        <aside className="coding-panel">
          <PanelHeader title="编码面板" disabled={!project || !selectedMedia} onCreate={createQuickEvent} />
          <div className="search-row">
            <Search size={15} />
            <span>搜索编码...</span>
          </div>
          {activeTemplate?.groups.map((group) => (
            <section className="code-group" key={group.id}>
              <button className="group-title" type="button" onClick={() => toggleCodeGroup(group.id)}>
                <span className={`phase-dot ${phaseClass[group.phase]}`} />
                <span>{group.name}</span>
                <ChevronDown className={collapsedCodeGroups.has(group.id) ? "collapsed" : ""} size={15} />
              </button>
              {!collapsedCodeGroups.has(group.id) ? (
                <div className="code-button-grid">
                  {group.buttons.map((button) => (
                    <button
                      className={`code-button ${phaseClass[group.phase]}`}
                      type="button"
                      key={button.id}
                      disabled={!project || !selectedMedia}
                      onClick={() => void createFromButton(button)}
                      title={button.hotkey ? `${button.label} (${button.hotkey})` : button.label}
                    >
                      <span>{button.label}</span>
                      <kbd>{button.hotkey}</kbd>
                    </button>
                  ))}
                </div>
              ) : null}
            </section>
          ))}
          <section className="code-group disabled-group">
            <div className="group-title">
              <span className="phase-dot phase-muted" />
              <span>AI候选</span>
              <Wand2 size={14} />
            </div>
            <button className="wide-disabled" type="button" disabled={!project || !selectedMedia} onClick={() => setRightTab("ai")}>
              生成并确认候选片段
            </button>
          </section>
        </aside>

        <section className="video-column">
          <div
            className={`video-stage ${drawingTool !== "select" ? "drawing-active" : ""}`}
            onClick={(event) => {
              if (drawingTool === "select") {
                setSelectedDraftLayerId(null);
                setSelectedSavedDrawingId(null);
                return;
              }
              const bounds = event.currentTarget.getBoundingClientRect();
              const x = clamp01((event.clientX - bounds.left) / bounds.width);
              const y = clamp01((event.clientY - bounds.top) / bounds.height);
              const layer = createLayerFromClick(drawingTool, x, y);
              setDraftLayers((current) => [...current, layer]);
              setSelectedDraftLayerId(layer.id);
              setSelectedSavedDrawingId(null);
            }}
          >
            {mediaUrl ? (
              <video
                ref={videoRef}
                className="match-video"
                src={mediaUrl}
                controls={false}
                preload="metadata"
                onLoadedMetadata={(event) => {
                  const video = event.currentTarget;
                  setDurationMs(Math.round(video.duration * 1000));
                  setPlaybackError(null);
                }}
                onTimeUpdate={(event) => setCurrentMs(Math.round(event.currentTarget.currentTime * 1000))}
                onPlay={() => setIsPlaying(true)}
                onPause={() => setIsPlaying(false)}
                onError={(event) => {
                  const code = event.currentTarget.error?.code;
                  setPlaybackError(
                    code
                      ? `视频无法播放，浏览器内核返回错误码 ${code}。请优先测试 H.264 编码的 MP4 文件。`
                      : "视频无法播放。请优先测试 H.264 编码的 MP4 文件。",
                  );
                }}
              />
            ) : (
              <div className="video-empty">
                <FileVideo size={42} />
                <strong>{project ? "导入比赛视频开始分析" : "创建或打开项目后导入视频"}</strong>
                <span>支持 MP4、MOV、MKV、AVI；可复制到项目或链接原文件。</span>
              </div>
            )}
            <div className="score-bug">
              <span>{project?.homeTeam ?? "青年队"}</span>
              <strong>{project?.score ?? "0 - 0"}</strong>
              <span>{project?.awayTeam ?? "对手队"}</span>
            </div>
            {playbackError ? <div className="playback-error">{playbackError}</div> : null}
            {visibleDrawings.length > 0 || draftLayers.length > 0 ? (
              <svg className="drawing-overlay" viewBox="0 0 1 1" preserveAspectRatio="none">
                {visibleDrawings.map((drawing) => (
                  <g key={drawing.id}>
                    {drawing.layers.map((layer) => (
                      <DrawingLayerView
                        key={layer.id}
                        layer={layer}
                        selected={activeSavedDrawingId === drawing.id}
                        onSelect={() => {
                          setSelectedSavedDrawingId(drawing.id);
                          setSelectedDraftLayerId(null);
                          setDrawingTool("select");
                        }}
                      />
                    ))}
                  </g>
                ))}
                {draftLayers.map((layer) => (
                  <DrawingLayerView
                    layer={layer}
                    key={layer.id}
                    selected={activeDraftLayerId === layer.id}
                    onSelect={() => {
                      setSelectedDraftLayerId(layer.id);
                      setSelectedSavedDrawingId(null);
                      setDrawingTool("select");
                    }}
                  />
                ))}
              </svg>
            ) : null}
            <div className="drawing-toolbar">
              <button
                className={drawingTool === "select" ? "active" : ""}
                type="button"
                title="选择"
                onClick={(event) => {
                  event.stopPropagation();
                  setDrawingTool("select");
                }}
              >
                <MousePointer2 size={15} />
              </button>
              <button
                className={drawingTool === "arrow" ? "active" : ""}
                type="button"
                title="箭头"
                onClick={(event) => {
                  event.stopPropagation();
                  setDrawingTool("arrow");
                }}
              >
                <SkipForward size={15} />
              </button>
              <button
                className={drawingTool === "label" ? "active" : ""}
                type="button"
                title="编号/标签"
                onClick={(event) => {
                  event.stopPropagation();
                  setDrawingTool("label");
                }}
              >
                <Circle size={15} />
              </button>
              <button
                className={drawingTool === "zone" ? "active" : ""}
                type="button"
                title="区域框"
                onClick={(event) => {
                  event.stopPropagation();
                  setDrawingTool("zone");
                }}
              >
                <Square size={15} />
              </button>
              <button
                type="button"
                disabled={draftLayers.length === 0}
                title="撤销上一笔"
                onClick={(event) => {
                  event.stopPropagation();
                  undoDraftLayer();
                }}
              >
                <Undo2 size={15} />
              </button>
              <button
                type="button"
                disabled={!activeDraftLayerId && !activeSavedDrawingId}
                title="删除选中标记"
                onClick={(event) => {
                  event.stopPropagation();
                  deleteSelectedDrawing();
                }}
              >
                <Trash2 size={15} />
              </button>
              <button
                type="button"
                disabled={draftLayers.length === 0}
                title="清空未保存标记"
                onClick={(event) => {
                  event.stopPropagation();
                  clearDraftLayers();
                }}
              >
                <Scissors size={15} />
              </button>
              <button
                type="button"
                disabled={!project || !selectedMedia || draftLayers.length === 0}
                title="保存当前冻结帧标注"
                onClick={(event) => {
                  event.stopPropagation();
                  if (!selectedMedia) {
                    return;
                  }
                  void saveCurrentDrawing({
                    eventId: selectedEvent?.id,
                    mediaId: selectedMedia.id,
                    timeMs: currentMs,
                    layers: draftLayers,
                  }).then(() => {
                    setDraftLayers([]);
                    setSelectedDraftLayerId(null);
                  });
                }}
              >
                <Save size={15} />
              </button>
            </div>
          </div>

          <div className="transport">
            <div className="scrub-row">
              <span>{formatTimecode(currentMs, true)}</span>
              <input
                type="range"
                min={0}
                max={Math.max(durationMs, selectedMedia?.durationMs ?? 0, 1)}
                value={Math.min(currentMs, Math.max(durationMs, selectedMedia?.durationMs ?? 0, 1))}
                onChange={(event) => seekTo(Number(event.target.value))}
              />
              <span>{formatTimecode(Math.max(durationMs, selectedMedia?.durationMs ?? 0))}</span>
            </div>
            <div className="transport-buttons">
              <button type="button" onClick={() => seekTo(currentMs - 10_000)} title="后退 10 秒">
                <Rewind size={18} />
              </button>
              <button type="button" onClick={() => seekTo(currentMs - 1_000)} title="后退 1 秒">
                <SkipBack size={18} />
              </button>
              <button className="primary-play" type="button" onClick={togglePlayback} title="播放/暂停">
                {isPlaying ? <Pause size={22} /> : <Play size={22} />}
              </button>
              <button type="button" onClick={() => seekTo(currentMs + 1_000)} title="前进 1 秒">
                <SkipForward size={18} />
              </button>
              <button type="button" onClick={() => seekTo(currentMs + 10_000)} title="前进 10 秒">
                <FastForward size={18} />
              </button>
            </div>
            <div className="mark-row">
              <button type="button" onClick={() => setMarkInMs(currentMs)}>
                Mark In <kbd>I</kbd>
              </button>
              <strong>{formatTimecode(currentMs, true)}</strong>
              <button type="button" onClick={() => setMarkOutMs(currentMs)}>
                Mark Out <kbd>O</kbd>
              </button>
            </div>
          </div>
        </section>

        <aside className="inspector-panel">
          <div className="tabs">
            {[
              ["detail", "事件详情"],
              ["events", "事件列表"],
              ["playlist", "片段集"],
              ["review", "复盘"],
              ["ai", "AI"],
              ["players", "球员"],
              ["training", "训练"],
              ["template", "模板"],
              ["migration", "迁移"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={rightTab === id ? "active" : ""}
                onClick={() => setRightTab(id as typeof rightTab)}
              >
                {label}
              </button>
            ))}
          </div>
          {rightTab === "detail" ? (
            <EventDetail
              event={selectedEvent}
              onUpdate={(id, patch) => void updateMatchEvent(id, patch)}
              onDelete={(id) => void deleteMatchEvent(id)}
            />
          ) : null}
          {rightTab === "events" ? (
            <EventList events={visibleEvents} selectedEventId={selectedEventId} onSelect={selectAndSeekEvent} />
          ) : null}
          {rightTab === "filters" ? (
            <Filters filterPhase={filterPhase} setFilterPhase={setFilterPhase} />
          ) : null}
          {rightTab === "playlist" ? (
            <PlaylistPanel
              events={events}
              playlists={playlists}
              drawings={drawings}
              exportJobs={exportJobs}
              selectedEvent={selectedEvent}
              selectedPlaylist={selectedPlaylist}
              onCreatePlaylist={() => void createPlaylist("教练会复盘", "coach_review")}
              onSelectPlaylist={selectPlaylist}
              onAddEvent={(playlistId, eventId) =>
                void addEventToPlaylist({
                  playlistId,
                  eventId,
                  title: events.find((event) => event.id === eventId)?.eventType,
                })
              }
              onRemoveItem={(itemId) => void removePlaylistItem(itemId)}
              onExportCsv={(playlistId) => void exportCsv(playlistId)}
              onExportHtml={(playlistId) => void exportHtml(playlistId)}
              onExportPlaylistVideo={(playlistId) => void exportPlaylistVideo(playlistId)}
            />
          ) : null}
          {rightTab === "review" ? (
            <ReviewPanel
              summary={reviewSummary}
              trainingTopics={trainingTopics}
              eventById={new Map(events.map((event) => [event.id, event]))}
              onGenerate={() => void generateReview()}
            />
          ) : null}
          {rightTab === "ai" ? (
            <AiCandidatePanel
              candidates={aiCandidates}
              onGenerate={() => void generateAiCandidates()}
              onConfirm={(id) => void confirmAiCandidate(id)}
              onIgnore={(id) => void ignoreAiCandidate(id)}
              onSeek={(candidate) => seekTo(candidate.startMs)}
            />
          ) : null}
          {rightTab === "players" ? (
            <PlayersPanel
              projectId={project?.id}
              players={players}
              events={events}
              onCreate={(name) => project && void createPlayer({ projectId: project.id, name })}
              onUpdate={(id, patch) => void updatePlayer(id, patch)}
            />
          ) : null}
          {rightTab === "training" ? (
            <TrainingPanel
              projectId={project?.id}
              topics={trainingTopics}
              onGenerate={() => void generateTrainingTopics()}
              onCreate={(title) =>
                project &&
                void createTrainingTopic({
                  projectId: project.id,
                  title,
                  priority: "medium",
                  recommendation: "Add three representative clips and turn them into a training exercise.",
                })
              }
            />
          ) : null}
          {rightTab === "template" ? (
            <TemplateEditorPanel
              key={activeTemplate?.id ?? "empty-template"}
              template={activeTemplate}
              onSave={(template) => void saveTemplate(template)}
              onImport={() => void importTemplate()}
            />
          ) : null}
          {rightTab === "migration" ? (
            <MigrationPanel
              preview={migrationPreview}
              onPreview={() => void previewMigration()}
              onCommit={() => void commitMigration()}
              onExportBackup={() => void exportBackup()}
            />
          ) : null}
        </aside>

        <section className="timeline-panel">
          <div className="timeline-toolbar">
            <div className="timeline-tabs">
              <button
                className={timelineView === "timeline" ? "active" : ""}
                type="button"
                title="显示时间线视图"
                onClick={() => setTimelineView("timeline")}
              >
                时间线
              </button>
              <button
                className={timelineView === "matrix" ? "active" : ""}
                type="button"
                title="显示矩阵占位视图"
                onClick={() => setTimelineView("matrix")}
              >
                矩阵视图
              </button>
            </div>
            <div className="timeline-controls">
              <span>缩放</span>
              <input
                type="range"
                min={1}
                max={4}
                step={0.25}
                value={timelineZoom}
                onChange={(event) => setTimelineZoom(Number(event.target.value))}
              />
            </div>
          </div>
          {timelineView === "timeline" ? (
            <>
              <div className="timeline-ruler">
                {Array.from({ length: 10 }, (_, index) => (
                  <span key={index}>{formatTimecode((Math.max(durationMs, 5_400_000) / 9) * index)}</span>
                ))}
              </div>
              <div className="tracks" style={{ ["--timeline-zoom" as string]: timelineZoom }}>
                {(Object.keys(groupedEvents) as MatchPhase[]).map((phase) => (
                  <div className="track-row" key={phase}>
                    <div className="track-label">
                      <span className={`phase-dot ${phaseClass[phase]}`} />
                      {phaseLabels[phase]}
                    </div>
                    <div className="track-lane">
                      {groupedEvents[phase].map((event) => (
                        <button
                          className={`event-chip ${phaseClass[phase]} ${selectedEventId === event.id ? "selected" : ""}`}
                          key={event.id}
                          type="button"
                          style={{
                            left: `${eventLeft(event, durationMs)}%`,
                            width: `${eventWidth(event, durationMs)}%`,
                          }}
                          onClick={() => selectAndSeekEvent(event.id)}
                          title={`${event.eventType} ${formatTimecode(event.startMs, true)}`}
                        />
                      ))}
                    </div>
                  </div>
                ))}
                <div className="playhead" style={{ left: `${durationMs > 0 ? (currentMs / durationMs) * 100 : 0}%` }} />
              </div>
            </>
          ) : (
            <TimelineMatrix groupedEvents={groupedEvents} onSelect={selectAndSeekEvent} />
          )}
          <footer className="workspace-status">
            <span>项目：{projectPath ?? "未保存"}</span>
            <span>视频：{selectedMedia?.displayName ?? "未导入"}</span>
            <span>事件总数：{events.length}</span>
            <span>筛选显示：{visibleEvents.length}</span>
          </footer>
        </section>
      </main>

      {!project || !selectedMedia ? (
        <StartOverlay
          project={project}
          projectName={projectName}
          setProjectName={setProjectName}
          recentProjects={recentProjects}
          loading={loading}
          onCreate={() => void createProject(projectName)}
          onOpen={() => void openProject()}
          onOpenRecent={(path) => void openRecentProject(path)}
          onImport={() => void importPrimaryVideo("copy")}
        />
      ) : null}
    </div>
  );
}

function TimelineMatrix({
  groupedEvents,
  onSelect,
}: {
  groupedEvents: Record<MatchPhase, MatchEvent[]>;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="timeline-matrix" aria-label="矩阵视图占位">
      {(Object.keys(groupedEvents) as MatchPhase[]).map((phase) => (
        <section className="matrix-phase" key={phase}>
          <div>
            <span className={`phase-dot ${phaseClass[phase]}`} />
            <strong>{phaseLabels[phase]}</strong>
          </div>
          <span>{groupedEvents[phase].length} 个事件</span>
          <div className="matrix-event-list">
            {groupedEvents[phase].slice(0, 3).map((event) => (
              <button type="button" key={event.id} onClick={() => onSelect(event.id)}>
                {event.eventType}
              </button>
            ))}
            {groupedEvents[phase].length === 0 ? <small>编码后显示聚合事件</small> : null}
          </div>
        </section>
      ))}
      <div className="matrix-note">矩阵视图会在后续版本完善筛选、交叉统计和批量入片段集；当前先提供可点击入口与阶段聚合预览。</div>
    </div>
  );
}

function PanelHeader({
  title,
  disabled,
  onCreate,
}: {
  title: string;
  disabled?: boolean;
  onCreate?: () => void;
}) {
  return (
    <div className="panel-header">
      <span>{title}</span>
      <button type="button" disabled={disabled || !onCreate} title="新建自定义事件" onClick={onCreate}>
        <Plus size={15} />
      </button>
    </div>
  );
}

function EventDetail({
  event,
  onUpdate,
  onDelete,
}: {
  event: MatchEvent | null;
  onUpdate: (id: string, patch: UpdateEventInput) => void;
  onDelete: (id: string) => void;
}) {
  if (!event) {
    return (
      <div className="empty-detail">
        <Bookmark size={24} />
        <strong>选择一个时间线事件</strong>
        <span>点击左侧编码按钮创建事件，或从底部时间线选择已有片段。</span>
      </div>
    );
  }

  return (
    <div className="detail-form">
      <label>
        事件类型
        <input value={event.eventType} onChange={(change) => onUpdate(event.id, { eventType: change.target.value })} />
      </label>
      <label>
        所属阶段
        <select
          value={event.phase ?? ""}
          onChange={(change) => onUpdate(event.id, { phase: change.target.value as MatchPhase })}
        >
          <option value="attack">进攻</option>
          <option value="defense">防守</option>
          <option value="transition">转换</option>
          <option value="set_piece">定位球</option>
        </select>
      </label>
      <div className="time-edit-grid">
        <label>
          开始秒
          <input
            type="number"
            min={0}
            step={0.5}
            value={secondsLabel(event.startMs)}
            onChange={(change) => {
              const nextStartMs = parseSecondsAsMs(change.target.value);
              if (nextStartMs === null) {
                return;
              }
              const durationMs = Math.max(500, event.endMs - event.startMs);
              onUpdate(event.id, { startMs: nextStartMs, endMs: nextStartMs + durationMs });
            }}
          />
        </label>
        <label>
          结束秒
          <input
            type="number"
            min={0.5}
            step={0.5}
            value={secondsLabel(event.endMs)}
            onChange={(change) => {
              const nextEndMs = parseSecondsAsMs(change.target.value);
              if (nextEndMs === null) {
                return;
              }
              onUpdate(event.id, { endMs: Math.max(event.startMs + 500, nextEndMs) });
            }}
          />
        </label>
        <label>
          时长秒
          <input
            type="number"
            min={0.5}
            step={0.5}
            value={secondsLabel(event.endMs - event.startMs)}
            onChange={(change) => {
              const nextDurationMs = parseSecondsAsMs(change.target.value);
              if (nextDurationMs === null) {
                return;
              }
              onUpdate(event.id, { endMs: event.startMs + Math.max(500, nextDurationMs) });
            }}
          />
        </label>
      </div>
      <label>
        球员
        <input
          value={event.playerName ?? ""}
          placeholder="号码 / 姓名"
          onChange={(change) => onUpdate(event.id, { playerName: change.target.value })}
        />
      </label>
      <label>
        场区
        <input
          value={event.zone ?? ""}
          placeholder="进攻三区 - 中路"
          onChange={(change) => onUpdate(event.id, { zone: change.target.value })}
        />
      </label>
      <label>
        结果
        <input
          value={event.result ?? ""}
          placeholder="成功 / 失败 / 造成射门"
          onChange={(change) => onUpdate(event.id, { result: change.target.value })}
        />
      </label>
      <label>
        备注
        <textarea
          value={event.note ?? ""}
          rows={4}
          placeholder="教练会说明或球员反馈重点"
          onChange={(change) => onUpdate(event.id, { note: change.target.value })}
        />
      </label>
      <div className="detail-meta">
        <span>开始 {formatTimecode(event.startMs, true)}</span>
        <span>结束 {formatTimecode(event.endMs, true)}</span>
      </div>
      <button className="danger-button" type="button" onClick={() => onDelete(event.id)}>
        <Trash2 size={15} />
        删除事件
      </button>
    </div>
  );
}

function EventList({
  events,
  selectedEventId,
  onSelect,
}: {
  events: MatchEvent[];
  selectedEventId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="event-list">
      {events.map((event) => (
        <button
          className={event.id === selectedEventId ? "selected" : ""}
          type="button"
          key={event.id}
          onClick={() => onSelect(event.id)}
        >
          <span className={`phase-dot ${event.phase ? phaseClass[event.phase] : "phase-muted"}`} />
          <strong>{event.eventType}</strong>
          <span>{formatTimecode(event.startMs, true)}</span>
        </button>
      ))}
      {events.length === 0 ? <span className="subtle">暂无事件</span> : null}
    </div>
  );
}

function Filters({
  filterPhase,
  setFilterPhase,
}: {
  filterPhase: MatchPhase | "all";
  setFilterPhase: (phase: MatchPhase | "all") => void;
}) {
  return (
    <div className="filters">
      {[
        ["all", "全部"],
        ["attack", "进攻"],
        ["defense", "防守"],
        ["transition", "转换"],
        ["set_piece", "定位球"],
      ].map(([id, label]) => (
        <button
          className={filterPhase === id ? "active" : ""}
          type="button"
          key={id}
          onClick={() => setFilterPhase(id as MatchPhase | "all")}
        >
          {label}
        </button>
      ))}
      <button type="button" disabled>
        AI候选
      </button>
    </div>
  );
}

function PlaylistPanel({
  events,
  playlists,
  drawings,
  exportJobs,
  selectedEvent,
  selectedPlaylist,
  onCreatePlaylist,
  onSelectPlaylist,
  onAddEvent,
  onRemoveItem,
  onExportCsv,
  onExportHtml,
  onExportPlaylistVideo,
}: {
  events: MatchEvent[];
  playlists: Playlist[];
  drawings: Drawing[];
  exportJobs: ExportJob[];
  selectedEvent: MatchEvent | null;
  selectedPlaylist: Playlist | null;
  onCreatePlaylist: () => void;
  onSelectPlaylist: (id: string) => void;
  onAddEvent: (playlistId: string, eventId: string) => void;
  onRemoveItem: (itemId: string) => void;
  onExportCsv: (playlistId?: string) => void;
  onExportHtml: (playlistId?: string) => void;
  onExportPlaylistVideo: (playlistId: string) => void;
}) {
  const byId = useMemo(() => new Map(events.map((event) => [event.id, event])), [events]);

  return (
    <div className="playlist-panel">
      <div className="playlist-actions">
        <button type="button" onClick={onCreatePlaylist}>
          <Plus size={15} />
          新建片段集
        </button>
        <button
          type="button"
          disabled={!selectedPlaylist || !selectedEvent}
          onClick={() => selectedPlaylist && selectedEvent && onAddEvent(selectedPlaylist.id, selectedEvent.id)}
        >
          <Scissors size={15} />
          加入当前事件
        </button>
      </div>
      <div className="playlist-select">
        {playlists.map((playlist) => (
          <button
            className={selectedPlaylist?.id === playlist.id ? "active" : ""}
            type="button"
            key={playlist.id}
            onClick={() => onSelectPlaylist(playlist.id)}
          >
            <strong>{playlist.name}</strong>
            <span>{playlist.items.length} 个片段</span>
          </button>
        ))}
      </div>
      {selectedPlaylist ? (
        <>
          <div className="playlist-items">
            {selectedPlaylist.items.map((item) => {
              const event = byId.get(item.eventId);
              return (
                <div className="playlist-item" key={item.id}>
                  <div>
                    <strong>{item.title ?? event?.eventType ?? "片段"}</strong>
                    <span>
                      {event ? formatTimecode(event.startMs, true) : "事件已缺失"} / pre {item.preRollMs / 1000}s
                    </span>
                  </div>
                  <button type="button" onClick={() => onRemoveItem(item.id)} title="移除">
                    <Trash2 size={14} />
                  </button>
                </div>
              );
            })}
            {selectedPlaylist.items.length === 0 ? <span className="subtle">从事件详情或时间线选择事件后加入片段集。</span> : null}
          </div>
          <div className="playlist-export">
            <button type="button" onClick={() => onExportCsv(selectedPlaylist.id)}>
              导出 CSV
            </button>
            <button type="button" onClick={() => onExportHtml(selectedPlaylist.id)}>
              导出 HTML
            </button>
            <button type="button" onClick={() => onExportPlaylistVideo(selectedPlaylist.id)}>
              导出视频
            </button>
          </div>
        </>
      ) : (
        <M3Placeholder title="片段集" icon={<Scissors size={18} />} />
      )}
      <div className="export-jobs">
        <span>绘图 {drawings.length}</span>
        <span>导出 {exportJobs.length}</span>
        {exportJobs.slice(0, 2).map((job) => (
          <span title={job.outputPath} key={job.id}>
            {job.type.toUpperCase()} / {job.status} / {job.progress}%
          </span>
        ))}
      </div>
    </div>
  );
}

function ReviewPanel({
  summary,
  trainingTopics,
  eventById,
  onGenerate,
}: {
  summary: ReviewSummary | null;
  trainingTopics: TrainingTopic[];
  eventById: Map<string, MatchEvent>;
  onGenerate: () => void;
}) {
  return (
    <div className="inspector-stack">
      <button className="wide-action" type="button" onClick={onGenerate}>
        <ClipboardList size={15} />
        生成一键复盘
      </button>
      {summary ? (
        <>
          <div className="metric-grid">
            {summary.phaseCards.map((card) => (
              <div className="metric-card" key={card.phase}>
                <span>{card.label}</span>
                <strong>{card.count}</strong>
                <small>{card.coachingPoint}</small>
              </div>
            ))}
          </div>
          <section className="compact-section">
            <h3>教练会片段集</h3>
            <span>{summary.coachPlaylistName}</span>
          </section>
          <section className="compact-section">
            <h3>球员反馈</h3>
            {summary.playerReports.length === 0 ? <span className="subtle">给事件填写球员后会自动生成个人反馈。</span> : null}
            {summary.playerReports.map((report) => (
              <div className="mini-row" key={report.playerName}>
                <strong>{report.playerName}</strong>
                <span>{report.eventCount} clips / {report.feedback}</span>
              </div>
            ))}
          </section>
        </>
      ) : (
        <M3Placeholder title="赛后复盘中心" icon={<ClipboardList size={18} />} />
      )}
      <section className="compact-section">
        <h3>训练主题</h3>
        {trainingTopics.slice(0, 4).map((topic) => (
          <div className="mini-row" key={topic.id}>
            <strong>{topic.title}</strong>
            <span>
              {topic.priority} / {topic.evidenceEventIds.map((id) => eventById.get(id)?.eventType).filter(Boolean).slice(0, 2).join(", ")}
            </span>
          </div>
        ))}
      </section>
    </div>
  );
}

function AiCandidatePanel({
  candidates,
  onGenerate,
  onConfirm,
  onIgnore,
  onSeek,
}: {
  candidates: AiCandidate[];
  onGenerate: () => void;
  onConfirm: (id: string) => void;
  onIgnore: (id: string) => void;
  onSeek: (candidate: AiCandidate) => void;
}) {
  const pending = candidates.filter((candidate) => candidate.status === "pending");
  return (
    <div className="inspector-stack">
      <button className="wide-action" type="button" onClick={onGenerate}>
        <Brain size={15} />
        生成 AI 候选
      </button>
      <span className="subtle">AI v1 只给可解释候选，确认后才写入正式时间线。</span>
      <div className="candidate-list">
        {pending.map((candidate) => (
          <article className="candidate-card" key={candidate.id}>
            <button type="button" onClick={() => onSeek(candidate)}>
              <strong>{candidate.eventType}</strong>
              <span>{formatTimecode(candidate.startMs, true)} - {formatTimecode(candidate.endMs, true)}</span>
            </button>
            <p>{Math.round(candidate.confidence * 100)}% / {candidate.reason}</p>
            <div>
              <button type="button" onClick={() => onConfirm(candidate.id)}>确认</button>
              <button type="button" onClick={() => onIgnore(candidate.id)}>忽略</button>
            </div>
          </article>
        ))}
        {pending.length === 0 ? <span className="subtle">暂无待确认候选。</span> : null}
      </div>
    </div>
  );
}

function PlayersPanel({
  projectId,
  players,
  events,
  onCreate,
  onUpdate,
}: {
  projectId?: string;
  players: Player[];
  events: MatchEvent[];
  onCreate: (name: string) => void;
  onUpdate: (id: string, patch: UpdatePlayerInput) => void;
}) {
  const [name, setName] = useState("");
  const eventCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const event of events) {
      if (event.playerName) {
        counts.set(event.playerName, (counts.get(event.playerName) ?? 0) + 1);
      }
    }
    return counts;
  }, [events]);

  return (
    <div className="inspector-stack">
      <div className="inline-create">
        <input value={name} placeholder="球员姓名或号码" onChange={(event) => setName(event.target.value)} />
        <button
          type="button"
          disabled={!projectId || !name.trim()}
          onClick={() => {
            onCreate(name);
            setName("");
          }}
        >
          <Plus size={14} />
        </button>
      </div>
      {players.map((player) => (
        <article className="player-card" key={player.id}>
          <div>
            <strong>{player.number ? `${player.number} ` : ""}{player.name}</strong>
            <span>{player.position ?? "未设置位置"} / {eventCounts.get(player.name) ?? 0} clips</span>
          </div>
          <input value={player.position ?? ""} placeholder="位置" onChange={(event) => onUpdate(player.id, { position: event.target.value })} />
          <textarea value={player.coachNote ?? ""} placeholder="教练备注" rows={2} onChange={(event) => onUpdate(player.id, { coachNote: event.target.value })} />
        </article>
      ))}
      {players.length === 0 ? <M3Placeholder title="球员报告" icon={<Users size={18} />} /> : null}
    </div>
  );
}

function TrainingPanel({
  projectId,
  topics,
  onGenerate,
  onCreate,
}: {
  projectId?: string;
  topics: TrainingTopic[];
  onGenerate: () => void;
  onCreate: (title: string) => void;
}) {
  const [title, setTitle] = useState("");
  return (
    <div className="inspector-stack">
      <button className="wide-action" type="button" onClick={onGenerate}>
        <ClipboardList size={15} />
        从事件生成训练主题
      </button>
      <div className="inline-create">
        <input value={title} placeholder="手动添加训练主题" onChange={(event) => setTitle(event.target.value)} />
        <button
          type="button"
          disabled={!projectId || !title.trim()}
          onClick={() => {
            onCreate(title);
            setTitle("");
          }}
        >
          <Plus size={14} />
        </button>
      </div>
      {topics.map((topic) => (
        <article className="topic-card" key={topic.id}>
          <strong>{topic.title}</strong>
          <span>{topic.priority} / {topic.phase ? phaseLabels[topic.phase] : "通用"} / {topic.evidenceEventIds.length} clips</span>
          <p>{topic.recommendation}</p>
        </article>
      ))}
      {topics.length === 0 ? <span className="subtle">编码几段关键事件后，可自动形成训练主题清单。</span> : null}
    </div>
  );
}

function TemplateEditorPanel({
  template,
  onSave,
  onImport,
}: {
  template?: CodingTemplate;
  onSave: (template: CodingTemplate) => void;
  onImport: () => void;
}) {
  const [draft, setDraft] = useState<CodingTemplate | null>(template ?? null);

  if (!draft) {
    return <M3Placeholder title="Coding 模板" icon={<FileJson size={18} />} />;
  }

  const updateButton = (buttonId: string, patch: Partial<CodingButton>) => {
    setDraft((current) =>
      current
        ? {
            ...current,
            groups: current.groups.map((group) => ({
              ...group,
              buttons: group.buttons.map((button) => (button.id === buttonId ? { ...button, ...patch } : button)),
            })),
          }
        : current,
    );
  };

  return (
    <div className="inspector-stack">
      <div className="playlist-actions">
        <button type="button" onClick={() => onImport()}>
          <Import size={15} />
          导入模板
        </button>
        <button type="button" onClick={() => onSave({ ...draft, updatedAt: new Date().toISOString() })}>
          <Save size={15} />
          保存模板
        </button>
      </div>
      {draft.groups.map((group) => (
        <section className="template-edit-group" key={group.id}>
          <h3>{group.name}</h3>
          {group.buttons.map((button) => (
            <div className="template-edit-row" key={button.id}>
              <input value={button.label} onChange={(event) => updateButton(button.id, { label: event.target.value })} />
              <input value={button.hotkey ?? ""} maxLength={2} onChange={(event) => updateButton(button.id, { hotkey: event.target.value })} />
              <input
                type="number"
                min={1}
                value={(button.defaultDurationMs ?? 10_000) / 1000}
                onChange={(event) => updateButton(button.id, { defaultDurationMs: Math.max(1, Number(event.target.value)) * 1000 })}
              />
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}

function MigrationPanel({
  preview,
  onPreview,
  onCommit,
  onExportBackup,
}: {
  preview: MigrationPreview | null;
  onPreview: () => void;
  onCommit: () => void;
  onExportBackup: () => void;
}) {
  return (
    <div className="inspector-stack">
      <button className="wide-action" type="button" onClick={onPreview}>
        <Import size={15} />
        预览 CSV/XML/模板
      </button>
      <button className="wide-action" type="button" onClick={onExportBackup}>
        <Download size={15} />
        导出项目备份
      </button>
      {preview ? (
        <article className="migration-card">
          <strong>{preview.kind.toUpperCase()} / {preview.rowCount} rows</strong>
          <span title={preview.sourcePath}>{preview.sourcePath}</span>
          <p>字段：{preview.detectedFields.slice(0, 8).join(", ") || "未识别"}</p>
          <p>映射：{Object.entries(preview.mapping).map(([key, value]) => `${key}=${value}`).join(", ") || "无"}</p>
          {preview.warnings.map((warning) => <small key={warning}>{warning}</small>)}
          <button type="button" disabled={preview.kind === "unknown"} onClick={onCommit}>确认导入</button>
        </article>
      ) : (
        <span className="subtle">迁移向导会先展示字段与映射，确认后才写入项目。</span>
      )}
    </div>
  );
}

function M3Placeholder({ title, icon }: { title: string; icon: ReactNode }) {
  return (
    <div className="m3-placeholder">
      {icon}
      <strong>{title}</strong>
      <span>M3 将接入创建、排序、备注、绘图关联和导出。</span>
    </div>
  );
}

function StartOverlay({
  project,
  projectName,
  setProjectName,
  recentProjects,
  loading,
  onCreate,
  onOpen,
  onOpenRecent,
  onImport,
}: {
  project: unknown;
  projectName: string;
  setProjectName: (value: string) => void;
  recentProjects: RecentProject[];
  loading: boolean;
  onCreate: () => void;
  onOpen: () => void;
  onOpenRecent: (path: string) => void;
  onImport: () => void;
}) {
  return (
    <div className="start-overlay">
      <div className="start-panel">
        <div>
          <span className="small-caps">Windows 本地足球分析工作站</span>
          <h1>{project ? "导入视频开始 Coding" : "创建 ScoutCode 项目"}</h1>
        </div>
        {!project ? (
          <>
            <label className="start-input">
              项目名称
              <input value={projectName} onChange={(event) => setProjectName(event.target.value)} />
            </label>
            <div className="start-actions">
              <button type="button" disabled={loading} onClick={onCreate}>
                新建项目
              </button>
              <button type="button" disabled={loading} onClick={onOpen}>
                打开项目
              </button>
            </div>
            <div className="recent-list">
              {recentProjects.map((item) => (
                <button type="button" key={item.path} onClick={() => onOpenRecent(item.path)}>
                  <strong>{item.name}</strong>
                  <span>{item.path}</span>
                </button>
              ))}
            </div>
          </>
        ) : (
          <div className="start-actions">
            <button type="button" disabled={loading} onClick={onImport}>
              导入视频
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function eventLeft(event: MatchEvent, durationMs: number): number {
  if (durationMs <= 0) {
    return 0;
  }

  return Math.min(98, Math.max(0, (event.startMs / durationMs) * 100));
}

function eventWidth(event: MatchEvent, durationMs: number): number {
  if (durationMs <= 0) {
    return 1.2;
  }

  return Math.max(0.8, Math.min(10, ((event.endMs - event.startMs) / durationMs) * 100));
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function parseSecondsAsMs(value: string): number | null {
  if (value.trim() === "") {
    return null;
  }

  const seconds = Number(value);
  if (!Number.isFinite(seconds)) {
    return null;
  }

  return clampTimeMs(seconds * 1000);
}

function secondsLabel(ms: number): string {
  const seconds = clampTimeMs(ms) / 1000;
  return Number.isInteger(seconds) ? String(seconds) : seconds.toFixed(1);
}

function createLayerFromClick(tool: DrawingTool, x: number, y: number): DrawingLayer {
  const id = crypto.randomUUID();
  if (tool === "arrow") {
    return {
      id,
      type: "arrow",
      points: [
        { x: clamp01(x - 0.08), y: clamp01(y + 0.04) },
        { x, y },
      ],
      color: "#facc15",
      width: 0.006,
    };
  }

  if (tool === "line") {
    return {
      id,
      type: "line",
      points: [
        { x: clamp01(x - 0.06), y },
        { x: clamp01(x + 0.06), y },
      ],
      color: "#22e0cd",
      width: 0.004,
    };
  }

  if (tool === "label") {
    return {
      id,
      type: "label",
      x,
      y,
      text: "重点",
      color: "#22e0cd",
    };
  }

  return {
    id,
    type: "zone",
    x: clamp01(x - 0.08),
    y: clamp01(y - 0.05),
    width: 0.16,
    height: 0.1,
    color: "#16c7b7",
  };
}

function DrawingLayerView({
  layer,
  selected = false,
  onSelect,
}: {
  layer: DrawingLayer;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const className = `drawing-layer ${selected ? "selected" : ""}`;
  const handleClick = (event: MouseEvent<SVGGElement | SVGRectElement | SVGLineElement>) => {
    event.stopPropagation();
    onSelect?.();
  };

  if (layer.type === "zone") {
    return (
      <rect
        className={className}
        x={layer.x}
        y={layer.y}
        width={layer.width}
        height={layer.height}
        fill={layer.color}
        fillOpacity="0.16"
        stroke={layer.color}
        strokeWidth={selected ? "0.007" : "0.004"}
        onClick={handleClick}
      />
    );
  }

  if (layer.type === "label") {
    return (
      <g className={className} onClick={handleClick}>
        <circle
          cx={layer.x}
          cy={layer.y}
          r={selected ? "0.032" : "0.026"}
          fill="rgba(0,0,0,0.72)"
          stroke={layer.color}
          strokeWidth={selected ? "0.007" : "0.004"}
        />
        <text x={layer.x} y={layer.y + 0.006} fill={layer.color} fontSize="0.025" textAnchor="middle">
          {layer.text}
        </text>
      </g>
    );
  }

  const [start, end] = layer.points;
  return (
    <g className={className} onClick={handleClick}>
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke="transparent"
        strokeWidth="0.025"
        strokeLinecap="round"
      />
      <line
        x1={start.x}
        y1={start.y}
        x2={end.x}
        y2={end.y}
        stroke={layer.color}
        strokeWidth={selected ? layer.width + 0.003 : layer.width}
        strokeLinecap="round"
        strokeDasharray={layer.type === "line" && layer.dashed ? "0.02 0.01" : undefined}
      />
    </g>
  );
}
