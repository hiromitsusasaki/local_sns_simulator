import { config } from "dotenv"
import { resolve } from "node:path"
import { z } from "zod"

// プロジェクトルートの.envを探索
config({ path: resolve(process.cwd(), ".env") })
config({ path: resolve(process.cwd(), "../../.env") })
config({ path: resolve(process.cwd(), "../../../.env") })

const envSchema = z.object({
  ESTAT_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  LLM_PROVIDER: z.enum(["anthropic", "kimi", "glm"]).default("anthropic"),
  KIMI_API_KEY: z.string().min(1).optional(),
  GLM_API_KEY: z.string().min(1).optional(),
  PERSONA_DETAIL_MODE: z.enum(["full", "light"]).default("full"),
})

export type Env = z.infer<typeof envSchema>

let cachedEnv: Env | null = null

export function getEnv(): Env {
  if (!cachedEnv) {
    cachedEnv = envSchema.parse(process.env)
  }
  return cachedEnv
}

export function requireEstatApiKey(): string {
  const env = getEnv()
  if (!env.ESTAT_API_KEY) {
    throw new Error("ESTAT_API_KEY is required. Set it in .env file.")
  }
  return env.ESTAT_API_KEY
}

export function requireLlmApiKey(): string {
  const env = getEnv()
  switch (env.LLM_PROVIDER) {
    case "anthropic":
      if (!env.ANTHROPIC_API_KEY) {
        throw new Error("ANTHROPIC_API_KEY is required when LLM_PROVIDER=anthropic")
      }
      return env.ANTHROPIC_API_KEY
    case "kimi":
      if (!env.KIMI_API_KEY) {
        throw new Error("KIMI_API_KEY is required when LLM_PROVIDER=kimi")
      }
      return env.KIMI_API_KEY
    case "glm":
      if (!env.GLM_API_KEY) {
        throw new Error("GLM_API_KEY is required when LLM_PROVIDER=glm")
      }
      return env.GLM_API_KEY
  }
}
