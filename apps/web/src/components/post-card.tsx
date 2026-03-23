"use client"

import { useState, useEffect } from "react"
import { PersonaModal } from "./persona-modal"

export interface PostData {
  id: string
  personaId: string
  content: string
  createdAt: number
  parentPostId: string | null
  personaName: string | null
  personaAge: number | null
  personaSex: string | null
  personaOccupation: string | null
}

interface OgpData {
  title: string
  description: string
  image: string | null
  siteName: string | null
}

function formatRelativeTime(timestamp: number): string {
  const now = Math.floor(Date.now() / 1000)
  const diff = now - timestamp

  if (diff < 60) return `${diff}秒前`
  if (diff < 3600) return `${Math.floor(diff / 60)}分前`
  if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`
  return `${Math.floor(diff / 86400)}日前`
}

function extractUrl(text: string): string | null {
  const match = text.match(/https?:\/\/[^\s\u3000]+/)
  return match ? match[0] : null
}

function removeUrl(text: string): string {
  return text.replace(/https?:\/\/[^\s\u3000]+/g, "").trim()
}

function OgpCard({ url }: { url: string }) {
  const [ogp, setOgp] = useState<OgpData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchOgp = async () => {
      try {
        const res = await fetch(`/api/ogp?url=${encodeURIComponent(url)}`)
        if (res.ok) {
          const data = await res.json()
          setOgp(data)
        }
      } catch {
        // ignore
      } finally {
        setLoading(false)
      }
    }
    fetchOgp()
  }, [url])

  if (loading) {
    return (
      <div className="mt-2 rounded-lg border border-gray-200 p-3 animate-pulse">
        <div className="h-4 bg-gray-200 rounded w-3/4 mb-2" />
        <div className="h-3 bg-gray-100 rounded w-1/2" />
      </div>
    )
  }

  if (!ogp) {
    return (
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="mt-2 block text-xs text-blue-600 hover:underline break-all"
      >
        {url}
      </a>
    )
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-2 block rounded-lg border border-gray-200 overflow-hidden hover:bg-gray-50 transition-colors"
    >
      {ogp.image && (
        <img
          src={ogp.image}
          alt=""
          className="w-full h-32 object-cover"
          onError={(e) => { (e.target as HTMLImageElement).style.display = "none" }}
        />
      )}
      <div className="p-3">
        <p className="text-sm font-medium text-gray-900 line-clamp-2">
          {ogp.title}
        </p>
        {ogp.description && (
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">
            {ogp.description}
          </p>
        )}
        {ogp.siteName && (
          <p className="text-xs text-gray-400 mt-1">{ogp.siteName}</p>
        )}
      </div>
    </a>
  )
}

const AVATAR_COLORS = [
  { bg: "bg-blue-100", text: "text-blue-600" },
  { bg: "bg-rose-100", text: "text-rose-600" },
  { bg: "bg-emerald-100", text: "text-emerald-600" },
  { bg: "bg-amber-100", text: "text-amber-600" },
  { bg: "bg-purple-100", text: "text-purple-600" },
  { bg: "bg-cyan-100", text: "text-cyan-600" },
  { bg: "bg-pink-100", text: "text-pink-600" },
  { bg: "bg-teal-100", text: "text-teal-600" },
  { bg: "bg-orange-100", text: "text-orange-600" },
  { bg: "bg-indigo-100", text: "text-indigo-600" },
  { bg: "bg-lime-100", text: "text-lime-600" },
  { bg: "bg-fuchsia-100", text: "text-fuchsia-600" },
]

function hashString(str: string): number {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) - hash + str.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

export function getAvatarColor(key: string) {
  return AVATAR_COLORS[hashString(key) % AVATAR_COLORS.length]
}

export function PostCard({ post, isReply = false }: { post: PostData; isReply?: boolean }) {
  const [showModal, setShowModal] = useState(false)
  const url = extractUrl(post.content)
  const textContent = url ? removeUrl(post.content) : post.content
  const color = getAvatarColor(post.personaName ?? post.id)

  return (
    <>
      <div className={`${isReply ? "ml-8 border-l-2 border-blue-200 pl-4" : ""}`}>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 mb-2">
            <button
              onClick={() => setShowModal(true)}
              className={`w-8 h-8 rounded-full ${color.bg} flex items-center justify-center ${color.text} text-sm font-medium cursor-pointer hover:ring-2 hover:ring-offset-1 hover:ring-blue-300 transition-all`}
            >
              {post.personaName?.[0] ?? "?"}
            </button>
            <div>
              <button
                onClick={() => setShowModal(true)}
                className="font-medium text-sm text-gray-900 hover:text-blue-600 hover:underline cursor-pointer"
              >
                {post.personaName ?? "不明"}
              </button>
              <span className="text-xs text-gray-500 ml-2">
                {post.personaAge}歳 / {post.personaOccupation ?? "不明"}
              </span>
            </div>
            <span className="ml-auto text-xs text-gray-400">
              {formatRelativeTime(post.createdAt)}
            </span>
          </div>
          <p className="text-sm text-gray-800 leading-relaxed">{textContent}</p>
          {url && <OgpCard url={url} />}
        </div>
      </div>

      {showModal && (
        <PersonaModal
          personaId={post.personaId}
          onClose={() => setShowModal(false)}
        />
      )}
    </>
  )
}
