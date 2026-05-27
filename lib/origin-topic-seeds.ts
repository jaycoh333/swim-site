/**
 * Origin topic seed groups for Phase V deep discovery.
 *
 * Each group provides:
 *   - keywords:  terms to match in content scoring and candidate text
 *   - pathHints: URL path fragments indicating topic-relevant pages
 *   - eraHint:   preferred Wayback year range for this topic group
 *
 * Used by discoverWaybackLinks to rotate topic focus between scan sessions,
 * ensuring successive scans surface content from different subject areas
 * rather than repeatedly hitting the same generic pages.
 */

export interface TopicSeedGroup {
  id:        string;
  name:      string;
  keywords:  string[];
  pathHints: string[];  // URL path fragments suggesting relevant content
  eraHint:   [number, number];
}

export const ORIGIN_TOPIC_SEEDS: TopicSeedGroup[] = [
  {
    id:       'ufo-disclosure',
    name:     'UFO / Disclosure',
    keywords: [
      'ufo', 'roswell', 'majestic-12', 'majestic12', 'area-51', 'area51',
      'black-triangle', 'cattle-mutilation', 'men-in-black', 'disclosure',
      'flying-saucer', 'abduction', 'nhi', 'ufology', 'crash-retrieval',
    ],
    pathHints: [
      'ufo', 'saucer', 'roswell', 'disclosure', 'alien', 'abduct',
      'mj12', 'majestic', 'area51', 'area-51', 'triangle', 'contact',
    ],
    eraHint: [1996, 2006],
  },
  {
    id:       'mind-control-black-projects',
    name:     'Mind Control / Black Projects',
    keywords: [
      'mkultra', 'mk-ultra', 'montauk', 'project-stargate', 'remote-viewing',
      'haarp', 'monarch', 'black-project', 'psychotronic', 'mind-control',
      'manchurian', 'lsd-experiments', 'operation-paperclip', 'darpa',
    ],
    pathHints: [
      'mkultra', 'mk-ultra', 'stargate', 'haarp', 'montauk',
      'mindcontrol', 'mind-control', 'monarch', 'remote-view',
      'psychotron', 'paperclip', 'project',
    ],
    eraHint: [1997, 2008],
  },
  {
    id:       'ancient-occult',
    name:     'Ancient / Occult',
    keywords: [
      'ancient-astronauts', 'annunaki', 'anunnaki', 'nephilim', 'atlantis',
      'occult', 'ritual', 'prophecy', 'illuminati', 'reptilian',
      'sacred-geometry', 'mystery-school', 'esoteric', 'hermetic', 'gnostic',
    ],
    pathHints: [
      'ancient', 'annunaki', 'anunnaki', 'nephilim', 'atlantis',
      'occult', 'illuminati', 'reptil', 'sacred', 'esoteric',
      'hermeti', 'gnostic', 'mystery',
    ],
    eraHint: [1998, 2010],
  },
  {
    id:       'internet-lore',
    name:     'Internet Lore',
    keywords: [
      'geocities', 'bbs', 'usenet', 'tripod', 'angelfire',
      'ezboard', 'old-forum', 'bulletin-board', 'newsgroup',
      'early-internet', 'pre-web', 'fidonet', 'prodigy', 'compuserve',
    ],
    pathHints: [
      'bbs', 'usenet', 'forum', 'board', 'newsgroup',
      'geociti', 'tripod', 'angelfire', 'fidonet', 'prodigy',
    ],
    eraHint: [1994, 2004],
  },
  {
    id:       'lost-media',
    name:     'Lost Media',
    keywords: [
      'lost-broadcast', 'missing-episode', 'banned-film', 'deleted-video',
      'suppressed-tape', 'vanished-show', 'unreleased-recording',
      'dead-link', 'lost-film', 'unaired', 'censored-broadcast',
    ],
    pathHints: [
      'lost', 'missing', 'banned', 'deleted', 'suppressed',
      'vanished', 'unreleased', 'unaired', 'censored',
    ],
    eraHint: [1999, 2012],
  },
];

/** Pick a random topic group — used to rotate scan focus between sessions. */
export function pickRandomTopicGroup(): TopicSeedGroup {
  return ORIGIN_TOPIC_SEEDS[Math.floor(Math.random() * ORIGIN_TOPIC_SEEDS.length)];
}
