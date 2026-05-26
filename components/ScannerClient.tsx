'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AmbientGrid } from '@/components/AmbientGrid';
import { NetworkFooter } from '@/components/NetworkFooter';
import { ShareBar } from '@/components/ShareBar';
import { SwimAiTerminal } from '@/components/SwimAiTerminal';
import { signalsToTerminalFeed, MOCK_TERMINAL_FEED } from '@/lib/terminal-feed';
import { CATEGORY_COLORS } from '@/lib/forum-types';
import type { DbRecoveredSignal } from '@/lib/supabase/types';
import type { ScannerStats } from '@/lib/supabase/repository';

const SCANNER_URL = 'https://www.sw1m.me/scanner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface SignalEntry {
  id:             string;
  title:          string;
  source:         string;
  sourceType:     string;
  category:       string;
  categoryColor:  string;
  summary:        string;
  status:         'pending review' | 'approved' | 'archived';
  recovered:      string;
  sourceImageUrl: string;
  tags:           string[];
  isReborn:       boolean;
}

type ActivityType = 'recovered' | 'approved' | 'reborn' | 'submitted' | 'archived';

interface ActivityEvent {
  id:           string;
  type:         ActivityType;
  timestamp:    string;
  category:     string;
  titlePreview: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MOCK_STATS: ScannerStats = {
  totalRecovered:    847,
  pendingReview:     12,
  threadsReborn:     34,
  publicSubmissions: 218,
};

const STATUS_COLORS: Record<string, string> = {
  'pending review': '#d7a85c',
  'approved':       '#86d46e',
  'archived':       '#6da8ff',
};

const PROCESS_STEPS = [
  { step: '01', label: 'SCAN',    desc: 'Automated monitors detect anomalies across dead and dying internet layers.' },
  { step: '02', label: 'REVIEW',  desc: 'A human curator reads, evaluates, and categorizes each recovered signal.' },
  { step: '03', label: 'ARCHIVE', desc: 'Approved signals enter the permanent archive under the relevant channel.' },
];

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

function dbSignalToEntry(sig: DbRecoveredSignal): SignalEntry {
  const color = (CATEGORY_COLORS as Record<string, string>)[sig.category] ?? '#86d46e';
  return {
    id:             sig.id,
    title:          sig.title,
    source:         sig.source_name,
    sourceType:     sig.source_type,
    category:       sig.category,
    categoryColor:  color,
    summary:        sig.summary,
    status:         'approved',
    recovered:      sig.discovered_at.slice(0, 10),
    sourceImageUrl: sig.source_image_url ?? '',
    tags:           sig.tags ?? [],
    isReborn:       Boolean(sig.published_thread_id),
  };
}

function buildSignalShareText(sig: SignalEntry): string {
  const preview = sig.summary.length > 160 ? sig.summary.slice(0, 157) + '...' : sig.summary;
  return `RECOVERED SIGNAL // ${sig.category.toUpperCase()} [${sig.id.toUpperCase()}]\n"${preview}"\n\nSource: ${sig.source}\nswim scanner: ${SCANNER_URL}`;
}

function formatRelative(iso: string, now: number): string {
  const diff  = now - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins < 1)   return 'just now';
  if (mins < 60)  return `${mins}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return 'yesterday';
  if (days < 30)  return `${days} days ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}yr ago`;
}

// ---------------------------------------------------------------------------
// Mock signal data — fallback when Supabase unavailable
// ---------------------------------------------------------------------------

const MOCK_SIGNALS: SignalEntry[] = [
  {
    id: 'SIG-0847', title: 'Attic recording — post removed within 6 hours, 47 comments captured',
    source: 'Reddit (deleted)', sourceType: 'reddit',
    category: 'Paranormal', categoryColor: '#79d986',
    summary: 'User claimed to have recorded something in their attic for three weeks. Post removed within 6 hours. 47 comments captured before deletion. Moderator intervention logged.',
    status: 'pending review', recovered: '2024-11-14', sourceImageUrl: '', tags: ['reddit', 'deleted', 'attic'], isReborn: false,
  },
  {
    id: 'SIG-0831', title: '"What I found in the gaps between frames" — Oslo IP, property record absent',
    source: 'Pastebin (expired)', sourceType: 'pastebin',
    category: 'Simulation Theory', categoryColor: '#7aa8ff',
    summary: 'A 4,000-word document titled "what I found in the gaps between frames" posted anonymously. IP trace leads to a residential address in Oslo that no longer exists in property records.',
    status: 'approved', recovered: '2024-10-28', sourceImageUrl: '', tags: ['pastebin', 'simulation'], isReborn: false,
  },
  {
    id: 'SIG-0819', title: 'GeoCities 1998: 47 witnesses confirm regional TV broadcast anomaly',
    source: 'Wayback Machine', sourceType: 'wayback',
    category: 'Lost Media', categoryColor: '#8ed2c5',
    summary: 'A GeoCities mirror from 1998 documenting what appears to be a regional TV broadcast anomaly. Forty-seven people reported seeing the same interruption. Station denies the date occurred.',
    status: 'archived', recovered: '2024-09-03', sourceImageUrl: '', tags: ['geocities', 'tv', 'anomaly'], isReborn: true,
  },
  {
    id: 'SIG-0802', title: '/x/ thread: 14 users describe identical room — screenshots survived deletion',
    source: '4chan archive', sourceType: 'imageboard',
    category: 'Dreams', categoryColor: '#b083ff',
    summary: 'Thread from /x/ in which 14 users independently described an identical room they had never physically visited. Thread deleted by moderators. Screenshots survived in a now-dead image host.',
    status: 'archived', recovered: '2024-08-17', sourceImageUrl: '', tags: ['4chan', 'collective', 'dreams'], isReborn: false,
  },
  {
    id: 'SIG-0788', title: 'phpBB backup: urban explorers — government building demolished 2019',
    source: 'phpBB backup', sourceType: 'forum',
    category: 'Hidden History', categoryColor: '#b8c97a',
    summary: 'Private forum post from a community of urban explorers who found documentation inside a government building demolished in 2019. Photographs attached. Location not disclosed.',
    status: 'pending review', recovered: '2024-12-01', sourceImageUrl: '', tags: ['forum', 'urbex', 'government'], isReborn: false,
  },
  {
    id: 'SIG-0774', title: 'IRC 2019: GPT-2 fine-tune outputs coordinates — all lead to same Nebraska field',
    source: 'IRC log', sourceType: 'irc',
    category: 'AI', categoryColor: '#58a7ff',
    summary: 'Conversation fragment from a 2019 IRC channel. A user shared logs from an early GPT-2 fine-tune that began outputting coordinates. All coordinates led to the same empty field in rural Nebraska.',
    status: 'approved', recovered: '2024-11-22', sourceImageUrl: '', tags: ['irc', 'ai', 'gpt-2'], isReborn: true,
  },
];

// ---------------------------------------------------------------------------
// Category visual fallback — rendered when no source image is available
// ---------------------------------------------------------------------------

const SOURCE_SYMBOLS: Record<string, string> = {
  reddit:     '⌬',
  wayback:    '◈',
  mediawiki:  '⊞',
  forum:      '▣',
  imageboard: '◩',
  archive:    '◫',
  bbs:        '⌗',
  pastebin:   '⊜',
  irc:        '⊗',
  other:      '◈',
};

function CategoryVisualFallback({
  category,
  categoryColor,
  sourceType,
}: {
  category:      string;
  categoryColor: string;
  sourceType:    string;
}) {
  const symbol = SOURCE_SYMBOLS[sourceType] ?? '◈';
  return (
    <div
      className="relative h-28 w-full overflow-hidden"
      style={{
        background:   `linear-gradient(135deg, ${categoryColor}14 0%, ${categoryColor}04 55%, transparent 100%)`,
        borderBottom: `1px solid ${categoryColor}15`,
      }}
    >
      {/* Grid overlay */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:  `linear-gradient(${categoryColor}07 1px, transparent 1px), linear-gradient(90deg, ${categoryColor}07 1px, transparent 1px)`,
          backgroundSize:   '20px 20px',
        }}
      />
      {/* Centre symbol */}
      <div className="absolute inset-0 flex items-center justify-center">
        <span
          className="select-none font-mono text-[52px] leading-none"
          style={{ color: `${categoryColor}16` }}
        >
          {symbol}
        </span>
      </div>
      {/* Category label */}
      <div className="absolute bottom-2 left-3">
        <span
          className="font-mono text-[10px] uppercase tracking-[0.18em]"
          style={{ color: `${categoryColor}55` }}
        >
          {category}
        </span>
      </div>
      {/* Source type */}
      {sourceType && (
        <div className="absolute bottom-2 right-3">
          <span
            className="font-mono text-[10px] uppercase tracking-[0.18em]"
            style={{ color: `${categoryColor}40` }}
          >
            {sourceType}
          </span>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// ScannerStatsBlock
// ---------------------------------------------------------------------------

function ScannerStatsBlock({ stats }: { stats: ScannerStats }) {
  const items = [
    { label: 'signals recovered',  value: stats.totalRecovered   },
    { label: 'pending review',     value: stats.pendingReview    },
    { label: 'threads reborn',     value: stats.threadsReborn    },
    { label: 'public submissions', value: stats.publicSubmissions },
  ] as const;

  return (
    <div className="border-b border-crt/10 bg-[rgba(134,212,110,0.018)] px-6 py-5 md:px-10">
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
        {items.map(({ label, value }) => (
          <div key={label}>
            <div className="mb-1 text-[11px] uppercase tracking-[0.20em] text-crt/30">{label}</div>
            <div className="font-mono text-[1.6rem] tracking-[0.04em] text-crt/80 md:text-[1.8rem]">
              {value}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ActivityTimeline
// ---------------------------------------------------------------------------

function ActivityTimeline({ events, now }: { events: ActivityEvent[]; now: number }) {
  const ACTIVITY_LABELS: Record<ActivityType, string> = {
    recovered: 'signal recovered',
    approved:  'signal approved',
    reborn:    'thread reborn',
    submitted: 'public submission',
    archived:  'signal archived',
  };
  const ACTIVITY_COLORS: Record<ActivityType, string> = {
    recovered: 'rgba(134,212,110,0.55)',
    approved:  '#86d46e',
    reborn:    '#d7a85c',
    submitted: '#6da8ff',
    archived:  'rgba(109,168,255,0.45)',
  };

  if (events.length === 0) return null;

  return (
    <div className="border-b border-crt/10 px-6 py-8 md:px-10">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="h-1.5 w-1.5 animate-pulse-glow bg-crt/55" aria-hidden="true" />
          <span className="text-[11px] uppercase tracking-[0.28em] text-crt/48">activity stream</span>
        </div>
        <span className="text-[10px] uppercase tracking-[0.18em] text-crt/22">auto-refresh · 50s</span>
      </div>

      <div className="divide-y divide-crt/[0.06]">
        {events.map((evt) => {
          const color = ACTIVITY_COLORS[evt.type];
          const label = ACTIVITY_LABELS[evt.type];
          const relTime = now ? formatRelative(evt.timestamp, now) : '—';
          return (
            <div key={evt.id} className="flex items-start gap-3 py-3">
              <div className="mt-[5px] h-[7px] w-[7px] shrink-0" style={{ backgroundColor: color }} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-[15px] uppercase tracking-[0.14em]" style={{ color }}>{label}</span>
                  <span className="text-crt/22 text-[13px]">/</span>
                  <span className="text-[15px] uppercase tracking-[0.10em] text-crt/48">{evt.category}</span>
                  <span className="ml-auto shrink-0 font-mono text-[13px] tabular-nums text-crt/28" suppressHydrationWarning>
                    {relTime}
                  </span>
                </div>
                {evt.titlePreview && (
                  <p className="mt-0.5 truncate text-[15px] leading-snug tracking-[0.02em] text-crt/45">
                    {evt.titlePreview}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Signal card
// ---------------------------------------------------------------------------

function SignalCard({ sig, shareText }: { sig: SignalEntry; shareText: string }) {
  return (
    <div
      className="terminal-card overflow-hidden"
      style={{ borderLeftColor: `${sig.categoryColor}40` }}
    >
      {/* Visual header */}
      {sig.sourceImageUrl ? (
        <div className="relative h-28 w-full overflow-hidden">
          <img src={sig.sourceImageUrl} alt="" className="h-full w-full object-cover opacity-60" />
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 to-transparent" />
          <div className="absolute bottom-2 left-3">
            <span
              className="rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest"
              style={{ color: sig.isReborn ? '#d7a85c' : '#86d46e', background: 'rgba(0,0,0,0.55)' }}
            >
              {sig.isReborn ? '◈ REBORN' : '◈ RECOVERED'}
            </span>
          </div>
        </div>
      ) : (
        <div className="relative">
          <CategoryVisualFallback
            category={sig.category}
            categoryColor={sig.categoryColor}
            sourceType={sig.sourceType}
          />
          <div className="absolute bottom-2 left-3">
            <span
              className="rounded-sm px-1.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-widest"
              style={{ color: sig.isReborn ? '#d7a85c' : '#86d46e', background: 'rgba(0,0,0,0.55)' }}
            >
              {sig.isReborn ? '◈ REBORN' : '◈ RECOVERED'}
            </span>
          </div>
        </div>
      )}

      <div className="px-5 py-5 md:px-6 md:py-6">

        {/* Meta row: category + signal ID */}
        <div className="mb-2.5 flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className="text-[12px] uppercase tracking-[0.16em]"
            style={{ color: `${sig.categoryColor}99` }}
          >
            {sig.category}
          </span>
          <span className="text-crt/18">·</span>
          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-crt/30">
            {sig.id}
          </span>
          <span className="text-crt/18">·</span>
          <span className="text-[11px] uppercase tracking-[0.12em] text-crt/28">
            {sig.source}
          </span>
        </div>

        {/* Title */}
        <p className="mb-3 text-[1.45rem] font-bold leading-snug tracking-[0.02em] text-crt/92 md:text-[1.6rem]">
          {sig.title}
        </p>

        {/* Quote-style excerpt */}
        <div
          className="mb-3 border-l-2 pl-3"
          style={{ borderColor: `${sig.categoryColor}30` }}
        >
          <p className="text-[1.1rem] leading-[1.65] tracking-[0.02em] text-crt/62 md:text-[1.2rem]">
            {sig.summary}
          </p>
        </div>

        {/* Tags */}
        {sig.tags.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-1.5">
            {sig.tags.slice(0, 5).map((tag) => (
              <span
                key={tag}
                className="rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.12em]"
                style={{ color: `${sig.categoryColor}70`, background: `${sig.categoryColor}08`, border: `1px solid ${sig.categoryColor}15` }}
              >
                {tag}
              </span>
            ))}
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span
            className="text-[12px] uppercase tracking-[0.18em]"
            style={{ color: STATUS_COLORS[sig.status] ?? '#86d46e' }}
          >
            ◈ {sig.status}
          </span>
          <span className="text-crt/18">·</span>
          <span className="text-[11px] uppercase tracking-[0.14em] text-crt/28">
            recovered {sig.recovered}
          </span>
        </div>

        {/* Share */}
        <div className="mt-3 border-t border-crt/8 pt-3">
          <ShareBar shareText={shareText} shareUrl={SCANNER_URL} />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// ScannerClient
// ---------------------------------------------------------------------------

export interface ScannerClientProps {
  approvedSignals?: DbRecoveredSignal[];
  stats?:           ScannerStats;
  isLive?:          boolean;
}

export function ScannerClient({ approvedSignals, stats, isLive = false }: ScannerClientProps) {
  const router = useRouter();

  const [now, setNow] = useState<number>(0);

  useEffect(() => {
    setNow(Date.now());
    const tickId = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(tickId);
  }, []);

  useEffect(() => {
    const refreshId = setInterval(() => router.refresh(), 50_000);
    return () => clearInterval(refreshId);
  }, [router]);

  const signals: SignalEntry[] =
    approvedSignals && approvedSignals.length > 0
      ? approvedSignals.map(dbSignalToEntry)
      : isLive ? [] : MOCK_SIGNALS;

  const activityEvents: ActivityEvent[] =
    approvedSignals && approvedSignals.length > 0
      ? buildActivityEvents(approvedSignals)
      : isLive ? [] : MOCK_ACTIVITY;

  const displayStats = stats ?? (isLive
    ? { totalRecovered: 0, pendingReview: 0, threadsReborn: 0, publicSubmissions: 0 }
    : MOCK_STATS);

  const terminalFeed =
    approvedSignals && approvedSignals.length > 0
      ? signalsToTerminalFeed(approvedSignals)
      : MOCK_TERMINAL_FEED;

  const terminalStats = {
    recoveredToday:   displayStats.totalRecovered,
    sourcesMonitored: 8,
    threadsReborn:    displayStats.threadsReborn,
    pendingReview:    displayStats.pendingReview,
  };

  return (
    <div className="relative min-h-screen overflow-hidden pb-[72px] pt-[80px] md:pb-8 md:pt-[100px]">
      <AmbientGrid className="pointer-events-none absolute inset-0 opacity-20" />

      <div className="relative z-10 mx-auto max-w-4xl px-4 py-4 md:px-6 md:py-6">
        <div className="forum-shell overflow-hidden">

          {/* ── Page header ── */}
          <div className="border-b border-crt/12 px-6 py-8 md:px-10 md:py-10">
            <div className="mb-2 text-[11px] uppercase tracking-[0.30em] text-crt/40">
              swim · recovered signals terminal
            </div>
            <h1 className="text-[2.2rem] tracking-[0.10em] text-crt md:text-[2.8rem]">
              SCANNER
            </h1>
            <p className="mt-3 max-w-2xl text-[1.2rem] leading-relaxed tracking-[0.04em] text-crt/62 md:text-[1.3rem]">
              Monitoring forgotten internet edges for signals worth preserving.
            </p>
          </div>

          {/* ── Scanner stats ── */}
          <ScannerStatsBlock stats={displayStats} />

          {/* ── SWIM AI Terminal ── */}
          <div className="border-b border-crt/10 px-6 py-8 md:px-10">
            <div className="mb-5 flex items-center gap-3">
              <span className="h-1.5 w-1.5 animate-pulse-glow bg-crt/55" aria-hidden="true" />
              <span className="text-[11px] uppercase tracking-[0.28em] text-crt/48">
                live signal feed
              </span>
            </div>
            <SwimAiTerminal entries={terminalFeed} stats={terminalStats} />
          </div>

          {/* ── Activity timeline ── */}
          <ActivityTimeline events={activityEvents} now={now} />

          {/* ── About section ── */}
          <div className="border-b border-crt/10 px-6 py-8 md:px-10">
            <div className="mb-5 text-[11px] uppercase tracking-[0.28em] text-crt/38">
              system overview
            </div>
            <div className="max-w-2xl space-y-4 text-[1.1rem] leading-relaxed tracking-[0.03em] text-crt/65 md:text-[1.15rem]">
              <p>
                SWIM monitors forgotten internet edges — deleted threads, expired pastes,
                archived boards, dead imageboards, and sites that no longer exist — for
                signals worth preserving.
              </p>
              <p>
                Every recovered signal passes through human review before entering the archive.
                No automated posts. No scrapers publishing raw content. The path is:{' '}
                <span className="text-crt/82 tracking-[0.07em]">recover → review → archive.</span>
              </p>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {PROCESS_STEPS.map(({ step, label, desc }) => (
                <div key={step} className="panel px-5 py-5">
                  <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-crt/35">{step}</div>
                  <div className="mb-2 text-[1.05rem] tracking-[0.14em] text-crt/85">{label}</div>
                  <p className="text-[14px] leading-relaxed tracking-[0.04em] text-crt/50">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Signal archive cards ── */}
          <div className="border-b border-crt/10 px-6 py-8 md:px-10">
            <div className="mb-6 flex items-center gap-3">
              <span className="h-1.5 w-1.5 animate-pulse-glow bg-crt/55" aria-hidden="true" />
              <span className="text-[11px] uppercase tracking-[0.28em] text-crt/52">
                recovered signal archive
              </span>
            </div>

            {signals.length === 0 && (
              <p className="text-[1rem] tracking-[0.04em] text-crt/38">
                No recovered signals approved yet.
              </p>
            )}

            <div className="terminal-card-grid">
              {signals.map((sig) => (
                <SignalCard
                  key={sig.id}
                  sig={sig}
                  shareText={buildSignalShareText(sig)}
                />
              ))}
            </div>
          </div>

          {/* ── CTAs ── */}
          <div className="px-6 py-10 text-center md:px-10 md:py-12">
            <div className="mb-2 text-[11px] uppercase tracking-[0.28em] text-crt/38">
              contribute to the archive
            </div>
            <p className="mb-7 text-[1.1rem] leading-relaxed tracking-[0.04em] text-crt/55">
              Found something that should not be forgotten?
              <br className="hidden sm:block" />
              {' '}Submit it. Curators review all signals before anything enters the archive.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Link href="/scanner/submit" className="create-thread-cta">[ submit found signal ]</Link>
              <Link href="/threads"        className="create-thread-cta">[ view recovered archive ]</Link>
            </div>
          </div>

          <NetworkFooter />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Helpers (referenced above — defined after to keep component readable)
// ---------------------------------------------------------------------------

function buildActivityEvents(signals: DbRecoveredSignal[]): ActivityEvent[] {
  const events: ActivityEvent[] = [];
  for (const sig of signals) {
    const shortTitle = sig.title.length > 68 ? sig.title.slice(0, 65) + '…' : sig.title;
    if (sig.published_thread_id) {
      events.push({ id: `${sig.id}-reborn`,    type: 'reborn',    timestamp: sig.approved_at ?? sig.discovered_at, category: sig.category, titlePreview: shortTitle });
    } else {
      events.push({ id: `${sig.id}-approved`,  type: 'approved',  timestamp: sig.approved_at ?? sig.discovered_at, category: sig.category, titlePreview: shortTitle });
    }
    events.push({   id: `${sig.id}-recovered`, type: 'recovered', timestamp: sig.discovered_at,                    category: sig.category, titlePreview: shortTitle });
  }
  return events.sort((a, b) => b.timestamp.localeCompare(a.timestamp)).slice(0, 15);
}

const MOCK_ACTIVITY: ActivityEvent[] = [
  { id: 'm01', type: 'reborn',    timestamp: '2024-12-01T14:22:00Z', category: 'Lost Media',         titlePreview: "regional children's program denied by production co…" },
  { id: 'm02', type: 'approved',  timestamp: '2024-11-28T09:15:00Z', category: 'Simulation Theory',  titlePreview: 'four posters confirmed the same visual seam independently' },
  { id: 'm03', type: 'submitted', timestamp: '2024-11-22T18:44:00Z', category: 'Paranormal',         titlePreview: '' },
  { id: 'm04', type: 'recovered', timestamp: '2024-11-20T03:11:00Z', category: 'Dreams',             titlePreview: 'recurring tower geometry across 14 unrelated submissions' },
  { id: 'm05', type: 'approved',  timestamp: '2024-11-14T21:30:00Z', category: 'Hidden History',     titlePreview: 'phpBB urban exploration: identical acoustic anomaly' },
  { id: 'm06', type: 'reborn',    timestamp: '2024-11-10T07:55:00Z', category: 'Surveillance State', titlePreview: 'IRC log: coordinated service interruptions, no source found' },
  { id: 'm07', type: 'recovered', timestamp: '2024-10-28T16:20:00Z', category: 'Paranormal',         titlePreview: 'GeoCities guestbook: 11 visitors, identical low-altitude light' },
  { id: 'm08', type: 'recovered', timestamp: '2024-09-03T11:45:00Z', category: 'Simulation Theory',  titlePreview: 'r/Glitch: impossible road confirmed by 22 respondents' },
];
