import {
  ARCHIVE_MESSAGES,
  ARCHIVE_ENTRY_SEED,
  CONFESSION_SEED,
  CREATE_THREAD_DRAFT,
  ENCOUNTER_SEED,
  GHOST_IDENTITIES,
  LOG_SEED,
  ONLINE_COUNTS,
  SEEDED_CATEGORIES,
  SEEDED_CONTENT,
  SIGNAL_SEED,
  THREAD_SEED,
  WORLD_EVENT_SEED,
} from '@/lib/seed-data';
import { REPLY_SEED } from '@/lib/reply-seed';
import {
  Category,
  ContentType,
  CreateThreadDraft,
  ForumContent,
  ForumStats,
  GhostIdentity,
  Reply,
  ThreadContent,
  WorldEvent,
} from '@/lib/forum-types';

interface ContentFilter {
  category?: Category | 'ALL';
  type?: ContentType;
  limit?: number;
}

function byNewest(a: ForumContent, b: ForumContent) {
  return a.createdAt < b.createdAt ? 1 : -1;
}

function listContent(filter: ContentFilter = {}) {
  const { category = 'ALL', type, limit } = filter;
  const rows = SEEDED_CONTENT.filter((item) => {
    if (category !== 'ALL' && item.category !== category) return false;
    if (type && item.type !== type) return false;
    return true;
  }).sort(byNewest);

  return typeof limit === 'number' ? rows.slice(0, limit) : rows;
}

export const mockDb = {
  listContent,

  getHomepageThreads() {
    return THREAD_SEED;
  },

  getHotThreads() {
    return [...THREAD_SEED].sort((a, b) => b.viewCount - a.viewCount).slice(0, 5);
  },

  getArchiveEntries(category: Category | 'ALL' = 'ALL') {
    return listContent({ category, type: 'ARCHIVE_ENTRY' }) as typeof ARCHIVE_ENTRY_SEED;
  },

  getThreads(category: Category | 'ALL' = 'ALL') {
    return listContent({ category, type: 'THREAD' }) as typeof THREAD_SEED;
  },

  getConfessions() {
    return CONFESSION_SEED;
  },

  getSignals() {
    return SIGNAL_SEED;
  },

  getEncounters() {
    return ENCOUNTER_SEED;
  },

  getLogs() {
    return LOG_SEED;
  },

  getGhostIdentity(): GhostIdentity {
    return GHOST_IDENTITIES[0];
  },

  getCreateThreadDraft(): CreateThreadDraft {
    return CREATE_THREAD_DRAFT;
  },

  getWorldEvents(): WorldEvent[] {
    return WORLD_EVENT_SEED;
  },

  getArchiveMessages() {
    return ARCHIVE_MESSAGES;
  },

  getSeededCategories() {
    return SEEDED_CATEGORIES;
  },

  getOnlineSnapshot(tick = 0) {
    return ONLINE_COUNTS[tick % ONLINE_COUNTS.length];
  },

  getThread(id: string): ThreadContent | undefined {
    return THREAD_SEED.find((t) => t.id === id);
  },

  getThreadReplies(threadId: string): Reply[] {
    return REPLY_SEED[threadId] ?? [];
  },

  getHighlightedThreads(): ThreadContent[] {
    return THREAD_SEED.filter((t) => t.isHighlighted).slice(0, 6);
  },

  getPinnedThreads(): ThreadContent[] {
    return THREAD_SEED.filter((t) => t.pinned);
  },

  getRelatedThreads(category: string, excludeId: string, limit = 5): ThreadContent[] {
    return THREAD_SEED
      .filter((t) => t.category === category && t.id !== excludeId)
      .slice(0, limit);
  },

  getRecoveredEntries() {
    return ARCHIVE_ENTRY_SEED.slice(0, 3);
  },

  getForumStats(): ForumStats {
    const signalEntries = ARCHIVE_ENTRY_SEED.map((entry) => entry.signalStrength);
    const averageSignal =
      signalEntries.reduce((total, value) => total + value, 0) / signalEntries.length;

    return {
      totalEntries: SEEDED_CONTENT.length,
      activeThreads: THREAD_SEED.length,
      totalCategories: SEEDED_CATEGORIES.length,
      oldestEntry: '05/15/01',
      averageSignal: `${averageSignal.toFixed(1)} / 5`,
    };
  },
};
