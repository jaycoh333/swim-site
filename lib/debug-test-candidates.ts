/**
 * Static debug candidates for pipeline testing.
 *
 * Used by the "Debug Test Feed" scan preset.
 * These are clearly labeled mock entries — not real recovered signals.
 * Curator can queue/review/publish them to verify the full pipeline,
 * but should discard them rather than keeping them in the public archive.
 *
 * Do NOT auto-publish. Curator review required as always.
 */

import type { FetchedCandidate } from '@/lib/scanner-fetch-types';

export const DEBUG_TEST_CANDIDATES: FetchedCandidate[] = [
  {
    title:                '[DEBUG] The Night the Power Grid Failed in Three Towns Simultaneously',
    summary:
      'A retired electrical engineer describes watching three separate municipal grids fail within 90 seconds of each other in 1987. No fault was ever logged. His maintenance logs were confiscated the following Monday. He kept a photocopy. This is that photocopy, transcribed.',
    sourceUrl:            'https://debug-test.internal/signals/001',
    category:             'Paranormal',
    tags:                 ['debug', 'test', 'scanner-source', 'do-not-publish'],
    anomalyScore:         5,
    categoryNote:         'Paranormal (debug test entry)',
    extractionConfidence: 'high',
    sourceType:           'reddit',
    isArchived:           false,
    passReason:           'debug test candidate',
    attributionText:      '[DEBUG TEST SOURCE] — discard after testing',
    captureNotes:         'This is a static debug entry for pipeline testing. Not a real recovered signal.',
    redditSubreddit:      'HighStrangeness',
    redditAuthor:         'debug_curator',
    redditScore:          847,
    redditComments:       203,
    redditPostedAt:       '2024-11-15',
    storyScore:           72,
    storySignals:         ['eyewitness', 'corroborated', 'unresolved'],
    finalPriorityScore:   78,
  },
  {
    title:                '[DEBUG] Found: 11-Second Audio Fragment From 1992 AM Broadcast — No Match in Any Database',
    summary:
      'While digitizing a collection of radio recordings purchased at an estate sale, a hobbyist found an 11-second clip that does not match any known broadcast format, frequency, or language. The waveform analysis shows it was transmitted — not synthesized. The estate belonged to a former FCC inspector.',
    sourceUrl:            'https://debug-test.internal/signals/002',
    category:             'Lost Media',
    tags:                 ['debug', 'test', 'scanner-source', 'do-not-publish'],
    anomalyScore:         5,
    categoryNote:         'Lost Media (debug test entry)',
    extractionConfidence: 'high',
    sourceType:           'mediawiki',
    isArchived:           false,
    passReason:           'debug test candidate',
    attributionText:      '[DEBUG TEST SOURCE] — discard after testing',
    captureNotes:         'This is a static debug entry for pipeline testing. Not a real recovered signal.',
    storyScore:           68,
    storySignals:         ['unresolved', 'timeline anomaly'],
    finalPriorityScore:   74,
  },
  {
    title:                '[DEBUG] Glitch: I Returned a Library Book That Had Already Been Returned',
    summary:
      'I checked out a specific edition of a book in October. I returned it in December. The librarian thanked me and noted it in the system. Two weeks later I received an overdue notice — for the same book. When I called, the librarian said it had been returned in October, three months before I borrowed it. The circulation record shows two return events, two months apart, with the same patron ID.',
    sourceUrl:            'https://debug-test.internal/signals/003',
    category:             'Paranormal',
    tags:                 ['debug', 'test', 'scanner-source', 'do-not-publish'],
    anomalyScore:         5,
    categoryNote:         'Paranormal / Simulation Theory (debug test entry)',
    extractionConfidence: 'high',
    sourceType:           'reddit',
    isArchived:           false,
    passReason:           'debug test candidate',
    attributionText:      '[DEBUG TEST SOURCE] — discard after testing',
    captureNotes:         'This is a static debug entry for pipeline testing. Not a real recovered signal.',
    redditSubreddit:      'Glitch_in_the_Matrix',
    redditAuthor:         'debug_curator',
    redditScore:          2341,
    redditComments:       489,
    redditPostedAt:       '2024-09-03',
    storyScore:           61,
    storySignals:         ['eyewitness', 'timeline anomaly', 'anomaly phrase'],
    finalPriorityScore:   67,
    corroborationScore:   14,
    corroborationNotes:   ['first-person witness', '"same thing happened to me"'],
  },
  {
    title:                '[DEBUG] The Pilot Episode of "Anchor Station" Was Never Aired — But Audience Reviews Exist From 1981',
    summary:
      'TV Guide printed a full-page listing for the pilot of "Anchor Station" on March 4, 1981. Audience response cards were collected by a focus group company. The pilot was never broadcast. The production company has no record of a focus group screening. The audience response cards were found in a storage unit in 2019.',
    sourceUrl:            'https://debug-test.internal/signals/004',
    category:             'Lost Media',
    tags:                 ['debug', 'test', 'scanner-source', 'do-not-publish'],
    anomalyScore:         5,
    categoryNote:         'Lost Media / Internet Mysteries (debug test entry)',
    extractionConfidence: 'high',
    sourceType:           'mediawiki',
    isArchived:           true,
    archivedAt:           '2019-11-07',
    passReason:           'debug test candidate',
    attributionText:      '[DEBUG TEST SOURCE] — discard after testing',
    captureNotes:         'This is a static debug entry for pipeline testing. Not a real recovered signal.',
    storyScore:           65,
    storySignals:         ['unresolved', 'corroborated'],
    finalPriorityScore:   73,
  },
  {
    title:                '[DEBUG] My Grandfather\'s House Was Demolished in 1998. Utility Bills for It Still Arrive.',
    summary:
      'A utility bill addressed to a specific civic address began arriving in 2001 — three years after the house at that address was demolished and a car park built in its place. The billing account is active. The meter reads a small but non-zero consumption each month. The utility company says the account is valid and the meter is transmitting live data. The address no longer exists in any postal database.',
    sourceUrl:            'https://debug-test.internal/signals/005',
    category:             'Paranormal',
    tags:                 ['debug', 'test', 'scanner-source', 'do-not-publish'],
    anomalyScore:         5,
    categoryNote:         'Paranormal (debug test entry)',
    extractionConfidence: 'high',
    sourceType:           'forum',
    isArchived:           false,
    passReason:           'debug test candidate',
    attributionText:      '[DEBUG TEST SOURCE] — discard after testing',
    captureNotes:         'This is a static debug entry for pipeline testing. Not a real recovered signal.',
    storyScore:           58,
    storySignals:         ['unresolved', 'anomaly phrase'],
    finalPriorityScore:   63,
  },
];
