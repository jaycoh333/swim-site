'use client';

import Link from 'next/link';
import { AmbientGrid } from '@/components/AmbientGrid';
import { NetworkFooter } from '@/components/NetworkFooter';
import { ShareBar } from '@/components/ShareBar';
import { CATEGORY_COLORS } from '@/lib/forum-types';
import type { DbRecoveredSignal } from '@/lib/supabase/types';

const SCANNER_URL = 'https://www.sw1m.me/scanner';

// SCRAPER INTEGRATION POINT:
//   In production, `approvedSignals` is fetched in app/scanner/page.tsx
//   (server component) and passed here as a prop. Scrapers insert rows into
//   Supabase with status='pending'. Curators approve at /scanner/queue.
//   Only status='approved' signals ever reach this component.

interface SignalEntry {
  id: string;
  source: string;
  category: string;
  categoryColor: string;
  summary: string;
  status: 'pending review' | 'approved' | 'archived';
  recovered: string;
}

function dbSignalToEntry(sig: DbRecoveredSignal): SignalEntry {
  const color = (CATEGORY_COLORS as Record<string, string>)[sig.category] ?? '#86d46e';
  return {
    id:            sig.id,
    source:        sig.source_name,
    category:      sig.category,
    categoryColor: color,
    summary:       sig.summary,
    status:        'approved',
    recovered:     sig.discovered_at.slice(0, 10),
  };
}

function buildSignalShareText(sig: SignalEntry): string {
  const preview = sig.summary.length > 160 ? sig.summary.slice(0, 157) + '...' : sig.summary;
  return `RECOVERED SIGNAL // ${sig.category.toUpperCase()} [${sig.id.toUpperCase()}]\n"${preview}"\n\nSource: ${sig.source}\nswim scanner: ${SCANNER_URL}`;
}

// Fallback mock data — displayed when no Supabase connection or no approved signals exist.
const MOCK_SIGNALS: SignalEntry[] = [
  {
    id: 'SIG-0847',
    source: 'Reddit (deleted)',
    category: 'Paranormal',
    categoryColor: '#79d986',
    summary:
      'User claimed to have recorded something in their attic for three weeks. Post removed within 6 hours. 47 comments captured before deletion. Moderator intervention logged.',
    status: 'pending review',
    recovered: '2024-11-14',
  },
  {
    id: 'SIG-0831',
    source: 'Pastebin (expired)',
    category: 'Simulation Theory',
    categoryColor: '#7aa8ff',
    summary:
      'A 4,000-word document titled "what I found in the gaps between frames" posted anonymously. IP trace leads to a residential address in Oslo that no longer exists in property records.',
    status: 'approved',
    recovered: '2024-10-28',
  },
  {
    id: 'SIG-0819',
    source: 'Wayback Machine',
    category: 'Lost Media',
    categoryColor: '#8ed2c5',
    summary:
      'A GeoCities mirror from 1998 documenting what appears to be a regional TV broadcast anomaly. Forty-seven people reported seeing the same interruption. Station denies the date occurred.',
    status: 'archived',
    recovered: '2024-09-03',
  },
  {
    id: 'SIG-0802',
    source: '4chan archive',
    category: 'Dreams',
    categoryColor: '#b083ff',
    summary:
      'Thread from /x/ in which 14 users independently described an identical room they had never physically visited. Thread deleted by moderators. Screenshots survived in a now-dead image host.',
    status: 'archived',
    recovered: '2024-08-17',
  },
  {
    id: 'SIG-0788',
    source: 'phpBB backup',
    category: 'Hidden History',
    categoryColor: '#b8c97a',
    summary:
      'Private forum post from a community of urban explorers who found documentation inside a government building demolished in 2019. Photographs attached. Location not disclosed.',
    status: 'pending review',
    recovered: '2024-12-01',
  },
  {
    id: 'SIG-0774',
    source: 'IRC log',
    category: 'AI',
    categoryColor: '#58a7ff',
    summary:
      'Conversation fragment from a 2019 IRC channel. A user shared logs from an early GPT-2 fine-tune that began outputting coordinates. All coordinates led to the same empty field in rural Nebraska.',
    status: 'approved',
    recovered: '2024-11-22',
  },
];

const STATUS_COLORS: Record<string, string> = {
  'pending review': '#d7a85c',
  'approved':       '#86d46e',
  'archived':       '#6da8ff',
};

const PROCESS_STEPS = [
  {
    step: '01',
    label: 'SCAN',
    desc: 'Automated monitors detect anomalies across dead and dying internet layers.',
  },
  {
    step: '02',
    label: 'REVIEW',
    desc: 'A human curator reads, evaluates, and categorizes each recovered signal.',
  },
  {
    step: '03',
    label: 'ARCHIVE',
    desc: 'Approved signals enter the permanent archive under the relevant channel.',
  },
];

export interface ScannerClientProps {
  approvedSignals?: DbRecoveredSignal[];
}

export function ScannerClient({ approvedSignals }: ScannerClientProps) {
  const signals: SignalEntry[] =
    approvedSignals && approvedSignals.length > 0
      ? approvedSignals.map(dbSignalToEntry)
      : MOCK_SIGNALS;

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
            <h1 className="text-[2rem] tracking-[0.10em] text-crt md:text-[2.6rem]">
              SCANNER
            </h1>
            <p className="mt-3 max-w-2xl text-[1.15rem] leading-relaxed tracking-[0.04em] text-crt/62 md:text-[1.25rem]">
              Monitoring forgotten internet edges for signals worth preserving.
            </p>
          </div>

          {/* ── System status bar ── */}
          <div className="border-b border-crt/10 bg-[rgba(134,212,110,0.025)] px-6 py-4 md:px-10">
            <div className="flex flex-wrap gap-x-8 gap-y-2 text-[12px] uppercase tracking-[0.18em]">
              <span>
                <span className="text-crt/30">node monitor</span>
                <span className="mx-2 text-crt/20">//</span>
                <span className="text-[#86d46e]/68">ACTIVE</span>
              </span>
              <span className="text-crt/45">
                <span className="text-crt/30">signals recovered</span>
                <span className="mx-2 text-crt/20">//</span>
                {signals.length > 0 ? signals.length : 847}
              </span>
              <span className="text-crt/45">
                <span className="text-crt/30">last scan</span>
                <span className="mx-2 text-crt/20">//</span>
                03:41:17
              </span>
            </div>
          </div>

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
              <p>
                Recovered signals are routed into the relevant category — Paranormal, Lost Media,
                Hidden History, Simulation Theory, and others — where they become part of
                the permanent record.
              </p>
            </div>

            {/* Process steps */}
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {PROCESS_STEPS.map(({ step, label, desc }) => (
                <div key={step} className="panel px-5 py-5">
                  <div className="mb-2 text-[11px] uppercase tracking-[0.22em] text-crt/35">{step}</div>
                  <div className="mb-2 text-[1.05rem] tracking-[0.14em] text-crt/85">{label}</div>
                  <p className="text-[13px] leading-relaxed tracking-[0.04em] text-crt/50">{desc}</p>
                </div>
              ))}
            </div>
          </div>

          {/* ── Signal queue ── */}
          <div className="border-b border-crt/10 px-6 py-8 md:px-10">
            <div className="mb-6 flex items-center gap-3">
              <span className="h-1.5 w-1.5 animate-pulse-glow bg-crt/55" aria-hidden="true" />
              <span className="text-[11px] uppercase tracking-[0.28em] text-crt/52">
                recovered signal queue
              </span>
            </div>

            <div className="terminal-card-grid">
              {signals.map((sig) => (
                <div
                  key={sig.id}
                  className="terminal-card px-5 py-5 md:px-7 md:py-6"
                  style={{ borderLeftColor: `${sig.categoryColor}55` }}
                >
                  {/* Signal meta row */}
                  <div className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                    <span className="text-[11px] uppercase tracking-[0.20em] text-crt/35">
                      {sig.id}
                    </span>
                    <span className="text-crt/18">·</span>
                    <span
                      className="text-[11px] uppercase tracking-[0.16em]"
                      style={{ color: `${sig.categoryColor}99` }}
                    >
                      {sig.category}
                    </span>
                    <span className="text-crt/18">·</span>
                    <span className="text-[11px] uppercase tracking-[0.14em] text-crt/35">
                      {sig.source}
                    </span>
                  </div>

                  {/* Summary */}
                  <p className="text-[1.05rem] leading-[1.58] tracking-[0.03em] text-crt/68">
                    {sig.summary}
                  </p>

                  {/* Footer row */}
                  <div className="mt-3.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span
                      className="text-[11px] uppercase tracking-[0.18em]"
                      style={{ color: STATUS_COLORS[sig.status] ?? '#86d46e' }}
                    >
                      ◈ {sig.status}
                    </span>
                    <span className="text-crt/18">·</span>
                    <span className="text-[11px] uppercase tracking-[0.14em] text-crt/30">
                      recovered {sig.recovered}
                    </span>
                  </div>

                  {/* Share */}
                  <div className="mt-3 border-t border-crt/8 pt-3">
                    <ShareBar
                      shareText={buildSignalShareText(sig)}
                      shareUrl={SCANNER_URL}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ── CTAs ── */}
          <div className="px-6 py-10 text-center md:px-10 md:py-12">
            <div className="mb-2 text-[11px] uppercase tracking-[0.28em] text-crt/38">
              contribute to the archive
            </div>
            <p className="mb-7 text-[1.05rem] leading-relaxed tracking-[0.04em] text-crt/55">
              Found something that should not be forgotten?
              <br className="hidden sm:block" />
              {' '}Post it as a thread. Curators monitor all incoming signals.
            </p>
            <div className="flex flex-col gap-4 sm:flex-row sm:justify-center">
              <Link href="/threads?compose=true" className="create-thread-cta">
                [ submit found signal ]
              </Link>
              <Link href="/threads" className="create-thread-cta">
                [ view recovered archive ]
              </Link>
            </div>
          </div>

          <NetworkFooter />
        </div>
      </div>
    </div>
  );
}
