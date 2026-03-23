import { resolve } from "node:path"
import { existsSync } from "node:fs"
import Database from "better-sqlite3"
import { drizzle } from "drizzle-orm/better-sqlite3"
import * as schema from "./schema"

let db: ReturnType<typeof createDb> | null = null

function resolveDbPath(): string {
  // 1. 環境変数で明示指定
  if (process.env.DATABASE_PATH) {
    return process.env.DATABASE_PATH
  }

  // 2. cwdから上方探索してpnpm-workspace.yamlのあるディレクトリを探す
  let dir = process.cwd()
  for (let i = 0; i < 10; i++) {
    if (existsSync(resolve(dir, "pnpm-workspace.yaml"))) {
      return resolve(dir, "local-sns.db")
    }
    const parent = resolve(dir, "..")
    if (parent === dir) break
    dir = parent
  }

  // 3. フォールバック
  return resolve(process.cwd(), "local-sns.db")
}

function createDb(dbPath?: string) {
  const finalPath = dbPath ?? resolveDbPath()
  const sqlite = new Database(finalPath)
  sqlite.pragma("journal_mode = WAL")
  sqlite.pragma("foreign_keys = ON")
  return drizzle(sqlite, { schema })
}

export function getDb(dbPath?: string) {
  if (!db) {
    db = createDb(dbPath)
  }
  return db
}

export type Db = ReturnType<typeof getDb>
