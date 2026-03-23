import Link from "next/link"
import { eq, sql } from "drizzle-orm"
import { getServerDb } from "@/lib/db"
import { timelines, simPersonas } from "@local-sns/core/web"
import {
  AgeDistributionChart,
  SexDistributionChart,
  ActivityDistributionChart,
} from "@/components/persona-charts"

interface Props {
  params: Promise<{ municipalityCode: string }>
}

const activityColors: Record<string, string> = {
  high: "bg-green-100 text-green-800",
  medium: "bg-blue-100 text-blue-800",
  low: "bg-yellow-100 text-yellow-800",
  inactive: "bg-gray-100 text-gray-800",
}

export default async function PersonasPage({ params }: Props) {
  const { municipalityCode } = await params
  const db = getServerDb()

  const timeline = await db
    .select()
    .from(timelines)
    .where(eq(timelines.municipalityCode, municipalityCode))
    .limit(1)

  if (timeline.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">タイムラインが見つかりません</p>
      </div>
    )
  }

  const tl = timeline[0]

  const personas = await db
    .select()
    .from(simPersonas)
    .where(eq(simPersonas.municipalityCode, municipalityCode))

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

  const sexDistribution = await db
    .select({
      sex: simPersonas.sex,
      count: sql<number>`COUNT(*)`,
    })
    .from(simPersonas)
    .where(eq(simPersonas.municipalityCode, municipalityCode))
    .groupBy(simPersonas.sex)

  const activityDistribution = await db
    .select({
      level: simPersonas.snsActivityLevel,
      count: sql<number>`COUNT(*)`,
    })
    .from(simPersonas)
    .where(eq(simPersonas.municipalityCode, municipalityCode))
    .groupBy(simPersonas.snsActivityLevel)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <div className="flex items-center gap-4">
            <Link
              href={`/${municipalityCode}`}
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              &larr; タイムラインへ
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {tl.prefecture}{tl.municipalityName} - ペルソナ一覧
              </h1>
              <p className="text-sm text-gray-500">{personas.length}人</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Charts */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <AgeDistributionChart data={ageDistribution} />
          <SexDistributionChart data={sexDistribution} />
          <ActivityDistributionChart data={activityDistribution} />
        </div>

        {/* Persona Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {personas.map((p) => (
            <div
              key={p.id}
              className="bg-white rounded-lg border border-gray-200 p-4"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-medium text-gray-900">{p.name}</h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                    activityColors[p.snsActivityLevel ?? "inactive"]
                  }`}
                >
                  {p.snsActivityLevel}
                </span>
              </div>
              <div className="space-y-1 text-sm text-gray-600">
                <p>
                  {p.age}歳 / {p.sex}
                </p>
                <p>{p.occupation ?? "不明"}</p>
                {p.persona && (
                  <p className="text-xs text-gray-400 line-clamp-2 mt-1">
                    {p.persona}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
