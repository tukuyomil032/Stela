# Roadmap

## Phase1 — MVP

- [x] gh auth token 経由の認証
- [x] `list` コマンド（インタラクティブ + `--no-interactive`）
- [x] `unstar` コマンド
- [x] `star` コマンド
- [x] JSON キャッシュ（TTL 付き）
- [x] `cache` サブコマンド（`clear` / `status`）
- [x] `config` サブコマンド（`show` / `set`）

## Phase2 — 検索強化

- [x] `search` コマンド
- [x] `--lang`, `--sort` フィルタ
- [x] ページネーション完全対応（全件取得 + cli-progress プログレスバー）

## Phase3 — UX 改善

- [x] `list` で複数選択 → 一括 `unstar`
- [x] `open in browser` アクション（list インタラクティブ時）
- [x] `copy URL to clipboard` アクション

## Phase4 — 表示UX・多言語・検索強化

- [x] 出力テキスト全体の英語統一 + `config set lang ja` で日本語切り替え（i18n）
- [x] GitHub linguist カラーマップによる言語名の色付け
- [x] 表示フォーマット変更: `#N/★X - owner/repo (Lang1/XX% Lang2/XX%)`
- [x] ASCII装飾（`╔══╗`, `──`）によるセクション区切り
- [x] インタラクティブリストへの番号付け
- [x] search 結果 Star 上位3件の強調表示（◆マーク）
- [x] 言語使用率のオンデマンド取得（選択後に `/repos/{owner}/{repo}/languages`）
- [x] search: 複数条件ソート（Stars×重み + 更新日×重みなどの複合スコア）
- [x] search: ウィザードモード（プリセット4種 / カスタム条件）
- [x] list/cache/config: オプションなし実行でウィザードモード起動

## 将来検討（バージョン未定）

- README表示機能（`list`/`search` インタラクティブモードで `r` キー押下→README本文+画像をターミナルプレビュー）。設計は [docs/readme-viewer-design.md](./readme-viewer-design.md) を参照
- リポジトリのコレクション / タグ管理（GitHub List API 連携）
- `.stelaignore` による非表示フィルタ
- shell 補完スクリプト生成（`stela completion`）
- SQLite キャッシュへの移行（starred 件数が 1 万を超えるユーザー向け）
- GitHub Enterprise Server 対応
