# Architecture Rules

## ファイル構成の原則

- `src/commands/` — Commander のコマンドハンドラのみ。**薄く保つ**。ビジネスロジックは `src/lib/` へ
- `src/lib/` — ビジネスロジック・外部 I/O。Commander への依存は持たない
- `src/types/` — TypeScript 型定義のみ。ロジックは書かない

詳細なディレクトリ構成は [docs/architecture.md](../../docs/architecture.md) を参照。

## 禁止事項

- **GitHub API 操作で生の `fetch` を直接使わない**。`src/lib/octokit.ts` の `getOctokit()` が返す認証済み Octokit クライアント（`@octokit/rest` + `@octokit/plugin-throttling`）経由に統一する
- **認証情報（トークン）を平文でファイル保存しない**。保存先は `src/lib/keyring.ts` 経由の OS キーチェーン（`@napi-rs/keyring`）のみ
- `src/commands/` 内に `fs` を直接使わない（`lib/cache.ts` / `lib/config.ts` 経由）
- `~/.stela/` への直接ファイルアクセスを commands 層に書かない
- トークン文字列を `console.log` / `console.error` / エラーメッセージ / ログ出力に含めない

## 依存パッケージ

使用するパッケージ: `commander`, `@clack/prompts`, `chalk`, `ora`, `cli-progress`, `gradient-string`, `oh-my-logo`, `@octokit/rest`, `@octokit/auth-oauth-device`, `@octokit/plugin-throttling`, `@napi-rs/keyring`

