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

export interface ScanMemoryStats {
  totalUrls:    number;
  byType:       Record<SeenType, number>;
  oldestMs:     number | null;  // Unix ms of oldest live entry
  newestMs:     number | null;  // Unix ms of newest live entry
  sizeBytesApprox: number;      // rough estimate for display
}

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
 * Return stats about the current scan memory state.
 */
export function getScanMemoryStats(): ScanMemoryStats {
  const mem = load();
  const now = Date.now();
  const byType: Record<SeenType, number> = { seen: 0, skipped: 0, posted: 0 };
  let oldest: number | null = null;
  let newest: number | null = null;

  for (const [, rec] of Object.entries(mem.urls)) {
    if (now - rec.seenAt >= DECAY_MS[rec.type]) continue; // expired
    byType[rec.type]++;
    if (oldest == null || rec.seenAt < oldest) oldest = rec.seenAt;
    if (newest == null || rec.seenAt > newest) newest = rec.seenAt;
  }

  return {
    totalUrls:       byType.seen + byType.skipped + byType.posted,
    byType,
    oldestMs:        oldest,
    newestMs:        newest,
    sizeBytesApprox: JSON.stringify(mem).length,
  };
}

/**
 * Erase all scan memory from both the in-process cache and disk file.
 * Does NOT touch the Supabase database.
 */
export function clearScanMemory(): void {
  _cache = { urls: {}, savedAt: Date.now() };
  try {
    fs.mkdirSync(path.dirname(MEMORY_PATH), { recursive: true });
    fs.writeFileSync(MEMORY_PATH, JSON.stringify(_cache, null, 2), 'utf-8');
  } catch {
    // Read-only FS (Vercel) — cache reset in-process only
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
