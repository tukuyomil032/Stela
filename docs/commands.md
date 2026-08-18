# Commands

## Global Options

| オプション | 説明 |
|-----------|------|
| `--no-interactive` | インタラクティブ UI を無効化してテーブル形式で stdout 出力 |
| `--no-color` | カラー出力を無効化（`NO_COLOR` 環境変数も尊重） |
| `--version` | バージョン表示 |
| `--help` | ヘルプ表示 |

---

## stela list

スター済みリポジトリをインタラクティブ UI で表示する。

```
stela list [options]
```

| オプション | デフォルト | 説明 |
|-----------|-----------|------|
| `--refresh` | — | キャッシュを無視して API から再取得 |
| `--lang <language>` | — | 言語フィルタ（例: `--lang typescript`） |
| `--limit <n>` | `50` | 表示件数上限（`--no-interactive` 時のみ有効） |
| `--sort <field>` | `starred_at` | ソート順: `starred_at` \| `updated` \| `stars` |

**動作**:
- インタラクティブ時: fuzzy リストで選択 → `unstar` / `open in browser` / `copy URL` アクション
- `--no-interactive` 時: `owner/repo`, 言語, stars 数, 更新日のテーブルを stdout 出力

---

## stela unstar

指定リポジトリのスターを外す。

```
stela unstar <owner/repo> [options]
```

| 引数/オプション | 説明 |
|--------------|------|
| `<owner/repo>` | 必須（例: `cli/cli`） |
| `--yes, -y` | 確認プロンプトをスキップ |

**動作**:
1. 確認プロンプト表示（`--yes` でスキップ）
2. `DELETE /user/starred/{owner}/{repo}`
3. キャッシュから該当エントリを削除

---

## stela star

リポジトリにスターを付ける。

```
stela star <owner/repo|URL>
```

| 引数 | 説明 |
|-----|------|
| `<owner/repo\|URL>` | GitHub URL でも `owner/repo` 形式でも可（例: `cli/cli` または `https://github.com/cli/cli`） |

**動作**:
1. URL の場合は正規表現で `owner/repo` を抽出
2. `PUT /user/starred/{owner}/{repo}`
3. キャッシュに追加

---

## stela search

GitHub リポジトリを検索してスターを付ける。

```
stela search <query...> [options]
```

| 引数/オプション | デフォルト | 説明 |
|--------------|-----------|------|
| `<query...>` | 必須 | 検索クエリ（GitHub search syntax に準拠）。スペース区切りで複数キーワードを指定可能（例: `stela search react state management`）。クォート無しの複数トークンはスペース結合され、GitHub 側で暗黙的な AND 検索として扱われる |
| `--lang <language>` | — | 言語フィルタ（クエリに `language:xxx` を付加） |
| `--sort <field>` | `stars` | ソート順: `stars` \| `forks` \| `updated` |
| `--limit <n>` | `30` | 結果件数上限（最大 100） |

**動作**:
- インタラクティブ時: checkbox リストで結果を表示 → 選択したものを一括スター
- `--no-interactive` 時: テーブル表示のみ（**スター付与しない**）
  - 理由: 副作用を伴う処理をパイプ・CI に混入させないため

---

## stela cache

キャッシュ管理サブコマンド。

```
stela cache <subcommand>
```

| サブコマンド | 説明 |
|------------|------|
| `clear` | `~/.stela/cache/starred.json` を削除 |
| `status` | キャッシュの存在・`fetchedAt`・TTL 残り時間を表示 |

---

## stela config

設定の確認・変更。

```
stela config <subcommand> [key] [value]
```

| サブコマンド | 説明 |
|------------|------|
| `show` | 現在の設定を表示 |
| `set <key> <value>` | 設定値を変更 |

**設定キー**:

| キー | 型 | 説明 |
|-----|---|------|
| `cacheTTL` | `number`（分） | キャッシュ TTL |
| `defaultLang` | `string` | `list` コマンドのデフォルト言語フィルタ |
| `pageSize` | `number` | インタラクティブ UI の1ページ表示件数 |

**例**:
```bash
stela config set cacheTTL 60
stela config set defaultLang typescript
```
