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
    id: 'src-009',
    name: 'r/HighStrangeness',
    source_type: 'reddit',
    base_url: 'https://www.reddit.com/r/HighStrangeness/',
    description:
      'Curated accounts of high-strangeness phenomena: cryptids, UAPs, dimensional anomalies, telepathy, precognition, and unexplained encounters that resist simple explanation.',
    category_focus: ['Paranormal', 'UFOs', 'Weird Encounters', 'Consciousness'],
    risk_level: 'low',
    refresh_cadence: 'daily',
    attribution_rules:
      'Credit u/[handle] on r/HighStrangeness with post date. Summarize — do not reproduce full post.',
    enabled: true,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-010',
    name: 'r/Paranormal',
    source_type: 'reddit',
    base_url: 'https://www.reddit.com/r/Paranormal/',
    description:
      'Personal paranormal experiences: ghost sightings, shadow figures, poltergeist activity, haunted locations, and unexplained phenomena shared by ordinary people.',
    category_focus: ['Paranormal', 'Weird Encounters', 'Internet Lore'],
    risk_level: 'low',
    refresh_cadence: 'daily',
    attribution_rules:
      'Credit u/[handle] on r/Paranormal with post date. Summarize — do not reproduce full post.',
    enabled: true,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-011',
    name: 'r/LostMedia',
    source_type: 'reddit',
    base_url: 'https://www.reddit.com/r/lostmedia/',
    description:
      'Community searching for lost, forgotten, and unrecovered media: rare recordings, missing footage, suppressed broadcasts, and internet media that vanished.',
    category_focus: ['Lost Media', 'Internet Mysteries', 'Censored History'],
    risk_level: 'low',
    refresh_cadence: 'weekly',
    attribution_rules:
      'Credit u/[handle] on r/lostmedia with post date. Summarize — do not reproduce full post.',
    enabled: true,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-012',
    name: 'r/UnresolvedMysteries',
    source_type: 'reddit',
    base_url: 'https://www.reddit.com/r/UnresolvedMysteries/',
    description:
      'In-depth discussions of unsolved disappearances, unexplained deaths, cold cases, and real-world mysteries that remain unresolved. High signal density for conspiracy and hidden history categories.',
    category_focus: ['Conspiracy Theory', 'Hidden History', 'Paranormal', 'Whistleblower Files'],
    risk_level: 'low',
    refresh_cadence: 'daily',
    attribution_rules:
      'Credit u/[handle] on r/UnresolvedMysteries with post date. Summarize — do not reproduce full post.',
    enabled: true,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-013',
    name: 'r/LetsNotMeet',
    source_type: 'reddit',
    base_url: 'https://www.reddit.com/r/LetsNotMeet/',
    description:
      'True stories of terrifying real-world encounters with strangers, stalkers, and predators. First-person eyewitness accounts with high emotional intensity — strong narrative and unresolved-mystery signals.',
    category_focus: ['Paranormal', 'Weird Encounters', 'Hidden History'],
    risk_level: 'low',
    refresh_cadence: 'daily',
    attribution_rules:
      'Credit u/[handle] on r/LetsNotMeet with post date. Summarize — do not reproduce full post.',
    enabled: true,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-014',
    name: 'r/RBI',
    source_type: 'reddit',
    base_url: 'https://www.reddit.com/r/RBI/',
    description:
      'Reddit Bureau of Investigation — community-driven mystery solving. Real unsolved cases, missing persons, strange discoveries, and internet mysteries submitted for collective investigation.',
    category_focus: ['Conspiracy Theory', 'Hidden History', 'Internet Mysteries', 'Paranormal'],
    risk_level: 'low',
    refresh_cadence: 'daily',
    attribution_rules:
      'Credit u/[handle] on r/RBI with post date. Summarize — do not reproduce full post.',
    enabled: true,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-015',
    name: 'r/Retconned',
    source_type: 'reddit',
    base_url: 'https://www.reddit.com/r/Retconned/',
    description:
      'Mandela Effect and timeline anomalies — collective memories that differ from documented history. Personal accounts of reality inconsistencies, alternate timelines, and mass false memory events.',
    category_focus: ['Simulation Theory', 'Paranormal', 'Weird Encounters'],
    risk_level: 'low',
    refresh_cadence: 'daily',
    attribution_rules:
      'Credit u/[handle] on r/Retconned with post date. Summarize — do not reproduce full post.',
    enabled: true,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-016',
    name: 'r/Thetruthishere',
    source_type: 'reddit',
    base_url: 'https://www.reddit.com/r/Thetruthishere/',
    description:
      'Personal paranormal experiences, encounters with the unexplained, and anomalous events that resist rational explanation. Eyewitness-focused with strong unresolved-mystery framing.',
    category_focus: ['Paranormal', 'Weird Encounters', 'UFOs'],
    risk_level: 'low',
    refresh_cadence: 'daily',
    attribution_rules:
      'Credit u/[handle] on r/Thetruthishere with post date. Summarize — do not reproduce full post.',
    enabled: true,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-017',
    name: 'r/InternetMysteries',
    source_type: 'reddit',
    base_url: 'https://www.reddit.com/r/InternetMysteries/',
    description:
      'Unsolved internet mysteries, strange websites, cryptic ARGs, lost or unidentified online content, and digital anomalies. Strong signal source for internet lore and lost media categories.',
    category_focus: ['Internet Mysteries', 'Lost Media', 'Internet Lore'],
    risk_level: 'low',
    refresh_cadence: 'weekly',
    attribution_rules:
      'Credit u/[handle] on r/InternetMysteries with post date. Summarize — do not reproduce full post.',
    enabled: true,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  // ── Phase J new sources ─────────────────────────────────────────────────
  {
    id: 'src-018',
    name: 'r/AskReddit',
    source_type: 'reddit',
    base_url: 'https://www.reddit.com/r/AskReddit/',
    description:
      'Anomaly-adjacent threads only — "have you ever experienced something you cannot explain", unexplained events, paranormal encounters asked to a mass audience. Requires strict keyword filtering; volume is enormous.',
    category_focus: ['Paranormal', 'Weird Encounters', 'Consciousness'],
    risk_level: 'low',
    refresh_cadence: 'manual',
    attribution_rules:
      'Credit u/[handle] on r/AskReddit with post date. Summarize top answers — do not reproduce full comment threads.',
    enabled: false,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-019',
    name: 'r/creepyencounters',
    source_type: 'reddit',
    base_url: 'https://www.reddit.com/r/creepyencounters/',
    description:
      'First-person accounts of unexplained, disturbing real-world encounters. High narrative density — strong signal for weird encounters and eyewitness-testimony categories.',
    category_focus: ['Paranormal', 'Weird Encounters'],
    risk_level: 'low',
    refresh_cadence: 'daily',
    attribution_rules:
      'Credit u/[handle] on r/creepyencounters with post date. Summarize — do not reproduce full post.',
    enabled: true,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-020',
    name: 'r/BackwoodsCreepy',
    source_type: 'reddit',
    base_url: 'https://www.reddit.com/r/BackwoodsCreepy/',
    description:
      'Strange and unsettling encounters in wilderness and rural settings: unexplained lights, missing persons mysteries, impossible sounds, and encounters in the deep woods.',
    category_focus: ['Paranormal', 'Weird Encounters', 'Hidden History'],
    risk_level: 'low',
    refresh_cadence: 'daily',
    attribution_rules:
      'Credit u/[handle] on r/BackwoodsCreepy with post date. Summarize — do not reproduce full post.',
    enabled: true,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-021',
    name: 'r/Humanoidencounters',
    source_type: 'reddit',
    base_url: 'https://www.reddit.com/r/Humanoidencounters/',
    description:
      'Personal accounts of encounters with non-human humanoid entities — from Bigfoot-type cryptids to interdimensional beings and UAP-associated non-human intelligences.',
    category_focus: ['Paranormal', 'UFOs', 'Weird Encounters'],
    risk_level: 'low',
    refresh_cadence: 'daily',
    attribution_rules:
      'Credit u/[handle] on r/Humanoidencounters with post date. Summarize — do not reproduce full post.',
    enabled: true,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-022',
    name: 'r/cryptids',
    source_type: 'reddit',
    base_url: 'https://www.reddit.com/r/cryptids/',
    description:
      'Discussion and sighting reports of cryptid creatures: Bigfoot, Dogman, Mothman, lake monsters, and other unclassified entities. Mix of eyewitness accounts and analysis.',
    category_focus: ['Paranormal', 'Weird Encounters'],
    risk_level: 'low',
    refresh_cadence: 'weekly',
    attribution_rules:
      'Credit u/[handle] on r/cryptids with post date. Summarize — do not reproduce full post.',
    enabled: false,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-023',
    name: 'r/UFOs',
    source_type: 'reddit',
    base_url: 'https://www.reddit.com/r/UFOs/',
    description:
      'UAP sighting reports, government disclosure developments, FOIA releases, and whistleblower accounts. Active community with high-signal threads around congressional hearings and NHI claims.',
    category_focus: ['UFOs', 'Whistleblower Files', 'Government', 'Hidden History'],
    risk_level: 'low',
    refresh_cadence: 'daily',
    attribution_rules:
      'Credit u/[handle] on r/UFOs with post date. Summarize — do not reproduce full post.',
    enabled: true,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-024',
    name: 'r/aliens',
    source_type: 'reddit',
    base_url: 'https://www.reddit.com/r/aliens/',
    description:
      'Discussion of extraterrestrial and NHI phenomena: abduction accounts, contact experiences, hybridization claims, and UAP/NHI intersection. Higher noise-to-signal ratio than r/UFOs.',
    category_focus: ['UFOs', 'Paranormal', 'Consciousness'],
    risk_level: 'low',
    refresh_cadence: 'weekly',
    attribution_rules:
      'Credit u/[handle] on r/aliens with post date. Summarize — do not reproduce full post.',
    enabled: false,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-025',
    name: 'r/Dreams',
    source_type: 'reddit',
    base_url: 'https://www.reddit.com/r/Dreams/',
    description:
      'Shared dream experiences with unusual content: precognitive dreams, recurring archetypes, entity contact in dreams, and anomalous dream phenomena that resist conventional explanation.',
    category_focus: ['Consciousness', 'Paranormal', 'Spirituality'],
    risk_level: 'low',
    refresh_cadence: 'daily',
    attribution_rules:
      'Credit u/[handle] on r/Dreams with post date. Summarize — do not reproduce full post.',
    enabled: true,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  // ── Phase O: Deep Archive / Origin Scan sources ────────────────────────
  {
    id: 'src-026',
    name: 'Wayback — GeoCities Archive',
    source_type: 'wayback',
    base_url: 'https://www.geocities.com/',
    description:
      'GeoCities was the defining 1990s personal web host — millions of pages about UFOs, paranormal, conspiracy theories, and weird phenomena from anonymous early adopters. Almost entirely deleted by Yahoo in 2009. Wayback CDX will find pre-2009 captures.',
    category_focus: ['Paranormal', 'UFOs', 'Internet Lore', 'Hidden History', 'Conspiracy Theory'],
    risk_level: 'low',
    refresh_cadence: 'manual',
    attribution_rules:
      'Credit as "GeoCities archive (pre-2009) via Wayback Machine". Note the original page owner handle or site name if visible. Era: 1990s–2000s web.',
    enabled: false,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-027',
    name: 'Wayback — Angelfire Archive',
    source_type: 'wayback',
    base_url: 'https://www.angelfire.com/',
    description:
      'Angelfire hosted thousands of personal paranormal and UFO research pages through the late 1990s and 2000s. Strong source for grassroots conspiracy and encounter documentation before social media absorbed personal publishing.',
    category_focus: ['Paranormal', 'UFOs', 'Conspiracy Theory', 'Internet Lore'],
    risk_level: 'low',
    refresh_cadence: 'manual',
    attribution_rules:
      'Credit as "Angelfire archive (pre-2010) via Wayback Machine". Note original site title and author handle if visible.',
    enabled: false,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-028',
    name: 'Wayback — Tripod Archive',
    source_type: 'wayback',
    base_url: 'https://www.tripod.lycos.com/',
    description:
      'Tripod (Lycos) was another major 1990s–2000s free web host with extensive paranormal, UFO, and alternative research content. Captures pre-2008 personal pages about phenomena that have since vanished from the open web.',
    category_focus: ['Paranormal', 'UFOs', 'Hidden History', 'Internet Lore'],
    risk_level: 'low',
    refresh_cadence: 'manual',
    attribution_rules:
      'Credit as "Tripod/Lycos archive (pre-2010) via Wayback Machine". Note original site title if visible.',
    enabled: false,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-029',
    name: 'Wayback — AboveTopSecret Archive',
    source_type: 'wayback',
    base_url: 'https://www.abovetopsecret.com/',
    description:
      'AboveTopSecret forum threads from 2001–2012 before heavy moderation and content removal. Early UAP/disclosure speculation, government whistleblower claims, and first-generation conspiracy deep-dives that influenced later internet culture.',
    category_focus: ['UFOs', 'Conspiracy Theory', 'Whistleblower Files', 'Hidden History'],
    risk_level: 'medium',
    refresh_cadence: 'manual',
    attribution_rules:
      'Credit as "AboveTopSecret archive via Wayback Machine · [year]". Note poster handle and original thread date.',
    enabled: false,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-030',
    name: 'Wayback — Rense.com Archive',
    source_type: 'wayback',
    base_url: 'https://www.rense.com/',
    description:
      'Rense.com was one of the largest early alternative news aggregators (active since 1997), publishing UFO reports, suppressed science, government conspiracies, and anomalous phenomena. Pre-2010 captures document early internet paranoia culture.',
    category_focus: ['UFOs', 'Conspiracy Theory', 'Shadow Systems', 'Paranormal', 'Forbidden Tech'],
    risk_level: 'medium',
    refresh_cadence: 'manual',
    attribution_rules:
      'Credit as "Rense.com archive via Wayback Machine · [year]". Treat claims as internet artifact — do not endorse. Note original publication date.',
    enabled: false,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-031',
    name: 'Wayback — Bibliotecapleyades Archive',
    source_type: 'wayback',
    base_url: 'https://www.bibliotecapleyades.net/',
    description:
      'Spanish-origin alternative knowledge archive founded in 2000 — one of the most comprehensive collections of pre-social-media UFO, ancient history, and consciousness research articles. Extensively archived via Wayback.',
    category_focus: ['UFOs', 'Hidden History', 'Consciousness', 'Paranormal', 'Occult Archives'],
    risk_level: 'low',
    refresh_cadence: 'manual',
    attribution_rules:
      'Credit as "Bibliotecapleyades archive via Wayback Machine". Treat as research artifact. Cite original article title and author if visible.',
    enabled: false,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-032',
    name: 'Wayback — Paranormal About.com Archive',
    source_type: 'wayback',
    base_url: 'https://paranormal.about.com/',
    description:
      'About.com\'s paranormal section was one of the web\'s most-visited paranormal reference hubs from the late 1990s through 2010. Covered ghosts, UFOs, cryptids, and unexplained phenomena with a mainstream editorial voice. Largely deleted in 2017.',
    category_focus: ['Paranormal', 'UFOs', 'Weird Encounters', 'Internet Lore'],
    risk_level: 'low',
    refresh_cadence: 'manual',
    attribution_rules:
      'Credit as "About.com Paranormal archive via Wayback Machine". Note article title, author, and approximate year.',
    enabled: false,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-033',
    name: 'Wayback — Unexplained Mysteries Archive',
    source_type: 'wayback',
    base_url: 'https://www.unexplained-mysteries.com/',
    description:
      'Unexplained-Mysteries.com (est. 2001) was a major community hub for paranormal news, forum discussions, and case documentation. Pre-2010 forum threads capture early internet mystery discourse before Reddit dominated the space.',
    category_focus: ['Paranormal', 'UFOs', 'Internet Mysteries', 'Hidden History'],
    risk_level: 'low',
    refresh_cadence: 'manual',
    attribution_rules:
      'Credit as "Unexplained-Mysteries.com archive via Wayback Machine · [year]". Note original poster handle and thread date if visible.',
    enabled: false,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-034',
    name: 'Textfiles.com — BBS Archives',
    source_type: 'bbs',
    base_url: 'https://www.textfiles.com/',
    description:
      'Jason Scott\'s textfiles.com preserves thousands of 1980s–1990s BBS text files: early UFO reports, pre-internet conspiracy theories, occult texts, encounter narratives, and hacker culture artifacts. Pure raw signal from before the web. Content is anonymous by design.',
    category_focus: ['UFOs', 'Paranormal', 'Conspiracy Theory', 'Occult Archives', 'Hidden History', 'Internet Lore'],
    risk_level: 'low',
    refresh_cadence: 'manual',
    attribution_rules:
      'Credit textfiles.com with BBS category path and filename. Note approximate decade. Authors are almost universally anonymous — do not fabricate attribution.',
    enabled: false,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  // ── Phase V: Deep Origin Sources ────────────────────────────────────────
  {
    id: 'src-035',
    name: 'Crystalinks',
    source_type: 'archive',
    base_url: 'https://www.crystalinks.com/',
    description:
      'Ellie Crystal\'s Crystalinks (est. 1995) is one of the oldest continuously-running metaphysics and alternative history archives on the web. Covers ancient astronauts, sacred geometry, consciousness, paranormal phenomena, and interdimensional theory with an encyclopedic depth unusual for the 1990s web.',
    category_focus: ['Ancient History', 'Consciousness', 'UFOs', 'Occult Archives', 'Hidden History'],
    risk_level: 'low',
    refresh_cadence: 'manual',
    attribution_rules:
      'Credit "Crystalinks.com" with article title and URL. Note original publication year when visible. Content is personal research — treat as internet artifact.',
    enabled: false,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-036',
    name: 'The Black Vault',
    source_type: 'archive',
    base_url: 'https://www.theblackvault.com/',
    description:
      'John Greenewald Jr.\'s Black Vault (est. 1996) hosts tens of thousands of government FOIA documents on UFOs, classified programs, and black projects — including declassified CIA, NSA, DIA, and DoD files. One of the most comprehensive public repositories of government UFO documentation.',
    category_focus: ['UFOs', 'Government', 'Whistleblower Files', 'Shadow Systems', 'Conspiracy Theory'],
    risk_level: 'low',
    refresh_cadence: 'weekly',
    attribution_rules:
      'Credit "The Black Vault" with document title and FOIA case number if available. Link to specific document page. Note the releasing agency and date of declassification.',
    enabled: false,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-037',
    name: 'NICAP.org — UAP Case Files',
    source_type: 'archive',
    base_url: 'https://www.nicap.org/',
    description:
      'NICAP (National Investigations Committee on Aerial Phenomena, est. 1956) documented hundreds of UAP cases through the Cold War era. The nicap.org archive preserves pre-disclosure UAP case files, witness testimonies, and analysis from the 1950s–1970s — a primary source for historical UAP research.',
    category_focus: ['UFOs', 'Hidden History', 'Government', 'Whistleblower Files'],
    risk_level: 'low',
    refresh_cadence: 'manual',
    attribution_rules:
      'Credit "NICAP.org Case Files" with case ID and date. Treat as historical primary source — note the era (Cold War UAP documentation).',
    enabled: false,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-038',
    name: 'Internet Archive — UFO/Paranormal Text Collections',
    source_type: 'archive',
    base_url: 'https://archive.org/search?query=ufo+paranormal&mediatype=texts',
    description:
      'Internet Archive hosts thousands of digitized UFO, paranormal, and conspiracy research texts — including out-of-print books, self-published research, government hearings transcripts, and rare zines from the 1950s through 2000s. Free full-text search across public domain and openly licensed material.',
    category_focus: ['UFOs', 'Paranormal', 'Conspiracy Theory', 'Hidden History', 'Occult Archives'],
    risk_level: 'low',
    refresh_cadence: 'weekly',
    attribution_rules:
      'Credit "Internet Archive" with item title, author, and publication year. Note original publisher and archive upload date. Link to archive.org item page.',
    enabled: false,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-039',
    name: 'Wayback — FortuneCity Archive',
    source_type: 'wayback',
    base_url: 'https://www.fortunecity.com/',
    description:
      'FortuneCity was a major free web host from 1997–2008 with substantial paranormal, UFO, and conspiracy content from the early internet era. Distinct from GeoCities — FortuneCity had a more international user base and different community norms. Almost entirely gone now. Wayback CDX will recover pre-2008 captures.',
    category_focus: ['Paranormal', 'UFOs', 'Internet Lore', 'Conspiracy Theory'],
    risk_level: 'low',
    refresh_cadence: 'manual',
    attribution_rules:
      'Credit as "FortuneCity archive (pre-2008) via Wayback Machine". Note original page owner handle or site name if visible.',
    enabled: false,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-040',
    name: 'Wayback — Project Camelot Archive',
    source_type: 'wayback',
    base_url: 'https://projectcamelot.org/',
    description:
      'Project Camelot (est. 2006) conducted video interviews with whistleblowers, insiders, and researchers on classified programs, UFO cover-ups, and black projects. Pre-2012 Wayback captures document the early interview archive before the site evolved. Treat as archived claim — claims are unverified.',
    category_focus: ['UFOs', 'Whistleblower Files', 'Shadow Systems', 'Conspiracy Theory'],
    risk_level: 'medium',
    refresh_cadence: 'manual',
    attribution_rules:
      'Credit as "Project Camelot archive via Wayback Machine · [year]". Note: all claims are unverified and should be framed as archived whistleblower testimony — not established fact.',
    enabled: false,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-041',
    name: 'Wayback — Project Avalon Archive',
    source_type: 'wayback',
    base_url: 'https://projectavalon.net/',
    description:
      'Project Avalon (est. 2009, spin-off from Project Camelot) hosted whistleblower interviews and a large community forum discussing classified programs, exopolitics, and financial systems. The pre-2013 forum archive contains early crowdsourced investigation threads. Claims are unverified.',
    category_focus: ['UFOs', 'Whistleblower Files', 'Conspiracy Theory', 'Shadow Systems'],
    risk_level: 'medium',
    refresh_cadence: 'manual',
    attribution_rules:
      'Credit as "Project Avalon archive via Wayback Machine · [year]". Frame as internet artifact / archived claim. Verify before treating as factual.',
    enabled: false,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-042',
    name: 'Wayback — Nexus Magazine Archive',
    source_type: 'wayback',
    base_url: 'https://www.nexusmagazine.com/',
    description:
      'Nexus Magazine (est. 1987, Australian) covers suppressed science, alternative health, UFOs, and conspiracy research — one of the longest-running independent alt-research publications. Pre-2010 Wayback captures include article indexes from the 1990s print era that were digitized online.',
    category_focus: ['UFOs', 'Forbidden Tech', 'Conspiracy Theory', 'Hidden History', 'Paranormal'],
    risk_level: 'medium',
    refresh_cadence: 'manual',
    attribution_rules:
      'Credit as "Nexus Magazine archive via Wayback Machine · [year]". Note volume/issue number if visible. Treat claims as archived research artifact.',
    enabled: false,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-043',
    name: 'Wayback — Earthfiles.com Archive',
    source_type: 'wayback',
    base_url: 'https://www.earthfiles.com/',
    description:
      'Linda Moulton Howe\'s Earthfiles.com (est. 1999) covered UAPs, animal mutilations, crop circles, and anomalous environmental phenomena with journalist rigor. Pre-2010 reports document field investigations and witness interviews before much of the archive moved behind a paywall.',
    category_focus: ['UFOs', 'Paranormal', 'Weird Encounters', 'Hidden History'],
    risk_level: 'low',
    refresh_cadence: 'manual',
    attribution_rules:
      'Credit as "Earthfiles.com archive via Wayback Machine · [year]". Credit Linda Moulton Howe as author/investigator. Note original report date.',
    enabled: false,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-044',
    name: 'Wayback — CUFON Computer UFO Network',
    source_type: 'wayback',
    base_url: 'https://www.cufon.org/',
    description:
      'CUFON (Computer UFO Network, est. 1988) was one of the first computer-based UFO research networks — predating the web. The cufon.org site archived declassified documents, case files, and early computer network UFO bulletins from the late 1980s through 1990s. Rare pre-web digital UFO research.',
    category_focus: ['UFOs', 'Government', 'Hidden History', 'Internet Lore'],
    risk_level: 'low',
    refresh_cadence: 'manual',
    attribution_rules:
      'Credit as "CUFON archive via Wayback Machine · [year]". Note document type (government file, case report, BBS bulletin). Era: 1988–late 1990s digital UFO research.',
    enabled: false,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-045',
    name: 'Wayback — UFO Updates Mailing List',
    source_type: 'wayback',
    base_url: 'https://www.virtuallystrange.net/ufo/updates/',
    description:
      'UFO UpDates was the premier email discussion list for serious UFO researchers from 1996–2010, moderated by Errol Bruce-Knapp. The Virtuallystrange.net archive preserves thousands of researcher exchanges with Stanton Friedman, Bruce Maccabee, Nick Pope, and others — a primary source for 1990s UFO discourse.',
    category_focus: ['UFOs', 'Hidden History', 'Whistleblower Files', 'Internet Lore'],
    risk_level: 'low',
    refresh_cadence: 'manual',
    attribution_rules:
      'Credit as "UFO UpDates mailing list archive via Wayback Machine · [year]". Credit researcher name and original post date when visible.',
    enabled: false,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-046',
    name: 'Wayback — EZBoard Paranormal Forums',
    source_type: 'wayback',
    base_url: 'https://pub.ezboard.com/',
    description:
      'EZBoard (later Yuku) hosted thousands of independent paranormal, UFO, and conspiracy forums through the late 1990s and 2000s — many have been deleted. Wayback CDX captures pre-2010 forum threads with community discussion of phenomena that predate Reddit. High signal density for origin-era internet discourse.',
    category_focus: ['Paranormal', 'UFOs', 'Conspiracy Theory', 'Internet Lore', 'Weird Encounters'],
    risk_level: 'medium',
    refresh_cadence: 'manual',
    attribution_rules:
      'Credit as "EZBoard forum archive via Wayback Machine · [year]". Note forum name and thread title. Authors are typically pseudonymous handles.',
    enabled: false,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-047',
    name: 'Wayback — ParaScope Archive',
    source_type: 'wayback',
    base_url: 'https://www.parascope.com/',
    description:
      'ParaScope (est. 1995) was one of the earliest web-based UFO and conspiracy research hubs — active during the X-Files cultural moment. It hosted original investigations, government document analyses, and community features before disappearing in the early 2000s. Rare window into 1990s web conspiracy culture.',
    category_focus: ['UFOs', 'Conspiracy Theory', 'Internet Lore', 'Hidden History'],
    risk_level: 'low',
    refresh_cadence: 'manual',
    attribution_rules:
      'Credit as "ParaScope archive via Wayback Machine · [year]". Era: 1995–2002 early web UFO research. Authors are named in original articles where visible.',
    enabled: false,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-048',
    name: 'Wayback — The Anomalist Archive',
    source_type: 'wayback',
    base_url: 'https://www.anomalist.com/',
    description:
      'The Anomalist (est. 1995) is a daily newsfeed covering Fortean topics — UAPs, cryptids, anomalous phenomena, and fringe science — with a scholarly skeptical lens. Pre-2010 Wayback captures preserve years of linked article archives that catalogued anomaly research before modern aggregators.',
    category_focus: ['Paranormal', 'UFOs', 'Weird Encounters', 'Internet Lore'],
    risk_level: 'low',
    refresh_cadence: 'manual',
    attribution_rules:
      'Credit as "The Anomalist archive via Wayback Machine · [year]". Note original linked source and date.',
    enabled: false,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-049',
    name: 'Wayback — ForteanTimes.com Archive',
    source_type: 'wayback',
    base_url: 'https://www.forteantimes.com/',
    description:
      'Fortean Times (UK, est. 1973 in print, online since 1997) documents strange phenomena, anomalous events, and Fortean curiosities — the academic journal of the weird. Pre-2012 web archive captures contain case files, investigative articles, and research by serious anomaly researchers.',
    category_focus: ['Paranormal', 'UFOs', 'Weird Encounters', 'Hidden History', 'Internet Lore'],
    risk_level: 'low',
    refresh_cadence: 'manual',
    attribution_rules:
      'Credit as "Fortean Times archive via Wayback Machine · [year]". Note article title and author. Era: 1997–2012 web archive of UK anomaly journalism.',
    enabled: false,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-050',
    name: 'Wayback — Stanton Friedman Archives',
    source_type: 'wayback',
    base_url: 'https://www.stantonfriedman.com/',
    description:
      'Nuclear physicist and UFO researcher Stanton Friedman\'s personal website (1990s–2019) hosted declassified documents, research papers, and case analyses — particularly on Roswell and Majestic-12. Friedman died in 2019; his archive is one of the most credentialed primary-source UFO research collections online.',
    category_focus: ['UFOs', 'Whistleblower Files', 'Government', 'Hidden History'],
    risk_level: 'low',
    refresh_cadence: 'manual',
    attribution_rules:
      'Credit as "Stanton Friedman archive via Wayback Machine · [year]". Credit Stanton T. Friedman as author/researcher. Note document type.',
    enabled: false,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-051',
    name: 'Wayback — MUFON.com Archive',
    source_type: 'wayback',
    base_url: 'https://www.mufon.com/',
    description:
      'MUFON (Mutual UFO Network, est. 1969) is one of the oldest civilian UAP investigation organizations. Pre-2010 web archive captures preserve case investigation reports, field investigator analyses, and MUFON Journal content from before the organization\'s modern database migration.',
    category_focus: ['UFOs', 'Paranormal', 'Whistleblower Files', 'Hidden History'],
    risk_level: 'low',
    refresh_cadence: 'manual',
    attribution_rules:
      'Credit as "MUFON archive via Wayback Machine · [year]". Note case number, investigator, and incident date where available.',
    enabled: false,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-052',
    name: 'Wayback — alt.ufo / alt.paranormal Usenet Mirror',
    source_type: 'wayback',
    base_url: 'https://groups.google.com/g/alt.ufo/',
    description:
      'Google Groups preserves Usenet newsgroup archives including alt.ufo, alt.paranormal, alt.alien.visitors, and alt.conspiracy from the early 1990s. These newsgroups predate the web and contain the earliest internet-native discussion of UFOs and paranormal phenomena. Wayback captures recover deleted threads.',
    category_focus: ['UFOs', 'Paranormal', 'Conspiracy Theory', 'Internet Lore', 'Hidden History'],
    risk_level: 'low',
    refresh_cadence: 'manual',
    attribution_rules:
      'Credit as "Usenet archive via Google Groups · [newsgroup] · [year]". Note poster handle and date. Authors are typically pseudonymous.',
    enabled: false,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-053',
    name: 'Wayback — Coast to Coast AM Early Archive',
    source_type: 'wayback',
    base_url: 'https://www.coasttocoastam.com/',
    description:
      'Coast to Coast AM (est. 1984 with Art Bell) is the premier overnight radio show for paranormal, UFO, and conspiracy discussions. Pre-2010 web archive captures document show summaries, guest transcripts, and Art Bell-era interviews that are no longer accessible on the current site.',
    category_focus: ['Paranormal', 'UFOs', 'Conspiracy Theory', 'Weird Encounters'],
    risk_level: 'low',
    refresh_cadence: 'manual',
    attribution_rules:
      'Credit as "Coast to Coast AM archive via Wayback Machine · [year]". Note host (Art Bell / George Noory) and guest name. Era: 1998–2010 web archive.',
    enabled: false,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  {
    id: 'src-054',
    name: 'Wayback — NUFORC Early Reports',
    source_type: 'wayback',
    base_url: 'https://www.nuforc.org/',
    description:
      'NUFORC (National UFO Reporting Center, est. 1974) maintains one of the oldest databases of civilian UAP sighting reports in the US. Pre-2005 Wayback captures preserve original report formats and early database structures before multiple site migrations that obscured early data.',
    category_focus: ['UFOs', 'Paranormal', 'Hidden History'],
    risk_level: 'low',
    refresh_cadence: 'manual',
    attribution_rules:
      'Credit as "NUFORC sighting report via Wayback Machine · [year]". Note report date, location, and report ID if visible.',
    enabled: false,
    last_scanned_at: null,
    created_at: '2024-01-01T00:00:00Z',
  },
  // ── Legacy / high-risk sources ──────────────────────────────────────────
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
