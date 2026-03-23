import OpenAI from "openai"
import type { SimPersona } from "../personas/schema"
import type { LLMProvider, Post } from "./provider"
import { buildSystemPrompt, buildPostPrompt, buildReplyPrompt } from "./prompt-templates"
import { requireLlmApiKey } from "../config/env"

export class KimiProvider implements LLMProvider {
  private readonly client: OpenAI

  constructor(apiKey?: string) {
    this.client = new OpenAI({
      apiKey: apiKey ?? requireLlmApiKey(),
      baseURL: "https://api.moonshot.cn/v1",
    })
  }

  async generatePost(persona: SimPersona, topic: string, topicUrl?: string): Promise<string> {
    const response = await this.client.chat.completions.create({
      model: "moonshot-v1-8k",
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
      model: "moonshot-v1-8k",
      max_tokens: 256,
      messages: [
        { role: "system", content: buildSystemPrompt(persona) },
        { role: "user", content: buildReplyPrompt(originalPost) },
      ],
    })

    return response.choices[0]?.message?.content?.trim() ?? ""
  }
}
