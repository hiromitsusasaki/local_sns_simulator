import { getDb } from "@local-sns/core"
import { snsActivityWeights } from "@local-sns/core"
import { SNS_ACTIVITY_WEIGHTS } from "../../core/src/db/seeds/sns-weights"

async function main() {
  console.log("📊 SNS利用率シードデータを投入中...")

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

  console.log(`✅ ${SNS_ACTIVITY_WEIGHTS.length}件のSNS利用率データを投入しました`)
}

main().catch((error) => {
  console.error("❌ シードデータ投入に失敗:", error)
  process.exit(1)
})
