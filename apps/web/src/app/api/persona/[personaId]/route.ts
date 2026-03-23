import { NextResponse } from "next/server"
import { eq } from "drizzle-orm"
import { getServerDb } from "@/lib/db"
import { simPersonas } from "@local-sns/core/web"

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ personaId: string }> }
) {
  const { personaId } = await params
  const db = getServerDb()

  const rows = await db
    .select()
    .from(simPersonas)
    .where(eq(simPersonas.id, personaId))
    .limit(1)

  if (rows.length === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  return NextResponse.json(rows[0])
}
