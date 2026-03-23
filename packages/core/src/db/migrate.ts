import { resolve } from "node:path"
import { existsSync } from "node:fs"
import Database from "better-sqlite3"

const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS timelines (
  municipality_code TEXT PRIMARY KEY,
  municipality_name TEXT NOT NULL,
  prefecture TEXT NOT NULL,
  region TEXT NOT NULL,
  persona_count INTEGER NOT NULL DEFAULT 100,
  status TEXT NOT NULL CHECK(status IN ('active', 'paused', 'initializing')),
  added_at INTEGER NOT NULL,
  last_activity_at INTEGER
);

CREATE TABLE IF NOT EXISTS demographics (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  municipality_code TEXT NOT NULL,
  municipality_name TEXT NOT NULL,
  prefecture TEXT NOT NULL,
  age_group TEXT NOT NULL,
  sex TEXT NOT NULL CHECK(sex IN ('male', 'female')),
  population INTEGER NOT NULL,
  year INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sns_activity_weights (
  age_group TEXT PRIMARY KEY,
  platform TEXT NOT NULL,
  usage_rate REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS nemotron_cache (
  uuid TEXT PRIMARY KEY,
  professional_persona TEXT,
  sports_persona TEXT,
  arts_persona TEXT,
  travel_persona TEXT,
  culinary_persona TEXT,
  persona TEXT,
  cultural_background TEXT,
  skills_list TEXT,
  hobbies_list TEXT,
  career_goals TEXT,
  sex TEXT,
  age INTEGER,
  marital_status TEXT,
  education_level TEXT,
  occupation TEXT,
  region TEXT,
  area TEXT,
  prefecture TEXT,
  cached_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS sim_personas (
  id TEXT PRIMARY KEY,
  nemotron_uuid TEXT,
  municipality_code TEXT NOT NULL,
  municipality_name TEXT NOT NULL,
  name TEXT NOT NULL,
  sex TEXT NOT NULL,
  age INTEGER NOT NULL,
  marital_status TEXT,
  education_level TEXT,
  occupation TEXT,
  prefecture TEXT,
  region TEXT,
  persona TEXT,
  professional_persona TEXT,
  cultural_background TEXT,
  skills_list TEXT,
  hobbies_list TEXT,
  sns_activity_level TEXT CHECK(sns_activity_level IN ('high', 'medium', 'low', 'inactive')),
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  persona_id TEXT NOT NULL,
  municipality_code TEXT NOT NULL,
  content TEXT NOT NULL,
  parent_post_id TEXT,
  news_id TEXT,
  created_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS news (
  id TEXT PRIMARY KEY,
  municipality_code TEXT,
  title TEXT NOT NULL,
  url TEXT NOT NULL UNIQUE,
  source TEXT,
  published_at INTEGER,
  fetched_at INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS error_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  phase TEXT,
  municipality_code TEXT,
  message TEXT NOT NULL,
  created_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_nemotron_pref_sex_age ON nemotron_cache(prefecture, sex, age);
CREATE INDEX IF NOT EXISTS idx_nemotron_region_sex ON nemotron_cache(region, sex);
CREATE INDEX IF NOT EXISTS idx_personas_municipality ON sim_personas(municipality_code);
CREATE INDEX IF NOT EXISTS idx_posts_municipality_created ON posts(municipality_code, created_at);
CREATE INDEX IF NOT EXISTS idx_posts_parent ON posts(parent_post_id);
`

export function runMigrations(dbPath?: string): void {
  let finalPath = dbPath

  if (!finalPath) {
    if (process.env.DATABASE_PATH) {
      finalPath = process.env.DATABASE_PATH
    } else {
      let dir = process.cwd()
      for (let i = 0; i < 10; i++) {
        if (existsSync(resolve(dir, "pnpm-workspace.yaml"))) {
          finalPath = resolve(dir, "local-sns.db")
          break
        }
        const parent = resolve(dir, "..")
        if (parent === dir) break
        dir = parent
      }
      if (!finalPath) finalPath = resolve(process.cwd(), "local-sns.db")
    }
  }

  const sqlite = new Database(finalPath)
  sqlite.pragma("journal_mode = WAL")
  sqlite.exec(CREATE_TABLES_SQL)
  sqlite.close()
}
