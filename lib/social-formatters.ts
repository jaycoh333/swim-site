/**
 * social-formatters.ts — pure formatting functions for social posts.
 *
 * No API calls. No side effects. Safe to import in client components.
 *
 * Used by:
 *   - components/SignalQueueClient.tsx (share package preview)
 *   - lib/social-poster.ts (stub) → real posters when implemented
 *
 * See docs/social-automation-plan.md for the full integration plan.
 */

const SITE_BASE = 'https://www.sw1m.me';

export interface ThreadShareData {
  title:            string;
  category:         string;
  summary:          string;
  threadSlug:       string;
  sourceName?:      string;
  anomalyScore?:    number;
  tags?:            string[];
  hasEvidence?:     boolean;
  attributionText?: string;
}

// ---------------------------------------------------------------------------
// Telegram
//
// No hard limit. Target ≤500 chars for channel readability.
// Plain text — no markdown, no HTML parse_mode required.
// ---------------------------------------------------------------------------

export function formatTelegramPost(data: ThreadShareData): string {
  const url = `${SITE_BASE}/threads/${data.threadSlug}`;

  const preview =
    data.summary.length > 200
      ? data.summary.slice(0, 197) + '...'
      : data.summary;

  const lines: string[] = [
    `RECOVERED SIGNAL // ${data.category.toUpperCase()}`,
    '',
    `"${data.title}"`,
    '',
    preview,
  ];

  if (data.sourceName) {
    lines.push('', `Source: ${data.sourceName}`);
  }
  if (data.attributionText) {
    lines.push(`Credit: ${data.attributionText}`);
  }
  if (data.anomalyScore !== undefined) {
    lines.push(`Anomaly score: ${data.anomalyScore}/10`);
  }
  if (data.hasEvidence) {
    lines.push('Evidence attached — see full thread');
  }
  if (data.tags && data.tags.length > 0) {
    lines.push('', `─ ${data.tags.slice(0, 4).join(' · ')}`);
  }

  lines.push('', `Read the archive: ${url}`);

  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// X (Twitter)
//
// Hard limit: 280 characters.
// Counts full URL length (conservative — t.co wrapping will save chars).
// ---------------------------------------------------------------------------

export function formatXPost(data: ThreadShareData): string {
  const url = `${SITE_BASE}/threads/${data.threadSlug}`;
  const header = `RECOVERED SIGNAL // ${data.category.toUpperCase()}`;
  const suffix = `\n\n${url}`;

  // Budget: 280 − header − 2 newlines after header − quotes − suffix
  const budget = 280 - header.length - 2 - 2 - suffix.length;
  const title =
    data.title.length <= budget
      ? data.title
      : data.title.slice(0, budget - 1) + '…';

  return `${header}\n\n"${title}"${suffix}`;
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** Returns how many chars the X post uses (for UI character counter). */
export function xPostCharCount(data: ThreadShareData): number {
  return formatXPost(data).length;
}

/** Returns true if the title was truncated in the X post. */
export function xPostTitleTruncated(data: ThreadShareData): boolean {
  const url = `${SITE_BASE}/threads/${data.threadSlug}`;
  const header = `RECOVERED SIGNAL // ${data.category.toUpperCase()}`;
  const suffix = `\n\n${url}`;
  const budget = 280 - header.length - 2 - 2 - suffix.length;
  return data.title.length > budget;
}
