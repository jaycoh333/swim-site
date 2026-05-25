/**
 * manual-source-pack.ts
 *
 * First curated source pack — 10 signals drawn from the research targets
 * defined in docs/source-pack-erowid-and-old-forums.md.
 *
 * These entries are hand-written summaries in SWIM editorial voice.
 * They are NOT scraped or auto-generated.
 *
 * Use scripts/seed-source-pack.ts to push them into the database.
 * All signals seed as status='pending' for curator review.
 *
 * Rules applied to every entry:
 *   - Summary written in curator's own words
 *   - No full verbatim text from source
 *   - No personal information / no doxxing
 *   - No illegal instructions
 *   - submitted_publicly: false (curator-sourced, not crowd-sourced)
 */

import type { CreateRecoveredSignalInput } from '@/lib/supabase/repository';

export const SOURCE_PACK_01: CreateRecoveredSignalInput[] = [
  // ── Signal 01 ─────────────────────────────────────────────────────────────
  {
    title:
      'Recurring tower geometry across 14 unrelated Erowid-style submissions spanning 6 years',
    summary:
      'A comparison of fourteen submissions to an Erowid-style experience archive between 2003 and '
      + '2009 reveals that submitters — who have no apparent connection to one another and submitted '
      + 'under separate accounts years apart — describe the same structure: a narrow tower with an '
      + 'impossible interior, no visible ceiling, and a single window that faces inward rather than '
      + 'outward. Eleven of the fourteen submissions mention the interior window specifically. Nine '
      + 'note that the tower was not the focus of their account but appeared uninvited in the '
      + 'periphery of a longer experience. None of the submissions reference one another, and the '
      + "archive's records show no evidence that later submissions could have drawn on earlier ones.",
    category:    'Dreams',
    sourceName:  'Erowid Experience Vault style archive (mirror, archive.org)',
    sourceType:  'wayback',
    anomalyScore: 8,
    tags:        ['geometry', 'tower', 'recurrence', 'cross-report', 'interior window'],
    submittedPublicly: false,
  },

  // ── Signal 02 ─────────────────────────────────────────────────────────────
  {
    title:
      'AboveTopSecret thread: four posters independently described the same visual seam in a published photograph',
    summary:
      'An archived ATS thread from 2007 documents a discussion about a published news photograph '
      + 'from the early 1980s. The original poster described noticing what they called a "correction '
      + 'line" — a vertical seam suggesting the photo was composited from two separate captures. '
      + 'Before the OP described the seam specifically, three other commenters noted the same feature '
      + 'in the same location using different terminology: "the join," "where it doesn\'t quite '
      + 'match," and "the light is wrong on the left side." None had raised the detail before the '
      + 'thread was created. The thread is not accessible through normal ATS navigation; it survives '
      + 'only in a Wayback snapshot from 2008.',
    category:    'Simulation Theory',
    sourceName:  'AboveTopSecret (ATS) forum, Wayback Machine snapshot',
    sourceType:  'forum',
    anomalyScore: 7,
    tags:        ['photograph', 'visual seam', 'independent corroboration', 'ATS'],
    submittedPublicly: false,
  },

  // ── Signal 03 ─────────────────────────────────────────────────────────────
  {
    title:
      'phpBB urban exploration forum: three members reported identical acoustic anomaly at separate abandoned locations',
    summary:
      'A thread on a small phpBB board dedicated to urban exploration contains posts from three '
      + 'members who — at different times, in different cities, in different types of abandoned '
      + 'structures — described finding a room with the same unusual acoustic property: sounds made '
      + 'in the room returned from the wrong direction, as if the reflected sound originated outside '
      + "the room's walls. The first post is from 2008; the others from 2010 and 2013. The 2013 "
      + 'poster had not seen the earlier posts and noted they had searched for anyone else describing '
      + 'this effect and found nothing. A fourth member replied with a link to a now-dead resource '
      + 'suggesting the phenomenon had a name in acoustic engineering but provided no further '
      + 'information before the forum went offline.',
    category:    'Hidden History',
    sourceName:  'Urban exploration phpBB board (offline, community backup ZIP)',
    sourceType:  'forum',
    anomalyScore: 7,
    tags:        ['urban exploration', 'acoustics', 'consistent anomaly', 'separate locations'],
    submittedPublicly: false,
  },

  // ── Signal 04 ─────────────────────────────────────────────────────────────
  {
    title:
      'r/Glitch_in_the_Matrix: OP deleted account immediately after 22 replies confirmed the same impossible road',
    summary:
      'A 2014 post in r/Glitch_in_the_Matrix describes an OP who grew up driving a specific road '
      + 'in a rural area of the American Midwest and discovered as an adult that the road does not '
      + 'exist in any map, satellite image, or local government record, despite decades of clear '
      + 'consistent memory. Within 12 hours, 22 commenters had replied; eight described having an '
      + 'identical experience with roads in different states, and three of those eight provided '
      + "details matching the OP's description of the road's characteristics without being prompted. "
      + 'The OP deleted their account and the post simultaneously approximately 16 hours after '
      + 'posting. The thread was captured in the Pushshift archive before deletion.',
    category:    'Simulation Theory',
    sourceName:  'r/Glitch_in_the_Matrix (Pushshift archive)',
    sourceType:  'reddit',
    anomalyScore: 8,
    tags:        ['impossible geography', 'road', 'account deletion', 'corroboration', 'midwest'],
    submittedPublicly: false,
  },

  // ── Signal 05 ─────────────────────────────────────────────────────────────
  {
    title:
      "LostMediaWiki: regional children's program remembered by 9 independent witnesses, denied by production company",
    summary:
      'A LostMediaWiki entry documents a regional children\'s television program that aired on a '
      + 'local affiliate in the Pacific Northwest in the mid-1980s according to nine independent '
      + 'witnesses from at least three cities in the broadcast area. Witnesses describe consistent '
      + 'details: a host in a specific costume, a recurring segment involving a prop that transformed '
      + 'on camera, and a theme song with a distinctive chord progression. The production company '
      + 'listed in the descriptions has confirmed it produced regional programming for that affiliate '
      + 'during the period but states no record of this program exists in their archive. The FCC '
      + 'broadcast log for that market lists a 30-minute program in the relevant time slot with no '
      + 'title in the public record. Status: lost.',
    category:    'Lost Media',
    sourceName:  'LostMediaWiki article + r/LostMedia discussion thread',
    sourceType:  'forum',
    anomalyScore: 9,
    tags:        ["children's television", 'collective memory', 'official denial', 'regional broadcast', 'FCC'],
    submittedPublicly: false,
  },

  // ── Signal 06 ─────────────────────────────────────────────────────────────
  {
    title:
      'Erowid-style experience archive: 7 accounts describe the same blue-grey room across a 12-year span',
    summary:
      'A now-offline experience archive that collected unusual and liminal accounts from 1997 to '
      + '2009 contains seven entries in which a submitter describes — in the context of a longer '
      + 'account — a room with the same visual signature: low ceiling, blue-grey walls without '
      + 'visible seams, no windows, a single door that opens only inward, and a low-frequency sound '
      + 'described by all seven as felt rather than heard. The accounts span twelve years and were '
      + 'submitted under different usernames with no apparent connection. One submitter noted they '
      + 'had found another description of the same room on a different site (link now dead) and that '
      + "the other person's description matched in every detail. No cross-referencing is visible in "
      + "the archive's submission interface.",
    category:    'Dreams',
    sourceName:  'Non-Erowid experience archive (archive.org mirror, original domain offline)',
    sourceType:  'wayback',
    anomalyScore: 8,
    tags:        ['dream', 'room', 'recurrence', 'cross-report', 'twelve years', 'felt sound'],
    submittedPublicly: false,
  },

  // ── Signal 07 ─────────────────────────────────────────────────────────────
  {
    title:
      'IRC log: three operators on the same network independently documented coordinated service interruptions with no identified source',
    summary:
      'A preserved IRC log from 2001 shows three IRC server operators on the same network '
      + 'discussing a pattern of brief service interruptions occurring at the same time each night '
      + 'across different servers in different geographic locations. The interruptions were not '
      + 'caused by known maintenance and had persisted for approximately six weeks before the '
      + 'operators compared notes. One operator noted the pattern was regular enough to be scheduled '
      + 'rather than accidental. The log is preserved in an IRChelp.org archive. The network no '
      + 'longer exists and no official post-mortem of its shutdown addresses the interruptions.',
    category:    'Surveillance State',
    sourceName:  'IRChelp.org archive / community-preserved IRC logs',
    sourceType:  'irc',
    anomalyScore: 6,
    tags:        ['IRC', 'network interruption', 'scheduled anomaly', 'server operators', '2001'],
    submittedPublicly: false,
  },

  // ── Signal 08 ─────────────────────────────────────────────────────────────
  {
    title:
      'GeoCities guestbook: 11 unrelated visitors to the same rural location described an identical low-altitude light over three years',
    summary:
      'A GeoCities site operating as a semi-structured forum for visitors to a specific rural area '
      + 'in central Europe contains a guestbook with entries from 1999 to 2002. Eleven entries, from '
      + 'visitors who appear unconnected based on writing styles and apparent origins, describe seeing '
      + 'a light in the same field at the same approximate time of night — between 2 and 3 AM local. '
      + 'The descriptions agree on color (yellowish-white), behavior (stationary, then moving '
      + 'horizontally at low speed, then disappearing without fading), and altitude (below treeline). '
      + 'None of the entries reference any of the others. The site was last crawled by Wayback in '
      + '2004; the live domain no longer resolves.',
    category:    'Paranormal',
    sourceName:  'GeoCities guestbook archive (Wayback Machine)',
    sourceType:  'wayback',
    anomalyScore: 7,
    tags:        ['location-specific', 'light', 'guestbook', 'corroboration', 'central europe'],
    submittedPublicly: false,
  },

  // ── Signal 09 ─────────────────────────────────────────────────────────────
  {
    title:
      '1993 BBS textfile: anonymous firsthand account of unofficial signage in a government facility not on any floorplan',
    summary:
      'A 1993 textfile circulated on BBS paranormal and conspiracy file sections describes an '
      + 'anonymous firsthand account of working at a government-adjacent facility in the American '
      + 'Southwest during the 1980s. The account focuses on an unofficial internal signage system '
      + 'that did not correspond to the official floorplan — signs in corridors that referenced '
      + 'areas by designations not found in any public record of the facility. The author states '
      + 'that asking about the signs resulted in their removal before the next working day. The '
      + 'textfile has been archived across multiple BBS dump packages on archive.org. Authorship '
      + 'cannot be verified. Score is moderate: account is internally consistent and specific, '
      + 'but single-source.',
    category:    'Redacted Files',
    sourceName:  'textfiles.com / BBS paranormal file archive (archive.org)',
    sourceType:  'forum',
    anomalyScore: 6,
    tags:        ['BBS', 'government facility', 'unofficial signage', 'textfile', '1993'],
    submittedPublicly: false,
  },

  // ── Signal 10 ─────────────────────────────────────────────────────────────
  {
    title:
      'r/LostMedia 2012: cassette tape of unidentified radio broadcast read place names in a flat unhurried voice — discarded before digitization',
    summary:
      'A 2012 r/LostMedia post describes a user who found a cassette tape at an estate sale in the '
      + 'early 2000s. The tape contained an uninterrupted two-hour recording of a radio broadcast '
      + 'from a station the user could not identify by call letters, frequency, or broadcast style. '
      + 'The host spoke in a flat, unhurried cadence and read what appeared to be a list of place '
      + 'names, pausing between each. The user did not copy the tape before returning it to the '
      + 'box, which was not kept. Three commenters expressed familiarity with the described '
      + 'broadcast style but none could identify the source. Anomaly score is moderate: single '
      + 'witness, no physical evidence survives, but the specific description matches a pattern '
      + 'that recurs in other signals in this queue.',
    category:    'Lost Media',
    sourceName:  'r/LostMedia (archived thread, 2012)',
    sourceType:  'reddit',
    anomalyScore: 5,
    tags:        ['cassette', 'radio broadcast', 'place names', 'estate sale', 'single witness'],
    submittedPublicly: false,
  },
];
