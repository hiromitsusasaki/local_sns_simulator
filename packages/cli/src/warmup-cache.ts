import { runMigrations, NemotronPersonaFetcher } from "@local-sns/core"

function parseArgs(): { prefecture: string; count: number } {
  const args = process.argv.slice(2)
  let prefecture = "東京都"
  let count = 300

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--prefecture" && args[i + 1]) {
      prefecture = args[i + 1]
      i++
    }
    if (args[i] === "--count" && args[i + 1]) {
      count = parseInt(args[i + 1], 10)
      i++
    }
  }

  return { prefecture, count }
}

async function main(): Promise<void> {
  const { prefecture, count } = parseArgs()

  console.log(`🔥 キャッシュウォームアップ: ${prefecture} ${count}件`)

  runMigrations()

  const fetcher = new NemotronPersonaFetcher()
  const usedUuids: string[] = []
  let fetched = 0

  for (let i = 0; i < count; i++) {
    const age = 15 + Math.floor(Math.random() * 70)
    const sex = Math.random() < 0.5 ? "男" : "女"

    const persona = await fetcher.findMatch({
      age,
      sex,
      prefecture,
      excludeUuids: usedUuids,
    })

    if (persona) {
      usedUuids.push(persona.uuid)
      fetched++
    }

    if ((i + 1) % 50 === 0) {
      console.log(`  進捗: ${i + 1}/${count} (取得: ${fetched}件)`)
    }
  }

  console.log(`\n✅ ウォームアップ完了: ${fetched}/${count}件をキャッシュに保存`)
}

main().catch((error) => {
  console.error("❌ ウォームアップに失敗:", error)
  process.exit(1)
})
