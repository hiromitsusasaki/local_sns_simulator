"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"

export function AddTimelineDialog() {
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const [form, setForm] = useState({
    municipalityCode: "",
    municipalityName: "",
    prefecture: "",
    region: "",
    personaCount: 100,
  })

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await fetch("/api/timelines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      })

      if (response.ok) {
        setIsOpen(false)
        setForm({
          municipalityCode: "",
          municipalityName: "",
          prefecture: "",
          region: "",
          personaCount: 100,
        })
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors"
      >
        + タイムライン追加
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h2 className="text-lg font-semibold mb-4">タイムラインを追加</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              市区町村コード
            </label>
            <input
              type="text"
              value={form.municipalityCode}
              onChange={(e) =>
                setForm({ ...form, municipalityCode: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              placeholder="例: 131030"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              市区町村名
            </label>
            <input
              type="text"
              value={form.municipalityName}
              onChange={(e) =>
                setForm({ ...form, municipalityName: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              placeholder="例: 中央区"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              都道府県
            </label>
            <input
              type="text"
              value={form.prefecture}
              onChange={(e) =>
                setForm({ ...form, prefecture: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              placeholder="例: 東京都"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              地方
            </label>
            <input
              type="text"
              value={form.region}
              onChange={(e) =>
                setForm({ ...form, region: e.target.value })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              placeholder="例: 関東地方"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              ペルソナ数
            </label>
            <input
              type="number"
              value={form.personaCount}
              onChange={(e) =>
                setForm({ ...form, personaCount: parseInt(e.target.value, 10) || 100 })
              }
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
              min={1}
              max={500}
            />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="flex-1 px-4 py-2 bg-gray-100 text-gray-700 text-sm rounded-md hover:bg-gray-200 transition-colors"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              {loading ? "追加中..." : "追加"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
