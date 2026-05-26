/**
 * Pure utility functions for scanner source display logic.
 * Safe to import in both server and client components.
 */

/** Per-source-type guidance shown in the Scan column to help curators use sources correctly. */
export function getSourceRecommendation(source: { source_type: string; base_url: string | null }): string | null {
  const url = source.base_url ?? '';
  const lc  = url.toLowerCase();

  // Detect root/homepage URLs — applies across all source types
  let isRootUrl = false;
  try {
    const { pathname } = new URL(url);
    isRootUrl = pathname === '/' || pathname === '';
  } catch { /* ignore */ }

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
      if (lc.includes('erowid.org')) {
        return 'Homepage only — Erowid Experience Vaults index page. Use Discover Links to find specific reports, or add a direct report URL (e.g. erowid.org/experiences/exp.php?ID=12345).';
      }
      // Catch misconfigured sources — if URL looks like a wiki or Reddit, tell the curator to fix the type
      if (lc.includes('lostmediawiki') || lc.includes('wiki.') || lc.includes('/wiki')) {
        return 'This looks like a MediaWiki site — change source type to "MediaWiki" for API discovery instead of homepage fetch.';
      }
      if (lc.includes('reddit.com')) {
        return 'This looks like a Reddit URL — change source type to "Reddit" to use the JSON API instead of HTML fetch.';
      }
      if (isRootUrl) {
        return 'Root URL — Fetch Preview will return the homepage, not a story. Use Discover Links or add a specific page URL.';
      }
      return null;
    }
    default:
      if (isRootUrl) {
        return 'Root URL — Fetch Preview will return the homepage, not a story. Use Discover Links or add a specific page URL.';
      }
      return null;
  }
}
