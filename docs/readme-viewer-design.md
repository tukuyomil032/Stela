# README表示機能 設計メモ

> このドキュメントは `feat/search-multi-keyword` フェーズの計画時に検討した設計を記録したものです。`feat/readme-viewer` ブランチで実装済み。実装時に判明した誤りと変更点は末尾の「実装時の訂正・変更点」を参照。

## 背景・判断根拠

- ユーザー要望: リポジトリのREADMEをfetchしてターミナル上でプレビュー表示したい。
- README取得APIは現状未実装(`src/lib/github.ts`に該当関数なし)。
- 現状のTUI実装は外部ライブラリ不使用の完全自前実装(readlineのrawモード+生ANSIエスケープ)。過去にマウス対応(SGRモード、DSRクエリ)を試みたが安定性問題で撤退した経緯があり(`b3e3d36`, `a68017f`)、rawMode二重管理には要注意。
- **opentui は画像表示(Kitty Graphics/SIXEL/iTerm2 protocol)が未実装**(GitHub上でオープンな機能要望 [anomalyco/opentui#92](https://github.com/anomalyco/opentui/issues/92))。画像表示が目的なら不採用と判断。
- 代わりに **`terminal-image`**(sindresorhus製)を採用。ANSI半角ブロック文字+24bitカラーで全端末に統一表示する(既定)。iTerm2ネイティブプロトコルは `preferNativeRender` オプションで opt-in できるが、後述の理由で既定はオフ。追加の外部バイナリ不要。
- Markdown本文レンダリングには `marked` + `marked-terminal` を採用。

## ブランチ

`feat/readme-viewer`(`main` から新規作成)

## API層 (`src/lib/github.ts`)

```ts
export type ReadmeResult =
  | { status: 'ok'; content: string; defaultBranch: string }
  | { status: 'notFound' }
  | { status: 'error'; message: string };

export async function fetchRepoDefaultBranch(
  token: string,
  owner: string,
  repo: string,
): Promise<string | null>

export async function fetchReadme(
  token: string,
  owner: string,
  repo: string,
): Promise<ReadmeResult>
```

- `GET /repos/{owner}/{repo}/readme` に `Accept: application/vnd.github.raw` ヘッダを付けると生Markdownテキストが返る(base64デコード不要)。
- 404の場合はREADME無し → `{ status: 'notFound' }` を返す。
- レスポンスに `default_branch` は含まれないため、相対画像パス解決用に `GET /repos/{owner}/{repo}` を別途1回呼ぶ。README が404の場合は default_branch を取得しない(逐次実装、README取得成功時のみ default_branch を取る)。
- **既存の `exitWithError` は使わない。** この2関数は対話TUI(rawモード中)から呼ばれるため、`process.exit` すると端末がエコーなしのまま壊れる。ネットワーク断・404・その他エラーはすべて `ReadmeResult` の値として返す。
- セッション内メモリキャッシュ(`readmeCache` / `defaultBranchCache`)を持つ。`~/.stela/` の永続キャッシュには入れない。

## レンダリング層 (`src/lib/readme.ts`)

```ts
export interface RenderReadmeOptions {
  owner: string;
  repo: string;
  defaultBranch: string;
  width: number;
  token?: string;
  maxImages?: number;   // default 12
  concurrency?: number; // default 4
}

export function resolveImageUrl(src, owner, repo, branch): string | null;
export function shouldSkipImage(url: string): boolean;
export function maskCodeBlocks(markdown: string): string;
export function extractImageUrls(markdown, owner, repo, branch): ExtractedImage[];
export function replaceImagesWithPlaceholders(markdown, images, blocks?): string;
export async function renderReadme(markdown: string, options: RenderReadmeOptions): Promise<string>;
```

**2パスにする理由**: `marked-terminal` の renderer API は同期関数だが、`terminal-image` の変換は非同期。marked自体を非同期化する改造はせず、事前に全画像を非同期フェッチ&変換してプレースホルダーに焼き込み、レンダリング後に置換する方式を採る。

処理の流れ:

1. コードブロック・インラインコードをマスクしてから画像記法を抽出(誤検出を防ぐ)。
2. `skip=false` の画像だけ並列フェッチ(並列4・5秒タイムアウト・3MB上限・最大12枚)、ANSIブロックに変換。
3. **変換に成功した画像だけ**独立段落のプレースホルダーに置換する。失敗・スキップした画像はその場でインラインの `[image: alt]` に置換する(バッジがリンクで包まれているケースが多く、独立段落に引き上げるとリンクが千切れて `](url)` が裸で表示されるため)。
4. `marked` + `marked-terminal`(`width`, `reflowText: true`)でレンダリング。画像レンダラーはプレースホルダーをそのまま素通しさせる。
5. プレースホルダーをANSI画像ブロックに置換。reflowで分割されて残ったプレースホルダーもフォールバックテキストに掃除する。

バッジ・SVG・WebP・AVIF はスキップ(SVGはラスタライズせずテキストフォールバック)。画像フェッチ時、GitHubトークンは `github.com` / `*.githubusercontent.com` ホストにのみ付与し、第三者ホスト(shields.io等)には送らない。

## ページャー層 (`src/lib/readmePager.ts`)

```ts
export function wrapAnsiLine(line: string, width: number): string[];
export async function withAltScreen<T>(fn: () => Promise<T>): Promise<T>;
export function startLoading(message: string): () => void;
export async function showMessageAndWait(message: string, hint: string): Promise<void>;
export function showReadmePager(rendered: string, title: string, t: Messages): Promise<void>;
```

- **代替スクリーンバッファ(`\x1b[?1049h` / `\x1b[?1049l`)を使用。** 退場時に元の画面内容とカーソル位置が端末側で完全復元されるため、`customMultiselect` 側の `linesRendered` を一切触らずにリスト表示へ復帰できる。
- キー操作: `j/k`/`↑↓`(1行)、`space/f/PageDown`(1画面下)、`b/PageUp`(1画面上)、`d/u`(半画面)、`g/G`(先頭/末尾)、`q/escape`(終了)。
- `wrapAnsiLine` が ANSI エスケープを含む文字列を端末幅で事前に折り返す。marked-terminal の `reflowText` はコードブロック・テーブルまでは折り返さないため、その残りをここで吸収する。「1論理行を書く=1端末行を消費する」という不変条件をページャー全体で維持するための関数。
- **rawMode管理**: `setRawMode` / `pause` / `resume` を一切呼ばない。`process.stdin.on('keypress', ...)` の登録・解除のみ行う。rawMode の所有権は常に `customMultiselect` 側にある。
- ローディング表示・メッセージ表示も同じ理由で `ora` を使わず自前のスピナー(`startLoading`)を実装した。`ora` はデフォルトでstdinを横取りしてrawModeを操作するため、この機能の中核である「rawMode所有権はcustomMultiselectのみ」という制約と衝突する。

## UI統合 (`src/lib/interactive.ts`)

`customMultiselect<T>` に `onViewReadme?: (item: T) => Promise<void>` を追加。

キーバインド: `r` キー押下時
1. `await` の前に同期的に `keypress` リスナーを `removeListener` で解除(ロード中に押されたキーがリストカーソルを動かすのを防ぐ)
2. `onViewReadme(items[cursor])` を await(内部でローディング表示→フェッチ→レンダリング→ページャー表示まで完結)
3. `finally` でリスナーを再登録し `render()` を呼ぶ(alt screen復元により `linesRendered` は有効なままなので、リセット不要)

`selectMultipleRepos` / `selectMultipleStarredRepos` に `onViewReadme?` を追加して橋渡し。`src/commands/list.ts` / `src/commands/search.ts` から `createReadmeViewer(t, getToken)` で作ったコールバックを渡す。

フッターのキーヒント文字列は既存の英語ハードコードのまま `r readme` を追記(既存文字列群の i18n 化は別Issue扱い)。

## i18n (`src/lib/i18n.ts`)

`Messages` type + `en`/`ja` 両方に追加済み:
- `readmeLoading`
- `readmeNotFound`
- `readmeFailed`
- `readmePagerHint`
- `readmeDismissHint`

## 依存関係・ルール更新

- `package.json` に `marked`(`^15`, marked-terminal の peer 制約 `>=1 <16` に合わせてピン留め)、`marked-terminal`、`terminal-image`、devDependencies に `vitest` を追加済み。
- `.claude/rules/architecture.md` の許可パッケージリストに追記済み。
- `marked-terminal` は型定義を同梱していないため `src/types/marked-terminal.d.ts` にアンビエント宣言を追加した。

## テスト

`bun test`(Jest互換の組み込みランナー)ではなく **vitest** を採用(ユーザー判断)。`tests/` 配下に配置し `tsconfig.json` の `include` からは除外、`biome.json` の対象には追加。

- `tests/readme.test.ts`: `resolveImageUrl` / `shouldSkipImage` / `maskCodeBlocks` / `extractImageUrls` / `replaceImagesWithPlaceholders`
- `tests/readmePager.test.ts`: `wrapAnsiLine`

`renderReadme` / `fetchReadme` / `showReadmePager` はネットワーク・TTY依存のため自動テスト対象外。手動検証は下記。

## 検証方法(実施済み)

1. `bun run typecheck` / `bun run build` / `bun run biome:check` / `bun run test` — 全てグリーン
2. `list --interactive` で `r` キーを押し、実際の GitHub リポジトリ(`sharkdp/hyperfine`, `charmbracelet/gum`, `sindresorhus/awesome` 等)で README(本文+画像)がページャーで表示されることを確認
3. `wrapAnsiLine` の不変条件(全表示行が端末幅以下)を実READMEの出力で検証。折返し境界での崩れなし
4. バッジがリンクで包まれているケースでリンクが千切れない(`](url)` が単独行に出ない)ことを確認

## 実装時の訂正・変更点

計画時の想定から、実装時に以下を変更・訂正した。

- **`terminal-image` は Kitty graphics protocol を実装していない**(iTerm2 プロトコルのみ)。「iTerm2/Kitty/WezTerm等でフル解像度」という記述は不正確だった。
- **画像表示の既定を ANSI ハーフブロックに変更**(当初案は iTerm2 等でネイティブインライン表示が既定)。ネイティブプロトコルはページャーの行単位スクロールと相性が悪く(エスケープシーケンスが行境界で分断される)、`terminal-image@5` の `preferNativeRender` オプションで明示的に無効化した。環境変数 `STELA_README_INLINE_IMAGES=1` で opt-in できる。
- **`ReadmeResult` を判別可能ユニオンに変更**(当初案は `| null`)。「READMEが無い」と「取得失敗」を区別してメッセージを出し分けるため。
- **画像抽出のインデックス方式を変更**: 当初は `extractImageUrls` が `string[]` を返す想定だったが、alt テキストとスキップ判定を持ち回るため `ExtractedImage[]` に拡張した。
- **バッジ等のフォールバック処理を修正**: 変換に成功した画像のみ独立段落に引き上げ、失敗・スキップした画像はインラインでフォールバックテキストに置換するよう変更した。バッジは大半がリンクで包まれており、独立段落化するとリンクが千切れて `](url)` が裸で表示される不具合があったため。
- **ページャーは代替スクリーンバッファを採用**(当初案通り)。`customMultiselect` の `linesRendered` を一切変更せずに済む設計とした。
- **ローディング表示は `ora` を使わず自前実装**。`ora` はデフォルトでstdinを横取りしてrawModeを操作するため、rawMode所有権の一元管理という設計の中核と衝突すると判断した。
- **i18n は最小差分**: 新規4キー(+ `readmeDismissHint`)のみ追加し、`interactive.ts` 内の既存の英語ハードコード文字列群の i18n 化はスコープ外とした(別Issue)。

## Phase 2: 画質改善・レンダリング不具合修正

Phase 1マージ前に実端末で動作確認したところ、リスト内リンクが生Markdownのまま表示される不具合、リンクで包まれた画像の周りに `](url)` の残骸が出る不具合、ANSI画像が粗すぎて判別できない問題が見つかり、同じ `feat/readme-viewer` ブランチ上で追加修正した。

### 不具合修正

- **`marked` を `^15` から `^12` にダウングレード。** `marked@13`以降で `marked-terminal@7.3.0` のリスト項目レンダラーが壊れ、リスト内のリンク・太字がインラインMarkdownとして解釈されず生文字列のまま出力される回帰があることを実測で確認した(`marked@{5,7,9,11,12}` は正常、`{13,15}` は不具合再現)。`marked-terminal` の `peerDependencies`(`>=1 <16`)はこの非互換を反映していない。
- **リンクで包まれた画像(`[![alt](img)](href)`)の一体差し替え。** `extractImageUrls` が画像記法の直前直後に単独の `[` / `](href)` があるかを検出し、あれば外側のリンクごと1つの `raw` として扱うようにした(`widenForWrappingLink`)。従来は画像の内側だけを独立段落プレースホルダーに差し替えていたため、marked が空行区切りのブロックをリンク内に解釈できず `[` と `](href)` が生文字列として残っていた。
- **ANSI画像の描画幅を本文幅に統一。** `toAnsiImage` にあった `Math.max(10, Math.min(width, 60))` という固定60カラム上限を撤廃し、`renderReadme` に渡された幅(本文と同じ)をそのまま使うようにした。

### Kitty Graphics Protocol(Unicode Placeholder方式)によるネイティブ画像表示

ユーザーから「ANSI半角ブロックでは画像が粗すぎて何かわからない、yaziのようなTUIファイルマネージャー並みの画質にできないか」という要望があり、相談の上でKitty Graphics Protocolを自前実装することにした。

`terminal-image` のKittyパス(`renderKitty()`)は `a=T`(`U=1`なし)で**呼び出した瞬間のカーソル位置に直接描画**し空文字列を返すだけで、「文字列に組み立ててから任意範囲を再スライスする」という本ページャーの設計と根本的に噛み合わない。これがPhase 1でネイティブ描画を既定オフにしていた理由そのもの。

代わりに **Unicode Placeholder方式**(画像をキャッシュに転送しておき、`U+10EEEE` を主体とするプレースホルダー文字列を通常のテキストとして埋め込む方式)を新規モジュール `src/lib/kittyGraphics.ts` に実装した。プレースホルダー文字列は普通のテキストなので、既存の `wrapAnsiLine` によるスクロール・再スライスにそのまま乗る。

- **行の符号化**: 各プレースホルダー行の先頭セルだけに行diacritic(結合文字、[AnswerDotAI/kittytgp](https://github.com/AnswerDotAI/kittytgp) の `rowcolumn_diacritics.txt` 由来、297種)を付け、残りの列は無印のプレースホルダー文字を並べる(列は端末側が自動で埋める)。
- **画像ID**: truecolor前景色エスケープの下位24bitに埋め込む。
- **転送**: `a=T,f=100,q=2,U=1,i=<id>,c=<cols>,r=<rows>` + base64ペイロード(4096バイトごとに分割)。
- **サポート検出**: ダミー画像への `a=q` クエリ + `\x1b[16t`(セル寸法取得) + `\x1b[c`(DA1、全端末が応答)を1回のstdout書き込みで送り、DA1応答が届くまでの読み取りバイト列から判定。タイムアウト時は非サポート扱い。`customMultiselect` が既にキー入力リスナーを外している区間(`r` 押下直後のawait内)で実行するため、通常のキー入力とは競合しない。
- **tmux越し**: `TMUX` 環境変数があれば全APCシーケンスをpassthroughで包む。
- **画質の対象を絞った**: PNGのみネイティブ表示(`pngDimensions()` でIHDRチャンクから直接寸法を読み、jimp等の画像デコード依存を増やさない)。非PNG(JPEG/BMP/TIFF)はKitty対応端末でも従来のANSI半角ブロックにフォールバックする。実装コストと「新規の画像デコード依存を増やさない」という制約とのトレードオフとして受け入れた既知の制限。
- **後始末**: `renderReadme` の戻り値を `{ text, kittyImageIds }` に変更し、`readmeViewer.ts` がページャーを閉じた直後(成功・失敗どちらの経路でも)に `deleteImages()` で転送済み画像を破棄する。連続して複数リポジトリのREADMEを開いても端末側の画像メモリが際限なく増えない。
- **対象端末**: Kitty / Ghostty / WezTerm / Konsole 等、Kitty Graphics Protocolを実装している端末のみ。iTerm2ネイティブプロトコル・Sixelは対象外(Unicode Placeholder方式を持たないため)で、これらは引き続きANSI半角ブロック表示になる。

### テスト追加

`tests/kittyGraphics.test.ts` に純粋関数のみ追加: `fitImageCells`(アスペクト比維持・上限遵守)、`placeholderGrid`(行数・列数・色エスケープの正しさ、境界値)、`nextImageId`(非ゼロ・24bit範囲)。`pngDimensions` は同ファイル内の実装だがテストは省略(IHDRパースは`readme.ts`同様ネットワーク非依存の単純処理だが、後日追加余地あり)。`detectKittySupport`/`transmitImage`/`deleteImages` は実端末のstdin/stdout依存のため自動テスト対象外。

### 検証状況

- `bun run typecheck && bun run build && bun run biome:check && bun run test` 全てグリーン
- `renderReadme()` を `kitty.supported: false/true` の両方で直接呼び出し、ANSIフォールバック・Kittyプレースホルダー生成(`a=T,...` APCシーケンスの送出、`U+10EEEE` を含む本文の生成)を確認済み
- **未検証**: 実際のKitty/Ghostty/WezTerm/Konsole端末上での目視確認、tmux越しのpassthrough動作、`q` で閉じた後の画像メモリ解放。開発環境がこれらの端末を持たないため、次回それらの環境で `r` キーを押して確認する必要がある。
