# Todo App 設計・実装メモ（サーバーレス静的SPA版）

## 最終方針（ユーザー合意）
要件「サーバーを使いたくない」＋「PCがオフでもスマホから使いたい」を両立する唯一解として、
**完全静的SPA + GitHub Pages（常時稼働・無料）** を採用。データは GitHub をDBとして扱い、
ブラウザが直接 GitHub Contents API を読み書きする（サーバー皆無）。

当初は Next.js（サーバー版）で実装・動作確認したが、上記要望によりこの構成へ作り変えた。

## 構成
- Vite + React + TS + Tailwind v4 + vite-plugin-pwa。成果物は純粋な静的ファイル。
- データ層 `src/lib/`：
  - `githubApi.ts` … fetch で Contents API（GET sha → PUT、UTF-8安全base64）
  - `settings.ts` … PAT/owner/repo/branch を localStorage 保存、モード判定
  - `store.ts` … 楽観更新＋409再取得リトライ。github/local 両モード
- UI：Next版の部品（CategoryTree/TodoItem/TodoForm/CategoryForm/types）をほぼ流用。
  `App.tsx` がデータ保持＆ロード、`TodoBoard` はコールバック方式に改修。
  `SettingsDialog.tsx` を新規（PAT入力・接続テスト）。

## ストレージ二系統
- 未設定 → localStorage（その端末のみ・初回シードで仕事/プライベート）
- PAT等設定済み → GitHub `rooki-todos/data/*.json`（全端末同期）

## セキュリティ
- サーバーが無いため PAT はブラウザ localStorage 保存。
- 緩和：fine-grained PAT を `rooki-todos` 限定・Contents権限のみに。漏洩時の影響を局所化。
- 公開Pagesは静的HTMLのみ（トークンはソース/ページに出ない）。

## 検証済み（ブラウザE2E・localモード）
- ビルド（tsc + vite + PWA生成）green
- Todo追加→localStorage永続化、入れ子カテゴリ追加（parentId正しい）、設定ダイアログ描画
- githubモードの実接続は実PAT必要（コードはNext版のOctokitロジックと等価）

## Next版からの主な詰まりどころ（記録）
- Vite は tsconfig paths を見ない → `vite.config.ts` に `resolve.alias` で `@`→`src` 必須。
- create-next-app 由来の `postcss.config.mjs`（@tailwindcss/postcss参照）を削除（@tailwindcss/vite に統一）。
- `tsc` が vite.config の `node:url` で失敗 → tsc の include を `src` のみに（設定はViteが実行）。
- `React.FormEvent`/`React.ReactNode` は明示 import に（UMDグローバル依存回避）。

## 残課題 / 任意
1. `rooki-todos` をGitHubに作成しpush、PAT発行→設定画面で接続。
2. `todo-app` をpublicでGitHub Pages有効化→スマホ確認。
3. PNGアイコン（iOS向け apple-touch-icon 等）でPWA体験向上。
4. オフライン編集キュー、複数端末同時編集の本格マージ（初版は409リトライのみ）。
