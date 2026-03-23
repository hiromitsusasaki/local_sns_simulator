import Link from "next/link"
import { getServerDb } from "@/lib/db"
import { timelines } from "@local-sns/core/web"
import { sql } from "drizzle-orm"
import { AddTimelineDialog } from "@/components/add-timeline-dialog"

interface Timeline {
  municipalityCode: string
  municipalityName: string
  prefecture: string
  region: string
  personaCount: number
  status: string
  addedAt: number
  lastActivityAt: number | null
  recentPostCount: number
}

async function getTimelines(): Promise<Timeline[]> {
  const db = getServerDb()
  const now = Math.floor(Date.now() / 1000)
  const oneDayAgo = now - 86400

  const rows = await db
    .select({
      municipalityCode: timelines.municipalityCode,
      municipalityName: timelines.municipalityName,
      prefecture: timelines.prefecture,
      region: timelines.region,
      personaCount: timelines.personaCount,
      status: timelines.status,
      addedAt: timelines.addedAt,
      lastActivityAt: timelines.lastActivityAt,
      recentPostCount: sql<number>`(
        SELECT COUNT(*) FROM posts
        WHERE posts.municipality_code = timelines.municipality_code
          AND posts.created_at > ${oneDayAgo}
      )`,
    })
    .from(timelines)

  return rows
}

const statusColors: Record<string, string> = {
  active: "bg-green-100 text-green-800",
  paused: "bg-yellow-100 text-yellow-800",
  initializing: "bg-blue-100 text-blue-800",
}

export default async function HomePage() {
  const data = await getTimelines()

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-900">
            地域SNSシミュレータ
          </h1>
          <AddTimelineDialog />
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        {data.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            タイムラインがありません。右上のボタンから追加してください。
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {data.map((tl) => (
              <div
                key={tl.municipalityCode}
                className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                      {tl.prefecture}{tl.municipalityName}
                    </h2>
                    <p className="text-sm text-gray-500">{tl.region}</p>
                  </div>
                  <span
                    className={`px-2 py-1 rounded-full text-xs font-medium ${
                      statusColors[tl.status] ?? "bg-gray-100 text-gray-800"
                    }`}
                  >
                    {tl.status}
                  </span>
                </div>

                <div className="space-y-2 text-sm text-gray-600 mb-4">
                  <p>ペルソナ数: {tl.personaCount}人</p>
                  <p>24h投稿数: {tl.recentPostCount}件</p>
                </div>

                <div className="flex gap-2">
                  <Link
                    href={`/${tl.municipalityCode}`}
                    className="flex-1 text-center px-3 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
                  >
                    タイムライン
                  </Link>
                  <Link
                    href={`/${tl.municipalityCode}/personas`}
                    className="flex-1 text-center px-3 py-2 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200 transition-colors"
                  >
                    ペルソナ
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
