# SWIM Source Pack 01 — Erowid-Style Archives & Old Forums

> Status: Manual research guide. No scraping. No automation.
> All signals in this pack are found by a human, summarized by a human,
> and submitted through the curator intake form at /scanner/queue.
>
> This document is internal. It is not served to users.

---

## What This Pack Covers

The first source pack focuses on the two highest-signal manual sources
available: experience archives in the Erowid tradition and early-web
paranormal / anomaly forums. Both were active between roughly 1995 and
2012 and produced an enormous volume of first-person accounts that have
never been systematically reviewed for cross-report anomalies.

Most of this material is technically online — on archive.org, in
community-maintained mirrors, or in private ZIP backups — but it is
effectively inaccessible because it exists in formats, domains, and
structures that modern search engines have stopped indexing.

The goal of this pack is not comprehensiveness. It is to identify the
highest-signal fragments from these sources, write clean summaries in
SWIM's editorial voice, and move them into the queue for curator review.

---

## Research Targets

### Target 1 — Erowid Experience Vault style archives

**What they are:**
Community-edited archives of first-person subjective accounts. Erowid
is the most well-known example, but the category includes many smaller
archives focused on liminal, spiritual, and unusual experience that
operated independently throughout the late 1990s and 2000s.

**What makes them high-signal for SWIM:**
- Large volume of independently submitted accounts creates natural
  cross-report comparison opportunities
- Accounts sometimes describe phenomena that recur across unrelated
  contributors over years (same geometry, same entities, same places)
- Some entries were quietly removed after submission; gaps visible
  in Wayback snapshots

**Research method:**
- archive.org domain crawls for known Erowid mirrors and companion sites
- Search Wayback CDX API for snapshots of known experience vault domains
- Focus on "unusual" and "not otherwise categorized" sections, not
  the mainstream psychedelic reports

**What to look for specifically:**
- Multiple reports mentioning the same specific visual geometry, entity
  description, or spatial feature across different years and submitters
- Reports that were submitted, then removed — visible as present in
  one snapshot and absent in the next
- Reports that reference a geographic location that matches other reports
  from unrelated sources
- Reports where the submitter noted that others had described the same
  thing without coordinating with them

**Anomaly threshold:** ≥ 6 for cross-report corroboration; ≥ 5 for
removal evidence; ≤ 4 for isolated personal accounts.

---

### Target 2 — Old paranormal forums (phpBB / vBulletin / SMF)

**What they are:**
Dedicated community boards operating primarily 2000–2015 covering UFOs,
hauntings, cryptids, NDE/OBE, shadow people, time slips, and related
phenomena. Most are offline; partial snapshots survive in Wayback and
community-maintained backup ZIPs.

**Specific targets:**
- AboveTopSecret (ATS) — large volume; high noise; genuine anomalies
  buried but present. Focus on threads with 20+ replies from multiple
  users independently corroborating the OP.
- Phantoms & Monsters forum archives — smaller, higher signal ratio
- Paracast community boards — more skeptical membership means surviving
  anomaly threads have already been informally vetted by the community
- Unexplained-Mysteries.com archives
- Any phpBB board in the Wayback CDX with a paranormal/anomaly niche

**Research method:**
- Search Wayback CDX API: `site:forum.unexplained-mysteries.com`,
  `site:abovetopsecret.com/forum`, `site:phantomsandmonsters.com`
- Search archive.org for community-uploaded phpBB backup ZIPs
- Look for threads shared in later discussions as "the original is gone"

**What to look for:**
- Threads where ≥ 2 users independently described the same specific
  detail that was not present in the OP (entity description, location
  feature, sensory detail, symbol)
- Threads locked or deleted by moderators without stated reason
- Users who posted once, received corroborating replies, never returned
- Posts where the OP stated "I searched and couldn't find anyone else
  who has described this" — then replies proving them wrong

**Anomaly threshold:** ≥ 2 independent corroborating users = score +2.
Single-user reports: ≤ 5 unless extremely specific and verifiable detail.

---

### Target 3 — Glitch-in-the-Matrix style threads

**What they are:**
r/Glitch_in_the_Matrix (Reddit), older equivalents on LiveJournal
communities, and standalone blogs documenting experiences of perceived
reality discontinuity — deja vu anomalies, impossible memories,
timeline-inconsistent observations, objects appearing / disappearing.

**Why they matter:**
The individual accounts are almost always anecdotal. What matters is
the cross-report signal: the same specific discontinuity described
independently across unrelated submitters in different years. This is
hard to find in active communities where people have read each other's
posts. The best material is from the early Reddit era (2012–2015)
and pre-Reddit LiveJournal communities where cross-contamination was
lower.

**Research method:**
- Pushshift archives (when accessible) for early r/Glitch_in_the_Matrix
- Wayback snapshots of the subreddit from 2012–2015
- LiveJournal communities: `glitch_matrix`, `strange_happenings`,
  `paranormal_world` — most are archived at wayback or in LJ backup ZIPs

**What to look for:**
- Identical impossible-memory content across unrelated submitters
  (same wrong memory, same alternative version of an event)
- Posts where commenters recognized the described discontinuity from
  personal experience and provided independent detail
- Posts deleted within 24 hours that were archived in comment quotes

---

### Target 4 — Lost media forums

**What they are:**
LostMediaWiki, r/LostMedia, and related community Discord/IRC archives
tracking missing or unconfirmed media — broadcasts, films, games,
recordings, prints — where the only surviving evidence is collective
memory.

**What to look for:**
- Items where ≥ 3 unrelated people independently remember something
  that has no surviving physical record and no confirmation from the
  rights holder or distributor
- Items that were actively denied by the network, studio, or distributor
  despite multiple independent witnesses
- Items where a VHS/cassette/print was described as existing and then
  disappeared before it could be digitized
- Items where the memory is extremely specific (specific scene, dialog,
  visual detail) and consistent across witnesses who did not coordinate

**Specific targets:**
- LostMediaWiki article histories — look for items with "found"
  status reversed back to "lost" (active controversy about whether
  it was confirmed)
- r/LostMedia threads with ≥ 10 upvotes from 2013–2018 (early era,
  less contamination from exposure to the subreddit's own canon)
- Any Discord log exports from the Lost Media Archive server

**Anomaly threshold:** Collective memory with ≥ 3 witnesses and active
denial from rights holder = score 7–8. Single witness with no
physical confirmation = score 3–4.

---

### Target 5 — Archived BBS and early web forum mirrors

**What they are:**
Text-mode BBS boards from the late 1980s / early 1990s and their
early-web successors. Most of the content that survives exists as:
- Textfile archives on textfiles.com and related mirrors
- Community-curated BBS backup packages on archive.org
- Preservation projects covering specific bulletin board systems
  that hosted paranormal / fringe communities

**What to look for:**
- Message threads where multiple users in the same BBS community
  reported the same unusual experience independently
- Sysop announcements referencing incidents that are not documented
  in any other record
- Files posted to paranormal / phile sections that were removed
  from the archive before it was publicly distributed
- References to specific events, locations, or entities that
  reappear in later (post-web) sources, suggesting the BBS was
  an early documentation point

**Research method:**
- textfiles.com paranormal and conspiracy sections
- archive.org collection `bbs-old-files` and related datasets
- Jason Scott's BBS documentary archive materials
- BBSMATES.COM and similar BBS history preservation communities

---

## Summary Writing Rules

These rules apply to every signal summary written for the SWIM queue,
regardless of source type. They are not guidelines — they are
requirements. See also: docs/scanner-source-registry.md § Safety Rules.

### 1. Summarize in your own words

Write the summary as if you are describing what you read to someone
who has not seen it. Use your own sentence structure. Your words, not
the source's words.

**Why:** Copyright; editorial voice; accuracy. Copying paste produces
summaries that read like the source, not like SWIM.

**What a summary must contain:**
- What happened or what was described
- What makes it anomalous (the specific detail that is hard to explain)
- What corroborating evidence exists, if any
- What happened to the source (deleted, expired, denied, archived)

**What a summary must not contain:**
- Full sentences copied verbatim from the source (short quotes of
  2–4 words to preserve specific terminology are acceptable)
- Interpretation or editorializing about what you think it means
- The personal opinion of the signal curator

### 2. Link the source when available

If a URL exists, include it in `source_url`. The URL should point to
the most stable available version:
- Prefer Wayback Machine snapshots over live URLs (live pages change)
- Prefer archive.org hosted files over external mirrors
- If no URL exists, leave `source_url` empty — do not invent one

### 3. No personal information

Do not include in any summary or tag:
- Real names of private individuals (public figures making public
  statements are different; ordinary forum users are not)
- Usernames that can be traced to a real identity
- Addresses, cities more specific than regional/state level, phone
  numbers, email addresses
- Any identifying detail that could allow a reader to locate or
  contact the person who submitted the original account

Refer to individuals as: "the OP," "a user," "an anonymous contributor,"
"the original poster," "one commenter."

### 4. No illegal instructions

Do not summarize any content that contains:
- Synthesis or acquisition instructions for controlled substances
- Instructions for accessing systems without authorization
- Methods for evading law enforcement or surveillance
- Content describing planning or executing real-world harm

If the anomaly is in the surrounding context (the post was deleted,
the user disappeared, the site went offline), the signal can be filed
with that context only — not the prohibited content.

### 5. No speculation masquerading as fact

The summary describes what was reported, not what is true.

Write: "the OP described a sound they could not identify"
Not: "the OP heard an unknown entity"

Write: "the station's public record does not contain an entry for this date"
Not: "the broadcast was suppressed"

The anomaly should speak for itself. Do not editorialize.

### 6. Anomaly score guidance

| Score | Criteria |
|-------|----------|
| 9–10 | Multiple independent sources; specific verifiable detail; active denial or suppression by an official party |
| 7–8  | Two or more independent corroborating accounts; specific detail; no mundane explanation apparent |
| 5–6  | Single well-documented source; specific detail; source deletion or denial adds weight |
| 3–4  | Single source; interesting but unverified; mundane explanation plausible |
| 1–2  | Single source; no verifiable detail; likely fictional or creative; reject |

---

## 10 Example Recovered Signal Summaries

The following are manually written signal summaries in SWIM editorial
style. Each is ready for curator intake at /scanner/queue. They
illustrate the format and voice expected for signals drawn from this
source pack.

These are examples. They are not actual signals — they are
instructional demonstrations of structure, length, and tone.

---

### Example 01

**Title:** Recurring tower geometry across 14 unrelated Erowid submissions spanning 6 years

**Category:** Dreams

**Source name:** Erowid Experience Vault (mirror, archive.org)

**Source type:** wayback

**Anomaly score:** 8

**Tags:** geometry, tower, recurrence, cross-report

**Summary:**
A comparison of fourteen submissions to an Erowid-style experience vault
between 2003 and 2009 reveals that submitters — who have no apparent
connection to one another and submitted under separate accounts years
apart — describe the same structure: a narrow tower with an impossible
interior, no visible ceiling, and a single window that faces inward
rather than outward. Eleven of the fourteen submissions mention the
interior window specifically. Nine note that the tower was not the
focus of their account but appeared uninvited in the periphery of a
longer experience. None of the submissions reference one another, and
the vault's archive shows no evidence that the later submissions could
have drawn on the earlier ones: the older posts were not prominently
indexed.

---

### Example 02

**Title:** AboveTopSecret thread: four posters independently described the same "correction" to a published photograph

**Category:** Simulation Theory

**Source name:** AboveTopSecret (ATS) forum, Wayback Machine snapshot

**Source type:** forum

**Anomaly score:** 7

**Tags:** photograph, visual correction, independent corroboration, forum

**Summary:**
An archived ATS thread from 2007 documents a discussion about a
published news photograph from the early 1980s. The original poster
described noticing what they called a "correction line" — a vertical
seam in the image that suggests the photo was composited from two
separate captures. Before the OP described this specifically, three
other commenters noted the same feature in the same location using
different terminology ("the join," "where it doesn't quite match,"
"the light is wrong on the left side"). None of the commenters had
described the detail before the thread was created. The thread was not
deleted but the ATS domain has since restructured, and the thread is
not accessible through normal navigation — only the Wayback snapshot
preserves it.

---

### Example 03

**Title:** phpBB thread: urban explorers found a room with a consistent acoustic property at three separate locations

**Category:** Hidden History

**Source name:** Urban exploration phpBB board (offline, backup ZIP)

**Source type:** forum

**Anomaly score:** 7

**Tags:** urban exploration, acoustics, consistent anomaly, separate locations

**Summary:**
A thread on a small phpBB board dedicated to urban exploration contains
posts from three members who — at different times, in different cities,
in different types of abandoned structures — described finding a room
with the same unusual acoustic property: sounds made in the room
returned from the wrong direction, as if the reflected sound was coming
from a point outside the room's walls. The first account was posted in
2008; the other two are from 2010 and 2013. The 2013 poster had not
seen the earlier posts and noted in their message that they had tried
to find any record of someone else describing the same thing and failed.
A fourth member replied with a link to a now-dead resource suggesting
this effect had a name in acoustic engineering but provided no further
information before the forum went offline.

---

### Example 04

**Title:** r/Glitch_in_the_Matrix — OP deleted account immediately after 22 replies confirmed the same impossible road

**Category:** Simulation Theory

**Source name:** r/Glitch_in_the_Matrix (Pushshift archive)

**Source type:** reddit

**Anomaly score:** 8

**Tags:** impossible geography, road, account deletion, corroboration

**Summary:**
A post from 2014 in r/Glitch_in_the_Matrix describes an OP who grew
up driving a specific road in a rural area of the American Midwest and
discovered in their thirties that the road does not exist in any map,
satellite image, or local government record, despite the OP having
clear and consistent memory of it over decades. Within 12 hours, 22
commenters had replied; eight described having an identical experience
with roads in different states, and three of those eight provided
details that matched the OP's description of the road's characteristics
without being prompted. The OP deleted their account and the post
simultaneously approximately 16 hours after posting. The thread was
captured in the Pushshift archive before deletion. It has been
referenced in later discussions but the original link is dead.

---

### Example 05

**Title:** LostMediaWiki item: regional children's program remembered by 9 witnesses, denied by production company

**Category:** Lost Media

**Source name:** LostMediaWiki article + r/LostMedia discussion thread

**Source type:** forum

**Anomaly score:** 9

**Tags:** children's television, collective memory, denial, regional broadcast

**Summary:**
A LostMediaWiki entry documents a regional children's television
program that aired on a local affiliate in the Pacific Northwest
in the mid-1980s according to nine independent witnesses. The
witnesses, who came from at least three different cities in the
broadcast area, describe consistent details: a host in a specific
type of costume, a recurring segment involving a physical prop that
transformed on camera, and a theme song with a distinctive chord
progression. The production company listed in the witnesses' descriptions
has confirmed it produced regional programming for that affiliate during
the period in question but states that no record of this program exists
in their archive and that no program matching the description was
produced. The FCC broadcast log for that market during the relevant
years lists a 30-minute program in the relevant time slot on the
relevant channel with no title in the public record. Status: lost.

---

### Example 06

**Title:** Erowid-style archive: 7 accounts reference the same specific blue-grey room across a 12-year span

**Category:** Dreams

**Source name:** non-Erowid experience archive (archive.org mirror, domain offline)

**Source type:** wayback

**Anomaly score:** 8

**Tags:** dream, room, recurrence, cross-report, twelve years

**Summary:**
A now-offline archive that collected unusual and liminal experiences
from 1997 to 2009 contains seven accounts in which a submitter
describes, in the context of a longer account, a room with the same
specific visual signature: low ceiling, blue-grey walls without visible
seams or joints, no windows, a single door that opens only inward,
and a persistent low-frequency sound described by all seven as being
felt rather than heard. The accounts span twelve years and were submitted
under different usernames with no apparent connection between them.
One submitter noted in their account that they had found another
description of the same room on a different site (link now dead) and
that the other person's description matched theirs in every detail.
No cross-referencing is visible in the archive's submission interface.

---

### Example 07

**Title:** IRC log fragment: three operators on the same network described service interruptions they could not source

**Category:** Surveillance State

**Source name:** IRChelp.org archive / community-preserved IRC logs

**Source type:** irc

**Anomaly score:** 6

**Tags:** IRC, network interruption, coordinated anomaly, operators

**Summary:**
A preserved IRC log from 2001 shows three IRC server operators on the
same network discussing a pattern of brief service interruptions
occurring at the same time each night across different servers in
different geographic locations. The interruptions were not caused by
known maintenance; the operators confirmed they had checked all
standard sources. One operator noted that the pattern was regular
enough to be scheduled rather than accidental and that it had been
occurring for approximately six weeks before they compared notes.
The log was preserved in an IRChelp.org archive. The network no
longer exists and no official post-mortem of its shutdown addresses
the interruptions.

---

### Example 08

**Title:** GeoCities BBS mirror: visitors to the same rural location described an identical visual event over three years

**Category:** Paranormal

**Source name:** GeoCities mirror (archive.org)

**Source type:** wayback

**Anomaly score:** 7

**Tags:** location-specific, visual event, guestbook, corroboration

**Summary:**
A GeoCities site operating as a semi-structured forum for visitors to
a specific rural area in central Europe contains a guestbook with
entries from 1999 to 2002. Eleven of the entries, from visitors who
appear to have no prior connection to one another based on their
writing styles and apparent backgrounds, describe seeing a light in
the same field at the same approximate time of night — specifically
between 2 and 3 AM local time. The descriptions agree on the light's
color (yellowish-white), its behavior (stationary, then moving
horizontally at low speed, then disappearing without fading), and
its apparent altitude (below treeline). None of the entries reference
any of the others. The site was last crawled by Wayback in 2004;
the live domain no longer resolves.

---

### Example 09

**Title:** Textfile from 1993 BBS: anonymous account of a government installation's unofficial signage system

**Category:** Redacted Files

**Source name:** textfiles.com / BBS document archive

**Source type:** forum

**Anomaly score:** 6

**Tags:** BBS, government installation, unofficial record, textfile

**Summary:**
A 1993 textfile circulated on BBS boards in the paranormal/conspiracy
file sections describes what the anonymous author presents as a
firsthand account of working at a government-adjacent facility in
the American Southwest during the 1980s. The account focuses on an
unofficial internal signage system that did not correspond to the
facility's official floorplan — signs in corridors that were not
on any distributed map and that referenced areas by designations
not found in any public record of the facility. The author states
that asking about the signs to a supervisor resulted in the signs
being removed before the next working day. The textfile has been
archived in multiple BBS dump packages. Its authorship cannot be
verified. Anomaly score is moderate: the account is specific and
internally consistent, but single-source and unverifiable.

---

### Example 10

**Title:** Early r/LostMedia: contributor described a cassette tape of impossible content that was discarded before digitization

**Category:** Lost Media

**Source name:** r/LostMedia (archived thread, 2012)

**Source type:** reddit

**Anomaly score:** 5

**Tags:** cassette, lost recording, pre-internet, single witness

**Summary:**
A 2012 r/LostMedia post describes a user who found a cassette tape in
a box of discarded personal effects at an estate sale in the early
2000s. The tape contained what the user describes as an uninterrupted
two-hour recording of a radio broadcast from a station that did not
correspond to any station the user could identify by call letters,
frequency, or broadcast style. The host spoke in a flat, unhurried
cadence and read what appeared to be a list of place names, pausing
between each. The user did not copy the tape before returning it to
the box, and the box was not kept. Three commenters in the thread
expressed familiarity with the described broadcast style but none
could identify the source. Anomaly score is moderate: single witness,
no physical evidence, but the specific description matches a pattern
described in other signals.

---

## Category Mapping Guide

When categorizing a signal for the SWIM queue, use this mapping as
a starting point. If the signal clearly fits multiple categories,
choose the one that captures the primary anomaly. Mismatched
categorization is not a major error — curators can recategorize
before publishing.

| What the source describes | SWIM category |
|--------------------------|---------------|
| Dreams with unusual specificity or recurrence | Dreams |
| Impossible or inconsistent memories | Simulation Theory |
| Visual sightings of unidentified aerial objects | UFOs |
| Entity encounters (shadow figures, unknown beings) | Paranormal |
| Old internet communities, vanished websites, dead links | Internet Lore |
| Missing or unconfirmed media (films, tapes, broadcasts) | Lost Media |
| Personal confessions of strange experiences | Confessions |
| Records that contradict official accounts | Hidden History |
| Government, military, or institutional concealment | Redacted Files |
| Surveillance, tracking, or monitoring anomalies | Surveillance State |
| Rituals, symbols, or occult practices | Occult Archives |
| Unexplained signals, transmissions, or broadcasts | Psyops |
| AI or machine behavior that defies expected parameters | AI |
| Chemical or biological anomalies | Psychedelics |
| Conspiracy with documented evidence threads | Conspiracy Theory |
| Collective hallucination or mass shared perception | Simulation Theory |
| Radio, TV, or broadcast anomalies | Lost Media / Psyops |
| Location-specific recurring phenomena | Paranormal / Hidden History |
| Timeline inconsistencies or mandela-effect type events | Simulation Theory |
| Missing persons with unusual circumstances | Unsolved Events |

**When in doubt:**
- Prefer specificity over breadth: a missing broadcast is Lost Media,
  not Internet Lore
- Prefer the anomaly over the medium: an IRC log describing a
  government intrusion is Surveillance State, not Internet Lore
- Confessions is for first-person accounts; Dreams is for sleep/liminal
  experiences; Paranormal is for entity encounters and location phenomena

---

## Future Scanner Architecture

This section describes the system SWIM is building toward. Nothing
here is automated yet. This is a reference sketch for incremental
implementation.

```
┌─────────────────────────────────────────────────────────────────────┐
│                     SWIM SCANNER PIPELINE                           │
│                    (target architecture)                            │
└─────────────────────────────────────────────────────────────────────┘

  1. SOURCE REGISTRY
     ─────────────
     Approved source domains and patterns.
     Current file: docs/scanner-source-registry.md
     Future: database table `scanner_sources` with domain, source_type,
     crawl_enabled, last_crawled_at, anomaly_baseline.
     Human-maintained. Nothing is added without curator review.

  2. FETCHER
     ───────
     Retrieves raw content from approved sources.
     Does not interpret, score, or modify content.
     Respects robots.txt. Rate-limits to avoid hammering targets.
     Falls back to Wayback CDX API for offline sources.
     Output: raw HTML / text blob + metadata (URL, timestamp, status).

  3. EXTRACTOR
     ─────────
     Parses raw content into structured candidate signals.
     Identifies: author, date, body text, any replies/corroboration.
     Strips navigation, ads, boilerplate.
     Output: candidate signal record with source metadata.
     Does not score, filter, or modify the substance.

  4. SUMMARIZER
     ──────────
     Produces a curator-facing summary of the extracted content.
     Runs on the structured candidate, not the raw HTML.
     Must not reproduce full copyrighted text.
     Must not include PII.
     Output: plain-text summary suitable for curator review.
     HUMAN GATE: summary is reviewed before it becomes a signal row.

  5. ANOMALY SCORER
     ───────────────
     Assigns a preliminary anomaly score based on:
     - Cross-report corroboration signals in the text
     - Source deletion / suppression indicators
     - Specificity of verifiable detail
     - Whether the content contradicts official records
     Output: score 1–10, reasoning notes.
     HUMAN GATE: curator adjusts score before publishing.

  6. CURATOR QUEUE
     ──────────────
     The recovered_signals table in Supabase.
     Current: /scanner/queue (live).
     Curator reads the summary + score, approves / archives / rejects.
     Curator may edit summary, adjust score, add tags.
     Nothing proceeds without explicit approve click.

  7. PUBLISH
     ───────
     Curator clicks [ preview & publish ] in the queue.
     Thread created with author=ARCHIVIST.
     Signal stamped with published_thread_id.

  8. SHARE
     ─────
     Curator reviews Telegram and X copy in the share package.
     Copies manually or (Phase 2/3) clicks explicit post button.
     No automatic posting. No scheduled posting. Human only.

─────────────────────────────────────────────────────────────────────

CURRENT STATE (as of this source pack):
  ✓ Source registry: docs/scanner-source-registry.md
  ✓ Manual intake: /scanner/queue form (curator only)
  ✓ Public intake: /scanner/submit (crowd-sourced, pending review)
  ✓ Curator queue: /scanner/queue (approve / archive / reject)
  ✓ Publish: publish-to-thread with preview step
  ✓ Share package: Telegram + X copy, manual posting only
  ○ Fetcher: not implemented
  ○ Extractor: not implemented
  ○ Summarizer: not implemented
  ○ Anomaly scorer: not automated

NEXT IMPLEMENTATION STEPS (in order):
  1. Wayback CDX API wrapper — fetches snapshot URLs for approved
     domains; no content extraction yet. Read-only, rate-limited.
  2. Simple HTML extractor for known source structures (phpBB, Wayback
     GeoCities pages). Outputs plain text + metadata only.
  3. Manual scoring workflow improvement — show curator the raw
     extracted text alongside the summary for comparison.
  4. Summarizer (LLM-assisted, curator-reviewed) — uses the extracted
     text to produce a draft summary. Curator must edit before intake.
  5. Cross-report similarity index — flags new signals that share
     specific detail with existing archived signals.
```

---

## Source Pack Maintenance

This document is version 1. Update it when:
- A new source type is approved (add to § Research Targets)
- A target becomes unavailable (note the date and reason)
- Summary writing rules are revised
- The architecture sketch changes materially

Version history:
- v1 (2026-05-25): initial source pack, 5 research targets, 10 examples,
  category mapping, architecture sketch

---

*This file lives at `docs/source-pack-erowid-and-old-forums.md` and is not served to users.*
