# Architecture Rules

## ファイル構成の原則

- `src/commands/` — Commander のコマンドハンドラのみ。**薄く保つ**。ビジネスロジックは `src/lib/` へ
- `src/lib/` — ビジネスロジック・外部 I/O。Commander への依存は持たない
- `src/types/` — TypeScript 型定義のみ。ロジックは書かない

詳細なディレクトリ構成は [docs/architecture.md](../../docs/architecture.md) を参照。

## 禁止事項

- **Octokit その他の GitHub クライアントライブラリを追加しない**（fetch 直叩きで統一）
- `src/commands/` 内に `fs` を直接使わない（`lib/cache.ts` / `lib/config.ts` 経由）
- `~/.stela/` への直接ファイルアクセスを commands 層に書かない

## 依存パッケージ

使用するパッケージ: `commander`, `@clack/prompts`, `chalk`, `ora`, `cli-progress`, `gradient-string`, `oh-my-logo`, `string-width`, `marked`, `marked-terminal`, `terminal-image`

