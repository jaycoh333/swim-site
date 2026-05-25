/**
 * Mock recovered signals — used as fallback when NEXT_PUBLIC_SUPABASE_URL
 * is absent (local dev without env vars).
 *
 * In production, real rows come from the recovered_signals Supabase table.
 * Status='approved' rows appear on the public /scanner page.
 * Status='pending' rows appear in /scanner/queue for curator review.
 *
 * SCRAPER INTEGRATION POINT:
 *   Future automated scrapers will insert rows here with status='pending'.
 *   Human approval is mandatory before any signal becomes public.
 */

import type { DbRecoveredSignal } from '@/lib/supabase/types';

export const RECOVERED_SIGNAL_SEED: DbRecoveredSignal[] = [
  {
    id: 'sig-0847',
    created_at: '2024-11-14T03:22:00Z',
    category: 'Paranormal',
    title: 'Deleted Reddit thread: three weeks of attic recordings before post removal',
    summary:
      'User claimed to have recorded something moving in their attic on a loop-recording device for three weeks. Post removed within 6 hours of submission. 47 comments captured before deletion, including two from users who described hearing the same sound independently. Moderator intervention logged in the subreddit mod log as "precautionary removal."',
    source_name: 'Reddit (r/Paranormal, deleted)',
    source_url: null,
    source_type: 'reddit',
    status: 'pending',
    anomaly_score: 7,
    tags: ['audio', 'deletion', 'moderator action', 'independent confirmation'],
    discovered_at: '2024-11-14T02:41:00Z',
    approved_at: null,
    published_thread_id: null,
  },
  {
    id: 'sig-0831',
    created_at: '2024-10-28T01:05:00Z',
    category: 'Simulation Theory',
    title: '"What I found in the gaps between frames" — anonymous 4,000-word document',
    summary:
      'A 4,000-word document posted anonymously to Pastebin titled "what I found in the gaps between frames." The author describes a method for identifying discontinuities in continuous video recordings that cannot be explained by compression artifacts. IP metadata from the paste traces to a residential address in Oslo that no longer appears in any public property registry. The document was accessed 1,847 times before expiring.',
    source_name: 'Pastebin (expired)',
    source_url: null,
    source_type: 'pastebin',
    status: 'approved',
    anomaly_score: 8,
    tags: ['document', 'video analysis', 'discontinuity', 'address anomaly'],
    discovered_at: '2024-10-27T23:14:00Z',
    approved_at: '2024-10-29T11:30:00Z',
    published_thread_id: null,
  },
  {
    id: 'sig-0819',
    created_at: '2024-09-03T04:17:00Z',
    category: 'Lost Media',
    title: '1998 GeoCities mirror documenting a regional broadcast anomaly confirmed by 47 viewers',
    summary:
      'A GeoCities page archived by Wayback Machine in 1998 documents what appears to be an unscheduled broadcast interruption on a regional affiliate in the Pacific Northwest. Forty-seven people reported the same interruption in a guestbook thread over three days. The interruption lasted approximately four minutes and showed a blank field with a tone. The station\'s public records deny any technical incident on that date. The date does not appear in the FCC interruption log for that market.',
    source_name: 'Wayback Machine / GeoCities archive',
    source_url: 'https://web.archive.org',
    source_type: 'wayback',
    status: 'archived',
    anomaly_score: 6,
    tags: ['broadcast', 'regional', 'FCC', 'collective memory', '1998'],
    discovered_at: '2024-09-02T21:09:00Z',
    approved_at: '2024-09-05T09:00:00Z',
    published_thread_id: null,
  },
  {
    id: 'sig-0802',
    created_at: '2024-08-17T02:44:00Z',
    category: 'Dreams',
    title: '/x/ thread: 14 users independently described a room they had never physically visited',
    summary:
      'An archived 4chan /x/ thread in which 14 users over 72 hours independently described the same room in detail — tiled floor, single hanging bulb, a door that opened inward and had no handle on the inside. None of the users communicated outside the thread. The thread was deleted by board moderators without explanation. Screenshots survived on a now-defunct image host; 3 copies recovered from archive.org crawl fragments.',
    source_name: '4chan /x/ archive',
    source_url: null,
    source_type: 'imageboard',
    status: 'archived',
    anomaly_score: 9,
    tags: ['shared dream', 'collective description', 'deletion', 'room'],
    discovered_at: '2024-08-16T20:17:00Z',
    approved_at: '2024-08-19T13:45:00Z',
    published_thread_id: null,
  },
  {
    id: 'sig-0788',
    created_at: '2024-12-01T00:33:00Z',
    category: 'Hidden History',
    title: 'phpBB thread: urban explorers found administrative records inside a building demolished in 2019',
    summary:
      'A private phpBB forum thread from a community of urban explorers describes finding a room inside a government building scheduled for demolition that contained administrative records dated between 1941 and 1958. The records reference a facility by a name that does not appear in any public archives for that region. Photographs were attached to the post but were not captured before the forum went offline in 2021. Location is not disclosed in the recovered text.',
    source_name: 'phpBB backup (offline)',
    source_url: null,
    source_type: 'forum',
    status: 'pending',
    anomaly_score: 7,
    tags: ['urban exploration', 'records', 'demolition', 'unregistered facility'],
    discovered_at: '2024-11-29T22:50:00Z',
    approved_at: null,
    published_thread_id: null,
  },
  {
    id: 'sig-0774',
    created_at: '2024-11-22T03:11:00Z',
    category: 'AI',
    title: 'IRC log: early GPT-2 fine-tune began outputting geographic coordinates unprompted',
    summary:
      'Conversation fragment from a 2019 IRC channel (#ml-experiments on freenode). A user shared logs from a GPT-2 fine-tune trained on an undisclosed corpus. The model began producing geographic coordinates in the middle of otherwise normal text generation without any coordinate-related prompt. All coordinates were verified: they lead to the same empty field in rural Nebraska. The fine-tune weights were never publicly released. The user\'s account was deleted within 48 hours of the post.',
    source_name: 'IRC log (freenode archive)',
    source_url: null,
    source_type: 'irc',
    status: 'approved',
    anomaly_score: 8,
    tags: ['GPT-2', 'coordinates', 'fine-tune', 'deletion'],
    discovered_at: '2024-11-21T01:44:00Z',
    approved_at: '2024-11-23T10:15:00Z',
    published_thread_id: null,
  },
  {
    id: 'sig-0761',
    created_at: '2025-01-08T05:02:00Z',
    category: 'UFOs',
    title: 'Expired forum thread: lights over reservoir with independent witness from across the lake',
    summary:
      'Thread from a regional outdoor recreation forum (now expired domain) in which the OP described three lights over a reservoir that stopped moving simultaneously. A second user — posting from a different username and appearing to have no prior interaction with the OP — described the same lights from a location on the opposite side of the reservoir. The two descriptions align on timing, light configuration, and the fact that the water surface did not reflect the lights. Thread was not deleted — the forum simply stopped being maintained and the domain expired.',
    source_name: 'Outdoor recreation forum (expired domain)',
    source_url: null,
    source_type: 'forum',
    status: 'pending',
    anomaly_score: 6,
    tags: ['reservoir', 'independent witness', 'lights', 'reflection anomaly'],
    discovered_at: '2025-01-07T21:30:00Z',
    approved_at: null,
    published_thread_id: null,
  },
  {
    id: 'sig-0748',
    created_at: '2024-07-19T02:08:00Z',
    category: 'Occult Archives',
    title: 'Photocopied zine with partial ritual notation — provenance unclear',
    summary:
      'A scan of photocopied zine pages posted to a now-defunct Tumblr. The zine contains notation that superficially resembles ritual instruction but the language and symbol set do not match any known tradition in the literature. Quality is poor and significant portions are illegible. No provenance information. Anomaly score is low: content may simply be an artistic project.',
    source_name: 'Tumblr (deactivated)',
    source_url: null,
    source_type: 'other',
    status: 'rejected',
    anomaly_score: 3,
    tags: ['zine', 'notation', 'unclear provenance'],
    discovered_at: '2024-07-18T19:55:00Z',
    approved_at: null,
    published_thread_id: null,
  },
  {
    id: 'sig-0735',
    created_at: '2025-02-14T04:29:00Z',
    category: 'Psyops',
    title: 'Archived broadcast segment: no footage exists for a transmission remembered by multiple viewers',
    summary:
      'A Wayback Machine crawl of a regional TV station\'s website from 2003 includes a schedule entry for a 3AM public affairs segment that was never broadcast according to the station\'s official log. Five people across two separate Reddit threads in 2019 and 2021 independently described seeing this segment — a black screen with a single male voice reading a list of first names, no music, no graphics, approximately four minutes long. The station\'s complete broadcast archive for that week is on file with the FCC but the relevant date is listed as "tape unavailable."',
    source_name: 'Wayback Machine + Reddit threads',
    source_url: 'https://web.archive.org',
    source_type: 'wayback',
    status: 'pending',
    anomaly_score: 9,
    tags: ['broadcast', 'PSA', 'missing tape', 'FCC', 'independent witnesses'],
    discovered_at: '2025-02-13T22:15:00Z',
    approved_at: null,
    published_thread_id: null,
  },
  {
    id: 'sig-0722',
    created_at: '2025-03-01T01:47:00Z',
    category: 'Surveillance State',
    title: 'Transit authority camera map shows coverage pattern inconsistent with published installation records',
    summary:
      'A user on a privacy-focused forum posted a comparison of two publicly available documents: the transit authority\'s published camera installation record (obtained via records request) and a map reconstructed from shadow positions and visible equipment in publicly available transit photographs. The two documents do not agree on camera placement in eleven locations. Seven of the discrepancies are in the same three-block radius. The forum post was removed; the user\'s account was banned for "posting internal infrastructure details" despite both source documents being public records.',
    source_name: 'Privacy forum (post removed)',
    source_url: null,
    source_type: 'forum',
    status: 'approved',
    anomaly_score: 7,
    tags: ['transit', 'camera map', 'public records', 'discrepancy', 'removal'],
    discovered_at: '2025-02-28T20:11:00Z',
    approved_at: '2025-03-02T09:00:00Z',
    published_thread_id: null,
  },
];
