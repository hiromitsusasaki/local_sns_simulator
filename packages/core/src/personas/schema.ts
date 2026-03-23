import { z } from "zod"

export const SimPersonaSchema = z.object({
  id: z.string().uuid(),
  nemotronUuid: z.string(),
  municipalityCode: z.string().length(6),
  municipalityName: z.string(),
  name: z.string(),
  sex: z.enum(["男", "女"]),
  age: z.number().int().min(0).max(100),
  maritalStatus: z.string(),
  educationLevel: z.string(),
  occupation: z.string(),
  prefecture: z.string(),
  region: z.string(),
  persona: z.string(),
  professionalPersona: z.string(),
  culturalBackground: z.string(),
  skillsList: z.array(z.string()),
  hobbiesList: z.array(z.string()),
  snsActivityLevel: z.enum(["high", "medium", "low", "inactive"]),
  createdAt: z.number(),
})

export type SimPersona = z.infer<typeof SimPersonaSchema>

export type SnsActivityLevel = "high" | "medium" | "low" | "inactive"
