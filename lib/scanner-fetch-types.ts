/**
 * Types shared between app/actions.ts (server) and ScannerSourcesClient.tsx (client).
 * Kept in a plain lib file so both sides can import without crossing the
 * 'use server' / 'use client' boundary at the type level.
 */

export interface FetchedCandidate {
  title:        string;  // cleaned page title
  summary:      string;  // meta description + attribution
  sourceUrl:    string;  // canonical URL or base_url
  category:     string;  // suggested from source.category_focus[0]
  tags:         string[];
  anomalyScore: number;  // always 5 — curator sets the real score
  categoryNote: string;  // e.g. "matched 2 keywords: ufo, paranormal"
}

export interface SignalDuplicate {
  id:        string;
  title:     string;
  sourceUrl: string | null;
  status:    string;
}
