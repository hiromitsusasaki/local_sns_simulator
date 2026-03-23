import { randomUUID } from "node:crypto"
import pLimit from "p-limit"
import pRetry from "p-retry"
import { getDb } from "../db/connection"
import { posts, errorLogs } from "../db/schema"
import type { SimPersona } from "../personas/schema"
import type { LLMProvider, Post, News } from "./provider"

const MAX_CONCURRENT = 3
const MAX_RETRIES = 3

export class PostGenerator {
  private readonly provider: LLMProvider
  private readonly limit: ReturnType<typeof pLimit>

  constructor(provider: LLMProvider) {
    this.provider = provider
    this.limit = pLimit(MAX_CONCURRENT)
  }

  async generatePost(persona: SimPersona, news: News): Promise<Post | null> {
    try {
      const content = await this.limit(() =>
        pRetry(
          () => this.provider.generatePost(persona, news.title, news.url),
          { retries: MAX_RETRIES }
        )
      )

      if (!content) return null

      const post: Post = {
        id: randomUUID(),
        personaId: persona.id,
        municipalityCode: persona.municipalityCode,
        content,
        parentPostId: null,
        newsId: news.id,
        createdAt: Math.floor(Date.now() / 1000),
      }

      return post
    } catch (error) {
      await this.logError("post-generation", persona.municipalityCode, error)
      return null
    }
  }

  async generateReply(
    persona: SimPersona,
    parentPost: Post
  ): Promise<Post | null> {
    try {
      const content = await this.limit(() =>
        pRetry(
          () => this.provider.generateReply(persona, parentPost),
          { retries: MAX_RETRIES }
        )
      )

      if (!content) return null

      const reply: Post = {
        id: randomUUID(),
        personaId: persona.id,
        municipalityCode: persona.municipalityCode,
        content,
        parentPostId: parentPost.id,
        newsId: parentPost.newsId,
        createdAt: Math.floor(Date.now() / 1000),
      }

      return reply
    } catch (error) {
      await this.logError("reply-generation", persona.municipalityCode, error)
      return null
    }
  }

  async save(post: Post): Promise<void> {
    const db = getDb()
    await db.insert(posts).values({
      id: post.id,
      personaId: post.personaId,
      municipalityCode: post.municipalityCode,
      content: post.content,
      parentPostId: post.parentPostId,
      newsId: post.newsId,
      createdAt: post.createdAt,
    })
  }

  async saveBatch(postList: Post[]): Promise<void> {
    const db = getDb()
    if (postList.length === 0) return

    const batchSize = 100
    for (let i = 0; i < postList.length; i += batchSize) {
      const batch = postList.slice(i, i + batchSize)
      await db.insert(posts).values(
        batch.map((p) => ({
          id: p.id,
          personaId: p.personaId,
          municipalityCode: p.municipalityCode,
          content: p.content,
          parentPostId: p.parentPostId,
          newsId: p.newsId,
          createdAt: p.createdAt,
        }))
      )
    }
  }

  private async logError(
    phase: string,
    municipalityCode: string,
    error: unknown
  ): Promise<void> {
    try {
      const db = getDb()
      await db.insert(errorLogs).values({
        phase,
        municipalityCode,
        message: error instanceof Error ? error.message : String(error),
        createdAt: Math.floor(Date.now() / 1000),
      })
    } catch {
      // エラーログ書き込み自体が失敗した場合はコンソールに出力
      console.error(`Failed to log error for ${phase}:`, error)
    }
  }
}
