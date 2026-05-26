/**
 * Template-based recovery summary generator.
 *
 * No fabrication. Only combines fields the scanner already computed:
 * attribution, archive date, signal annotations, corroboration notes, summary text.
 */

import type { FetchedCandidate } from './scanner-fetch-types';

/**
 * Generate a default post body for a recovered candidate.
 * Returns a ready-to-edit string the curator can refine before publishing.
 */
export function generateRecoveredSummary(candidate: FetchedCandidate): string {
  const lines: string[] = [];

  // Attribution header
  if (candidate.attributionText) {
    lines.push(candidate.attributionText);
  }

  // Archive snapshot date
  if (candidate.isArchived && candidate.archivedAt) {
    const date = new Date(candidate.archivedAt);
    const formatted = date.toLocaleDateString('en-US', {
      year: 'numeric', month: 'long', day: 'numeric',
    });
    lines.push(`Archived snapshot: ${formatted}`);
  }

  // Narrative signal badges
  const signals = candidate.storySignals ?? [];
  if (signals.length > 0) {
    lines.push(`Detected signals: ${signals.join(', ')}`);
  }

  // Story score (only surface if strong enough to be meaningful)
  if (candidate.storyScore != null && candidate.storyScore >= 15) {
    lines.push(`Story strength: ${candidate.storyScore}/100`);
  }

  // Priority score if elevated
  if (
    candidate.finalPriorityScore != null &&
    candidate.storyScore != null &&
    candidate.finalPriorityScore > candidate.storyScore
  ) {
    lines.push(`Priority score: ${candidate.finalPriorityScore}/100 (boosted by corroboration/archive)`);
  }

  // Corroboration
  if (candidate.corroborationScore != null && candidate.corroborationScore > 0) {
    lines.push(`Corroboration: ${candidate.corroborationScore}/30`);
    if (candidate.corroborationNotes && candidate.corroborationNotes.length > 0) {
      lines.push(candidate.corroborationNotes.slice(0, 3).join('; '));
    }
  }

  // Reddit context
  if (candidate.redditSubreddit) {
    const parts: string[] = [`r/${candidate.redditSubreddit}`];
    if (candidate.redditAuthor)   parts.push(`u/${candidate.redditAuthor}`);
    if (candidate.redditScore)    parts.push(`${candidate.redditScore}↑`);
    if (candidate.redditComments) parts.push(`${candidate.redditComments} comments`);
    lines.push(parts.join(' · '));
  }

  // Summary body
  if (candidate.summary?.trim()) {
    lines.push('');
    lines.push(candidate.summary.slice(0, 1000));
  }

  return lines.join('\n').trim();
}
