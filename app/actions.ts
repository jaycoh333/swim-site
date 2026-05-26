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

// Phase 1 — fetch page and return candidate preview for curator review.
// No database writes. Curator must call queueFetchedCandidateAction to insert.
export async function fetchScannerSourcePreviewAction(
  sourceId: string,
): Promise<{ candidate: FetchedCandidate } | { error: string }> {
  const source = await getScannerSource(sourceId);
  if (!source)          return { error: 'source not found in registry' };
  if (!source.enabled)  return { error: 'source must be enabled before fetching' };
  if (!source.base_url) return { error: 'source has no base URL configured' };

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

  // Extract metadata — raw HTML discarded after this point
  const extracted  = extractPageData(html, source.base_url);
  const title      = cleanTitle(extracted.title) || source.name;
  const summary    = buildSummary(extracted.description, extracted.snippet);
  const conf       = scoreExtractionConfidence(title, summary);
  const resolvedUrl = extracted.canonicalUrl || source.base_url;
  const urlPath    = (() => { try { return new URL(resolvedUrl).pathname; } catch { return '/'; } })();
  const isIndexPage = urlPath === '/' || urlPath === '' || isGenericTitle(title);

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
    sourceImageUrl:       extracted.imageUrl || undefined,
    mediaType:            extracted.imageUrl ? 'image' : 'webpage',
    attributionText:      `Recovered from ${source.name} · ${source.source_type} source`,
    captureNotes:         'Captured from source preview during manual scanner fetch. Raw HTML not stored.',
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

    let html: string;
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
        results.push({ sourceId, sourceName: source.name, status: 'error', error: `HTTP ${response.status} — ${response.statusText}` });
        continue;
      }
      const ct = response.headers.get('content-type') ?? '';
      if (!ct.includes('text/html') && !ct.includes('xhtml')) {
        results.push({ sourceId, sourceName: source.name, status: 'error', error: `non-HTML response: ${ct.split(';')[0].trim()}` });
        continue;
      }
      html = await response.text();
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      results.push({ sourceId, sourceName: source.name, status: 'error', error: `network — ${msg}` });
      continue;
    }

    // Extract metadata — raw HTML discarded after this point
    const extracted   = extractPageData(html, source.base_url);
    const title       = cleanTitle(extracted.title) || source.name;
    const summary     = buildSummary(extracted.description, extracted.snippet);
    const conf        = scoreExtractionConfidence(title, summary);
    const resolvedUrl = extracted.canonicalUrl || source.base_url;
    const urlPath     = (() => { try { return new URL(resolvedUrl).pathname; } catch { return '/'; } })();
    const isIndexPage = urlPath === '/' || urlPath === '' || isGenericTitle(title);

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
      sourceImageUrl:       extracted.imageUrl || undefined,
      mediaType:            extracted.imageUrl ? 'image' : 'webpage',
      attributionText:      `Recovered from ${source.name} · ${source.source_type} source`,
      captureNotes:         'Captured from source preview during manual scanner fetch. Raw HTML not stored.',
    };

    // Duplicate check — include in session results so curator sees it immediately
    const dupes = await checkSignalDuplicates(candidate.sourceUrl, candidate.title);
    if (dupes.length > 0) {
      results.push({
        sourceId,
        sourceName: source.name,
        status:     'duplicate',
        candidate,
        duplicates: dupes.map((d) => ({
          id:        d.id,
          title:     d.title,
          sourceUrl: d.source_url,
          status:    d.status,
        })),
      });
    } else {
      results.push({ sourceId, sourceName: source.name, status: 'preview', candidate });
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

  type RPost = { data: { title: string; permalink: string; selftext: string; score: number; num_comments: number; subreddit: string } };
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

    // Quality filters: score > 5, selftext > 100 chars if present
    if (p.score < 5) continue;
    const hasSelftext = p.selftext && p.selftext.trim().length > 0;
    if (hasSelftext && p.selftext.trim().length < 100) continue;

    const combined  = `${p.title} ${p.selftext}`.toLowerCase();
    const matched: string[] = [];
    for (const kw of DISCOVERY_KEYWORDS) {
      if (combined.includes(kw)) matched.push(kw);
      if (matched.length >= 3) break;
    }
    if (matched.length === 0) continue;

    // Clean up [FOUND], [UPDATE] etc. prefixes common on Reddit
    const cleanedTitle = p.title.replace(/^\s*\[[^\]]{1,30}\]\s*/g, '').trim() || p.title;

    links.push({
      url:         permalink,
      linkText:    cleanedTitle,
      matchReason: `r/${p.subreddit} · ${p.score}↑ · ${p.num_comments} comments · matched: ${matched.join(', ')}`,
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

  const title   = (p.title ?? 'Untitled Reddit Post').slice(0, 200);
  const summary = (p.selftext?.trim()
    ? p.selftext
    : `r/${p.subreddit} · ${p.score} points · ${p.num_comments} comments`
  ).slice(0, 2000);
  const rawImg  = p.preview?.images?.[0]?.source?.url;
  const imageUrl = rawImg ? rawImg.replace(/&amp;/g, '&') : undefined;
  const conf    = scoreExtractionConfidence(title, summary);
  const postedDate = new Date(p.created_utc * 1000).toISOString().slice(0, 10);

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

  if (!quality.pass) {
    return { error: `Quality filter: ${quality.reason}` };
  }

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
    sourceImageUrl:       extracted.imageUrl || undefined,
    mediaType:            extracted.imageUrl ? 'image' : 'webpage',
    attributionText:      `Archived via Wayback Machine · ${source.name}`,
    captureNotes:         `Wayback snapshot${archivedAt ? ` from ${archivedAt.slice(0, 10)}` : ''}. Original page may no longer be accessible. Raw HTML not stored.`,
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
  const title   = cleanTitle(article.title) || source.name;
  const summary = article.extract.trim() || 'No extract available — edit manually.';
  const conf    = scoreExtractionConfidence(title, summary);
  const quality = candidatePassesQuality(url, title, summary);

  if (!quality.pass) {
    return { error: `Quality filter: ${quality.reason}` };
  }

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
    sourceImageUrl:       article.imageUrl || undefined,
    mediaType:            article.imageUrl ? 'image' : 'webpage',
    attributionText:      `Recovered from ${source.name} · MediaWiki`,
    captureNotes:         `MediaWiki article: "${article.title}". Plain-text extract only — raw wiki markup not stored.`,
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

  // Wayback CDX connector — query Internet Archive snapshots
  if (source.source_type === 'wayback') {
    return discoverWaybackLinks(source);
  }

  // MediaWiki connector — search wiki articles via API
  if (source.source_type === 'mediawiki') {
    return discoverMediaWikiLinks(source);
  }

  // Reddit connector — use JSON API instead of HTML scraping
  if (source.source_type === 'reddit') {
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
  const isWaybackUrl = parsedUrl.hostname === 'web.archive.org';
  const isMediaWikiSource = source.source_type === 'mediawiki';

  if (!isArchiveType && !isMediaWikiSource && parsedUrl.hostname !== baseHostname && !REDDIT_HOST.test(parsedUrl.hostname)) {
    return { error: `cross-domain fetch blocked — ${parsedUrl.hostname} is not ${baseHostname}` };
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

  const extracted = extractPageData(html, url);
  const title     = cleanTitle(extracted.title) || source.name;
  const summary   = buildSummary(extracted.description, extracted.snippet);
  const conf      = scoreExtractionConfidence(title, summary);
  const quality   = candidatePassesQuality(url, title, summary);

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
