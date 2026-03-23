import { readFileSync } from "node:fs"
import { resolve, dirname } from "node:path"
import { fileURLToPath } from "node:url"

interface NamesData {
  surnames: string[]
  maleNames: string[]
  femaleNames: string[]
}

let namesData: NamesData | null = null

function loadNames(): NamesData {
  if (namesData) return namesData

  const __dirname = dirname(fileURLToPath(import.meta.url))
  const filePath = resolve(__dirname, "../data/names.json")
  const raw = readFileSync(filePath, "utf-8")
  namesData = JSON.parse(raw) as NamesData
  return namesData
}

export class NameGenerator {
  private readonly names: NamesData

  constructor() {
    this.names = loadNames()
  }

  generate(sex: "男" | "女"): string {
    const surname = this.randomPick(this.names.surnames)
    const firstNames = sex === "男" ? this.names.maleNames : this.names.femaleNames
    const firstName = this.randomPick(firstNames)
    return `${surname} ${firstName}`
  }

  generateUnique(sex: "男" | "女", existingNames: Set<string>): string {
    const maxAttempts = 100

    for (let i = 0; i < maxAttempts; i++) {
      const name = this.generate(sex)
      if (!existingNames.has(name)) {
        return name
      }
    }

    // フォールバック: ランダムな数字を付与して一意性を担保
    const baseName = this.generate(sex)
    const suffix = Math.floor(Math.random() * 1000)
    return `${baseName}${suffix}`
  }

  private randomPick<T>(array: readonly T[]): T {
    return array[Math.floor(Math.random() * array.length)]
  }
}
