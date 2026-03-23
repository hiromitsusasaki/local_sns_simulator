import { type NextRequest } from "next/server"
import { eq, gt, desc, and } from "drizzle-orm"
import { getServerDb } from "@/lib/db"
import { posts, simPersonas } from "@local-sns/core/web"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const municipalityCode = searchParams.get("municipalityCode")

  if (!municipalityCode) {
    return new Response("municipalityCode is required", { status: 400 })
  }

  let lastChecked = Math.floor(Date.now() / 1000)

  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()

      const sendEvent = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
      }

      const interval = setInterval(async () => {
        try {
          const db = getServerDb()
          const newPosts = await db
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
            .where(
              and(
                eq(posts.municipalityCode, municipalityCode),
                gt(posts.createdAt, lastChecked)
              )
            )
            .orderBy(desc(posts.createdAt))

          if (newPosts.length > 0) {
            lastChecked = Math.floor(Date.now() / 1000)
            sendEvent({ type: "new_posts", posts: newPosts })
          }
        } catch {
          // Ignore errors during polling
        }
      }, 2000)

      request.signal.addEventListener("abort", () => {
        clearInterval(interval)
        controller.close()
      })
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}
