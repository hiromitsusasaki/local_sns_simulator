import {
  runMigrations,
  getDb,
  timelines,
  snsActivityWeights,
  DEFAULT_MUNICIPALITIES,
  DEFAULT_PERSONA_COUNT,
  EStatClient,
  errorLogs,
} from "@local-sns/core"
import { PersonaGenerator } from "../../core/src/personas/generator"
import type { SnsActivityLevel } from "../../core/src/personas/schema"
import { SNS_ACTIVITY_WEIGHTS } from "../../core/src/db/seeds/sns-weights"
import { eq } from "drizzle-orm"

async function seedSnsWeights(): Promise<void> {
  const db = getDb()
  for (const weight of SNS_ACTIVITY_WEIGHTS) {
    await db
      .insert(snsActivityWeights)
      .values({
        ageGroup: weight.ageGroup,
        platform: weight.platform,
        usageRate: weight.usageRate,
      })
      .onConflictDoUpdate({
        target: snsActivityWeights.ageGroup,
        set: {
          platform: weight.platform,
          usageRate: weight.usageRate,
        },
      })
  }
}

async function setupTimeline(
  municipality: (typeof DEFAULT_MUNICIPALITIES)[number],
  index: number,
  total: number
): Promise<{ personaCount: number; snsActive: number }> {
  const db = getDb()
  const now = Math.floor(Date.now() / 1000)

  console.log(`\n[${index + 1}/${total}] ${municipality.prefecture}${municipality.name} (${municipality.code})`)

  // タイムラインレコード作成
  await db
    .insert(timelines)
    .values({
      municipalityCode: municipality.code,
      municipalityName: municipality.name,
      prefecture: municipality.prefecture,
      region: municipality.region,
      personaCount: DEFAULT_PERSONA_COUNT,
      status: "initializing",
      addedAt: now,
    })
    .onConflictDoUpdate({
      target: timelines.municipalityCode,
      set: { status: "initializing" },
    })

  // e-Stat: 人口統計を取得
  try {
    process.stdout.write("  → e-Stat: 人口統計を取得中... ")
    const estatClient = new EStatClient()
    const records = await estatClient.fetchDemographics(municipality.code)
    await estatClient.saveDemographics(records)
    console.log(`✓ (${records.length}件)`)
  } catch (error) {
    console.log("✗")
    console.error(`    エラー: ${error instanceof Error ? error.message : String(error)}`)
    await db.insert(errorLogs).values({
      phase: "setup-estat",
      municipalityCode: municipality.code,
      message: error instanceof Error ? error.message : String(error),
      createdAt: now,
    })
    // 人口統計がないとペルソナ生成できないのでスキップ
    await db.update(timelines).set({ status: "active" }).where(eq(timelines.municipalityCode, municipality.code))
    return { personaCount: 0, snsActive: 0 }
  }

  // ペルソナ生成（Nemotronキャッシュがあればキャッシュ優先、なければリモート取得）
  let personaCount = 0
  let snsActive = 0
  try {
    process.stdout.write(`  → ペルソナ生成: ${DEFAULT_PERSONA_COUNT}人... `)
    const generator = new PersonaGenerator()

    const personas = await generator.generate(
      municipality.code,
      DEFAULT_PERSONA_COUNT,
      (current, total) => {
        if (current % 20 === 0) {
          process.stdout.write(`${current}/${total} `)
        }
      }
    )

    await generator.save(personas)
    personaCount = personas.length
    snsActive = personas.filter((p) => p.snsActivityLevel !== "inactive").length

    console.log(`✓ (${personaCount}人生成, SNS利用者${snsActive}人)`)

    // 年齢分布を表示
    const ageDist = new Map<string, number>()
    for (const p of personas) {
      const decade = `${Math.floor(p.age / 10) * 10}代`
      ageDist.set(decade, (ageDist.get(decade) ?? 0) + 1)
    }
    const ageDistStr = [...ageDist.entries()]
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([k, v]) => `${k}${v}人`)
      .join(" / ")
    console.log(`  → 年齢分布: ${ageDistStr}`)

    // activity分布
    const actDist: Record<SnsActivityLevel, number> = { high: 0, medium: 0, low: 0, inactive: 0 }
    for (const p of personas) {
      actDist[p.snsActivityLevel]++
    }
    console.log(
      `  → activity: high ${actDist.high} / medium ${actDist.medium} / low ${actDist.low} / inactive ${actDist.inactive}`
    )
  } catch (error) {
    console.log("✗")
    console.error(`    エラー: ${error instanceof Error ? error.message : String(error)}`)
    await db.insert(errorLogs).values({
      phase: "setup-persona",
      municipalityCode: municipality.code,
      message: error instanceof Error ? error.message : String(error),
      createdAt: now,
    })
  }

  // ステータスを active に更新
  await db
    .update(timelines)
    .set({ status: "active" })
    .where(eq(timelines.municipalityCode, municipality.code))

  return { personaCount, snsActive }
}

async function main(): Promise<void> {
  const startTime = Date.now()

  console.log("🏙  タイムラインを初期化中...")

  // 1. DBマイグレーション
  console.log("\n📦 データベースを初期化中...")
  runMigrations()
  console.log("✓ テーブル作成完了")

  // 2. SNS利用率シードデータ
  console.log("\n📊 SNS利用率データを投入中...")
  await seedSnsWeights()
  console.log("✓ SNS利用率データ投入完了")

  // 3. 各市区町村のセットアップ + ペルソナ生成
  const total = DEFAULT_MUNICIPALITIES.length
  let totalPersonas = 0
  let totalSnsActive = 0

  for (let i = 0; i < total; i++) {
    const municipality = DEFAULT_MUNICIPALITIES[i]
    const result = await setupTimeline(municipality, i, total)
    totalPersonas += result.personaCount
    totalSnsActive += result.snsActive
  }

  const elapsed = Math.round((Date.now() - startTime) / 1000)
  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60

  console.log(`\n✅ セットアップ完了 (所要時間: ${minutes}分${seconds}秒)`)
  console.log(`   タイムライン数: ${total} / 総ペルソナ数: ${totalPersonas} / SNS利用者: ${totalSnsActive}`)
}

main().catch((error) => {
  console.error("❌ セットアップに失敗:", error)
  process.exit(1)
})
