import type { SimPersona } from "../personas/schema"

export interface Post {
  id: string
  personaId: string
  municipalityCode: string
  content: string
  parentPostId: string | null
  newsId: string | null
  createdAt: number
}

export interface News {
  id: string
  municipalityCode: string | null
  title: string
  url: string
  source: string | null
  publishedAt: number | null
  fetchedAt: number
}

export interface LLMProvider {
  generatePost(persona: SimPersona, topic: string, topicUrl?: string): Promise<string>
  generateReply(persona: SimPersona, originalPost: Post): Promise<string>
}
