// 総務省 令和7年版情報通信白書ベースのSNS利用率（概算値）
export const SNS_ACTIVITY_WEIGHTS = [
  { ageGroup: "10代", platform: "general", usageRate: 0.70 },
  { ageGroup: "20代", platform: "general", usageRate: 0.85 },
  { ageGroup: "30代", platform: "general", usageRate: 0.80 },
  { ageGroup: "40代", platform: "general", usageRate: 0.72 },
  { ageGroup: "50代", platform: "general", usageRate: 0.58 },
  { ageGroup: "60代", platform: "general", usageRate: 0.40 },
  { ageGroup: "70代以上", platform: "general", usageRate: 0.22 },
] as const

export function getAgeGroupLabel(age: number): string {
  if (age < 10) return "10代"
  if (age < 20) return "10代"
  if (age < 30) return "20代"
  if (age < 40) return "30代"
  if (age < 50) return "40代"
  if (age < 60) return "50代"
  if (age < 70) return "60代"
  return "70代以上"
}

export function getUsageRate(age: number): number {
  const label = getAgeGroupLabel(age)
  const weight = SNS_ACTIVITY_WEIGHTS.find((w) => w.ageGroup === label)
  return weight?.usageRate ?? 0.22
}
