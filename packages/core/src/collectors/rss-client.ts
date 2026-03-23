import RSSParser from "rss-parser"
import { randomUUID } from "node:crypto"
import { z } from "zod"
import { getDb } from "../db/connection"
import { news } from "../db/schema"
import type { News } from "../llm/provider"

const parser = new RSSParser()

const NewsItemSchema = z.object({
  title: z.string().min(1),
  link: z.string().url(),
  pubDate: z.string().optional(),
  source: z.string().optional(),
})

export class RssClient {
  async fetchNews(
    municipalityCode: string,
    municipalityName: string,
    maxItems = 5,
    prefecture?: string
  ): Promise<News[]> {
    // 1. Google News RSS（市区町村名 + 都道府県名で地域ニュースを検索）
    const searchQuery = prefecture
      ? `${prefecture} ${municipalityName}`
      : municipalityName
    const googleNews = await this.fetchGoogleNews(searchQuery, maxItems)
    if (googleNews.length > 0) {
      return this.saveAndReturn(googleNews, municipalityCode, maxItems)
    }

    // 2. NHK地域ニュース
    const nhkNews = await this.fetchNhkRegionalNews(prefecture, maxItems)
    if (nhkNews.length > 0) {
      return this.saveAndReturn(nhkNews, municipalityCode, maxItems)
    }

    // 3. フォールバック: ダミーニュース
    return this.loadDummyNews(municipalityCode, municipalityName, prefecture, maxItems)
  }

  private async fetchGoogleNews(
    searchQuery: string,
    maxItems: number
  ): Promise<News[]> {
    try {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(searchQuery)}&hl=ja&gl=JP&ceid=JP:ja`
      const feed = await parser.parseURL(url)
      return this.parseRssFeed(feed, "Google News", maxItems)
    } catch {
      return []
    }
  }

  private async fetchNhkRegionalNews(
    prefecture: string | undefined,
    maxItems: number
  ): Promise<News[]> {
    // NHKの都道府県別RSSは /rss/news/cat{N}.xml 形式
    // 地域ニュース全般: cat1=社会, cat3=科学・医療, cat5=ビジネス, cat7=地域
    const urls = [
      "https://www.nhk.or.jp/rss/news/cat7.xml", // 地域ニュース
      "https://www.nhk.or.jp/rss/news/cat1.xml", // 社会ニュース
    ]

    for (const rssUrl of urls) {
      try {
        const feed = await parser.parseURL(rssUrl)
        // 都道府県名でフィルタ
        if (prefecture) {
          const filtered = {
            ...feed,
            items: feed.items.filter((item) =>
              item.title?.includes(prefecture) ||
              item.title?.includes(prefecture.replace(/[都府県]$/, ""))
            ),
          }
          if (filtered.items.length > 0) {
            return this.parseRssFeed(filtered, "NHK", maxItems)
          }
        }
        return this.parseRssFeed(feed, "NHK", maxItems)
      } catch {
        continue
      }
    }
    return []
  }

  private parseRssFeed(
    feed: RSSParser.Output<Record<string, unknown>>,
    source: string,
    maxItems: number
  ): News[] {
    const items: News[] = []
    const now = Math.floor(Date.now() / 1000)

    for (const item of feed.items.slice(0, maxItems)) {
      const parsed = NewsItemSchema.safeParse({
        title: item.title,
        link: item.link,
        pubDate: item.pubDate,
        source,
      })

      if (!parsed.success) continue

      items.push({
        id: randomUUID(),
        municipalityCode: null,
        title: parsed.data.title,
        url: parsed.data.link,
        source,
        publishedAt: parsed.data.pubDate
          ? Math.floor(new Date(parsed.data.pubDate).getTime() / 1000)
          : null,
        fetchedAt: now,
      })
    }

    return items
  }

  private async loadDummyNews(
    municipalityCode: string,
    municipalityName: string,
    prefecture: string | undefined,
    maxItems: number
  ): Promise<News[]> {
    const now = Math.floor(Date.now() / 1000)
    const area = prefecture ? `${prefecture}${municipalityName}` : municipalityName

    const dummyItems = [
      { title: `${area}で地域イベントが開催予定`, url: `dummy://local-event-${municipalityCode}-${now}`, source: "ダミー" },
      { title: `${area}の商店街が活性化プロジェクトを発表`, url: `dummy://shopping-${municipalityCode}-${now}`, source: "ダミー" },
      { title: `${area}で新しい公園がオープン`, url: `dummy://park-${municipalityCode}-${now}`, source: "ダミー" },
      { title: `${area}の学校で特色ある教育プログラムが話題`, url: `dummy://education-${municipalityCode}-${now}`, source: "ダミー" },
      { title: `${area}で地産地消マルシェが盛況`, url: `dummy://marche-${municipalityCode}-${now}`, source: "ダミー" },
    ]

    return dummyItems.slice(0, maxItems).map((item) => ({
      id: randomUUID(),
      municipalityCode,
      title: item.title,
      url: item.url,
      source: item.source,
      publishedAt: now,
      fetchedAt: now,
    }))
  }

  private async saveAndReturn(
    items: News[],
    municipalityCode: string,
    maxItems: number
  ): Promise<News[]> {
    const db = getDb()
    const saved: News[] = []

    for (const item of items.slice(0, maxItems)) {
      const newsItem = { ...item, municipalityCode }
      try {
        await db.insert(news).values({
          id: newsItem.id,
          municipalityCode: newsItem.municipalityCode,
          title: newsItem.title,
          url: newsItem.url,
          source: newsItem.source,
          publishedAt: newsItem.publishedAt,
          fetchedAt: newsItem.fetchedAt,
        }).onConflictDoNothing()
        saved.push(newsItem)
      } catch {
        // URL重複の場合はスキップ
      }
    }

    return saved
  }
}
