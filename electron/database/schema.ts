export const schemaSql = `
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  sport TEXT NOT NULL DEFAULT 'football',
  opponent TEXT,
  match_date TEXT,
  venue TEXT,
  home_team TEXT,
  away_team TEXT,
  score TEXT,
  formation TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS media_assets (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  role TEXT NOT NULL,
  storage_mode TEXT NOT NULL,
  original_path TEXT NOT NULL,
  project_path TEXT,
  display_name TEXT NOT NULL,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  width INTEGER,
  height INTEGER,
  frame_rate REAL,
  codec TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  media_id TEXT NOT NULL,
  start_ms INTEGER NOT NULL,
  end_ms INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  phase TEXT,
  team TEXT,
  player_id TEXT,
  player_name TEXT,
  zone TEXT,
  result TEXT,
  quality TEXT,
  note TEXT,
  tags_json TEXT NOT NULL DEFAULT '[]',
  source TEXT NOT NULL DEFAULT 'manual',
  confidence REAL,
  confirmed INTEGER NOT NULL DEFAULT 1,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS templates (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  sport TEXT NOT NULL DEFAULT 'football',
  version INTEGER NOT NULL,
  template_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS template_buttons (
  id TEXT PRIMARY KEY,
  template_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  label TEXT NOT NULL,
  event_type TEXT NOT NULL,
  phase TEXT,
  hotkey TEXT,
  color TEXT NOT NULL,
  default_duration_ms INTEGER
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value_json TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS playlists (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  purpose TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS playlist_items (
  id TEXT PRIMARY KEY,
  playlist_id TEXT NOT NULL,
  event_id TEXT NOT NULL,
  item_order INTEGER NOT NULL,
  title TEXT,
  note TEXT,
  drawing_id TEXT,
  pre_roll_ms INTEGER NOT NULL DEFAULT 5000,
  post_roll_ms INTEGER NOT NULL DEFAULT 5000
);

CREATE TABLE IF NOT EXISTS players (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  number TEXT,
  position TEXT,
  strengths TEXT,
  improvements TEXT,
  coach_note TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS event_player_links (
  event_id TEXT NOT NULL,
  player_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'primary',
  PRIMARY KEY (event_id, player_id)
);

CREATE TABLE IF NOT EXISTS training_topics (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  phase TEXT,
  priority TEXT NOT NULL,
  evidence_event_ids_json TEXT NOT NULL DEFAULT '[]',
  recommendation TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ai_candidates (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  media_id TEXT NOT NULL,
  start_ms INTEGER NOT NULL,
  end_ms INTEGER NOT NULL,
  event_type TEXT NOT NULL,
  phase TEXT,
  confidence REAL NOT NULL,
  reason TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS drawings (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  event_id TEXT,
  media_id TEXT NOT NULL,
  time_ms INTEGER NOT NULL,
  layers_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS export_jobs (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  type TEXT NOT NULL,
  status TEXT NOT NULL,
  progress INTEGER NOT NULL DEFAULT 0,
  format TEXT,
  duration_ms INTEGER,
  ffmpeg_args_json TEXT,
  metadata_json TEXT,
  output_path TEXT,
  error_message TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_project_time ON events(project_id, start_ms);
CREATE INDEX IF NOT EXISTS idx_events_project_type ON events(project_id, event_type);
CREATE INDEX IF NOT EXISTS idx_events_project_player ON events(project_id, player_id);
CREATE INDEX IF NOT EXISTS idx_media_project_role ON media_assets(project_id, role);
CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist ON playlist_items(playlist_id, item_order);
CREATE INDEX IF NOT EXISTS idx_players_project ON players(project_id, name);
CREATE INDEX IF NOT EXISTS idx_event_player_links_event ON event_player_links(event_id);
CREATE INDEX IF NOT EXISTS idx_training_topics_project ON training_topics(project_id, priority);
CREATE INDEX IF NOT EXISTS idx_ai_candidates_project ON ai_candidates(project_id, status);
CREATE INDEX IF NOT EXISTS idx_drawings_project_event ON drawings(project_id, event_id);
CREATE INDEX IF NOT EXISTS idx_export_jobs_project ON export_jobs(project_id, created_at);
`;
