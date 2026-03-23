import Anthropic from "@anthropic-ai/sdk"
import type { SimPersona } from "../personas/schema"
import type { LLMProvider, Post } from "./provider"
import { buildSystemPrompt, buildPostPrompt, buildReplyPrompt } from "./prompt-templates"
import { requireLlmApiKey } from "../config/env"

export class AnthropicProvider implements LLMProvider {
  private readonly client: Anthropic

  constructor(apiKey?: string) {
    this.client = new Anthropic({
      apiKey: apiKey ?? requireLlmApiKey(),
    })
  }

  async generatePost(persona: SimPersona, topic: string, topicUrl?: string): Promise<string> {
    const response = await this.client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 256,
      system: buildSystemPrompt(persona),
      messages: [
        { role: "user", content: buildPostPrompt(topic, topicUrl) },
      ],
    })

    const textBlock = response.content.find((b) => b.type === "text")
    return textBlock?.text?.trim() ?? ""
  }

  async generateReply(persona: SimPersona, originalPost: Post): Promise<string> {
    const response = await this.client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 256,
      system: buildSystemPrompt(persona),
      messages: [
        { role: "user", content: buildReplyPrompt(originalPost) },
      ],
    })

    const textBlock = response.content.find((b) => b.type === "text")
    return textBlock?.text?.trim() ?? ""
  }
}
