import { eq, and, inArray, desc } from "drizzle-orm"
import { getDb } from "../db/connection"
import { timelines, simPersonas, posts, errorLogs } from "../db/schema"
import { RssClient } from "../collectors/rss-client"
import { LLMProviderFactory } from "../llm/factory"
import { PostGenerator } from "../llm/post-generator"
import type { SimPersona, SnsActivityLevel } from "../personas/schema"
import type { Post, News } from "../llm/provider"

interface PipelineResult {
  municipalityCode: string
  newsCount: number
  postCount: number
  replyCount: number
}

export async function runPipeline(
  municipalityCode: string
): Promise<PipelineResult> {
  const db = getDb()
  const rssClient = new RssClient()
  const provider = LLMProviderFactory.create()
  const postGenerator = new PostGenerator(provider)
  const now = Math.floor(Date.now() / 1000)

  const result: PipelineResult = {
    municipalityCode,
    newsCount: 0,
    postCount: 0,
    replyCount: 0,
  }

  // 1. タイムライン情報を取得
  const timeline = await db
    .select()
    .from(timelines)
    .where(eq(timelines.municipalityCode, municipalityCode))
    .limit(1)

  if (timeline.length === 0) {
    throw new Error(`Timeline not found: ${municipalityCode}`)
  }

  const timelineInfo = timeline[0]

  // 2. RSSからニュースを取得（都道府県名も渡して地域性を高める）
  let newsItems: News[] = []
  try {
    newsItems = await rssClient.fetchNews(
      municipalityCode,
      timelineInfo.municipalityName,
      5,
      timelineInfo.prefecture
    )
    result.newsCount = newsItems.length
  } catch (error) {
    await logError(db, "pipeline-rss", municipalityCode, error)
  }

  if (newsItems.length === 0) return result

  // 3. 同一タイムラインで既に投稿済みのニュースを除外
  const existingPosts = await db
    .select({ newsId: posts.newsId })
    .from(posts)
    .where(eq(posts.municipalityCode, municipalityCode))

  const usedNewsIds = new Set(existingPosts.map((p) => p.newsId).filter(Boolean))
  const freshNews = newsItems.filter((n) => !usedNewsIds.has(n.id))

  if (freshNews.length === 0) return result

  // 4. ペルソナをサンプリング（snsActivityLevel: high/medium/lowのみ）
  const activePersonas = await db
    .select()
    .from(simPersonas)
    .where(
      and(
        eq(simPersonas.municipalityCode, municipalityCode),
        inArray(simPersonas.snsActivityLevel, ["high", "medium", "low"])
      )
    )

  if (activePersonas.length === 0) return result

  // 重み付きサンプリング（high:3, medium:2, low:1で5-15人）
  const sampleCount = 5 + Math.floor(Math.random() * 11)
  const sampled = weightedSample(activePersonas, sampleCount)

  // 5. 各ペルソナに異なるニュースをラウンドロビンで割り当てて投稿生成
  const allPosts: Post[] = []

  for (let i = 0; i < sampled.length; i++) {
    const personaRow = sampled[i]
    const persona = rowToSimPersona(personaRow)
    const newsForPersona = freshNews[i % freshNews.length]

    try {
      const post = await postGenerator.generatePost(persona, newsForPersona)
      if (post) {
        allPosts.push(post)
        result.postCount++
      }
    } catch (error) {
      await logError(db, "pipeline-post", municipalityCode, error)
    }
  }

  // 6. 各投稿に対して30%の確率でリプライ生成（最大2件/投稿）
  for (const post of [...allPosts]) {
    let replyCount = 0
    const maxReplies = 2

    for (const personaRow of activePersonas) {
      if (replyCount >= maxReplies) break
      if (Math.random() > 0.3) continue
      if (personaRow.id === post.personaId) continue

      const replyPersona = rowToSimPersona(personaRow)

      try {
        const reply = await postGenerator.generateReply(replyPersona, post)
        if (reply) {
          allPosts.push(reply)
          result.replyCount++
          replyCount++
        }
      } catch (error) {
        await logError(db, "pipeline-reply", municipalityCode, error)
      }
    }
  }

  // 7. 全投稿をDBに保存
  try {
    await postGenerator.saveBatch(allPosts)
  } catch (error) {
    await logError(db, "pipeline-save", municipalityCode, error)
  }

  // 8. timelinesのlastActivityAtを更新
  await db
    .update(timelines)
    .set({ lastActivityAt: now })
    .where(eq(timelines.municipalityCode, municipalityCode))

  return result
}

function weightedSample(
  personas: (typeof simPersonas.$inferSelect)[],
  count: number
): (typeof simPersonas.$inferSelect)[] {
  const weights: Record<string, number> = {
    high: 3,
    medium: 2,
    low: 1,
  }

  const weighted = personas.map((p) => ({
    persona: p,
    weight: weights[p.snsActivityLevel ?? "low"] ?? 1,
  }))

  const totalWeight = weighted.reduce((sum, w) => sum + w.weight, 0)
  const selected: (typeof simPersonas.$inferSelect)[] = []
  const usedIds = new Set<string>()

  for (let i = 0; i < Math.min(count, personas.length); i++) {
    let rand = Math.random() * totalWeight
    for (const item of weighted) {
      if (usedIds.has(item.persona.id)) continue
      rand -= item.weight
      if (rand <= 0) {
        selected.push(item.persona)
        usedIds.add(item.persona.id)
        break
      }
    }
  }

  return selected
}

function rowToSimPersona(row: typeof simPersonas.$inferSelect): SimPersona {
  return {
    id: row.id,
    nemotronUuid: row.nemotronUuid ?? "",
    municipalityCode: row.municipalityCode,
    municipalityName: row.municipalityName,
    name: row.name,
    sex: (row.sex as "男" | "女") ?? "男",
    age: row.age,
    maritalStatus: row.maritalStatus ?? "",
    educationLevel: row.educationLevel ?? "",
    occupation: row.occupation ?? "",
    prefecture: row.prefecture ?? "",
    region: row.region ?? "",
    persona: row.persona ?? "",
    professionalPersona: row.professionalPersona ?? "",
    culturalBackground: row.culturalBackground ?? "",
    skillsList: parseJsonArray(row.skillsList),
    hobbiesList: parseJsonArray(row.hobbiesList),
    snsActivityLevel: (row.snsActivityLevel as SnsActivityLevel) ?? "low",
    createdAt: row.createdAt,
  }
}

function parseJsonArray(value: string | null): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

async function logError(
  db: ReturnType<typeof getDb>,
  phase: string,
  municipalityCode: string,
  error: unknown
): Promise<void> {
  try {
    await db.insert(errorLogs).values({
      phase,
      municipalityCode,
      message: error instanceof Error ? error.message : String(error),
      createdAt: Math.floor(Date.now() / 1000),
    })
  } catch {
    console.error(`[${phase}] Error:`, error)
  }
}
