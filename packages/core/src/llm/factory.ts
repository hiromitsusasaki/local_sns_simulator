import { getEnv } from "../config/env"
import type { LLMProvider } from "./provider"
import { AnthropicProvider } from "./anthropic-provider"
import { KimiProvider } from "./kimi-provider"
import { GlmProvider } from "./glm-provider"

export class LLMProviderFactory {
  static create(): LLMProvider {
    const env = getEnv()

    switch (env.LLM_PROVIDER) {
      case "anthropic":
        return new AnthropicProvider()
      case "kimi":
        return new KimiProvider()
      case "glm":
        return new GlmProvider()
    }
  }
}
