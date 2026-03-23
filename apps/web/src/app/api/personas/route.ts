import { NextResponse, type NextRequest } from "next/server"
import { eq, sql } from "drizzle-orm"
import { getServerDb } from "@/lib/db"
import { simPersonas } from "@local-sns/core/web"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const municipalityCode = searchParams.get("municipalityCode")

  if (!municipalityCode) {
    return NextResponse.json({ error: "municipalityCode is required" }, { status: 400 })
  }

  const db = getServerDb()

  const personas = await db
    .select()
    .from(simPersonas)
    .where(eq(simPersonas.municipalityCode, municipalityCode))

  // 年齢分布
  const ageDistribution = await db
    .select({
      ageGroup: sql<string>`CASE
        WHEN ${simPersonas.age} < 20 THEN '10代'
        WHEN ${simPersonas.age} < 30 THEN '20代'
        WHEN ${simPersonas.age} < 40 THEN '30代'
        WHEN ${simPersonas.age} < 50 THEN '40代'
        WHEN ${simPersonas.age} < 60 THEN '50代'
        WHEN ${simPersonas.age} < 70 THEN '60代'
        WHEN ${simPersonas.age} < 80 THEN '70代'
        ELSE '80代以上'
      END`,
      count: sql<number>`COUNT(*)`,
    })
    .from(simPersonas)
    .where(eq(simPersonas.municipalityCode, municipalityCode))
    .groupBy(sql`1`)

  // 性別比
  const sexDistribution = await db
    .select({
      sex: simPersonas.sex,
      count: sql<number>`COUNT(*)`,
    })
    .from(simPersonas)
    .where(eq(simPersonas.municipalityCode, municipalityCode))
    .groupBy(simPersonas.sex)

  // SNS活動レベル
  const activityDistribution = await db
    .select({
      level: simPersonas.snsActivityLevel,
      count: sql<number>`COUNT(*)`,
    })
    .from(simPersonas)
    .where(eq(simPersonas.municipalityCode, municipalityCode))
    .groupBy(simPersonas.snsActivityLevel)

  return NextResponse.json({
    personas,
    stats: {
      ageDistribution,
      sexDistribution,
      activityDistribution,
    },
  })
}
