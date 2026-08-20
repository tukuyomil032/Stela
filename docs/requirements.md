# Requirements

## 1. Overview

- **ツール名**: stela
- **npm パッケージ**: `@tukuyomil032/stela`
- **用途**: GitHub のスター済みリポジトリを管理する CLI ツール
- **実行前提**: なし（初回実行時に `stela auth login` で GitHub OAuth Device Flow によるログインを行う）

## 2. Functional Requirements

### 2.1 認証

- GitHub OAuth Device Flow（`stela auth login`）でログインする。スコープは `public_repo` + `offline_access`（有効期限付きトークン + リフレッシュトークンを発行させるランタイムオプトイン）
- アクセストークンの有効期限が近づいた場合、コマンド実行時に自動でリフレッシュトークンを使って更新する（`stela auth login` のやり直しは不要）。リフレッシュトークン自体が失効した場合のみ再ログインが必要
- 取得したアクセストークン・リフレッシュトークン・有効期限は OS キーチェーン（macOS Keychain / Windows Credential Manager / Linux Secret Service）にのみ保存する。`~/.stela/` 配下のファイルや平文には一切保存しない
- `stela auth logout` でキーチェーンからトークンを削除できる
- `stela auth status` でログイン状態と有効性（GitHub API への疎通）を確認できる
- 未ログイン状態で star/unstar/list/search 等を実行した場合はエラーメッセージを stderr に出力して終了する（`stela auth login` を案内）

### 2.2 コマンド一覧

| コマンド | 概要 |
|---------|------|
| `auth`  | GitHub 認証の管理（login/logout/status） |
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
