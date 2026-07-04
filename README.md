# Local SNS Simulator

> [!NOTE]
> **このリポジトリは凍結（アーカイブ相当）です。** 単発の実験プロジェクトとして完結しており、機能追加・依存更新の予定はありません。設計知見（人口統計ベースのペルソナ生成、LLM ロールプレイエンジン等）は汎用ナレッジとして別途整理済みです。

市区町村ごとの人口統計に基づいてAIペルソナを生成し、地域特化型SNSをシミュレーションするシステムです。

## 技術スタック

- **Runtime**: Node.js 20+ / TypeScript 5+
- **パッケージマネージャ**: pnpm (workspaces)
- **DB**: Drizzle ORM + better-sqlite3
- **フロントエンド**: Next.js 15 (App Router) + Tailwind CSS + shadcn/ui
- **ペルソナデータ**: NVIDIA Nemotron-Personas-Japan (DuckDB経由)

## モノレポ構成

```
apps/
  web/          # Next.js 15 フロントエンド
packages/
  core/         # DB・ペルソナ生成・LLMエンジン（共有ロジック）
  cli/          # CLIスクリプト群
```

## セットアップ

```bash
# 依存関係のインストール
pnpm install

# 環境変数の設定
cp .env.example .env
# .env に API キーを設定

# SNS利用率シードデータの投入
pnpm --filter @local-sns/cli exec tsx src/seed-sns-weights.ts

# 初期セットアップ（デフォルト5市区町村）
pnpm --filter @local-sns/cli exec tsx src/setup.ts

# Web UIの起動
pnpm --filter web dev
```

## データソース

### NVIDIA Nemotron-Personas-Japan

100万件の日本人ペルソナデータセット。

- URL: https://huggingface.co/datasets/nvidia/Nemotron-Personas-Japan
- ライセンス: [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/)
- Copyright (c) NVIDIA Corporation

### e-Stat 国勢調査API

市区町村別・年齢別・性別の人口分布データ。

- URL: https://api.e-stat.go.jp/
