/**
 * /scanner/admin — Scanner operator hub.
 *
 * ACCESS GATE: requires CURATOR_QUEUE_ENABLED=true in .env.local.
 * Returns 404 when not set so the route doesn't leak to unauthenticated users.
 */

import { notFound } from 'next/navigation';
import { AmbientGrid } from '@/components/AmbientGrid';
import { NetworkFooter } from '@/components/NetworkFooter';
import { AdminNav } from '@/components/AdminNav';
import {
  getScannerStats,
  getRecoveredSignals,
  getScannerSources,
} from '@/lib/supabase/repository';

export const dynamic = 'force-dynamic';

const OPERATOR_FLOW = [
  { num: 1, label: 'Add / Enable Sources', desc: 'Register source URLs and flip the source to ENABLED.',              href: '/scanner/sources' },
  { num: 2, label: 'Run Fetch Session',    desc: 'Click RUN FETCH SESSION — one page per source, no crawl.',         href: '/scanner/sources' },
  { num: 3, label: 'Queue Candidates',     desc: 'Review the preview card, edit fields, then click Queue Candidate.', href: '/scanner/sources' },
  { num: 4, label: 'Review Evidence',      desc: 'Open Signal Queue, read the evidence, mark Rebirth Ready.',         href: '/scanner/queue'   },
  { num: 5, label: 'Rebirth as Thread',    desc: 'Edit the body, complete the checklist, publish the thread.',        href: '/scanner/queue'   },
  { num: 6, label: 'Copy Socials',         desc: 'Copy the Telegram post and X thread — no API calls, manual paste.', href: '/scanner/queue'  },
];

const HUB_CARDS = [
  {
    title: 'Scanner Sources',
    desc:  'Add and enable sources. Run fetch sessions. Discover links.',
    bullets: ['Manage source registry', 'Enable/disable sources', 'Run fetch sessions', 'Discover content links'],
    href:  '/scanner/sources',
    cta:   '→ Open Sources',
    color: '#86d46e',
    bg:    'rgba(134,212,110,0.06)',
    border:'rgba(134,212,110,0.30)',
  },
  {
    title: 'Signal Queue',
    desc:  'Review queued candidates, approve or reject, rebirth as threads.',
    bullets: ['Review evidence', 'Approve / reject / archive', 'Mark rebirth ready', 'Publish as thread'],
    href:  '/scanner/queue',
    cta:   '→ Open Queue',
    color: '#86d46e',
    bg:    'rgba(134,212,110,0.06)',
    border:'rgba(134,212,110,0.30)',
  },
  {
    title: 'Public Submit Page',
    desc:  'The form users fill out to submit a found signal.',
    bullets: ['View the public submission form', 'Test the intake flow'],
    href:  '/scanner/submit',
    cta:   '→ Open Submit',
    color: 'rgba(77,184,200,0.80)',
    bg:    'rgba(77,184,200,0.04)',
    border:'rgba(77,184,200,0.22)',
  },
  {
    title: 'Public Scanner Page',
    desc:  'The live public page showing approved recovered signals.',
    bullets: ['View approved signals', 'What the public sees'],
    href:  '/scanner',
    cta:   '→ Open Scanner',
    color: 'rgba(77,184,200,0.80)',
    bg:    'rgba(77,184,200,0.04)',
    border:'rgba(77,184,200,0.22)',
  },
  {
    title: 'Threads Archive',
    desc:  'The public reborn threads that have been published.',
    bullets: ['View published threads', 'Confirm rebirths went live'],
    href:  '/threads',
    cta:   '→ Open Threads',
    color: 'rgba(215,168,92,0.80)',
    bg:    'rgba(215,168,92,0.04)',
    border:'rgba(215,168,92,0.22)',
  },
];

export default async function ScannerAdminPage() {
  if (process.env.CURATOR_QUEUE_ENABLED !== 'true') {
    notFound();
  }

  const [stats, rebirthReady, sources] = await Promise.all([
    getScannerStats(),
    getRecoveredSignals('rebirth-ready'),
    getScannerSources(),
  ]);

  const enabledSources = sources.filter((s) => s.enabled).length;

  const statItems = [
    { label: 'Total Recovered',    value: stats.totalRecovered,    color: '#86d46e'              },
    { label: 'Pending Review',     value: stats.pendingReview,     color: stats.pendingReview > 0     ? '#d7a85c' : 'rgba(134,212,110,0.38)' },
    { label: 'Rebirth Ready',      value: rebirthReady.length,     color: rebirthReady.length > 0     ? '#86d46e' : 'rgba(134,212,110,0.38)' },
    { label: 'Threads Reborn',     value: stats.threadsReborn,     color: stats.threadsReborn > 0     ? '#86d46e' : 'rgba(134,212,110,0.38)' },
    { label: 'Enabled Sources',    value: enabledSources,          color: enabledSources > 0          ? '#86d46e' : 'rgba(134,212,110,0.38)' },
    { label: 'Public Submissions', value: stats.publicSubmissions, color: 'rgba(134,212,110,0.55)'   },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden pb-8 pt-[80px] md:pt-[100px]">
      <AmbientGrid className="pointer-events-none absolute inset-0 opacity-[0.025]" />

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-6 md:px-6">

        {/* ── Page header ── */}
        <div className="mb-6">
          <p className="mb-1 text-[13px] font-medium uppercase tracking-[0.22em] text-crt/32">
            SWIM · Scanner Admin
          </p>
          <h1 className="mb-2 text-[40px] font-black leading-tight text-crt/92 md:text-[48px]">
            Admin Hub
          </h1>
          <p className="mb-5 text-[18px] text-crt/50">
            Curator operator dashboard — all scanner tools in one place.
          </p>

          {/* Nav */}
          <AdminNav current="admin" />
        </div>

        {/* ── Status stats ── */}
        <div
          className="mb-6 overflow-hidden border border-crt/12"
          style={{ background: 'rgba(8,12,6,0.92)' }}
        >
          <div className="border-b border-crt/10 px-6 py-4">
            <h2 className="text-[14px] font-semibold uppercase tracking-[0.18em] text-crt/40">
              System Status
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-px bg-crt/8 sm:grid-cols-3 md:grid-cols-6">
            {statItems.map(({ label, value, color }) => (
              <div key={label} className="bg-[rgba(8,12,6,0.95)] px-5 py-5 text-center">
                <div
                  className="font-mono text-[2.2rem] font-black leading-none tabular-nums"
                  style={{ color }}
                >
                  {value}
                </div>
                <div className="mt-2 text-[12px] font-semibold uppercase tracking-[0.12em] text-crt/35">
                  {label}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Hub cards ── */}
        <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
          {HUB_CARDS.map((card) => (
            <a
              key={card.href}
              href={card.href}
              className="group block overflow-hidden border transition-all hover:scale-[1.01]"
              style={{
                borderColor: card.border,
                background:  card.bg,
              }}
            >
              <div className="px-6 py-6">
                <h3
                  className="mb-2 text-[22px] font-black uppercase tracking-[0.06em]"
                  style={{ color: card.color }}
                >
                  {card.title}
                </h3>
                <p className="mb-4 text-[16px] leading-relaxed text-crt/60">
                  {card.desc}
                </p>
                <ul className="mb-5 space-y-1.5">
                  {card.bullets.map((b) => (
                    <li key={b} className="flex items-center gap-2 text-[15px] text-crt/48">
                      <span style={{ color: card.color }}>◈</span>
                      {b}
                    </li>
                  ))}
                </ul>
                <div
                  className="inline-flex min-h-[48px] items-center border px-5 text-[16px] font-bold transition-all group-hover:opacity-100"
                  style={{ borderColor: card.border, color: card.color, opacity: 0.75 }}
                >
                  {card.cta}
                </div>
              </div>
            </a>
          ))}
        </div>

        {/* ── Operator flow ── */}
        <div
          className="mb-8 overflow-hidden border border-crt/12"
          style={{ background: 'rgba(8,12,6,0.92)' }}
        >
          <div className="border-b border-crt/10 px-6 py-4">
            <h2 className="text-[14px] font-semibold uppercase tracking-[0.18em] text-crt/40">
              Operator Flow
            </h2>
          </div>
          <div className="divide-y divide-crt/8">
            {OPERATOR_FLOW.map((step) => (
              <a
                key={step.num}
                href={step.href}
                className="flex items-start gap-5 px-6 py-5 transition-colors hover:bg-[rgba(134,212,110,0.03)]"
              >
                <div
                  className="mt-0.5 shrink-0 font-mono text-[2.8rem] font-black leading-none tabular-nums"
                  style={{ color: 'rgba(134,212,110,0.22)', minWidth: '2.5rem' }}
                >
                  {step.num}
                </div>
                <div>
                  <p className="text-[20px] font-bold text-crt/88">{step.label}</p>
                  <p className="mt-1 text-[16px] leading-relaxed text-crt/48">{step.desc}</p>
                </div>
              </a>
            ))}
          </div>
        </div>

        <NetworkFooter />
      </div>
    </div>
  );
}
