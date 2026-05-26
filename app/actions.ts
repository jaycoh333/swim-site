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
import type { FetchedCandidate, SignalDuplicate, SessionSourceResult } from '@/lib/scanner-fetch-types';

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

  // Step 3: strip remaining tags, collapse whitespace, take first 600 chars
  const snippet = workHtml
    .replace(/<[^>]{0,1000}>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 600);

  return { title, description, canonicalUrl, snippet };
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
  const extracted = extractPageData(html, source.base_url);
  const title     = cleanTitle(extracted.title) || source.name;
  const summary   = buildSummary(extracted.description, extracted.snippet);
  const conf      = scoreExtractionConfidence(title, summary);

  const candidate: FetchedCandidate = {
    title:                title.slice(0, 200),
    summary:              summary.slice(0, 2000),
    sourceUrl:            extracted.canonicalUrl || source.base_url,
    category:             source.category_focus[0] ?? 'Internet Lore',
    tags:                 ['scanner-source', source.source_type],
    anomalyScore:         5,
    categoryNote:         buildCategoryNote(source.category_focus, extracted.title, extracted.description),
    extractionConfidence: conf.confidence,
    extractionWarning:    conf.warning ?? undefined,
  };

  return { candidate };
}

// Phase 2 — duplicate check then insert. Curator has reviewed + edited the preview.
// Returns duplicateWarning if duplicates found (unless overrideDuplicate=true).
export async function queueFetchedCandidateAction(input: {
  sourceId:          string;
  title:             string;
  summary:           string;
  sourceUrl:         string;
  category:          string;
  tags:              string[];
  anomalyScore:      number;
  overrideDuplicate?: boolean;
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
    title:        input.title,
    summary:      input.summary,
    sourceName:   source.name,
    sourceUrl:    input.sourceUrl,
    sourceType:   toSignalSourceType(source.source_type),
    category:     input.category,
    anomalyScore: input.anomalyScore,
    tags:         input.tags,
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
    const extracted = extractPageData(html, source.base_url);
    const title     = cleanTitle(extracted.title) || source.name;
    const summary   = buildSummary(extracted.description, extracted.snippet);
    const conf      = scoreExtractionConfidence(title, summary);

    const candidate: FetchedCandidate = {
      title:                title.slice(0, 200),
      summary:              summary.slice(0, 2000),
      sourceUrl:            extracted.canonicalUrl || source.base_url,
      category:             source.category_focus[0] ?? 'Internet Lore',
      tags:                 ['scanner-source', source.source_type],
      anomalyScore:         5,
      categoryNote:         buildCategoryNote(source.category_focus, extracted.title, extracted.description),
      extractionConfidence: conf.confidence,
      extractionWarning:    conf.warning ?? undefined,
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
