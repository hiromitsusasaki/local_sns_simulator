import { Database as DuckDB } from "duckdb-async"
import { and, eq, between, notInArray, sql } from "drizzle-orm"
import { getDb } from "../db/connection"
import { nemotronCache } from "../db/schema"

const PARQUET_BASE =
  "https://huggingface.co/datasets/nvidia/Nemotron-Personas-Japan/resolve/main/data"

const PARQUET_FILES = Array.from({ length: 8 }, (_, i) =>
  `'${PARQUET_BASE}/train-${String(i).padStart(5, "0")}-of-00008.parquet'`
)

const PARQUET_LIST = `[${PARQUET_FILES.join(", ")}]`

export interface NemotronPersona {
  uuid: string
  professionalPersona: string | null
  sportsPersona: string | null
  artsPersona: string | null
  travelPersona: string | null
  culinaryPersona: string | null
  persona: string | null
  culturalBackground: string | null
  skillsList: string[]
  hobbiesList: string[]
  careerGoals: string | null
  sex: string | null
  age: number | null
  maritalStatus: string | null
  educationLevel: string | null
  occupation: string | null
  region: string | null
  area: string | null
  prefecture: string | null
}

interface DuckDBRow {
  uuid: string
  professional_persona: string | null
  sports_persona: string | null
  arts_persona: string | null
  travel_persona: string | null
  culinary_persona: string | null
  persona: string | null
  cultural_background: string | null
  skills_list: string | null
  hobbies_list: string | null
  career_goals: string | null
  sex: string | null
  age: number | null
  marital_status: string | null
  education_level: string | null
  occupation: string | null
  region: string | null
  area: string | null
  prefecture: string | null
}

let duckDbInstance: DuckDB | null = null

async function getDuckDb(): Promise<DuckDB> {
  if (!duckDbInstance) {
    duckDbInstance = await DuckDB.create(":memory:")
    await duckDbInstance.run("INSTALL httpfs; LOAD httpfs;")
  }
  return duckDbInstance
}

export class NemotronPersonaFetcher {
  private readonly ageTolerance: number

  constructor(options?: { ageTolerance?: number }) {
    this.ageTolerance = options?.ageTolerance ?? 5
  }

  async findMatch(params: {
    age: number
    sex: string
    prefecture: string
    region?: string
    excludeUuids?: string[]
  }): Promise<NemotronPersona | null> {
    // 1. SQLiteキャッシュから検索
    const cached = await this.findFromCache(params)
    if (cached) return cached

    // 2. DuckDBでリモートParquetをクエリ
    const remote = await this.fetchFromRemote(params)
    if (remote) return remote

    // 3. リージョンフォールバック
    if (params.region) {
      const fallback = await this.fallbackByRegion(params)
      if (fallback) return fallback
    }

    return null
  }

  private async findFromCache(params: {
    age: number
    sex: string
    prefecture: string
    excludeUuids?: string[]
  }): Promise<NemotronPersona | null> {
    const db = getDb()
    const minAge = params.age - this.ageTolerance
    const maxAge = params.age + this.ageTolerance

    const conditions = [
      eq(nemotronCache.prefecture, params.prefecture),
      eq(nemotronCache.sex, params.sex),
      between(nemotronCache.age, minAge, maxAge),
    ]

    const query = db
      .select()
      .from(nemotronCache)
      .where(and(...conditions))
      .limit(50)

    const rows = await query

    const filtered = params.excludeUuids?.length
      ? rows.filter((r) => !params.excludeUuids!.includes(r.uuid))
      : rows

    if (filtered.length === 0) return null

    const selected = filtered[Math.floor(Math.random() * filtered.length)]
    return this.cacheRowToPersona(selected)
  }

  private async fetchFromRemote(params: {
    age: number
    sex: string
    prefecture: string
    excludeUuids?: string[]
  }): Promise<NemotronPersona | null> {
    try {
      const duckDb = await getDuckDb()
      const minAge = params.age - this.ageTolerance
      const maxAge = params.age + this.ageTolerance

      const query = `
        SELECT *
        FROM read_parquet(${PARQUET_LIST})
        WHERE prefecture = $1
          AND sex = $2
          AND age BETWEEN $3 AND $4
        ORDER BY RANDOM()
        LIMIT 10
      `

      const rows = await withTimeout(
        duckDb.all(query, params.prefecture, params.sex, minAge, maxAge),
        30000,
        "DuckDB remote query timeout"
      ) as DuckDBRow[]

      if (rows.length === 0) return null

      const filtered = params.excludeUuids?.length
        ? rows.filter((r) => !params.excludeUuids!.includes(r.uuid))
        : rows

      if (filtered.length === 0) return null

      // 取得した全件をキャッシュに保存
      const personas = rows.map((r) => this.duckDbRowToPersona(r))
      for (const p of personas) {
        await this.saveToCache(p)
      }

      const selected = filtered[Math.floor(Math.random() * filtered.length)]
      return this.duckDbRowToPersona(selected)
    } catch (error) {
      console.error("DuckDB remote query failed:", error)
      return null
    }
  }

  private async fallbackByRegion(params: {
    age: number
    sex: string
    region?: string
    excludeUuids?: string[]
  }): Promise<NemotronPersona | null> {
    if (!params.region) return null

    const db = getDb()
    const minAge = params.age - this.ageTolerance
    const maxAge = params.age + this.ageTolerance

    const rows = await db
      .select()
      .from(nemotronCache)
      .where(
        and(
          eq(nemotronCache.region, params.region),
          eq(nemotronCache.sex, params.sex),
          between(nemotronCache.age, minAge, maxAge)
        )
      )
      .limit(50)

    const filtered = params.excludeUuids?.length
      ? rows.filter((r) => !params.excludeUuids!.includes(r.uuid))
      : rows

    if (filtered.length === 0) {
      // リージョンでリモートクエリも試行
      try {
        const duckDb = await getDuckDb()
        const query = `
          SELECT *
          FROM read_parquet(${PARQUET_LIST})
          WHERE region = $1
            AND sex = $2
            AND age BETWEEN $3 AND $4
          ORDER BY RANDOM()
          LIMIT 10
        `
        const remoteRows = await withTimeout(
          duckDb.all(query, params.region, params.sex, minAge, maxAge),
          30000,
          "DuckDB region fallback timeout"
        ) as DuckDBRow[]

        if (remoteRows.length === 0) return null

        const personas = remoteRows.map((r) => this.duckDbRowToPersona(r))
        for (const p of personas) {
          await this.saveToCache(p)
        }

        const remoteFiltered = params.excludeUuids?.length
          ? remoteRows.filter((r) => !params.excludeUuids!.includes(r.uuid))
          : remoteRows

        if (remoteFiltered.length === 0) return null

        const selected = remoteFiltered[Math.floor(Math.random() * remoteFiltered.length)]
        return this.duckDbRowToPersona(selected)
      } catch (error) {
        console.error("DuckDB region fallback failed:", error)
        return null
      }
    }

    const selected = filtered[Math.floor(Math.random() * filtered.length)]
    return this.cacheRowToPersona(selected)
  }

  async saveToCache(persona: NemotronPersona): Promise<void> {
    const db = getDb()

    await db
      .insert(nemotronCache)
      .values({
        uuid: persona.uuid,
        professionalPersona: persona.professionalPersona,
        sportsPersona: persona.sportsPersona,
        artsPersona: persona.artsPersona,
        travelPersona: persona.travelPersona,
        culinaryPersona: persona.culinaryPersona,
        persona: persona.persona,
        culturalBackground: persona.culturalBackground,
        skillsList: JSON.stringify(persona.skillsList),
        hobbiesList: JSON.stringify(persona.hobbiesList),
        careerGoals: persona.careerGoals,
        sex: persona.sex,
        age: persona.age,
        maritalStatus: persona.maritalStatus,
        educationLevel: persona.educationLevel,
        occupation: persona.occupation,
        region: persona.region,
        area: persona.area,
        prefecture: persona.prefecture,
        cachedAt: Math.floor(Date.now() / 1000),
      })
      .onConflictDoNothing()
  }

  private parseJsonArray(value: string | null): string[] {
    if (!value) return []
    try {
      const parsed = JSON.parse(value)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }

  private cacheRowToPersona(row: typeof nemotronCache.$inferSelect): NemotronPersona {
    return {
      uuid: row.uuid,
      professionalPersona: row.professionalPersona,
      sportsPersona: row.sportsPersona,
      artsPersona: row.artsPersona,
      travelPersona: row.travelPersona,
      culinaryPersona: row.culinaryPersona,
      persona: row.persona,
      culturalBackground: row.culturalBackground,
      skillsList: this.parseJsonArray(row.skillsList),
      hobbiesList: this.parseJsonArray(row.hobbiesList),
      careerGoals: row.careerGoals,
      sex: row.sex,
      age: row.age,
      maritalStatus: row.maritalStatus,
      educationLevel: row.educationLevel,
      occupation: row.occupation,
      region: row.region,
      area: row.area,
      prefecture: row.prefecture,
    }
  }

  private duckDbRowToPersona(row: DuckDBRow): NemotronPersona {
    return {
      uuid: row.uuid,
      professionalPersona: row.professional_persona,
      sportsPersona: row.sports_persona,
      artsPersona: row.arts_persona,
      travelPersona: row.travel_persona,
      culinaryPersona: row.culinary_persona,
      persona: row.persona,
      culturalBackground: row.cultural_background,
      skillsList: this.parseJsonArray(row.skills_list),
      hobbiesList: this.parseJsonArray(row.hobbies_list),
      careerGoals: row.career_goals,
      sex: row.sex,
      age: row.age,
      maritalStatus: row.marital_status,
      educationLevel: row.education_level,
      occupation: row.occupation,
      region: row.region,
      area: row.area,
      prefecture: row.prefecture,
    }
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), ms)
    promise.then(
      (value) => { clearTimeout(timer); resolve(value) },
      (err) => { clearTimeout(timer); reject(err) },
    )
  })
}
