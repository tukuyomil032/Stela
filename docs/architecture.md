# Architecture

## 1. Directory Structure

```
src/
  index.ts              — エントリーポイント。Commander 初期化・コマンド登録
  commands/             — Commander コマンドハンドラ（薄く保つ。ロジックは lib/ へ）
    list.ts
    unstar.ts
    star.ts
    search.ts
    cache.ts
    config.ts
  lib/
    auth.ts             — OAuth Device Flow によるログイン/ログアウト
    keyring.ts          — OS キーチェーンへのトークン保存/読込/削除
    octokit.ts          — 認証済み Octokit クライアント生成（throttling プラグイン込み）
    github.ts           — GitHub API 操作（Octokit クライアント経由）
    cache.ts            — キャッシュ読み書きロジック
    config.ts           — 設定ファイル読み書き
    interactive.ts      — @clack/prompts UI ロジック（fuzzy リスト）
    table.ts            — --no-interactive 時のテーブル整形
    error.ts            — エラーハンドリング共通処理
  types/
    github.ts           — GitHub API レスポンスの型定義
    config.ts           — 設定ファイルの型定義
```

## 2. GitHub API 連携方針

- **Octokit（`@octokit/rest`）を使用する**。`src/lib/octokit.ts` の `getOctokit()` が、OS キーチェーンに保存されたトークンで初期化済みの Octokit クライアントを返す
- **レート制限対策**: `@octokit/plugin-throttling` を組み込み、`onRateLimit` / `onSecondaryRateLimit` で自動リトライ・警告ログを行う
- **使用 API（`octokit.rest.*`）**:
  - `activity.listReposStarredByAuthenticatedUser` — スター一覧取得（ページネーション対応）
  - `activity.unstarRepoForAuthenticatedUser` — スター解除
  - `activity.starRepoForAuthenticatedUser` — スター付与
  - `search.repos` — リポジトリ検索
  - `repos.listLanguages` — 言語内訳取得
  - `users.getAuthenticated` — `auth status` での疎通確認
- **ページネーション**: `page`/`per_page` パラメータで全件取得

## 3. キャッシュ仕様

- **形式**: JSON
  - 理由: starred は数千件規模で JSON のシリアライズ/デシリアライズが十分高速。sqlite のネイティブバインディングによる環境依存リスクを回避できる
- **ファイルパス**: `~/.stela/cache/starred.json`
- **データ構造**:
  ```json
  {
    "fetchedAt": "2024-01-01T00:00:00.000Z",
    "repos": [ /* StarredRepo[] */ ]
  }
  ```
- **TTL 判定**: `fetchedAt` から現在時刻を引いて `config.cacheTTL`（分）と比較
- **TTL 30 分の根拠**: スター操作は低頻度（1日数回程度）。短すぎると API レート消費が増え、長すぎると陳腐化する。セッション中の繰り返し操作でキャッシュが効くバランスが 30 分

## 4. 認証フロー

GitHub 公式の [OAuth Device Flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow) を使用する（スコープ: `public_repo`）。

```
stela auth login
  └─ lib/auth.ts: createOAuthDeviceAuth({ clientType: 'oauth-app', clientId, scopes: ['public_repo'], onVerification })
       ├─ onVerification: verification_uri / user_code をユーザーに提示し、ブラウザを自動起動
       ├─ ポーリング（authorization_pending / slow_down は @octokit/auth-oauth-device が内部で自動リトライ）
       ├─ 成功: 取得したアクセストークンを lib/keyring.ts 経由で OS キーチェーンに保存
       └─ 失敗（expired_token 等）: error.ts 経由でユーザーフレンドリーなメッセージを出力して終了

stela の各コマンド実行時
  └─ lib/octokit.ts: getOctokit()
       ├─ lib/keyring.ts 経由で OS キーチェーンからトークンを読み込み
       ├─ 未ログイン: 「stela auth login を実行してください」と案内して終了
       └─ ログイン済み: トークンで初期化した Octokit クライアントを返す

stela auth logout
  └─ lib/keyring.ts 経由で OS キーチェーンからトークンを削除
```

トークンは `~/.stela/` 配下のファイルには一切保存しない。OS キーチェーン（macOS Keychain / Windows Credential Manager / Linux Secret Service）にのみ保存する。

## 5. インタラクティブ UI フロー（list コマンドの例）

1. `lib/cache.ts` でキャッシュ確認 → TTL 内ならそのまま使用
2. キャッシュミスなら `lib/github.ts` で API 呼び出し（`ora` スピナー表示）
3. `lib/interactive.ts` で @clack/prompts の fuzzy リストを起動
4. 選択後にアクション選択（unstar / open in browser / copy URL）
5. 確認プロンプト → API 呼び出し → `lib/cache.ts` でキャッシュ更新

## 6. レイヤー責務

| レイヤー | 責務 | 禁止事項 |
|---------|------|---------|
| `commands/` | Commander のオプション解析・lib への委譲 | ビジネスロジック・直接の fs アクセス |
| `lib/` | ビジネスロジック・外部 I/O | Commander への依存 |
| `types/` | 型定義のみ | ロジック |
