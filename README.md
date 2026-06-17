#これは私が使うためのTODOアプリケーションなので自分環境で使いたいな～があればフォークして自分用のGitHubPagesを作成して運用してください
- **APIの時間当たりの使用制限(5000回/時)**があるため**個人利用**することを想定して開発しています
- このまま使うとあなたも私も使えなくなるのでお願いします


# Todo App（サーバーレス静的SPA版）

カテゴリ整理・Claude連携・PC/スマホ同期に対応した個人用Todoアプリ。
**サーバーを一切持たず**、GitHub Pages 等の静的ホスティングに置くだけで、PCがオフでもスマホから使えます。

- **カテゴリ整理**: 親子の入れ子構造でタスクを分類
- **Claude連携**: データを GitHub リポジトリに置き、GitHub MCP で参照・操作
- **PC/スマホ同期**: データを GitHub に一元化。どの端末でも同じデータ
- **直感的GUI**: サイドバーのカテゴリツリー＋一覧、モーダルで作成・編集
- **PWA**: スマホのホーム画面に追加してアプリのように起動可能

## アーキテクチャ

```
[スマホ/PC ブラウザ]
  └ 静的SPA (GitHub Pages, 常時稼働) ──fetch──▶ GitHub REST API
                                                  │ contents: data/*.json
                                                  ▼
                                        [Private Repo: todo-data]
                                                  ▲
                                        [GitHub MCP] ← Claude
```

サーバーは存在せず、ブラウザが直接 GitHub の Contents API を叩いて JSON を読み書きします（`src/lib/githubApi.ts`）。
データ層は `GITHUB_PAT` 相当の設定有無で自動切替（`src/lib/store.ts`）。

| モード | 条件 | 保存先 |
|---|---|---|
| ローカル | 未設定 | ブラウザの localStorage（その端末のみ） |
| GitHub同期 | 設定画面でPAT/owner/repo入力 | `todo-data` の `data/*.json`（全端末で同期） |

## 技術スタック

Vite + React + TypeScript + Tailwind CSS v4 / vite-plugin-pwa。ビルド成果物は純粋な静的ファイル。

## 開発

```bash
npm install
npm run dev      # http://localhost:3000 （ローカルモードで即動作）
npm run build    # dist/ に静的ファイルを生成
npm run preview  # ビルド結果をローカル確認
```

## GitHub同期の設定（スマホ↔PC同期）

1. GitHub で Private リポジトリ `todo-data` を作成し、`data/todos.json`(`[]`) と `data/categories.json` を配置（このリポジトリ群の `todo-data/` がテンプレート）。
2. [Fine-grained PAT](https://github.com/settings/personal-access-tokens/new) を発行:
   - Repository access: **Only select repositories → `todo-data`**
   - Permissions: **Contents → Read and write** のみ
3. アプリ右上の歯車（設定）から owner / repo / branch / PAT を入力し「接続テスト」→「保存」。
4. ヘッダーが「GitHub同期」になれば、以後この端末の変更は GitHub に保存され、他端末と同期します。

> 🔒 サーバーが無いため PAT はこの端末のブラウザ(localStorage)にのみ保存されます。
> 対象を1リポジトリ・Contents権限のみに絞ることで、万一の漏洩時も影響をそのTodoリポジトリに限定します。

## GitHub Pages での運用

### 1. リポジトリをフォークする

自分専用のインスタンスを作るために、まずこのリポジトリをフォークします。

1. GitHub 右上の **Fork** ボタンをクリック。
2. リポジトリ名を決める（`todo-app` のままでOK）。
3. **「Copy the `main` branch only」** にチェックが入った状態でフォーク作成。

### 2. リポジトリ名を変えた場合の設定変更

フォーク後にリポジトリ名を `todo-app` 以外にした場合は `vite.config.ts` の `base` を修正してください。

```ts
// vite.config.ts
base: command === "build" ? "/<リポジトリ名>/" : "/",
```

### 3. GitHub Pages を有効化する

フォークしたリポジトリで以下を設定します。

1. リポジトリの **Settings** タブを開く。
2. 左メニュー **Pages** をクリック。
3. **Source** を `GitHub Actions` に変更して保存。

> GitHub Free プランでも **public リポジトリ**なら無料で利用できます。  
> ソースコードに秘密情報は含まれないため public で問題ありません（PAT はブラウザの localStorage にのみ保存されます）。

### 4. 初回デプロイ

Settings → Pages を保存した後、`main` ブランチに何か push するだけで自動デプロイが走ります。

```bash
# 例: README を一行変えて push するだけでOK
git commit --allow-empty -m "trigger first deploy"
git push origin main
```

進捗は **Actions** タブ → `Deploy to GitHub Pages` ワークフローで確認できます。  
通常 1〜2 分で完了します。

### 5. 公開 URL にアクセスする

デプロイ完了後、以下の URL でアクセスできます。

```
https://<GitHubユーザー名>.github.io/<リポジトリ名>/
```

Actions タブのワークフロー実行結果にも URL が表示されます。

### 6. スマホのホーム画面に追加（PWA）

このアプリは PWA に対応しており、ネイティブアプリのように使えます。

**iOS（Safari）**
1. Safari で公開URLを開く。
2. 下部の共有ボタン（四角に矢印）をタップ。
3. **「ホーム画面に追加」** を選択。

**Android（Chrome）**
1. Chrome で公開URLを開く。
2. アドレスバー右の **「…」→「ホーム画面に追加」** をタップ。  
   または画面下部に表示されるインストールバナーをタップ。

### 7. 日常的な運用フロー

| やること | 方法 |
|---|---|
| アプリを使う | `https://<user>.github.io/<repo>/` をブックマーク or PWA で起動 |
| データをスマホ↔PC同期 | 設定画面で `todo-data` の PAT/owner/repo を入力（[GitHub同期の設定](#github同期の設定スマホpc同期) 参照） |
| アプリ自体を更新 | `main` に push するだけ（GitHub Actions が自動でビルド＆再デプロイ） |
| デプロイ状況を確認 | リポジトリの Actions タブ |
| デプロイを手動で再実行 | Actions タブ → ワークフロー選択 → **Run workflow** |

> Cloudflare Pages / Netlify でも同様に動作します（`vite.config.ts` の `base` は `/` に戻してください）。

## Claude 連携（GitHub MCP）

データ用 `todo-data` に `.mcp.json` を用意済み。環境変数 `GITHUB_PAT` を設定して Claude Code を起動すると、`data/*.json` を直接参照・更新できます。詳細は `todo-data/README.md`・`todo-data/CLAUDE.md`。

## 主なファイル

| パス | 役割 |
|---|---|
| `src/lib/types.ts` | 型・カテゴリツリー構築・入力型 |
| `src/lib/githubApi.ts` | ブラウザ→GitHub Contents API |
| `src/lib/settings.ts` | 設定(localStorage)・モード判定 |
| `src/lib/store.ts` | 読み書き・楽観更新・409競合リトライ |
| `src/App.tsx` | データ保持・ロード・配線 |
| `src/components/TodoBoard.tsx` | 画面全体（一覧・フィルタ・状態管理） |
| `src/components/CategoryTree.tsx` | 再帰カテゴリツリー |
| `src/components/{TodoForm,CategoryForm,SettingsDialog}.tsx` | 各モーダル |
