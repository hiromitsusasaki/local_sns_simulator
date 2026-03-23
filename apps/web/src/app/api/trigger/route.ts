import { NextResponse } from "next/server"
import { z } from "zod"
import { runPipeline } from "@local-sns/core/web"

const TriggerSchema = z.object({
  municipalityCode: z.string().min(1),
})

export async function POST(request: Request) {
  const body = await request.json()
  const parsed = TriggerSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    )
  }

  try {
    const result = await runPipeline(parsed.data.municipalityCode)
    return NextResponse.json(result)
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Pipeline failed" },
      { status: 500 }
    )
  }
}
