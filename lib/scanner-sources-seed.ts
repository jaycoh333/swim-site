import type { DbScannerSource } from '@/lib/supabase/types';

/**
 * Seed registry of candidate scanner sources.
 *
 * STATUS: REGISTRY ONLY — no fetchers connected, no automated scanning.
 * All sources start enabled=false. A curator must manually enable each one
 * before any automated fetch pipeline could ever use it (future phase).
 *
 * Human approval is required at every stage. These entries document
 * WHERE signals could be recovered from — not that recovery is happening.
 */
export const SCANNER_SOURCES_SEED: DbScannerSource[] = [
  {
    id: 'src-001',
    name: 'Erowid Experience Vaults',
    source_type: 'archive',
    base_url: 'https://erowid.org/experiences/',
    description:
      'Community-submitted psychedelic and altered-state experience reports. Rich source of consciousness anomalies, entity encounters, machine elves, and DMT-space phenomena. Carefully moderated since 1995.',
    category_focus: ['Psychedelics', 'Consciousness', 'Paranormal', 'Spirituality'],
    risk_level: 'low',
    refresh_cadence: 'weekly',
    attribution_rules:
      'Credit "Erowid.org Experience Vaults" with original author handle if public. Summarize — do not reproduce full trip report text.',
    enabled: false,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-002',
    name: 'Wayback Machine — Deleted Forums',
    source_type: 'archive',
    base_url: 'https://web.archive.org/',
    description:
      'Internet Archive snapshots of deleted paranormal forums, dead BBS boards, and vanished discussion threads. Primary recovery vector for signals that no longer exist at their original URLs.',
    category_focus: ['Paranormal', 'UFOs', 'Hidden History', 'Internet Lore'],
    risk_level: 'low',
    refresh_cadence: 'manual',
    attribution_rules:
      'Always link to the Wayback snapshot URL, not the original dead URL. Note original site name and approximate deletion date when known.',
    enabled: false,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-003',
    name: 'AboveTopSecret Forums',
    source_type: 'forum',
    base_url: 'https://www.abovetopsecret.com/',
    description:
      'Long-running conspiracy and paranormal forum active since 2001. Decades of archived UFO sighting reports, government whistleblower claims, and anomaly threads. Some content removed over time — cross-reference Wayback for deleted posts.',
    category_focus: ['UFOs', 'Conspiracy Theory', 'Whistleblower Files', 'Paranormal', 'Shadow Systems'],
    risk_level: 'medium',
    refresh_cadence: 'weekly',
    attribution_rules:
      'Credit original poster handle and thread creation date. Do not reproduce long quote chains. Summarize the core claim only.',
    enabled: false,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-004',
    name: 'r/Glitch_in_the_Matrix',
    source_type: 'reddit',
    base_url: 'https://www.reddit.com/r/Glitch_in_the_Matrix/',
    description:
      'Personal accounts of reality anomalies: deja vu loops, timeline inconsistencies, impossible coincidences, and simulation breaks. High signal density for consciousness and simulation anomaly categories.',
    category_focus: ['Simulation Theory', 'Paranormal', 'Weird Encounters', 'Internet Lore'],
    risk_level: 'low',
    refresh_cadence: 'daily',
    attribution_rules:
      'Credit u/[handle] on r/Glitch_in_the_Matrix with post date. Summarize — do not reproduce full post text. Link to archived version if available.',
    enabled: true,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-005',
    name: 'Lost Media Wiki',
    source_type: 'mediawiki',
    base_url: 'https://www.lostmediawiki.com/',
    description:
      'Community-maintained encyclopedia of lost, destroyed, or buried media: missing TV episodes, unreleased films, deleted recordings, suppressed games. Strong source for media anomalies and cultural erasure signals.',
    category_focus: ['Lost Media', 'Internet Mysteries', 'Conspiracy Theory', 'Censored History'],
    risk_level: 'low',
    refresh_cadence: 'weekly',
    attribution_rules:
      'Credit "Lost Media Wiki" with article title and page URL. Note when recovery status changed (found / still lost).',
    enabled: true,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-006',
    name: 'Textfiles.com — BBS Archives',
    source_type: 'bbs',
    base_url: 'https://www.textfiles.com/',
    description:
      'Massive archive of 1980s–1990s BBS text files: early UFO reports, pre-internet conspiracy theories, occult texts, hacker manifestos, underground zines. Raw signal from before the web. Much is anonymous — no account names.',
    category_focus: ['UFOs', 'Paranormal', 'Conspiracy Theory', 'Occult Archives', 'Hidden History', 'Forbidden Tech'],
    risk_level: 'low',
    refresh_cadence: 'manual',
    attribution_rules:
      'Credit textfiles.com with the BBS name and subdirectory path. Note approximate year of the file. Most authors are anonymous by design.',
    enabled: false,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-007',
    name: '/x/ Paranormal — 4plebs Archive',
    source_type: 'imageboard',
    base_url: 'https://archive.4plebs.org/x/',
    description:
      'Archived threads from 4chan /x/ paranormal board. High noise, occasional genuine signal. Focus on recurring thread archetypes: tulpa encounters, sigil work, entity contact, reality anomalies, and creepypasta with authentic texture.',
    category_focus: ['Paranormal', 'Occult Archives', 'Weird Encounters', 'Internet Lore', 'Internet Mysteries'],
    risk_level: 'high',
    refresh_cadence: 'manual',
    attribution_rules:
      'Anonymous by default — no personal attribution. Note board (/x/), thread ID, and archive date. Screen carefully for PII before intake.',
    enabled: false,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-008',
    name: 'GodLike Productions',
    source_type: 'forum',
    base_url: 'https://www.godlikeproductions.com/',
    description:
      'High-volume conspiracy and paranormal forum known for early reports on emerging phenomena before mainstream coverage. Mixed signal quality — requires heavy curation. GLP blocks external referrers, so links must go to Wayback snapshots.',
    category_focus: ['UFOs', 'Paranormal', 'Conspiracy Theory', 'Government', 'Whistleblower Files'],
    risk_level: 'high',
    refresh_cadence: 'manual',
    attribution_rules:
      'Summarize only. Do not link directly to GLP — they block external referrers. Always use Wayback snapshot URL. Verify post dates carefully.',
    enabled: false,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
];
