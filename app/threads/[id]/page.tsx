import fs   from 'fs';
import path from 'path';
import { THREAD_SEED } from '@/lib/seed-data';
import { ThreadView } from '@/components/ThreadView';
import { getThread, getReplies, getRelatedThreads } from '@/lib/supabase/repository';
import { parseThreadMeta } from '@/lib/thread-meta';
import type { ThreadLineageData } from '@/lib/thread-meta';

/**
 * Force dynamic rendering so newly published threads are always fetched fresh
 * and a failed first render (e.g. Supabase not reachable) is never cached as
 * a static "not found" page.
 */
export const dynamic = 'force-dynamic';
export const dynamicParams = true;

export function generateStaticParams() {
  return THREAD_SEED.map((t) => ({ id: t.id }));
}

type Params = Promise<{ id: string }>;

// ---------------------------------------------------------------------------
// Phase Z — look up lineage data for this thread's source URL.
// Reads data/signal-lineage.json (written by the scanner; may not exist).
// Returns null when no lineage found or file is absent.
// ---------------------------------------------------------------------------

interface LineageEntry {
  fingerprint:  string;
  title:        string;
  topicGroup?:  string;
  earliestYear: number | null;
  earliestUrl:  string;
  sourceUrls:   string[];
  sourceTypes:  string[];
  lastSeen:     string;
  seenCount:    number;
}

function loadLineageForUrl(sourceUrl: string | null): ThreadLineageData | null {
  if (!sourceUrl) return null;
  try {
    const cachePath = path.join(process.cwd(), 'data', 'signal-lineage.json');
    const raw = fs.readFileSync(cachePath, 'utf-8');
    const cache = JSON.parse(raw) as { entries: Record<string, LineageEntry> };

    // Find entry whose sourceUrls contains this URL
    const entry = Object.values(cache.entries).find(
      (e) => e.sourceUrls.includes(sourceUrl),
    );
    if (!entry) return null;

    // Build chronological trail: all URLs mapped to domain + year heuristics
    // seenCount > 1 means it's appeared in multiple sessions
    const trail: ThreadLineageData['trail'] = [];
    const seenDomains = new Set<string>();

    // Earliest entry first
    if (entry.earliestUrl) {
      let domain = '?';
      try { domain = new URL(entry.earliestUrl).hostname; } catch { /* skip */ }
      if (!seenDomains.has(domain)) {
        seenDomains.add(domain);
        trail.push({
          year:       entry.earliestYear,
          domain,
          sourceType: entry.sourceTypes[0] ?? 'archive',
          label:      `${entry.earliestYear ?? '?'} — ${domain}`,
        });
      }
    }

    // Additional unique domains from sourceUrls
    for (const url of entry.sourceUrls.slice(0, 8)) {
      if (url === entry.earliestUrl) continue;
      let domain = '?';
      try { domain = new URL(url).hostname; } catch { /* skip */ }
      if (seenDomains.has(domain)) continue;
      seenDomains.add(domain);
      trail.push({
        year:       null,
        domain,
        sourceType: entry.sourceTypes[1] ?? 'unknown',
        label:      `? — ${domain}`,
      });
    }

    return {
      earliestYear: entry.earliestYear,
      earliestUrl:  entry.earliestUrl,
      seenCount:    entry.seenCount,
      trail:        trail.slice(0, 6),
    };
  } catch {
    return null; // file absent or unreadable — never block render
  }
}

export default async function ThreadPage({ params }: { params: Params }) {
  const { id } = await params;

  const thread = await getThread(id);
  const [replies, related] = await Promise.all([
    getReplies(id),
    getRelatedThreads(thread?.category ?? '', id, 5),
  ]);

  // Phase Z: resolve lineage data for this thread (no-op when cache absent)
  let lineage: ThreadLineageData | null = null;
  if (thread?.body) {
    const meta = parseThreadMeta(thread.body);
    lineage = loadLineageForUrl(meta.sourceUrl);
  }

  return (
    <ThreadView
      threadId={id}
      initialThread={thread}
      initialReplies={replies}
      relatedThreads={related}
      lineage={lineage ?? undefined}
    />
  );
}
