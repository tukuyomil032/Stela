## Critical Rules（必ず守ること）

- GitHub API に Octokit は使用しない（`fetch` 直叩きで統一）
- `~/.stela/` へのアクセスは `lib/cache.ts`・`lib/config.ts` 経由のみ
- `--no-interactive` 時に副作用（star/unstar）を伴う処理を実行しない
- エラーは stderr + exit code 1（`console.error` + `process.exit(1)`）
- `package.json` の `yargs` は削除対象（`commander` と重複）
