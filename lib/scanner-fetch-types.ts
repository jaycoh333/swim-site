/**
 * Types shared between app/actions.ts (server) and ScannerSourcesClient.tsx (client).
 * Kept in a plain lib file so both sides can import without crossing the
 * 'use server' / 'use client' boundary at the type level.
 */

export type ExtractionConfidence = 'low' | 'medium' | 'high';

export interface FetchedCandidate {
  title:                string;  // cleaned page title
  summary:              string;  // meta description or readable snippet
  sourceUrl:            string;  // canonical URL or base_url
  category:             string;  // suggested from source.category_focus[0]
  tags:                 string[];
  anomalyScore:         number;  // always 5 — curator sets the real score
  categoryNote:         string;  // e.g. "matched 2 keywords: ufo, paranormal"
  extractionConfidence: ExtractionConfidence;   // quality rating of the extracted data
  extractionWarning?:   string;  // set when confidence is low
  isIndexPage?:         boolean; // true when URL is a root/index or generic front page
  sourceType?:          string;  // 'wayback' | 'mediawiki' | 'reddit' | etc — display badge
  isArchived?:          boolean; // true when the URL is a Wayback Machine archive link
  archivedAt?:          string;  // ISO date string when the snapshot was captured
  passReason?:          string;  // why the candidate passed quality filters
  badCandidateReason?:  string;  // set when extraction looks like nav/index junk — blocks queueing
  // Evidence context (URLs only — no binary stored)
  sourceImageUrl?:      string;  // og:image or twitter:image — absolute URL
  mediaType?:           string;  // 'image' if sourceImageUrl found, else 'webpage'
  attributionText?:     string;  // auto-generated: "Recovered from {name} · {type} source"
  captureNotes?:        string;  // auto-generated capture context
}

export interface SignalDuplicate {
  id:        string;
  title:     string;
  sourceUrl: string | null;
  status:    string;
}

// Discovered link from a limited-depth source scan (max 5, same-domain, no recursion).
export interface DiscoveredLink {
  url:         string;
  linkText:    string;
  matchReason: string;
}

// Discriminated union — one result per source in a fetch session.
// 'preview'   — extracted candidate, no duplicates found
// 'duplicate' — extracted candidate, but similar signals exist in the queue
// 'error'     — fetch or extraction failed; nothing is written to DB
export type SessionSourceResult =
  | { sourceId: string; sourceName: string; status: 'preview';   candidate: FetchedCandidate }
  | { sourceId: string; sourceName: string; status: 'duplicate'; candidate: FetchedCandidate; duplicates: SignalDuplicate[] }
  | { sourceId: string; sourceName: string; status: 'error';     error: string };
