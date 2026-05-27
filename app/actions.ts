'use server';

/**
 * Server Actions — thin wrappers around the repository.
 *
 * Runs server-side so the service role key (when present) stays out of the
 * client bundle.  Falls back to mock data when Supabase env vars are absent.
 *
 * Import from client components directly — Next.js handles the RPC boundary.
 */

import {
  createThread,
  createReply,
  addReaction,
  reportContent,
  updateSignalStatus,
  updateCuratorNotes,
  publishSignalAsThread,
  rebirthSignalAsThread,
  createRecoveredSignal,
  getScannerSources,
  getScannerSource,
  createScannerSource,
  updateScannerSource,
  toggleScannerSource,
  updateScannerSourceLastScanned,
  checkSignalDuplicates,
  getExistingSignalUrls,
  type CreateThreadInput,
  type CreateReplyInput,
  type AddReactionInput,
  type ReportContentInput,
  type UpdateSignalStatusInput,
  type CreateRecoveredSignalInput,
  type RebirthSignalInput,
  type CreateScannerSourceInput,
  type UpdateScannerSourceInput,
} from '@/lib/supabase/repository';
import type { FetchedCandidate, SignalDuplicate, SessionSourceResult, DiscoveredLink, RejectedPost, SourceDiagnostic, EndpointResult } from '@/lib/scanner-fetch-types';
import type { DbScannerSource } from '@/lib/supabase/types';
import {
  searchWaybackSnapshots,
  waybackTimestampToIso,
  searchMediaWikiArticles,
  fetchMediaWikiArticle,
} from '@/lib/discovery-apis';
import {
  scoreRedditQuality,
  extractNarrative,
  scoreStoryHeuristics,
} from '@/lib/story-intelligence';
import { computeFinalPriorityScore } from '@/lib/discovery-engine';
import { DEBUG_TEST_CANDIDATES } from '@/lib/debug-test-candidates';
import { recordSourceResult } from '@/lib/source-health';
import {
  classifySourceTaxonomy,
  detectFictionOrLarp,
  detectDocumentSignals,
  isDeepSourceTarget,
} from '@/lib/source-taxonomy';
import { loadSeenUrls, recordSeenUrls, getScanMemoryStats, clearScanMemory } from '@/lib/scan-memory';
import type { ScanMemoryStats } from '@/lib/scan-memory';
import { pickRandomTopicGroup } from '@/lib/origin-topic-seeds';
import { generateSignalFingerprint, detectLineageRelationships, recordCandidateLineage } from '@/lib/signal-lineage';

// ---------------------------------------------------------------------------
// URL normalization — strip tracking params, normalize host, drop fragments.
// ---------------------------------------------------------------------------
function normalizeUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname === 'old.reddit.com' || u.hostname === 'www.reddit.com') {
      u.hostname = 'reddit.com';
    }
    u.hostname = u.hostname.toLowerCase();
    const TRACKING = [
      'utm_source','utm_medium','utm_campaign','utm_term','utm_content',
      'fbclid','gclid','ref','source','_ga','mc_cid','mc_eid','share_id',
    ];
    for (const p of TRACKING) u.searchParams.delete(p);
    u.hash = '';
    let pn = u.pathname;
    while (pn.endsWith('/') && pn.length > 1) pn = pn.slice(0, -1);
    u.pathname = pn;
    return u.toString();
  } catch {
    return url.toLowerCase().replace(/\/$/, '');
  }
}

export async function createThreadAction(
  input: CreateThreadInput,
): Promise<{ id: string } | { error: string }> {
  return createThread(input);
}

export async function createReplyAction(
  input: CreateReplyInput,
): Promise<{ id: string } | { error: string }> {
  return createReply(input);
}

export async function addReactionAction(
  input: AddReactionInput,
): Promise<{ ok: true } | { error: string }> {
  return addReaction(input);
}

// Reports are stored anonymously — no reporter identity is recorded.
// Admin review UI is a future phase; for now reports are visible directly in Supabase.
export async function reportContentAction(
  input: ReportContentInput,
): Promise<{ ok: true } | { error: string }> {
  return reportContent(input);
}

// Curator action — save local-only notes on a recovered signal.
// curator_notes is never shown publicly. Requires the curator_notes column
// (see schema migration note in lib/supabase/types.ts).
export async function updateCuratorNotesAction(
  id:    string,
  notes: string,
): Promise<{ ok: true } | { error: string }> {
  return updateCuratorNotes(id, notes);
}

// Curator action — approve, archive, or reject a recovered signal.
// Requires service role key (env: SUPABASE_SERVICE_ROLE_KEY).
// TELEGRAM / X INTEGRATION POINT:
//   When status='approved', a future webhook or cron reads the signal and
//   queues it for the Telegram/X posting pipeline.
//   Human approval here is the mandatory gate before any public post goes out.
export async function updateSignalStatusAction(
  input: UpdateSignalStatusInput,
): Promise<{ ok: true } | { error: string }> {
  return updateSignalStatus(input);
}

// Public action — submit a found signal for curator review.
// Anomaly score is fixed at 5 (curators set the real score during review).
// Honeypot field (_hp) must be empty — bots that fill it get a fake success.
// All public submissions start as status='pending'.
//
// SAFETY GATE: no content is published from this path without a curator
// approving the signal and then explicitly clicking [ publish to thread ].
export async function createPublicSignalAction(input: {
  title:           string;
  summary:         string;
  category:        string;
  sourceName:      string;
  sourceUrl?:      string;
  sourceType:      import('@/lib/supabase/types').SignalSourceType;
  tags?:           string[];
  sourceImageUrl?: string;
  _hp:             string;  // honeypot — must be empty string
}): Promise<{ ok: true } | { error: string }> {
  // Honeypot: bots fill this. Return fake success so they think it worked.
  if (input._hp) return { ok: true };

  const { _hp: _ignored, ...rest } = input;
  const result = await createRecoveredSignal({ ...rest, anomalyScore: 5, submittedPublicly: true });
  if ('error' in result) return { error: result.error };
  return { ok: true };
}

// Curator action — manually intake a new recovered signal.
// Signals created here default to status='pending'.
// All fields are validated server-side; no content restrictions bypass applies.
//
// SAFETY GATE: summarize don't copy; no PII; no illegal instructions.
// See docs/scanner-source-registry.md for intake guidelines.
export async function createRecoveredSignalAction(
  input: CreateRecoveredSignalInput,
): Promise<{ id: string } | { error: string }> {
  return createRecoveredSignal(input);
}

// ---------------------------------------------------------------------------
// Scanner source registry — curator-only CRUD.
//
// STATUS: REGISTRY ONLY — enabling a source does NOT trigger any automated
// fetch. These actions manage the registry of candidate sources only.
// ---------------------------------------------------------------------------

export async function getScannerSourcesAction(): Promise<
  import('@/lib/supabase/types').DbScannerSource[]
> {
  return getScannerSources();
}

export async function createScannerSourceAction(
  input: CreateScannerSourceInput,
): Promise<{ id: string } | { error: string }> {
  return createScannerSource(input);
}

export async function updateScannerSourceAction(
  input: UpdateScannerSourceInput,
): Promise<{ ok: true } | { error: string }> {
  return updateScannerSource(input);
}

export async function toggleScannerSourceAction(
  id:      string,
  enabled: boolean,
): Promise<{ ok: true } | { error: string }> {
  return toggleScannerSource(id, enabled);
}

// ---------------------------------------------------------------------------
// Manual fetch prototype — safe, single-page, curator-supervised.
//
// TWO-PHASE FLOW (see docs/manual-fetch-prototype.md):
//   Phase 1 — fetchScannerSourcePreviewAction:
//     Fetches the page, extracts metadata, returns a FetchedCandidate.
//     Nothing is written to the database. Curator reviews + edits.
//   Phase 2 — queueFetchedCandidateAction:
//     Duplicate check → if clean, insert recovered_signal (status='pending').
//     Curator must then approve in /scanner/queue before anything goes public.
//
// STRICT LIMITS:
//   - One URL fetched per call — base_url only, no link following
//   - Raw HTML is NEVER stored — only extracted metadata is used
//   - Source must be explicitly enabled in the registry
//   - Curator must click [ queue candidate ] for any DB write to occur
// ---------------------------------------------------------------------------

interface ExtractedPageData {
  title:        string;
  description:  string;
  canonicalUrl: string;
  snippet:      string;
  imageUrl:     string;  // og:image or twitter:image absolute URL, empty string if none
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d{1,6});/g, (_, n: string) => String.fromCharCode(parseInt(n, 10)))
    .trim();
}

// Phase AE TASK 6: Extract the most narrative-dense paragraph from plain text.
// Defined early because extractPageData uses it for its snippet.
const NARRATIVE_SIGNALS_EARLY = [
  'i saw', 'i heard', 'i was', 'we were', 'they told', 'he said', 'she said',
  'the document', 'the file', 'the report', 'the signal', 'the incident',
  'classified', 'leaked', 'recovered', 'witnessed', 'observed',
  'suddenly', 'at that moment', 'without warning',
];
const SEO_JUNK_EARLY = [
  'click here', 'subscribe', 'follow us', 'share this', 'newsletter',
  'privacy policy', 'terms of service', 'all rights reserved',
  'sign up', 'log in', 'home page', 'back to top',
];
function extractBestParagraph(text: string, maxLen = 500): string {
  const paras = text
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, ' ').replace(/\s{2,}/g, ' ').trim())
    .filter((p) => p.length >= 60);

  if (paras.length === 0) return text.slice(0, maxLen).trim();

  let best = paras[0];
  let bestScore = 0;
  for (const p of paras) {
    const lc = p.toLowerCase();
    if (SEO_JUNK_EARLY.some((j) => lc.includes(j))) continue;
    let score = Math.min(p.length / 20, 20);
    for (const sig of NARRATIVE_SIGNALS_EARLY) if (lc.includes(sig)) score += 4;
    if (score > bestScore) { bestScore = score; best = p; }
  }
  return best.slice(0, maxLen);
}

function extractPageData(html: string, fallbackUrl: string): ExtractedPageData {
  const h = html.slice(0, 120_000);

  // JSON-LD structured data — highest fidelity when present
  let jsonLdTitle = '';
  let jsonLdDesc  = '';
  const jsonLdMatch = h.match(/<script[^>]{0,200}type=["']application\/ld\+json["'][^>]*>([\s\S]{1,8000}?)<\/script>/i);
  if (jsonLdMatch) {
    try {
      const ldRaw: unknown = JSON.parse(jsonLdMatch[1]);
      const ld = (Array.isArray(ldRaw) ? ldRaw[0] : ldRaw) as Record<string, unknown> | null;
      if (ld && typeof ld === 'object') {
        jsonLdTitle = typeof ld.headline    === 'string' ? ld.headline.slice(0, 200)
                    : typeof ld.name        === 'string' ? ld.name.slice(0, 200)
                    : '';
        jsonLdDesc  = typeof ld.description  === 'string' ? ld.description.slice(0, 600)
                    : typeof ld.articleBody  === 'string' ? ld.articleBody.slice(0, 600)
                    : '';
      }
    } catch { /* ignore malformed JSON-LD */ }
  }

  // Title — JSON-LD > og:title > <title>
  const ogTitle  = h.match(/<meta[^>]{0,300}property=["']og:title["'][^>]{0,300}content=["']([^"']{1,300})["']/i)
                ?? h.match(/<meta[^>]{0,300}content=["']([^"']{1,300})["'][^>]{0,300}property=["']og:title["']/i);
  const tagTitle = h.match(/<title[^>]{0,50}>([^<]{1,300})<\/title>/i);
  const title    = decodeHtmlEntities(jsonLdTitle || ogTitle?.[1] || tagTitle?.[1] || '');

  // Description — JSON-LD > og:description > meta[name=description] > twitter:description
  const ogDesc      = h.match(/<meta[^>]{0,300}property=["']og:description["'][^>]{0,300}content=["']([^"']{1,500})["']/i)
                   ?? h.match(/<meta[^>]{0,300}content=["']([^"']{1,500})["'][^>]{0,300}property=["']og:description["']/i);
  const metaDesc    = h.match(/<meta[^>]{0,300}name=["']description["'][^>]{0,300}content=["']([^"']{1,500})["']/i)
                   ?? h.match(/<meta[^>]{0,300}content=["']([^"']{1,500})["'][^>]{0,300}name=["']description["']/i);
  const twitterDesc = h.match(/<meta[^>]{0,300}name=["']twitter:description["'][^>]{0,300}content=["']([^"']{1,500})["']/i)
                   ?? h.match(/<meta[^>]{0,300}content=["']([^"']{1,500})["'][^>]{0,300}name=["']twitter:description["']/i);
  const description = decodeHtmlEntities(jsonLdDesc || ogDesc?.[1] || metaDesc?.[1] || twitterDesc?.[1] || '');

  // Canonical URL
  const canonical = h.match(/<link[^>]{0,300}rel=["']canonical["'][^>]{0,300}href=["']([^"']{1,500})["']/i)
                 ?? h.match(/<link[^>]{0,300}href=["']([^"']{1,500})["'][^>]{0,300}rel=["']canonical["']/i);
  const canonicalUrl = canonical?.[1]?.trim() ?? fallbackUrl;

  // Readable snippet — strip structural noise before extracting text
  // Step 1: remove entire nav/header/footer/aside/script/style/form/menu blocks
  let contentHtml = h
    .replace(/<(nav|header|footer|aside|script|style|noscript|iframe|form|select)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  // Step 2: prefer semantic content areas (<main>, <article>, or common content divs)
  const mainMatch =
    contentHtml.match(/<(?:main|article)[^>]*>([\s\S]{80,20000}?)<\/(?:main|article)>/i) ??
    contentHtml.match(/<div[^>]{0,200}(?:id|class)=["'][^"']{0,40}(?:content|body|post|entry|story)[^"']{0,40}["'][^>]*>([\s\S]{120,15000}?)<\/div>/i);
  const workHtml  = mainMatch ? mainMatch[1] : contentHtml;

  // Step 3: strip remaining tags, collapse whitespace, decode entities.
  // Extract best paragraph rather than just first 600 chars — TASK 6.
  const plainText = decodeHtmlEntities(
    workHtml
      .replace(/<blockquote[^>]*>[\s\S]*?<\/blockquote>/gi, '')
      .replace(/<[^>]{0,1000}>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim(),
  );
  const snippet = extractBestParagraph(plainText, 800);

  // Image URL — og:image > twitter:image  (absolute https:// URLs only; no binary stored)
  const ogImage  = h.match(/<meta[^>]{0,300}property=["']og:image["'][^>]{0,300}content=["']([^"']{1,500})["']/i)
                ?? h.match(/<meta[^>]{0,300}content=["']([^"']{1,500})["'][^>]{0,300}property=["']og:image["']/i);
  const twImage  = h.match(/<meta[^>]{0,300}name=["']twitter:image["'][^>]{0,300}content=["']([^"']{1,500})["']/i)
                ?? h.match(/<meta[^>]{0,300}content=["']([^"']{1,500})["'][^>]{0,300}name=["']twitter:image["']/i);
  const rawImage = (ogImage?.[1] ?? twImage?.[1] ?? '').trim();
  const imageUrl = /^https?:\/\//.test(rawImage) ? rawImage : '';

  return { title, description, canonicalUrl, snippet, imageUrl };
}

function cleanTitle(raw: string): string {
  let t = decodeHtmlEntities(raw).trim();
  // Strip common " | Site Name" / " — Site Name" / " · Site Name" / " - " / " :: " / " – " suffixes
  for (const sep of [' | ', ' — ', ' – ', ' · ', ' :: ', ' - ']) {
    const idx = t.lastIndexOf(sep);
    if (idx >= 12) {
      const suffix = t.slice(idx + sep.length).trim();
      if (suffix.length >= 2 && suffix.length <= 60) { t = t.slice(0, idx).trim(); break; }
    }
  }
  // Collapse multiple spaces
  t = t.replace(/\s{2,}/g, ' ').trim();
  return t.slice(0, 200);
}

function isGenericTitle(title: string): boolean {
  const lc = title.toLowerCase().trim();
  return (
    lc.length < 10 ||
    lc === 'home' || lc === 'index' || lc === 'welcome' || lc === 'untitled' ||
    /^(home|index|welcome|untitled)\s*[|–—\-·]/.test(lc) ||
    /^www\./.test(lc) ||
    lc.startsWith('http')
  );
}

function buildSummary(description: string, snippet: string): string {
  const desc = description.trim();
  const snip = snippet.trim();

  // Best case: meaningful description
  if (desc.length >= 60)                    return desc.slice(0, 2000);
  // Combine short description + snippet
  if (desc.length > 0 && snip.length >= 20) return `${desc}\n\n${snip}`.slice(0, 2000);
  // Snippet only
  if (snip.length >= 40)                    return snip.slice(0, 2000);
  // Short description only
  if (desc.length > 0)                      return desc;
  return 'No description extracted — edit manually before queueing.';
}

type ExtractionConfidenceLocal = 'low' | 'medium' | 'high';

function scoreExtractionConfidence(
  title:   string,
  summary: string,
): { confidence: ExtractionConfidenceLocal; warning: string | null } {
  const hasRealTitle   = title.trim().length >= 15 && !isGenericTitle(title);
  const hasGoodSummary = summary.length >= 80 && !summary.startsWith('No description extracted');
  const hasSomeSummary = summary.length >= 25 && !summary.startsWith('No description extracted');

  if (hasRealTitle && hasGoodSummary) return { confidence: 'high',   warning: null };
  if (hasRealTitle && hasSomeSummary) return { confidence: 'medium', warning: null };
  return {
    confidence: 'low',
    warning:    'Weak extraction — title or summary is missing or generic. Manual edit recommended.',
  };
}

function buildCategoryNote(categoryFocus: string[], title: string, description: string): string {
  if (!categoryFocus.length) return 'no category focus defined — set manually';
  const text = `${title} ${description}`.toLowerCase();
  const matched = categoryFocus.filter((cat) =>
    cat.toLowerCase().split(/\s+/).some((w) => w.length >= 4 && text.includes(w))
  );
  if (!matched.length) return `${categoryFocus[0]} (no keyword match — verify category)`;
  if (matched.length === 1) return `${matched[0]} (1 category match)`;
  return `${matched[0]} (matched ${matched.length}: ${matched.slice(0, 3).join(', ')})`;
}

// ---------------------------------------------------------------------------
// Phase AE — Deep Archive Extraction Engine helpers
// ---------------------------------------------------------------------------

// TASK 5: Conspiracy/origin vocabulary scoring.
// Returns a 0–25 bonus for pages containing buried-document language.
const CONSPIRACY_VOCAB = [
  'witness', 'witnesses', 'classified', 'leaked', 'recovered', 'underground',
  'disclosure', 'operation', 'project ', 'transmission', 'signal ', 'intercepted',
  'archive', 'incident', 'unexplained', 'redacted', 'coverup', 'cover-up',
  'declassified', 'whistleblower', 'informant', 'testimony', 'deposition',
  'experiment', 'document', 'evidence', 'confirmation', 'sighting', 'encounter',
  'abduction', 'implant', 'surveillance', 'intelligence', 'agency', 'military',
  'saucer', 'ufo', 'craft', 'entity', 'alien', 'contact', 'implant',
];
function computeConspiracyVocabBonus(text: string): number {
  const lc = text.toLowerCase();
  let hits = 0;
  for (const w of CONSPIRACY_VOCAB) {
    if (lc.includes(w)) hits++;
  }
  return Math.min(hits * 2, 25);
}

// TASK 2: Detect and extract old forum thread structure from HTML.
interface ForumExtract {
  isForumThread: boolean;
  opText?:       string;  // opening post text
  replyCount?:   number;
  bestReply?:    string;  // longest meaningful reply
  threadTitle?:  string;
}
function detectForumStructure(html: string): ForumExtract {
  const h = html.slice(0, 80_000);
  const lc = h.toLowerCase();

  // Detect forum indicators
  const forumIndicators = [
    'class="post"', 'class="message"', 'class="postbody"', 'class="postmessage"',
    'class="post-content"', 'class="post_body"', 'class="postText"',
    'id="post', 'data-postid', 'class="thread"', 'class="reply"',
    '<td class="post', 'class="userpost"', 'class="forumpost"',
    'posted by', 'joined:', 'posts:', 'member since',
  ];
  const isForumThread = forumIndicators.some((f) => lc.includes(f.toLowerCase()));

  if (!isForumThread) return { isForumThread: false };

  // Count posts/replies
  const postCountMatch = h.match(/(\d+)\s*(?:replies|posts|messages|responses)/i);
  const replyCount = postCountMatch ? parseInt(postCountMatch[1], 10) : undefined;

  // Extract post text blocks — look for common forum post containers
  const postBlockRe = /<(?:div|td)[^>]{0,200}(?:class|id)=["'][^"']{0,60}(?:post|message|postbody|postText|post-content)[^"']{0,60}["'][^>]*>([\s\S]{20,3000}?)<\/(?:div|td)>/gi;
  const posts: string[] = [];
  let pm: RegExpExecArray | null;
  while ((pm = postBlockRe.exec(h)) !== null && posts.length < 8) {
    const stripped = pm[1]
      .replace(/<(blockquote|div|table|script|style)[^>]*>[\s\S]*?<\/\1>/gi, '')
      .replace(/<[^>]{0,200}>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();
    if (stripped.length >= 40) posts.push(stripped);
  }

  if (posts.length === 0) return { isForumThread, replyCount };

  const opText   = posts[0].slice(0, 500);
  const bestReply = posts
    .slice(1)
    .sort((a, b) => b.length - a.length)[0]
    ?.slice(0, 400);

  return { isForumThread, opText, replyCount, bestReply };
}

// TASK 1/4: Deep content extraction for archive pages.
// Returns extended plain-text content, URL depth score, and content richness.
interface ArchiveContentResult {
  mainText:       string;   // best extracted body text (up to 1500 chars)
  urlDepthScore:  number;   // 0–15: deeper paths = better
  contentScore:   number;   // 0–20: longer, paragraph-rich = better
  isNavigationPage: boolean; // true if page looks like a category/portal/index
  forumData?:     ForumExtract;
}
function extractArchiveContent(html: string, url: string): ArchiveContentResult {
  const h = html.slice(0, 150_000);

  // URL depth scoring — more path segments = likely a content page
  let urlDepthScore = 0;
  try {
    const u = new URL(url);
    const segments = u.pathname.split('/').filter(Boolean);
    urlDepthScore = Math.min(segments.length * 3, 15);
    // Bonus for known content-path signals
    const deepSignals = ['/thread/', '/post/', '/article/', '/report/', '/file/', '/story/', '/view/', '/read/', '/doc/'];
    if (deepSignals.some((s) => u.pathname.toLowerCase().includes(s))) urlDepthScore = Math.min(urlDepthScore + 5, 15);
  } catch { /* ignore */ }

  // Navigation page detection
  const NAV_PATTERNS = [
    'class="index"', 'class="category"', 'class="categories"', 'class="portal"',
    'class="sitemap"', 'class="directory"', 'class="nav"', 'class="navigation"',
    '<ul class="menu', '<ul class="nav',
  ];
  const lc = h.toLowerCase();
  const isNavigationPage = NAV_PATTERNS.filter((p) => lc.includes(p)).length >= 2;

  // Strip Wayback toolbar, nav blocks, sidebars
  let contentHtml = h
    .replace(/<!-- BEGIN WAYBACK TOOLBAR INSERT -->[\s\S]*?<!-- END WAYBACK TOOLBAR INSERT -->/gi, '')
    .replace(/<(nav|header|footer|aside|script|style|noscript|iframe|form|select|ul[^>]{0,60}(?:class|id)=["'][^"']{0,40}(?:nav|menu|sidebar|related)[^"']{0,40}["'])[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  // Forum detection
  const forumData = detectForumStructure(contentHtml);

  // If it's a forum thread, build content from OP + best reply
  let mainText = '';
  if (forumData.isForumThread && forumData.opText) {
    const parts = [forumData.opText];
    if (forumData.bestReply) parts.push(`— Reply: ${forumData.bestReply}`);
    mainText = parts.join('\n\n').slice(0, 1500);
  }

  // Otherwise try semantic content areas, then <body>
  if (!mainText) {
    // Prefer <article>, <main>, then common content div patterns
    const contentMatch =
      contentHtml.match(/<(?:article|main)[^>]*>([\s\S]{120,20000}?)<\/(?:article|main)>/i) ??
      contentHtml.match(/<div[^>]{0,200}(?:id|class)=["'][^"']{0,40}(?:content|body|main|post|article|entry|story)[^"']{0,40}["'][^>]*>([\s\S]{120,15000}?)<\/div>/i);

    const workHtml = contentMatch ? contentMatch[1] : contentHtml;

    // Strip blockquote/quoted-reply junk, then extract text
    const stripped = workHtml
      .replace(/<blockquote[^>]*>[\s\S]*?<\/blockquote>/gi, '')
      .replace(/<(table|ul|ol|dl)[^>]{0,100}(?:nav|menu|list|related|sidebar)[^>]{0,100}>([\s\S]*?)<\/\1>/gi, '')
      .replace(/<[^>]{0,1000}>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    // Pick best paragraph rather than just first N chars
    mainText = extractBestParagraph(decodeHtmlEntities(stripped), 1500);
  }

  // Content quality score: paragraph count + length
  const paraCount = (mainText.match(/[.!?]\s+[A-Z]/g) ?? []).length;
  const contentScore = Math.min(Math.floor(mainText.length / 75) + paraCount, 20);

  return { mainText, urlDepthScore, contentScore, isNavigationPage, forumData };
}

// TASK 3: Parse a raw BBS text artifact — detect headers, extract best narrative section.
interface BBSArtifact {
  title:        string;       // derived from header or filename
  excerpt:      string;       // best narrative section (up to 600 chars)
  isIndexFile:  boolean;      // true if file looks like a dir/index listing
  headerLines:  string[];     // BBS header fields found (From, Subject, etc.)
  hasBBSHeader: boolean;
}
function parseBBSTextArtifact(rawText: string, filename: string, category: string): BBSArtifact {
  // Strip ANSI codes and control characters, normalise line endings
  const cleaned = rawText
    .replace(/\x1B\[[0-9;]*[A-Za-z]/g, '')
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    .replace(/\r\n/g, '\n').replace(/\r/g, '\n')
    .trim();

  // Index file detection — lots of filenames + sizes = directory listing
  const filenameLineCount = (cleaned.match(/^\S+\.(txt|doc|zip|com|exe|bas|asm)\s+\d/gim) ?? []).length;
  const isIndexFile = filenameLineCount >= 5 || cleaned.length < 80;

  // BBS header detection (Usenet / mailing list / BBS post format)
  const HEADER_PATTERNS = [/^From:\s*(.+)/im, /^Subject:\s*(.+)/im, /^Date:\s*(.+)/im, /^Message-ID:\s*(.+)/im, /^Organization:\s*(.+)/im, /^Newsgroups:\s*(.+)/im];
  const headerLines: string[] = [];
  for (const pat of HEADER_PATTERNS) {
    const m = cleaned.match(pat);
    if (m) headerLines.push(m[0].trim());
  }
  const hasBBSHeader = headerLines.length >= 2;

  // Extract title from Subject header, or filename
  let title = '';
  const subjectMatch = cleaned.match(/^Subject:\s*(.+)/im);
  if (subjectMatch) {
    title = subjectMatch[1].trim().replace(/^Re:\s*/i, '').slice(0, 80);
  }
  if (!title) {
    title = filename
      .replace(/\.txt$/i, '')
      .replace(/[-_.]/g, ' ')
      .replace(/\b([a-z])/g, (c) => c.toUpperCase())
      .trim()
      .slice(0, 80) || `BBS Archive · ${category}`;
  }

  // Find best narrative section — skip header block (first 10 lines if they look like headers)
  const lines = cleaned.split('\n');
  const bodyStartIdx = hasBBSHeader
    ? lines.findIndex((l, i) => i > 0 && l.trim() === '') + 1  // first blank line after headers
    : 0;
  const body = lines.slice(Math.max(bodyStartIdx, 0)).join('\n').trim();

  // Skip ASCII art blocks (more than 30% special chars = art/junk)
  const excerpt = extractBestParagraph(body.replace(/[|\\\/+\-=*#@^~<>]{4,}/g, ' '), 600);

  return { title, excerpt: excerpt.slice(0, 600), isIndexFile, headerLines, hasBBSHeader };
}

// TASK 7: Composite archive signal score — combines all AE signals into one 0–100 score.
interface ArchiveSignalOpts {
  archiveYear?:       number;
  sourceType?:        string;
  contentScore?:      number;   // 0–20 from extractArchiveContent
  urlDepthScore?:     number;   // 0–15
  isForumThread?:     boolean;
  hasBBSHeader?:      boolean;
  storyScore?:        number;   // 0–100 from scoreStoryHeuristics
  conspVocabBonus?:   number;   // 0–25 from computeConspiracyVocabBonus
  langBonus?:         number;   // –15 to +15 from computePreSocialLanguageBonus
  isPreSocialEra?:    boolean;
  isNavigationPage?:  boolean;
  contentLength?:     number;   // raw text char count
}
function computeArchiveSignalScore(opts: ArchiveSignalOpts): number {
  let score = 40; // neutral baseline

  // Age bonus
  if (opts.archiveYear != null) {
    if      (opts.archiveYear <= 1999) score += 25;
    else if (opts.archiveYear <= 2004) score += 18;
    else if (opts.archiveYear <= 2010) score += 12;
    else if (opts.archiveYear <= 2015) score +=  5;
    else                               score -= 10;
  }

  // Source type bonus
  if (opts.sourceType === 'bbs')          score += 20;
  else if (opts.sourceType === 'wayback') score +=  8;
  else if (opts.sourceType === 'archive') score +=  5;

  // Content quality signals
  if (opts.contentScore  != null) score += opts.contentScore;     // 0–20
  if (opts.urlDepthScore != null) score += opts.urlDepthScore;    // 0–15
  if (opts.isForumThread)         score += 12;
  if (opts.hasBBSHeader)          score += 10;
  if (opts.conspVocabBonus != null) score += opts.conspVocabBonus; // 0–25
  if (opts.langBonus       != null) score += opts.langBonus;       // –15 to +15

  // Story heuristics
  if (opts.storyScore != null) score += Math.floor(opts.storyScore / 5); // 0–20

  // Navigation/index page penalty
  if (opts.isNavigationPage) score -= 20;

  // Very short content penalty
  if (opts.contentLength != null && opts.contentLength < 150) score -= 15;

  return Math.min(Math.max(Math.round(score), 0), 100);
}

function toSignalSourceType(scannerType: string): import('@/lib/supabase/types').SignalSourceType {
  const map: Record<string, import('@/lib/supabase/types').SignalSourceType> = {
    archive: 'wayback', forum: 'forum', reddit: 'reddit',
    imageboard: 'imageboard', bbs: 'other', pastebin: 'pastebin',
    wayback: 'wayback', mediawiki: 'other', archive_forum: 'forum',
    irc: 'irc', other: 'other',
  };
  return map[scannerType] ?? 'other';
}

// ---------------------------------------------------------------------------
// Helpers shared by preview + session fetch paths
// ---------------------------------------------------------------------------

/** Returns true when a URL looks like a MediaWiki-based site. */
function isMediaWikiHost(url: string): boolean {
  const lc = url.toLowerCase();
  return (
    lc.includes('lostmediawiki') ||
    lc.includes('lost-media') ||
    lc.includes('/wiki/') ||
    lc.includes('wiki.') ||
    lc.endsWith('/wiki')
  );
}

/** Returns true when a source is Erowid Experience Vaults (by URL or name). */
function isErowidSource(source: { name: string; base_url: string | null }): boolean {
  const url  = (source.base_url ?? '').toLowerCase();
  const name = source.name.toLowerCase();
  return url.includes('erowid.org') || name.includes('erowid');
}

/**
 * Returns true ONLY for individual Erowid experience report URLs.
 * Format: https://erowid.org/experiences/exp.php?ID=XXXXX
 * Index/category/listing URLs return false.
 */
function isErowidReportUrl(url: string): boolean {
  try {
    const p = new URL(url);
    return p.hostname.includes('erowid.org') && p.pathname.toLowerCase().includes('/exp.php');
  } catch { return false; }
}

/** Human-readable error for sources that block direct HTML fetches. */
function blockedFetchError(status: number): string {
  return `HTTP ${status} — source blocked direct fetch. Use Discover Links or switch source type to Reddit/MediaWiki.`;
}

// ---------------------------------------------------------------------------
// Reddit comment corroboration — scan top-level comments for witness patterns
// ---------------------------------------------------------------------------

const CORROBORATION_PATTERNS: Array<{ re: RegExp; label: string; pts: number }> = [
  { re: /same thing happened to me/i,                       label: '"same thing happened to me"', pts: 8 },
  { re: /i (saw|experienced|witnessed) (this|something similar|the same)/i, label: 'first-person witness', pts: 7 },
  { re: /this happened to me|happened to me too/i,          label: '"this happened to me"',      pts: 7 },
  { re: /multiple people|several people|others have reported/i, label: 'multiple witnesses',     pts: 6 },
  { re: /i can confirm|can verify|confirmed by/i,           label: 'corroboration claim',        pts: 6 },
  { re: /not the only one|others (also|too|experienced)/i,  label: '"not the only one"',         pts: 5 },
  { re: /my (friend|partner|family|spouse|colleague) (saw|experienced|witnessed)/i, label: 'secondhand witness', pts: 4 },
];

async function fetchRedditCommentCorroboration(
  postUrl: string,
): Promise<{ corroborationScore: number; corroborationNotes: string[] }> {
  const idMatch = postUrl.match(/\/comments\/([a-z0-9]+)\//i);
  if (!idMatch) return { corroborationScore: 0, corroborationNotes: [] };

  const postId = idMatch[1];
  const apiUrl = `https://www.reddit.com/comments/${postId}.json?limit=100&depth=1&sort=top`;

  let data: unknown;
  try {
    const res = await fetch(apiUrl, {
      cache:   'no-store',
      headers: {
        'User-Agent': 'SWIM-Archive-Scout/1.0 (human-curator-supervised; research archive)',
        'Accept':     'application/json',
      },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { corroborationScore: 0, corroborationNotes: [] };
    data = await res.json();
  } catch {
    return { corroborationScore: 0, corroborationNotes: [] };
  }

  type RComment = { data: { body?: string; score?: number } };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const comments: RComment[] = (data as any)?.[1]?.data?.children ?? [];

  let totalScore = 0;
  const notes: string[] = [];
  const seen = new Set<string>();

  for (const { data: { body } } of comments) {
    if (!body || body === '[deleted]' || body === '[removed]') continue;
    for (const { re, label, pts } of CORROBORATION_PATTERNS) {
      if (!seen.has(label) && re.test(body)) {
        seen.add(label);
        totalScore += pts;
        notes.push(label);
      }
    }
    if (totalScore >= 30) break;
  }

  // High comment engagement bonus (many people engaged = signal)
  if (comments.length > 50) totalScore = Math.min(totalScore + 3, 30);

  return { corroborationScore: Math.min(totalScore, 30), corroborationNotes: notes };
}

// ---------------------------------------------------------------------------
// Reddit source preview — JSON API, one best-matching post
// ---------------------------------------------------------------------------

async function fetchRedditSourcePreview(
  source: DbScannerSource,
): Promise<{ candidate: FetchedCandidate } | { error: string }> {
  const urlMatch = (source.base_url ?? '').match(/\/r\/([A-Za-z0-9_]+)/i);
  if (!urlMatch) {
    return { error: 'Could not parse subreddit — set base_url to reddit.com/r/SubredditName' };
  }
  const subreddit = urlMatch[1];

  // Try www first, fallback to old.reddit.com (sometimes different rate-limit bucket)
  const endpoints = [
    `https://www.reddit.com/r/${subreddit}/new.json?limit=25`,
    `https://old.reddit.com/r/${subreddit}/new.json?limit=25`,
  ];

  let data: unknown;
  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, {
        cache:   'no-store',
        headers: {
          'User-Agent': 'SWIM-Archive-Scout/1.0 (human-curator-supervised; research archive)',
          'Accept':     'application/json',
        },
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) continue;
      data = await res.json();
      break;
    } catch { continue; }
  }

  if (!data) {
    return { error: `Reddit JSON fetch failed — r/${subreddit} may be private, quarantined, or removed` };
  }

  type RPost = {
    data: {
      title: string; permalink: string; selftext: string; score: number;
      num_comments: number; subreddit: string; author: string;
      created_utc: number; stickied: boolean; is_self: boolean; url: string;
      preview?: { images?: [{ source: { url: string } }] };
    };
  };
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const posts: RPost[] = (data as any)?.data?.children ?? [];

  // Apply story quality gate — require 2+ criteria
  const filtered = posts.filter(({ data: p }) => {
    const q = scoreRedditQuality({
      title: p.title, selftext: p.selftext ?? '', is_self: p.is_self,
      url: p.url, score: p.score, num_comments: p.num_comments,
      stickied: p.stickied, author: p.author,
    });
    return q.passes;
  });

  if (!filtered.length) {
    return { error: `No story-quality posts in r/${subreddit} — posts lack longform text, engagement, or anomaly content. Use Discover Links to browse manually.` };
  }

  // Score all filtered posts; pick the highest by story heuristics
  const scored = filtered.map(({ data: p }) => {
    const narrative = p.selftext?.trim() ? extractNarrative(p.selftext) : '';
    const heuristics = scoreStoryHeuristics(`${p.title} ${narrative}`);
    const criteriaBonus = Math.min(
      (p.selftext.trim().length > 300 ? 1 : 0) +
      (p.score > 20 ? 1 : 0) +
      (p.num_comments > 10 ? 1 : 0),
      3,
    ) * 8;
    return { p, narrative, heuristics, totalScore: heuristics.storyScore + criteriaBonus };
  });
  scored.sort((a, b) => b.totalScore - a.totalScore);
  const { p, narrative, heuristics } = scored[0];

  const qualityResult = scoreRedditQuality({
    title: p.title, selftext: p.selftext ?? '', is_self: p.is_self,
    url: p.url, score: p.score, num_comments: p.num_comments,
    stickied: p.stickied, author: p.author,
  });

  const cleanedTitle = (p.title.replace(/^\s*\[[^\]]{1,30}\]\s*/g, '').trim() || p.title).slice(0, 200);
  const summary = (narrative || p.selftext?.trim() ||
    `r/${p.subreddit} · ${p.score} points · ${p.num_comments} comments`
  ).slice(0, 2000);
  const rawImg   = p.preview?.images?.[0]?.source?.url;
  const imageUrl = rawImg ? rawImg.replace(/&amp;/g, '&') : undefined;
  const conf     = scoreExtractionConfidence(cleanedTitle, summary);
  const postUrl  = `https://www.reddit.com${p.permalink}`;
  const postedAt = new Date(p.created_utc * 1000).toISOString().slice(0, 10);
  const bad      = detectBadCandidate(postUrl, cleanedTitle, summary);

  // Phase AF: taxonomy classification for Reddit candidates
  const redditTaxonomy = classifySourceTaxonomy('reddit', source.name);

  const candidate: FetchedCandidate = {
    title:                cleanedTitle,
    summary,
    sourceUrl:            postUrl,
    category:             source.category_focus[0] ?? 'Internet Lore',
    tags:                 ['scanner-source', 'reddit', `r-${p.subreddit}`],
    anomalyScore:         5,
    categoryNote:         buildCategoryNote(source.category_focus, p.title, p.selftext),
    extractionConfidence: conf.confidence,
    extractionWarning:    conf.warning ?? undefined,
    sourceType:           'reddit',
    isArchived:           false,
    passReason:           qualityResult.passReason || `${p.score}↑`,
    badCandidateReason:   bad.bad ? bad.reason : undefined,
    sourceImageUrl:       imageUrl,
    mediaType:            imageUrl ? 'image' : 'webpage',
    attributionText:      `Recovered from r/${p.subreddit} · u/${p.author} · Reddit`,
    captureNotes:         `r/${p.subreddit} · u/${p.author} · ${p.score}↑ · ${p.num_comments} comments · posted ${postedAt}. Raw content not stored.`,
    redditSubreddit:      p.subreddit,
    redditAuthor:         p.author,
    redditScore:          p.score,
    redditComments:       p.num_comments,
    redditPostedAt:       postedAt,
    storyScore:           scored[0].totalScore,
    storySignals:         heuristics.storySignals.length > 0 ? heuristics.storySignals : undefined,
    sourceTaxonomy:       redditTaxonomy,
  };

  return { candidate };
}

// ---------------------------------------------------------------------------
// Reddit multi-candidate — /new + /top?t=week + /hot, top 10 quality posts
// ---------------------------------------------------------------------------

type RedditMultiDebugInfo = {
  subreddit: string;
  endpointsAttempted: string[];
  endpointResults: EndpointResult[];
  postsFound: number;
  postsPassedQuality: number;
  rejectReasons: string[];
};

async function fetchRedditMultipleCandidates(
  source: DbScannerSource,
  includeRejected = false,
  chaosMode = false,
  originBias = false,
): Promise<
  | { candidates: FetchedCandidate[]; rejected: RejectedPost[]; debugInfo: RedditMultiDebugInfo }
  | { error: string;                  rejected: RejectedPost[]; debugInfo: RedditMultiDebugInfo }
> {
  // Normalize: handle https://reddit.com/r/Sub/, r/Sub, /r/Sub
  const rawUrl   = source.base_url ?? '';
  const urlMatch = rawUrl.match(/(?:^|\/|\b)r\/([A-Za-z0-9_]+)/i);
  const emptyDebug: RedditMultiDebugInfo = { subreddit: '', endpointsAttempted: [], endpointResults: [], postsFound: 0, postsPassedQuality: 0, rejectReasons: ['invalid url'] };
  if (!urlMatch) {
    return { error: 'Could not parse subreddit — set base_url to reddit.com/r/SubredditName', rejected: [], debugInfo: emptyDebug };
  }
  const subreddit = urlMatch[1];

  // Sort-endpoint pool — shuffle each run so different sort windows get sampled.
  // Chaos mode adds controversial/week + rising for extra discovery surface.
  const sortPool = [
    `https://www.reddit.com/r/${subreddit}/new.json?limit=100`,
    `https://www.reddit.com/r/${subreddit}/hot.json?limit=100`,
    `https://www.reddit.com/r/${subreddit}/top.json?t=week&limit=100`,
    `https://www.reddit.com/r/${subreddit}/top.json?t=month&limit=100`,
    `https://www.reddit.com/r/${subreddit}/top.json?t=day&limit=100`,
    ...(chaosMode ? [
      `https://www.reddit.com/r/${subreddit}/controversial.json?t=week&limit=100`,
      `https://www.reddit.com/r/${subreddit}/rising.json?limit=100`,
    ] : []),
  ];
  // Fisher-Yates shuffle
  for (let i = sortPool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [sortPool[i], sortPool[j]] = [sortPool[j], sortPool[i]];
  }
  const endpoints = [
    ...sortPool,
    `https://old.reddit.com/r/${subreddit}/new.json?limit=100`, // fallback
  ];

  const debugEndpoints: string[] = [];
  const endpointResults: EndpointResult[] = [];

  type RPost = {
    data: {
      title: string; permalink: string; selftext: string; score: number;
      num_comments: number; subreddit: string; author: string;
      created_utc: number; stickied: boolean; is_self: boolean; url: string;
      preview?: { images?: [{ source: { url: string } }] };
    };
  };

  const seen    = new Set<string>();
  const allPosts: RPost[] = [];
  let newAfterToken = '';

  for (const endpoint of endpoints) {
    if (allPosts.length >= 120) break; // TASK 3: cap raw collection at 120
    const shortPath = endpoint.replace(/^https:\/\/[^/]+/, '');
    debugEndpoints.push(shortPath);
    const t0 = Date.now();
    const epResult: EndpointResult = { endpoint: shortPath, status: 0, childCount: 0, ok: false };
    try {
      let res = await fetch(endpoint, {
        cache:   'no-store',
        headers: {
          'User-Agent': 'SWIM-Archive-Scout/1.0 (human-curator-supervised; research archive)',
          'Accept':     'application/json',
        },
        signal: AbortSignal.timeout(12_000),
      });
      epResult.status = res.status;

      // Retry on rate-limit / forbidden with alternate UA
      if (res.status === 403 || res.status === 429) {
        try {
          const retry = await fetch(endpoint, {
            cache:   'no-store',
            headers: { 'User-Agent': 'SWIMArchiveBot/1.0', 'Accept': 'application/json' },
            signal:  AbortSignal.timeout(10_000),
          });
          if (retry.ok) { res = retry; epResult.status = retry.status; }
        } catch { /* keep original response */ }
      }

      if (!res.ok) { epResult.error = `HTTP ${res.status}`; endpointResults.push(epResult); continue; }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const json = (await res.json()) as any;
      const posts: RPost[] = json?.data?.children ?? [];
      epResult.childCount = posts.length;
      epResult.ok         = true;
      epResult.timing     = Date.now() - t0;
      endpointResults.push(epResult);
      if (chaosMode && endpoint.includes('/new.json') && json?.data?.after) {
        newAfterToken = json.data.after as string;
      }

      for (const post of posts) {
        if (!seen.has(post.data.permalink)) {
          seen.add(post.data.permalink);
          allPosts.push(post);
        }
      }
    } catch (err) {
      epResult.error = err instanceof Error ? err.message.slice(0, 80) : String(err).slice(0, 80);
      endpointResults.push(epResult);
      continue;
    }
  }

  // TASK 4: Chaos mode — fetch page 2 of /new.json for deeper discovery
  if (chaosMode && newAfterToken && allPosts.length < 180) {
    const page2Url = `https://www.reddit.com/r/${subreddit}/new.json?limit=100&after=${encodeURIComponent(newAfterToken)}`;
    try {
      const p2Res = await fetch(page2Url, {
        cache:   'no-store',
        headers: { 'User-Agent': 'SWIM-Archive-Scout/1.0 (human-curator-supervised; research archive)', 'Accept': 'application/json' },
        signal:  AbortSignal.timeout(12_000),
      });
      if (p2Res.ok) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p2Posts: RPost[] = ((await p2Res.json()) as any)?.data?.children ?? [];
        for (const post of p2Posts) {
          if (!seen.has(post.data.permalink)) {
            seen.add(post.data.permalink);
            allPosts.push(post);
          }
        }
        endpointResults.push({ endpoint: '/new.json?after=…', status: p2Res.status, childCount: p2Posts.length, ok: true });
      }
    } catch { /* page 2 failure is non-blocking */ }
  }

  // RSS fallback — titles only, last resort if all JSON endpoints failed
  if (allPosts.length === 0) {
    try {
      const rssUrl = `https://www.reddit.com/r/${subreddit}/new.rss?limit=100`;
      const rssRes = await fetch(rssUrl, {
        cache:   'no-store',
        headers: { 'User-Agent': 'SWIM-Archive-Scout/1.0', 'Accept': 'application/rss+xml,application/atom+xml,text/xml' },
        signal:  AbortSignal.timeout(10_000),
      });
      if (rssRes.ok) {
        const xml = await rssRes.text();
        const entries = xml.match(/<entry>([\s\S]*?)<\/entry>/g) ?? [];
        for (const entry of entries) {
          const titleM = entry.match(/<title[^>]*>(?:<!\[CDATA\[)?([\s\S]*?)(?:\]\]>)?<\/title>/);
          const linkM  = entry.match(/<link[^>]*href="([^"]+)"/);
          const authorM = entry.match(/<name>([\s\S]*?)<\/name>/);
          if (titleM?.[1] && linkM?.[1]) {
            const title = titleM[1].trim().replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"');
            const link  = linkM[1];
            const perm  = link.replace('https://www.reddit.com', '').replace('https://old.reddit.com', '');
            if (!seen.has(perm)) {
              seen.add(perm);
              allPosts.push({
                data: {
                  title, permalink: perm, selftext: '', score: 0, num_comments: 0,
                  subreddit, author: authorM?.[1]?.trim() ?? 'unknown',
                  created_utc: 0, stickied: false, is_self: true, url: link,
                }
              });
            }
          }
        }
        endpointResults.push({ endpoint: '/new.rss', status: rssRes.status, childCount: allPosts.length, ok: allPosts.length > 0 });
      }
    } catch { /* RSS also failed — handled below */ }
  }

  if (!allPosts.length) {
    return {
      error: `Reddit JSON fetch failed — r/${subreddit} may be private, quarantined, or removed`,
      rejected: [],
      debugInfo: { subreddit, endpointsAttempted: debugEndpoints, endpointResults, postsFound: 0, postsPassedQuality: 0, rejectReasons: ['fetch failed'] },
    };
  }

  // Shuffle collected posts before slicing — prevents sort-order bias so each
  // run can surface different stories even from the same subreddit.
  for (let i = allPosts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [allPosts[i], allPosts[j]] = [allPosts[j], allPosts[i]];
  }

  // Cap collection at 120 raw posts; origin bias pre-filters recent posts
  let postsToScore = allPosts.slice(0, 120);
  if (originBias) {
    // Phase W: hard cutoff at 1 year (was 6 months); exception threshold raised to 1000
    const ONE_YEAR_MS = 365 * 24 * 60 * 60 * 1000;
    const cutoff = Date.now() - ONE_YEAR_MS;
    // Keep posts older than 1 year, or exceptionally high-engagement posts
    postsToScore = postsToScore.filter((post) => {
      const ts = (post.data.created_utc ?? 0) * 1000;
      if (ts < cutoff) return true;           // old enough — keep
      if (post.data.score >= 1000) return true; // Phase W: raised exception threshold to 1000
      return false;
    });
  }

  const rejectedPosts: RejectedPost[] = [];
  const rejectReasonCounts = new Map<string, number>();

  const qualityMap = new Map<string, ReturnType<typeof scoreRedditQuality>>();

  const filtered = postsToScore.filter(({ data: p }) => {
    const q = scoreRedditQuality({
      title: p.title, selftext: p.selftext ?? '', is_self: p.is_self,
      url: p.url, score: p.score, num_comments: p.num_comments,
      stickied: p.stickied, author: p.author,
    });
    qualityMap.set(p.permalink, q);
    if (!q.passes && q.rejectReason) {
      rejectReasonCounts.set(q.rejectReason, (rejectReasonCounts.get(q.rejectReason) ?? 0) + 1);
      if (includeRejected) {
        rejectedPosts.push({
          title:          p.title.slice(0, 120),
          url:            `https://www.reddit.com${p.permalink}`,
          rejectReason:   q.rejectReason,
          redditScore:    p.score,
          redditComments: p.num_comments,
        });
      }
    }
    return q.passes;
  });

  const topRejectReasons = [...rejectReasonCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([reason, count]) => `${reason} (×${count})`);

  const baseDebugInfo: RedditMultiDebugInfo = {
    subreddit,
    endpointsAttempted: debugEndpoints,
    endpointResults,
    postsFound:         postsToScore.length,
    postsPassedQuality: filtered.length,
    rejectReasons:      topRejectReasons,
  };

  if (!filtered.length) {
    return {
      error: `No story-quality posts in r/${subreddit} — ${postsToScore.length} posts fetched, 0 passed quality gate. Top reject reasons: ${topRejectReasons.slice(0, 2).join('; ')}. Use Discover Links to browse manually.`,
      rejected: rejectedPosts,
      debugInfo: baseDebugInfo,
    };
  }

  const scored = filtered.map(({ data: p }) => {
    const narrative  = p.selftext?.trim() ? extractNarrative(p.selftext) : '';
    const heuristics = scoreStoryHeuristics(`${p.title} ${narrative}`);
    const criteriaBonus = Math.min(
      (p.selftext.trim().length > 300 ? 1 : 0) +
      (p.score > 20 ? 1 : 0) +
      (p.num_comments > 10 ? 1 : 0),
      3,
    ) * 8;
    // Jitter prevents the same top-scored posts from winning every run.
    const jitter = chaosMode
      ? (Math.random() * 40 - 20)  // ±20
      : (Math.random() * 20 - 10); // ±10

    // Origin bias: penalize posts newer than 90 days; heavily penalize <30 days
    let agePenalty = 0;
    let recentPenaltyNote: string | undefined;
    if (originBias && p.created_utc) {
      // Phase W: harder age penalties — Reddit is heavily penalized in origin mode
      const postAgeMs   = Date.now() - p.created_utc * 1000;
      const postAgeDays = postAgeMs / 86_400_000;
      if (postAgeDays < 365)        { agePenalty = 40; recentPenaltyNote = 'recent Reddit (-40 origin bias — <1yr)'; }
      else if (postAgeDays < 1095)  { agePenalty = 25; recentPenaltyNote = 'recent Reddit (-25 origin bias — <3yr)'; }
    }

    return { p, narrative, heuristics, totalScore: heuristics.storyScore + criteriaBonus + jitter - agePenalty, recentPenaltyNote };
  });
  scored.sort((a, b) => b.totalScore - a.totalScore);

  // Chaos mode expands candidate pool to 20; normal is 10.
  const candidateSlice = chaosMode ? 20 : 10;
  const rawCandidates: FetchedCandidate[] = scored.slice(0, candidateSlice).map(({ p, narrative, heuristics, totalScore, recentPenaltyNote }) => {
    const qualityResult = qualityMap.get(p.permalink) ?? scoreRedditQuality({
      title: p.title, selftext: p.selftext ?? '', is_self: p.is_self,
      url: p.url, score: p.score, num_comments: p.num_comments,
      stickied: p.stickied, author: p.author,
    });
    const cleanedTitle = (p.title.replace(/^\s*\[[^\]]{1,30}\]\s*/g, '').trim() || p.title).slice(0, 200);
    const summary      = (narrative || p.selftext?.trim() ||
      `r/${p.subreddit} · ${p.score} points · ${p.num_comments} comments`
    ).slice(0, 2000);
    const rawImg   = p.preview?.images?.[0]?.source?.url;
    const imageUrl = rawImg ? rawImg.replace(/&amp;/g, '&') : undefined;
    const conf     = scoreExtractionConfidence(cleanedTitle, summary);
    const postUrl  = `https://www.reddit.com${p.permalink}`;
    const postedAt = new Date(p.created_utc * 1000).toISOString().slice(0, 10);
    const bad      = detectBadCandidate(postUrl, cleanedTitle, summary);

    return {
      title:                cleanedTitle,
      summary,
      sourceUrl:            postUrl,
      category:             source.category_focus[0] ?? 'Internet Lore',
      tags:                 ['scanner-source', 'reddit', `r-${p.subreddit}`],
      anomalyScore:         5,
      categoryNote:         buildCategoryNote(source.category_focus, p.title, p.selftext),
      extractionConfidence: conf.confidence,
      extractionWarning:    recentPenaltyNote ?? conf.warning ?? undefined,
      sourceType:           'reddit',
      isArchived:           false,
      passReason:           qualityResult.passReason || `${p.score}↑`,
      qualityTier:          qualityResult.qualityTier,
      badCandidateReason:   bad.bad ? bad.reason : undefined,
      sourceImageUrl:       imageUrl,
      mediaType:            imageUrl ? 'image' : 'webpage',
      attributionText:      `Recovered from r/${p.subreddit} · u/${p.author} · Reddit`,
      captureNotes:         `r/${p.subreddit} · u/${p.author} · ${p.score}↑ · ${p.num_comments} comments · posted ${postedAt}. Raw content not stored.${recentPenaltyNote ? ` [${recentPenaltyNote}]` : ''}`,
      redditSubreddit:      p.subreddit,
      redditAuthor:         p.author,
      redditScore:          p.score,
      redditComments:       p.num_comments,
      redditPostedAt:       postedAt,
      storyScore:           totalScore,
      storySignals:         heuristics.storySignals.length > 0 ? heuristics.storySignals : undefined,
    };
  });

  // Corroboration — fetch comment trees for the top 3 strong candidates
  const candidates: FetchedCandidate[] = [];
  let corrobCount = 0;
  for (const cand of rawCandidates) {
    if (
      corrobCount < 3 &&
      !cand.badCandidateReason &&
      (cand.storyScore ?? 0) > 15
    ) {
      const corrob = await fetchRedditCommentCorroboration(cand.sourceUrl);
      const finalPriority = computeFinalPriorityScore(cand.storyScore ?? 0, {
        corroborationScore: corrob.corroborationScore,
        isArchived:         false,
      });
      candidates.push({
        ...cand,
        corroborationScore: corrob.corroborationScore > 0 ? corrob.corroborationScore : undefined,
        corroborationNotes: corrob.corroborationNotes.length > 0 ? corrob.corroborationNotes : undefined,
        finalPriorityScore: finalPriority,
      });
      corrobCount++;
    } else {
      candidates.push({
        ...cand,
        finalPriorityScore: computeFinalPriorityScore(cand.storyScore ?? 0),
      });
    }
  }

  return { candidates, rejected: rejectedPosts, debugInfo: { ...baseDebugInfo, postsPassedQuality: filtered.length } };
}

// ---------------------------------------------------------------------------
// MediaWiki source preview — search API + article extract, one best article
// ---------------------------------------------------------------------------

async function fetchMediaWikiSourcePreview(
  source: DbScannerSource,
): Promise<{ candidate: FetchedCandidate } | { error: string }> {
  // Strip any trailing /api.php or /wiki path so we have the clean base
  const baseUrl = (source.base_url ?? '').replace(/\/(api\.php|wiki\/?.*)$/, '');

  const query = source.category_focus.slice(0, 2).join(' ') || 'lost found mystery recovered';
  const searchResult = await searchMediaWikiArticles(baseUrl, query, 10);
  if ('error' in searchResult) return searchResult;

  if (!searchResult.results.length) {
    return { error: `No MediaWiki articles found for "${query}" on ${source.name}` };
  }

  // Pick first result with a reasonable snippet; skip disambiguation/stub pages
  const best =
    searchResult.results.find((r) => r.snippet.length >= 60) ??
    searchResult.results[0];

  const articleResult = await fetchMediaWikiArticle(baseUrl, best.title);
  if ('error' in articleResult) return articleResult;

  const { article } = articleResult;
  const title   = cleanTitle(article.title) || source.name;
  const summary = article.extract.trim() || best.snippet || 'No extract — edit manually.';
  const conf    = scoreExtractionConfidence(title, summary);
  const bad     = detectBadCandidate(article.url, title, summary);

  const heuristics = scoreStoryHeuristics(`${title} ${summary}`);

  const candidate: FetchedCandidate = {
    title:                title.slice(0, 200),
    summary:              summary.slice(0, 2000),
    sourceUrl:            article.url,
    category:             source.category_focus[0] ?? 'Internet Lore',
    tags:                 ['scanner-source', 'mediawiki'],
    anomalyScore:         5,
    categoryNote:         buildCategoryNote(source.category_focus, article.title, article.extract),
    extractionConfidence: conf.confidence,
    extractionWarning:    conf.warning ?? undefined,
    sourceType:           'mediawiki',
    isArchived:           false,
    passReason:           'MediaWiki API article',
    badCandidateReason:   bad.bad ? bad.reason : undefined,
    sourceImageUrl:       article.imageUrl || undefined,
    mediaType:            article.imageUrl ? 'image' : 'webpage',
    attributionText:      `Recovered from ${source.name} · MediaWiki`,
    captureNotes:         `MediaWiki article: "${article.title}". Plain-text extract only — raw wiki markup not stored.`,
    storyScore:           heuristics.storyScore,
    storySignals:         heuristics.storySignals.length > 0 ? heuristics.storySignals : undefined,
  };

  return { candidate };
}

// ---------------------------------------------------------------------------
// MediaWiki multi-candidate — up to 10 articles from search results
// ---------------------------------------------------------------------------

// Search terms tried on Lost Media Wiki when category_focus isn't specific enough.
const LOSTMEDIA_QUERIES = ['lost episode', 'partially found', 'lost media', 'unidentified broadcast', 'missing footage'];

async function fetchMediaWikiMultipleCandidates(
  source: DbScannerSource,
): Promise<{ candidates: FetchedCandidate[]; debugInfo: { searchQuery: string; searchResultCount: number; articlesFetched: number } } | { error: string; debugInfo: { searchQuery: string; searchResultCount: number; articlesFetched: number } }> {
  const baseUrl = (source.base_url ?? '').replace(/\/(api\.php|wiki\/?.*)$/, '').replace(/\/$/, '');

  // For Lost Media Wiki, try purpose-specific search terms; otherwise use category focus.
  const isLostMedia = baseUrl.toLowerCase().includes('lostmediawiki');
  const queries = isLostMedia
    ? LOSTMEDIA_QUERIES
    : [source.category_focus.slice(0, 2).join(' ') || 'lost found mystery recovered'];

  // Collect unique search results across all queries.
  const seenTitles = new Set<string>();
  const allSearchResults: import('@/lib/discovery-apis').MediaWikiSearchResult[] = [];
  let lastError = '';

  for (const q of queries) {
    const sr = await searchMediaWikiArticles(baseUrl, q, 15);
    if ('error' in sr) { lastError = sr.error; continue; }
    for (const r of sr.results) {
      if (!seenTitles.has(r.title)) { seenTitles.add(r.title); allSearchResults.push(r); }
    }
    if (allSearchResults.length >= 20) break;
  }

  const primaryQuery = queries[0];
  const wikiDebug = { searchQuery: queries.join(' | '), searchResultCount: allSearchResults.length, articlesFetched: 0 };

  if (!allSearchResults.length) {
    return { error: lastError || `No MediaWiki articles found for "${primaryQuery}" on ${source.name}`, debugInfo: wikiDebug };
  }

  const candidates: FetchedCandidate[] = [];
  for (const searchItem of allSearchResults.slice(0, 20)) {
    const articleResult = await fetchMediaWikiArticle(baseUrl, searchItem.title);
    if ('error' in articleResult) continue;

    const { article } = articleResult;
    const title   = cleanTitle(article.title) || source.name;
    const summary = article.extract.trim() || searchItem.snippet || 'No extract — edit manually.';
    const conf    = scoreExtractionConfidence(title, summary);
    const bad     = detectBadCandidate(article.url, title, summary);
    const heuristics = scoreStoryHeuristics(`${title} ${summary}`);

    candidates.push({
      title:                title.slice(0, 200),
      summary:              summary.slice(0, 2000),
      sourceUrl:            article.url,
      category:             source.category_focus[0] ?? 'Internet Lore',
      tags:                 ['scanner-source', 'mediawiki'],
      anomalyScore:         5,
      categoryNote:         buildCategoryNote(source.category_focus, article.title, article.extract),
      extractionConfidence: conf.confidence,
      extractionWarning:    conf.warning ?? undefined,
      sourceType:           'mediawiki',
      isArchived:           false,
      passReason:           'MediaWiki API article',
      badCandidateReason:   bad.bad ? bad.reason : undefined,
      sourceImageUrl:       article.imageUrl || undefined,
      mediaType:            article.imageUrl ? 'image' : 'webpage',
      attributionText:      `Recovered from ${source.name} · MediaWiki`,
      captureNotes:         `MediaWiki article: "${article.title}". Plain-text extract only — raw wiki markup not stored.`,
      storyScore:           heuristics.storyScore,
      storySignals:         heuristics.storySignals.length > 0 ? heuristics.storySignals : undefined,
    });
  }

  if (!candidates.length) {
    return { error: `Failed to fetch any articles from ${source.name}`, debugInfo: wikiDebug };
  }

  return { candidates, debugInfo: { ...wikiDebug, articlesFetched: candidates.length } };
}

// ---------------------------------------------------------------------------
// Bad-candidate guard — catches index/nav pages before they reach the DB
// ---------------------------------------------------------------------------

const NAV_WORDS = [
  'donate', 'donation', 'privacy policy', 'terms of service', 'terms of use',
  'contact us', 'about us', 'sign in', 'log in', 'sign up', 'register',
  'subscribe', 'newsletter', 'search results', 'page not found', '404',
  'cookies', 'accessibility', 'sitemap', 'all rights reserved',
];

function detectBadCandidate(
  url: string,
  title: string,
  summary: string,
): { bad: true; reason: string } | { bad: false } {
  const lcTitle   = title.toLowerCase();
  const lcSummary = summary.toLowerCase();

  // Erowid index/category/listing pages — only individual reports (exp.php?ID=) are allowed
  try {
    const p = new URL(url);
    if (p.hostname.includes('erowid.org') && !p.pathname.toLowerCase().includes('/exp.php')) {
      return {
        bad:    true,
        reason: 'Erowid index/category page — choose an individual experience report (exp.php?ID=...)',
      };
    }
  } catch { /* ignore */ }

  // Wayback homepage
  try {
    const parsed = new URL(url);
    if (parsed.hostname === 'web.archive.org' && (parsed.pathname === '/' || parsed.pathname === '')) {
      return { bad: true, reason: 'Wayback Machine homepage — not a story' };
    }
  } catch { /* ignore */ }

  // Title is "Wayback Machine" or derivative
  if (lcTitle.includes('wayback machine') || lcTitle === 'internet archive') {
    return { bad: true, reason: 'Wayback Machine index page — not a story' };
  }

  // Summary contains raw HTML fragments
  if (/<[a-z][\s\S]{0,60}>/i.test(summary) || summary.includes('</')) {
    return { bad: true, reason: 'Summary contains HTML fragments — extraction failed' };
  }

  // Summary looks like JSON/code
  if (/^\s*[\[{]/.test(summary) || summary.includes('"props"') || summary.includes('"children"')) {
    return { bad: true, reason: 'Summary contains JSON/component fragments — extraction failed' };
  }

  // Too many nav/menu words in summary (3+ distinct hits = nav page)
  const navHits = NAV_WORDS.filter((w) => lcSummary.includes(w));
  if (navHits.length >= 3) {
    return { bad: true, reason: `Navigation page detected (${navHits.slice(0, 3).join(', ')})` };
  }

  // Title includes "Wayback Machine" donation text
  if (lcSummary.includes('internet archive') && lcSummary.includes('donate')) {
    return { bad: true, reason: 'Internet Archive donation/nav page — not a story' };
  }

  return { bad: false };
}

/** Human-readable advice to show the curator when a bad candidate is blocked. */
const BAD_CANDIDATE_ADVICE =
  'This is an index or navigation page, not a story. Use Discover Links to find specific articles or threads.';

// ---------------------------------------------------------------------------
// Source-level guardrails — warn before fetching known bad source URLs
// ---------------------------------------------------------------------------

function sourceUrlWarning(source: { source_type: string; base_url: string | null }): string | null {
  const url = source.base_url ?? '';
  try {
    const parsed = new URL(url);
    // Wayback root — curators must supply a specific archived URL
    if (
      source.source_type === 'wayback' &&
      parsed.hostname === 'web.archive.org' &&
      (parsed.pathname === '/' || parsed.pathname === '' || parsed.pathname === '/web/')
    ) {
      return 'Add a specific archived URL or use Wayback discovery with a target domain (e.g. web.archive.org/web/*/example.com/*). The Wayback homepage is not a story source.';
    }
  } catch { /* ignore */ }
  return null;
}

// Phase 1 — fetch page and return candidate preview for curator review.
// No database writes. Curator must call queueFetchedCandidateAction to insert.
export async function fetchScannerSourcePreviewAction(
  sourceId: string,
): Promise<{ candidate: FetchedCandidate } | { error: string }> {
  const source = await getScannerSource(sourceId);
  if (!source)          return { error: 'source not found in registry' };
  if (!source.enabled)  return { error: 'source must be enabled before fetching' };
  if (!source.base_url) return { error: 'source has no base URL configured' };

  // Source-level guardrail — catch obviously bad source URLs before fetching
  const srcWarning = sourceUrlWarning(source);
  if (srcWarning) return { error: srcWarning };

  // Erowid — homepage is never a useful candidate; redirect curator to Discover Links
  if (isErowidSource(source)) {
    return {
      error:
        'Erowid homepage skipped — use Discover Links to find individual experience reports.',
    };
  }

  // Route to API connectors — avoids HTML fetches that get blocked or return garbage
  if (source.source_type === 'reddit' || REDDIT_HOST.test(new URL(source.base_url).hostname)) {
    return fetchRedditSourcePreview(source);
  }
  if (source.source_type === 'mediawiki' || isMediaWikiHost(source.base_url)) {
    return fetchMediaWikiSourcePreview(source);
  }

  let html: string;
  try {
    const response = await fetch(source.base_url, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'SWIM-Archive-Scout/1.0 (human-curator-supervised; research archive)',
        'Accept':     'text/html,application/xhtml+xml;q=0.9',
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) {
      const isBlocked = response.status === 403 || response.status === 401 || response.status === 429;
      return { error: isBlocked ? blockedFetchError(response.status) : `HTTP ${response.status} — ${response.statusText}` };
    }
    const ct = response.headers.get('content-type') ?? '';
    if (!ct.includes('text/html') && !ct.includes('xhtml')) {
      return { error: `expected HTML, got ${ct.split(';')[0].trim()}` };
    }
    html = await response.text();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `network error — ${msg}` };
  }

  // Extract metadata — raw HTML discarded after this point
  const extracted  = extractPageData(html, source.base_url);
  const title      = cleanTitle(extracted.title) || source.name;
  const summary    = buildSummary(extracted.description, extracted.snippet);
  const conf       = scoreExtractionConfidence(title, summary);
  const resolvedUrl = extracted.canonicalUrl || source.base_url;
  const urlPath    = (() => { try { return new URL(resolvedUrl).pathname; } catch { return '/'; } })();
  const isIndexPage = urlPath === '/' || urlPath === '' || isGenericTitle(title);
  const bad        = detectBadCandidate(resolvedUrl, title, summary);

  const heuristics = scoreStoryHeuristics(`${title} ${summary}`);

  const candidate: FetchedCandidate = {
    title:                title.slice(0, 200),
    summary:              summary.slice(0, 2000),
    sourceUrl:            resolvedUrl,
    category:             source.category_focus[0] ?? 'Internet Lore',
    tags:                 ['scanner-source', source.source_type],
    anomalyScore:         5,
    categoryNote:         buildCategoryNote(source.category_focus, extracted.title, extracted.description),
    extractionConfidence: conf.confidence,
    extractionWarning:    conf.warning ?? undefined,
    isIndexPage,
    badCandidateReason:   bad.bad ? bad.reason : (isIndexPage ? 'Index/homepage detected' : undefined),
    sourceImageUrl:       extracted.imageUrl || undefined,
    mediaType:            extracted.imageUrl ? 'image' : 'webpage',
    attributionText:      `Recovered from ${source.name} · ${source.source_type} source`,
    captureNotes:         'Captured from source preview during manual scanner fetch. Raw HTML not stored.',
    storyScore:           heuristics.storyScore,
    storySignals:         heuristics.storySignals.length > 0 ? heuristics.storySignals : undefined,
  };

  return { candidate };
}

// Phase 2 — duplicate check then insert. Curator has reviewed + edited the preview.
// Returns duplicateWarning if duplicates found (unless overrideDuplicate=true).
export async function queueFetchedCandidateAction(input: {
  sourceId:           string;
  title:              string;
  summary:            string;
  sourceUrl:          string;
  category:           string;
  tags:               string[];
  anomalyScore:       number;
  overrideDuplicate?: boolean;
  sourceImageUrl?:    string;
  mediaType?:         string;
  attributionText?:   string;
  captureNotes?:      string;
}): Promise<
  | { signalId: string; title: string; url: string; scannedAt: string }
  | { duplicateWarning: true; duplicates: SignalDuplicate[] }
  | { error: string }
> {
  const source = await getScannerSource(input.sourceId);
  if (!source) return { error: 'source not found' };

  // Hard block — reject index/nav/junk pages before they reach the DB.
  // Curator must use Discover Links to find real story URLs.
  const bad = detectBadCandidate(input.sourceUrl, input.title, input.summary);
  if (bad.bad) {
    return { error: `${BAD_CANDIDATE_ADVICE} (detected: ${bad.reason})` };
  }

  // Duplicate check — skip if curator has explicitly overridden
  if (!input.overrideDuplicate) {
    const dupes = await checkSignalDuplicates(input.sourceUrl, input.title);
    if (dupes.length > 0) {
      return {
        duplicateWarning: true,
        duplicates: dupes.map((d) => ({
          id:        d.id,
          title:     d.title,
          sourceUrl: d.source_url,
          status:    d.status,
        })),
      };
    }
  }

  const signalResult = await createRecoveredSignal({
    title:               input.title,
    summary:             input.summary,
    sourceName:          source.name,
    sourceUrl:           input.sourceUrl,
    sourceType:          toSignalSourceType(source.source_type),
    category:            input.category,
    anomalyScore:        input.anomalyScore,
    tags:                input.tags,
    sourceImageUrl:      input.sourceImageUrl,
    mediaUrl:            input.sourceImageUrl,  // og:image doubles as primary evidence media
    mediaType:           input.mediaType,
    attributionText:     input.attributionText,
    sourceCaptureNotes:  input.captureNotes,
  });

  if ('error' in signalResult) return { error: signalResult.error };

  const scannedAt = new Date().toISOString();
  await updateScannerSourceLastScanned(source.id);

  return { signalId: signalResult.id, title: input.title, url: input.sourceUrl, scannedAt };
}

// ---------------------------------------------------------------------------
// Phase AA: Scan memory server actions
// ---------------------------------------------------------------------------

export async function getScanMemoryStatsAction(): Promise<{ stats: ScanMemoryStats }> {
  return { stats: getScanMemoryStats() };
}

export async function clearScanMemoryAction(): Promise<{ ok: boolean }> {
  clearScanMemory();
  return { ok: true };
}

// Phase AB: bulk-enable all low-risk origin/archive sources that are not yet enabled.
// Safe to call repeatedly — skips already-enabled and high-risk sources.
export async function autoEnableOriginSourcesAction(): Promise<{ enabled: string[]; errors: string[] }> {
  const SAFE_NAME_FRAGMENTS = [
    'geocities', 'angelfire', 'tripod', 'fortunecity',
    'textfiles', 'nicap', 'nuforc', 'mufon', 'cufon',
    'parascope', 'anomalist', 'fortean', 'coast to coast', 'coasttocoast',
    'virtuallystrange', 'ufo updates', 'friedman', 'earthfiles',
    'crystalinks', 'black vault', 'erowid',
  ];
  const allSources = await getScannerSources();
  const toEnable = allSources.filter((s) => {
    if (s.enabled) return false;
    if (s.risk_level === 'high' || s.risk_level === 'medium') return false;
    const lc = s.name.toLowerCase();
    return SAFE_NAME_FRAGMENTS.some((f) => lc.includes(f));
  });
  const enabled: string[] = [];
  const errors: string[] = [];
  for (const s of toEnable) {
    const r = await toggleScannerSource(s.id, true);
    if ('ok' in r) enabled.push(s.name);
    else errors.push(`${s.name}: ${r.error}`);
  }
  return { enabled, errors };
}

// Phase AD: enable all archive sources relevant to Deep Truth Scanner.
// Includes medium-risk Wayback/archive sources in addition to safe low-risk ones.
// Keeps high-risk live-forum and political sources disabled.
export async function autoEnableDeepTruthSourcesAction(): Promise<{ enabled: string[]; errors: string[] }> {
  const DTS_NAME_FRAGMENTS = [
    // Pre-existing safe sources
    'geocities', 'angelfire', 'tripod', 'fortunecity', 'textfiles', 'nicap', 'nuforc',
    'mufon', 'cufon', 'parascope', 'anomalist', 'fortean', 'coast to coast',
    'coasttocoast', 'virtuallystrange', 'ufo updates', 'friedman', 'earthfiles',
    'crystalinks', 'black vault', 'erowid',
    // Deep Truth extra targets
    'bibliotecapleyades', 'rense', 'abovetopsecret', 'projectcamelot',
    'projectavalon', 'majesticdocuments', 'whale.to', 'surfingtheapocalypse',
    'educate-yourself', 'educateyourself', 'stopthecrime', 'alienshift',
    'cydonia', 'hyper', 'nexusmagazine', 'nexus magazine',
    'internet archive', 'archive.org',
  ];
  const allSources = await getScannerSources();
  // For DTS enable: low AND medium risk archive types; skip reddit and high-risk only
  const toEnable = allSources.filter((s) => {
    if (s.enabled) return false;
    if (s.risk_level === 'high') return false;
    const isArchiveType = ['wayback', 'bbs', 'archive', 'archive_forum', 'mediawiki'].includes(s.source_type ?? '');
    const isReddit = s.source_type === 'reddit';
    if (!isArchiveType || isReddit) return false;
    const lc = s.name.toLowerCase();
    return DTS_NAME_FRAGMENTS.some((f) => lc.includes(f));
  });
  const enabled: string[] = [];
  const errors:  string[] = [];
  for (const s of toEnable) {
    const r = await toggleScannerSource(s.id, true);
    if ('ok' in r) enabled.push(s.name);
    else errors.push(`${s.name}: ${r.error}`);
  }
  return { enabled, errors };
}

// Phase AH: enable all archive-safe sources (wayback/bbs/archive types), low/medium risk, no fiction_lore.
export async function enableArchiveSourcesAction(): Promise<{ enabled: string[]; errors: string[] }> {
  const ARCHIVE_TYPES = ['wayback', 'bbs', 'archive', 'archive_forum', 'mediawiki'];
  const allSources = await getScannerSources();
  const toEnable = allSources.filter((s) => {
    if (s.enabled) return false;
    if (s.risk_level === 'high') return false;
    if (!ARCHIVE_TYPES.includes(s.source_type ?? '')) return false;
    return classifySourceTaxonomy(s.source_type ?? '', s.name) !== 'fiction_lore';
  });
  const enabled: string[] = [];
  const errors:  string[] = [];
  for (const s of toEnable) {
    const r = await toggleScannerSource(s.id, true);
    if ('ok' in r) enabled.push(s.name);
    else errors.push(`${s.name}: ${r.error}`);
  }
  return { enabled, errors };
}

// Phase AH: enable all sources except high-risk and fiction/lore taxonomy.
export async function enableAllScannerSourcesAction(): Promise<{ enabled: string[]; errors: string[] }> {
  const allSources = await getScannerSources();
  const toEnable = allSources.filter((s) => {
    if (s.enabled) return false;
    if (s.risk_level === 'high') return false;
    return classifySourceTaxonomy(s.source_type ?? '', s.name) !== 'fiction_lore';
  });
  const enabled: string[] = [];
  const errors:  string[] = [];
  for (const s of toEnable) {
    const r = await toggleScannerSource(s.id, true);
    if ('ok' in r) enabled.push(s.name);
    else errors.push(`${s.name}: ${r.error}`);
  }
  return { enabled, errors };
}

// Phase AH: disable all high-risk and fiction/lore sources.
export async function disableHighRiskSourcesAction(): Promise<{ disabled: string[]; errors: string[] }> {
  const allSources = await getScannerSources();
  const toDisable = allSources.filter((s) => {
    if (!s.enabled) return false;
    if (s.risk_level === 'high') return true;
    return classifySourceTaxonomy(s.source_type ?? '', s.name) === 'fiction_lore';
  });
  const disabled: string[] = [];
  const errors:   string[] = [];
  for (const s of toDisable) {
    const r = await toggleScannerSource(s.id, false);
    if ('ok' in r) disabled.push(s.name);
    else errors.push(`${s.name}: ${r.error}`);
  }
  return { disabled, errors };
}

// ---------------------------------------------------------------------------
// Fetch session — iterates enabled sources, fetches one page each.
//
// SAFETY:
//   - Source must be enabled=true and have a base_url
//   - Fetches are sequential — no parallel crawl
//   - Raw HTML discarded after extraction
//   - No DB writes here; curator queues each candidate individually
//   - Phase AI: no hard source-count cap — client batches in groups of 10
//   - Per-source timeout: 10 seconds
// ---------------------------------------------------------------------------

const PER_SOURCE_CANDIDATE_CAP    = 5;  // max candidates returned per source
const SESSION_TOTAL_CANDIDATE_CAP = 50; // max total per action call (10 sources × 5 each)

export type ScanMode = 'fresh' | 'deep-archive' | 'chaos' | 'unseen-only';

export async function runFetchSessionAction(
  sourceIds: string[],
  options?: {
    includeRejected?: boolean;
    /** Normalized or raw URLs already shown/posted client-side — excluded from this run */
    excludeUrls?: string[];
    /** Chaos mode — relaxed quality gates, more randomness, obscure candidates */
    chaosMode?: boolean;
    /** Origin bias — boost old-web/BBS/Wayback, penalize recent Reddit */
    originBias?: boolean;
    /** Phase AA: unified scan mode — overrides chaosMode/originBias when set */
    scanMode?: ScanMode;
    /** Phase AB: origin scan — raises wayback link cap, enables quality filter */
    isOriginScan?: boolean;
    /** Phase AD: deep truth scanner — hard archive-only mode, rejects Reddit/modern content */
    isDeepTruth?: boolean;
  },
): Promise<{ results: SessionSourceResult[]; diagnostics: SourceDiagnostic[] } | { error: string }> {
  if (!sourceIds.length) return { error: 'no source IDs provided' };
  if (sourceIds.length > 50) return { error: 'max 50 sources per batch call — client should batch in groups of 10' };

  // Debug test preset — returns static mock candidates without hitting live sources.
  if (sourceIds.length === 1 && sourceIds[0] === '__debug_test__') {
    const results: SessionSourceResult[] = DEBUG_TEST_CANDIDATES.map((c) => ({
      sourceId:   '__debug_test__',
      sourceName: '[DEBUG TEST SOURCE]',
      status:     'preview' as const,
      candidate:  c,
    }));
    const diag: SourceDiagnostic = {
      sourceId: '__debug_test__', sourceName: '[DEBUG TEST SOURCE]', sourceType: 'debug',
      enabled: true, baseUrl: 'internal', routeUsed: 'debug-static',
      linksDiscovered: results.length, pagesFetched: results.length,
      candidatesPassed: results.length, candidatesRejected: 0, rejectReasons: [],
    };
    return { results, diagnostics: [diag] };
  }

  // Phase AA: derive chaosMode / originBias from scanMode when provided.
  const mode = options?.scanMode;
  const effectiveChaosMode  = mode === 'chaos'        || options?.chaosMode  === true;
  const effectiveOriginBias = mode === 'deep-archive' || options?.originBias === true;
  // Unseen-only: relax per-source caps so we dig deeper looking for fresh content
  const unseenOnlyMode = mode === 'unseen-only';
  // Phase AB: origin scan — broader Wayback discovery + quality filter
  const effectiveOriginScan = options?.isOriginScan === true;
  // Phase AD: deep truth scanner — archive-only, hard rejects modern/Reddit content
  const effectiveDeepTruth  = options?.isDeepTruth  === true;

  // One DB query to load all sources; avoids N round trips inside the loop.
  const allSources = await getScannerSources();
  const sourceMap  = new Map(allSources.map((s) => [s.id, s]));

  // Freshness: load all known source URLs in one batch query so we can skip
  // already-archived candidates without N individual round trips.
  const existingUrls = await getExistingSignalUrls();

  // Persistent memory: URLs seen/posted/skipped in prior sessions (decays over time).
  const persistedSeenUrls = loadSeenUrls();

  // Client-side exclusions passed from the scanner UI (already-shown candidates).
  const excludeSet = new Set<string>(
    (options?.excludeUrls ?? []).map(normalizeUrl),
  );

  // Session-level dedup: URLs pushed in this run (catches cross-source dupes).
  const seenThisSession = new Set<string>();

  // Diversity cap: max PER_SOURCE_CANDIDATE_CAP results per source (excludes errors).
  // Unseen-only mode and origin scan raise the cap so we dig deeper through each source.
  const ARCHIVE_TYPES_SET = new Set(['wayback', 'bbs', 'archive', 'archive_forum']);
  const effectivePerSourceCap = (unseenOnlyMode || effectiveOriginScan || effectiveDeepTruth) ? PER_SOURCE_CANDIDATE_CAP + 3 : PER_SOURCE_CANDIDATE_CAP;
  const perSourceCount = new Map<string, number>();

  const results: SessionSourceResult[] = [];
  const diagnostics: SourceDiagnostic[] = [];

  // Helper: check freshness before attempting checkSignalDuplicates.
  function isAlreadyArchived(url: string): boolean {
    const norm = normalizeUrl(url);
    return existingUrls.has(url) || existingUrls.has(norm)
      || seenThisSession.has(norm)
      || persistedSeenUrls.has(norm)
      || excludeSet.has(norm);
  }

  function trackResult(sourceId: string, r: SessionSourceResult) {
    if (r.status !== 'error') {
      const rawUrl = (r as { candidate: { sourceUrl: string } }).candidate.sourceUrl;
      const norm   = normalizeUrl(rawUrl);
      seenThisSession.add(norm);
      perSourceCount.set(sourceId, (perSourceCount.get(sourceId) ?? 0) + 1);
    }
    results.push(r);
  }

  function totalCandidates(): number {
    return results.filter((r) => r.status !== 'error').length;
  }

  for (const sourceId of sourceIds) {
    // Stop fetching if we have hit the session total candidate cap.
    if (totalCandidates() >= SESSION_TOTAL_CANDIDATE_CAP) break;

    const source = sourceMap.get(sourceId);

    if (!source) {
      diagnostics.push({ sourceId, sourceName: sourceId, sourceType: 'unknown', enabled: false, baseUrl: '', routeUsed: 'error', linksDiscovered: 0, pagesFetched: 0, candidatesPassed: 0, candidatesRejected: 0, rejectReasons: [], errorMessage: 'not found in registry' });
      results.push({ sourceId, sourceName: sourceId, status: 'error', error: 'not found in registry' });
      continue;
    }
    if (!source.enabled) {
      diagnostics.push({ sourceId, sourceName: source.name, sourceType: source.source_type, enabled: false, baseUrl: source.base_url ?? '', routeUsed: 'disabled', linksDiscovered: 0, pagesFetched: 0, candidatesPassed: 0, candidatesRejected: 0, rejectReasons: ['source disabled'] });
      results.push({ sourceId, sourceName: source.name, status: 'error', error: 'source is not enabled' });
      continue;
    }
    if (!source.base_url) {
      diagnostics.push({ sourceId, sourceName: source.name, sourceType: source.source_type, enabled: true, baseUrl: '', routeUsed: 'error', linksDiscovered: 0, pagesFetched: 0, candidatesPassed: 0, candidatesRejected: 0, rejectReasons: ['no base URL'] });
      results.push({ sourceId, sourceName: source.name, status: 'error', error: 'no base URL configured' });
      continue;
    }

    // Erowid — auto-discover individual experience reports and fetch each one
    if (isErowidSource(source)) {
      const erowidDisc = await discoverErowidExperienceLinks(source);
      if ('error' in erowidDisc) {
        diagnostics.push({ sourceId, sourceName: source.name, sourceType: source.source_type, enabled: true, baseUrl: source.base_url, routeUsed: 'erowid-discovery', linksDiscovered: 0, pagesFetched: 0, candidatesPassed: 0, candidatesRejected: 0, rejectReasons: [], errorMessage: erowidDisc.error });
        results.push({ sourceId, sourceName: source.name, status: 'error', error: erowidDisc.error });
        continue;
      }
      let erowidFetched = 0;
      let erowidPassed  = 0;
      let erowidRejected = 0;
      const erowidRejectReasons: string[] = [];
      for (const link of erowidDisc.links.slice(0, 20)) {
        if ((perSourceCount.get(sourceId) ?? 0) >= effectivePerSourceCap) break;
        const fr = await fetchErowidExperiencePreview(source, link.url);
        if ('error' in fr) { erowidRejected++; erowidRejectReasons.push(fr.error.slice(0, 80)); continue; }
        erowidFetched++;
        const url = fr.candidate.sourceUrl;
        if (isAlreadyArchived(url)) {
          trackResult(sourceId, { sourceId, sourceName: source.name, status: 'preview', candidate: { ...fr.candidate, badCandidateReason: 'Already in archive — already queued or published' } });
          erowidRejected++;
        } else {
          const dupes = await checkSignalDuplicates(url, fr.candidate.title);
          if (dupes.length > 0) {
            trackResult(sourceId, { sourceId, sourceName: source.name, status: 'duplicate', candidate: fr.candidate, duplicates: dupes.map((d) => ({ id: d.id, title: d.title, sourceUrl: d.source_url, status: d.status })) });
            erowidPassed++;
          } else {
            trackResult(sourceId, { sourceId, sourceName: source.name, status: 'preview', candidate: fr.candidate });
            erowidPassed++;
          }
        }
      }
      diagnostics.push({ sourceId, sourceName: source.name, sourceType: source.source_type, enabled: true, baseUrl: source.base_url, routeUsed: 'erowid-discovery', linksDiscovered: erowidDisc.links.length, pagesFetched: erowidFetched, candidatesPassed: erowidPassed, candidatesRejected: erowidRejected, rejectReasons: erowidRejectReasons });
      if (erowidFetched === 0) {
        results.push({ sourceId, sourceName: source.name, status: 'error', error: 'No fetchable Erowid experience reports found — try a substance category URL (e.g. erowid.org/experiences/subs/exp_DMT.shtml).' });
      }
      continue;
    }

    // Wayback CDX — discover archived snapshots via CDX API, then fetch each
    if (source.source_type === 'wayback') {
      const baseHost = (() => { try { return new URL(source.base_url).hostname; } catch { return ''; } })();
      if (baseHost === 'web.archive.org') {
        results.push({ sourceId, sourceName: source.name, status: 'error', error: 'Wayback source requires a specific domain URL as base_url (e.g. "https://oldsite.example.com") — not the archive root.' });
        continue;
      }
      const waybackDisc = await discoverWaybackLinks(source, effectiveOriginScan || effectiveDeepTruth, effectiveDeepTruth);
      if ('error' in waybackDisc) {
        diagnostics.push({ sourceId, sourceName: source.name, sourceType: source.source_type, enabled: true, baseUrl: source.base_url, routeUsed: 'wayback-cdx', linksDiscovered: 0, pagesFetched: 0, candidatesPassed: 0, candidatesRejected: 0, rejectReasons: [], errorMessage: waybackDisc.error });
        results.push({ sourceId, sourceName: source.name, status: 'error', error: waybackDisc.error });
        continue;
      }
      let waybackFetched = 0;
      let waybackPassed  = 0;
      let waybackRejected = 0;
      const waybackRejectReasons: string[] = [];
      for (const link of waybackDisc.links.slice(0, effectiveOriginScan ? 40 : 25)) {
        if ((perSourceCount.get(sourceId) ?? 0) >= effectivePerSourceCap) break;
        const fr = await fetchWaybackPagePreview(source, link.url, link.topicGroup, link.topicGroupName);
        if ('error' in fr) { waybackRejected++; waybackRejectReasons.push(fr.error.slice(0, 80)); continue; }
        waybackFetched++;
        const url = fr.candidate.sourceUrl;
        if (isAlreadyArchived(url)) {
          trackResult(sourceId, { sourceId, sourceName: source.name, status: 'preview', candidate: { ...fr.candidate, badCandidateReason: 'Already in archive — already queued or published' } });
          waybackRejected++;
        } else {
          const dupes = await checkSignalDuplicates(url, fr.candidate.title);
          if (dupes.length > 0) {
            trackResult(sourceId, { sourceId, sourceName: source.name, status: 'duplicate', candidate: fr.candidate, duplicates: dupes.map((d) => ({ id: d.id, title: d.title, sourceUrl: d.source_url, status: d.status })) });
            waybackPassed++;
          } else {
            trackResult(sourceId, { sourceId, sourceName: source.name, status: 'preview', candidate: fr.candidate });
            waybackPassed++;
          }
        }
      }
      diagnostics.push({ sourceId, sourceName: source.name, sourceType: source.source_type, enabled: true, baseUrl: source.base_url, routeUsed: 'wayback-cdx', linksDiscovered: waybackDisc.links.length, pagesFetched: waybackFetched, candidatesPassed: waybackPassed, candidatesRejected: waybackRejected, rejectReasons: waybackRejectReasons });
      if (waybackFetched === 0) {
        results.push({ sourceId, sourceName: source.name, status: 'error', error: 'No usable Wayback snapshots found for this source URL — check the CDX API or configure a more specific domain.' });
      }
      continue;
    }

    // Route to multi-candidate API connectors — avoids HTML fetches that get blocked or return garbage
    if (source.source_type === 'reddit' || REDDIT_HOST.test(new URL(source.base_url).hostname)) {
      const multiResult = await fetchRedditMultipleCandidates(source, options?.includeRejected, effectiveChaosMode, effectiveOriginBias);
      const di = multiResult.debugInfo;
      if ('error' in multiResult) {
        diagnostics.push({ sourceId, sourceName: source.name, sourceType: source.source_type, enabled: true, baseUrl: source.base_url, routeUsed: 'reddit-json', linksDiscovered: di.postsFound, pagesFetched: di.postsFound, candidatesPassed: 0, candidatesRejected: di.postsFound - di.postsPassedQuality, rejectReasons: di.rejectReasons, subreddit: di.subreddit, endpointsAttempted: di.endpointsAttempted, endpointResults: di.endpointResults, rejectedCandidates: multiResult.rejected, errorMessage: multiResult.error });
        results.push({ sourceId, sourceName: source.name, status: 'error', error: multiResult.error });
      } else {
        let redditPassed = 0;
        let redditRejected = 0;
        const redditRejectReasons: string[] = [];
        for (const candidate of multiResult.candidates) {
          if ((perSourceCount.get(sourceId) ?? 0) >= effectivePerSourceCap) break;
          const url = candidate.sourceUrl;
          if (isAlreadyArchived(url)) {
            trackResult(sourceId, { sourceId, sourceName: source.name, status: 'preview', candidate: { ...candidate, badCandidateReason: 'Already in archive — already queued or published' } });
            redditRejected++;
            redditRejectReasons.push('already archived');
            continue;
          }
          const dupes = await checkSignalDuplicates(url, candidate.title);
          if (dupes.length > 0) {
            trackResult(sourceId, { sourceId, sourceName: source.name, status: 'duplicate', candidate, duplicates: dupes.map((d) => ({ id: d.id, title: d.title, sourceUrl: d.source_url, status: d.status })) });
            redditPassed++;
          } else {
            trackResult(sourceId, { sourceId, sourceName: source.name, status: 'preview', candidate });
            redditPassed++;
          }
        }
        diagnostics.push({ sourceId, sourceName: source.name, sourceType: source.source_type, enabled: true, baseUrl: source.base_url, routeUsed: 'reddit-json', linksDiscovered: di.postsFound, pagesFetched: di.postsFound, candidatesPassed: redditPassed, candidatesRejected: (di.postsFound - di.postsPassedQuality) + redditRejected, rejectReasons: [...di.rejectReasons, ...redditRejectReasons], subreddit: di.subreddit, endpointsAttempted: di.endpointsAttempted, endpointResults: di.endpointResults, rejectedCandidates: multiResult.rejected });
      }
      continue;
    }

    if (source.source_type === 'mediawiki' || isMediaWikiHost(source.base_url)) {
      const multiResult = await fetchMediaWikiMultipleCandidates(source);
      const wdi = 'debugInfo' in multiResult ? multiResult.debugInfo : { searchQuery: '', searchResultCount: 0, articlesFetched: 0 };
      if ('error' in multiResult) {
        diagnostics.push({ sourceId, sourceName: source.name, sourceType: source.source_type, enabled: true, baseUrl: source.base_url, routeUsed: 'mediawiki-api', linksDiscovered: wdi.searchResultCount, pagesFetched: wdi.articlesFetched, candidatesPassed: 0, candidatesRejected: wdi.articlesFetched, rejectReasons: [multiResult.error.slice(0, 100)], searchQuery: wdi.searchQuery, errorMessage: multiResult.error });
        results.push({ sourceId, sourceName: source.name, status: 'error', error: multiResult.error });
      } else {
        let wikiPassed = 0;
        for (const candidate of multiResult.candidates) {
          if ((perSourceCount.get(sourceId) ?? 0) >= effectivePerSourceCap) break;
          const url = candidate.sourceUrl;
          if (isAlreadyArchived(url)) {
            trackResult(sourceId, { sourceId, sourceName: source.name, status: 'preview', candidate: { ...candidate, badCandidateReason: 'Already in archive — already queued or published' } });
            continue;
          }
          const dupes = await checkSignalDuplicates(url, candidate.title);
          if (dupes.length > 0) {
            trackResult(sourceId, { sourceId, sourceName: source.name, status: 'duplicate', candidate, duplicates: dupes.map((d) => ({ id: d.id, title: d.title, sourceUrl: d.source_url, status: d.status })) });
            wikiPassed++;
          } else {
            trackResult(sourceId, { sourceId, sourceName: source.name, status: 'preview', candidate });
            wikiPassed++;
          }
        }
        diagnostics.push({ sourceId, sourceName: source.name, sourceType: source.source_type, enabled: true, baseUrl: source.base_url, routeUsed: 'mediawiki-api', linksDiscovered: wdi.searchResultCount, pagesFetched: wdi.articlesFetched, candidatesPassed: wikiPassed, candidatesRejected: wdi.articlesFetched - wikiPassed, rejectReasons: [], searchQuery: wdi.searchQuery });
      }
      continue;
    }

    // BBS / Textfiles.com connector — Phase O origin scan
    if (isTextfilesSource(source)) {
      const bbsResult = await fetchTextfilesMultipleCandidates(source, effectiveOriginScan || effectiveDeepTruth);
      if (bbsResult.error && bbsResult.candidates.length === 0) {
        diagnostics.push({ sourceId, sourceName: source.name, sourceType: source.source_type, enabled: true, baseUrl: source.base_url, routeUsed: 'bbs-textfiles', linksDiscovered: 0, pagesFetched: bbsResult.debugInfo.filesFetched, candidatesPassed: 0, candidatesRejected: bbsResult.debugInfo.filesFetched, rejectReasons: [bbsResult.error.slice(0, 100)], errorMessage: bbsResult.error });
        results.push({ sourceId, sourceName: source.name, status: 'error', error: bbsResult.error });
      } else {
        let bbsPassed = 0;
        for (const candidate of bbsResult.candidates) {
          if ((perSourceCount.get(sourceId) ?? 0) >= effectivePerSourceCap) break;
          const url = candidate.sourceUrl;
          if (isAlreadyArchived(url)) {
            trackResult(sourceId, { sourceId, sourceName: source.name, status: 'preview', candidate: { ...candidate, badCandidateReason: 'Already in archive' } });
          } else {
            const dupes = await checkSignalDuplicates(url, candidate.title);
            if (dupes.length > 0) {
              trackResult(sourceId, { sourceId, sourceName: source.name, status: 'duplicate', candidate, duplicates: dupes.map((d) => ({ id: d.id, title: d.title, sourceUrl: d.source_url, status: d.status })) });
            } else {
              trackResult(sourceId, { sourceId, sourceName: source.name, status: 'preview', candidate });
            }
            bbsPassed++;
          }
        }
        diagnostics.push({ sourceId, sourceName: source.name, sourceType: source.source_type, enabled: true, baseUrl: source.base_url, routeUsed: 'bbs-textfiles', linksDiscovered: bbsResult.debugInfo.categoriesTried, pagesFetched: bbsResult.debugInfo.filesFetched, candidatesPassed: bbsPassed, candidatesRejected: bbsResult.debugInfo.filesFetched - bbsPassed, rejectReasons: [] });
        if (bbsPassed === 0) results.push({ sourceId, sourceName: source.name, status: 'error', error: 'No BBS candidates passed quality filters.' });
      }
      continue;
    }

    // Generic HTML sources — discovery-first: extract story links from index, fetch each
    let baseHostname: string;
    try { baseHostname = new URL(source.base_url).hostname; }
    catch {
      results.push({ sourceId, sourceName: source.name, status: 'error', error: 'invalid base URL' });
      continue;
    }

    let indexHtml: string;
    try {
      const response = await fetch(source.base_url, {
        cache:   'no-store',
        headers: {
          'User-Agent': 'SWIM-Archive-Scout/1.0 (human-curator-supervised; research archive)',
          'Accept':     'text/html,application/xhtml+xml;q=0.9',
        },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        const isBlocked = response.status === 403 || response.status === 401 || response.status === 429;
        results.push({ sourceId, sourceName: source.name, status: 'error', error: isBlocked ? blockedFetchError(response.status) : `HTTP ${response.status} — ${response.statusText}` });
        continue;
      }
      const ct = response.headers.get('content-type') ?? '';
      if (!ct.includes('text/html') && !ct.includes('xhtml')) {
        results.push({ sourceId, sourceName: source.name, status: 'error', error: `non-HTML response: ${ct.split(';')[0].trim()}` });
        continue;
      }
      indexHtml = await response.text();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ sourceId, sourceName: source.name, status: 'error', error: `network — ${msg}` });
      continue;
    }

    // Extract story-quality links from the index page
    const pageAnchors  = extractAnchors(indexHtml.slice(0, 200_000), source.base_url);
    const seenLinks    = new Set<string>([source.base_url, source.base_url + '/']);
    const storyLinks: string[] = [];

    let htmlFetchCount = 0;
    for (const { href, text } of pageAnchors) {
      if (storyLinks.length >= 30) break;
      if (seenLinks.has(href)) continue;
      seenLinks.add(href);
      if (SKIP_EXTENSIONS.test(href)) continue;
      try { if (new URL(href).hostname !== baseHostname) continue; } catch { continue; }
      if (!discoveryKeywordMatch(href, text)) continue;
      storyLinks.push(href);
    }

    if (storyLinks.length === 0) {
      // Fallback: single candidate built from the index page metadata
      const extracted   = extractPageData(indexHtml, source.base_url);
      const title       = cleanTitle(extracted.title) || source.name;
      const summary     = buildSummary(extracted.description, extracted.snippet);
      const conf        = scoreExtractionConfidence(title, summary);
      const resolvedUrl = extracted.canonicalUrl || source.base_url;
      const urlPath     = (() => { try { return new URL(resolvedUrl).pathname; } catch { return '/'; } })();
      const isIndexPage = urlPath === '/' || urlPath === '' || isGenericTitle(title);
      const bad         = detectBadCandidate(resolvedUrl, title, summary);
      const heur        = scoreStoryHeuristics(`${title} ${summary}`);

      const fallbackCand: FetchedCandidate = {
        title:                title.slice(0, 200),
        summary:              summary.slice(0, 2000),
        sourceUrl:            resolvedUrl,
        category:             source.category_focus[0] ?? 'Internet Lore',
        tags:                 ['scanner-source', source.source_type],
        anomalyScore:         5,
        categoryNote:         buildCategoryNote(source.category_focus, extracted.title, extracted.description),
        extractionConfidence: conf.confidence,
        extractionWarning:    conf.warning ?? undefined,
        isIndexPage,
        badCandidateReason:   bad.bad ? bad.reason : (isIndexPage ? 'Index/homepage — no story links found' : undefined),
        sourceImageUrl:       extracted.imageUrl || undefined,
        mediaType:            extracted.imageUrl ? 'image' : 'webpage',
        attributionText:      `Recovered from ${source.name} · ${source.source_type} source`,
        captureNotes:         'Source index page — no story-quality links found via keyword scan. Raw HTML not stored.',
        storyScore:           heur.storyScore,
        storySignals:         heur.storySignals.length > 0 ? heur.storySignals : undefined,
        finalPriorityScore:   computeFinalPriorityScore(heur.storyScore, { isBadCandidate: bad.bad || isIndexPage }),
      };

      if (isAlreadyArchived(fallbackCand.sourceUrl)) {
        trackResult(sourceId, { sourceId, sourceName: source.name, status: 'preview', candidate: { ...fallbackCand, badCandidateReason: 'Already in archive — already queued or published' } });
      } else {
        const fallbackDupes = await checkSignalDuplicates(fallbackCand.sourceUrl, fallbackCand.title);
        if (fallbackDupes.length > 0) {
          trackResult(sourceId, { sourceId, sourceName: source.name, status: 'duplicate', candidate: fallbackCand, duplicates: fallbackDupes.map((d) => ({ id: d.id, title: d.title, sourceUrl: d.source_url, status: d.status })) });
        } else {
          trackResult(sourceId, { sourceId, sourceName: source.name, status: 'preview', candidate: fallbackCand });
        }
      }
    } else {
      // Fetch each story-quality link individually and build candidates (max 15 fetches)
      for (const linkUrl of storyLinks) {
        if (htmlFetchCount >= 15) break;
        let linkHtml: string;
        try {
          const res = await fetch(linkUrl, {
            cache:   'no-store',
            headers: {
              'User-Agent': 'SWIM-Archive-Scout/1.0 (human-curator-supervised; research archive)',
              'Accept':     'text/html,application/xhtml+xml;q=0.9',
            },
            signal: AbortSignal.timeout(10_000),
          });
          if (!res.ok) continue;
          const ct = res.headers.get('content-type') ?? '';
          if (!ct.includes('text/html') && !ct.includes('xhtml')) continue;
          linkHtml = await res.text();
          htmlFetchCount++;
        } catch { continue; }

        const extracted  = extractPageData(linkHtml, linkUrl);
        const title      = cleanTitle(extracted.title) || source.name;
        const summary    = buildSummary(extracted.description, extracted.snippet);
        const quality    = candidatePassesQuality(linkUrl, title, summary);
        if (!quality.pass) continue;

        const conf       = scoreExtractionConfidence(title, summary);
        const bad        = detectBadCandidate(linkUrl, title, summary);
        const heur       = scoreStoryHeuristics(`${title} ${summary}`);

        const linkCand: FetchedCandidate = {
          title:                title.slice(0, 200),
          summary:              summary.slice(0, 2000),
          sourceUrl:            extracted.canonicalUrl || linkUrl,
          category:             source.category_focus[0] ?? 'Internet Lore',
          tags:                 ['scanner-source', source.source_type, 'discovered-link'],
          anomalyScore:         5,
          categoryNote:         buildCategoryNote(source.category_focus, extracted.title, extracted.description),
          extractionConfidence: conf.confidence,
          extractionWarning:    conf.warning ?? undefined,
          passReason:           quality.reason,
          badCandidateReason:   bad.bad ? bad.reason : undefined,
          sourceImageUrl:       extracted.imageUrl || undefined,
          mediaType:            extracted.imageUrl ? 'image' : 'webpage',
          attributionText:      `Recovered from ${source.name} · ${source.source_type} source`,
          captureNotes:         `Discovered via homepage link scan of ${source.name}. Raw HTML not stored.`,
          storyScore:           heur.storyScore,
          storySignals:         heur.storySignals.length > 0 ? heur.storySignals : undefined,
          finalPriorityScore:   computeFinalPriorityScore(heur.storyScore, { isBadCandidate: bad.bad }),
        };

        if ((perSourceCount.get(sourceId) ?? 0) >= effectivePerSourceCap) break;
        const linkUrl2 = linkCand.sourceUrl;
        if (isAlreadyArchived(linkUrl2)) {
          trackResult(sourceId, { sourceId, sourceName: source.name, status: 'preview', candidate: { ...linkCand, badCandidateReason: 'Already in archive — already queued or published' } });
          continue;
        }
        const linkDupes = await checkSignalDuplicates(linkUrl2, linkCand.title);
        if (linkDupes.length > 0) {
          trackResult(sourceId, { sourceId, sourceName: source.name, status: 'duplicate', candidate: linkCand, duplicates: linkDupes.map((d) => ({ id: d.id, title: d.title, sourceUrl: d.source_url, status: d.status })) });
        } else {
          trackResult(sourceId, { sourceId, sourceName: source.name, status: 'preview', candidate: linkCand });
        }
      }
    }
  }

  // Record health outcomes for each scanned source (fire-and-forget; errors ignored)
  for (const diag of diagnostics) {
    if (diag.sourceId === '__debug_test__') continue;
    const success = diag.candidatesPassed > 0;
    try { recordSourceResult(diag.sourceId, diag.sourceName, success, diag.candidatesPassed); }
    catch { /* never block the return */ }
  }

  // ---------------------------------------------------------------------------
  // Phase Y: Signal lineage post-processing
  //
  // 1. Generate fingerprints on all non-error candidates.
  // 2. Run detectLineageRelationships to find origin trails / mirrors.
  // 3. Apply annotations back to each candidate in-place.
  // 4. TASK 5 — Duplicate evolution: if a 'duplicate' result is actually
  //    older or extends the origin trail, promote it to 'preview' so the
  //    curator can review it as an earlier variant rather than suppressing it.
  // 5. Persist fingerprints to the lineage cache (data/signal-lineage.json).
  // ---------------------------------------------------------------------------
  try {
    // Stamp fingerprints in-place on all candidate results
    for (const r of results) {
      if (r.status === 'error') continue;
      r.candidate.signalFingerprint = generateSignalFingerprint(r.candidate);
    }

    // Collect preview + duplicate candidates for relationship detection
    const candidatesForLineage = results
      .filter((r): r is Exclude<typeof r, { status: 'error' }> => r.status !== 'error')
      .map((r) => r.candidate);

    if (candidatesForLineage.length > 0) {
      const annotations = detectLineageRelationships(candidatesForLineage);
      const annotationMap = new Map(annotations.map((a) => [a.candidateUrl, a]));

      for (let i = 0; i < results.length; i++) {
        const r = results[i];
        if (r.status === 'error') continue;

        const ann = annotationMap.get(r.candidate.sourceUrl);
        if (!ann) continue;

        // Apply lineage fields to the candidate
        r.candidate.originStatus       = ann.originStatus ?? undefined;
        r.candidate.originTrail        = ann.originTrail.length > 0 ? ann.originTrail : undefined;
        r.candidate.lineageConfidence  = ann.lineageConfidence > 0 ? ann.lineageConfidence : undefined;
        r.candidate.relatedSignalCount = ann.relatedSignalCount > 0 ? ann.relatedSignalCount : undefined;

        // TASK 5: Duplicate evolution —
        // Promote a 'duplicate' to 'preview' when it's an earlier variant or possible origin.
        // The curator then sees "earlier variant found" rather than a suppressed duplicate.
        if (
          r.status === 'duplicate' &&
          (ann.originStatus === 'possible-origin' || ann.originStatus === 'earlier-variant')
        ) {
          const candidateYear = r.candidate.firstSeenYear ?? r.candidate.archiveYear;
          const hasOldContent = candidateYear != null && candidateYear < 2015;
          if (hasOldContent) {
            results[i] = {
              sourceId:   r.sourceId,
              sourceName: r.sourceName,
              status:     'preview',
              candidate:  r.candidate,
            };
          }
        }

        // Persist to lineage cache (fire-and-forget)
        try { recordCandidateLineage(r.candidate); } catch { /* never block */ }
      }
    }
  } catch {
    // Lineage processing must never block the return
  }

  // Phase AB: Origin quality filter — penalize short/thin content from archive sources.
  // Short excerpts (<100 chars) from Wayback/BBS/archive indicate nav pages or stubs.
  if (effectiveOriginScan) {
    for (const r of results) {
      if (r.status === 'error' || r.candidate.badCandidateReason) continue;
      if (!ARCHIVE_TYPES_SET.has(r.candidate.sourceType ?? '')) continue;
      const excerptLen = (r.candidate.summary ?? '').trim().length;
      if (excerptLen < 100) {
        r.candidate.badCandidateReason = `Archive stub — too short (${excerptLen} chars), likely navigation or index page`;
      }
    }
  }

  // Phase AD: Deep Truth Scanner — hard-reject modern, Reddit, or undated content.
  if (effectiveDeepTruth) {
    const DREAM_JUNK = [
      'dream meaning', 'dream interpretation', 'what does it mean to dream',
      'dream about', 'dreaming of', 'lucid dreaming tips', 'dream journal',
      'dream dictionary', 'dreams and their meanings',
    ];
    const MODERN_JUNK = [
      'tiktok', 'instagram', 'twitter thread', 'youtube shorts',
      'going viral', 'trending now', 'breaking:', 'just posted',
    ];
    for (const r of results) {
      if (r.status === 'error' || r.candidate.badCandidateReason) continue;
      const st = r.candidate.sourceType ?? '';
      const lc = (`${r.candidate.title} ${r.candidate.summary}`).toLowerCase();

      // Hard-reject Reddit regardless of how it slipped through
      if (st === 'reddit') {
        r.candidate.badCandidateReason = 'Deep Truth: Reddit excluded from this mode';
        continue;
      }
      // Hard-reject candidates with no archive year from non-BBS sources
      if (st !== 'bbs' && !r.candidate.archiveYear && !r.candidate.isArchived) {
        r.candidate.badCandidateReason = 'Deep Truth: no archive provenance — undated content excluded';
        continue;
      }
      // Hard-reject post-2015 content (unless BBS which is always pre-social)
      if (st !== 'bbs' && r.candidate.archiveYear && r.candidate.archiveYear > 2015) {
        r.candidate.badCandidateReason = `Deep Truth: too recent (${r.candidate.archiveYear}) — only pre-2015 archive content`;
        continue;
      }
      // Hard-reject dream interpretation junk
      if (DREAM_JUNK.some((p) => lc.includes(p))) {
        r.candidate.badCandidateReason = 'Deep Truth: dream interpretation content — not an origin signal';
        continue;
      }
      // Hard-reject modern social/media junk
      if (MODERN_JUNK.some((p) => lc.includes(p))) {
        r.candidate.badCandidateReason = 'Deep Truth: modern social content — not an archive artifact';
        continue;
      }
      // Phase AF: hard-reject fiction_lore and modern_forum taxonomy in DTS
      const tax = r.candidate.sourceTaxonomy;
      if (tax === 'fiction_lore') {
        r.candidate.badCandidateReason = 'Deep Truth: fiction/lore source — excluded from archive mode';
        continue;
      }
      if (tax === 'modern_forum') {
        r.candidate.badCandidateReason = 'Deep Truth: modern forum source — excluded from archive mode';
        continue;
      }
    }
  }

  // Persist all URLs seen this session so future scans skip them automatically.
  try { recordSeenUrls(seenThisSession, 'seen'); } catch { /* never block */ }

  return { results, diagnostics };
}

// ---------------------------------------------------------------------------
// Limited discovery scan — curator-triggered, max 5 links, same-domain only.
//
// TWO-STEP FLOW:
//   Step 1 — discoverSourceLinksAction:
//     Fetches base_url (or JSON API for Reddit), extracts links, filters by keyword.
//     Returns up to 20 candidate URLs. No DB writes.
//   Step 2 — fetchDiscoveredLinkPreviewAction / batchFetchDiscoveredLinksAction:
//     Fetches one or many discovered URLs → FetchedCandidate(s).
//     Feeds into the existing queueFetchedCandidateAction flow.
//
// STRICT LIMITS:
//   - max 20 links returned per discovery run
//   - same-domain only (unless source_type is archive/wayback)
//   - no recursive following — discovery does NOT auto-fetch discovered links
//   - no scheduling
//   - zero DB writes until curator clicks Queue Candidate
//
// CONNECTORS:
//   - reddit source_type  → JSON API (reddit.com/r/sub/new.json)
//   - all others          → HTML anchor extraction
// ---------------------------------------------------------------------------

const DISCOVERY_MAX_LINKS = 20;

const DISCOVERY_KEYWORDS = [
  'story', 'experience', 'thread', 'report', 'archive', 'forum', 'sighting',
  'dream', 'glitch', 'lost', 'encounter', 'witness', 'strange', 'anomaly',
  'paranormal', 'ufo', 'case', 'incident', 'found', 'missing', 'secret',
  'hidden', 'recovered',
  // Phase O origin keywords — old-web / deep archive signal
  'alien', 'conspiracy', 'occult', 'haunted', 'signal', 'mind control',
  'black project', 'time travel', 'mandela', 'underground', 'ritual',
  'prophecy', 'forbidden', 'classified', 'suppressed', 'coverup',
];

function extractAnchors(html: string, baseUrl: string): Array<{ href: string; text: string }> {
  const links: Array<{ href: string; text: string }> = [];
  // Match <a href="...">text</a> — cap at 200 KB of HTML
  const re = /<a[^>]{0,500}href=["']([^"'#\s]{3,500})["'][^>]{0,200}>([\s\S]{0,300}?)<\/a>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(html)) !== null) {
    const rawHref = m[1].trim();
    const rawText = m[2].replace(/<[^>]{0,200}>/g, ' ').replace(/\s{2,}/g, ' ').trim().slice(0, 200);
    try {
      const resolved = new URL(rawHref, baseUrl).href;
      if (resolved.startsWith('http')) links.push({ href: resolved, text: rawText || rawHref });
    } catch { /* skip unresolvable URLs */ }
  }
  return links;
}

function discoveryKeywordMatch(url: string, text: string): string | null {
  const target = `${url} ${text}`.toLowerCase();
  for (const kw of DISCOVERY_KEYWORDS) {
    if (target.includes(kw)) return kw;
  }
  return null;
}

const SKIP_EXTENSIONS = /\.(css|js|jpg|jpeg|png|gif|svg|ico|webp|woff|woff2|ttf|eot|pdf|zip|xml|json|rss|atom)(\?|$)/i;

const REDDIT_HOST = /^(www\.)?reddit\.com$/;

// Reddit connector — fetch new posts from a subreddit JSON listing.
async function discoverRedditPosts(
  source: DbScannerSource,
): Promise<{ links: DiscoveredLink[] } | { error: string }> {
  // Fetch both /new and /top to surface quality posts
  const baseUrl = source.base_url!.replace(/\/?$/, '');
  const urls = [`${baseUrl}/new.json?limit=50`, `${baseUrl}/top.json?t=month&limit=50`];

  type RPost = { data: {
    title: string; permalink: string; selftext: string; score: number;
    num_comments: number; subreddit: string; author: string;
    is_self: boolean; url: string; stickied?: boolean;
  } };
  const allPosts: RPost[] = [];

  for (const jsonUrl of urls) {
    let data: unknown;
    try {
      const res = await fetch(jsonUrl, {
        cache: 'no-store',
        headers: {
          'User-Agent': 'SWIM-Archive-Scout/1.0 (human-curator-supervised; research archive)',
          'Accept':     'application/json',
        },
        signal: AbortSignal.timeout(12_000),
      });
      if (!res.ok) continue;
      data = await res.json();
    } catch { continue; }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const posts: RPost[] = (data as any)?.data?.children ?? [];
    allPosts.push(...posts);
  }

  const seen  = new Set<string>();
  const links: DiscoveredLink[] = [];

  for (const { data: p } of allPosts) {
    if (links.length >= DISCOVERY_MAX_LINKS) break;
    const permalink = `https://www.reddit.com${p.permalink}`;
    if (seen.has(permalink)) continue;
    seen.add(permalink);

    // Story quality gate — require 2+ criteria
    const quality = scoreRedditQuality({
      title: p.title, selftext: p.selftext ?? '', is_self: p.is_self,
      url: p.url, score: p.score, num_comments: p.num_comments,
      stickied: p.stickied, author: p.author,
    });
    if (!quality.passes) continue;

    const combined  = `${p.title} ${p.selftext}`.toLowerCase();
    const matched: string[] = [];
    for (const kw of DISCOVERY_KEYWORDS) {
      if (combined.includes(kw)) matched.push(kw);
      if (matched.length >= 3) break;
    }
    if (matched.length === 0) continue;

    const cleanedTitle = p.title.replace(/^\s*\[[^\]]{1,30}\]\s*/g, '').trim() || p.title;
    links.push({
      url:         permalink,
      linkText:    cleanedTitle,
      matchReason: `r/${p.subreddit} · ${quality.passReason} · matched: ${matched.join(', ')}`,
    });
  }
  return { links };
}

// Reddit connector — fetch a single post via JSON API for structured metadata.
async function fetchRedditPostPreview(
  source: DbScannerSource,
  url: string,
): Promise<{ candidate: FetchedCandidate } | { error: string }> {
  const jsonUrl = url.replace(/\/?$/, '') + '.json';
  let data: unknown;
  try {
    const res = await fetch(jsonUrl, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'SWIM-Archive-Scout/1.0 (human-curator-supervised; research archive)',
        'Accept':     'application/json',
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return { error: `Reddit post JSON HTTP ${res.status}` };
    data = await res.json();
  } catch (err) {
    return { error: `Reddit post fetch — ${err instanceof Error ? err.message : String(err)}` };
  }

  type PostData = {
    title: string; selftext: string; author: string; score: number;
    num_comments: number; subreddit: string; created_utc: number; url: string;
    preview?: { images?: [{ source: { url: string } }] };
  };
  // Reddit JSON is [listing, comments] — post at [0].data.children[0].data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const p = (data as any)?.[0]?.data?.children?.[0]?.data as PostData | undefined;
  if (!p) return { error: 'could not parse Reddit post data' };

  const title     = (p.title ?? 'Untitled Reddit Post').slice(0, 200);
  const narrative = p.selftext?.trim() ? extractNarrative(p.selftext) : '';
  const summary   = (narrative || p.selftext?.trim() ||
    `r/${p.subreddit} · ${p.score} points · ${p.num_comments} comments`
  ).slice(0, 2000);
  const rawImg    = p.preview?.images?.[0]?.source?.url;
  const imageUrl  = rawImg ? rawImg.replace(/&amp;/g, '&') : undefined;
  const conf      = scoreExtractionConfidence(title, summary);
  const postedDate = new Date(p.created_utc * 1000).toISOString().slice(0, 10);
  const heuristics = scoreStoryHeuristics(`${title} ${summary}`);

  const candidate: FetchedCandidate = {
    title,
    summary,
    sourceUrl:            url,
    category:             source.category_focus[0] ?? 'Internet Lore',
    tags:                 ['scanner-source', 'reddit', 'discovered-link', `r-${p.subreddit}`],
    anomalyScore:         5,
    categoryNote:         buildCategoryNote(source.category_focus, title, summary),
    extractionConfidence: conf.confidence,
    extractionWarning:    conf.warning ?? undefined,
    sourceType:           'reddit',
    isArchived:           false,
    passReason:           `r/${p.subreddit} · ${p.score}↑ · keyword match`,
    sourceImageUrl:       imageUrl,
    mediaType:            imageUrl ? 'image' : 'webpage',
    attributionText:      `Recovered from r/${p.subreddit} · u/${p.author} · Reddit`,
    captureNotes:         `r/${p.subreddit} · u/${p.author} · ${p.score}↑ · ${p.num_comments} comments · posted ${postedDate}. Raw content not stored.`,
    redditSubreddit:      p.subreddit,
    redditAuthor:         p.author,
    redditScore:          p.score,
    redditComments:       p.num_comments,
    redditPostedAt:       postedDate,
    storyScore:           heuristics.storyScore,
    storySignals:         heuristics.storySignals.length > 0 ? heuristics.storySignals : undefined,
  };
  return { candidate };
}

// ---------------------------------------------------------------------------
// Quality filter — rejects low-value pages before building a candidate
// ---------------------------------------------------------------------------

function candidatePassesQuality(url: string, title: string, summary: string): { pass: boolean; reason: string } {
  const path  = (() => { try { return new URL(url).pathname.toLowerCase(); } catch { return '/'; } })();
  const lcTitle = title.toLowerCase();
  const lcSum   = summary.toLowerCase();

  // Reject navigation / tag / category index pages
  if (/^\/(tag|tags|category|categories|topics?|search|login|register|about|contact|privacy|terms)\b/.test(path)) {
    return { pass: false, reason: 'navigation or index page' };
  }
  // Reject empty excerpts
  if (summary.trim().length < 40) {
    return { pass: false, reason: 'summary too short' };
  }
  // Reject generic page titles
  if (lcTitle === 'home' || lcTitle === 'index' || lcTitle === 'welcome' || lcTitle.length < 8) {
    return { pass: false, reason: 'generic page title' };
  }
  // Prefer longform — mark pass reason accordingly
  const isLongform = summary.trim().length > 300;
  const hasKeyword = DISCOVERY_KEYWORDS.some((kw) => lcTitle.includes(kw) || lcSum.includes(kw));
  const reason = isLongform
    ? 'longform content'
    : hasKeyword
      ? 'keyword match'
      : 'passed quality filter';
  return { pass: true, reason };
}

// ---------------------------------------------------------------------------
// Origin priority scoring — Phase O Deep Archive scoring
//
// Adds era bonus on top of story heuristics for pre-2010 / old-web / BBS
// content. No AI, no network calls — pure metadata heuristics.
// ---------------------------------------------------------------------------

const OLD_WEB_DOMAINS = [
  'geocities.com', 'geocities.yahoo.com',
  'angelfire.com',
  'tripod.com', 'tripod.lycos.com',
  'fortunecity.com',
  'abovetopsecret.com',
  'rense.com',
  'bibliotecapleyades.net',
  'paranormal.about.com',
  'unexplained-mysteries.com',
  'textfiles.com',
  // Phase V additions
  'crystalinks.com',
  'theblackvault.com',
  'nicap.org',
  'cufon.org',
  'projectcamelot.org',
  'projectavalon.net',
  'nexusmagazine.com',
  'earthfiles.com',
  'parascope.com',
  'anomalist.com',
  'stantonfriedman.com',
  'mufon.com',
  'nuforc.org',
  'virtuallystrange.net',
  'pub.ezboard.com',
  'coasttocoastam.com',
  'forteantimes.com',
];

function computeOriginPriorityScore(
  baseScore: number,
  opts: {
    archiveTimestamp?: string;  // 14-char YYYYMMDDHHmmss from CDX
    sourceType?: string;
    originalDomain?: string;
    sourceUrl?: string;
    isArchivedWayback?: boolean; // true when this is a confirmed Wayback snapshot
    isArchivedForum?: boolean;   // true for forum/thread pages recovered from archive
    isNotArchived?: boolean;     // true for live pages with no archive provenance
  },
): { score: number; era: string; archiveYear: number | undefined; isPreSocialEra: boolean } {
  let bonus = 0;
  let era   = 'modern source';
  const { archiveTimestamp, sourceType, originalDomain, sourceUrl, isArchivedWayback, isArchivedForum, isNotArchived } = opts;

  // Derive year from Wayback timestamp
  let archiveYear: number | undefined;
  if (archiveTimestamp && archiveTimestamp.length >= 4) {
    archiveYear = parseInt(archiveTimestamp.slice(0, 4), 10) || undefined;
  }

  // Phase AC: strong era bonuses + hard modern penalties
  // Pre-social internet (≤2010) aggressively prioritised; modern content penalised.
  if (archiveYear) {
    if      (archiveYear <= 1999) { bonus += 80; era = '1990s web'; }
    else if (archiveYear <= 2004) { bonus += 60; era = 'early 2000s'; }
    else if (archiveYear <= 2010) { bonus += 45; era = 'early 2000s'; }
    else if (archiveYear <= 2014) { bonus += 20; era = 'pre-social archive'; }
    else if (archiveYear <= 2019) { bonus -= 10; }  // modern content penalty
    else                           { bonus -= 25; }  // hard penalty: 2020+
  }

  // BBS source type — raw pre-internet text gets the strongest boost
  if (sourceType === 'bbs') { bonus += 30; era = 'bbs archive'; }

  // Phase W: Wayback snapshot and archived forum bonuses
  if (isArchivedWayback) bonus += 20;
  if (isArchivedForum)   bonus += 15;

  // Phase W: penalise live pages with no archive provenance (not BBS, not Wayback)
  // This pushes unarchived modern sources to the bottom of origin scan results.
  if (isNotArchived && sourceType !== 'bbs' && !isArchivedWayback) bonus -= 25;

  // Old-web domain markers
  const domStr = `${originalDomain ?? ''} ${sourceUrl ?? ''}`.toLowerCase();
  if (OLD_WEB_DOMAINS.some((d) => domStr.includes(d))) {
    bonus += 8;
    if (era === 'modern source') era = 'early 2000s';
  }
  if (domStr.includes('geocities') || domStr.includes('angelfire') || domStr.includes('tripod') || domStr.includes('fortunecity')) {
    bonus += 12;
    if (era !== 'bbs archive') era = '1990s web';
  }

  // Phase AC: isPreSocialEra — true for ≤2010 captures and all BBS artifacts
  const isPreSocialEra = sourceType === 'bbs' || (archiveYear != null && archiveYear <= 2010);

  return { score: Math.min(Math.max(baseScore + bonus, 0), 100), era, archiveYear, isPreSocialEra };
}

// Phase AC: pre-social language signal detector.
// Awards bonus for old-web/BBS/Usenet formatting patterns;
// penalises modern social-media language.
function computePreSocialLanguageBonus(text: string): number {
  const lc = text.toLowerCase();
  let bonus = 0;
  const OLD_SIGNALS = [
    'posted by', 'original message', 'from:', 'subject:', 'wrote:',
    'forwarded', 're:', 'newsgroup', 'usenet', 'fidonet', 'bbs ',
    'sysop', 'guestbook', 'webmaster', 'webring', 'modem', 'download',
    'caller id', 'dial-up', 'fido', 'listserv', 'mailing list',
    'message board', 'bulletin board', 'original post', 'thread:', 'reply to',
  ];
  const MODERN_SIGNALS = [
    'tiktok', 'twitter', '#', ' lol ', ' lmao ', ' tbh ', ' imo ',
    'going viral', 'ratio ', 'dm me', 'check out my', 'follow me',
    'no cap', 'cringe', 'slay', 'vibe check', 'ngl ', 'based ',
    'main character', 'it hits different',
  ];
  for (const s of OLD_SIGNALS)    if (lc.includes(s)) bonus += 3;
  for (const s of MODERN_SIGNALS) if (lc.includes(s)) bonus -= 5;
  return Math.max(-15, Math.min(15, bonus));
}

// ---------------------------------------------------------------------------
// Wayback CDX connector — discover snapshots of a domain registered as a source
// ---------------------------------------------------------------------------

// Era windows for Wayback deep-mode rotation — each run picks one at random so
// successive scans surface content from different periods of the old web.
const WAYBACK_ERA_WINDOWS: Array<[number, number]> = [
  [1997, 2000],
  [2001, 2004],
  [2005, 2009],
  [2010, 2012],
];

// Phase AD: topic path fragments rotated during Deep Truth Scanner Wayback scans.
const DTS_TOPIC_PATH_HINTS = [
  'ufo', 'roswell', 'area51', 'area-51', 'majestic', 'mkultra', 'mk-ultra',
  'montauk', 'haarp', 'underground', 'blackproject', 'black-project',
  'mindcontrol', 'mind-control', 'occult', 'prophecy', 'annunaki', 'anunnaki',
  'atlantis', 'cattle', 'disclosure', 'ritual', 'forbidden', 'files', 'archive',
  'conspiracy', 'alien', 'reptilian', 'illuminati', 'nwo', 'chemtrail',
  'coverup', 'cover-up', 'secret', 'classified', 'whistleblower',
];

async function discoverWaybackLinks(
  source:      DbScannerSource,
  isOriginScan = false,
  isDeepTruth  = false,
): Promise<{ links: DiscoveredLink[]; topicGroup?: string; topicGroupName?: string } | { error: string }> {
  const baseHostLower = (source.base_url ?? '').toLowerCase();
  const isOldWebSource = OLD_WEB_DOMAINS.some((d) => baseHostLower.includes(d));

  // Phase V: rotate topic seed group — use the group's era preference over the
  // generic WAYBACK_ERA_WINDOWS so each scan session surfaces a distinct topic.
  const topic = pickRandomTopicGroup();
  let fromYear: number | undefined;
  let toYear:   number | undefined;

  // Phase AC: origin scan forces pre-2010 era windows with 95% probability
  const PRE_SOCIAL_WINDOWS: Array<[number, number]> = [
    [1996, 1999], [1997, 2001], [1998, 2003], [2000, 2004], [2002, 2006], [2005, 2010],
  ];
  // Phase AD: Deep Truth Scanner — 100% pre-2015, 80% pre-2005
  const DTS_WINDOWS: Array<[number, number]> = [
    [1996, 1999], [1997, 2001], [1998, 2003], [2000, 2004], [2002, 2006], [2005, 2010], [2008, 2012],
  ];
  if (isDeepTruth) {
    const win = Math.random() < 0.80
      ? DTS_WINDOWS.slice(0, 6)[Math.floor(Math.random() * 6)]  // pre-2010 with 80% probability
      : DTS_WINDOWS[6];                                          // 2008-2012 fallback
    [fromYear, toYear] = win;
  } else if (isOldWebSource || isOriginScan) {
    const biasToPreSocial = isOriginScan ? 0.95 : 0.75;
    if (Math.random() < biasToPreSocial) {
      if (isOriginScan) {
        // Pick from dedicated pre-social windows for maximum archaeology depth
        const win = PRE_SOCIAL_WINDOWS[Math.floor(Math.random() * PRE_SOCIAL_WINDOWS.length)];
        [fromYear, toYear] = win;
      } else {
        [fromYear, toYear] = topic.eraHint;
      }
    } else {
      const era = WAYBACK_ERA_WINDOWS[Math.floor(Math.random() * WAYBACK_ERA_WINDOWS.length)];
      [fromYear, toYear] = era;
    }
  }

  // Phase AC: origin/DTS scan fetches 200 CDX snapshots for maximum depth; Phase W: randomise offset
  const cdxLimit  = (isOriginScan || isDeepTruth) ? 200 : 100;
  const cdxOffset = Math.floor(Math.random() * 40);
  const result = await searchWaybackSnapshots(source.base_url!, cdxLimit, fromYear, toYear, cdxOffset > 0 ? cdxOffset : undefined);
  if ('error' in result) return result;

  // Sort oldest-first so we surface the earliest viable pages for this domain.
  const snaps = [...result.snapshots].sort((a, b) => a.timestamp.localeCompare(b.timestamp));

  // Phase W: deep path clusters — URLs containing these segments are prioritised.
  // They indicate actual content pages (threads, reports, files) over index pages.
  const DEEP_PATH_CLUSTERS = [
    '/forum/', '/forums/', '/thread/', '/threads/', '/post/', '/posts/',
    '/bbs/', '/board/', '/boards/', '/topic/', '/topics/',
    '/ufo/', '/paranormal/', '/conspiracy/', '/occult/', '/alien/',
    '/files/', '/file/', '/reports/', '/report/', '/archives/', '/archive/',
    '/text/', '/texts/', '/story/', '/stories/', '/article/', '/articles/',
    '/message/', '/messages/', '/doc/', '/docs/', '/research/',
  ];
  // Junk paths to skip — logins, registrations, search, tag pages
  const JUNK_PATH_PATTERNS = [
    '/login', '/logout', '/register', '/signup', '/sign-up',
    '/search', '/tag/', '/tags/', '/category/', '/categories/',
    '/page/1', '/index.htm', '/index.html', '/index.php',
    '/cgi-bin/', '/admin/', '/wp-admin/', '/captcha',
  ];

  const isJunkPath = (url: string) => {
    const lc = url.toLowerCase();
    return JUNK_PATH_PATTERNS.some((p) => lc.includes(p));
  };
  const isDeepPath = (url: string) => {
    const lc = url.toLowerCase();
    return DEEP_PATH_CLUSTERS.some((p) => lc.includes(p));
  };
  const isHomePath = (url: string) => {
    try {
      const u = new URL(url);
      const pn = u.pathname;
      return pn === '/' || pn === '' || pn === '/index.htm' || pn === '/index.html';
    } catch { return false; }
  };

  // Topic path-hint filtering — prefer topic-relevant URLs; fall back to all valid.
  // Phase AD: Deep Truth Scanner rotates its own deep-conspiracy topic path hints.
  const pathHints  = isDeepTruth ? DTS_TOPIC_PATH_HINTS : topic.pathHints;
  const urlLower   = (u: string) => u.toLowerCase();
  const topicMatch = (u: string) => pathHints.some((h) => urlLower(u).includes(h));

  const validSnaps = snaps.filter((s) => !isHomePath(s.url) && !isJunkPath(s.url));

  const topicFiltered = validSnaps.filter((s) => topicMatch(s.url));
  const deepFiltered  = validSnaps.filter((s) => isDeepPath(s.url));

  // Priority order: topic+deep > topic-only > deep-only > all valid
  let candidateSnaps: typeof snaps;
  const topicDeep = topicFiltered.filter((s) => isDeepPath(s.url));
  if (topicDeep.length >= 3)     candidateSnaps = topicDeep;
  else if (topicFiltered.length >= 3) candidateSnaps = topicFiltered;
  else if (deepFiltered.length >= 3)  candidateSnaps = deepFiltered;
  else                               candidateSnaps = validSnaps;

  // Phase AC/AD: per-domain diversity cap — origin/DTS scan allows more deep-path results.
  const perDomainDeepCap    = (isOriginScan || isDeepTruth) ? 5 : 3;
  const perDomainShallowCap = (isOriginScan || isDeepTruth) ? 3 : 2;
  const maxLinks            = (isOriginScan || isDeepTruth) ? 50 : 30;
  const domainCount = new Map<string, number>();
  const links: DiscoveredLink[] = [];

  for (const snap of candidateSnaps) {
    const cap = isDeepPath(snap.url) ? perDomainDeepCap : perDomainShallowCap;
    let domain = '';
    try { domain = new URL(snap.url).hostname; } catch { domain = snap.url; }
    if ((domainCount.get(domain) ?? 0) >= cap) continue;
    domainCount.set(domain, (domainCount.get(domain) ?? 0) + 1);

    links.push({
      url:            snap.waybackUrl,
      linkText:       snap.url.split('/').pop() || snap.url,
      matchReason:    `Wayback snapshot · ${topic.name} · captured ${waybackTimestampToIso(snap.timestamp).slice(0, 10)}`,
      topicGroup:     topic.id,
      topicGroupName: topic.name,
    });

    if (links.length >= maxLinks) break;
  }

  return { links, topicGroup: topic.id, topicGroupName: topic.name };
}

// Task 5: Strip the Wayback Machine navigation toolbar from captured HTML.
//
// The Wayback toolbar is injected into every archived page as a large block at
// the top of <body>.  It contains its own scripts, styles, and text that pollute
// meta extraction (especially the readable snippet), resulting in junk summaries
// like "Wayback Machine doesn't have that page archived" or toolbar UI text.
//
// This is a targeted text removal — no DOM parsing, no heavy libraries.
function stripWaybackNavigation(html: string): string {
  // Remove the Wayback toolbar block: <!-- BEGIN WAYBACK TOOLBAR INSERT --> ... <!-- END WAYBACK TOOLBAR INSERT -->
  let cleaned = html
    .replace(/<!-- BEGIN WAYBACK TOOLBAR INSERT -->[\s\S]*?<!-- END WAYBACK TOOLBAR INSERT -->/gi, '')
    .replace(/<div[^>]+id=["']wm-ipp-base["'][^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<div[^>]+id=["']wm-ipp["'][^>]*>[\s\S]*?<\/div>/gi, '');

  // Remove inline Wayback scripts that reference archive.org
  cleaned = cleaned.replace(/<script[^>]*>[\s\S]*?archive\.org[\s\S]*?<\/script>/gi, '');

  // Remove the Wayback stylesheet link
  cleaned = cleaned.replace(/<link[^>]+web\.archive\.org[^>]*>/gi, '');

  return cleaned;
}

// Wayback connector — fetch a single archived page and produce a candidate.
async function fetchWaybackPagePreview(
  source:         DbScannerSource,
  url:            string,
  topicGroup?:    string,
  topicGroupName?: string,
): Promise<{ candidate: FetchedCandidate } | { error: string }> {
  // Extract timestamp and original URL from the Wayback URL
  // Format: https://web.archive.org/web/20231201120000/https://example.com/page
  const tsMatch = url.match(/\/web\/(\d{14})\//);
  const timestamp  = tsMatch?.[1] ?? '';
  const archivedAt = timestamp ? waybackTimestampToIso(timestamp) : undefined;

  let html: string;
  try {
    const res = await fetch(url, {
      cache:   'no-store',
      headers: {
        'User-Agent': 'SWIM-Archive-Scout/1.0 (human-curator-supervised; research archive)',
        'Accept':     'text/html,application/xhtml+xml;q=0.9',
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { error: `Wayback fetch HTTP ${res.status}` };
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('text/html') && !ct.includes('xhtml')) {
      return { error: `expected HTML, got ${ct.split(';')[0].trim()}` };
    }
    html = await res.text();
  } catch (err) {
    return { error: `Wayback page fetch — ${err instanceof Error ? err.message : String(err)}` };
  }

  // Phase AE: deep archive extraction — strip toolbar, run deep content + forum detection.
  const cleanedHtml  = stripWaybackNavigation(html);
  const archContent  = extractArchiveContent(cleanedHtml, url);

  const extracted  = extractPageData(cleanedHtml, url);
  const title      = cleanTitle(extracted.title) || source.name;

  // Phase AE TASK 6: prefer archContent.mainText over generic snippet when longer + richer
  const richBody = archContent.mainText.length > (extracted.snippet?.length ?? 0)
    ? archContent.mainText
    : (extracted.snippet ?? '');
  const summary    = buildSummary(extracted.description, richBody);

  const conf       = scoreExtractionConfidence(title, summary);
  const quality    = candidatePassesQuality(url, title, summary);
  const badCheck   = detectBadCandidate(url, title, summary);

  // Phase AE TASK 4: navigation/portal pages are low-value — mark as bad candidate
  if (archContent.isNavigationPage && !badCheck.bad) {
    return { error: 'Archive navigation page — no narrative content extracted' };
  }

  if (!quality.pass) {
    return { error: `Quality filter: ${quality.reason}` };
  }

  // Extract the original domain from the Wayback URL
  let originalDomain: string | undefined;
  const origUrlMatch = url.match(/\/web\/\d{14}\/(https?:\/\/[^/\s]+)/);
  try { if (origUrlMatch) originalDomain = new URL(origUrlMatch[1]).hostname; } catch { /* ignore */ }

  const heuristics     = scoreStoryHeuristics(`${title} ${summary}`);
  const langBonus      = computePreSocialLanguageBonus(`${title} ${summary}`);
  // Phase AE TASK 5: conspiracy vocabulary bonus
  const conspVocab     = computeConspiracyVocabBonus(`${title} ${summary}`);
  const waybackScore   = Math.min(heuristics.storyScore + 5 + langBonus + Math.floor(conspVocab / 3), 100);

  // Origin priority scoring — Wayback snapshots get the isArchivedWayback bonus
  const originResult = computeOriginPriorityScore(waybackScore, {
    archiveTimestamp:  timestamp,
    originalDomain,
    sourceUrl:         url,
    isArchivedWayback: true,
  });

  const firstSeenYear = originResult.archiveYear;

  // Phase AE TASK 7: composite archive signal score
  const archiveSignalScore = computeArchiveSignalScore({
    archiveYear:      originResult.archiveYear,
    sourceType:       'wayback',
    contentScore:     archContent.contentScore,
    urlDepthScore:    archContent.urlDepthScore,
    isForumThread:    archContent.forumData?.isForumThread,
    storyScore:       heuristics.storyScore,
    conspVocabBonus:  conspVocab,
    langBonus,
    isPreSocialEra:   originResult.isPreSocialEra,
    isNavigationPage: archContent.isNavigationPage,
    contentLength:    summary.length,
  });

  const isOldWeb = originalDomain ? OLD_WEB_DOMAINS.some((d) => originalDomain!.includes(d)) : false;
  const originFraming = isOldWeb || (firstSeenYear != null && firstSeenYear < 2010)
    ? 'Internet artifact — archived claim from the early web. Content is not verified or endorsed. Curator review required before publishing.'
    : 'Archived origin signal. Content is not verified or endorsed. Curator review required.';

  // Build forum-aware capture notes
  const forumNote = archContent.forumData?.isForumThread
    ? ` Forum thread detected${archContent.forumData.replyCount != null ? ` · ${archContent.forumData.replyCount} replies` : ''}.`
    : '';

  // Phase AF: taxonomy + fiction + document signal
  const waybackTaxonomy     = classifySourceTaxonomy('wayback', source.name);
  const waybackFiction      = detectFictionOrLarp(`${title} ${summary}`);
  const waybackDocSignal    = detectDocumentSignals(`${title} ${summary}`);

  const candidate: FetchedCandidate = {
    title:                title.slice(0, 200),
    summary:              summary.slice(0, 2000),
    sourceUrl:            extracted.canonicalUrl || url,
    category:             source.category_focus[0] ?? 'Internet Lore',
    tags:                 [
      'scanner-source', 'wayback', 'archived', 'discovered-link', 'internet-artifact',
      ...(archContent.forumData?.isForumThread ? ['forum-thread'] : []),
      ...(originResult.isPreSocialEra         ? ['pre-social']   : []),
    ],
    anomalyScore:         5,
    categoryNote:         buildCategoryNote(source.category_focus, extracted.title, extracted.description),
    extractionConfidence: conf.confidence,
    extractionWarning:    conf.warning ?? undefined,
    sourceType:           'wayback',
    isArchived:           true,
    archivedAt,
    passReason:           quality.reason,
    badCandidateReason:   badCheck.bad ? badCheck.reason : undefined,
    sourceImageUrl:       extracted.imageUrl || undefined,
    mediaType:            extracted.imageUrl ? 'image' : 'webpage',
    attributionText:      `Archived via Wayback Machine · ${source.name}`,
    captureNotes:         `Wayback snapshot${archivedAt ? ` from ${archivedAt.slice(0, 10)}` : ''}${topicGroupName ? ` · topic: ${topicGroupName}` : ''}.${forumNote} ${originFraming} Raw HTML not stored.`,
    originalDomain,
    storyScore:           waybackScore,
    storySignals:         heuristics.storySignals.length > 0 ? heuristics.storySignals : undefined,
    finalPriorityScore:   computeFinalPriorityScore(waybackScore, { isArchived: true, isBadCandidate: badCheck.bad }),
    originPriorityScore:  originResult.score,
    archiveSignalScore,
    sourceEra:            originResult.era,
    archiveYear:          originResult.archiveYear,
    isPreSocialEra:       originResult.isPreSocialEra,
    topicGroup,
    topicGroupName,
    firstSeenYear,
    sourceTaxonomy:       waybackTaxonomy,
    isFictionLarp:        waybackFiction.isFiction || undefined,
    documentSignalScore:  waybackDocSignal > 0 ? waybackDocSignal : undefined,
  };

  return { candidate };
}

// ---------------------------------------------------------------------------
// MediaWiki connector — discover articles on a MediaWiki instance
// ---------------------------------------------------------------------------

async function discoverMediaWikiLinks(
  source: DbScannerSource,
): Promise<{ links: DiscoveredLink[] } | { error: string }> {
  // Search using the source's category_focus keywords to find relevant articles
  const query = source.category_focus.slice(0, 3).join(' ') || 'lost found archived';
  const result = await searchMediaWikiArticles(source.base_url!, query, DISCOVERY_MAX_LINKS);
  if ('error' in result) return result;

  const links: DiscoveredLink[] = result.results.map((r) => ({
    url:         r.url,
    linkText:    r.title,
    matchReason: r.snippet.slice(0, 120) || 'MediaWiki article',
  }));

  return { links };
}

// MediaWiki connector — fetch a single article and produce a candidate.
async function fetchMediaWikiPagePreview(
  source: DbScannerSource,
  url:    string,
): Promise<{ candidate: FetchedCandidate } | { error: string }> {
  // Extract the article title from the URL: /wiki/Article_Title
  const titleMatch = url.match(/\/wiki\/([^?#]+)/);
  if (!titleMatch) return { error: 'could not extract article title from URL' };
  const rawTitle   = decodeURIComponent(titleMatch[1].replace(/_/g, ' '));

  const result = await fetchMediaWikiArticle(source.base_url!, rawTitle);
  if ('error' in result) return result;

  const { article } = result;
  const title    = cleanTitle(article.title) || source.name;
  const summary  = article.extract.trim() || 'No extract available — edit manually.';
  const conf     = scoreExtractionConfidence(title, summary);
  const quality  = candidatePassesQuality(url, title, summary);
  const badCheck = detectBadCandidate(url, title, summary);

  if (!quality.pass) {
    return { error: `Quality filter: ${quality.reason}` };
  }

  const heuristics = scoreStoryHeuristics(`${title} ${summary}`);

  // Phase AF: taxonomy + fiction + document signal for MediaWiki
  const wikiTaxonomy  = classifySourceTaxonomy('mediawiki', source.name);
  const wikiDocSignal = detectDocumentSignals(`${title} ${summary}`);

  const candidate: FetchedCandidate = {
    title:                title.slice(0, 200),
    summary:              summary.slice(0, 2000),
    sourceUrl:            article.url,
    category:             source.category_focus[0] ?? 'Internet Lore',
    tags:                 ['scanner-source', 'mediawiki', 'discovered-link'],
    anomalyScore:         5,
    categoryNote:         buildCategoryNote(source.category_focus, article.title, article.extract),
    extractionConfidence: conf.confidence,
    extractionWarning:    conf.warning ?? undefined,
    sourceType:           'mediawiki',
    isArchived:           false,
    passReason:           quality.reason,
    badCandidateReason:   badCheck.bad ? badCheck.reason : undefined,
    sourceImageUrl:       article.imageUrl || undefined,
    mediaType:            article.imageUrl ? 'image' : 'webpage',
    attributionText:      `Recovered from ${source.name} · MediaWiki`,
    captureNotes:         `MediaWiki article: "${article.title}". Plain-text extract only — raw wiki markup not stored.`,
    storyScore:           heuristics.storyScore,
    storySignals:         heuristics.storySignals.length > 0 ? heuristics.storySignals : undefined,
    finalPriorityScore:   computeFinalPriorityScore(heuristics.storyScore, { isBadCandidate: badCheck.bad }),
    sourceTaxonomy:       wikiTaxonomy,
    documentSignalScore:  wikiDocSignal > 0 ? wikiDocSignal : undefined,
  };

  return { candidate };
}

// ---------------------------------------------------------------------------
// Textfiles.com BBS connector — Phase O
//
// Jason Scott's textfiles.com preserves 1980s–1990s BBS text files across
// categories: ufo, conspiracy, paranormal, occult, hauntings, stories, aliens.
//
// SAFETY:
//   - Fetches category directory listings to discover .txt file paths.
//   - Fetches individual .txt files; stores only first 600 chars.
//   - No full-text storage of copyrighted material.
//   - Content is classified as "internet artifact" — curator review required.
//   - No auto-publish, no mass crawl. Max 2 files per category, 5 total.
// ---------------------------------------------------------------------------

// Phase V expanded — more categories for deeper origin coverage.
// Includes BBS-era subject areas beyond the original 7.
// Phase AC: expanded category list — more pre-social text domains covered
const TEXTFILES_CATEGORIES = [
  'ufo', 'conspiracy', 'paranormal', 'occult', 'hauntings', 'stories', 'aliens',
  'phreak', 'hacker', 'anarchy', 'drugs', 'reports', 'sf',
  'humor', 'science', 'media', 'music', 'hypnosis', 'drugs',
  'history', 'politics', 'piracy', 'underground', 'survival',
  'religion', 'cult', 'cia', 'security',
];

function isTextfilesSource(source: DbScannerSource): boolean {
  return source.source_type === 'bbs' || (source.base_url ?? '').toLowerCase().includes('textfiles.com');
}

async function fetchTextfilesMultipleCandidates(
  source: DbScannerSource,
  isOriginScan = false,
): Promise<{
  candidates: FetchedCandidate[];
  error?: string;
  debugInfo: { categoriesTried: number; filesFetched: number };
}> {
  const candidates: FetchedCandidate[] = [];
  let categoriesTried = 0;
  let filesFetched    = 0;

  const UA_HDR = {
    'User-Agent': 'SWIM-Archive-Scout/1.0 (human-curator-supervised; research archive)',
    'Accept':     'text/plain, text/html;q=0.9',
  };

  // Shuffle categories so successive scans hit different areas
  const shuffledCats = [...TEXTFILES_CATEGORIES];
  for (let i = shuffledCats.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffledCats[i], shuffledCats[j]] = [shuffledCats[j], shuffledCats[i]];
  }

  // Helper — collect .txt links and one level of subdirectory .txt links from a directory URL.
  async function collectTxtLinksFromDir(dirUrl: string): Promise<string[]> {
    let dirHtml: string;
    try {
      const res = await fetch(dirUrl, {
        cache:   'no-store',
        headers: { ...UA_HDR, Accept: 'text/html,application/xhtml+xml;q=0.9' },
        signal:  AbortSignal.timeout(10_000),
      });
      if (!res.ok) return [];
      dirHtml = await res.text();
    } catch { return []; }

    const txtLinks: string[] = [];
    const subdirs:  string[] = [];

    // Match .txt files and subdirectory links (href ending with / that stays on textfiles.com)
    const linkRe = /href=["']([^"'?#]{1,120})["']/gi;
    let m: RegExpExecArray | null;
    while ((m = linkRe.exec(dirHtml)) !== null) {
      const href = m[1];
      try {
        const resolved = new URL(href, dirUrl).href;
        if (!resolved.startsWith('https://www.textfiles.com/')) continue;
        if (resolved === dirUrl) continue;
        if (href.endsWith('.txt') || href.toLowerCase().endsWith('.txt')) {
          if (!txtLinks.includes(resolved)) txtLinks.push(resolved);
        } else if (href.endsWith('/') && resolved !== 'https://www.textfiles.com/' && !subdirs.includes(resolved)) {
          subdirs.push(resolved);
        }
      } catch { /* skip */ }
    }

    // One level of subdirectory discovery — fetch up to 2 subdirs and collect .txt files
    for (const subdir of subdirs.slice(0, 2)) {
      try {
        const subRes = await fetch(subdir, {
          cache:   'no-store',
          headers: { ...UA_HDR, Accept: 'text/html,application/xhtml+xml;q=0.9' },
          signal:  AbortSignal.timeout(8_000),
        });
        if (!subRes.ok) continue;
        const subHtml = await subRes.text();
        const subRe = /href=["']([^"'?#]{1,120}\.txt)["']/gi;
        let sm: RegExpExecArray | null;
        while ((sm = subRe.exec(subHtml)) !== null) {
          try {
            const resolved = new URL(sm[1], subdir).href;
            if (resolved.startsWith('https://www.textfiles.com/') && !txtLinks.includes(resolved)) {
              txtLinks.push(resolved);
            }
          } catch { /* skip */ }
        }
      } catch { /* skip */ }
    }

    return txtLinks;
  }

  // Phase AC: origin scan fetches more BBS files per run for archive saturation
  const bbsCap      = isOriginScan ? 12 : 6;
  const bbsPerCatCap = isOriginScan ? 4  : 2;

  for (const category of shuffledCats) {
    if (candidates.length >= bbsCap) break;

    const dirUrl = `https://www.textfiles.com/${category}/`;
    categoriesTried++;

    const txtLinks = await collectTxtLinksFromDir(dirUrl);
    if (txtLinks.length === 0) continue;

    // Shuffle for random sampling
    for (let i = txtLinks.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [txtLinks[i], txtLinks[j]] = [txtLinks[j], txtLinks[i]];
    }

    for (const txtUrl of txtLinks.slice(0, bbsPerCatCap)) {
      if (candidates.length >= bbsCap) break;

      let rawText: string;
      try {
        const res = await fetch(txtUrl, {
          cache:   'no-store',
          headers: UA_HDR,
          signal:  AbortSignal.timeout(12_000),
        });
        if (!res.ok) continue;
        rawText = await res.text();
      } catch { continue; }

      filesFetched++;

      // Phase AE TASK 3: use structured BBS artifact parser
      const filename   = txtUrl.split('/').pop() ?? 'unknown.txt';
      const bbsArtifact = parseBBSTextArtifact(rawText, filename, category);

      // Skip index/directory files and files that are too short
      if (bbsArtifact.isIndexFile) continue;
      if (bbsArtifact.excerpt.length < 60) continue;

      const { title, excerpt } = bbsArtifact;

      const heuristics     = scoreStoryHeuristics(`${title} ${excerpt}`);
      const langBonus      = computePreSocialLanguageBonus(`${title} ${excerpt}`);
      // Phase AE TASK 5: conspiracy vocabulary bonus
      const conspVocab     = computeConspiracyVocabBonus(`${title} ${excerpt}`);
      const bbsBaseScore   = Math.min(heuristics.storyScore + langBonus + Math.floor(conspVocab / 4), 100);
      const originResult   = computeOriginPriorityScore(bbsBaseScore, { sourceType: 'bbs' });
      const conf           = scoreExtractionConfidence(title, excerpt);

      // Phase AE TASK 7: archive signal score for BBS artifacts
      const archiveSignalScore = computeArchiveSignalScore({
        sourceType:       'bbs',
        hasBBSHeader:     bbsArtifact.hasBBSHeader,
        storyScore:       heuristics.storyScore,
        conspVocabBonus:  conspVocab,
        langBonus,
        isPreSocialEra:   true,
        contentLength:    excerpt.length,
      });

      // Phase V: map textfiles category to nearest topic group
      const bbsTopicGroup = BBS_CATEGORY_TOPIC[category] ?? 'internet-lore';
      const bbsTopicName  = BBS_CATEGORY_TOPIC_NAME[category] ?? 'Internet Lore';

      // Build summary with BBS header context if available
      const headerCtx = bbsArtifact.hasBBSHeader && bbsArtifact.headerLines.length > 0
        ? `[${bbsArtifact.headerLines.slice(0, 2).join(' · ')}] `
        : '';

      // Phase AF: taxonomy + fiction + document signal for BBS artifacts
      const bbsTaxonomy  = classifySourceTaxonomy('bbs', source.name);
      const bbsFiction   = detectFictionOrLarp(`${title} ${excerpt}`);
      const bbsDocSignal = detectDocumentSignals(`${title} ${excerpt}`);

      const candidate: FetchedCandidate = {
        title,
        summary:              `[BBS/TEXT ARTIFACT — ${category}] ${headerCtx}${excerpt.slice(0, 480)}`,
        sourceUrl:            txtUrl,
        category:             source.category_focus[0] ?? 'Internet Lore',
        tags:                 [
          'scanner-source', 'bbs', 'textfiles', 'archive', category,
          'internet-artifact', 'text-artifact',
          ...(bbsArtifact.hasBBSHeader ? ['usenet', 'bbs-header'] : []),
        ],
        anomalyScore:         5,
        categoryNote:         `BBS/TEXT ARTIFACT · textfiles.com/${category} · ${filename}`,
        extractionConfidence: conf.confidence,
        extractionWarning:    conf.warning ?? 'BBS-era text — internet artifact; unverified archived claim; curator review required',
        sourceType:           'bbs',
        isArchived:           true,
        passReason:           'BBS/TEXT ARTIFACT — origin scan',
        attributionText:      `Textfiles.com BBS Archive · ${category} · ${filename}`,
        captureNotes:         `BBS/pre-internet text file from textfiles.com/${category}/. Best narrative section extracted — full text not stored. Authors are anonymous by BBS convention.${bbsArtifact.hasBBSHeader ? ' Usenet/BBS headers detected.' : ''} Internet artifact — archived claim, not verified, not endorsed.`,
        storyScore:           heuristics.storyScore,
        storySignals:         heuristics.storySignals.length > 0 ? heuristics.storySignals : undefined,
        originPriorityScore:  originResult.score,
        archiveSignalScore,
        sourceEra:            originResult.era,
        archiveYear:          undefined,
        isPreSocialEra:       true,
        finalPriorityScore:   originResult.score,
        topicGroup:           bbsTopicGroup,
        topicGroupName:       bbsTopicName,
        firstSeenYear:        undefined,
        sourceTaxonomy:       bbsTaxonomy,
        isFictionLarp:        bbsFiction.isFiction || undefined,
        documentSignalScore:  bbsDocSignal > 0 ? bbsDocSignal : undefined,
      };

      candidates.push(candidate);
    }
  }

  if (candidates.length === 0) {
    return { candidates, error: 'No BBS text files fetched — textfiles.com may be unreachable or categories returned no .txt links.', debugInfo: { categoriesTried, filesFetched } };
  }

  return { candidates, debugInfo: { categoriesTried, filesFetched } };
}

// Map textfiles.com category names to Phase V topic groups
const BBS_CATEGORY_TOPIC: Record<string, string> = {
  ufo:       'ufo-disclosure',
  aliens:    'ufo-disclosure',
  conspiracy:'ufo-disclosure',
  paranormal:'ufo-disclosure',
  occult:    'ancient-occult',
  hauntings: 'ufo-disclosure',
  stories:   'internet-lore',
  phreak:    'internet-lore',
  hacker:    'internet-lore',
  anarchy:   'internet-lore',
  drugs:     'internet-lore',
  sex:       'internet-lore',
  reports:   'ufo-disclosure',
  sf:        'internet-lore',
  humor:     'internet-lore',
  science:   'internet-lore',
  media:     'lost-media',
  music:     'lost-media',
};

const BBS_CATEGORY_TOPIC_NAME: Record<string, string> = {
  ufo:       'UFO / Disclosure',
  aliens:    'UFO / Disclosure',
  conspiracy:'UFO / Disclosure',
  paranormal:'UFO / Disclosure',
  occult:    'Ancient / Occult',
  hauntings: 'UFO / Disclosure',
  stories:   'Internet Lore',
  phreak:    'Internet Lore',
  hacker:    'Internet Lore',
  anarchy:   'Internet Lore',
  drugs:     'Internet Lore',
  sex:       'Internet Lore',
  reports:   'UFO / Disclosure',
  sf:        'Internet Lore',
  humor:     'Internet Lore',
  science:   'Internet Lore',
  media:     'Lost Media',
  music:     'Lost Media',
};

// ---------------------------------------------------------------------------
// Erowid Experience Vaults connector
//
// Erowid publishes individual experience reports at:
//   https://erowid.org/experiences/exp.php?ID=XXXXX
//
// Discovery fetches the Erowid index page and extracts links to individual
// reports only — index/category/listing pages are never surfaced.
//
// Fetch extracts only the first excerpt of a report — full text is NOT stored.
// Attribution is always credited back to Erowid Experience Vaults.
// ---------------------------------------------------------------------------

async function discoverErowidExperienceLinks(
  source: DbScannerSource,
): Promise<{ links: DiscoveredLink[] } | { error: string }> {
  const fetchUrl = source.base_url ?? 'https://erowid.org/experiences/';

  let html: string;
  try {
    const res = await fetch(fetchUrl, {
      cache:   'no-store',
      headers: {
        'User-Agent': 'SWIM-Archive-Scout/1.0 (human-curator-supervised; research archive)',
        'Accept':     'text/html,application/xhtml+xml;q=0.9',
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return { error: `Erowid fetch HTTP ${res.status} — ${res.statusText}` };
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('text/html') && !ct.includes('xhtml')) {
      return { error: `Erowid returned non-HTML: ${ct.split(';')[0].trim()}` };
    }
    html = await res.text();
  } catch (err) {
    return { error: `Erowid fetch — ${err instanceof Error ? err.message : String(err)}` };
  }

  const anchors   = extractAnchors(html.slice(0, 200_000), fetchUrl);
  const seen      = new Set<string>();
  const links: DiscoveredLink[] = [];

  for (const { href, text } of anchors) {
    if (links.length >= DISCOVERY_MAX_LINKS) break;

    // Only individual experience report URLs — must have /exp.php in the path
    const lc = href.toLowerCase();
    if (!lc.includes('/exp.php')) continue;

    // Must include a report ID
    try {
      const p = new URL(href);
      if (!p.searchParams.get('ID') && !p.search.match(/[?&]ID=\d+/i)) continue;
    } catch { continue; }

    if (seen.has(href)) continue;
    seen.add(href);

    const linkText = text.replace(/\s+/g, ' ').trim() || 'Erowid experience report';
    links.push({
      url:         href,
      linkText:    linkText.slice(0, 200),
      matchReason: 'Erowid experience report',
    });
  }

  if (links.length === 0) {
    return {
      error:
        'No individual experience report links found on this Erowid page. ' +
        'The page may require a more specific URL — try a substance category page like erowid.org/experiences/subs/exp_DMT.shtml',
    };
  }

  return { links };
}

// Erowid connector — fetch one individual experience report and produce a candidate.
// Only exp.php?ID= URLs are accepted; index/category pages return an error.
async function fetchErowidExperiencePreview(
  source: DbScannerSource,
  url:    string,
): Promise<{ candidate: FetchedCandidate } | { error: string }> {
  if (!isErowidReportUrl(url)) {
    return {
      error:
        'Erowid index/category page — choose an individual experience report ' +
        '(URL must contain /exp.php?ID=...).',
    };
  }

  let html: string;
  try {
    const res = await fetch(url, {
      cache:   'no-store',
      headers: {
        'User-Agent': 'SWIM-Archive-Scout/1.0 (human-curator-supervised; research archive)',
        'Accept':     'text/html,application/xhtml+xml;q=0.9',
      },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return { error: `Erowid report fetch HTTP ${res.status}` };
    const ct = res.headers.get('content-type') ?? '';
    if (!ct.includes('text/html') && !ct.includes('xhtml')) {
      return { error: `expected HTML, got ${ct.split(';')[0].trim()}` };
    }
    html = await res.text();
  } catch (err) {
    return { error: `Erowid report fetch — ${err instanceof Error ? err.message : String(err)}` };
  }

  // Standard metadata extraction (title, description, og:image)
  const extracted = extractPageData(html, url);

  // Erowid titles often include the substance: "DMT: First Encounter — Erowid Exp. Vaults"
  // Clean the title, then try to infer substance from it.
  const rawTitle = extracted.title;
  let title = cleanTitle(rawTitle) || 'Erowid Experience Report';

  // Detect substance prefix: "SUBSTANCE: Report Title" or "A / B: Report Title"
  let substanceHint = '';
  const subMatch = rawTitle.match(/^([A-Z][A-Za-z0-9&/\s]{1,35}):\s+(.{8,})/);
  if (subMatch) {
    substanceHint = subMatch[1].trim();
  }

  // Erowid-specific content extraction — try to pull the report body text.
  // Erowid uses various class names for the report text block across page generations.
  let reportExcerpt = '';
  const slicedHtml = html.slice(0, 300_000);

  // Strategy 1: div with a class containing "report", "exp", or "experience" in the name
  const reportDivMatch = slicedHtml.match(
    /class=["'][^"']*(?:report[_-]?text|exp[_-]?report|experience[_-]?text|report[_-]?body)[^"']*["'][^>]*>([\s\S]{80,6000}?)<\/div>/i,
  );
  if (reportDivMatch) {
    reportExcerpt = decodeHtmlEntities(
      reportDivMatch[1]
        .replace(/<[^>]{0,1000}>/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim()
        .slice(0, 1000),
    );
  }

  // Strategy 2: <main> or <article> semantic block
  if (reportExcerpt.length < 80) {
    const mainMatch = slicedHtml.match(/<(?:main|article)[^>]*>([\s\S]{100,8000}?)<\/(?:main|article)>/i);
    if (mainMatch) {
      reportExcerpt = decodeHtmlEntities(
        mainMatch[1]
          .replace(/<(nav|header|footer|aside|script|style)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
          .replace(/<[^>]{0,1000}>/g, ' ')
          .replace(/\s{2,}/g, ' ')
          .trim()
          .slice(0, 1000),
      );
    }
  }

  const summary = reportExcerpt.length >= 80
    ? reportExcerpt.slice(0, 1500)
    : buildSummary(extracted.description, extracted.snippet);

  if (summary.trim().length < 40) {
    return {
      error:
        'Could not extract report content from this Erowid page — ' +
        'it may be a listing or category page rather than an individual report.',
    };
  }

  const conf       = scoreExtractionConfidence(title, summary);
  const bad        = detectBadCandidate(url, title, summary);
  const heuristics = scoreStoryHeuristics(`${title} ${summary}`);

  const categoryNote = substanceHint
    ? `${source.category_focus[0] ?? 'Psychedelics'} · substance: ${substanceHint}`
    : buildCategoryNote(source.category_focus, title, summary);

  const candidate: FetchedCandidate = {
    title:                title.slice(0, 200),
    summary:              summary.slice(0, 2000),
    sourceUrl:            url,
    category:             source.category_focus[0] ?? 'Psychedelics',
    tags:                 ['scanner-source', 'erowid', 'experience-report', 'archive'],
    anomalyScore:         5,
    categoryNote,
    extractionConfidence: conf.confidence,
    extractionWarning:    conf.warning ?? undefined,
    sourceType:           'archive',
    isArchived:           false,
    passReason:           'Individual Erowid experience report',
    badCandidateReason:   bad.bad ? bad.reason : undefined,
    sourceImageUrl:       extracted.imageUrl || undefined,
    mediaType:            'webpage',
    attributionText:      'Recovered from Erowid Experience Vaults',
    captureNotes:         'Summary extracted from an individual Erowid report page. Full report text not stored.',
    storyScore:           heuristics.storyScore,
    storySignals:         heuristics.storySignals.length > 0 ? heuristics.storySignals : undefined,
    finalPriorityScore:   computeFinalPriorityScore(heuristics.storyScore, { isErowid: true, isBadCandidate: bad.bad }),
  };

  return { candidate };
}

export async function discoverSourceLinksAction(
  sourceId: string,
): Promise<{ links: DiscoveredLink[] } | { error: string }> {
  const source = await getScannerSource(sourceId);
  if (!source)          return { error: 'source not found in registry' };
  if (!source.enabled)  return { error: 'source must be enabled before discovery' };
  if (!source.base_url) return { error: 'source has no base URL configured' };

  // Erowid connector — discover individual experience report links from the vaults index
  if (isErowidSource(source)) {
    return discoverErowidExperienceLinks(source);
  }

  // Wayback CDX connector — query Internet Archive snapshots
  if (source.source_type === 'wayback') {
    return discoverWaybackLinks(source);
  }

  // MediaWiki connector — search wiki articles via API.
  // Also auto-routes archive/other sources whose URL looks like a MediaWiki site
  // (e.g. lostmediawiki.com registered as source_type 'archive').
  if (source.source_type === 'mediawiki' || isMediaWikiHost(source.base_url)) {
    return discoverMediaWikiLinks(source);
  }

  // Reddit connector — use JSON API instead of HTML scraping.
  // Also catches reddit.com sources registered as source_type 'other'/'forum'.
  if (source.source_type === 'reddit' || REDDIT_HOST.test(new URL(source.base_url).hostname)) {
    return discoverRedditPosts(source);
  }

  let html: string;
  try {
    const response = await fetch(source.base_url, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'SWIM-Archive-Scout/1.0 (human-curator-supervised; research archive)',
        'Accept':     'text/html,application/xhtml+xml;q=0.9',
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return { error: `HTTP ${response.status} — ${response.statusText}` };
    const ct = response.headers.get('content-type') ?? '';
    if (!ct.includes('text/html') && !ct.includes('xhtml')) {
      return { error: `expected HTML, got ${ct.split(';')[0].trim()}` };
    }
    html = await response.text();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `network error — ${msg}` };
  }

  let baseHostname: string;
  try { baseHostname = new URL(source.base_url).hostname; }
  catch { return { error: 'invalid base URL' }; }

  const isArchiveType =
    source.source_type === 'archive' ||
    baseHostname.includes('archive.org') ||
    baseHostname.includes('wayback');

  const anchors = extractAnchors(html.slice(0, 200_000), source.base_url);
  const seen    = new Set<string>();
  const results: DiscoveredLink[] = [];

  for (const { href, text } of anchors) {
    if (results.length >= DISCOVERY_MAX_LINKS) break;
    if (seen.has(href)) continue;
    seen.add(href);

    // Skip the source page itself
    if (href === source.base_url || href === source.base_url + '/') continue;
    // Skip asset/feed extensions
    if (SKIP_EXTENSIONS.test(href)) continue;

    // Domain check — strict for non-archive sources
    try {
      const linkHost = new URL(href).hostname;
      if (!isArchiveType && linkHost !== baseHostname) continue;
    } catch { continue; }

    const reason = discoveryKeywordMatch(href, text);
    if (!reason && !isArchiveType) continue;

    results.push({
      url:         href,
      linkText:    text || href,
      matchReason: reason
        ? `matched keyword: "${reason}"`
        : 'archive source — all same-origin links included',
    });
  }

  return { links: results };
}

// Fetches a specific discovered URL using the source's identity + same-domain validation.
// Returns a FetchedCandidate for curator review — no DB writes.
export async function fetchDiscoveredLinkPreviewAction(
  sourceId: string,
  url:      string,
): Promise<{ candidate: FetchedCandidate } | { error: string }> {
  const source = await getScannerSource(sourceId);
  if (!source)          return { error: 'source not found in registry' };
  if (!source.enabled)  return { error: 'source must be enabled before fetching' };
  if (!source.base_url) return { error: 'source has no base URL configured' };

  let parsedUrl: URL;
  try   { parsedUrl = new URL(url); }
  catch { return { error: 'invalid URL' }; }
  if (!parsedUrl.protocol.startsWith('http')) return { error: 'only HTTP/HTTPS URLs allowed' };

  const baseHostname = new URL(source.base_url).hostname;
  const isArchiveType =
    source.source_type === 'archive' ||
    source.source_type === 'wayback' ||
    baseHostname.includes('archive.org');
  const isWaybackUrl      = parsedUrl.hostname === 'web.archive.org';
  const isMediaWikiSource = source.source_type === 'mediawiki' || isMediaWikiHost(source.base_url);
  const isRedditSource    = source.source_type === 'reddit' || REDDIT_HOST.test(new URL(source.base_url).hostname);

  if (!isArchiveType && !isMediaWikiSource && !isRedditSource && parsedUrl.hostname !== baseHostname && !REDDIT_HOST.test(parsedUrl.hostname)) {
    return { error: `cross-domain fetch blocked — ${parsedUrl.hostname} is not ${baseHostname}` };
  }

  // Erowid connector — individual report pages only; index pages return an error
  if (isErowidSource(source) || parsedUrl.hostname.includes('erowid.org')) {
    return fetchErowidExperiencePreview(source, url);
  }

  // Wayback connector — archived page via Wayback Machine URL
  if (isWaybackUrl || source.source_type === 'wayback') {
    return fetchWaybackPagePreview(source, url);
  }

  // MediaWiki connector — use API for structured article data
  if (isMediaWikiSource || url.includes('/wiki/')) {
    return fetchMediaWikiPagePreview(source, url);
  }

  // Reddit connector — use JSON API for structured post metadata
  if (REDDIT_HOST.test(parsedUrl.hostname)) {
    return fetchRedditPostPreview(source, url);
  }

  let html: string;
  try {
    const response = await fetch(url, {
      cache: 'no-store',
      headers: {
        'User-Agent': 'SWIM-Archive-Scout/1.0 (human-curator-supervised; research archive)',
        'Accept':     'text/html,application/xhtml+xml;q=0.9',
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) return { error: `HTTP ${response.status} — ${response.statusText}` };
    const ct = response.headers.get('content-type') ?? '';
    if (!ct.includes('text/html') && !ct.includes('xhtml')) {
      return { error: `expected HTML, got ${ct.split(';')[0].trim()}` };
    }
    html = await response.text();
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { error: `network error — ${msg}` };
  }

  const extracted  = extractPageData(html, url);
  const title      = cleanTitle(extracted.title) || source.name;
  const summary    = buildSummary(extracted.description, extracted.snippet);
  const conf       = scoreExtractionConfidence(title, summary);
  const quality    = candidatePassesQuality(url, title, summary);
  const heuristics = scoreStoryHeuristics(`${title} ${summary}`);

  const candidate: FetchedCandidate = {
    title:                title.slice(0, 200),
    summary:              summary.slice(0, 2000),
    sourceUrl:            extracted.canonicalUrl || url,
    category:             source.category_focus[0] ?? 'Internet Lore',
    tags:                 ['scanner-source', source.source_type, 'discovered-link'],
    anomalyScore:         5,
    categoryNote:         buildCategoryNote(source.category_focus, extracted.title, extracted.description),
    extractionConfidence: conf.confidence,
    extractionWarning:    conf.warning ?? undefined,
    sourceType:           source.source_type,
    isArchived:           false,
    passReason:           quality.reason,
    sourceImageUrl:       extracted.imageUrl || undefined,
    mediaType:            extracted.imageUrl ? 'image' : 'webpage',
    attributionText:      `Recovered from ${source.name} · ${source.source_type} source`,
    captureNotes:         'Captured from discovered link during limited scan. Raw HTML not stored.',
    storyScore:           heuristics.storyScore,
    storySignals:         heuristics.storySignals.length > 0 ? heuristics.storySignals : undefined,
  };

  return { candidate };
}

// Batch-fetch multiple discovered URLs in parallel.
// Returns SessionSourceResult[] (same shape as runFetchSessionAction) so
// the BatchResultsPanel can reuse SessionResultCard directly.
// Max 20 URLs. Zero DB writes — curator must queue each candidate.
export async function batchFetchDiscoveredLinksAction(
  sourceId: string,
  urls:     string[],
): Promise<{ results: SessionSourceResult[] } | { error: string }> {
  if (urls.length === 0) return { results: [] };
  if (urls.length > 20)  return { error: 'batch limited to 20 URLs' };

  const source = await getScannerSource(sourceId);
  if (!source)         return { error: 'source not found in registry' };
  if (!source.enabled) return { error: 'source must be enabled' };

  const results: SessionSourceResult[] = await Promise.all(
    urls.map(async (url): Promise<SessionSourceResult> => {
      const fetched = await fetchDiscoveredLinkPreviewAction(sourceId, url);
      if ('error' in fetched) {
        return { sourceId, sourceName: url, status: 'error', error: fetched.error };
      }
      const { candidate } = fetched;
      const dupes = await checkSignalDuplicates(candidate.sourceUrl, candidate.title);
      if (dupes.length > 0) {
        return {
          sourceId,
          sourceName: candidate.title,
          status:     'duplicate',
          candidate,
          duplicates: dupes.map((d) => ({ id: d.id, title: d.title, sourceUrl: d.source_url, status: d.status })),
        };
      }
      return { sourceId, sourceName: candidate.title, status: 'preview', candidate };
    }),
  );

  return { results };
}

// Curator action — rebirth a recovered signal as a SWIM thread using
// curator-edited title, body, category, and tags from the RebirthPanel.
// This is the primary path from /scanner/queue; the curator previews
// and edits all content before clicking [ rebirth as thread ].
//
// HUMAN APPROVAL GATE: identical to publishSignalAsThreadAction.
export async function rebirthSignalAsThreadAction(
  input: RebirthSignalInput,
): Promise<{ threadSlug: string } | { error: string }> {
  return rebirthSignalAsThread(input);
}

// Curator action — publish a recovered signal as a SWIM thread.
// Creates the thread, then stamps the signal with the thread UUID and
// sets status='approved'. Prevents duplicate publishing.
//
// HUMAN APPROVAL GATE:
//   Nothing calls this automatically. A curator must click [ publish to thread ]
//   in /scanner/queue for this to run.
//
// TELEGRAM / X INTEGRATION POINT:
//   After a signal is published, the growth workflow (docs/growth-playbook.md)
//   describes how to share the resulting thread on Telegram/X.
//   Automated sharing is a future phase; this action does not trigger it.
export async function publishSignalAsThreadAction(
  signalId: string,
): Promise<{ threadSlug: string } | { error: string }> {
  return publishSignalAsThread(signalId);
}
