/**
 * Discovery engine — pure functions for source health computation and priority scoring.
 *
 * No module-level state. Serverless-safe.
 * Computed from accumulated SessionSourceResult[] each session.
 */

import type { SessionSourceResult } from './scanner-fetch-types';

// ---------------------------------------------------------------------------
// Source health
// ---------------------------------------------------------------------------

export type SourceHealthStatus = 'healthy' | 'blocked' | 'weak' | 'high-yield' | 'unknown';

export interface SourceHealth {
  sourceId:       string;
  status:         SourceHealthStatus;
  candidateCount: number;
  errorCount:     number;
  duplicateCount: number;
  lowSignalCount: number;
  strongCount:    number;
}

function isStrongResult(r: SessionSourceResult): boolean {
  if (r.status === 'error') return false;
  return !r.candidate.badCandidateReason &&
    (r.candidate.storyScore == null || r.candidate.storyScore >= 8);
}

export function computeSourceHealth(
  sourceId: string,
  results:  SessionSourceResult[],
): SourceHealth {
  const mine = results.filter((r) => r.sourceId === sourceId);
  if (mine.length === 0) {
    return { sourceId, status: 'unknown', candidateCount: 0, errorCount: 0, duplicateCount: 0, lowSignalCount: 0, strongCount: 0 };
  }

  const errors     = mine.filter((r) => r.status === 'error').length;
  const dupes      = mine.filter((r) => r.status === 'duplicate').length;
  const previews   = mine.filter((r) => r.status === 'preview');
  const total      = previews.length + dupes;
  const strong     = mine.filter(isStrongResult).length;
  const low        = total - strong;

  let status: SourceHealthStatus;
  if (errors === mine.length) {
    status = 'blocked';
  } else if (strong >= 3 || (total > 0 && strong / total >= 0.6)) {
    status = 'high-yield';
  } else if (total > 0 && (strong === 0 || dupes / total > 0.7)) {
    status = 'weak';
  } else if (errors > 0 && total === 0) {
    status = 'blocked';
  } else {
    status = 'healthy';
  }

  return { sourceId, status, candidateCount: total, errorCount: errors, duplicateCount: dupes, lowSignalCount: low, strongCount: strong };
}

export function computeSourceHealthMap(
  results: SessionSourceResult[],
): Map<string, SourceHealth> {
  const ids = new Set(results.map((r) => r.sourceId));
  const map = new Map<string, SourceHealth>();
  for (const id of ids) map.set(id, computeSourceHealth(id, results));
  return map;
}

// ---------------------------------------------------------------------------
// Priority scoring
// ---------------------------------------------------------------------------

export interface PriorityScoreOpts {
  corroborationScore?: number;
  isArchived?:        boolean;
  isErowid?:          boolean;
  isBadCandidate?:    boolean;
  isDuplicate?:       boolean;
}

/**
 * Compute composite priority score from story quality + source-type bonuses.
 * Higher = surface to curator first.
 */
export function computeFinalPriorityScore(
  storyScore: number,
  opts: PriorityScoreOpts = {},
): number {
  let score = storyScore;
  if (opts.corroborationScore)  score += opts.corroborationScore;
  if (opts.isArchived)          score += 8;
  if (opts.isErowid)            score += 5;
  if (opts.isBadCandidate)      score -= 20;
  if (opts.isDuplicate)         score -= 10;
  return Math.max(0, Math.min(score, 100));
}

// ---------------------------------------------------------------------------
// Health badge helpers (used by both console and scanner client)
// ---------------------------------------------------------------------------

export const HEALTH_LABELS: Record<SourceHealthStatus, string> = {
  'healthy':    'HEALTHY',
  'blocked':    'BLOCKED',
  'weak':       'WEAK YIELD',
  'high-yield': 'HIGH YIELD',
  'unknown':    'UNKNOWN',
};

export function healthBadgeCls(status: SourceHealthStatus): string {
  const map: Record<SourceHealthStatus, string> = {
    'healthy':    'border-emerald-500/28 bg-emerald-500/8  text-emerald-400',
    'blocked':    'border-red-500/28     bg-red-500/8      text-red-400',
    'weak':       'border-amber-500/28   bg-amber-500/8    text-amber-400',
    'high-yield': 'border-emerald-400/40 bg-emerald-500/14 text-emerald-300',
    'unknown':    'border-slate-500/18   bg-slate-500/5    text-slate-500',
  };
  return map[status] ?? map['unknown'];
}
