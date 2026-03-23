import { sqliteTable, text, integer, real, index } from "drizzle-orm/sqlite-core"

export const timelines = sqliteTable("timelines", {
  municipalityCode: text("municipality_code").primaryKey(),
  municipalityName: text("municipality_name").notNull(),
  prefecture: text("prefecture").notNull(),
  region: text("region").notNull(),
  personaCount: integer("persona_count").default(100).notNull(),
  status: text("status", { enum: ["active", "paused", "initializing"] }).notNull(),
  addedAt: integer("added_at").notNull(),
  lastActivityAt: integer("last_activity_at"),
})

export const demographics = sqliteTable("demographics", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  municipalityCode: text("municipality_code").notNull(),
  municipalityName: text("municipality_name").notNull(),
  prefecture: text("prefecture").notNull(),
  ageGroup: text("age_group").notNull(),
  sex: text("sex", { enum: ["male", "female"] }).notNull(),
  population: integer("population").notNull(),
  year: integer("year").notNull(),
})

export const snsActivityWeights = sqliteTable("sns_activity_weights", {
  ageGroup: text("age_group").primaryKey(),
  platform: text("platform").notNull(),
  usageRate: real("usage_rate").notNull(),
})

export const nemotronCache = sqliteTable("nemotron_cache", {
  uuid: text("uuid").primaryKey(),
  professionalPersona: text("professional_persona"),
  sportsPersona: text("sports_persona"),
  artsPersona: text("arts_persona"),
  travelPersona: text("travel_persona"),
  culinaryPersona: text("culinary_persona"),
  persona: text("persona"),
  culturalBackground: text("cultural_background"),
  skillsList: text("skills_list"),
  hobbiesList: text("hobbies_list"),
  careerGoals: text("career_goals"),
  sex: text("sex"),
  age: integer("age"),
  maritalStatus: text("marital_status"),
  educationLevel: text("education_level"),
  occupation: text("occupation"),
  region: text("region"),
  area: text("area"),
  prefecture: text("prefecture"),
  cachedAt: integer("cached_at").notNull(),
}, (table) => [
  index("idx_nemotron_pref_sex_age").on(table.prefecture, table.sex, table.age),
  index("idx_nemotron_region_sex").on(table.region, table.sex),
])

export const simPersonas = sqliteTable("sim_personas", {
  id: text("id").primaryKey(),
  nemotronUuid: text("nemotron_uuid"),
  municipalityCode: text("municipality_code").notNull(),
  municipalityName: text("municipality_name").notNull(),
  name: text("name").notNull(),
  sex: text("sex").notNull(),
  age: integer("age").notNull(),
  maritalStatus: text("marital_status"),
  educationLevel: text("education_level"),
  occupation: text("occupation"),
  prefecture: text("prefecture"),
  region: text("region"),
  persona: text("persona"),
  professionalPersona: text("professional_persona"),
  culturalBackground: text("cultural_background"),
  skillsList: text("skills_list"),
  hobbiesList: text("hobbies_list"),
  snsActivityLevel: text("sns_activity_level", {
    enum: ["high", "medium", "low", "inactive"],
  }),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("idx_personas_municipality").on(table.municipalityCode),
])

export const posts = sqliteTable("posts", {
  id: text("id").primaryKey(),
  personaId: text("persona_id").notNull(),
  municipalityCode: text("municipality_code").notNull(),
  content: text("content").notNull(),
  parentPostId: text("parent_post_id"),
  newsId: text("news_id"),
  createdAt: integer("created_at").notNull(),
}, (table) => [
  index("idx_posts_municipality_created").on(table.municipalityCode, table.createdAt),
  index("idx_posts_parent").on(table.parentPostId),
])

export const news = sqliteTable("news", {
  id: text("id").primaryKey(),
  municipalityCode: text("municipality_code"),
  title: text("title").notNull(),
  url: text("url").notNull().unique(),
  source: text("source"),
  publishedAt: integer("published_at"),
  fetchedAt: integer("fetched_at").notNull(),
})

export const errorLogs = sqliteTable("error_logs", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  phase: text("phase"),
  municipalityCode: text("municipality_code"),
  message: text("message").notNull(),
  createdAt: integer("created_at").notNull(),
})
