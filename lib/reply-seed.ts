/**
 * Reply seed — 2–3 strong replies per thread.
 * Sparse by design: boards should feel open, not crowded.
 *
 * NOTE: Existing Supabase reply rows are unaffected by changes here.
 * This file only supplies mock data when NEXT_PUBLIC_SUPABASE_URL is absent.
 */

import { Reply } from '@/lib/forum-types';

const r = (
  echo: number,
  dive: number,
  ripple: number,
  witness: number,
  signal: number,
) => ({ echo, dive, ripple, witness, signal });

export const REPLY_SEED: Record<string, Reply[]> = {
  'th-001': [
    {
      id: 'th-001-r3',
      threadId: 'th-001',
      postNumber: 2,
      body: '> water stayed still the whole time\n\nthis is the part nobody talks about. local wind and surface movement should have continued. something was affecting local physics or it was very high altitude.',
      createdAt: '1 hour 40 min ago',
      authorHandle: 'SIGNAL_BLEED',
      authorMode: 'ghost',
      reactions: r(4, 1, 2, 3, 1),
    },
    {
      id: 'th-001-r7',
      threadId: 'th-001',
      postNumber: 3,
      body: '> frames posted\n\nlooked at stills three times. the light at the lower position has no reflection in the water even when the other two do. that is not a lens artifact.',
      createdAt: '31 min ago',
      authorHandle: 'FRAGMENT_08',
      authorMode: 'ghost',
      reactions: r(5, 2, 3, 4, 1),
    },
    {
      id: 'th-001-r8',
      threadId: 'th-001',
      postNumber: 4,
      body: 'northdrift here. the third light was the one that moved. not the two outer ones. and the third stopped at exactly the waterline. not above it. exactly at it.',
      createdAt: '18 min ago',
      authorHandle: 'northdrift_anon',
      authorMode: 'ghost',
      reactions: r(7, 2, 4, 5, 1),
    },
  ],

  'th-003': [
    {
      id: 'th-003-r2',
      threadId: 'th-003',
      postNumber: 2,
      body: '> same fourth tunnel\n\nthere are only three tunnels when you arrive. the fourth one appears after you have been on the platform long enough. I do not know what triggers it.',
      createdAt: '13 min ago',
      authorHandle: 'FRAGMENT_08',
      authorMode: 'ghost',
      reactions: r(5, 2, 3, 3, 1),
    },
    {
      id: 'th-003-r3',
      threadId: 'th-003',
      postNumber: 3,
      body: 'i have the platform map. the fourth tunnel is on the left side of the platform, past where the lighting stops. I drew it from memory twice on different nights and they match.',
      createdAt: '11 min ago',
      authorHandle: 'UNKNOWN NODE',
      authorMode: 'anon',
      reactions: r(5, 2, 4, 3, 1),
    },
    {
      id: 'th-003-r5',
      threadId: 'th-003',
      postNumber: 4,
      body: '> soot on my sleeve\n\nthere is a smell. like ozone and old paper. I notice it most when I remember the dream in a non-dream context. like right now.',
      createdAt: '7 min ago',
      authorHandle: 'GHOST',
      authorMode: 'anon',
      reactions: r(7, 3, 5, 4, 1),
    },
  ],

  'th-004': [
    {
      id: 'th-004-r2',
      threadId: 'th-004',
      postNumber: 2,
      body: '> waveform posted\n\nlooked at it. the ATM error tone is normally a synthetic 880Hz burst. what you posted is 880Hz with a second harmonic at 440Hz that should not be there. that is not standard firmware.',
      createdAt: '58 min ago',
      authorHandle: 'GLITCH_DIET',
      authorMode: 'ghost',
      reactions: r(4, 2, 3, 3, 1),
    },
    {
      id: 'th-004-r6',
      threadId: 'th-004',
      postNumber: 3,
      body: '> it is the same\n\nI matched the same harmonic pattern to a tone used in early emergency broadcast test sequences. the band was retired in the nineties. I do not know how it ended up in that machine.',
      createdAt: '22 min ago',
      authorHandle: 'SIGNAL_BLEED',
      authorMode: 'ghost',
      reactions: r(7, 3, 4, 5, 1),
    },
  ],

  'th-005': [
    {
      id: 'th-005-r1',
      threadId: 'th-005',
      postNumber: 2,
      body: 'I think I remember this. the moth banner was dark blue, not black. threads were numbered in hex. I only visited twice and both times the thread count was different.',
      createdAt: '55 min ago',
      authorHandle: 'DEAD_CHANNEL',
      authorMode: 'ghost',
      reactions: r(2, 1, 2, 2, 0),
    },
    {
      id: 'th-005-r4',
      threadId: 'th-005',
      postNumber: 3,
      body: 'ran some archive searches. found a ghost domain on a dead mindspring mirror with a banner image that is a broken image tag. the alt text is just "after hours". no other files cached.',
      createdAt: '19 min ago',
      authorHandle: 'ARCHIVE_SIFT',
      authorMode: 'ghost',
      reactions: r(4, 1, 3, 3, 1),
    },
  ],

  'th-006': [
    {
      id: 'th-006-r2',
      threadId: 'th-006',
      postNumber: 2,
      body: '> not posting the number\n\ngood. do not post the number. ever. if they knew the hash before you spoke they already know more than the hash.',
      createdAt: '1 hour 4 min ago',
      authorHandle: 'STATIC_VEIL',
      authorMode: 'ghost',
      reactions: r(4, 2, 3, 4, 1),
    },
    {
      id: 'th-006-r5',
      threadId: 'th-006',
      postNumber: 3,
      body: 'a friend of mine had something similar three years ago. different city, different chain. transaction settled and someone left a physical note under his door within twelve hours. he moved two weeks later.',
      createdAt: '21 min ago',
      authorHandle: 'GHOST',
      authorMode: 'anon',
      reactions: r(6, 3, 4, 5, 1),
    },
    {
      id: 'th-006-r6',
      threadId: 'th-006',
      postNumber: 4,
      body: 'ashtray here. went back to the arcade location. the booth is gone. not moved. no mount points on the floor. no conduit. it was never there or the floor was replaced. I did not stay long.',
      createdAt: '8 min ago',
      authorHandle: 'ashtrayoracle',
      authorMode: 'ghost',
      reactions: r(10, 4, 7, 8, 2),
    },
  ],

  'th-009': [
    {
      id: 'th-009-r1',
      threadId: 'th-009',
      postNumber: 2,
      body: 'the detail about the well filled with river stones is very specific. that is not an architectural feature someone invents. that is something a person saw or was told about by someone who saw it.',
      createdAt: '2 hours ago',
      authorHandle: 'FRAGMENT_08',
      authorMode: 'ghost',
      reactions: r(3, 1, 2, 2, 0),
    },
    {
      id: 'th-009-r5',
      threadId: 'th-009',
      postNumber: 3,
      body: '> sold to an unknown private party\n\nthat classification is unusual for a religious property transfer. church sales are typically public record with named buyers. an unknown party suggests the transaction was structured to avoid that requirement.',
      createdAt: '31 min ago',
      authorHandle: 'LEDGER_NODE',
      authorMode: 'ghost',
      reactions: r(6, 2, 4, 5, 1),
    },
  ],

  'th-010': [
    {
      id: 'th-010-r1',
      threadId: 'th-010',
      postNumber: 2,
      body: 'the names being ordinary is the detail that bothers me most. a PSA reading out celebrity names is a known format. reading lists of ordinary names is not. that is not a recognized broadcast structure from that period.',
      createdAt: '4 hours ago',
      authorHandle: 'DEAD_CHANNEL',
      authorMode: 'ghost',
      reactions: r(3, 1, 2, 3, 0),
    },
    {
      id: 'th-010-r4',
      threadId: 'th-010',
      postNumber: 3,
      body: 'third witness here. I saw it. It aired during the 2AM slot on a network affiliate I watched regularly. The names were read slowly, one every four seconds. I stopped counting after thirty. I remember it felt like a roll call for something that had not happened yet.',
      createdAt: '1 hour ago',
      authorHandle: 'GHOST',
      authorMode: 'anon',
      reactions: r(8, 3, 5, 6, 1),
    },
  ],

  'th-012': [
    {
      id: 'th-012-r3',
      threadId: 'th-012',
      postNumber: 2,
      body: '> pages 88 and 144\n\nthose page numbers are not random if this is a religious or hermetic text. 88 is frequently associated with specific numerological traditions. 144 appears in several eschatological frameworks. someone knew the page structure before they wrote.',
      createdAt: '1 hour ago',
      authorHandle: 'ARCHIVE_SIFT',
      authorMode: 'ghost',
      reactions: r(5, 2, 3, 4, 1),
    },
    {
      id: 'th-012-r4',
      threadId: 'th-012',
      postNumber: 3,
      body: 'I work in a university archive. we have had three cases of wet ink in sealed materials in the last twelve years. all three were in donated collections from the same county. all three involved notation that predated the enclosing document by at least fifty years.',
      createdAt: '44 min ago',
      authorHandle: 'NULL_RELAY',
      authorMode: 'ghost',
      reactions: r(6, 2, 4, 5, 1),
    },
  ],

  'th-013': [
    {
      id: 'th-013-r2',
      threadId: 'th-013',
      postNumber: 2,
      body: 'the more interesting problem is not the technical mechanism. it is the content. the folder with the red tab. that is a physical object. someone in that meeting knew about it at the time of the log. the transcription did not invent it.',
      createdAt: '19 min ago',
      authorHandle: 'SIGNAL_BLEED',
      authorMode: 'ghost',
      reactions: r(4, 1, 3, 3, 1),
    },
    {
      id: 'th-013-r3',
      threadId: 'th-013',
      postNumber: 3,
      body: 'had something adjacent happen. my note app created a new note containing the exact text of an email I received three hours later. the note timestamp is real. the email was from someone I had not spoken to in eight months.',
      createdAt: '14 min ago',
      authorHandle: 'ANON',
      authorMode: 'anon',
      reactions: r(6, 2, 4, 4, 1),
    },
  ],

  'th-014': [
    {
      id: 'th-014-r1',
      threadId: 'th-014',
      postNumber: 2,
      body: 'witnessed.',
      createdAt: '5 hours ago',
      authorHandle: 'anonymous',
      authorMode: 'anon',
      reactions: r(8, 0, 4, 6, 0),
    },
  ],

  'th-015': [
    {
      id: 'th-015-r1',
      threadId: 'th-015',
      postNumber: 2,
      body: 'the correction memo is the important artifact. routine renaming does not generate a memo instructing removal from all future documentation. that language is active suppression, not administrative correction.',
      createdAt: '1 hour 45 min ago',
      authorHandle: 'ARCHIVE_SIFT',
      authorMode: 'ghost',
      reactions: r(4, 1, 2, 3, 1),
    },
    {
      id: 'th-015-r4',
      threadId: 'th-015',
      postNumber: 3,
      body: 'these memo patterns appear in at least seven other municipal archives I have researched. always the same structure: two memos, no reason given, same language about all future documentation. someone was writing from a template.',
      createdAt: '29 min ago',
      authorHandle: 'ANON',
      authorMode: 'anon',
      reactions: r(6, 2, 4, 5, 1),
    },
  ],

  'th-016': [
    {
      id: 'th-016-r2',
      threadId: 'th-016',
      postNumber: 2,
      body: 'the security footage gap is the detail that cannot be resolved technically. if the footage is complete with clean timecodes, it either recorded and shows no flicker — which means the witnesses are wrong — or something affected physical experience without affecting the recording medium.',
      createdAt: '37 min ago',
      authorHandle: 'GLITCH_DIET',
      authorMode: 'ghost',
      reactions: r(7, 2, 5, 6, 1),
    },
    {
      id: 'th-016-r3',
      threadId: 'th-016',
      postNumber: 3,
      body: '> 0.3 seconds\n\nall fourteen witnesses gave the same duration estimate independently. 0.3 seconds is below conscious threshold for most visual anomaly estimation. people usually overestimate short durations. fourteen people guessing the same precise duration is unusual.',
      createdAt: '30 min ago',
      authorHandle: 'FRAGMENT_08',
      authorMode: 'ghost',
      reactions: r(8, 3, 6, 7, 2),
    },
    {
      id: 'th-016-r5',
      threadId: 'th-016',
      postNumber: 4,
      body: '> the footage shows nothing\n\nI want to suggest the possibility that the footage is correct and the witnesses are correct. if the event affected biological perception but not electromagnetic recording, that tells you something about the mechanism.',
      createdAt: '12 min ago',
      authorHandle: 'NULL_RELAY',
      authorMode: 'ghost',
      reactions: r(10, 4, 7, 9, 2),
    },
  ],
};
