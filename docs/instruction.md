## SNSシミュレーション 完全版 Claude Code指示

---

### 💡 最初の一手

```
以下の仕様でTypeScript製・地域特化型SNSシミュレーションシステムを構築してください。
まずプロジェクトの初期化から始め、指示通りの順番で実装を進めてください。

## プロジェクト概要
市区町村ごとの人口統計に基づいてAIペルソナを生成し、
地域特化型SNSをシミュレーションするシステムです。
NVIDIAのNemotron-Personas-Japanデータセット（100万件の日本人ペルソナ）を活用します。

## 技術スタック（全てTypeScriptで統一）
- Runtime: Node.js 20+ / TypeScript 5+
- パッケージマネージャ: pnpm (workspaces使用)
- DB: Drizzle ORM + better-sqlite3
- HTTP: fetch (native)
- バリデーション: zod
- 環境変数: dotenv
- スクリプト実行: tsx
- フロントエンド: Next.js 15 (App Router) + Tailwind CSS + shadcn/ui
- チャート: Recharts
- Parquetクエリ: duckdb-async

## モノレポ構成（pnpm workspaces）
apps/
  web/          # Next.js 15 フロントエンド
packages/
  core/         # DB・ペルソナ生成・LLMエンジン（共有ロジック）
  cli/          # CLIスクリプト群

## 実施内容
1. pnpm workspacesの設定（ルートpackage.json）
2. packages/coreのtsconfig・package.json初期化
3. Drizzle ORM + better-sqlite3のセットアップ
4. zodを使った環境変数バリデーション（packages/core/src/config/env.ts）
5. 全テーブルのDrizzleスキーマ定義（後述）
6. src/config/municipalities.ts にデフォルト市区町村定数を定義
7. README.mdの作成（プロジェクト概要・セットアップ手順・Nemotronデータセット帰属表示）

その後、Phase 1から順番に実装を進めてください。

## 必要な環境変数（.env.example も作成）
ESTAT_API_KEY=          # e-Stat API キー
ANTHROPIC_API_KEY=      # Anthropic API キー
LLM_PROVIDER=anthropic  # "anthropic" | "kimi" | "glm"
KIMI_API_KEY=           # optional
GLM_API_KEY=            # optional
PERSONA_DETAIL_MODE=full # "full" | "light"
```

---

### 🗂 Phase 1: データ収集とDB構築

```
Phase 1として、以下の2種類のデータソースからデータを収集・保存する
仕組みを実装してください。

## データソース

### A. Nemotron-Personas-Japan（NVIDIAが公開する100万件の日本人ペルソナ）
- URL: https://huggingface.co/datasets/nvidia/Nemotron-Personas-Japan
- 形式: Parquet
- ライセンス: CC BY 4.0
- 取得方針: 全件ダウンロードは行わず、duckdb-asyncでHuggingFaceの
  リモートParquetを直接クエリし、必要分だけSQLiteにキャッシュする

### B. e-Stat 国勢調査API
- URL: https://api.e-stat.go.jp/
- 市区町村別・年齢別・性別の人口分布取得用
- APIキーは.envで管理（ESTAT_API_KEY）

## デフォルト市区町村の定義
packages/core/src/config/municipalities.ts に以下を定義:

export const DEFAULT_MUNICIPALITIES = [
  { code: "131030", name: "中央区", prefecture: "東京都", region: "関東地方" },
  { code: "131105", name: "目黒区", prefecture: "東京都", region: "関東地方" },
  { code: "112348", name: "所沢市", prefecture: "埼玉県", region: "関東地方" },
  { code: "041009", name: "仙台市", prefecture: "宮城県", region: "東北地方" },
  { code: "271047", name: "北区",   prefecture: "大阪府", region: "近畿地方" },
] as const

export const DEFAULT_PERSONA_COUNT = 100

## Drizzle ORM スキーマ定義
packages/core/src/db/schema.ts に以下の6テーブルを定義:

### timelines テーブル（市区町村タイムライン管理）
{
  municipalityCode: text (primary key),
  municipalityName: text,
  prefecture: text,
  region: text,
  personaCount: integer (default: 100),
  status: text,  // "active" | "paused" | "initializing"
  addedAt: integer,        // Unix timestamp
  lastActivityAt: integer
}

### demographics テーブル（e-Statから取得した人口統計）
{
  id: integer (primary key autoincrement),
  municipalityCode: text,
  municipalityName: text,
  prefecture: text,
  ageGroup: text,    // "0-4", "5-9", ..., "85+"
  sex: text,         // "male" | "female"
  population: integer,
  year: integer
}

### sns_activity_weights テーブル（総務省白書ベースのSNS利用率）
{
  ageGroup: text,    // "10代", "20代", ..., "70代以上"
  platform: text,    // "general"（全SNS統合の利用率として定義）
  usageRate: real    // 0.0 〜 1.0
}

### nemotron_cache テーブル（リモートParquetから取得済みのペルソナキャッシュ）
{
  uuid: text (primary key),
  professionalPersona: text,
  sportsPersona: text,
  artsPersona: text,
  travelPersona: text,
  culinaryPersona: text,
  persona: text,             // 総合サマリー（LLMプロンプトのメイン素材）
  culturalBackground: text,
  skillsList: text,          // JSON配列として保存
  hobbiesList: text,         // JSON配列として保存
  careerGoals: text,
  sex: text,                 // "男" | "女"
  age: integer,
  maritalStatus: text,
  educationLevel: text,
  occupation: text,
  region: text,
  area: text,
  prefecture: text,
  cachedAt: integer          // Unix timestamp
}

### sim_personas テーブル（シミュレーション用ペルソナ）
{
  id: text (primary key, UUID v4),
  nemotronUuid: text,            // nemotron_cacheのuuid
  municipalityCode: text,
  municipalityName: text,
  name: text,                    // 別途生成した日本語名
  sex: text,
  age: integer,
  maritalStatus: text,
  educationLevel: text,
  occupation: text,
  prefecture: text,
  region: text,
  persona: text,
  professionalPersona: text,
  culturalBackground: text,
  skillsList: text,              // JSON配列
  hobbiesList: text,             // JSON配列
  snsActivityLevel: text,        // "high" | "medium" | "low" | "inactive"
  createdAt: integer
}

### posts テーブル（投稿）
{
  id: text (primary key, UUID v4),
  personaId: text,
  municipalityCode: text,
  content: text,
  parentPostId: text,            // null = 新規投稿, 値あり = リプライ
  newsId: text,                  // きっかけになったニュース
  createdAt: integer
}

### news テーブル（ニュースフィード）
{
  id: text (primary key, UUID v4),
  municipalityCode: text,
  title: text,
  url: text (unique),
  source: text,
  publishedAt: integer,
  fetchedAt: integer
}

### error_logs テーブル
{
  id: integer (primary key autoincrement),
  phase: text,
  municipalityCode: text,
  message: text,
  createdAt: integer
}

## インデックス設計（マッチング高速化のため必須）
- nemotron_cache(prefecture, sex, age) の複合インデックス
- nemotron_cache(region, sex) のインデックス
- sim_personas(municipalityCode) のインデックス
- posts(municipalityCode, createdAt) のインデックス
- posts(parentPostId) のインデックス

## NemotronPersonaFetcherクラスの実装
packages/core/src/collectors/nemotron-fetcher.ts

class NemotronPersonaFetcher {
  // キャッシュ優先でペルソナを1件取得
  async findMatch(params: {
    age: number
    sex: string       // "男" | "女"
    prefecture: string
    excludeUuids?: string[]  // 重複使用防止
  }): Promise<NemotronPersona | null>

  // 1. SQLiteキャッシュから検索（age±5歳の範囲）
  private async findFromCache(params): Promise<NemotronPersona | null>

  // 2. DuckDBでHuggingFaceのリモートParquetを直接クエリ
  //    候補を10件取得してローカルでランダム選択
  private async fetchFromRemote(params): Promise<NemotronPersona | null>
  // クエリ例:
  // SELECT * FROM read_parquet(
  //   'https://huggingface.co/datasets/nvidia/Nemotron-Personas-Japan/resolve/refs%2Fconvert%2Fparquet/default/train/*.parquet'
  // )
  // WHERE prefecture = ? AND sex = ? AND age BETWEEN ? AND ?
  // ORDER BY RANDOM() LIMIT 10

  // 3. 都道府県一致なければ同地方(region)で代替
  private async fallbackByRegion(params): Promise<NemotronPersona | null>

  // 取得したレコードをキャッシュに保存
  private async saveToCache(persona: NemotronPersona): Promise<void>
}

## e-Stat APIクライアントの実装
packages/core/src/collectors/estat-client.ts

class EStatClient {
  // 市区町村コードを指定して年齢別・性別人口を取得
  async fetchDemographics(municipalityCode: string): Promise<DemographicRecord[]>
}

## SNS利用率シードデータ
packages/core/src/db/seeds/sns-weights.ts に
総務省令和7年版情報通信白書の数値を元に以下を定義（概算値で可）:
10代: 0.70, 20代: 0.85, 30代: 0.80, 40代: 0.72,
50代: 0.58, 60代: 0.40, 70代以上: 0.22

## CLIスクリプト
packages/cli/src/setup.ts
  → 全フローを順番に実行するセットアップスクリプト

packages/cli/src/warmup-cache.ts --prefecture 東京都 --count 300
  → 特定都道府県分を事前にまとめてキャッシュしたい場合のみ使用（オプション）

packages/cli/src/seed-sns-weights.ts
  → SNS利用率の初期データ投入

## setup.ts の実行イメージ
$ tsx packages/cli/src/setup.ts

🏙  タイムラインを初期化中...

[1/5] 東京都中央区 (131030)
  → e-Stat: 人口統計を取得中... ✓
  → Nemotron: 100人分をマッチング中... ✓ (キャッシュ 0件 / リモート取得 100件)
  → ペルソナ年齢分布: 20代9人 / 30代18人 / 40代22人 / 50代21人 / 60代+30人

[2/5] 東京都目黒区 (131105)
  → e-Stat: 人口統計を取得中... ✓
  → Nemotron: 100人分をマッチング中... ✓ (キャッシュ 87件 / リモート取得 13件)
  ...

✅ セットアップ完了 (所要時間: 約3分)
   タイムライン数: 5 / 総ペルソナ数: 500
```

---

### 👤 Phase 2: ペルソナ生成エンジン

```
Phase 2として、人口統計とNemotronデータを組み合わせた
ペルソナ生成エンジンを実装してください。

## 設計方針
「ペルソナをゼロからLLMで生成する」のではなく
「e-Statの人口分布でサンプリングした属性に合うNemotronレコードを選ぶ」設計です。

## zod スキーマ定義
packages/core/src/personas/schema.ts

const SimPersonaSchema = z.object({
  id: z.string().uuid(),
  nemotronUuid: z.string(),
  municipalityCode: z.string().length(6),
  municipalityName: z.string(),
  name: z.string(),
  sex: z.enum(["男", "女"]),
  age: z.number().int().min(0).max(100),
  maritalStatus: z.string(),
  educationLevel: z.string(),
  occupation: z.string(),
  prefecture: z.string(),
  region: z.string(),
  persona: z.string(),
  professionalPersona: z.string(),
  culturalBackground: z.string(),
  skillsList: z.array(z.string()),
  hobbiesList: z.array(z.string()),
  snsActivityLevel: z.enum(["high", "medium", "low", "inactive"]),
  createdAt: z.number()
})

## PersonaGeneratorクラス
packages/core/src/personas/generator.ts

class PersonaGenerator {
  // 指定市区町村のN人分ペルソナを生成
  async generate(
    municipalityCode: string,
    count: number,
    onProgress?: (current: number, total: number) => void
  ): Promise<SimPersona[]>

  // e-Statの人口分布から年齢・性別を重み付きサンプリング
  private sampleDemographics(
    records: DemographicRecord[],
    count: number
  ): Array<{ age: number; sex: string }>

  // SNS利用率に基づいてsnsActivityLevelを決定
  private determineSnsActivity(age: number): SnsActivityLevel

  // 生成済みペルソナをDBに保存
  async save(personas: SimPersona[]): Promise<void>
}

## 名前生成ユーティリティ
packages/core/src/personas/name-generator.ts
- 姓リスト（上位500姓）・名リスト（男女別各300名）を
  packages/core/src/data/names.json に配置
- 性別に対応してランダム生成
- シミュレーション内での重複チェック付き

## SNS利用率とsnsActivityLevelの対応
年代別利用率を参照してsnsActivityLevelを決定:
- 利用率 > 0.6 かつ random < 0.4 → "high"
- 利用率 > 0.6 かつ random < 0.8 → "medium"
- 利用率 > 0.6               → "low"
- 利用率 <= 0.6 かつ random < 利用率 → "low"
- それ以外                   → "inactive"
※inactiveのペルソナはDBには保存するが投稿生成には使わない

## CLIコマンド
tsx packages/cli/src/generate-personas.ts \
  --municipality 131030 --count 100

# 出力例
✓ 人口統計をロード: 東京都中央区 (131030)
✓ SNS利用率フィルタ適用後: 100人中 68人がSNS利用者
✓ Nemotronマッチング完了: 68/68件
✓ DBに保存完了
  年齢分布: 20代9人 / 30代18人 / 40代22人 / 50代10人 / 60代+9人
  activity: high 15人 / medium 28人 / low 25人 / inactive 32人
```

---

### 🤖 Phase 3: LLMロールプレイエンジン

```
Phase 3として、ペルソナがSNSに投稿・反応するための
LLMロールプレイエンジンを実装してください。

## LLMProvider インターフェース
packages/core/src/llm/provider.ts

interface LLMProvider {
  generatePost(persona: SimPersona, topic: string): Promise<string>
  generateReply(persona: SimPersona, originalPost: Post): Promise<string>
}

## 実装クラス
- AnthropicProvider (@anthropic-ai/sdk使用)
- KimiProvider (openaiパッケージ + Kimi互換エンドポイント)
- GlmProvider (openaiパッケージ + GLM互換エンドポイント)

.envのLLM_PROVIDERで切替。
LLMProviderFactory.create() で対応するクラスを返す。

## プロンプト設計
packages/core/src/llm/prompt-templates.ts

PERSONA_DETAIL_MODE=full の場合のシステムプロンプト:
---
あなたは以下のペルソナとして、地域SNSに投稿します。

【基本情報】
名前: {name} / {age}歳 / {sex} / {prefecture}{municipalityName}在住
職業: {occupation} / 学歴: {educationLevel} / {maritalStatus}

【あなたの人物像】
{persona}

【文化的背景】
{culturalBackground}

【スキル・専門知識】
{skillsList}

【趣味・関心】
{hobbiesList}

【投稿ルール】
- 50〜140文字の自然な口語体で投稿してください
- 年齢・職業・地域性に合ったトーンで
- ハッシュタグは0〜2個まで
- 投稿文のみを返し、前置きや説明は不要
---

PERSONA_DETAIL_MODE=light の場合:
persona と culturalBackground のみ使用（トークン約60%削減）

## PostGeneratorクラス
packages/core/src/llm/post-generator.ts

class PostGenerator {
  constructor(private provider: LLMProvider) {}

  // ニュース記事をトピックに新規投稿を生成
  async generatePost(persona: SimPersona, news: News): Promise<Post>

  // 既存投稿へのリプライを生成
  async generateReply(persona: SimPersona, parentPost: Post): Promise<Post>

  // 生成した投稿をDBに保存
  async save(post: Post): Promise<void>
}

## 安定性・コスト対策
- p-limit で並列LLM呼び出しを最大3件に制限
- p-retry で失敗時に最大3回リトライ（exponential backoff）
- 失敗した場合はerror_logsテーブルに記録してスキップ
```

---

### 📰 Phase 4: ニュースフィードと自動反応パイプライン

```
Phase 4として、地域ニュースを取得しペルソナが自動反応する
パイプラインを実装してください。

## ニュースソース（優先順）
1. NHK地域ニュース RSSフィード（都道府県別）
   https://www.nhk.or.jp/rss/news/cat[N].xml
2. Google News RSS（市区町村名で検索）
   https://news.google.com/rss/search?q={市区町村名}&hl=ja&gl=JP&ceid=JP:ja
3. フォールバック: packages/core/src/data/dummy-news.json
   （デバッグ・オフライン用のダミーニュース10件を市区町村ごとに定義）

## RSSパーサ
rss-parser パッケージを使用。
NewsSchema（zod）でバリデーション後、newsテーブルに保存（URL重複除去）。

## パイプラインの実行フロー
packages/core/src/pipeline/runner.ts

async function runPipeline(municipalityCode: string): Promise<void>

1. RSSからニュースを最大5件取得 → newsテーブルに保存（重複スキップ）
2. 新着ニュース1件をランダムに選択
3. そのタイムラインのsns_activityがhigh/medium/lowのペルソナから
   snsActivityLevelの重み付きで5〜15人をサンプリング
   （high: 重み3 / medium: 重み2 / low: 重み1）
4. サンプリングされたペルソナがLLMで新規投稿を生成
5. 各投稿に対して30%の確率で別ペルソナがリプライを生成（最大2件/投稿）
6. 全投稿をpostsテーブルに保存
7. timelinesのlastActivityAtを更新

## スケジューリング
packages/cli/src/scheduler.ts

node-cronで全アクティブタイムラインを対象に
30分ごとに runPipeline を順番に実行。

## 手動トリガーCLI
tsx packages/cli/src/trigger.ts --municipality 131030
tsx packages/cli/src/trigger.ts --all  # 全タイムライン実行

## エラーハンドリング
- 各ステップをtry/catchで囲み、失敗してもパイプライン全体が止まらない
- 失敗内容はerror_logsテーブルに記録
```

---

### 🌐 Phase 5: Web UI

```
Phase 5として、シミュレーション結果を確認するWebUIを
Next.js 15 App Routerで実装してください。

## 技術スタック
- フレームワーク: Next.js 15 (App Router)
- スタイリング: Tailwind CSS + shadcn/ui
- チャート: Recharts
- DBアクセス: packages/coreのDrizzle ORMを共有

## API Routes

GET  /api/timelines
  → timelinesテーブルの全件 + 各タイムラインの直近24h投稿数

POST /api/timelines
  リクエスト: {
    municipalityCode: string,  // 6桁
    municipalityName: string,
    prefecture: string,
    personaCount?: number      // default: 100, range: 10〜500
  }
  レスポンス: { success: true, timeline: Timeline, personas: { total, snsActive } }
  エラー: { success: false, error: "DUPLICATE_MUNICIPALITY" | "INVALID_CODE" | "ESTAT_FETCH_FAILED" }

GET  /api/timelines/[municipalityCode]/init-progress  (SSE)
  タイムライン追加時の初期化進捗をSSEで配信:
  event: progress
  data: { step: "estat" | "nemotron", message: string, percent: number }
  event: complete
  data: { personas: number, snsActive: number }
  event: error
  data: { code: string, message: string }

GET  /api/posts?municipalityCode=xxx&limit=50&before=timestamp
  → 指定タイムラインの投稿一覧（ページネーション付き）
  → 各投稿にペルソナ情報（name, age, occupation）をJOIN

GET  /api/posts/stream?municipalityCode=xxx  (SSE)
  → 新着投稿をリアルタイムで配信

GET  /api/personas?municipalityCode=xxx
  → ペルソナ一覧 + 年齢・性別分布の集計値

POST /api/trigger
  リクエスト: { municipalityCode: string }
  → パイプラインを手動実行

## ページ構成

### / (トップページ)
- デフォルト5市区町村のカード一覧（shadcn/ui Card使用）
- 各カードに表示:
  - 市区町村名・都道府県
  - アクティブペルソナ数 / 総ペルソナ数
  - 直近24h投稿数
  - statusバッジ (active / initializing / paused)
  - 「タイムラインを見る」ボタン
- 「＋ タイムラインを追加」ボタン（右上）

### タイムライン追加モーダル（shadcn/ui Dialog）
「＋ タイムラインを追加」押下で表示:
- 市区町村コード入力（6桁）
- 市区町村名・都道府県（自動入力 or 手動補完）
- ペルソナ数スライダー（10〜500、デフォルト100）
- 「追加する」ボタン → POST /api/timelines
- 追加中はEventSourceで /api/timelines/[code]/init-progress を購読し
  shadcn/ui Progressでリアルタイム進捗表示

### /[municipalityCode] (タイムラインページ)
- 市区町村名ヘッダー + 「手動実行」ボタン
- 投稿フィード（EventSourceで /api/posts/stream を購読しリアルタイム更新）
- 各投稿カード:
  - ペルソナ名・年齢・職業
  - 投稿本文
  - 投稿時刻（相対表示: "3分前"）
  - リプライはスレッド形式でインデント表示

### /[municipalityCode]/personas (ペルソナ一覧ページ)
- ペルソナカード一覧
- 年齢分布グラフ（Recharts BarChart）
- 性別・SNS活動レベルの内訳（Recharts PieChart）

## コンポーネント（shadcn/ui使用）
- Card: 市区町村カード・投稿カード
- Dialog: タイムライン追加モーダル
- Badge: statusバッジ・snsActivityLevelバッジ
- Progress: 初期化進捗バー
- Slider: ペルソナ数選択
- Button, Input, Label: フォーム要素
```

---

### 📋 実装順序まとめ

```
以下の順番で実装を進めてください。

[Phase 1]
1. プロジェクト初期化（モノレポ・tsconfig・package.json群）
2. Drizzleスキーマ定義（全8テーブル）
3. municipalities.ts にDEFAULT_MUNICIPALITIES定数定義
4. env.ts に環境変数バリデーション実装
5. EStatClientの実装
6. NemotronPersonaFetcherの実装（DuckDBハイブリッドキャッシュ方式）
7. seed-sns-weights.ts の実装
8. setup.ts の実装（デフォルト5市区町村の一括初期化）

[Phase 2]
9.  names.json の作成（姓500件・男女別名前300件ずつ）
10. NameGeneratorの実装
11. PersonaGeneratorの実装
12. generate-personas.ts CLIの実装

[Phase 3]
13. LLMProviderインターフェースとAnthropicProviderの実装
14. KimiProvider・GlmProviderの実装
15. プロンプトテンプレートの実装（full/lightモード）
16. PostGeneratorの実装

[Phase 4]
17. RSSクライアントの実装
18. パイプラインrunnerの実装
19. trigger.ts CLIの実装
20. scheduler.ts の実装（node-cron）

[Phase 5]
21. Next.jsプロジェクト初期化（apps/web）
22. 全API Routesの実装
23. トップページ（市区町村カード一覧・追加モーダル）
24. タイムラインページ（投稿フィード・SSEリアルタイム更新）
25. ペルソナ一覧ページ（グラフ付き）

まずPhase 1の1番から着手してください。
```
