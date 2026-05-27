/**
 * Signal lineage engine — Phase Y: Internet Mythology Archaeology
 *
 * Detects repeated narratives, origin trails, and mirrored claims across
 * archived web sources.  All analysis is purely lexical and structural —
 * no AI, no hallucination, no truth claims.
 *
 * Content is treated as internet artifact and mythology signal only.
 */

import fs   from 'fs';
import path from 'path';
import type { FetchedCandidate, OriginTrailEntry } from './scanner-fetch-types';

// ---------------------------------------------------------------------------
// Task 7: Mythology entity vocabulary
//
// Recurring phrases in paranormal / conspiracy mythology.
// When two candidates share entity matches, their fingerprints are more
// similar — they're more likely to be variants of the same narrative.
// ---------------------------------------------------------------------------

export const MYTHOLOGY_ENTITIES: string[] = [
  // UFO / disclosure
  'black triangle', 'black helicopter', 'men in black', 'flying saucer',
  'ufo crash', 'crash retrieval', 'non-human intelligence', 'craft retrieval',
  'alien abduction', 'abduction experience', 'screen memory', 'missing memory',
  'implant', 'subcutaneous implant', 'tracking implant',
  'roswell', 'area 51', 'area-51', 's-4', 'dulce base', 'dulce',
  'majestic 12', 'majestic-12', 'mj-12', 'project aquarius',
  'project moon dust', 'project sign', 'project grudge', 'project bluebook',
  'bob lazar', 'phil schneider', 'william cooper', 'john lear', 'richard dolan',
  'bob dean', 'clifford stone', 'edgar mitchell', 'gordon cooper',
  'reverse engineering', 'antigravity', 'element 115', 'sport model',
  'disclosure', 'coverup', 'crash site', 'retrieval program',
  // Mind control / black projects
  'mk ultra', 'mkultra', 'mk-ultra', 'monarch', 'monarch programming',
  'project stargate', 'remote viewing', 'psychic warfare',
  'montauk project', 'montauk', 'camp hero', 'philadelphia experiment',
  'haarp', 'frequency weapon', 'scalar weapon', 'weather modification',
  'chemtrails', 'project bluebeam', 'blue beam', 'operation paperclip',
  'deep underground', 'dumb base', 'underground base', 'bases underground',
  'black budget', 'classified program', 'shadow government', 'deep state',
  // Ancient / occult
  'annunaki', 'anunnaki', 'nephilim', 'atlantis', 'lemuria', 'mu continent',
  'hollow earth', 'inner earth', 'agartha', 'shambhala',
  'ancient astronauts', 'ancient aliens', 'advanced civilization',
  'nazca lines', 'ancient pyramid', 'lost continent', 'giant skeletons',
  'vril', 'vril society', 'thule society', 'black sun',
  'reptilian', 'reptilian agenda', 'bloodline', 'hybrid program',
  'starseed', 'pleiadian', 'nordic alien', 'gray alien', 'grays',
  'orion group', 'sirius', 'dog star', 'secret society', 'illuminati',
  // Paranormal / high strangeness
  'shadow people', 'hat man', 'old hag', 'sleep paralysis entity',
  'skinwalker', 'skinwalker ranch', 'dogman', 'cryptid',
  'missing time', 'time slip', 'timeline split', 'mandela effect',
  'cattle mutilation', 'animal mutilation', 'mute',
  'crop circle', 'crop formation', 'agroglyph',
  'the hum', 'taos hum', 'humming signal', 'mystery signal', 'strange signal',
  'missing 411', 'vanished without trace', 'disappeared without trace',
  // Technology / suppressed science
  'free energy', 'nikola tesla', 'tesla coil', 'suppressed energy',
  'zero point', 'cold fusion', 'overunity',
  'cern portal', 'cern experiment', 'time travel', 'teleportation',
  // Internet archaeology
  'geocities archive', 'bbs post', 'usenet post', 'alt.ufo',
  'abovetopsecret', 'godlike productions', 'project camelot',
];

// ---------------------------------------------------------------------------
// Stop words for keyword extraction
// ---------------------------------------------------------------------------

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
  'should', 'my', 'i', 'me', 'we', 'you', 'he', 'she', 'it', 'they',
  'this', 'that', 'these', 'those', 'not', 'no', 'so', 'if', 'as',
  'up', 'out', 'into', 'about', 'over', 'when', 'then', 'there', 'here',
  'just', 'more', 'also', 'its', 'than', 'some', 'all', 'can', 'any',
  'new', 'old', 'one', 'two', 'three', 'post', 'thread', 'link', 'page',
  'http', 'https', 'www', 'com', 'net', 'org', 'site', 'web',
  'what', 'who', 'how', 'why', 'where', 'which', 'was', 'were',
  'very', 'really', 'never', 'ever', 'only', 'after', 'before',
]);

// ---------------------------------------------------------------------------
// Task 1: Signal fingerprinting
// ---------------------------------------------------------------------------

/**
 * Generate a lightweight content fingerprint for a candidate.
 *
 * Combines mythology entity matches (high weight), significant title keywords,
 * topic group, and story signals into a stable string.
 *
 * Two candidates with Jaccard similarity ≥ 0.30 are considered related signals.
 */
export function generateSignalFingerprint(candidate: FetchedCandidate): string {
  const titleLc = candidate.title.toLowerCase();
  const textLc  = `${titleLc} ${(candidate.summary ?? '').toLowerCase()} ${(candidate.categoryNote ?? '').toLowerCase()}`;

  // 1. Mythology entity matches — highest-signal lineage components
  const entityMatches = MYTHOLOGY_ENTITIES.filter((e) => textLc.includes(e));

  // 2. Significant keywords from title only (most reliable, least noisy)
  const titleWords = titleLc
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !STOP_WORDS.has(w));
  const keywordsSet = [...new Set(titleWords)].sort();

  // 3. Named entity hints — capitalized sequences from the raw title
  //    e.g. "Operation Paperclip" → "operation paperclip"
  const namedEntities: string[] = [];
  const namedRe = /\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)+)\b/g;
  let nm: RegExpExecArray | null;
  while ((nm = namedRe.exec(candidate.title)) !== null) {
    const lc = nm[1].toLowerCase();
    if (!STOP_WORDS.has(lc) && lc.length > 4) namedEntities.push(lc);
  }

  // Compose
  const entityPart  = entityMatches.slice(0, 6).join('|');
  const namedPart   = namedEntities.slice(0, 4).join('|');
  const keywordPart = keywordsSet.slice(0, 8).join('|');
  const topicPart   = candidate.topicGroup ? `tg:${candidate.topicGroup}` : '';
  const signalPart  = (candidate.storySignals ?? []).sort().join(',');

  const parts = [entityPart, namedPart, keywordPart, topicPart, signalPart].filter(Boolean);
  return parts.join('::') || 'generic';
}

/**
 * Jaccard similarity between two fingerprints, 0.0–1.0.
 * Entity tokens counted at double weight — they're stronger lineage evidence.
 */
export function fingerprintSimilarity(fp1: string, fp2: string): number {
  if (!fp1 || !fp2 || fp1 === 'generic' || fp2 === 'generic') return 0;
  if (fp1 === fp2) return 1.0;

  // Split entity segment (before first '::') separately for double-weighting
  const segs1 = fp1.split('::');
  const segs2 = fp2.split('::');

  const entitySet1 = new Set<string>(segs1[0]?.split('|').filter(Boolean) ?? []);
  const entitySet2 = new Set<string>(segs2[0]?.split('|').filter(Boolean) ?? []);
  const restSet1   = new Set<string>(segs1.slice(1).join('|').split(/[|:,]+/).filter(Boolean));
  const restSet2   = new Set<string>(segs2.slice(1).join('|').split(/[|:,]+/).filter(Boolean));

  let entityInter = 0;
  for (const e of entitySet1) if (entitySet2.has(e)) entityInter++;
  const entityUnion = new Set([...entitySet1, ...entitySet2]).size;

  let restInter = 0;
  for (const k of restSet1) if (restSet2.has(k)) restInter++;
  const restUnion = new Set([...restSet1, ...restSet2]).size;

  const totalInter = entityInter * 2 + restInter;
  const totalUnion = entityUnion * 2 + restUnion;

  return totalUnion > 0 ? totalInter / totalUnion : 0;
}

// ---------------------------------------------------------------------------
// Task 4: Lineage memory cache
// ---------------------------------------------------------------------------

export interface LineageEntry {
  fingerprint:  string;
  title:        string;
  topicGroup?:  string;
  earliestYear: number | null;
  earliestUrl:  string;
  sourceUrls:   string[];
  sourceTypes:  string[];
  lastSeen:     string; // YYYY-MM-DD
  seenCount:    number;
}

interface LineageCache {
  entries:  Record<string, LineageEntry>;
  savedAt:  number;
}

const LINEAGE_PATH = path.join(process.cwd(), 'data', 'signal-lineage.json');
let _lineageCache: LineageCache | null = null;

export function loadLineageCache(): LineageCache {
  if (_lineageCache) return _lineageCache;
  try {
    _lineageCache = JSON.parse(fs.readFileSync(LINEAGE_PATH, 'utf-8')) as LineageCache;
  } catch {
    _lineageCache = { entries: {}, savedAt: 0 };
  }
  return _lineageCache;
}

function persistLineageCache(cache: LineageCache): void {
  cache.savedAt = Date.now();
  _lineageCache = cache;
  try {
    fs.mkdirSync(path.dirname(LINEAGE_PATH), { recursive: true });
    fs.writeFileSync(LINEAGE_PATH, JSON.stringify(cache, null, 2), 'utf-8');
  } catch {
    // Read-only FS (Vercel) — in-process only
  }
}

/**
 * Upsert a candidate's fingerprint into the lineage cache.
 * Updates earliest year if this candidate is older than what we've seen before.
 */
export function recordCandidateLineage(candidate: FetchedCandidate): void {
  const fp = candidate.signalFingerprint;
  if (!fp || fp === 'generic') return;

  const cache      = loadLineageCache();
  const url        = candidate.sourceUrl;
  const sourceType = candidate.sourceType ?? 'unknown';
  const year       = candidate.firstSeenYear ?? candidate.archiveYear ?? null;
  const today      = new Date().toISOString().slice(0, 10);

  let domain = '';
  try { domain = new URL(url).hostname; } catch { domain = url.slice(0, 40); }

  const existing = cache.entries[fp];
  if (!existing) {
    cache.entries[fp] = {
      fingerprint:  fp,
      title:        candidate.title.slice(0, 100),
      topicGroup:   candidate.topicGroup,
      earliestYear: year,
      earliestUrl:  url,
      sourceUrls:   [url],
      sourceTypes:  [sourceType],
      lastSeen:     today,
      seenCount:    1,
    };
  } else {
    if (year != null && (existing.earliestYear == null || year < existing.earliestYear)) {
      existing.earliestYear = year;
      existing.earliestUrl  = url;
    }
    if (!existing.sourceUrls.includes(url)) {
      existing.sourceUrls.push(url);
      if (existing.sourceUrls.length > 20) existing.sourceUrls = existing.sourceUrls.slice(-20);
    }
    if (!existing.sourceTypes.includes(sourceType)) existing.sourceTypes.push(sourceType);
    existing.lastSeen = today;
    existing.seenCount++;
  }

  void domain; // referenced for closure completeness
  persistLineageCache(cache);
}

// ---------------------------------------------------------------------------
// Task 2: Origin detection — annotate candidates with lineage relationships
// ---------------------------------------------------------------------------

export interface LineageAnnotation {
  candidateUrl:       string;
  fingerprint:        string;
  originStatus:       FetchedCandidate['originStatus'];
  originTrail:        OriginTrailEntry[];
  lineageConfidence:  number;
  relatedSignalCount: number;
}

/**
 * Detect lineage relationships across a set of candidates from a single session.
 *
 * Groups candidates by fingerprint similarity (≥ 0.30), then:
 *   - earliest archived instance → 'possible-origin'
 *   - later instances of same narrative → 'related-signal'
 *   - same narrative, same source type, different domain → 'mirror'
 *   - candidate older than known duplicate in DB → 'earlier-variant'
 *
 * Also builds origin trails from the lineage cache (cross-session history).
 */
export function detectLineageRelationships(
  candidates: FetchedCandidate[],
): LineageAnnotation[] {
  const cache   = loadLineageCache();
  const results: LineageAnnotation[] = [];

  // Group candidates by fingerprint similarity
  const visited = new Set<string>();
  const groups: FetchedCandidate[][] = [];

  for (const c of candidates) {
    if (visited.has(c.sourceUrl)) continue;
    const group = [c];
    visited.add(c.sourceUrl);
    for (const other of candidates) {
      if (visited.has(other.sourceUrl)) continue;
      const sim = fingerprintSimilarity(c.signalFingerprint ?? '', other.signalFingerprint ?? '');
      if (sim >= 0.30) {
        group.push(other);
        visited.add(other.sourceUrl);
      }
    }
    groups.push(group);
  }

  for (const group of groups) {
    // Find historical match in lineage cache
    const repFp      = group[0].signalFingerprint ?? '';
    const cacheMatch = repFp
      ? Object.values(cache.entries).find((e) => fingerprintSimilarity(e.fingerprint, repFp) >= 0.30)
      : undefined;

    if (group.length === 1) {
      const c = group[0];
      const trail = cacheMatch ? buildCacheTrail(cacheMatch, c) : [];
      results.push({
        candidateUrl:       c.sourceUrl,
        fingerprint:        c.signalFingerprint ?? '',
        originStatus:       cacheMatch ? 'related-signal' : undefined,
        originTrail:        trail,
        lineageConfidence:  cacheMatch ? 0.35 : 0,
        relatedSignalCount: cacheMatch ? Math.max(0, cacheMatch.seenCount - 1) : 0,
      });
      continue;
    }

    // Sort by earliest archived year ascending
    const sorted = [...group].sort((a, b) => {
      const ya = a.firstSeenYear ?? a.archiveYear ?? 9999;
      const yb = b.firstSeenYear ?? b.archiveYear ?? 9999;
      return ya - yb;
    });

    const earliest     = sorted[0];
    const earliestYear = earliest.firstSeenYear ?? earliest.archiveYear ?? null;
    const sourceTypes  = new Set(group.map((c) => c.sourceType ?? 'unknown'));

    for (const c of group) {
      const isEarliest   = c.sourceUrl === earliest.sourceUrl;
      const candidateYear = c.firstSeenYear ?? c.archiveYear ?? null;

      let originStatus: FetchedCandidate['originStatus'] = undefined;
      if (isEarliest && earliestYear != null && earliestYear < 2015) {
        originStatus = 'possible-origin';
      } else if (!isEarliest && sourceTypes.size > 1 && c.sourceType === earliest.sourceType) {
        originStatus = 'mirror';
      } else if (!isEarliest) {
        originStatus = 'related-signal';
      }
      void candidateYear; // available for future use

      const trail      = buildGroupTrail(group, c, cacheMatch);
      const confidence = Math.min(0.3 + group.length * 0.15 + (cacheMatch ? 0.2 : 0), 0.9);

      results.push({
        candidateUrl:       c.sourceUrl,
        fingerprint:        c.signalFingerprint ?? '',
        originStatus,
        originTrail:        trail,
        lineageConfidence:  confidence,
        relatedSignalCount: (group.length - 1) + (cacheMatch ? Math.max(0, cacheMatch.seenCount - 1) : 0),
      });
    }
  }

  return results;
}

// Build trail from the lineage cache entry + a single current candidate
function buildCacheTrail(entry: LineageEntry, current: FetchedCandidate): OriginTrailEntry[] {
  const trail: OriginTrailEntry[] = [];
  const seenUrls = new Set<string>();

  let domain = '';
  try { domain = new URL(entry.earliestUrl).hostname; } catch { domain = '?'; }
  trail.push({
    year:       entry.earliestYear,
    domain,
    sourceType: entry.sourceTypes[0] ?? 'archive',
    url:        entry.earliestUrl,
    label:      `${entry.earliestYear ?? '?'} — ${domain}`,
  });
  seenUrls.add(entry.earliestUrl);

  // Current candidate as terminal entry
  let curDomain = '';
  try { curDomain = new URL(current.sourceUrl).hostname; } catch { curDomain = '?'; }
  const curYear = current.firstSeenYear ?? current.archiveYear ?? null;
  if (!seenUrls.has(current.sourceUrl)) {
    trail.push({
      year:             curYear,
      domain:           curDomain,
      sourceType:       current.sourceType ?? 'unknown',
      url:              current.sourceUrl,
      label:            `${curYear ?? '?'} — ${curDomain}`,
      isCurrentSession: true,
    });
  }

  return trail.sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999));
}

// Build trail from all group members + optional cache entry
function buildGroupTrail(
  group:     FetchedCandidate[],
  current:   FetchedCandidate,
  cacheEntry?: LineageEntry,
): OriginTrailEntry[] {
  const entries: OriginTrailEntry[] = [];
  const seenUrls = new Set<string>();

  // Historical cache appearances first (previous sessions)
  if (cacheEntry && !seenUrls.has(cacheEntry.earliestUrl)) {
    let domain = '';
    try { domain = new URL(cacheEntry.earliestUrl).hostname; } catch { domain = '?'; }
    entries.push({
      year:       cacheEntry.earliestYear,
      domain,
      sourceType: cacheEntry.sourceTypes[0] ?? 'archive',
      url:        cacheEntry.earliestUrl,
      label:      `${cacheEntry.earliestYear ?? '?'} — ${domain}`,
    });
    seenUrls.add(cacheEntry.earliestUrl);
  }

  // Current session group members
  for (const c of group) {
    if (seenUrls.has(c.sourceUrl)) continue;
    seenUrls.add(c.sourceUrl);
    let domain = '';
    try { domain = new URL(c.sourceUrl).hostname; } catch { domain = c.sourceUrl.slice(0, 30); }
    const year = c.firstSeenYear ?? c.archiveYear ?? null;
    entries.push({
      year,
      domain,
      sourceType:       c.sourceType ?? 'unknown',
      url:              c.sourceUrl,
      label:            `${year ?? '?'} — ${domain}`,
      isCurrentSession: true,
    });
  }

  return entries
    .sort((a, b) => (a.year ?? 9999) - (b.year ?? 9999))
    .slice(0, 8);
}
