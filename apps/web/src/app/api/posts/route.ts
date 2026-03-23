import { NextResponse, type NextRequest } from "next/server"
import { eq, lt, desc, and } from "drizzle-orm"
import { getServerDb } from "@/lib/db"
import { posts, simPersonas } from "@local-sns/core/web"

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const municipalityCode = searchParams.get("municipalityCode")
  const limit = parseInt(searchParams.get("limit") ?? "50", 10)
  const before = searchParams.get("before")

  if (!municipalityCode) {
    return NextResponse.json({ error: "municipalityCode is required" }, { status: 400 })
  }

  const db = getServerDb()

  const conditions = [eq(posts.municipalityCode, municipalityCode)]
  if (before) {
    conditions.push(lt(posts.createdAt, parseInt(before, 10)))
  }

  const rows = await db
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
    .where(and(...conditions))
    .orderBy(desc(posts.createdAt))
    .limit(limit)

  return NextResponse.json(rows)
}
