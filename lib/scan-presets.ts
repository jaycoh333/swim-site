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
 *
 * Each preset run is capped at MAX_PRESET_SOURCES sources and
 * PRESET_MAX_TOTAL_CANDIDATES total results (enforced in runFetchSessionAction
 * and ScannerConsoleClient).
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

/** Max sources to include in a single preset scan run. */
export const MAX_PRESET_SOURCES = 8;

/** "All enabled sources" pseudo-preset — the default behaviour. */
export const PRESET_ALL = 'all';

/** Debug test preset — returns static mock candidates to verify the pipeline. */
export const PRESET_DEBUG = 'debug-test';

export const SCAN_PRESETS: ScanPreset[] = [
  {
    id:           'weird-reddit',
    name:         'Weird Reddit',
    tagline:      'Glitch, paranormal & timeline anomaly subs',
    description:  'Fetches recent posts from the core anomaly subs: Glitch_in_the_Matrix, HighStrangeness, Paranormal, Thetruthishere, and Retconned. Uses Reddit JSON API; no HTML scraping.',
    sourceTypes:  ['reddit'],
    nameKeywords: ['glitch', 'highstrangeness', 'paranormal', 'thetruthishere', 'retconned', 'dreams'],
    risk:         'low',
    riskNote:     'Low risk — Reddit JSON API only. Results are real posts from real accounts.',
    color:        'emerald',
  },
  {
    id:           'lost-media',
    name:         'Lost Media',
    tagline:      'Lost media wiki, r/LostMedia & internet mysteries',
    description:  'Searches Lost Media Wiki articles (MediaWiki API) and fetches from r/LostMedia and r/InternetMysteries for posts about missing, lost, or recovered media and digital artifacts.',
    sourceTypes:  ['mediawiki', 'reddit'],
    nameKeywords: ['lost media', 'lostmedia', 'internet mysteries', 'internetmysteries'],
    risk:         'low',
    riskNote:     'Low risk — MediaWiki API and Reddit JSON only.',
    color:        'sky',
  },
  {
    id:           'mystery-investigation',
    name:         'Mystery Investigation',
    tagline:      'r/RBI, UnresolvedMysteries & internet cases',
    description:  'Community-driven mystery solving: r/RBI (Reddit Bureau of Investigation), r/UnresolvedMysteries, and r/InternetMysteries. Strong signal for conspiracy, hidden history, and unresolved case categories.',
    sourceTypes:  ['reddit'],
    nameKeywords: ['rbi', 'unresolved', 'unresolvedmysteries', 'internetmysteries', 'internet mysteries'],
    risk:         'low',
    riskNote:     'Low risk — Reddit JSON API only.',
    color:        'violet',
  },
  {
    id:           'dead-web',
    name:         'Dead Web',
    tagline:      'Wayback, Erowid, Textfiles & BBS archives',
    description:  'Queries archived and dead-web sources: Wayback Machine snapshots, Erowid experience reports, Textfiles.com BBS archives. Best for signals that no longer exist at original URLs.',
    sourceTypes:  ['wayback', 'archive', 'bbs'],
    nameKeywords: ['wayback', 'erowid', 'textfiles', 'bbs', 'archive', 'deleted'],
    risk:         'medium',
    riskNote:     'Medium — archived pages often return index/nav results. Check candidates carefully.',
    color:        'amber',
  },
  {
    id:           'encounters',
    name:         'Encounters',
    tagline:      'r/LetsNotMeet, creepy encounters & humanoid sightings',
    description:  'First-person eyewitness accounts of terrifying real-world encounters: r/LetsNotMeet, r/creepyencounters, r/BackwoodsCreepy, r/Humanoidencounters. High narrative density and eyewitness-testimony signal.',
    sourceTypes:  ['reddit'],
    nameKeywords: ['letsnot', 'letsnomeet', 'creepyencounters', 'backwoodscreepy', 'humanoidencounters', 'cryptids'],
    risk:         'low',
    riskNote:     'Low risk — Reddit JSON API only. Results are first-person eyewitness posts.',
    color:        'violet',
  },
  {
    id:           'ufo-entities',
    name:         'UFO / Entities',
    tagline:      'r/UFOs, r/HighStrangeness & humanoid encounter subs',
    description:  'UAP sightings, government disclosure, NHI contact accounts, and high-strangeness phenomena: r/UFOs, r/aliens, r/Humanoidencounters, r/HighStrangeness. Best for UFO, whistleblower, and hidden history categories.',
    sourceTypes:  ['reddit'],
    nameKeywords: ['ufos', 'aliens', 'humanoidencounters', 'highstrangeness'],
    risk:         'low',
    riskNote:     'Low risk — Reddit JSON API only. UAP / NHI disclosure content.',
    color:        'sky',
  },
  {
    id:           PRESET_DEBUG,
    name:         'Debug Test Feed',
    tagline:      'Static mock candidates — test queue/review/publish pipeline',
    description:  'Returns 5 hardcoded mock candidates. Use to verify the scanner UI pipeline works end-to-end without hitting live sources. Discard test entries after testing.',
    sourceTypes:  [],
    nameKeywords: [],
    risk:         'low',
    riskNote:     'No live fetches — static data only. Safe to run at any time.',
    color:        'emerald',
  },
];
