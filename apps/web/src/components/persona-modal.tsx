"use client"

import { useState, useEffect } from "react"
import { getAvatarColor } from "./post-card"

interface PersonaDetail {
  id: string
  name: string
  sex: string | null
  age: number
  occupation: string | null
  maritalStatus: string | null
  educationLevel: string | null
  prefecture: string | null
  region: string | null
  municipalityName: string
  persona: string | null
  professionalPersona: string | null
  culturalBackground: string | null
  skillsList: string | null
  hobbiesList: string | null
  snsActivityLevel: string | null
}

function parseJsonArray(value: string | null): string[] {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const activityColors: Record<string, string> = {
  high: "bg-green-100 text-green-800",
  medium: "bg-blue-100 text-blue-800",
  low: "bg-yellow-100 text-yellow-800",
  inactive: "bg-gray-100 text-gray-800",
}

export function PersonaModal({
  personaId,
  onClose,
}: {
  personaId: string
  onClose: () => void
}) {
  const [persona, setPersona] = useState<PersonaDetail | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPersona = async () => {
      try {
        const res = await fetch(`/api/persona/${personaId}`)
        if (res.ok) {
          const data = await res.json()
          setPersona(data)
        }
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    fetchPersona()
  }, [personaId])

  const color = persona ? getAvatarColor(persona.name) : { bg: "bg-gray-100", text: "text-gray-600" }
  const skills = persona ? parseJsonArray(persona.skillsList) : []
  const hobbies = persona ? parseJsonArray(persona.hobbiesList) : []

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg w-full max-w-lg max-h-[80vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <div className="p-8 text-center text-gray-400">読み込み中...</div>
        ) : !persona ? (
          <div className="p-8 text-center text-gray-400">ペルソナが見つかりません</div>
        ) : (
          <>
            {/* Header */}
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center gap-4">
                <div className={`w-14 h-14 rounded-full ${color.bg} flex items-center justify-center ${color.text} text-xl font-bold`}>
                  {persona.name[0]}
                </div>
                <div className="flex-1">
                  <h2 className="text-lg font-bold text-gray-900">{persona.name}</h2>
                  <p className="text-sm text-gray-500">
                    {persona.age}歳 / {persona.sex} / {persona.prefecture}{persona.municipalityName}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-sm text-gray-600">{persona.occupation ?? "不明"}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${activityColors[persona.snsActivityLevel ?? "inactive"]}`}>
                      {persona.snsActivityLevel}
                    </span>
                  </div>
                </div>
                <button
                  onClick={onClose}
                  className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
                >
                  &times;
                </button>
              </div>
            </div>

            {/* Details */}
            <div className="p-6 space-y-4">
              <Section title="基本情報">
                <InfoRow label="学歴" value={persona.educationLevel} />
                <InfoRow label="婚姻状況" value={persona.maritalStatus} />
                <InfoRow label="地域" value={persona.region} />
              </Section>

              {persona.persona && (
                <Section title="人物像">
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {persona.persona}
                  </p>
                </Section>
              )}

              {persona.culturalBackground && (
                <Section title="文化的背景">
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {persona.culturalBackground}
                  </p>
                </Section>
              )}

              {persona.professionalPersona && (
                <Section title="職業的ペルソナ">
                  <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {persona.professionalPersona}
                  </p>
                </Section>
              )}

              {skills.length > 0 && (
                <Section title="スキル">
                  <div className="flex flex-wrap gap-1.5">
                    {skills.map((s, i) => (
                      <span key={i} className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-md">
                        {s}
                      </span>
                    ))}
                  </div>
                </Section>
              )}

              {hobbies.length > 0 && (
                <Section title="趣味・関心">
                  <div className="flex flex-wrap gap-1.5">
                    {hobbies.map((h, i) => (
                      <span key={i} className="px-2 py-1 bg-amber-50 text-amber-700 text-xs rounded-md">
                        {h}
                      </span>
                    ))}
                  </div>
                </Section>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
        {title}
      </h3>
      {children}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null
  return (
    <div className="flex text-sm py-0.5">
      <span className="text-gray-500 w-24 shrink-0">{label}</span>
      <span className="text-gray-800">{value}</span>
    </div>
  )
}
