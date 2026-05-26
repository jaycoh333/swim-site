/**
 * Scan preset definitions.
 *
 * Each preset filters the curator's ENABLED sources by source_type (and
 * optionally by name keyword). No DB writes occur — sources are still
 * managed in /scanner/sources. The preset is a selection helper only.
 *
 * IMPORTANT: Presets do not auto-publish, crawl broadly, or bypass
 * curator review. They only choose which enabled sources to include
 * when the curator clicks RUN SCAN.
 */

export type ScanPresetRisk = 'low' | 'medium';

export interface ScanPreset {
  id:           string;
  name:         string;
  tagline:      string;
  description:  string;
  sourceTypes:  string[];       // match on DbScannerSource.source_type
  nameKeywords: string[];       // secondary match on source name (lowercase, OR logic)
  risk:         ScanPresetRisk;
  riskNote:     string;
  color:        string;         // Tailwind color token (emerald / sky / amber / violet)
}

export const SCAN_PRESETS: ScanPreset[] = [
  {
    id:           'weird-reddit',
    name:         'Weird Reddit',
    tagline:      'Subreddits for strange experiences & anomalous reports',
    description:  'Fetches recent posts from Reddit sources — paranormal, glitch-in-the-matrix, lost media, and similar subs. Uses structured JSON API; no HTML scraping.',
    sourceTypes:  ['reddit'],
    nameKeywords: ['reddit', 'subreddit'],
    risk:         'low',
    riskNote:     'Low risk — Reddit JSON API only. Results are real posts from real accounts.',
    color:        'emerald',
  },
  {
    id:           'lost-media',
    name:         'Lost Media',
    tagline:      'MediaWiki archives for unrecovered content',
    description:  'Searches MediaWiki-based sites (Lost Media Wiki and similar) using their search API for articles about missing, lost, or recovered media.',
    sourceTypes:  ['mediawiki'],
    nameKeywords: ['media', 'wiki', 'lost'],
    risk:         'low',
    riskNote:     'Low risk — plain-text article extracts only via MediaWiki API.',
    color:        'sky',
  },
  {
    id:           'dead-web',
    name:         'Dead Web',
    tagline:      'Wayback Machine & archive sources for deleted pages',
    description:  'Queries Wayback CDX API for archived snapshots of sites that may no longer be live. Best used with Discover Links on a specific domain — not the Wayback homepage.',
    sourceTypes:  ['wayback', 'archive'],
    nameKeywords: ['wayback', 'archive', 'archived', 'dead', 'deleted'],
    risk:         'medium',
    riskNote:     'Medium — archived pages often return index/nav results. Use Discover Links and check candidates carefully.',
    color:        'amber',
  },
  {
    id:           'paranormal-forums',
    name:         'Paranormal Forums',
    tagline:      'Forum & BBS sources for eyewitness threads',
    description:  'Scans forum, BBS, and imageboard sources for paranormal threads, eyewitness reports, and recovered discussions. Candidate quality varies — review carefully.',
    sourceTypes:  ['forum', 'bbs', 'imageboard', 'archive_forum'],
    nameKeywords: ['forum', 'paranormal', 'bbs', 'board', 'chan'],
    risk:         'medium',
    riskNote:     'Medium — forum index pages are common. Check each candidate before queueing.',
    color:        'violet',
  },
];

/** "All enabled sources" pseudo-preset — the default behaviour. */
export const PRESET_ALL = 'all';
