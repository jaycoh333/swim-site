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
// STRICT LIMITS (see docs/manual-fetch-prototype.md):
//   - One URL fetched per call — base_url only, no link following
//   - Extracts title, meta description, canonical URL, ~400-char text snippet
//   - Raw HTML is NEVER stored — only extracted metadata goes to the DB
//   - Source must be explicitly enabled by a curator before fetch is allowed
//   - Creates a recovered_signals row with status='pending'
//   - Curator must approve before any content goes public
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
  // Limit processing to first 100KB — avoids large-page memory issues
  const h = html.slice(0, 100_000);

  // Title — prefer og:title, fallback to <title> tag
  const ogTitle   = h.match(/<meta[^>]{0,300}property=["']og:title["'][^>]{0,300}content=["']([^"']{1,300})["']/i)
                 ?? h.match(/<meta[^>]{0,300}content=["']([^"']{1,300})["'][^>]{0,300}property=["']og:title["']/i);
  const tagTitle  = h.match(/<title[^>]{0,50}>([^<]{1,300})<\/title>/i);
  const title     = decodeHtmlEntities(ogTitle?.[1] ?? tagTitle?.[1] ?? '');

  // Description — prefer og:description, fallback to meta[name=description]
  const ogDesc    = h.match(/<meta[^>]{0,300}property=["']og:description["'][^>]{0,300}content=["']([^"']{1,500})["']/i)
                 ?? h.match(/<meta[^>]{0,300}content=["']([^"']{1,500})["'][^>]{0,300}property=["']og:description["']/i);
  const metaDesc  = h.match(/<meta[^>]{0,300}name=["']description["'][^>]{0,300}content=["']([^"']{1,500})["']/i)
                 ?? h.match(/<meta[^>]{0,300}content=["']([^"']{1,500})["'][^>]{0,300}name=["']description["']/i);
  const description = decodeHtmlEntities(ogDesc?.[1] ?? metaDesc?.[1] ?? '');

  // Canonical URL
  const canonical = h.match(/<link[^>]{0,300}rel=["']canonical["'][^>]{0,300}href=["']([^"']{1,500})["']/i)
                 ?? h.match(/<link[^>]{0,300}href=["']([^"']{1,500})["'][^>]{0,300}rel=["']canonical["']/i);
  const canonicalUrl = canonical?.[1]?.trim() ?? fallbackUrl;

  // Readable text snippet — strip scripts/styles/comments/tags, collapse whitespace
  const snippet = h
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<[^>]{0,1000}>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 400);

  return { title, description, canonicalUrl, snippet };
}

function toSignalSourceType(
  scannerType: string,
): import('@/lib/supabase/types').SignalSourceType {
  const map: Record<string, import('@/lib/supabase/types').SignalSourceType> = {
    archive:    'wayback',
    forum:      'forum',
    reddit:     'reddit',
    imageboard: 'imageboard',
    bbs:        'other',
    pastebin:   'pastebin',
    irc:        'irc',
    other:      'other',
  };
  return map[scannerType] ?? 'other';
}

// Manual fetch prototype — single page, curator supervised.
// See docs/manual-fetch-prototype.md for protocol and limits.
export async function fetchScannerSourceAction(
  sourceId: string,
): Promise<{ signalId: string; title: string; url: string; scannedAt: string } | { error: string }> {
  // 1. Load source from registry
  const source = await getScannerSource(sourceId);
  if (!source)             return { error: 'source not found in registry' };
  if (!source.enabled)     return { error: 'source must be enabled before fetching — toggle in registry' };
  if (!source.base_url)    return { error: 'source has no base URL configured' };

  // 2. Fetch the page server-side (no CORS restriction at server)
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
      return { error: `HTTP ${response.status} — ${response.statusText}` };
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

  // 3. Extract metadata — raw HTML is discarded immediately after extraction
  const extracted = extractPageData(html, source.base_url);

  // 4. Build signal fields
  const signalTitle   = (extracted.title || source.name).slice(0, 200);
  const signalSummary = (
    extracted.description ||
    extracted.snippet ||
    `Manual scan of ${source.base_url}`
  ).slice(0, 2000);
  const signalUrl     = extracted.canonicalUrl || source.base_url;

  // 5. Create pending signal candidate — status='pending', curator must review
  const signalResult = await createRecoveredSignal({
    title:        signalTitle,
    summary:      signalSummary,
    sourceName:   source.name,
    sourceUrl:    signalUrl,
    sourceType:   toSignalSourceType(source.source_type),
    category:     source.category_focus[0] ?? 'Internet Lore',
    anomalyScore: 5,
    tags:         ['scanner-source', source.source_type],
  });

  if ('error' in signalResult) return { error: signalResult.error };

  // 6. Update last_scanned_at (non-fatal)
  const scannedAt = new Date().toISOString();
  await updateScannerSourceLastScanned(source.id);

  return { signalId: signalResult.id, title: signalTitle, url: signalUrl, scannedAt };
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
