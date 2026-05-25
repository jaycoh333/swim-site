/**
 * duplicate-detection.ts
 *
 * Deterministic heuristic duplicate-risk scoring for recovered signals.
 * No AI/API calls — all logic is based on text/metadata comparison.
 *
 * Used by the curator queue to surface probable duplicates before rebirth.
 */

import type { DbRecoveredSignal } from '@/lib/supabase/types';

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export type DuplicateRisk = 'low' | 'medium' | 'high';

export interface RelatedSignal {
  id:             string;
  title:          string;
  category:       string;
  status:         string;
  similarityNote: string;
  score:          number;
}

export interface DuplicateRiskResult {
  risk:    DuplicateRisk;
  reasons: string[];
  related: RelatedSignal[];
}

// ---------------------------------------------------------------------------
// Text helpers
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'up', 'about', 'into', 'through', 'during',
  'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had',
  'do', 'does', 'did', 'will', 'would', 'could', 'should', 'may', 'might',
  'this', 'that', 'these', 'those', 'it', 'its', 'not', 'no', 'nor',
  'what', 'which', 'who', 'whom', 'when', 'where', 'why', 'how',
  'all', 'both', 'each', 'few', 'more', 'most', 'other', 'some', 'such',
  'than', 'too', 'very', 'just', 'as', 'if', 'had', 'before', 'after',
  'also', 'only', 'same', 'then', 'they', 'them', 'their', 'there',
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w));
}

function titleWordOverlap(a: string, b: string): number {
  const setA = new Set(tokenize(a));
  const setB = new Set(tokenize(b));
  let count = 0;
  for (const w of setA) {
    if (setB.has(w)) count++;
  }
  return count;
}

function tagOverlap(a: string[], b: string[]): number {
  const setA = new Set(a.map((t) => t.toLowerCase()));
  return b.filter((t) => setA.has(t.toLowerCase())).length;
}

function hasSourceUrlMatch(a: DbRecoveredSignal, b: DbRecoveredSignal): boolean {
  return Boolean(a.source_url && b.source_url && a.source_url === b.source_url);
}

// Returns true if any 5-word phrase from `a` appears verbatim in `b`.
function summaryPhraseOverlap(a: string, b: string): boolean {
  const PHRASE_LEN = 5;
  const wordsA = a.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length >= 2);
  const normalB = b.toLowerCase();
  for (let i = 0; i <= wordsA.length - PHRASE_LEN; i++) {
    const phrase = wordsA.slice(i, i + PHRASE_LEN).join(' ');
    if (normalB.includes(phrase)) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

interface CandidateScore {
  signal:  DbRecoveredSignal;
  score:   number;
  reasons: string[];
}

function scoreAgainst(target: DbRecoveredSignal, other: DbRecoveredSignal): CandidateScore | null {
  const reasons: string[] = [];
  let score = 0;

  // Source URL match — strongest signal (same original source = near-certain duplicate)
  if (hasSourceUrlMatch(target, other)) {
    reasons.push('same source URL');
    score += 10;
  }

  // Title word overlap
  const tWords = titleWordOverlap(target.title, other.title);
  if (tWords >= 4) {
    reasons.push(`${tWords} shared title words`);
    score += 6;
  } else if (tWords >= 2) {
    reasons.push(`${tWords} shared title words`);
    score += tWords * 1.5;
  }

  // Tag overlap
  const tTags = tagOverlap(target.tags, other.tags);
  if (tTags >= 3) {
    reasons.push(`${tTags} shared tags`);
    score += 4;
  } else if (tTags >= 2) {
    reasons.push(`${tTags} shared tags`);
    score += 2;
  }

  // Same category amplifies an existing match (not standalone)
  if (score > 0 && target.category === other.category) {
    score += 1;
  }

  // Phrase-level overlap amplifies (verbatim phrase in summaries)
  if (score > 0 && summaryPhraseOverlap(target.summary, other.summary)) {
    reasons.push('repeated phrase in summary');
    score += 3;
  }

  if (score === 0) return null;
  return { signal: other, score, reasons };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * computeDuplicateRisk — deterministic heuristic matching.
 *
 * Compares `target` against all `others` using title overlap, tag overlap,
 * source URL equality, and phrase matching.  Returns a risk level, a short
 * list of reasons, and up to 3 related signals with their similarity notes.
 *
 * No external API calls.  Safe to call in a render-path or server action.
 */
export function computeDuplicateRisk(
  target: DbRecoveredSignal,
  others: DbRecoveredSignal[],
): DuplicateRiskResult {
  const scored: CandidateScore[] = [];

  for (const other of others) {
    if (other.id === target.id) continue;
    const result = scoreAgainst(target, other);
    if (result) scored.push(result);
  }

  scored.sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 3);
  const maxScore = top[0]?.score ?? 0;

  const risk: DuplicateRisk =
    maxScore >= 10 ? 'high'   :
    maxScore >= 5  ? 'medium' :
    maxScore >= 2  ? 'low'    : 'low';

  const reasons =
    top.length > 0
      ? [...new Set(top.flatMap((s) => s.reasons))].slice(0, 3)
      : [];

  const related: RelatedSignal[] = top.map(({ signal, score, reasons: r }) => ({
    id:             signal.id,
    title:          signal.title,
    category:       signal.category,
    status:         signal.status,
    similarityNote: r[0] ?? 'similar signal',
    score,
  }));

  return { risk, reasons, related };
}
