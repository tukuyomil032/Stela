## Code Style

- **フォーマッター/リンター**: Biome（設定: `biome.json`）
- インデント: スペース 2
- クォート: シングルクォート
- セミコロン: あり
- 行長: 100文字
- 対象: `src/**/*.ts` のみ
- **pre-commit フック**: `lint-staged` が `biome check --write` を自動実行
