export const DEFAULT_MUNICIPALITIES = [
  { code: "131030", name: "中央区", prefecture: "東京都", region: "関東地方" },
  { code: "131105", name: "目黒区", prefecture: "東京都", region: "関東地方" },
  { code: "112348", name: "所沢市", prefecture: "埼玉県", region: "関東地方" },
  { code: "041009", name: "仙台市", prefecture: "宮城県", region: "東北地方" },
  { code: "271047", name: "北区", prefecture: "大阪府", region: "近畿地方" },
] as const

export type Municipality = (typeof DEFAULT_MUNICIPALITIES)[number]

export const DEFAULT_PERSONA_COUNT = 100
