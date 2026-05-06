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
    auth.ts             — gh auth token 経由のトークン取得
    github.ts           — GitHub REST API クライアント（fetch ベース）
    cache.ts            — キャッシュ読み書きロジック
    config.ts           — 設定ファイル読み書き
    interactive.ts      — inquirer UI ロジック（fuzzy リスト）
    table.ts            — --no-interactive 時のテーブル整形
    error.ts            — エラーハンドリング共通処理
  types/
    github.ts           — GitHub API レスポンスの型定義
    config.ts           — 設定ファイルの型定義
```

## 2. GitHub API 連携方針

- **Octokit は使用しない**。Node.js 標準の `fetch` で GitHub REST API を直叩きする
  - 理由: バンドルサイズ削減。`gh auth token` で取得したトークンを `Authorization` ヘッダーに渡すだけで認証が完結するため Octokit の追加機能は不要
- **ベース URL**: `https://api.github.com`
- **使用エンドポイント**:
  - `GET /user/starred` — スター一覧取得（ページネーション対応）
  - `DELETE /user/starred/{owner}/{repo}` — スター解除
  - `PUT /user/starred/{owner}/{repo}` — スター付与
  - `GET /search/repositories` — リポジトリ検索
- **ページネーション**: `Link` ヘッダーを解析して全件取得。`cli-progress` でプログレスバー表示
- **レート制限**: `X-RateLimit-Remaining` ヘッダーを監視し、枯渇時はユーザーに警告する

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

```
lib/auth.ts
  └─ execa('gh', ['auth', 'token'])
       ├─ 成功: トークン文字列を返す
       └─ 失敗: error.ts 経由でユーザーフレンドリーなメッセージを出力して終了
```

## 5. インタラクティブ UI フロー（list コマンドの例）

1. `lib/cache.ts` でキャッシュ確認 → TTL 内ならそのまま使用
2. キャッシュミスなら `lib/github.ts` で API 呼び出し（`ora` スピナー表示）
3. `lib/interactive.ts` で inquirer の fuzzy リストを起動
4. 選択後にアクション選択（unstar / open in browser / copy URL）
5. 確認プロンプト → API 呼び出し → `lib/cache.ts` でキャッシュ更新

## 6. レイヤー責務

| レイヤー | 責務 | 禁止事項 |
|---------|------|---------|
| `commands/` | Commander のオプション解析・lib への委譲 | ビジネスロジック・直接の fs アクセス |
| `lib/` | ビジネスロジック・外部 I/O | Commander への依存 |
| `types/` | 型定義のみ | ロジック |
