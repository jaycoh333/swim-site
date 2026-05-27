/**
 * Public discovery API helpers — no auth required.
 *
 * Three integrations:
 *   1. Wayback CDX API  — query Internet Archive snapshots of a domain/URL
 *   2. MediaWiki API    — search + fetch articles from any MediaWiki installation
 *
 * Rate limits:
 *   Wayback CDX: ~15 req/min recommended; no hard limit documented.
 *   MediaWiki:   varies by instance; most allow anonymous queries freely.
 *
 * All fetch calls use AbortSignal.timeout(12_000) and a curator-identified UA.
 */

const UA = 'SWIM-Archive-Scout/1.0 (human-curator-supervised; research archive)';

// ---------------------------------------------------------------------------
// Wayback CDX API
// ---------------------------------------------------------------------------

export interface WaybackSnapshot {
  url:           string; // the original captured URL
  timestamp:     string; // YYYYMMDDHHmmss
  waybackUrl:    string; // https://web.archive.org/web/{timestamp}/{url}
  mimeType:      string;
  statusCode:    string;
  digest:        string;
}

/**
 * Query Wayback CDX for snapshots of a domain/URL.
 *
 * @param domainOrUrl  A domain ("archive.org") or full URL to search for.
 *                     Passing a bare domain adds a wildcard prefix so all
 *                     subpages are included.
 * @param limit        Max snapshots to return (default 20, max 50).
 * @param fromYear     Optional: only return captures from this year onwards (e.g. 1997).
 * @param toYear       Optional: only return captures up to and including this year (e.g. 2012).
 */
export async function searchWaybackSnapshots(
  domainOrUrl: string,
  limit = 20,
  fromYear?: number,
  toYear?: number,
  offset?: number,
): Promise<{ snapshots: WaybackSnapshot[] } | { error: string }> {
  const cap = Math.min(limit, 100);

  // Decide whether to use wildcard (bare domain) or exact URL
  let target: string;
  try {
    const parsed = new URL(domainOrUrl);
    // Supplied a full URL — search for snapshots of that exact URL
    target = parsed.href;
  } catch {
    // Bare domain supplied — wildcard all paths
    target = `${domainOrUrl.replace(/^https?:\/\//, '')}/*`;
  }

  const cdxUrl = new URL('https://web.archive.org/cdx/search/cdx');
  cdxUrl.searchParams.set('url',       target);
  cdxUrl.searchParams.set('output',    'json');
  cdxUrl.searchParams.set('limit',     String(cap));
  cdxUrl.searchParams.set('fl',        'original,timestamp,mimetype,statuscode,digest');
  cdxUrl.searchParams.set('filter',    'mimetype:text/html');
  cdxUrl.searchParams.set('filter',    'statuscode:200');
  cdxUrl.searchParams.set('collapse',  'urlkey');       // deduplicate by URL
  cdxUrl.searchParams.set('fastLatest','true');          // one snapshot per URL
  if (fromYear) cdxUrl.searchParams.set('from', `${fromYear}0101000000`);
  if (toYear)   cdxUrl.searchParams.set('to',   `${toYear}1231235959`);
  if (offset && offset > 0) cdxUrl.searchParams.set('offset', String(offset));

  let raw: unknown;
  try {
    const res = await fetch(cdxUrl.toString(), {
      cache:   'no-store',
      headers: { 'User-Agent': UA, 'Accept': 'application/json' },
      signal:  AbortSignal.timeout(12_000),
    });
    if (!res.ok) return { error: `Wayback CDX HTTP ${res.status}` };
    raw = await res.json();
  } catch (err) {
    return { error: `Wayback CDX fetch — ${err instanceof Error ? err.message : String(err)}` };
  }

  // CDX returns [[header], [row], [row], ...] — first row is column headers
  if (!Array.isArray(raw) || raw.length < 2) return { snapshots: [] };
  const rows = (raw as string[][]).slice(1);

  const snapshots: WaybackSnapshot[] = rows
    .filter((r) => Array.isArray(r) && r.length >= 5)
    .map((r) => {
      const [url, timestamp, mimeType, statusCode, digest] = r;
      return {
        url,
        timestamp,
        waybackUrl: `https://web.archive.org/web/${timestamp}/${url}`,
        mimeType:   mimeType ?? 'text/html',
        statusCode: statusCode ?? '200',
        digest:     digest ?? '',
      };
    });

  return { snapshots };
}

/** Format a Wayback timestamp (YYYYMMDDHHmmss) as a readable ISO date string. */
export function waybackTimestampToIso(ts: string): string {
  if (ts.length < 8) return ts;
  const y  = ts.slice(0, 4);
  const mo = ts.slice(4, 6);
  const d  = ts.slice(6, 8);
  const h  = ts.slice(8,  10) || '00';
  const mi = ts.slice(10, 12) || '00';
  return `${y}-${mo}-${d}T${h}:${mi}:00Z`;
}

// ---------------------------------------------------------------------------
// MediaWiki API
// ---------------------------------------------------------------------------

export interface MediaWikiSearchResult {
  pageId:  number;
  title:   string;
  snippet: string; // HTML snippet from MediaWiki — strip tags before display
  url:     string; // resolved article URL on the wiki
}

export interface MediaWikiArticle {
  pageId:   number;
  title:    string;
  extract:  string; // plain-text extract (first ~500 words)
  imageUrl: string | null;
  url:      string;
}

/**
 * Search a MediaWiki-based wiki for articles matching a keyword query.
 *
 * @param baseUrl  Wiki base URL, e.g. "https://lostmediawiki.com"
 * @param query    Search term(s)
 * @param limit    Max results (default 10, max 20)
 */
export async function searchMediaWikiArticles(
  baseUrl: string,
  query:   string,
  limit = 10,
): Promise<{ results: MediaWikiSearchResult[] } | { error: string }> {
  const cap = Math.min(limit, 20);
  const apiUrl = new URL(`${baseUrl.replace(/\/$/, '')}/api.php`);
  apiUrl.searchParams.set('action',    'query');
  apiUrl.searchParams.set('list',      'search');
  apiUrl.searchParams.set('srsearch',  query);
  apiUrl.searchParams.set('srlimit',   String(cap));
  apiUrl.searchParams.set('format',    'json');
  apiUrl.searchParams.set('origin',    '*');

  let raw: unknown;
  try {
    const res = await fetch(apiUrl.toString(), {
      cache:   'no-store',
      headers: { 'User-Agent': UA, 'Accept': 'application/json' },
      signal:  AbortSignal.timeout(12_000),
    });
    if (!res.ok) return { error: `MediaWiki search HTTP ${res.status}` };
    raw = await res.json();
  } catch (err) {
    return { error: `MediaWiki search — ${err instanceof Error ? err.message : String(err)}` };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const hits = (raw as any)?.query?.search ?? [];
  if (!Array.isArray(hits)) return { results: [] };

  const results: MediaWikiSearchResult[] = hits.map((h: {
    pageid: number;
    title:  string;
    snippet: string;
  }) => ({
    pageId:  h.pageid,
    title:   h.title ?? '',
    snippet: (h.snippet ?? '').replace(/<[^>]{0,200}>/g, '').replace(/\s{2,}/g, ' ').trim(),
    url:     `${baseUrl.replace(/\/$/, '')}/wiki/${encodeURIComponent((h.title ?? '').replace(/ /g, '_'))}`,
  }));

  return { results };
}

/**
 * Fetch the full extract + thumbnail for a single MediaWiki article.
 *
 * @param baseUrl  Wiki base URL
 * @param title    Exact article title (as returned by searchMediaWikiArticles)
 */
export async function fetchMediaWikiArticle(
  baseUrl: string,
  title:   string,
): Promise<{ article: MediaWikiArticle } | { error: string }> {
  const apiUrl = new URL(`${baseUrl.replace(/\/$/, '')}/api.php`);
  apiUrl.searchParams.set('action',    'query');
  apiUrl.searchParams.set('prop',      'extracts|pageimages');
  apiUrl.searchParams.set('titles',    title);
  apiUrl.searchParams.set('exintro',   '1');          // intro section only
  apiUrl.searchParams.set('explaintext','1');          // plain text, no HTML
  apiUrl.searchParams.set('exlimit',   '1');
  apiUrl.searchParams.set('pithumbsize','400');
  apiUrl.searchParams.set('format',    'json');
  apiUrl.searchParams.set('origin',    '*');

  let raw: unknown;
  try {
    const res = await fetch(apiUrl.toString(), {
      cache:   'no-store',
      headers: { 'User-Agent': UA, 'Accept': 'application/json' },
      signal:  AbortSignal.timeout(12_000),
    });
    if (!res.ok) return { error: `MediaWiki article HTTP ${res.status}` };
    raw = await res.json();
  } catch (err) {
    return { error: `MediaWiki article — ${err instanceof Error ? err.message : String(err)}` };
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pages = (raw as any)?.query?.pages ?? {};
  const page  = Object.values(pages)[0] as {
    pageid:  number;
    title:   string;
    extract: string;
    thumbnail?: { source: string };
  } | undefined;

  if (!page || page.pageid === -1) return { error: `article not found: ${title}` };

  const article: MediaWikiArticle = {
    pageId:   page.pageid,
    title:    page.title ?? title,
    extract:  (page.extract ?? '').slice(0, 3000),
    imageUrl: page.thumbnail?.source ?? null,
    url:      `${baseUrl.replace(/\/$/, '')}/wiki/${encodeURIComponent((page.title ?? title).replace(/ /g, '_'))}`,
  };

  return { article };
}
