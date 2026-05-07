import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import type { StarredRepo } from '../types/github.js';

const STELA_DIR = join(homedir(), '.stela');
const CACHE_DIR = join(STELA_DIR, 'cache');
const CACHE_PATH = join(CACHE_DIR, 'starred.json');

export interface CacheData {
  fetchedAt: string;
  repos: StarredRepo[];
}

export function loadCache(): CacheData | null {
  if (!existsSync(CACHE_PATH)) {
    return null;
  }
  const raw = readFileSync(CACHE_PATH, 'utf-8');
  const data = JSON.parse(raw) as CacheData;
  for (const repo of data.repos) {
    if ((repo as StarredRepo & { forks_count?: number }).forks_count === undefined) {
      (repo as StarredRepo & { forks_count?: number }).forks_count = 0;
    }
  }
  return data;
}

export function saveCache(repos: StarredRepo[]): void {
  if (!existsSync(CACHE_DIR)) {
    mkdirSync(CACHE_DIR, { recursive: true });
  }
  const data: CacheData = { fetchedAt: new Date().toISOString(), repos };
  writeFileSync(CACHE_PATH, JSON.stringify(data, null, 2), 'utf-8');
}

export function isCacheValid(ttlMinutes: number): boolean {
  const cache = loadCache();
  if (!cache) {
    return false;
  }
  const fetchedAt = new Date(cache.fetchedAt).getTime();
  const now = Date.now();
  return now - fetchedAt < ttlMinutes * 60 * 1000;
}

export function clearCache(): void {
  if (existsSync(CACHE_PATH)) {
    rmSync(CACHE_PATH);
  }
}
