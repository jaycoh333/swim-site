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

// Discriminated union — one result per source in a fetch session.
// 'preview'   — extracted candidate, no duplicates found
// 'duplicate' — extracted candidate, but similar signals exist in the queue
// 'error'     — fetch or extraction failed; nothing is written to DB
export type SessionSourceResult =
  | { sourceId: string; sourceName: string; status: 'preview';   candidate: FetchedCandidate }
  | { sourceId: string; sourceName: string; status: 'duplicate'; candidate: FetchedCandidate; duplicates: SignalDuplicate[] }
  | { sourceId: string; sourceName: string; status: 'error';     error: string };
