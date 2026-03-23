import { randomUUID } from "node:crypto"
import { eq } from "drizzle-orm"
import { getDb } from "../db/connection"
import { demographics, simPersonas } from "../db/schema"
import { NemotronPersonaFetcher } from "../collectors/nemotron-fetcher"
import { NameGenerator } from "./name-generator"
import { getUsageRate } from "../db/seeds/sns-weights"
import type { SimPersona, SnsActivityLevel } from "./schema"
import type { DemographicRecord } from "../collectors/estat-client"
import { DEFAULT_MUNICIPALITIES } from "../config/municipalities"

export class PersonaGenerator {
  private readonly fetcher: NemotronPersonaFetcher
  private readonly nameGenerator: NameGenerator

  constructor() {
    this.fetcher = new NemotronPersonaFetcher()
    this.nameGenerator = new NameGenerator()
  }

  async generate(
    municipalityCode: string,
    count: number,
    onProgress?: (current: number, total: number) => void
  ): Promise<SimPersona[]> {
    const db = getDb()

    // 人口統計データを取得
    const demoRecords = await db
      .select()
      .from(demographics)
      .where(eq(demographics.municipalityCode, municipalityCode))

    if (demoRecords.length === 0) {
      throw new Error(`No demographic data found for municipality: ${municipalityCode}`)
    }

    // 市区町村情報を取得
    const municipalityInfo = this.getMunicipalityInfo(municipalityCode, demoRecords)

    // 年齢・性別をサンプリング
    const samples = this.sampleDemographics(demoRecords, count)

    const personas: SimPersona[] = []
    const usedUuids: string[] = []
    const usedNames = new Set<string>()

    for (let i = 0; i < samples.length; i++) {
      const sample = samples[i]

      // SNS活動レベルを決定
      const snsActivityLevel = this.determineSnsActivity(sample.age)

      // Nemotronマッチング
      const nemotronPersona = await this.fetcher.findMatch({
        age: sample.age,
        sex: sample.sex,
        prefecture: municipalityInfo.prefecture,
        region: municipalityInfo.region,
        excludeUuids: usedUuids,
      })

      if (!nemotronPersona) {
        onProgress?.(i + 1, samples.length)
        continue
      }

      usedUuids.push(nemotronPersona.uuid)

      // 名前生成
      const name = this.nameGenerator.generateUnique(
        sample.sex as "男" | "女",
        usedNames
      )
      usedNames.add(name)

      const persona: SimPersona = {
        id: randomUUID(),
        nemotronUuid: nemotronPersona.uuid,
        municipalityCode,
        municipalityName: municipalityInfo.name,
        name,
        sex: sample.sex as "男" | "女",
        age: sample.age,
        maritalStatus: nemotronPersona.maritalStatus ?? "不明",
        educationLevel: nemotronPersona.educationLevel ?? "不明",
        occupation: nemotronPersona.occupation ?? "不明",
        prefecture: municipalityInfo.prefecture,
        region: municipalityInfo.region,
        persona: nemotronPersona.persona ?? "",
        professionalPersona: nemotronPersona.professionalPersona ?? "",
        culturalBackground: nemotronPersona.culturalBackground ?? "",
        skillsList: nemotronPersona.skillsList,
        hobbiesList: nemotronPersona.hobbiesList,
        snsActivityLevel,
        createdAt: Math.floor(Date.now() / 1000),
      }

      personas.push(persona)
      onProgress?.(i + 1, samples.length)
    }

    return personas
  }

  sampleDemographics(
    records: DemographicRecord[],
    count: number
  ): Array<{ age: number; sex: string }> {
    // 総数を計算
    const totalPopulation = records.reduce((sum, r) => sum + r.population, 0)
    if (totalPopulation === 0) return []

    const samples: Array<{ age: number; sex: string }> = []

    // 各レコードの重みでサンプリング
    const weights = records.map((r) => ({
      record: r,
      weight: r.population / totalPopulation,
    }))

    for (let i = 0; i < count; i++) {
      const rand = Math.random()
      let cumulative = 0
      let selectedRecord = weights[0].record

      for (const { record, weight } of weights) {
        cumulative += weight
        if (rand <= cumulative) {
          selectedRecord = record
          break
        }
      }

      // 年齢グループから具体的な年齢をランダム生成
      const age = this.randomAgeFromGroup(selectedRecord.ageGroup)
      const sex = selectedRecord.sex === "male" ? "男" : "女"

      samples.push({ age, sex })
    }

    return samples
  }

  determineSnsActivity(age: number): SnsActivityLevel {
    const usageRate = getUsageRate(age)
    const rand = Math.random()

    if (usageRate > 0.6) {
      if (rand < 0.4) return "high"
      if (rand < 0.8) return "medium"
      return "low"
    }

    if (rand < usageRate) return "low"
    return "inactive"
  }

  async save(personas: SimPersona[]): Promise<void> {
    const db = getDb()

    if (personas.length === 0) return

    const rows = personas.map((p) => ({
      id: p.id,
      nemotronUuid: p.nemotronUuid,
      municipalityCode: p.municipalityCode,
      municipalityName: p.municipalityName,
      name: p.name,
      sex: p.sex,
      age: p.age,
      maritalStatus: p.maritalStatus,
      educationLevel: p.educationLevel,
      occupation: p.occupation,
      prefecture: p.prefecture,
      region: p.region,
      persona: p.persona,
      professionalPersona: p.professionalPersona,
      culturalBackground: p.culturalBackground,
      skillsList: JSON.stringify(p.skillsList),
      hobbiesList: JSON.stringify(p.hobbiesList),
      snsActivityLevel: p.snsActivityLevel,
      createdAt: p.createdAt,
    }))

    // バッチ挿入
    const batchSize = 100
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize)
      await db.insert(simPersonas).values(batch)
    }
  }

  private randomAgeFromGroup(ageGroup: string): number {
    if (ageGroup === "85+" || ageGroup === "80+") {
      return 85 + Math.floor(Math.random() * 15)
    }

    const match = ageGroup.match(/^(\d+)-(\d+)$/)
    if (match) {
      const min = parseInt(match[1], 10)
      const max = parseInt(match[2], 10)
      return min + Math.floor(Math.random() * (max - min + 1))
    }

    return 40 // フォールバック
  }

  private getMunicipalityInfo(
    code: string,
    records: DemographicRecord[]
  ): { name: string; prefecture: string; region: string } {
    // DEFAULT_MUNICIPALITIESから検索
    const known = DEFAULT_MUNICIPALITIES.find((m) => m.code === code)
    if (known) {
      return { name: known.name, prefecture: known.prefecture, region: known.region }
    }

    // demographicsレコードから推測
    if (records.length > 0) {
      return {
        name: records[0].municipalityName,
        prefecture: records[0].prefecture,
        region: "",
      }
    }

    return { name: code, prefecture: "", region: "" }
  }
}
