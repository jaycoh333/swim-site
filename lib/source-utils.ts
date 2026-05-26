/**
 * Pure utility functions for scanner source display logic.
 * Safe to import in both server and client components.
 */

/** Per-source-type guidance shown in the Scan column to help curators use sources correctly. */
export function getSourceRecommendation(source: { source_type: string; base_url: string | null }): string | null {
  const url = source.base_url ?? '';
  switch (source.source_type) {
    case 'wayback': {
      try {
        const p = new URL(url);
        if (
          p.hostname === 'web.archive.org' &&
          (p.pathname === '/' || p.pathname === '' || p.pathname === '/web/')
        ) {
          return 'Use a specific archived forum/thread URL, not the Wayback homepage. Example: web.archive.org/web/*/paranormal-forum.com/thread123';
        }
      } catch { /* ignore */ }
      return 'Wayback sources work best with Discover Links — enter a target domain to find archived pages.';
    }
    case 'reddit':
      return 'Use subreddit URLs (reddit.com/r/paranormal) — the Reddit connector fetches real story posts automatically.';
    case 'mediawiki':
      return 'MediaWiki sources use the wiki search API for clean article discovery. Use Discover Links for best results.';
    default:
      return null;
  }
}
