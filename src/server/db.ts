import Database from 'better-sqlite3';
import path from 'path';
import os from 'os';
import fs from 'fs';

const DATA_DIR = path.join(os.homedir(), '.claude-watch');
const DB_PATH = path.join(DATA_DIR, 'claude-watch.db');

let db: Database.Database;

export function getDb(): Database.Database {
  if (db) return db;

  fs.mkdirSync(DATA_DIR, { recursive: true });

  db = new Database(DB_PATH);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  initSchema(db);
  return db;
}

function initSchema(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      last_active_at TEXT
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      started_at TEXT NOT NULL DEFAULT (datetime('now')),
      ended_at TEXT,
      status TEXT NOT NULL DEFAULT 'active',
      summary TEXT
    );

    CREATE TABLE IF NOT EXISTS events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      session_id TEXT NOT NULL REFERENCES sessions(id),
      project_id TEXT NOT NULL REFERENCES projects(id),
      timestamp TEXT NOT NULL DEFAULT (datetime('now')),
      type TEXT NOT NULL,
      tool_name TEXT,
      input_data TEXT,
      output_data TEXT,
      file_path TEXT,
      diff TEXT,
      duration_ms INTEGER
    );

    CREATE TABLE IF NOT EXISTS snapshots (
      id TEXT PRIMARY KEY,
      project_id TEXT NOT NULL REFERENCES projects(id),
      session_id TEXT REFERENCES sessions(id),
      name TEXT NOT NULL,
      description TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      git_ref TEXT,
      file_count INTEGER DEFAULT 0,
      metadata TEXT
    );

    CREATE INDEX IF NOT EXISTS idx_events_session ON events(session_id);
    CREATE INDEX IF NOT EXISTS idx_events_project ON events(project_id);
    CREATE INDEX IF NOT EXISTS idx_events_timestamp ON events(timestamp);
    CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id);
    CREATE INDEX IF NOT EXISTS idx_snapshots_project ON snapshots(project_id);
  `);
}

export function getDataDir(): string {
  return DATA_DIR;
}
