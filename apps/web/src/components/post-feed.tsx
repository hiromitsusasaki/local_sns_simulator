"use client"

import { useState, useEffect, useCallback } from "react"
import { PostCard, type PostData } from "./post-card"

export function PostFeed({
  municipalityCode,
  initialPosts,
}: {
  municipalityCode: string
  initialPosts: PostData[]
}) {
  const [allPosts, setAllPosts] = useState<PostData[]>(initialPosts)
  const [triggering, setTriggering] = useState(false)

  useEffect(() => {
    const eventSource = new EventSource(
      `/api/posts/stream?municipalityCode=${municipalityCode}`
    )

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.type === "new_posts" && Array.isArray(data.posts)) {
          setAllPosts((prev) => {
            const existingIds = new Set(prev.map((p) => p.id))
            const newPosts = data.posts.filter(
              (p: PostData) => !existingIds.has(p.id)
            )
            return [...newPosts, ...prev]
          })
        }
      } catch {
        // Ignore parse errors
      }
    }

    return () => eventSource.close()
  }, [municipalityCode])

  const handleTrigger = useCallback(async () => {
    setTriggering(true)
    try {
      await fetch("/api/trigger", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ municipalityCode }),
      })
    } finally {
      setTriggering(false)
    }
  }, [municipalityCode])

  // Group posts: parent posts with their replies
  const parentPosts = allPosts.filter((p) => !p.parentPostId)
  const repliesByParent = new Map<string, PostData[]>()
  for (const post of allPosts) {
    if (post.parentPostId) {
      const replies = repliesByParent.get(post.parentPostId) ?? []
      replies.push(post)
      repliesByParent.set(post.parentPostId, replies)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">{allPosts.length}件の投稿</p>
        <button
          onClick={handleTrigger}
          disabled={triggering}
          className="px-4 py-2 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
        >
          {triggering ? "実行中..." : "手動実行"}
        </button>
      </div>

      <div className="space-y-3">
        {parentPosts.map((post) => (
          <div key={post.id}>
            <PostCard post={post} />
            {repliesByParent.get(post.id)?.map((reply) => (
              <div key={reply.id} className="mt-2">
                <PostCard post={reply} isReply />
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
