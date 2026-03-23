import { runMigrations } from "@local-sns/core"
import { PersonaGenerator } from "../../core/src/personas/generator"
import type { SnsActivityLevel } from "../../core/src/personas/schema"

function parseArgs(): { municipality: string; count: number } {
  const args = process.argv.slice(2)
  let municipality = ""
  let count = 100

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--municipality" && args[i + 1]) {
      municipality = args[i + 1]
      i++
    }
    if (args[i] === "--count" && args[i + 1]) {
      count = parseInt(args[i + 1], 10)
      i++
    }
  }

  if (!municipality) {
    console.error("Usage: tsx generate-personas.ts --municipality <code> [--count <n>]")
    process.exit(1)
  }

  return { municipality, count }
}

async function main(): Promise<void> {
  const { municipality, count } = parseArgs()

  runMigrations()

  console.log(`👤 ペルソナ生成開始: ${municipality} (${count}人)`)

  const generator = new PersonaGenerator()

  const personas = await generator.generate(
    municipality,
    count,
    (current, total) => {
      if (current % 10 === 0 || current === total) {
        process.stdout.write(`\r  進捗: ${current}/${total}`)
      }
    }
  )

  console.log("")

  // SNS利用者数
  const snsActive = personas.filter((p) => p.snsActivityLevel !== "inactive").length
  console.log(`✓ SNS利用率フィルタ適用後: ${count}人中 ${snsActive}人がSNS利用者`)

  console.log(`✓ Nemotronマッチング完了: ${personas.length}/${count}件`)

  // DBに保存
  await generator.save(personas)
  console.log("✓ DBに保存完了")

  // 年齢分布
  const ageDist = new Map<string, number>()
  for (const p of personas) {
    const decade = `${Math.floor(p.age / 10) * 10}代`
    ageDist.set(decade, (ageDist.get(decade) ?? 0) + 1)
  }
  const ageDistStr = [...ageDist.entries()]
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .map(([k, v]) => `${k}${v}人`)
    .join(" / ")
  console.log(`  年齢分布: ${ageDistStr}`)

  // activity分布
  const actDist: Record<SnsActivityLevel, number> = { high: 0, medium: 0, low: 0, inactive: 0 }
  for (const p of personas) {
    actDist[p.snsActivityLevel]++
  }
  console.log(
    `  activity: high ${actDist.high}人 / medium ${actDist.medium}人 / low ${actDist.low}人 / inactive ${actDist.inactive}人`
  )
}

main().catch((error) => {
  console.error("❌ ペルソナ生成に失敗:", error)
  process.exit(1)
})
