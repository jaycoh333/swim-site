/**
 * Scan memory — persistent cache of recently seen/posted/skipped URLs.
 *
 * Survives between scan sessions so the scanner doesn't resurface the same
 * stories run after run.  URLs decay automatically after DECAY_MS so old
 * entries never permanently block rediscovery.
 *
 * On Vercel (read-only FS) the write is a no-op and the cache stays in-memory
 * for the duration of the process.  On dev, the JSON file persists on disk.
 */

import fs   from 'fs';
import path from 'path';

export type SeenType = 'seen' | 'skipped' | 'posted';

interface UrlRecord {
  seenAt: number;
  type:   SeenType;
}

interface ScanMemory {
  urls:    Record<string, UrlRecord>;
  savedAt: number;
}

const MEMORY_PATH = path.join(process.cwd(), 'data', 'scan-memory.json');

// 14 days before a URL can re-appear (posted = 60 days)
const DECAY_MS: Record<SeenType, number> = {
  seen:    14 * 24 * 60 * 60 * 1000,
  skipped: 21 * 24 * 60 * 60 * 1000,
  posted:  60 * 24 * 60 * 60 * 1000,
};

// Type strength: stronger types override weaker ones
const TYPE_STRENGTH: Record<SeenType, number> = { seen: 0, skipped: 1, posted: 2 };

let _cache: ScanMemory | null = null;

function load(): ScanMemory {
  if (_cache) return _cache;
  try {
    _cache = JSON.parse(fs.readFileSync(MEMORY_PATH, 'utf-8')) as ScanMemory;
  } catch {
    _cache = { urls: {}, savedAt: 0 };
  }
  return _cache;
}

function persist(mem: ScanMemory): void {
  // Prune decayed entries before writing
  const now = Date.now();
  const pruned: ScanMemory['urls'] = {};
  for (const [url, rec] of Object.entries(mem.urls)) {
    if (now - rec.seenAt < DECAY_MS[rec.type]) pruned[url] = rec;
  }
  mem.urls    = pruned;
  mem.savedAt = now;
  _cache      = mem;

  try {
    fs.mkdirSync(path.dirname(MEMORY_PATH), { recursive: true });
    fs.writeFileSync(MEMORY_PATH, JSON.stringify(mem, null, 2), 'utf-8');
  } catch {
    // Read-only FS (Vercel production) — cache lives in-process only
  }
}

/**
 * Load all URLs still within their decay window as a Set.
 */
export function loadSeenUrls(): Set<string> {
  const mem = load();
  const now = Date.now();
  const result = new Set<string>();
  for (const [url, rec] of Object.entries(mem.urls)) {
    if (now - rec.seenAt < DECAY_MS[rec.type]) result.add(url);
  }
  return result;
}

/**
 * Record a batch of URLs into persistent memory.
 * A stronger type (posted > skipped > seen) always overwrites a weaker one.
 */
export function recordSeenUrls(urls: Iterable<string>, type: SeenType = 'seen'): void {
  const mem = load();
  const now = Date.now();
  for (const url of urls) {
    const existing = mem.urls[url];
    if (!existing || TYPE_STRENGTH[type] >= TYPE_STRENGTH[existing.type]) {
      mem.urls[url] = { seenAt: now, type };
    }
  }
  persist(mem);
}
