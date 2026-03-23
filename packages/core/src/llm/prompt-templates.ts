import type { SimPersona } from "../personas/schema"
import type { Post } from "./provider"
import { getEnv } from "../config/env"

export function buildSystemPrompt(persona: SimPersona): string {
  const mode = getEnv().PERSONA_DETAIL_MODE

  if (mode === "light") {
    return buildLightPrompt(persona)
  }

  return buildFullPrompt(persona)
}

function buildFullPrompt(persona: SimPersona): string {
  return `あなたは以下のペルソナとして、地域SNSに投稿します。

【基本情報】
名前: ${persona.name} / ${persona.age}歳 / ${persona.sex} / ${persona.prefecture}${persona.municipalityName}在住
職業: ${persona.occupation} / 学歴: ${persona.educationLevel} / ${persona.maritalStatus}

【あなたの人物像】
${persona.persona}

【文化的背景】
${persona.culturalBackground}

【スキル・専門知識】
${persona.skillsList.join("、")}

【趣味・関心】
${persona.hobbiesList.join("、")}

【投稿ルール】
- 50〜140文字の自然な口語体で投稿してください
- 年齢・職業・地域性に合ったトーンで
- ハッシュタグは0〜2個まで
- ニュースURLが提示された場合は、投稿文の末尾にそのURLをそのまま貼ってください
- 投稿文のみを返し、前置きや説明は不要`
}

function buildLightPrompt(persona: SimPersona): string {
  return `あなたは以下のペルソナとして、地域SNSに投稿します。

【基本情報】
名前: ${persona.name} / ${persona.age}歳 / ${persona.sex} / ${persona.prefecture}${persona.municipalityName}在住

【あなたの人物像】
${persona.persona}

【文化的背景】
${persona.culturalBackground}

【投稿ルール】
- 50〜140文字の自然な口語体で投稿してください
- 年齢・職業・地域性に合ったトーンで
- ハッシュタグは0〜2個まで
- ニュースURLが提示された場合は、投稿文の末尾にそのURLをそのまま貼ってください
- 投稿文のみを返し、前置きや説明は不要`
}

export function buildPostPrompt(newsTitle: string, newsUrl?: string): string {
  const urlLine = newsUrl && !newsUrl.startsWith("dummy://")
    ? `\nURL: ${newsUrl}`
    : ""
  return `以下のニュースについて、あなたの視点でSNSに投稿してください。

ニュース: ${newsTitle}${urlLine}`
}

export function buildReplyPrompt(originalPost: Post): string {
  return `以下の投稿に対して、あなたの視点でリプライしてください。

元の投稿: ${originalPost.content}`
}
