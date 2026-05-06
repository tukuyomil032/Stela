# Roadmap

## Phase1 — MVP

- [ ] gh auth token 経由の認証
- [ ] `list` コマンド（インタラクティブ + `--no-interactive`）
- [ ] `unstar` コマンド
- [ ] `star` コマンド
- [ ] JSON キャッシュ（TTL 付き）
- [ ] `cache` サブコマンド（`clear` / `status`）
- [ ] `config` サブコマンド（`show` / `set`）

## Phase2 — 検索強化

- [ ] `search` コマンド
- [ ] `--lang`, `--sort` フィルタ
- [ ] ページネーション完全対応（全件取得 + cli-progress プログレスバー）

## Phase3 — UX 改善

- [ ] `list` で複数選択 → 一括 `unstar`
- [ ] `open in browser` アクション（list インタラクティブ時）
- [ ] `copy URL to clipboard` アクション

## 将来検討（バージョン未定）

- リポジトリのコレクション / タグ管理（GitHub List API 連携）
- `.stelaignore` による非表示フィルタ
- shell 補完スクリプト生成（`stela completion`）
- SQLite キャッシュへの移行（starred 件数が 1 万を超えるユーザー向け）
- GitHub Enterprise Server 対応
