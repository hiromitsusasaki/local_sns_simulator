import { getDb, runMigrations } from "@local-sns/core/web"

let initialized = false

export function getServerDb() {
  if (!initialized) {
    runMigrations()
    initialized = true
  }
  return getDb()
}
