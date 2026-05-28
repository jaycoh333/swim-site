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

export type ScanPresetRisk  = 'low' | 'medium';
export type ScanPresetGroup = 'primary' | 'secondary';

export interface ScanPreset {
  id:              string;
  name:            string;
  tagline:         string;
  description:     string;
  modeExplanation: string;  // short blurb shown in mode banner
  sourceTypes:     string[];
  nameKeywords:    string[];
  risk:            ScanPresetRisk;
  riskNote:        string;
  color:           string;
  group:           ScanPresetGroup;
}

/** Max sources to include in a single preset scan run. */
export const MAX_PRESET_SOURCES = 8;

/** "All enabled sources" pseudo-preset — demoted to debug use only. */
export const PRESET_ALL = 'all';

/** Debug test preset — returns static mock candidates to verify the pipeline. */
export const PRESET_DEBUG = 'debug-test';

/** Deep Truth Scanner — archive-only origin excavation. Default mode. */
export const PRESET_DEEP_TRUTH = 'deep-truth-scanner';

/** Live Anomaly Feed — recent Reddit and current-web reports. */
export const PRESET_LIVE_FEED = 'live-anomaly-feed';

/** Documents / Case Files — FOIA, UFO databases, archive.org text collections. */
export const PRESET_DOCUMENTS = 'documents-case-files';

/** BBS / Early Web — textfiles, Wayback old-web, GeoCities/Angelfire/Tripod. */
export const PRESET_BBS_WEB = 'bbs-early-web';

export const SCAN_PRESETS: ScanPreset[] = [

  // ─── PRIMARY MODES ─────────────────────────────────────────────────────────

  {
    id:              PRESET_DEEP_TRUTH,
    name:            'Deep Truth Scanner',
    tagline:         'Archive-only: BBS, Wayback & early-web conspiracy artifacts',
    modeExplanation: 'Excavates archived claims, old web artifacts, case files, BBS/text records, and pre-social internet sources. Not a live trend search.',
    description:     'Hard-locks to archive sources only (Wayback, BBS, archive_forum, mediawiki). No Reddit. No modern feeds. Targets 1996–2012 pre-social internet: bibliotecapleyades, rense, abovetopsecret, projectcamelot, NUFORC, NICAP, MUFON, GeoCities, textfiles.com BBS, and early-web "truth" archives. All candidates must have an archive year or BBS provenance.',
    sourceTypes:     ['wayback', 'bbs', 'archive', 'archive_forum', 'mediawiki'],
    nameKeywords:    [
      'wayback', 'bibliotecapleyades', 'rense', 'abovetopsecret', 'projectcamelot',
      'projectavalon', 'crystalinks', 'coasttocoast', 'coast to coast', 'nuforc',
      'cufon', 'nicap', 'nicap.org', 'textfiles', 'bbs', 'geocities', 'angelfire',
      'tripod', 'fortunecity', 'mufon', 'parascope', 'anomalist', 'fortean',
      'friedman', 'earthfiles', 'black vault', 'blackvault', 'virtuallystrange',
      'ufo updates', 'ufo evidence', 'majesticdocuments', 'cydonia', 'hyper',
      'surfingtheapocalypse', 'alienshift', 'stopthecrime', 'educate-yourself',
      'internet archive', 'archive.org',
    ],
    risk:            'medium',
    riskNote:        'Medium — archive pages may return index or stub results. No Reddit or modern social content.',
    color:           'violet',
    group:           'primary',
  },

  {
    id:              PRESET_LIVE_FEED,
    name:            'Live Anomaly Feed',
    tagline:         'Current weird reports, Reddit anomaly subs & fresh chatter',
    modeExplanation: 'Surfaces current weird reports and fresh anomaly chatter. Reddit and modern sources allowed.',
    description:     'Aggregates recent posts from the core anomaly subs and current-web sources: Glitch_in_the_Matrix, HighStrangeness, Paranormal, UFOs, aliens, Humanoidencounters, Thetruthishere, Retconned, LetsNotMeet, and related. Best for fresh community reports and emerging anomaly discussions.',
    sourceTypes:     ['reddit', 'forum', 'imageboard'],
    nameKeywords:    [
      'glitch', 'highstrangeness', 'paranormal', 'thetruthishere', 'retconned',
      'ufos', 'aliens', 'humanoidencounters', 'letsnot', 'letsnomeet',
      'creepyencounters', 'backwoodscreepy', 'cryptids', 'dreams',
      'rbi', 'unresolved', 'unresolvedmysteries', 'internetmysteries',
      'lost media', 'lostmedia',
    ],
    risk:            'low',
    riskNote:        'Low risk — Reddit JSON API and current-web sources. Results are real posts from real accounts.',
    color:           'emerald',
    group:           'primary',
  },

  {
    id:              PRESET_DOCUMENTS,
    name:            'Documents / Case Files',
    tagline:         'FOIA, UFO databases, archive.org texts & declassified records',
    modeExplanation: 'Searches structured archives, FOIA/case records, and public document collections.',
    description:     'Targets document-grade sources: NUFORC, NICAP, MUFON, CUFON, Black Vault, Majestic Documents, Internet Archive text collections, and public FOIA/declassified archives. Skips personal blogs and community posts — looks for structured case records, investigation reports, and government/institutional documents.',
    sourceTypes:     ['archive', 'mediawiki'],
    nameKeywords:    [
      'nuforc', 'nicap', 'mufon', 'cufon', 'black vault', 'blackvault',
      'majestic', 'majesticdocuments', 'vault', 'documents', 'parascope',
      'virtuallystrange', 'ufo evidence', 'ufo updates', 'cydonia',
      'friedman', 'earthfiles', 'archive.org', 'internet archive',
      'foia', 'declassified', 'report', 'case file',
    ],
    risk:            'medium',
    riskNote:        'Medium — document archives may return index pages or scan stubs. Curator review required.',
    color:           'sky',
    group:           'primary',
  },

  {
    id:              PRESET_BBS_WEB,
    name:            'BBS / Early Web',
    tagline:         'Textfiles, Wayback old-web, GeoCities/Angelfire, Usenet/BBS',
    modeExplanation: 'Walks early web folders, textfiles, and old network artifacts.',
    description:     'Walks textfiles.com BBS archives, Wayback Machine old-web snapshots, GeoCities/Angelfire/Tripod mirrors, and pre-social era text repositories. Targets .txt files, old HTML directories, and BBS post archives. All content is from the pre-social internet era.',
    sourceTypes:     ['bbs', 'wayback'],
    nameKeywords:    [
      'textfiles', 'geocities', 'angelfire', 'tripod', 'fortunecity',
      'bbs', 'usenet', 'fortean', 'unexplained', 'erowid',
      'wayback', 'rense', 'bibliotecapleyades', 'abovetopsecret',
    ],
    risk:            'medium',
    riskNote:        'Medium — BBS content is anonymous and era-unverified. Old web crawls may surface index or nav pages.',
    color:           'amber',
    group:           'primary',
  },

  // ─── SECONDARY / DEBUG ─────────────────────────────────────────────────────

  {
    id:              'weird-reddit',
    name:            'Weird Reddit',
    tagline:         'Glitch, paranormal & timeline anomaly subs',
    modeExplanation: 'Surfaces current weird reports and fresh anomaly chatter.',
    description:     'Fetches recent posts from the core anomaly subs: Glitch_in_the_Matrix, HighStrangeness, Paranormal, Thetruthishere, and Retconned. Uses Reddit JSON API; no HTML scraping.',
    sourceTypes:     ['reddit'],
    nameKeywords:    ['glitch', 'highstrangeness', 'paranormal', 'thetruthishere', 'retconned', 'dreams'],
    risk:            'low',
    riskNote:        'Low risk — Reddit JSON API only. Results are real posts from real accounts.',
    color:           'emerald',
    group:           'secondary',
  },

  {
    id:              'encounters',
    name:            'Encounters',
    tagline:         'r/LetsNotMeet, creepy encounters & humanoid sightings',
    modeExplanation: 'Surfaces current weird reports and fresh anomaly chatter.',
    description:     'First-person eyewitness accounts of terrifying real-world encounters: r/LetsNotMeet, r/creepyencounters, r/BackwoodsCreepy, r/Humanoidencounters. High narrative density and eyewitness-testimony signal.',
    sourceTypes:     ['reddit'],
    nameKeywords:    ['letsnot', 'letsnomeet', 'creepyencounters', 'backwoodscreepy', 'humanoidencounters', 'cryptids'],
    risk:            'low',
    riskNote:        'Low risk — Reddit JSON API only. Results are first-person eyewitness posts.',
    color:           'violet',
    group:           'secondary',
  },

  {
    id:              'ufo-entities',
    name:            'UFO / Entities',
    tagline:         'r/UFOs, r/HighStrangeness & humanoid encounter subs',
    modeExplanation: 'Surfaces current weird reports and fresh anomaly chatter.',
    description:     'UAP sightings, government disclosure, NHI contact accounts, and high-strangeness phenomena: r/UFOs, r/aliens, r/Humanoidencounters, r/HighStrangeness. Best for UFO, whistleblower, and hidden history categories.',
    sourceTypes:     ['reddit'],
    nameKeywords:    ['ufos', 'aliens', 'humanoidencounters', 'highstrangeness'],
    risk:            'low',
    riskNote:        'Low risk — Reddit JSON API only. UAP / NHI disclosure content.',
    color:           'sky',
    group:           'secondary',
  },

  {
    id:              'lost-media',
    name:            'Lost Media',
    tagline:         'Lost media wiki, r/LostMedia & internet mysteries',
    modeExplanation: 'Surfaces current weird reports and fresh anomaly chatter.',
    description:     'Searches Lost Media Wiki articles (MediaWiki API) and fetches from r/LostMedia and r/InternetMysteries for posts about missing, lost, or recovered media and digital artifacts.',
    sourceTypes:     ['mediawiki', 'reddit'],
    nameKeywords:    ['lost media', 'lostmedia', 'internet mysteries', 'internetmysteries'],
    risk:            'low',
    riskNote:        'Low risk — MediaWiki API and Reddit JSON only.',
    color:           'sky',
    group:           'secondary',
  },

  {
    id:              'mystery-investigation',
    name:            'Mystery Investigation',
    tagline:         'r/RBI, UnresolvedMysteries & internet cases',
    modeExplanation: 'Surfaces current weird reports and fresh anomaly chatter.',
    description:     'Community-driven mystery solving: r/RBI (Reddit Bureau of Investigation), r/UnresolvedMysteries, and r/InternetMysteries. Strong signal for conspiracy, hidden history, and unresolved case categories.',
    sourceTypes:     ['reddit'],
    nameKeywords:    ['rbi', 'unresolved', 'unresolvedmysteries', 'internetmysteries', 'internet mysteries'],
    risk:            'low',
    riskNote:        'Low risk — Reddit JSON API only.',
    color:           'violet',
    group:           'secondary',
  },

  {
    id:              'origin-scan',
    name:            'Origin Scan',
    tagline:         'Early internet archaeology — 1990s web, BBS, old-web domains',
    modeExplanation: 'Excavates archived claims, old web artifacts, and pre-social internet sources.',
    description:     'Targets pre-2013 Wayback snapshots of GeoCities, Angelfire, Tripod, textfiles.com BBS archives, NUFORC, NICAP, ParaScope, MUFON, and other archival sources. Prioritizes content from before social media erased the early web.',
    sourceTypes:     ['wayback', 'bbs', 'archive', 'mediawiki', 'archive_forum'],
    nameKeywords:    [
      'wayback', 'geocities', 'angelfire', 'tripod', 'fortunecity', 'textfiles', 'bbs',
      'archive', 'abovetopsecret', 'rense', 'bibliotecapleyades', 'erowid', 'unexplained',
      'deleted', 'nuforc', 'nicap', 'mufon', 'cufon', 'parascope', 'anomalist',
      'fortean', 'coast to coast', 'coasttocoast', 'virtuallystrange', 'ufo updates',
      'friedman', 'earthfiles', 'crystalinks', 'black vault', 'blackvault',
      'lost media', 'lostmedia', 'internet archive', 'paranormal about',
    ],
    risk:            'medium',
    riskNote:        'Medium — archived pages may return index results; BBS content is anonymous and era-unverified. Curator review required.',
    color:           'amber',
    group:           'secondary',
  },

  {
    id:              'dead-web',
    name:            'Dead Web',
    tagline:         'Wayback, Erowid, Textfiles & BBS archives',
    modeExplanation: 'Walks early web folders, textfiles, and old network artifacts.',
    description:     'Queries archived and dead-web sources: Wayback Machine snapshots, Erowid experience reports, Textfiles.com BBS archives. Best for signals that no longer exist at original URLs.',
    sourceTypes:     ['wayback', 'archive', 'bbs'],
    nameKeywords:    ['wayback', 'erowid', 'textfiles', 'bbs', 'archive', 'deleted'],
    risk:            'medium',
    riskNote:        'Medium — archived pages often return index/nav results. Check candidates carefully.',
    color:           'amber',
    group:           'secondary',
  },

  {
    id:              PRESET_DEBUG,
    name:            'Debug Test Feed',
    tagline:         'Static mock candidates — test queue/review/publish pipeline',
    modeExplanation: 'Returns static test candidates to verify the scanner pipeline.',
    description:     'Returns 5 hardcoded mock candidates. Use to verify the scanner UI pipeline works end-to-end without hitting live sources. Discard test entries after testing.',
    sourceTypes:     [],
    nameKeywords:    [],
    risk:            'low',
    riskNote:        'No live fetches — static data only. Safe to run at any time.',
    color:           'emerald',
    group:           'secondary',
  },
];
