import { NextResponse, type NextRequest } from "next/server"

interface OgpData {
  title: string
  description: string
  image: string | null
  siteName: string | null
}

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url")

  if (!url || url.startsWith("dummy://")) {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 })
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; LocalSNSBot/1.0)",
        Accept: "text/html",
      },
      signal: AbortSignal.timeout(5000),
    })

    if (!response.ok) {
      return NextResponse.json({ error: "Fetch failed" }, { status: 502 })
    }

    const html = await response.text()
    const ogp = parseOgp(html, url)

    return NextResponse.json(ogp, {
      headers: {
        "Cache-Control": "public, max-age=3600",
      },
    })
  } catch {
    return NextResponse.json({ error: "Failed to fetch OGP" }, { status: 502 })
  }
}

function parseOgp(html: string, url: string): OgpData {
  const getMetaContent = (property: string): string | null => {
    // og:xxx or twitter:xxx
    const regex = new RegExp(
      `<meta[^>]*(?:property|name)=["']${property}["'][^>]*content=["']([^"']*)["']|<meta[^>]*content=["']([^"']*)["'][^>]*(?:property|name)=["']${property}["']`,
      "i"
    )
    const match = html.match(regex)
    return match ? (match[1] ?? match[2] ?? null) : null
  }

  const getTitle = (): string => {
    const ogTitle = getMetaContent("og:title")
    if (ogTitle) return ogTitle

    const titleMatch = html.match(/<title[^>]*>([^<]*)<\/title>/i)
    return titleMatch ? titleMatch[1].trim() : new URL(url).hostname
  }

  return {
    title: getTitle(),
    description: getMetaContent("og:description") ?? getMetaContent("description") ?? "",
    image: getMetaContent("og:image"),
    siteName: getMetaContent("og:site_name"),
  }
}
