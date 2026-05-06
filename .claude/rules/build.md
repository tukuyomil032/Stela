# Build & Publish

## ビルド手順

```bash
bun run build
```

- `tsc -p tsconfig.json` で `src/` → `dist/` にトランスパイル
- `postbuild` フックが `dist/index.js` に自動で `chmod 755` を付与（シェバン行 `#!/usr/bin/env node` のため必須）

## 公開物

`bun publish` 実行時、`package.json` の `files` フィールドにより **`dist/` と `README.md` のみ**が npm に含まれる。
`src/`, `docs/`, `.claude/` は公開されない。

## バージョン管理

1. `package.json` の `version` を更新
2. `bun publish`（`prepublishOnly` フックが自動でビルドを実行）
3. `git tag v{version}`
