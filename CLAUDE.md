# CLAUDE.md

This file provides guidance to Claude Code when working with this repository.

## Overview

`stela` は GitHub のスター済みリポジトリを管理する TypeScript 製 CLI ツール。
パッケージマネージャは **bun**。npm パッケージ名: `@tukuyomil032/stela`

仕様の詳細は `docs/` を参照:
- `docs/requirements.md` — 機能要件
- `docs/architecture.md` — 技術設計（ファイル構成・API 連携方針・キャッシュ仕様）
- `docs/commands.md` — コマンド仕様
- `docs/roadmap.md` — バージョン計画

## Rules

詳細ルールは `.claude/rules/` を参照:
- `.claude/rules/format.md` — コードスタイル
- `.claude/rules/commands/commands.md` — bun コマンド一覧
- `.claude/rules/architecture.md` — アーキテクチャ規約
- `.claude/rules/build.md` — ビルド・公開手順

## Commit Message Format

```
<type>: <subject>
```

type: `feat` | `fix` | `docs` | `refactor` | `test` | `chore`

例: `feat: add --lang filter to list command`

## Critical Rules（必ず守ること）

- GitHub API に Octokit は使用しない（`fetch` 直叩きで統一）
- `~/.stela/` へのアクセスは `lib/cache.ts`・`lib/config.ts` 経由のみ
- `--no-interactive` 時に副作用（star/unstar）を伴う処理を実行しない
- エラーは stderr + exit code 1（`console.error` + `process.exit(1)`）
- `package.json` の `yargs` は削除対象（`commander` と重複）
