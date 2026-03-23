import Link from "next/link"
import { eq, desc } from "drizzle-orm"
import { getServerDb } from "@/lib/db"
import { timelines, posts, simPersonas } from "@local-sns/core/web"
import { PostFeed } from "@/components/post-feed"

interface Props {
  params: Promise<{ municipalityCode: string }>
}

export default async function TimelinePage({ params }: Props) {
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

  const initialPosts = await db
    .select({
      id: posts.id,
      personaId: posts.personaId,
      municipalityCode: posts.municipalityCode,
      content: posts.content,
      parentPostId: posts.parentPostId,
      newsId: posts.newsId,
      createdAt: posts.createdAt,
      personaName: simPersonas.name,
      personaAge: simPersonas.age,
      personaSex: simPersonas.sex,
      personaOccupation: simPersonas.occupation,
      personaSnsLevel: simPersonas.snsActivityLevel,
    })
    .from(posts)
    .leftJoin(simPersonas, eq(posts.personaId, simPersonas.id))
    .where(eq(posts.municipalityCode, municipalityCode))
    .orderBy(desc(posts.createdAt))
    .limit(50)

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-3xl mx-auto">
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              &larr; 戻る
            </Link>
            <div>
              <h1 className="text-xl font-bold text-gray-900">
                {tl.prefecture}{tl.municipalityName}
              </h1>
              <p className="text-sm text-gray-500">
                {tl.region} / ペルソナ{tl.personaCount}人
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-8">
        <PostFeed
          municipalityCode={municipalityCode}
          initialPosts={initialPosts}
        />
      </main>
    </div>
  )
}
