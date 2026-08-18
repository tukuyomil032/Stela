export type Lang = 'en' | 'ja';

export type Messages = {
  noReposFound: string;
  noReposSelected: string;
  aborted: string;
  listFetching: string;
  listFetched: (n: number) => string;
  listSelectPrompt: string;
  listActionPrompt: string;
  listActionBrowser: string;
  listActionClipboard: string;
  listActionUnstar: string;
  listUnstarConfirm: (n: number) => string;
  listUnstarring: (name: string) => string;
  listUnstarred: (n: number) => string;
  listCopied: (n: number) => string;
  listProgressFormat: string;
  searchSearching: string;
  searchFound: (n: number) => string;
  searchFailed: string;
  searchSelectPrompt: string;
  searchStarring: (name: string, current: number, total: number) => string;
  searchStarred: (n: number) => string;
  searchNoQuery: string;
  wizardModePrompt: string;
  wizardModePreset: string;
  wizardModeCustom: string;
  wizardQueryPrompt: string;
  wizardLangPrompt: string;
  wizardSortFieldPrompt: string;
  wizardSortOrderPrompt: string;
  wizardSort2Prompt: string;
  wizardLimitPrompt: string;
  wizardPresetPrompt: string;
  wizardPresetHotNew: string;
  wizardPresetClassic: string;
  wizardPresetRecent: string;
  wizardPresetHiddenGems: string;
  listWizardSortPrompt: string;
  listWizardLangPrompt: string;
  listWizardSortStars: string;
  listWizardSortUpdated: string;
  listWizardSortDefault: string;
  cacheSelectPrompt: string;
  cacheActionClear: string;
  cacheActionStatus: string;
  cacheNone: string;
  cacheFetched: string;
  cacheRepos: (n: number) => string;
  cacheTTLLabel: string;
  cacheStatusLabel: string;
  cacheValid: (mins: number) => string;
  cacheExpired: string;
  cacheCleared: string;
  configTitle: string;
  configCacheTTL: string;
  configDefaultLang: string;
  configPageSize: string;
  configLang: string;
  configSet: (k: string, v: string) => string;
  configUnknownKey: (k: string) => string;
  configInvalidLang: string;
  configInvalidTTL: string;
  configInvalidPageSize: string;
  configSelectKey: string;
  configInputValue: string;
  configWizardKey: string;
  tableRepo: string;
  tableLang: string;
  tableStars: string;
  tableUpdated: string;
  tableForks: string;
  tableHeader: (n: number) => string;
  tableSearchHeader: string;
  errorNoToken: string;
  errorTokenFailed: string;
  paginationPrompt: (page: number) => string;
  paginationSelect: string;
  paginationNext: string;
  paginationPrev: string;
  paginationDone: string;
  paginationInfo: (page: number, selected: number) => string;
  readmeLoading: string;
  readmeNotFound: string;
  readmeFailed: string;
  readmePagerHint: string;
  readmeDismissHint: string;
};

const en: Messages = {
  noReposFound: 'No repositories found.',
  noReposSelected: 'No repositories selected.',
  aborted: 'Aborted.',
  listFetching: 'Fetching starred repositories...',
  listFetched: (n) => `Fetched ${n} repositories.`,
  listSelectPrompt: 'Select repositories:',
  listActionPrompt: 'Choose an action:',
  listActionBrowser: 'Open in browser',
  listActionClipboard: 'Copy URLs to clipboard',
  listActionUnstar: 'Unstar selected',
  listUnstarConfirm: (n) => `Unstar ${n} repositories? (y/N)`,
  listUnstarring: (name) => `Unstarring ${name}...`,
  listUnstarred: (n) => `Unstarred ${n} repositories.`,
  listCopied: (n) => `Copied ${n} URLs to clipboard.`,
  listProgressFormat: '{bar} {percentage}% | {value}/{total} repos',
  searchSearching: 'Searching repositories...',
  searchFound: (n) => `Found ${n} repositories.`,
  searchFailed: 'Search failed.',
  searchSelectPrompt: 'Select repositories to star:',
  searchStarring: (name, current, total) => `Starring repo:${name} [${current}/${total}]`,
  searchStarred: (n) => `Starred ${n} repositories.`,
  searchNoQuery: 'No query provided.',
  wizardModePrompt: 'How would you like to search?',
  wizardModePreset: 'Use a preset',
  wizardModeCustom: 'Custom search',
  wizardQueryPrompt: 'Search query:',
  wizardLangPrompt: 'Filter by languages (type to search, space to toggle):',
  wizardSortFieldPrompt: 'Sort by:',
  wizardSortOrderPrompt: 'Sort order:',
  wizardSort2Prompt: 'Add secondary sort? (optional)',
  wizardLimitPrompt: 'Maximum results per page:',
  wizardPresetPrompt: 'Choose a preset:',
  wizardPresetHotNew: 'Hot & New — recently updated, high stars',
  wizardPresetClassic: 'Classic — most stars',
  wizardPresetRecent: 'Recent — recently updated',
  wizardPresetHiddenGems: 'Hidden Gems — high stars, low forks',
  listWizardSortPrompt: 'Sort starred repos by:',
  listWizardLangPrompt: 'Filter by languages (type to search, space to toggle):',
  listWizardSortStars: 'Stars',
  listWizardSortUpdated: 'Last updated',
  listWizardSortDefault: 'Default (starred date)',
  cacheSelectPrompt: 'Choose an action:',
  cacheActionClear: 'Clear cache',
  cacheActionStatus: 'Show cache status',
  cacheNone: 'No cache found.',
  cacheFetched: 'Cache info:',
  cacheRepos: (n) => `  Repositories: ${n}`,
  cacheTTLLabel: '  TTL:',
  cacheStatusLabel: '  Status:',
  cacheValid: (mins) => `valid (expires in ${mins} min)`,
  cacheExpired: 'expired',
  cacheCleared: 'Cache cleared.',
  configTitle: 'Current configuration:',
  configCacheTTL: 'cacheTTL',
  configDefaultLang: 'defaultLanguageFilter',
  configPageSize: 'pageSize',
  configLang: 'lang',
  configSet: (k, v) => `Set ${k} = ${v}`,
  configUnknownKey: (k) =>
    `Unknown config key: "${k}". Valid keys: cacheTTL, defaultLanguageFilter, pageSize, lang`,
  configInvalidLang: `lang must be 'en' or 'ja'`,
  configInvalidTTL: 'cacheTTL must be a positive number',
  configInvalidPageSize: 'pageSize must be a positive number',
  configSelectKey: 'Select a config key to update:',
  configInputValue: 'New value:',
  configWizardKey: 'Config key:',
  tableRepo: 'Repository',
  tableLang: 'Language',
  tableStars: 'Stars',
  tableUpdated: 'Updated',
  tableForks: 'Forks',
  tableHeader: (n) => `Starred Repositories (${n} total)`,
  tableSearchHeader: 'Search Results',
  errorNoToken: 'GitHub token not found. Run: stela config set token <your-token>',
  errorTokenFailed: 'GitHub token authentication failed.',
  paginationPrompt: (page) => `Page ${page} — Choose an action:`,
  paginationSelect: 'Select repos from this page',
  paginationNext: 'Next page →',
  paginationPrev: '← Previous page',
  paginationDone: 'Done (confirm selections)',
  paginationInfo: (page, selected) => `  Page ${page} | ${selected} repo(s) selected`,
  readmeLoading: 'Loading README...',
  readmeNotFound: 'This repository has no README.',
  readmeFailed: 'Failed to load README.',
  readmePagerHint: 'jk/↑↓ scroll, space/b page, g/G top/bottom, q close',
  readmeDismissHint: 'Press any key to return',
};

const ja: Messages = {
  noReposFound: 'リポジトリが見つかりませんでした。',
  noReposSelected: 'リポジトリが選択されていません。',
  aborted: '中断しました。',
  listFetching: 'スター済みリポジトリを取得中...',
  listFetched: (n) => `${n} 件取得しました。`,
  listSelectPrompt: 'リポジトリを選択:',
  listActionPrompt: 'アクションを選択:',
  listActionBrowser: 'ブラウザで開く',
  listActionClipboard: 'URLをクリップボードにコピー',
  listActionUnstar: 'スターを外す',
  listUnstarConfirm: (n) => `${n} 件のスターを外しますか？ (y/N)`,
  listUnstarring: (name) => `${name} のスターを外し中...`,
  listUnstarred: (n) => `${n} 件のスターを外しました。`,
  listCopied: (n) => `${n} 件の URL をクリップボードにコピーしました。`,
  listProgressFormat: '{bar} {percentage}% | {value}/{total} リポジトリ',
  searchSearching: 'リポジトリを検索中...',
  searchFound: (n) => `${n} 件見つかりました。`,
  searchFailed: '検索に失敗しました。',
  searchSelectPrompt: 'スターを付けるリポジトリを選択:',
  searchStarring: (name, current, total) => `Starring repo:${name} [${current}/${total}]`,
  searchStarred: (n) => `${n} 件にスターを付けました。`,
  searchNoQuery: 'クエリが指定されていません。',
  wizardModePrompt: '検索方法を選択してください:',
  wizardModePreset: 'プリセットを使用',
  wizardModeCustom: 'カスタム検索',
  wizardQueryPrompt: '検索クエリ:',
  wizardLangPrompt: '言語フィルター (入力で検索、スペースで切替):',
  wizardSortFieldPrompt: 'ソート項目:',
  wizardSortOrderPrompt: 'ソート順:',
  wizardSort2Prompt: 'セカンダリソートを追加？ (任意)',
  wizardLimitPrompt: '1ページあたりの最大表示件数:',
  wizardPresetPrompt: 'プリセットを選択:',
  wizardPresetHotNew: 'ホット & 新着 — 最近更新、スター多め',
  wizardPresetClassic: 'クラシック — スター数順',
  wizardPresetRecent: '最近更新 — 更新日順',
  wizardPresetHiddenGems: '隠れた名作 — スター多・フォーク少',
  listWizardSortPrompt: 'スター済みリポジトリのソート:',
  listWizardLangPrompt: '言語フィルター (入力で検索、スペースで切替):',
  listWizardSortStars: 'スター数',
  listWizardSortUpdated: '最終更新日',
  listWizardSortDefault: 'デフォルト (スター日順)',
  cacheSelectPrompt: 'アクションを選択:',
  cacheActionClear: 'キャッシュを消去',
  cacheActionStatus: 'キャッシュ状態を確認',
  cacheNone: 'キャッシュが見つかりません。',
  cacheFetched: 'キャッシュ情報:',
  cacheRepos: (n) => `  リポジトリ数: ${n}`,
  cacheTTLLabel: '  TTL:',
  cacheStatusLabel: '  状態:',
  cacheValid: (mins) => `有効 (残り ${mins} 分)`,
  cacheExpired: '期限切れ',
  cacheCleared: 'キャッシュを消去しました。',
  configTitle: '現在の設定:',
  configCacheTTL: 'キャッシュ TTL',
  configDefaultLang: 'デフォルト言語フィルター',
  configPageSize: 'ページサイズ',
  configLang: '表示言語',
  configSet: (k, v) => `${k} = ${v} に設定しました`,
  configUnknownKey: (k) =>
    `不明な設定キー: "${k}"。有効なキー: cacheTTL, defaultLanguageFilter, pageSize, lang`,
  configInvalidLang: `lang は 'en' または 'ja' である必要があります`,
  configInvalidTTL: 'cacheTTL は正の数値である必要があります',
  configInvalidPageSize: 'pageSize は正の数値である必要があります',
  configSelectKey: '更新する設定キーを選択:',
  configInputValue: '新しい値:',
  configWizardKey: '設定キー:',
  tableRepo: 'リポジトリ',
  tableLang: '言語',
  tableStars: 'スター',
  tableUpdated: '更新日',
  tableForks: 'フォーク',
  tableHeader: (n) => `スター済みリポジトリ (${n} 件)`,
  tableSearchHeader: '検索結果',
  errorNoToken: 'GitHub トークンが見つかりません。実行: stela config set token <your-token>',
  errorTokenFailed: 'GitHub トークンの認証に失敗しました。',
  paginationPrompt: (page) => `ページ ${page} — アクションを選択:`,
  paginationSelect: 'このページからリポジトリを選択',
  paginationNext: '次のページ →',
  paginationPrev: '← 前のページ',
  paginationDone: '完了 (選択を確定)',
  paginationInfo: (page, selected) => `  ページ ${page} | ${selected} 件選択済み`,
  readmeLoading: 'README を読み込み中...',
  readmeNotFound: 'このリポジトリには README がありません。',
  readmeFailed: 'README の読み込みに失敗しました。',
  readmePagerHint: 'jk/↑↓ スクロール, space/b ページ送り, g/G 先頭/末尾, q 閉じる',
  readmeDismissHint: '任意のキーで戻る',
};

export function createI18n(lang: Lang): Messages {
  return lang === 'ja' ? ja : en;
}
