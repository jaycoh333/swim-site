/**
 * Normalize all feed entry types for the SWIM AI Terminal component.
 * Pure utility — no server-only imports, safe in both server and client.
 */

import type { DbRecoveredSignal } from '@/lib/supabase/types';

export type TerminalEntryType =
  | 'SIGNAL RECOVERED'
  | 'THREAD REBORN'
  | 'SOURCE DISCOVERED'
  | 'READY FOR REBIRTH'
  | 'PUBLIC SUBMISSION'
  | 'SIGNAL ARCHIVED';

export type TerminalSeverity = 'normal' | 'warning' | 'highlight';

export interface TerminalEntry {
  id:        string;
  type:      TerminalEntryType;
  title:     string;
  source:    string;
  category:  string;
  timestamp: string;  // ISO
  severity:  TerminalSeverity;
  url?:      string;
}

export function signalsToTerminalFeed(signals: DbRecoveredSignal[]): TerminalEntry[] {
  const entries: TerminalEntry[] = [];

  for (const sig of signals) {
    const title = sig.title.length > 72 ? sig.title.slice(0, 69) + '…' : sig.title;

    if (sig.published_thread_id) {
      entries.push({
        id:        `${sig.id}-reborn`,
        type:      'THREAD REBORN',
        title,
        source:    sig.source_name,
        category:  sig.category,
        timestamp: sig.approved_at ?? sig.discovered_at,
        severity:  'highlight',
        url:       `/threads/${sig.published_thread_id}`,
      });
    } else if (sig.status === 'approved' || sig.status === 'rebirth-ready') {
      entries.push({
        id:        `${sig.id}-approved`,
        type:      'READY FOR REBIRTH',
        title,
        source:    sig.source_name,
        category:  sig.category,
        timestamp: sig.approved_at ?? sig.discovered_at,
        severity:  'warning',
      });
    }

    entries.push({
      id:        `${sig.id}-recovered`,
      type:      'SIGNAL RECOVERED',
      title,
      source:    sig.source_name,
      category:  sig.category,
      timestamp: sig.discovered_at,
      severity:  'normal',
    });
  }

  return entries
    .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
    .slice(0, 15);
}

// Fallback data used when Supabase is unavailable or returns no results.
const _past = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString();

export const MOCK_TERMINAL_FEED: TerminalEntry[] = [
  {
    id: 'mock-01', type: 'SIGNAL RECOVERED', severity: 'normal',
    title:    'Newspaper randomly appearing in apartment — no delivery scheduled',
    source:   'r/Glitch_in_the_Matrix', category: 'Simulation Theory',
    timestamp: _past(3),
  },
  {
    id: 'mock-02', type: 'THREAD REBORN', severity: 'highlight',
    title:    'Machine elf coordinates: Erowid archive entry 2001',
    source:   'Erowid Experience Vaults', category: 'Psychedelics',
    timestamp: _past(5),
  },
  {
    id: 'mock-03', type: 'SOURCE DISCOVERED', severity: 'normal',
    title:    'Wayback snapshot found — 1999 UFO forum capture',
    source:   'web.archive.org', category: 'UFOs',
    timestamp: _past(7),
  },
  {
    id: 'mock-04', type: 'SIGNAL RECOVERED', severity: 'normal',
    title:    'Four respondents describe identical visual seam in sky',
    source:   'AboveTopSecret Forums', category: 'Paranormal',
    timestamp: _past(9),
  },
  {
    id: 'mock-05', type: 'READY FOR REBIRTH', severity: 'warning',
    title:    'GeoCities mirror: 47 witnesses, same broadcast anomaly 1998',
    source:   'Wayback Machine', category: 'Lost Media',
    timestamp: _past(12),
  },
  {
    id: 'mock-06', type: 'SIGNAL RECOVERED', severity: 'normal',
    title:    'IRC log: early GPT-2 fine-tune outputting same coordinates',
    source:   'IRC Archive', category: 'AI',
    timestamp: _past(14),
  },
  {
    id: 'mock-07', type: 'THREAD REBORN', severity: 'highlight',
    title:    'phpBB backup: urban explorers — government building 2019',
    source:   'phpBB Archive', category: 'Hidden History',
    timestamp: _past(18),
  },
  {
    id: 'mock-08', type: 'SIGNAL RECOVERED', severity: 'normal',
    title:    '/x/ thread: 14 users describe identical room, never visited',
    source:   '4plebs Archive', category: 'Paranormal',
    timestamp: _past(21),
  },
  {
    id: 'mock-09', type: 'SIGNAL RECOVERED', severity: 'normal',
    title:    'r/Glitch: impossible road confirmed by 22 independent respondents',
    source:   'Reddit (deleted)', category: 'Simulation Theory',
    timestamp: _past(28),
  },
  {
    id: 'mock-10', type: 'READY FOR REBIRTH', severity: 'warning',
    title:    'Pastebin 4000-word document titled "gaps between frames"',
    source:   'Pastebin (expired)', category: 'Simulation Theory',
    timestamp: _past(35),
  },
];
