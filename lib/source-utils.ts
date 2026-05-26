/**
 * Pure utility functions for scanner source display logic.
 * Safe to import in both server and client components.
 */

/** Per-source-type guidance shown in the Scan column to help curators use sources correctly. */
export function getSourceRecommendation(source: { source_type: string; base_url: string | null }): string | null {
  const url = source.base_url ?? '';
  const lc  = url.toLowerCase();

  switch (source.source_type) {
    case 'wayback': {
      try {
        const p = new URL(url);
        if (
          p.hostname === 'web.archive.org' &&
          (p.pathname === '/' || p.pathname === '' || p.pathname === '/web/')
        ) {
          return 'Use a specific archived URL, not the Wayback homepage. Example: web.archive.org/web/*/paranormal-forum.com/thread123';
        }
      } catch { /* ignore */ }
      return 'Wayback: use Discover Links to find archived pages — Fetch Preview fetches the snapshot URL directly.';
    }
    case 'reddit':
      return 'Reddit: Fetch Preview picks one post via JSON API. Use Discover Links to browse multiple story posts.';
    case 'mediawiki':
      return 'MediaWiki: use API discovery, not homepage fetch. Fetch Preview picks one article; Discover Links returns many.';
    case 'archive':
    case 'other': {
      // Catch misconfigured sources — if URL looks like a wiki or Reddit, tell the curator to fix the type
      if (lc.includes('lostmediawiki') || lc.includes('wiki.') || lc.includes('/wiki')) {
        return 'This looks like a MediaWiki site — change source type to "MediaWiki" for API discovery instead of homepage fetch.';
      }
      if (lc.includes('reddit.com')) {
        return 'This looks like a Reddit URL — change source type to "Reddit" to use the JSON API instead of HTML fetch.';
      }
      return null;
    }
    default:
      return null;
  }
}
