import OpenAI from "openai"
import type { SimPersona } from "../personas/schema"
import type { LLMProvider, Post } from "./provider"
import { buildSystemPrompt, buildPostPrompt, buildReplyPrompt } from "./prompt-templates"
import { requireLlmApiKey } from "../config/env"

export class GlmProvider implements LLMProvider {
  private readonly client: OpenAI

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey ?? requireLlmApiKey(),
      baseURL: "https://open.bigmodel.cn/api/paas/v4",
    })
  }

  async generatePost(persona: SimPersona, topic: string, topicUrl?: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: "glm-4-flash",
      max_tokens: 256,
      messages: [
        { role: "system", content: buildSystemPrompt(persona) },
        { role: "user", content: buildPostPrompt(topic, topicUrl) },
      ],
    })

    return response.choices[0]?.message?.content?.trim() ?? ""
  }

  async generateReply(persona: SimPersona, originalPost: Post): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: "glm-4-flash",
      max_tokens: 256,
      messages: [
        { role: "system", content: buildSystemPrompt(persona) },
        { role: "user", content: buildReplyPrompt(originalPost) },
      ],
    })

    return response.choices[0]?.message?.content?.trim() ?? ""
  }
}
