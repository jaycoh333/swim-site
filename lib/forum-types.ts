export const CATEGORY_COLORS: Record<string, string> = {
  UFOs: '#68d8ff',
  Politics: '#bb6464',
  Dreams: '#b083ff',
  Philosophy: '#d7a85c',
  'Crypto Trench': '#e08a3e',
  Paranormal: '#79d986',
  Technology: '#6da8ff',
  Art: '#ef87b5',
  Music: '#57cfc1',
  Confessions: '#d9dfd3',
  Survival: '#6e8f4a',
  AI: '#58a7ff',
  Spirituality: '#bea4ff',
  Relationships: '#e0b7c8',
  'Lost Media': '#8ed2c5',
  Psychedelics: '#c080ff',
  'Hidden History': '#b8c97a',
  'Internet Lore': '#80d0d0',
  'Simulation Theory': '#7aa8ff',
  'Addiction Recovery': '#cfd8c0',
  'Weird Encounters': '#82d3a8',
  'Dark Web Lore': '#6f82a8',
  'Conspiracy Theory': '#9b8bbd',
  'Whistleblower Files': '#9db9a6',
  'Censored History': '#a28a6f',
  'Shadow Systems': '#6a8b88',
  'Black Projects': '#7f98a8',
  'Forbidden Tech': '#6e95c8',
  'Occult Archives': '#a27fbb',
  'Internet Mysteries': '#7db3b1',
  'Unsolved Events': '#9aa57a',
  'Surveillance State': '#8ca59d',
  Psyops: '#9d7d7d',
  'Corporate Secrets': '#8b919c',
  'Redacted Files': '#c0c5b1',
  Stories: '#d7cf87',
};

export const CATEGORY_ORDER = [
  'Stories',
  'Confessions',
  'Paranormal',
  'UFOs',
  'Politics',
  'Dreams',
  'AI',
  'Crypto Trench',
  'Psychedelics',
  'Lost Media',
  'Internet Lore',
  'Simulation Theory',
  'Hidden History',
  'Censored History',
  'Redacted Files',
  'Whistleblower Files',
  'Corporate Secrets',
  'Shadow Systems',
  'Black Projects',
  'Forbidden Tech',
  'Surveillance State',
  'Psyops',
  'Conspiracy Theory',
  'Dark Web Lore',
  'Occult Archives',
  'Internet Mysteries',
  'Unsolved Events',
  'Relationships',
  'Spirituality',
  'Addiction Recovery',
  'Weird Encounters',
  'Survival',
  'Technology',
  'Philosophy',
  'Art',
  'Music',
] as const;

export type Category = (typeof CATEGORY_ORDER)[number];

export type ContentType =
  | 'THREAD'
  | 'ARCHIVE_ENTRY'
  | 'CONFESSION'
  | 'SIGNAL'
  | 'ENCOUNTER'
  | 'DREAM_FILE'
  | 'THEORY'
  | 'LOST_MEDIA'
  | 'LOG';

export type ReactionType = 'echo' | 'dive' | 'ripple' | 'witness' | 'signal';

export interface ReactionSet {
  echo: number;
  dive: number;
  ripple: number;
  witness: number;
  signal: number;
}

export interface GhostIdentity {
  id: string;
  handle: string;
  label: 'GHOST' | 'NODE' | 'SIGNAL IDENTITY' | 'ARCHIVE HANDLE';
  joinedAt: string;
  passphraseHint?: string;
  activeCategories: Category[];
  archivedThreadIds: string[];
  echoesReceived: number;
  sigil: string[];
}

export interface ContentBase {
  id: string;
  type: ContentType;
  category: Category;
  title: string;
  body: string;
  excerpt: string;
  createdAt: string;
  updatedAt?: string;
  tags: string[];
  reactions: ReactionSet;
  replyCount: number;
  viewCount: number;
  lastActivityAt: string;
  authorHandle: string;
  authorId: string;
}

export interface ThreadContent extends ContentBase {
  type: 'THREAD';
  lastPostPreview: string;
  board: string;
  pinned?: boolean;
}

export interface ArchiveEntryContent extends ContentBase {
  type: 'ARCHIVE_ENTRY';
  archiveCode: string;
  signalStrength: number;
}

export interface ConfessionContent extends ContentBase {
  type: 'CONFESSION';
  seal: 'soft' | 'buried' | 'open';
}

export interface SignalContent extends ContentBase {
  type: 'SIGNAL';
  frequency: string;
  source: string;
}

export interface EncounterContent extends ContentBase {
  type: 'ENCOUNTER';
  coordinates: string;
  locationName: string;
}

export interface DreamFileContent extends ContentBase {
  type: 'DREAM_FILE';
  dreamIndex: string;
  sleepPhase: 'REM' | 'threshold' | 'unknown';
}

export interface TheoryContent extends ContentBase {
  type: 'THEORY';
  theoryStatus: 'active' | 'buried' | 'contested';
}

export interface LostMediaContent extends ContentBase {
  type: 'LOST_MEDIA';
  mediaFormat: 'forum' | 'audio' | 'video' | 'site' | 'scan';
}

export interface LogContent extends ContentBase {
  type: 'LOG';
  logKind: 'system' | 'archive' | 'presence';
}

export type ForumContent =
  | ThreadContent
  | ArchiveEntryContent
  | ConfessionContent
  | SignalContent
  | EncounterContent
  | DreamFileContent
  | TheoryContent
  | LostMediaContent
  | LogContent;

export interface WorldEvent {
  id: string;
  timestamp: string;
  message: string;
  type: 'signal_detected' | 'node_connected' | 'archive_recovered' | 'system_notice';
}

export interface ForumStats {
  totalEntries: number;
  activeThreads: number;
  totalCategories: number;
  oldestEntry: string;
  averageSignal: string;
}

export interface Reply {
  id: string;
  threadId: string;
  postNumber: number;
  body: string;
  createdAt: string;
  authorHandle: string;
  authorMode: 'anon' | 'ghost';
  reactions: ReactionSet;
  replyToId?: string;
}

export interface CreateThreadDraft {
  title: string;
  body: string;
  category: Category;
  tags: string[];
  imagePlaceholder: string | null;
}
