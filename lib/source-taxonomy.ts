/**
 * Phase AF — Source Taxonomy System
 *
 * Classifies scanner sources into semantic types beyond the raw source_type
 * field. Computed from source_type + name patterns — no DB changes required.
 *
 * Used for:
 *   - Custom extraction routing (BBS vs forum vs UFO database)
 *   - Deep Truth Scanner prioritization
 *   - Fiction/LARP filtering
 *   - UI taxonomy badges
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SourceTaxonomy =
  | 'bbs_archive'        // BBS/textfiles/Usenet text artifacts
  | 'conspiracy_archive' // Archived conspiracy/alternative theory sites
  | 'ufo_database'       // UFO case databases, NUFORC, NICAP, MUFON
  | 'occult_archive'     // Occult, esoteric, sacred-texts archives
  | 'document_archive'   // FOIA docs, declassified files, transcripts
  | 'forum_archive'      // Archived old forums (ATS, GLP, archived phpBB)
  | 'usenet_archive'     // Usenet newsgroup archives
  | 'old_web'            // GeoCities, Angelfire, early personal pages
  | 'modern_forum'       // Active current-era forums and communities
  | 'fiction_lore'       // SCP, creepypasta, ARG, wikis, fan lore
  | 'media_collection'   // Media databases, video archives, image boards
  | 'unknown';

export interface TaxonomyMeta {
  taxonomy:           SourceTaxonomy;
  label:              string;
  description:        string;
  authenticityWeight: number; // 0–100: signal credibility floor
  archiveDepthWeight: number; // 0–100: how far back this source typically reaches
  riskLevel:          'low' | 'medium' | 'high';
  dtsRank:            number; // Deep Truth Scanner sort priority (lower = higher priority)
  color:              string; // Tailwind color token for UI badges
}

// ---------------------------------------------------------------------------
// Taxonomy definitions
// ---------------------------------------------------------------------------

export const TAXONOMY_META: Record<SourceTaxonomy, TaxonomyMeta> = {
  bbs_archive: {
    taxonomy: 'bbs_archive',
    label: 'BBS Archive',
    description: 'BBS/Textfiles/Usenet text artifacts — pre-internet era',
    authenticityWeight: 85,
    archiveDepthWeight: 95,
    riskLevel: 'low',
    dtsRank: 1,
    color: 'violet',
  },
  ufo_database: {
    taxonomy: 'ufo_database',
    label: 'UFO Database',
    description: 'Formal UFO case databases: NUFORC, NICAP, MUFON, CUFON',
    authenticityWeight: 80,
    archiveDepthWeight: 90,
    riskLevel: 'low',
    dtsRank: 2,
    color: 'sky',
  },
  document_archive: {
    taxonomy: 'document_archive',
    label: 'Document Archive',
    description: 'FOIA files, declassified docs, transcripts, case reports',
    authenticityWeight: 90,
    archiveDepthWeight: 85,
    riskLevel: 'low',
    dtsRank: 3,
    color: 'emerald',
  },
  conspiracy_archive: {
    taxonomy: 'conspiracy_archive',
    label: 'Conspiracy Archive',
    description: 'Archived conspiracy / alternative-theory sites',
    authenticityWeight: 40,
    archiveDepthWeight: 80,
    riskLevel: 'medium',
    dtsRank: 4,
    color: 'amber',
  },
  forum_archive: {
    taxonomy: 'forum_archive',
    label: 'Forum Archive',
    description: 'Archived old forums — ATS, GLP, phpBB etc.',
    authenticityWeight: 50,
    archiveDepthWeight: 75,
    riskLevel: 'medium',
    dtsRank: 5,
    color: 'orange',
  },
  occult_archive: {
    taxonomy: 'occult_archive',
    label: 'Occult Archive',
    description: 'Occult, esoteric, and sacred-texts repositories',
    authenticityWeight: 60,
    archiveDepthWeight: 88,
    riskLevel: 'low',
    dtsRank: 6,
    color: 'purple',
  },
  usenet_archive: {
    taxonomy: 'usenet_archive',
    label: 'Usenet Archive',
    description: 'Archived Usenet newsgroup posts',
    authenticityWeight: 75,
    archiveDepthWeight: 92,
    riskLevel: 'low',
    dtsRank: 7,
    color: 'teal',
  },
  old_web: {
    taxonomy: 'old_web',
    label: 'Old Web',
    description: 'GeoCities, Angelfire, Tripod — early personal web pages',
    authenticityWeight: 55,
    archiveDepthWeight: 85,
    riskLevel: 'medium',
    dtsRank: 8,
    color: 'yellow',
  },
  modern_forum: {
    taxonomy: 'modern_forum',
    label: 'Modern Forum',
    description: 'Active current-era community forums and social platforms',
    authenticityWeight: 35,
    archiveDepthWeight: 15,
    riskLevel: 'low',
    dtsRank: 90,
    color: 'slate',
  },
  fiction_lore: {
    taxonomy: 'fiction_lore',
    label: 'Fiction / Lore',
    description: 'SCP, creepypasta, ARG, wikis — fictional or semi-fictional lore',
    authenticityWeight: 10,
    archiveDepthWeight: 20,
    riskLevel: 'low',
    dtsRank: 99,
    color: 'pink',
  },
  media_collection: {
    taxonomy: 'media_collection',
    label: 'Media Collection',
    description: 'Image boards, video archives, media databases',
    authenticityWeight: 30,
    archiveDepthWeight: 40,
    riskLevel: 'medium',
    dtsRank: 95,
    color: 'slate',
  },
  unknown: {
    taxonomy: 'unknown',
    label: 'Unknown',
    description: 'Unclassified source',
    authenticityWeight: 30,
    archiveDepthWeight: 30,
    riskLevel: 'medium',
    dtsRank: 50,
    color: 'slate',
  },
};

// ---------------------------------------------------------------------------
// Classification logic
// ---------------------------------------------------------------------------

// Name fragments → taxonomy (checked in order; first match wins)
const TAXONOMY_NAME_RULES: Array<{ fragments: string[]; taxonomy: SourceTaxonomy }> = [
  // BBS / Usenet
  { fragments: ['textfiles', 'bbs', 'usenet', 'fidonet', 'dejanews', 'google groups'], taxonomy: 'bbs_archive' },
  // UFO databases
  { fragments: ['nuforc', 'nicap', 'mufon', 'cufon', 'ufo evidence', 'ufo database', 'majestic'], taxonomy: 'ufo_database' },
  // Document archives
  { fragments: ['foia', 'declassified', 'blackvault', 'black vault', 'nsa documents', 'cia reading', 'vault.cia', 'cryptome'], taxonomy: 'document_archive' },
  // Occult archives
  { fragments: ['sacred-texts', 'sacred texts', 'hermetic', 'erowid', 'cassiopaea', 'crystalinks', 'bibliotecapleyades', 'rexresearch', 'keelynet'], taxonomy: 'occult_archive' },
  // Conspiracy archives
  { fragments: ['abovetopsecret', 'rense', 'projectcamelot', 'projectavalon', 'infowars', 'prisonplanet', 'surfingtheapocalypse', 'anomalist', 'anomalist', 'earthfiles', 'coast to coast', 'coasttocoast', 'virtuallystrange', 'parascope', 'fortean', 'anomalist', 'friedman', 'stopthecrime', 'educate-yourself'], taxonomy: 'conspiracy_archive' },
  // Old web
  { fragments: ['geocities', 'angelfire', 'tripod', 'fortunecity', 'homestead', 'xoom.com', 'brinkster'], taxonomy: 'old_web' },
  // Fiction / lore
  { fragments: ['scp', 'creepypasta', 'nosleep', 'scpwiki', 'scp-wiki', 'arg', 'unfiction', 'the backrooms'], taxonomy: 'fiction_lore' },
  // Modern forums
  { fragments: ['reddit', 'discord', '4chan', 'twitter', 'tumblr', 'facebook'], taxonomy: 'modern_forum' },
  // Forum archives
  { fragments: ['abovetopsecret', 'godlikeproductions', 'glp', 'above top secret', 'lunatic outpost', 'armageddonline', 'theforum', 'unexplained-mysteries'], taxonomy: 'forum_archive' },
  // Media collections
  { fragments: ['youtube', 'rumble', 'bitchute', 'odysee', 'vimeo', 'imdb'], taxonomy: 'media_collection' },
];

// source_type → default taxonomy fallback when name rules don't match
const SOURCE_TYPE_DEFAULT: Record<string, SourceTaxonomy> = {
  bbs:          'bbs_archive',
  wayback:      'old_web',
  archive:      'conspiracy_archive',
  archive_forum:'forum_archive',
  mediawiki:    'unknown',
  forum:        'modern_forum',
  reddit:       'modern_forum',
  imageboard:   'media_collection',
  pastebin:     'unknown',
  other:        'unknown',
};

export function classifySourceTaxonomy(sourceType: string, sourceName: string): SourceTaxonomy {
  const lc = sourceName.toLowerCase();
  for (const rule of TAXONOMY_NAME_RULES) {
    if (rule.fragments.some((f) => lc.includes(f))) {
      return rule.taxonomy;
    }
  }
  return SOURCE_TYPE_DEFAULT[sourceType] ?? 'unknown';
}

export function getTaxonomyMeta(taxonomy: SourceTaxonomy): TaxonomyMeta {
  return TAXONOMY_META[taxonomy] ?? TAXONOMY_META.unknown;
}

// ---------------------------------------------------------------------------
// TASK 7: Deep source targets — name fragments that get priority boost
// ---------------------------------------------------------------------------

export const DEEP_SOURCE_TARGET_FRAGMENTS = [
  'textfiles', 'sacred-texts', 'sacred texts', 'bibliotecapleyades',
  'rexresearch', 'keelynet', 'cassiopaea',
  'nicap', 'nuforc', 'mufon', 'cufon',
  'blackvault', 'black vault', 'foia', 'cryptome',
  'wayback', 'internet archive',
  'erowid', 'crystalinks', 'anomalist', 'earthfiles',
  'parascope', 'fortean', 'virtuallystrange',
];

export function isDeepSourceTarget(sourceName: string): boolean {
  const lc = sourceName.toLowerCase();
  return DEEP_SOURCE_TARGET_FRAGMENTS.some((f) => lc.includes(f));
}

// ---------------------------------------------------------------------------
// TASK 4: Fiction/LARP detection
// ---------------------------------------------------------------------------

const SCP_PATTERNS = [
  'scp-', 'object class:', 'containment procedures', 'special containment',
  'the foundation', 'mobile task force', 'euclid', 'keter', 'safe class',
  'anomalous item', 'cognitohazard', 'antimemetic',
];
const CREEPYPASTA_PATTERNS = [
  'creepypasta', 'no sleep', 'r/nosleep', 'pasta', "jeff the killer",
  'slenderman', 'slender man', 'the rake', 'smile dog', 'ben drowned',
  'lavender town', "squidward's suicide",
];
const ARG_PATTERNS = [
  'alternate reality game', 'arg ', 'puppet master', 'rabbit hole', 'in-game',
  "it's just a game", 'this is not a game',
];
const LARP_PATTERNS = [
  'this is fiction', 'for entertainment purposes', 'this story is fictional',
  'roleplay', 'rp: ', '[ooc]', '(ooc)', 'out of character',
  'this is a work of fiction', 'any resemblance to',
  'disclaimer: this is', 'written by', 'author:', 'chapter 1',
  'part one', 'part 1', 'part i:', 'prologue:',
];

export interface FictionDetectResult {
  isFiction:  boolean;
  confidence: 'low' | 'medium' | 'high';
  patterns:   string[];
  subtype:    'scp' | 'creepypasta' | 'arg' | 'larp' | 'fiction' | 'none';
}

export function detectFictionOrLarp(text: string): FictionDetectResult {
  const lc = text.toLowerCase();
  const found: string[] = [];

  let scpHits    = 0;
  let pastaHits  = 0;
  let argHits    = 0;
  let larpHits   = 0;

  for (const p of SCP_PATTERNS)         if (lc.includes(p)) { found.push(p); scpHits++;   }
  for (const p of CREEPYPASTA_PATTERNS) if (lc.includes(p)) { found.push(p); pastaHits++; }
  for (const p of ARG_PATTERNS)         if (lc.includes(p)) { found.push(p); argHits++;   }
  for (const p of LARP_PATTERNS)        if (lc.includes(p)) { found.push(p); larpHits++;  }

  const totalHits = scpHits + pastaHits + argHits + larpHits;

  if (totalHits === 0) return { isFiction: false, confidence: 'low', patterns: [], subtype: 'none' };

  const confidence: 'low' | 'medium' | 'high' =
    totalHits >= 3 ? 'high' : totalHits >= 2 ? 'medium' : 'low';

  let subtype: FictionDetectResult['subtype'] = 'fiction';
  if      (scpHits   >= pastaHits && scpHits   >= argHits && scpHits   >= larpHits) subtype = 'scp';
  else if (pastaHits >= argHits   && pastaHits >= larpHits)                          subtype = 'creepypasta';
  else if (argHits   >= larpHits)                                                    subtype = 'arg';
  else                                                                               subtype = 'larp';

  return {
    isFiction:  confidence !== 'low' || scpHits >= 1 || pastaHits >= 1,
    confidence,
    patterns:   found.slice(0, 6),
    subtype,
  };
}

// ---------------------------------------------------------------------------
// TASK 5: Document/case signal detection
// ---------------------------------------------------------------------------

const DOCUMENT_SIGNALS = [
  // FOIA / declassification
  'foia', 'freedom of information', 'declassified', 'released under', 'redacted',
  'nsa document', 'cia document', 'dod document', 'dhs document', 'fbi document',
  // Reports and transcripts
  'case report', 'incident report', 'field report', 'investigation report',
  'official report', 'transcript', 'deposition', 'sworn statement',
  'witness statement', 'testimony', 'affidavit',
  // Investigative
  'timeline:', 'chronology:', 'case:', 'case number', 'file number', 'reference:',
  'investigator', 'investigation', 'findings:', 'conclusion:',
  // Scanned/archival
  'scanned document', 'archival copy', 'original document', 'photocopy',
  'microfilm', 'microfiche', 'digitized',
  // UFO specific
  'sighting report', 'encounter report', 'observation report', 'ufo report',
  'radar confirmation', 'physical evidence', 'material sample',
];

export function detectDocumentSignals(text: string): number {
  const lc = text.toLowerCase();
  let hits = 0;
  for (const s of DOCUMENT_SIGNALS) {
    if (lc.includes(s)) hits++;
  }
  return Math.min(hits * 3, 20);
}
