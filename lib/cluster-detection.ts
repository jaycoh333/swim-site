/**
 * Story cluster detection — groups FetchedCandidate[] by shared narrative signals + category.
 * Pure function. No state.
 */

import type { FetchedCandidate } from './scanner-fetch-types';

export interface ClusterResult {
  label:          string;
  candidateUrls:  string[];
  sharedSignals:  string[];
  sharedCategory?: string;
}

const SIGNAL_LABELS: Record<string, string> = {
  'eyewitness':       'Recurring Witness Reports',
  'corroborated':     'Corroborated Accounts',
  'timeline anomaly': 'Timeline Anomaly Cluster',
  'unresolved':       'Unresolved Mystery Cluster',
  'high intensity':   'High Intensity Event Cluster',
  'anomaly phrase':   'Anomaly Signal Cluster',
};

function toLabel(signal: string): string {
  if (SIGNAL_LABELS[signal]) return SIGNAL_LABELS[signal];
  return `${signal.charAt(0).toUpperCase()}${signal.slice(1)} Cluster`;
}

/**
 * Detect clusters of related candidates based on shared story signals and category.
 * Two candidates are grouped when they share 2+ signals, or 1 signal + same category.
 */
export function detectClusters(candidates: FetchedCandidate[]): ClusterResult[] {
  if (candidates.length < 2) return [];

  const clusters: ClusterResult[] = [];
  const clustered = new Set<string>();

  for (const pivot of candidates) {
    if (clustered.has(pivot.sourceUrl)) continue;
    const pivotSigs = pivot.storySignals ?? [];
    if (pivotSigs.length === 0) continue;

    const peers = candidates.filter((c) => {
      if (c.sourceUrl === pivot.sourceUrl) return false;
      const cs      = c.storySignals ?? [];
      const overlap = pivotSigs.filter((s) => cs.includes(s)).length;
      return overlap >= 2 || (c.category === pivot.category && overlap >= 1);
    });

    if (peers.length === 0) continue;

    const group       = [pivot, ...peers];
    const sharedSigs  = pivotSigs.filter((s) => peers.some((p) => (p.storySignals ?? []).includes(s)));
    if (sharedSigs.length === 0) continue;

    const allSameCategory = group.every((c) => c.category === pivot.category);
    for (const c of group) clustered.add(c.sourceUrl);

    clusters.push({
      label:          toLabel(sharedSigs[0]),
      candidateUrls:  group.map((c) => c.sourceUrl),
      sharedSignals:  sharedSigs,
      sharedCategory: allSameCategory ? pivot.category : undefined,
    });
  }

  return clusters;
}
