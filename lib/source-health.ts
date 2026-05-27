/**
 * Source health tracking — lightweight JSON cache for per-source fetch history.
 *
 * Persists to data/source-health.json (local dev only; read-only on Vercel).
 * All reads/writes are graceful — failure never blocks the scanner.
 *
 * WEAK: 3+ consecutive failures — shown in UI, lowered priority (never auto-disabled).
 * HEALTHY: 2+ recent successes.
 */

import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

const HEALTH_FILE = join(process.cwd(), 'data', 'source-health.json');

export interface SourceHealthRecord {
  sourceId:         string;
  sourceName:       string;
  successCount:     number;
  failCount:        number;
  consecutiveFails: number;
  avgCandidates:    number; // rolling avg
  lastSuccessAt:    string | null; // ISO timestamp
  lastFailAt:       string | null;
  status:           'healthy' | 'weak' | 'unknown';
}

export type HealthCache = Record<string, SourceHealthRecord>;

export function loadHealthCache(): HealthCache {
  try {
    const raw = readFileSync(HEALTH_FILE, 'utf-8');
    return JSON.parse(raw) as HealthCache;
  } catch {
    return {};
  }
}

function saveHealthCache(cache: HealthCache): void {
  try {
    writeFileSync(HEALTH_FILE, JSON.stringify(cache, null, 2), 'utf-8');
  } catch {
    // Read-only filesystem (Vercel) — silently skip
  }
}

export function recordSourceResult(
  sourceId:       string,
  sourceName:     string,
  success:        boolean,
  candidatesFound = 0,
): void {
  const cache = loadHealthCache();
  const now   = new Date().toISOString();

  const prev = cache[sourceId] ?? {
    sourceId, sourceName, successCount: 0, failCount: 0,
    consecutiveFails: 0, avgCandidates: 0, lastSuccessAt: null, lastFailAt: null, status: 'unknown' as const,
  };

  let updated: SourceHealthRecord;
  if (success) {
    const newAvg = prev.successCount === 0
      ? candidatesFound
      : Math.round((prev.avgCandidates * prev.successCount + candidatesFound) / (prev.successCount + 1));
    updated = {
      ...prev,
      sourceName,
      successCount:     prev.successCount + 1,
      consecutiveFails: 0,
      avgCandidates:    newAvg,
      lastSuccessAt:    now,
      status:           prev.successCount + 1 >= 2 ? 'healthy' : 'unknown',
    };
  } else {
    const newFails = prev.consecutiveFails + 1;
    updated = {
      ...prev,
      sourceName,
      failCount:        prev.failCount + 1,
      consecutiveFails: newFails,
      lastFailAt:       now,
      status:           newFails >= 3 ? 'weak' : prev.status === 'healthy' ? 'healthy' : 'unknown',
    };
  }

  cache[sourceId] = updated;
  saveHealthCache(cache);
}

export function getSourceHealthRecord(sourceId: string): SourceHealthRecord | null {
  const cache = loadHealthCache();
  return cache[sourceId] ?? null;
}
