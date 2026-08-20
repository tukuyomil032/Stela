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

GitHub 公式の [OAuth Device Flow](https://docs.github.com/en/apps/oauth-apps/building-oauth-apps/authorizing-oauth-apps#device-flow) を使用する（スコープ: `public_repo` + `offline_access`）。`offline_access` は個々のサインインを有効期限付きトークン化するランタイムオプトインで、OAuth App 側の追加設定なしに有効期限付きアクセストークン + リフレッシュトークンが発行される。

`@octokit/auth-oauth-device` の便利ラッパーは OAuth App（`clientType: 'oauth-app'`）向けのリフレッシュトークン処理を実装していない（GitHub Apps 向けのコードパスでしか `refresh_token`/`expires_in` を読み取らない）ため、低レベル API の `@octokit/oauth-methods`（`createDeviceCode`/`exchangeDeviceCode`）を直接呼び出し、ポーリングループ（`authorization_pending` は継続、`slow_down` は間隔 +5 秒、`expired_token`/`access_denied` は終了）を自前実装している。

```
stela auth login
  └─ lib/auth.ts
       ├─ createDeviceCode({ clientType: 'oauth-app', clientId, scopes: ['public_repo', 'offline_access'] })
       ├─ verification_uri / user_code をユーザーに提示し、ブラウザを自動起動
       ├─ exchangeDeviceCode() をポーリング（authorization_pending / slow_down は自前で継続、expired_token 等は終了）
       ├─ 成功: { token, refreshToken?, expiresAt?, refreshTokenExpiresAt? } を JSON化して
       │        lib/keyring.ts 経由で OS キーチェーンに保存
       └─ 失敗: error.ts 経由でユーザーフレンドリーなメッセージを出力して終了

stela の各コマンド実行時
  └─ lib/octokit.ts: getOctokit()（非同期）
       └─ lib/auth.ts: requireToken()
            ├─ 未ログイン: 「stela auth login を実行してください」と案内して終了
            ├─ 有効期限なし、または期限内: 保存済みトークンをそのまま返す
            ├─ 期限切れ間近/超過 かつ リフレッシュトークンも失効: 終了（再ログインを案内）
            └─ 期限切れ間近/超過: GitHub の `POST https://github.com/login/oauth/access_token`
                （`grant_type=refresh_token`）に対し fetch で直接リクエスト（Device Flow で
                発行されたリフレッシュトークンは client_secret 不要。REST API 操作ではないため
                lib/octokit.ts を経由しない）。新しいトークンをキーチェーンに保存し直す

stela auth logout
  └─ lib/keyring.ts 経由で OS キーチェーンからセッションを削除
```

トークン（および付随するリフレッシュトークン・有効期限）は `~/.stela/` 配下のファイルには一切保存しない。OS キーチェーン（macOS Keychain / Windows Credential Manager / Linux Secret Service）に JSON 化して一つのエントリとして保存する。

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
