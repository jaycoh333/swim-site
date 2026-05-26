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
import type { FetchedCandidate, SignalDuplicate, SessionSourceResult, DiscoveredLink } from '@/lib/scanner-fetch-types';
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
  // Step 1: remove entire nav/header/footer/aside/script/style/form blocks
  let contentHtml = h
    .replace(/<(nav|header|footer|aside|script|style|noscript|iframe|form)[^>]*>[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');

  // Step 2: prefer semantic content areas (<main> or <article>) for snippet
  const mainMatch = contentHtml.match(/<(?:main|article)[^>]*>([\s\S]{80,15000}?)<\/(?:main|article)>/i);
  const workHtml  = mainMatch ? mainMatch[1] : contentHtml;

  // Step 3: strip remaining tags, collapse whitespace, decode entities, take first 600 chars
  const snippet = decodeHtmlEntities(
    workHtml
      .replace(/<[^>]{0,1000}>/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim()
      .slice(0, 600),
  );

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
  };

  return { candidate };
}

// ---------------------------------------------------------------------------
// Reddit multi-candidate — /new + /top?t=week + /hot, top 10 quality posts
// ---------------------------------------------------------------------------

async function fetchRedditMultipleCandidates(
  source: DbScannerSource,
): Promise<{ candidates: FetchedCandidate[] } | { error: string }> {
  const urlMatch = (source.base_url ?? '').match(/\/r\/([A-Za-z0-9_]+)/i);
  if (!urlMatch) {
    return { error: 'Could not parse subreddit — set base_url to reddit.com/r/SubredditName' };
  }
  const subreddit = urlMatch[1];

  const endpoints = [
    `https://www.reddit.com/r/${subreddit}/new.json?limit=25`,
    `https://www.reddit.com/r/${subreddit}/top.json?t=week&limit=25`,
    `https://www.reddit.com/r/${subreddit}/hot.json?limit=25`,
  ];

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
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const posts: RPost[] = ((await res.json()) as any)?.data?.children ?? [];
      for (const post of posts) {
        if (!seen.has(post.data.permalink)) {
          seen.add(post.data.permalink);
          allPosts.push(post);
        }
      }
    } catch { continue; }
  }

  if (!allPosts.length) {
    return { error: `Reddit JSON fetch failed — r/${subreddit} may be private, quarantined, or removed` };
  }

  const filtered = allPosts.filter(({ data: p }) => {
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

  const scored = filtered.map(({ data: p }) => {
    const narrative  = p.selftext?.trim() ? extractNarrative(p.selftext) : '';
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

  const candidates: FetchedCandidate[] = scored.slice(0, 10).map(({ p, narrative, heuristics, totalScore }) => {
    const qualityResult = scoreRedditQuality({
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
      storyScore:           totalScore,
      storySignals:         heuristics.storySignals.length > 0 ? heuristics.storySignals : undefined,
    };
  });

  return { candidates };
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

async function fetchMediaWikiMultipleCandidates(
  source: DbScannerSource,
): Promise<{ candidates: FetchedCandidate[] } | { error: string }> {
  const baseUrl = (source.base_url ?? '').replace(/\/(api\.php|wiki\/?.*)$/, '');
  const query   = source.category_focus.slice(0, 2).join(' ') || 'lost found mystery recovered';
  const searchResult = await searchMediaWikiArticles(baseUrl, query, 10);
  if ('error' in searchResult) return searchResult;

  if (!searchResult.results.length) {
    return { error: `No MediaWiki articles found for "${query}" on ${source.name}` };
  }

  const candidates: FetchedCandidate[] = [];
  for (const searchItem of searchResult.results.slice(0, 10)) {
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
    return { error: `Failed to fetch any articles from ${source.name}` };
  }

  return { candidates };
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
// Fetch session — iterates enabled sources, fetches one page each.
//
// SAFETY:
//   - Source must be enabled=true and have a base_url
//   - Fetches are sequential — no parallel crawl
//   - Raw HTML discarded after extraction
//   - No DB writes here; curator queues each candidate individually
//   - Max 20 sources per session
//   - Per-source timeout: 10 seconds
// ---------------------------------------------------------------------------

export async function runFetchSessionAction(
  sourceIds: string[],
): Promise<{ results: SessionSourceResult[] } | { error: string }> {
  if (!sourceIds.length)    return { error: 'no source IDs provided' };
  if (sourceIds.length > 20) return { error: 'max 20 sources per session' };

  // One DB query to load all sources; avoids N round trips inside the loop.
  const allSources = await getScannerSources();
  const sourceMap  = new Map(allSources.map((s) => [s.id, s]));

  const results: SessionSourceResult[] = [];

  for (const sourceId of sourceIds) {
    const source = sourceMap.get(sourceId);

    if (!source) {
      results.push({ sourceId, sourceName: sourceId, status: 'error', error: 'not found in registry' });
      continue;
    }
    if (!source.enabled) {
      results.push({ sourceId, sourceName: source.name, status: 'error', error: 'source is not enabled' });
      continue;
    }
    if (!source.base_url) {
      results.push({ sourceId, sourceName: source.name, status: 'error', error: 'no base URL configured' });
      continue;
    }

    // Erowid — auto-discover individual experience reports and fetch each one
    if (isErowidSource(source)) {
      const erowidDisc = await discoverErowidExperienceLinks(source);
      if ('error' in erowidDisc) {
        results.push({ sourceId, sourceName: source.name, status: 'error', error: erowidDisc.error });
        continue;
      }
      let erowidFetched = 0;
      for (const link of erowidDisc.links.slice(0, 10)) {
        const fr = await fetchErowidExperiencePreview(source, link.url);
        if ('error' in fr) continue;
        const dupes = await checkSignalDuplicates(fr.candidate.sourceUrl, fr.candidate.title);
        if (dupes.length > 0) {
          results.push({ sourceId, sourceName: source.name, status: 'duplicate', candidate: fr.candidate, duplicates: dupes.map((d) => ({ id: d.id, title: d.title, sourceUrl: d.source_url, status: d.status })) });
        } else {
          results.push({ sourceId, sourceName: source.name, status: 'preview', candidate: fr.candidate });
        }
        erowidFetched++;
      }
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
      const waybackDisc = await discoverWaybackLinks(source);
      if ('error' in waybackDisc) {
        results.push({ sourceId, sourceName: source.name, status: 'error', error: waybackDisc.error });
        continue;
      }
      let waybackFetched = 0;
      for (const link of waybackDisc.links.slice(0, 10)) {
        const fr = await fetchWaybackPagePreview(source, link.url);
        if ('error' in fr) continue;
        const dupes = await checkSignalDuplicates(fr.candidate.sourceUrl, fr.candidate.title);
        if (dupes.length > 0) {
          results.push({ sourceId, sourceName: source.name, status: 'duplicate', candidate: fr.candidate, duplicates: dupes.map((d) => ({ id: d.id, title: d.title, sourceUrl: d.source_url, status: d.status })) });
        } else {
          results.push({ sourceId, sourceName: source.name, status: 'preview', candidate: fr.candidate });
        }
        waybackFetched++;
      }
      if (waybackFetched === 0) {
        results.push({ sourceId, sourceName: source.name, status: 'error', error: 'No usable Wayback snapshots found for this source URL — check the CDX API or configure a more specific domain.' });
      }
      continue;
    }

    // Route to multi-candidate API connectors — avoids HTML fetches that get blocked or return garbage
    if (source.source_type === 'reddit' || REDDIT_HOST.test(new URL(source.base_url).hostname)) {
      const multiResult = await fetchRedditMultipleCandidates(source);
      if ('error' in multiResult) {
        results.push({ sourceId, sourceName: source.name, status: 'error', error: multiResult.error });
      } else {
        for (const candidate of multiResult.candidates) {
          const dupes = await checkSignalDuplicates(candidate.sourceUrl, candidate.title);
          if (dupes.length > 0) {
            results.push({ sourceId, sourceName: source.name, status: 'duplicate', candidate, duplicates: dupes.map((d) => ({ id: d.id, title: d.title, sourceUrl: d.source_url, status: d.status })) });
          } else {
            results.push({ sourceId, sourceName: source.name, status: 'preview', candidate });
          }
        }
      }
      continue;
    }

    if (source.source_type === 'mediawiki' || isMediaWikiHost(source.base_url)) {
      const multiResult = await fetchMediaWikiMultipleCandidates(source);
      if ('error' in multiResult) {
        results.push({ sourceId, sourceName: source.name, status: 'error', error: multiResult.error });
      } else {
        for (const candidate of multiResult.candidates) {
          const dupes = await checkSignalDuplicates(candidate.sourceUrl, candidate.title);
          if (dupes.length > 0) {
            results.push({ sourceId, sourceName: source.name, status: 'duplicate', candidate, duplicates: dupes.map((d) => ({ id: d.id, title: d.title, sourceUrl: d.source_url, status: d.status })) });
          } else {
            results.push({ sourceId, sourceName: source.name, status: 'preview', candidate });
          }
        }
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

    for (const { href, text } of pageAnchors) {
      if (storyLinks.length >= 8) break;
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
      };

      const fallbackDupes = await checkSignalDuplicates(fallbackCand.sourceUrl, fallbackCand.title);
      if (fallbackDupes.length > 0) {
        results.push({ sourceId, sourceName: source.name, status: 'duplicate', candidate: fallbackCand, duplicates: fallbackDupes.map((d) => ({ id: d.id, title: d.title, sourceUrl: d.source_url, status: d.status })) });
      } else {
        results.push({ sourceId, sourceName: source.name, status: 'preview', candidate: fallbackCand });
      }
    } else {
      // Fetch each story-quality link individually and build candidates
      for (const linkUrl of storyLinks) {
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
        };

        const linkDupes = await checkSignalDuplicates(linkCand.sourceUrl, linkCand.title);
        if (linkDupes.length > 0) {
          results.push({ sourceId, sourceName: source.name, status: 'duplicate', candidate: linkCand, duplicates: linkDupes.map((d) => ({ id: d.id, title: d.title, sourceUrl: d.source_url, status: d.status })) });
        } else {
          results.push({ sourceId, sourceName: source.name, status: 'preview', candidate: linkCand });
        }
      }
    }
  }

  return { results };
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
// Wayback CDX connector — discover snapshots of a domain registered as a source
// ---------------------------------------------------------------------------

async function discoverWaybackLinks(
  source: DbScannerSource,
): Promise<{ links: DiscoveredLink[] } | { error: string }> {
  const result = await searchWaybackSnapshots(source.base_url!, DISCOVERY_MAX_LINKS);
  if ('error' in result) return result;

  const links: DiscoveredLink[] = result.snapshots.map((snap) => ({
    url:         snap.waybackUrl,
    linkText:    snap.url.split('/').pop() || snap.url,
    matchReason: `Wayback snapshot · captured ${waybackTimestampToIso(snap.timestamp).slice(0, 10)}`,
  }));

  return { links };
}

// Wayback connector — fetch a single archived page and produce a candidate.
async function fetchWaybackPagePreview(
  source: DbScannerSource,
  url:    string,
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

  const extracted  = extractPageData(html, url);
  const title      = cleanTitle(extracted.title) || source.name;
  const summary    = buildSummary(extracted.description, extracted.snippet);
  const conf       = scoreExtractionConfidence(title, summary);
  const quality    = candidatePassesQuality(url, title, summary);
  const badCheck   = detectBadCandidate(url, title, summary);

  if (!quality.pass) {
    return { error: `Quality filter: ${quality.reason}` };
  }

  // Extract the original domain from the Wayback URL
  // Format: https://web.archive.org/web/20231201120000/https://example.com/page
  let originalDomain: string | undefined;
  const origUrlMatch = url.match(/\/web\/\d{14}\/(https?:\/\/[^/\s]+)/);
  try { if (origUrlMatch) originalDomain = new URL(origUrlMatch[1]).hostname; } catch { /* ignore */ }

  const heuristics = scoreStoryHeuristics(`${title} ${summary}`);
  const waybackScore = Math.min(heuristics.storyScore + 5, 100); // archived = bonus

  const candidate: FetchedCandidate = {
    title:                title.slice(0, 200),
    summary:              summary.slice(0, 2000),
    sourceUrl:            extracted.canonicalUrl || url,
    category:             source.category_focus[0] ?? 'Internet Lore',
    tags:                 ['scanner-source', 'wayback', 'archived', 'discovered-link'],
    anomalyScore:         5,
    categoryNote:         buildCategoryNote(source.category_focus, extracted.title, extracted.description),
    extractionConfidence: conf.confidence,
    extractionWarning:    conf.warning ?? undefined,
    sourceType:           'wayback',
    isArchived:           true,
    archivedAt:           archivedAt,
    passReason:           quality.reason,
    badCandidateReason:   badCheck.bad ? badCheck.reason : undefined,
    sourceImageUrl:       extracted.imageUrl || undefined,
    mediaType:            extracted.imageUrl ? 'image' : 'webpage',
    attributionText:      `Archived via Wayback Machine · ${source.name}`,
    captureNotes:         `Wayback snapshot${archivedAt ? ` from ${archivedAt.slice(0, 10)}` : ''}. Original page may no longer be accessible. Raw HTML not stored.`,
    originalDomain,
    storyScore:           waybackScore,
    storySignals:         heuristics.storySignals.length > 0 ? heuristics.storySignals : undefined,
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
  };

  return { candidate };
}

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
