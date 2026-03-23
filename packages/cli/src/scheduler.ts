import cron from "node-cron"
import { eq } from "drizzle-orm"
import { runMigrations, getDb, timelines } from "@local-sns/core"
import { runPipeline } from "../../core/src/pipeline/runner"

let isRunning = false

async function runAll(): Promise<void> {
  if (isRunning) {
    console.log("⏳ 前回の実行がまだ完了していません。スキップします。")
    return
  }

  isRunning = true

  try {
    const db = getDb()
    const activeTimelines = await db
      .select()
      .from(timelines)
      .where(eq(timelines.status, "active"))

    console.log(
      `\n[${new Date().toISOString()}] 🔄 パイプライン実行開始 (${activeTimelines.length}件)`
    )

    for (const tl of activeTimelines) {
      try {
        const result = await runPipeline(tl.municipalityCode)
        console.log(
          `  ${tl.municipalityName}: 投稿${result.postCount} / リプライ${result.replyCount}`
        )
      } catch (error) {
        console.error(
          `  ${tl.municipalityName}: エラー - ${error instanceof Error ? error.message : String(error)}`
        )
      }
    }

    console.log(`[${new Date().toISOString()}] ✅ パイプライン実行完了`)
  } finally {
    isRunning = false
  }
}

function main(): void {
  runMigrations()

  console.log("⏰ スケジューラーを起動しました (30分間隔)")
  console.log("   Ctrl+C で停止")

  // 30分ごとに実行
  cron.schedule("*/30 * * * *", () => {
    runAll()
  })

  // 起動時に一度実行
  runAll()
}

main()
