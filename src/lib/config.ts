import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { StelaConfig } from '../types/config.js';

const STELA_DIR = join(homedir(), '.stela');
const CONFIG_PATH = join(STELA_DIR, 'config.json');

const DEFAULT_CONFIG: StelaConfig = {
  cacheTTL: 30,
  defaultLanguageFilter: [],
  pageSize: 30,
  lang: 'en',
  searchUpdateMode: 'enter',
};

export function loadConfig(): StelaConfig {
  if (!existsSync(CONFIG_PATH)) {
    return { ...DEFAULT_CONFIG };
  }
  const raw = readFileSync(CONFIG_PATH, 'utf-8');
  const parsed = JSON.parse(raw) as Partial<StelaConfig>;
  return { ...DEFAULT_CONFIG, ...parsed };
}

export function saveConfig(config: StelaConfig): void {
  if (!existsSync(STELA_DIR)) {
    mkdirSync(STELA_DIR, { recursive: true });
  }
  writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2), 'utf-8');
}
