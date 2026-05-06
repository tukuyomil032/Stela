# Requirements

## 1. Overview

- **ツール名**: stela
- **npm パッケージ**: `@tukuyomil032/stela`
- **用途**: GitHub のスター済みリポジトリを管理する CLI ツール
- **実行前提**: `gh` CLI がインストール済みで `gh auth login` 済みであること

## 2. Functional Requirements

### 2.1 認証

- `gh auth token` コマンド経由でトークンを取得する（永続保存しない）
- `gh` 未インストール・未認証の場合はエラーメッセージを stderr に出力して終了する

### 2.2 コマンド一覧

| コマンド | 概要 |
|---------|------|
| `list`  | スター済みリポジトリ一覧を表示 |
| `unstar` | リポジトリのスターを外す |
| `star`  | リポジトリにスターを付ける |
| `search` | GitHub リポジトリを検索してスターを付ける |
| `cache` | キャッシュ管理サブコマンド |
| `config` | 設定の確認・変更 |

詳細な仕様は [commands.md](./commands.md) を参照。

### 2.3 表示モード

- **デフォルト（インタラクティブ）**: inquirer の fuzzy リストで絞り込み・選択ができる UI
- **`--no-interactive` フラグ**: テーブル形式で stdout に出力（CI・パイプ処理向け）
- `--no-color` フラグおよび `NO_COLOR` 環境変数を尊重する

### 2.4 キャッシュ

- **保存場所**: `~/.stela/cache/starred.json`
- **TTL**: 30 分（デフォルト）。`config` コマンドで変更可能
- **`--refresh` フラグ**: キャッシュを無視して API から再取得する
- キャッシュヒット時はネットワーク呼び出しをスキップする

### 2.5 設定ファイル (`~/.stela/config.json`)

| キー | 型 | デフォルト | 説明 |
|-----|---|-----------|------|
| `cacheTTL` | `number` | `30` | キャッシュ TTL（分） |
| `defaultLanguageFilter` | `string[]` | `[]` | list コマンドのデフォルト言語フィルタ |
| `pageSize` | `number` | `30` | インタラクティブ UI の1ページ表示件数 |

## 3. Non-Functional Requirements

- **動作環境**: Node.js 20 以上
- **応答速度**: キャッシュヒット時 500ms 以内
- **プログレス表示**: ネットワーク呼び出し中は `ora` スピナーを表示
- **エラー出力**: stderr に出力し `exit code 1` で終了
