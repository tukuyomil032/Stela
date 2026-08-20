## Critical Rules（必ず守ること）

- GitHub API 操作は `src/lib/octokit.ts` の `getOctokit()` が返す Octokit クライアント経由に統一する（生の `fetch` 直叩きをしない）
- GitHub 認証は OAuth Device Flow（`src/lib/auth.ts`）で行い、トークンは `src/lib/keyring.ts` 経由で OS キーチェーンにのみ保存する（平文ファイル保存・ログ出力への混入は禁止）
- keyring・auth まわりのエラーは握りつぶさない（空 catch 禁止）。未保存/失効時は `exitWithError` で明示的にユーザーへ伝える
- `~/.stela/` へのアクセスは `lib/cache.ts`・`lib/config.ts` 経由のみ
- `--no-interactive` 時に副作用（star/unstar）を伴う処理を実行しない
- エラーは stderr + exit code 1（`console.error` + `process.exit(1)`）
- `package.json` の `yargs` は削除対象（`commander` と重複）
