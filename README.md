# GA4 Analytics Dashboard

Google Analytics 4 のデータを分析し、ABテスト・ファネル分析・ヒートマップ分析を行うダッシュボードです。

---

## 機能

- **GA4データ分析**: GA4 API からデータ取得、レポート生成
- **ABテスト分析**: 統計的有意性計算、AI評価、スケジュール実行
- **ファネル分析**: エントリーフォームファネル、期間比較、Gemini 評価
- **ヒートマップ分析**: view ラベルベースのゾーン可視化（クリック・スクロール深度）
- **プロダクト別分析**: 複数プロダクトのデータを分離して管理

---

## 技術スタック

| 項目 | 内容 |
|------|------|
| フレームワーク | Next.js 16（App Router）、React 19 |
| 言語 | TypeScript |
| DB | PostgreSQL + Prisma |
| キャッシュ・キュー | Redis |
| スタイル | **CSS Modules**（`[ComponentName].module.css`。Tailwind は使用しない） |
| グラフ | Recharts |

---

## セットアップ

### 方法 A: Docker で全体を起動（推奨・本番同様）

1. **環境変数**（compose 用に `.env` が必要。中身は任意）

   ```bash
   cp .env.example .env
   # または空でよい場合: touch .env
   # .env を編集（GA4・Gemini・Slack 等）。DATABASE_URL / REDIS_URL は compose で自動設定される。
   # GA4: ローカルで KEY_PATH で動いていた場合、同じファイルをプロジェクト直下に service-account-key.json として置く（docker-compose でコンテナにマウント済み）。別名で置いている場合は同じパスにコピーするか、GA4_SERVICE_ACCOUNT_KEY に JSON を 1 行で設定。
   ```

2. **ビルドと起動（ローカル・ポート競合を避ける場合）**

   ```bash
   docker-compose -f docker-compose.local.yml up -d --build
   ```

   - **postgres** (5432) / **redis** (6380) / **app** (3003) / **scheduler** が起動する（ポート 80 は使わない）。
   - **app** は開発モード（`npm run dev`）で動作し、**ソースをマウントしているためコード・CSS の変更は保存すると自動で反映**されます（ビルドのやり直しは不要）。初回起動時のみコンテナ内で `npm ci` が走るため、少し時間がかかります。
   - 初回は app 起動時に `prisma migrate deploy` が自動実行される。
   - **app が一覧にない・すぐ落ちる場合**: `docker-compose -f docker-compose.local.yml logs app` でエラーを確認。`service-account-key.json` が無いときは `touch service-account-key.json` で空ファイルを用意しておく（GA4 未使用なら中身は不要）。

   本番用にポート 80 で起動する場合は `docker-compose up -d --build`（要: ポート 80 が空いていること）。

3. ブラウザで [http://localhost:3003](http://localhost:3003) を開く。

**Docker 構成**: `docker-compose.local.yml` 単体で **postgres** / **redis** / **app**（Next.js、ホスト 3003）/ **scheduler**（ABテストスケジュール実行、任意）の 4 サービス。scheduler は使うときだけ `docker-compose up -d` で起動し、不要なら `docker-compose up -d postgres redis app` で app のみ起動できる。app と scheduler は同一イメージを利用し、scheduler は app の `/api/ab-test/execute` を内部で呼び出す。Slack 通知の「詳細を見る」リンク・ドメイン・ポート、および OAuth2 リダイレクト URI は `.env` の **APP_URL**（または NEXT_PUBLIC_APP_URL）で指定する（例: Docker で 3003 なら `APP_URL=http://localhost:3003`、本番なら `APP_URL=https://your-domain.com`）。未設定時は `http://localhost:3003`（開発用）が使われる。

### 方法 B: ローカルでアプリのみ（開発用）

1. **依存関係**

   ```bash
   npm install
   ```

2. **環境変数**

   ```bash
   cp .env.example .env.local
   # .env.local を編集（DATABASE_URL, REDIS_URL をローカル用に）
   ```

3. **DB・Redis だけ Docker**（app は npm で動かす場合）

   ```bash
   docker-compose -f docker-compose.local.yml up -d postgres redis
   npm run db:generate
   npm run db:migrate
   ```

4. **起動**

   ```bash
   npm run dev
   ```

   ブラウザで [http://localhost:3000](http://localhost:3000) を開く。

---

## 開発

### ディレクトリ構造

```
app/              # Next.js App Router（api, 各ページ）
components/       # 共有コンポーネント（機能別）
lib/              # API クライアント・services・utils
workers/          # バックグラウンドワーカー（ABテストスケジューラー等）
prisma/           # スキーマ・マイグレーション
```

### スクリプト

| コマンド | 説明 |
|----------|------|
| `npm run dev` | 開発サーバー |
| `npm run build` / `npm run start` | 本番ビルド・起動 |
| `npm run db:migrate` | マイグレーション |
| `npm run db:generate` | Prisma クライアント生成 |
| `npm run worker` | バックグラウンドワーカー（現状は scheduler を読み込む） |
| `npm run scheduler` | ABテストスケジューラー（スケジュール実行を使うときだけ起動。Docker では任意） |

### 型・スタイルの運用

- **型**: 全体は `types.ts`（ルート）、ページ/コンポーネント固有は `app/[feature]/types.ts` や `components/[feature]/types.ts`
- **スタイル**: 必ず CSS Modules（`*.module.css`）。Tailwind クラスは直接書かない。ダークモードは `@media (prefers-color-scheme: dark)` で対応。
- **コメント**: 自明なコメント・デバッグ用 `console.log` は削除。必要な説明は JSDoc。
- **整理状況**: デバッグ用UI・不要コードの削除と、Docker 移行・GA4 認証・スケジュール JST・Link prefetch 無効化・preload 注意書きなどのリファクタは完了済み。`console.error` はエラー調査用として API/サービス層にのみ残している。

### 開発時のコンソール警告（preload）

「The resource ... was preloaded using link preload but not used within a few seconds」は Next.js App Router が CSS チャンクを preload する際にブラウザが出す**既知の警告**です（[vercel/next.js#51524](https://github.com/vercel/next.js/issues/51524)）。動作には影響しないため無視してよいです。気になる場合は DevTools の Console で「preload」をフィルタ除外してください。フォント preload は `app/layout.tsx` で無効化済み、リンクの prefetch は `@/components/Link` で無効化済みです。

---

## DB 設計

スキーマ: `prisma/schema.prisma`。

### エンティティ一覧

| テーブル | 役割 |
|----------|------|
| **products** | プロダクト（GA4 プロパティ紐付け） |
| **page_cv_configs** | ページ別 CV イベント設定（ダッシュボード用） |
| **reports** | レポート定義（トレンド・AB 用） |
| **report_executions** | レポート実行履歴・結果 |
| **ab_tests** | ABテスト定義・勝者・改善率等 |
| **ab_test_report_executions** | ABテスト実行履歴 |
| **funnel_configs** | ファネル設定（件数表示等） |
| **funnel_executions** | ファネル実行履歴・結果（設定は JSON） |
| **sessions** | セッション（ダッシュボード用） |
| **heatmap_events** | ヒートマップ用イベント |

### リレーション概要

- **Product** → reports, abTests, funnelConfigs, funnelExecutions, heatmapEvents, sessions, pageCvConfigs
- **Report** → executions
- **AbTest** → reportExecutions, results
- **AbTestReportExecution** → abTest, reportExecution
- **FunnelExecution** → product（設定・結果は JSON）
