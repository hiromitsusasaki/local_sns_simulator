import { eq } from "drizzle-orm"
import { getDb } from "../db/connection"
import { demographics } from "../db/schema"
import { requireEstatApiKey } from "../config/env"

const ESTAT_BASE_URL = "https://api.e-stat.go.jp/rest/3.0/app/json/getStatsData"

// 国勢調査 令和2年 - 年齢（5歳階級），男女別人口 - 市区町村レベル
const CENSUS_STATS_DATA_ID = "0003445162"

// cat01: 国籍区分 ("0" = 国籍総数か日本人)
// cat02: 性別 ("0" = 総数, "1" = 男, "2" = 女)
// cat03: 年齢5歳階級 ("00" = 総数, "01" = 0〜4歳, ..., "21" = 100歳以上, "22" = 不詳)

const AGE_GROUP_MAP: Record<string, string> = {
  "01": "0-4",
  "02": "5-9",
  "03": "10-14",
  "04": "15-19",
  "05": "20-24",
  "06": "25-29",
  "07": "30-34",
  "08": "35-39",
  "09": "40-44",
  "10": "45-49",
  "11": "50-54",
  "12": "55-59",
  "13": "60-64",
  "14": "65-69",
  "15": "70-74",
  "16": "75-79",
  "17": "80-84",
  "18": "85-89",
  "19": "90-94",
  "20": "95-99",
  "21": "85+",
}

const SEX_MAP: Record<string, "male" | "female" | null> = {
  "0": null,
  "1": "male",
  "2": "female",
}

export interface DemographicRecord {
  municipalityCode: string
  municipalityName: string
  prefecture: string
  ageGroup: string
  sex: "male" | "female"
  population: number
  year: number
}

interface EStatResponse {
  GET_STATS_DATA: {
    RESULT: {
      STATUS: number
      ERROR_MSG?: string
    }
    STATISTICAL_DATA?: {
      CLASS_INF: {
        CLASS_OBJ: EStatClassObj[]
      }
      DATA_INF: {
        NOTE?: unknown
        VALUE: EStatValue[]
      }
    }
  }
}

interface EStatClassObj {
  "@id": string
  "@name": string
  CLASS: EStatClass[] | EStatClass
}

interface EStatClass {
  "@code": string
  "@name": string
  "@level"?: string
}

interface EStatValue {
  "@tab"?: string
  "@cat01"?: string
  "@cat02"?: string
  "@cat03"?: string
  "@area"?: string
  "@time"?: string
  "$": string
}

export class EStatClient {
  private readonly apiKey: string

  constructor(apiKey?: string) {
    this.apiKey = apiKey ?? requireEstatApiKey()
  }

  async fetchDemographics(
    municipalityCode: string,
    options?: { statsDataId?: string }
  ): Promise<DemographicRecord[]> {
    const statsDataId = options?.statsDataId ?? CENSUS_STATS_DATA_ID

    // 6桁コード → 5桁（末尾チェックデジット除去）
    const cdArea = municipalityCode.length === 6
      ? municipalityCode.slice(0, 5)
      : municipalityCode

    const params = new URLSearchParams({
      appId: this.apiKey,
      statsDataId,
      cdArea,
      cdCat01: "0", // 国籍総数
      metaGetFlg: "Y",
      cntGetFlg: "N",
      sectionHeaderFlg: "1",
    })

    const url = `${ESTAT_BASE_URL}?${params.toString()}`

    const response = await fetch(url)
    if (!response.ok) {
      throw new Error(`e-Stat API error: ${response.status} ${response.statusText}`)
    }

    const data = (await response.json()) as EStatResponse
    const result = data.GET_STATS_DATA.RESULT

    if (result.STATUS !== 0) {
      throw new Error(`e-Stat API returned error: ${result.ERROR_MSG ?? `status=${result.STATUS}`}`)
    }

    const statData = data.GET_STATS_DATA.STATISTICAL_DATA
    if (!statData) {
      throw new Error("No statistical data in e-Stat response")
    }

    return this.parseResponse(statData, municipalityCode)
  }

  private parseResponse(
    statData: NonNullable<EStatResponse["GET_STATS_DATA"]["STATISTICAL_DATA"]>,
    municipalityCode: string
  ): DemographicRecord[] {
    const classObjs = statData.CLASS_INF.CLASS_OBJ
    const values = statData.DATA_INF.VALUE

    // エリア名を取得
    const areaMap = this.buildClassMap(classObjs, "area")

    const records: DemographicRecord[] = []

    for (const value of values) {
      const sexCode = value["@cat02"] ?? ""
      const ageCode = value["@cat03"] ?? ""
      const areaCode = value["@area"] ?? ""

      // 性別フィルタ（総数は除外）
      const sex = SEX_MAP[sexCode]
      if (!sex) continue

      // 年齢フィルタ（総数・不詳は除外、85+にまとめる）
      const ageGroup = this.resolveAgeGroup(ageCode)
      if (!ageGroup) continue

      const population = parseInt(value["$"], 10)
      if (isNaN(population) || population < 0) continue

      const areaInfo = areaMap.get(areaCode)
      const areaName = areaInfo?.name ?? ""

      records.push({
        municipalityCode,
        municipalityName: areaName,
        prefecture: this.extractPrefecture(areaName, municipalityCode),
        ageGroup,
        sex,
        population,
        year: 2020,
      })
    }

    // 85歳以上を合算（85-89, 90-94, 95-99, 100+）
    return this.consolidateOldAgeGroups(records)
  }

  private resolveAgeGroup(code: string): string | null {
    // 00=総数, 22=不詳 を除外
    if (code === "00" || code === "22") return null

    // 18〜21（85-89, 90-94, 95-99, 100+）は "85+" に統合するため一旦個別に返す
    if (code === "18") return "85-89"
    if (code === "19") return "90-94"
    if (code === "20") return "95-99"
    if (code === "21") return "100+"

    return AGE_GROUP_MAP[code] ?? null
  }

  private consolidateOldAgeGroups(records: DemographicRecord[]): DemographicRecord[] {
    const oldGroups = new Set(["85-89", "90-94", "95-99", "100+"])
    const consolidated: DemographicRecord[] = []
    const oldGroupAccum = new Map<string, DemographicRecord>()

    for (const r of records) {
      if (oldGroups.has(r.ageGroup)) {
        const key = `${r.municipalityCode}-${r.sex}`
        const existing = oldGroupAccum.get(key)
        if (existing) {
          oldGroupAccum.set(key, { ...existing, population: existing.population + r.population })
        } else {
          oldGroupAccum.set(key, { ...r, ageGroup: "85+" })
        }
      } else {
        consolidated.push(r)
      }
    }

    for (const r of oldGroupAccum.values()) {
      consolidated.push(r)
    }

    return consolidated
  }

  private buildClassMap(
    classObjs: EStatClassObj[],
    targetId: string
  ): Map<string, { name: string }> {
    const map = new Map<string, { name: string }>()

    for (const obj of classObjs) {
      if (!obj["@id"].includes(targetId)) continue

      const classes = Array.isArray(obj.CLASS) ? obj.CLASS : [obj.CLASS]
      for (const cls of classes) {
        map.set(cls["@code"], { name: cls["@name"] })
      }
    }

    return map
  }

  private extractPrefecture(areaName: string, municipalityCode: string): string {
    // コードの先頭2桁から都道府県を推定
    const prefCode = municipalityCode.slice(0, 2)
    const prefMap: Record<string, string> = {
      "01": "北海道", "02": "青森県", "03": "岩手県", "04": "宮城県",
      "05": "秋田県", "06": "山形県", "07": "福島県", "08": "茨城県",
      "09": "栃木県", "10": "群馬県", "11": "埼玉県", "12": "千葉県",
      "13": "東京都", "14": "神奈川県", "15": "新潟県", "16": "富山県",
      "17": "石川県", "18": "福井県", "19": "山梨県", "20": "長野県",
      "21": "岐阜県", "22": "静岡県", "23": "愛知県", "24": "三重県",
      "25": "滋賀県", "26": "京都府", "27": "大阪府", "28": "兵庫県",
      "29": "奈良県", "30": "和歌山県", "31": "鳥取県", "32": "島根県",
      "33": "岡山県", "34": "広島県", "35": "山口県", "36": "徳島県",
      "37": "香川県", "38": "愛媛県", "39": "高知県", "40": "福岡県",
      "41": "佐賀県", "42": "長崎県", "43": "熊本県", "44": "大分県",
      "45": "宮崎県", "46": "鹿児島県", "47": "沖縄県",
    }
    return prefMap[prefCode] ?? ""
  }

  async saveDemographics(records: DemographicRecord[]): Promise<void> {
    const db = getDb()

    // 既存データを市区町村コード単位で削除してから挿入
    if (records.length > 0) {
      const code = records[0].municipalityCode
      await db.delete(demographics).where(eq(demographics.municipalityCode, code))
    }

    if (records.length === 0) return

    const rows = records.map((r) => ({
      municipalityCode: r.municipalityCode,
      municipalityName: r.municipalityName,
      prefecture: r.prefecture,
      ageGroup: r.ageGroup,
      sex: r.sex,
      population: r.population,
      year: r.year,
    }))

    // バッチ挿入（500件ずつ）
    const batchSize = 500
    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize)
      await db.insert(demographics).values(batch)
    }
  }
}
