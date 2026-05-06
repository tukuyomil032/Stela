import chalk from 'chalk';

export type LanguageBytes = Record<string, number>;

export interface LanguageBreakdown {
  name: string;
  percentage: number;
}

export const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: '#3178c6',
  JavaScript: '#f1e05a',
  Python: '#3572A5',
  Rust: '#dea584',
  Go: '#00ADD8',
  Ruby: '#701516',
  Java: '#b07219',
  'C++': '#f34b7d',
  C: '#555555',
  'C#': '#178600',
  Swift: '#F05138',
  Kotlin: '#A97BFF',
  PHP: '#4F5D95',
  Shell: '#89e051',
  HTML: '#e34c26',
  CSS: '#563d7c',
  SCSS: '#c6538c',
  Vue: '#41b883',
  Svelte: '#ff3e00',
  Dart: '#00B4AB',
  Elixir: '#6e4a7e',
  Haskell: '#5e5086',
  Scala: '#c22d40',
  Lua: '#000080',
  'Jupyter Notebook': '#DA5B0B',
  R: '#198CE7',
  Perl: '#0298c3',
  Clojure: '#db5855',
  Erlang: '#B83998',
  'F#': '#b845fc',
  OCaml: '#3be133',
  Nix: '#7e7eff',
  Zig: '#ec915c',
  Nim: '#ffc200',
  Crystal: '#000100',
  Julia: '#a270ba',
  Groovy: '#e69f56',
  'Objective-C': '#438eff',
  CoffeeScript: '#244776',
  Elm: '#60B5CC',
  PureScript: '#1D222D',
  ReasonML: '#ff5847',
  Dockerfile: '#384d54',
  Makefile: '#427819',
  YAML: '#cb171e',
  TOML: '#9c4221',
  JSON: '#292929',
};

export function colorizeLanguage(lang: string | null): string {
  if (!lang) return chalk.dim('unknown');
  const color = LANGUAGE_COLORS[lang];
  return color ? chalk.hex(color)(lang) : chalk.dim(lang);
}

export function bytesToBreakdown(bytes: LanguageBytes): LanguageBreakdown[] {
  const total = Object.values(bytes).reduce((sum, v) => sum + v, 0);
  if (total === 0) return [];
  return Object.entries(bytes)
    .map(([name, count]) => ({ name, percentage: (count / total) * 100 }))
    .sort((a, b) => b.percentage - a.percentage);
}

export function formatLanguageBreakdown(langs: LanguageBreakdown[]): string {
  return langs
    .slice(0, 2)
    .map(({ name, percentage }) => {
      const pct = `${percentage.toFixed(1)}%`;
      const color = LANGUAGE_COLORS[name];
      const colored = color ? chalk.hex(color)(name) : chalk.dim(name);
      return `${colored}/${pct}`;
    })
    .join(' ');
}
