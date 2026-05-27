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
  qualityTier?:         'strong' | 'soft-pass'; // 'strong' = passed full gate; 'soft-pass' = low-confidence but includeable
  badCandidateReason?:  string;  // set when extraction looks like nav/index junk — blocks queueing
  // Evidence context (URLs only — no binary stored)
  sourceImageUrl?:      string;  // og:image or twitter:image — absolute URL
  mediaType?:           string;  // 'image' if sourceImageUrl found, else 'webpage'
  attributionText?:     string;  // auto-generated: "Recovered from {name} · {type} source"
  captureNotes?:        string;  // auto-generated capture context
  // Reddit-specific structured evidence (populated by reddit connector)
  redditSubreddit?:     string;
  redditAuthor?:        string;
  redditScore?:         number;
  redditComments?:      number;
  redditPostedAt?:      string;  // ISO date YYYY-MM-DD
  // Wayback-specific structured evidence
  originalDomain?:      string;  // hostname of the original pre-archive URL
  // Story intelligence scoring (populated by server-side heuristics — no AI)
  storyScore?:          number;    // 0–100 combined story quality score
  storySignals?:        string[];  // detected signals: ['eyewitness', 'corroborated', ...]
  // Corroboration (Reddit comment tree analysis — only populated for strong Reddit candidates)
  corroborationScore?:  number;    // 0–30 from comment pattern analysis
  corroborationNotes?:  string[];  // detected patterns: ['"same thing happened to me"', ...]
  // Composite priority (story + corroboration + archive/source bonus)
  finalPriorityScore?:  number;    // 0–100 composite score for curator triage
  // Deep Archive / Origin scan fields (Phase O)
  originPriorityScore?: number;    // 0–100 boosted score for pre-2010 / old-web / BBS content
  sourceEra?:           string;    // '1990s web' | 'early 2000s' | 'pre-social archive' | 'bbs archive' | 'modern source'
  archiveYear?:         number;    // year of archive capture (derived from Wayback timestamp)
  // Phase V origin fields
  topicGroup?:          string;    // topic group ID that surfaced this candidate (e.g. 'ufo-disclosure')
  topicGroupName?:      string;    // human-readable topic group name (e.g. 'UFO / Disclosure')
  firstSeenYear?:       number;    // earliest known year this content appeared online
}

export interface SignalDuplicate {
  id:        string;
  title:     string;
  sourceUrl: string | null;
  status:    string;
}

// Discovered link from a limited-depth source scan (max 5, same-domain, no recursion).
export interface DiscoveredLink {
  url:            string;
  linkText:       string;
  matchReason:    string;
  topicGroup?:    string;  // Phase V: topic group ID that found this link
  topicGroupName?: string; // Phase V: human-readable topic group name
}

// Discriminated union — one result per source in a fetch session.
// 'preview'   — extracted candidate, no duplicates found
// 'duplicate' — extracted candidate, but similar signals exist in the queue
// 'error'     — fetch or extraction failed; nothing is written to DB
export type SessionSourceResult =
  | { sourceId: string; sourceName: string; status: 'preview';   candidate: FetchedCandidate }
  | { sourceId: string; sourceName: string; status: 'duplicate'; candidate: FetchedCandidate; duplicates: SignalDuplicate[] }
  | { sourceId: string; sourceName: string; status: 'error';     error: string };

export interface RejectedPost {
  title:           string;
  url?:            string;
  rejectReason:    string;
  storyScore?:     number;
  redditScore?:    number;
  redditComments?: number;
}

export interface EndpointResult {
  endpoint:   string;
  status:     number;
  childCount: number;
  ok:         boolean;
  error?:     string;
  timing?:    number; // ms
}

export interface SourceDiagnostic {
  sourceId:            string;
  sourceName:          string;
  sourceType:          string;
  enabled:             boolean;
  baseUrl:             string;
  routeUsed:           string;
  linksDiscovered:     number;
  pagesFetched:        number;
  candidatesPassed:    number;
  candidatesRejected:  number;
  rejectReasons:       string[];
  rejectedCandidates?: RejectedPost[];
  subreddit?:          string;
  searchQuery?:        string;
  endpointsAttempted?: string[];
  endpointResults?:    EndpointResult[];
  errorMessage?:       string;
}
