import { NextResponse } from "next/server"
import { z } from "zod"
import { eq, sql } from "drizzle-orm"
import { getServerDb } from "@/lib/db"
import { timelines, posts } from "@local-sns/core/web"

export async function GET() {
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

  return NextResponse.json(rows)
}

const CreateTimelineSchema = z.object({
  municipalityCode: z.string().min(1),
  municipalityName: z.string().min(1),
  prefecture: z.string().min(1),
  region: z.string().min(1),
  personaCount: z.number().int().min(1).max(500).default(100),
})

export async function POST(request: Request) {
  const body = await request.json()
  const parsed = CreateTimelineSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const db = getServerDb()
  const now = Math.floor(Date.now() / 1000)

  await db.insert(timelines).values({
    municipalityCode: parsed.data.municipalityCode,
    municipalityName: parsed.data.municipalityName,
    prefecture: parsed.data.prefecture,
    region: parsed.data.region,
    personaCount: parsed.data.personaCount,
    status: "initializing",
    addedAt: now,
  }).onConflictDoNothing()

  return NextResponse.json({ success: true, municipalityCode: parsed.data.municipalityCode })
}
