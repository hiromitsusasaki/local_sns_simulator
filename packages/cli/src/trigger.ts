import { eq } from "drizzle-orm"
import { runMigrations, getDb, timelines } from "@local-sns/core"
import { runPipeline } from "../../core/src/pipeline/runner"

function parseArgs(): { municipality?: string; all: boolean } {
  const args = process.argv.slice(2)
  let municipality: string | undefined
  let all = false

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--municipality" && args[i + 1]) {
      municipality = args[i + 1]
      i++
    }
    if (args[i] === "--all") {
      all = true
    }
  }

  if (!municipality && !all) {
    console.error("Usage: tsx trigger.ts --municipality <code> | --all")
    process.exit(1)
  }

  return { municipality, all }
}

async function main(): Promise<void> {
  const { municipality, all } = parseArgs()

  runMigrations()

  const db = getDb()

  if (all) {
    console.log("🚀 全アクティブタイムラインのパイプラインを実行中...")

    const activeTimelines = await db
      .select()
      .from(timelines)
      .where(eq(timelines.status, "active"))

    for (const tl of activeTimelines) {
      console.log(`\n📰 ${tl.prefecture}${tl.municipalityName} (${tl.municipalityCode})`)
      try {
        const result = await runPipeline(tl.municipalityCode)
        console.log(
          `  ✓ ニュース: ${result.newsCount}件 / 投稿: ${result.postCount}件 / リプライ: ${result.replyCount}件`
        )
      } catch (error) {
        console.error(`  ✗ エラー: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  } else if (municipality) {
    console.log(`🚀 パイプラインを実行中: ${municipality}`)
    const result = await runPipeline(municipality)
    console.log(
      `✓ ニュース: ${result.newsCount}件 / 投稿: ${result.postCount}件 / リプライ: ${result.replyCount}件`
    )
  }

  console.log("\n✅ パイプライン実行完了")
}

main().catch((error) => {
  console.error("❌ パイプライン実行に失敗:", error)
  process.exit(1)
})
