'use client';

/**
 * SignalQueueClient — curator interface for reviewing and rebirthng recovered signals.
 *
 * OPERATOR MODE: readability-first layout.
 * - Sticky filter toolbar (tabs + secondary filters)
 * - Large text: 17–20px body, 13–15px metadata
 * - High-contrast typography
 * - Large tap-target action buttons (min 44px height)
 * - Terminal case-file card structure
 *
 * HUMAN APPROVAL GATE:
 *   Nothing publishes automatically. Every status change and rebirth requires
 *   an explicit curator action.
 */

import Link from 'next/link';
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AmbientGrid } from '@/components/AmbientGrid';
import { IntakeFormClient } from '@/components/IntakeFormClient';
import {
  updateSignalStatusAction,
  rebirthSignalAsThreadAction,
} from '@/app/actions';
import {
  formatTelegramPost,
  formatXPost,
  xPostTitleTruncated,
} from '@/lib/social-formatters';
import { CATEGORY_ORDER } from '@/lib/forum-types';
import type { DbRecoveredSignal, RecoveredSignalStatus, SignalSourceType } from '@/lib/supabase/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const STATUS_TABS: Array<{ key: RecoveredSignalStatus | 'all'; label: string }> = [
  { key: 'all',      label: 'ALL'      },
  { key: 'pending',  label: 'PENDING'  },
  { key: 'approved', label: 'APPROVED' },
  { key: 'archived', label: 'ARCHIVED' },
  { key: 'rejected', label: 'REJECTED' },
];

const STATUS_SECTION_ORDER: RecoveredSignalStatus[] = ['pending', 'approved', 'archived', 'rejected'];

const SECTION_LABELS: Record<RecoveredSignalStatus, string> = {
  pending:  'PENDING REVIEW',
  approved: 'APPROVED',
  archived: 'ARCHIVED',
  rejected: 'REJECTED',
};

const STATUS_COLORS: Record<RecoveredSignalStatus, string> = {
  pending:  '#d7a85c',
  approved: '#86d46e',
  archived: '#6da8ff',
  rejected: '#ff6b6b',
};

const SOURCE_TYPE_LABELS: Record<SignalSourceType, string> = {
  reddit:     'Reddit',
  forum:      'Forum',
  pastebin:   'Paste',
  wayback:    'Wayback',
  imageboard: 'Imageboard',
  irc:        'IRC',
  other:      'Other',
};

const REBIRTH_SCORE_THRESHOLD = 7;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface PublishResult {
  threadSlug:     string;
  telegramText:   string;
  xText:          string;
  titleTruncated: boolean;
}

interface RebirthPayload {
  title:    string;
  body:     string;
  category: string;
  tags:     string[];
}

// ---------------------------------------------------------------------------
// Utilities (client-side replication of formatSignalBody for preview)
// ---------------------------------------------------------------------------

function buildPreviewBody(sig: DbRecoveredSignal): string {
  const lines = [
    `> RECOVERED SIGNAL // ${sig.category.toUpperCase()}`,
    `> source: ${sig.source_name} · ${sig.source_type}`,
    `> anomaly score: ${sig.anomaly_score}/10`,
    `> discovered: ${sig.discovered_at.slice(0, 10)}`,
    '',
    sig.summary,
  ];
  if (sig.source_url) lines.push('', `source: ${sig.source_url}`);
  lines.push(
    '',
    '[ curator note: add context about how this signal was found and why it matters — remove this line before the thread goes live ]',
  );
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// AnomalyBar — enlarged for operator readability
// ---------------------------------------------------------------------------

function AnomalyBar({ score }: { score: number }) {
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex gap-[4px]">
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={i}
            className="h-[16px] w-[9px]"
            style={{
              backgroundColor: i < score
                ? score >= 8 ? '#ff6b6b' : score >= 6 ? '#d7a85c' : '#86d46e'
                : 'rgba(134,212,110,0.12)',
            }}
          />
        ))}
      </div>
      <span className="text-[14px] tabular-nums tracking-[0.10em] text-crt/55">
        {score}/10
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CopyButton
// ---------------------------------------------------------------------------

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(text).catch(() => {
      const el = document.createElement('textarea');
      el.value = text;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
    });
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={handleCopy}
      className="text-[12px] uppercase tracking-[0.14em] text-crt/42 transition-colors hover:text-crt/70"
    >
      {copied ? '✓ copied' : '[ copy ]'}
    </button>
  );
}

// ---------------------------------------------------------------------------
// SharePackagePanel — shown after successful rebirth
// ---------------------------------------------------------------------------

function SharePackagePanel({ result }: { result: PublishResult }) {
  return (
    <div className="mt-5 border-t border-crt/12 pt-5">
      <div className="mb-5 flex items-center justify-between gap-4">
        <div>
          <div className="mb-1 text-[12px] uppercase tracking-[0.26em] text-[#d7a85c]/80">
            ◈ thread reborn
          </div>
          <div className="text-[13px] uppercase tracking-[0.16em] text-crt/42">
            story restored to archive
          </div>
        </div>
        <Link
          href={`/threads/${result.threadSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 text-[13px] uppercase tracking-[0.16em] text-[#86d46e]/75 transition-colors hover:text-[#86d46e]"
        >
          ✓ view reborn thread ↗
        </Link>
      </div>

      <div className="mb-4 text-[12px] uppercase tracking-[0.22em] text-crt/32">
        share package — copy and post manually
      </div>

      <div className="mb-4">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-[12px] uppercase tracking-[0.18em] text-crt/32">telegram</span>
          <CopyButton text={result.telegramText} />
        </div>
        <div className="border border-crt/12 bg-[rgba(134,212,110,0.02)] px-4 py-3 font-mono text-[13px] leading-relaxed tracking-[0.03em] text-crt/52 whitespace-pre-wrap">
          {result.telegramText}
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <span className="text-[12px] uppercase tracking-[0.18em] text-crt/32">x.com</span>
            <span
              className="text-[12px] tabular-nums tracking-[0.10em]"
              style={{ color: result.xText.length > 260 ? '#d7a85c' : 'rgba(134,212,110,0.35)' }}
            >
              {result.xText.length}/280
            </span>
            {result.titleTruncated && (
              <span className="text-[12px] uppercase tracking-[0.10em] text-[#d7a85c]/75">
                title truncated
              </span>
            )}
          </div>
          <CopyButton text={result.xText} />
        </div>
        <div className="border border-crt/12 bg-[rgba(134,212,110,0.02)] px-4 py-3 font-mono text-[13px] leading-relaxed tracking-[0.03em] text-crt/52 whitespace-pre-wrap">
          {result.xText}
        </div>
        <p className="mt-2 text-[12px] uppercase tracking-[0.12em] text-crt/25">
          no api calls made — copy and post manually or wait for phase 2/3
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RebirthPanel — editable pre-publish editor with live social preview
// ---------------------------------------------------------------------------

function RebirthPanel({
  sig,
  onRebirth,
  onCancel,
  isRebirthPending,
}: {
  sig:              DbRecoveredSignal;
  onRebirth:        (payload: RebirthPayload) => void;
  onCancel:         () => void;
  isRebirthPending: boolean;
}) {
  const [title,    setTitle]    = useState(sig.title);
  const [body,     setBody]     = useState(buildPreviewBody(sig));
  const [category, setCategory] = useState(sig.category);
  const [tagsStr,  setTagsStr]  = useState(sig.tags.join(', '));

  const parsedTags = tagsStr
    .split(',')
    .map((t) => t.trim().toLowerCase())
    .filter(Boolean);

  const previewData = {
    title,
    category,
    summary:      sig.summary,
    threadSlug:   'preview',
    sourceName:   sig.source_name,
    anomalyScore: sig.anomaly_score,
    tags:         parsedTags,
  };
  const telegramPreview = formatTelegramPost(previewData);
  const xPreview        = formatXPost(previewData);
  const xCharCount      = xPreview.length;
  const xTruncated      = xPostTitleTruncated(previewData);

  const inputBase =
    'w-full border border-crt/20 bg-transparent px-4 py-3 font-mono text-[15px] tracking-[0.03em] text-crt/85 placeholder:text-crt/25 focus:border-crt/42 focus:outline-none transition-colors';
  const labelBase =
    'mb-2 block text-[12px] uppercase tracking-[0.18em] text-crt/42';

  return (
    <div className="mt-6 border-t border-[#d7a85c]/25 pt-6">

      <div className="mb-6">
        <div className="mb-1.5 flex items-center gap-2.5">
          <span className="h-2 w-2 bg-[#d7a85c]/70" />
          <span className="text-[12px] uppercase tracking-[0.28em] text-[#d7a85c]/80">
            ◈ dead signal prepared
          </span>
        </div>
        <p className="text-[14px] uppercase tracking-[0.14em] text-crt/48">
          edit title, body, and tags — then rebirth into the archive
        </p>
      </div>

      <div className="mb-5">
        <label className={labelBase}>thread title</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          maxLength={200}
          disabled={isRebirthPending}
          className={inputBase}
        />
      </div>

      <div className="mb-5">
        <label className={labelBase}>
          thread body
          <span className="ml-2 text-crt/28">— remove curator note before rebirth</span>
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={14}
          disabled={isRebirthPending}
          className={`${inputBase} resize-y`}
        />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className={labelBase}>category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={isRebirthPending}
            className={`${inputBase} cursor-pointer`}
          >
            {CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelBase}>
            tags <span className="text-crt/28">— comma separated</span>
          </label>
          <input
            type="text"
            value={tagsStr}
            onChange={(e) => setTagsStr(e.target.value)}
            maxLength={300}
            disabled={isRebirthPending}
            className={inputBase}
          />
        </div>
      </div>

      {/* Live social preview */}
      <div className="mb-6 space-y-4 border-t border-crt/10 pt-5">
        <div className="text-[12px] uppercase tracking-[0.22em] text-crt/35">
          social preview — updates as you edit
        </div>

        <div>
          <div className="mb-1.5 text-[12px] uppercase tracking-[0.16em] text-crt/30">telegram</div>
          <div className="max-h-40 overflow-y-auto border border-crt/12 bg-[rgba(134,212,110,0.018)] px-4 py-3 font-mono text-[13px] leading-relaxed tracking-[0.03em] text-crt/48 whitespace-pre-wrap">
            {telegramPreview}
          </div>
        </div>

        <div>
          <div className="mb-1.5 flex items-center gap-3">
            <span className="text-[12px] uppercase tracking-[0.16em] text-crt/30">x.com</span>
            <span
              className="text-[12px] tabular-nums"
              style={{ color: xCharCount > 260 ? '#d7a85c' : 'rgba(134,212,110,0.32)' }}
            >
              {xCharCount}/280
            </span>
            {xTruncated && (
              <span className="text-[12px] uppercase tracking-[0.10em] text-[#d7a85c]/70">
                title truncated
              </span>
            )}
          </div>
          <div className="border border-crt/12 bg-[rgba(134,212,110,0.018)] px-4 py-3 font-mono text-[13px] leading-relaxed tracking-[0.03em] text-crt/48 whitespace-pre-wrap">
            {xPreview}
          </div>
        </div>
      </div>

      {/* Rebirth / cancel */}
      <div className="flex flex-wrap gap-3">
        <button
          onClick={() => onRebirth({ title, body, category, tags: parsedTags })}
          disabled={isRebirthPending || !title.trim() || !body.trim()}
          className="border border-[#d7a85c]/45 px-6 py-3 text-[13px] uppercase tracking-[0.20em] text-[#d7a85c]/78 transition-colors hover:border-[#d7a85c]/70 hover:text-[#d7a85c] disabled:cursor-not-allowed disabled:opacity-30"
        >
          {isRebirthPending ? '↯ rebirthing...' : '[ rebirth as thread ]'}
        </button>
        <button
          onClick={onCancel}
          disabled={isRebirthPending}
          className="border border-crt/15 px-5 py-3 text-[13px] uppercase tracking-[0.16em] text-crt/38 transition-colors hover:border-crt/28 hover:text-crt/60 disabled:cursor-not-allowed disabled:opacity-30"
        >
          [ cancel ]
        </button>
      </div>
      <p className="mt-2.5 text-[12px] uppercase tracking-[0.10em] text-crt/25">
        thread created with author=archivist · signal marked approved · recovered-signal tag added
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SignalCard — terminal case-file layout, operator readability
// ---------------------------------------------------------------------------

interface SignalCardProps {
  signal:           DbRecoveredSignal;
  onStatusChange:   (id: string, status: RecoveredSignalStatus) => void;
  statusPending:    boolean;
  onRequestRebirth: (sig: DbRecoveredSignal) => void;
  onRebirth:        (sig: DbRecoveredSignal, payload: RebirthPayload) => void;
  onCancelRebirth:  () => void;
  isPublishing:     boolean;
  isRebirthOpen:    boolean;
  publishedResult:  PublishResult | null;
  inRebirthQueue:   boolean;
}

function SignalCard({
  signal: sig,
  onStatusChange,
  statusPending,
  onRequestRebirth,
  onRebirth,
  onCancelRebirth,
  isPublishing,
  isRebirthOpen,
  publishedResult,
  inRebirthQueue,
}: SignalCardProps) {
  const alreadyPublished = Boolean(sig.published_thread_id) && !publishedResult;
  const busy = statusPending || isPublishing;

  return (
    <div
      className="terminal-card cursor-default px-6 py-6 md:px-8 md:py-7"
      style={{
        borderLeftColor: inRebirthQueue
          ? 'rgba(215,168,92,0.65)'
          : `${STATUS_COLORS[sig.status]}55`,
        borderLeftWidth: '3px',
      }}
    >
      {/* ── HEADER row ── */}
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
          <span className="font-mono text-[12px] uppercase tracking-[0.18em] text-crt/38">
            {sig.id.slice(0, 13).toUpperCase()}
          </span>
          <span className="text-crt/20">·</span>
          <span className="text-[13px] uppercase tracking-[0.14em] text-crt/78">
            {sig.category}
          </span>
          <span className="text-crt/20">·</span>
          <span className="text-[13px] uppercase tracking-[0.10em] text-crt/48">
            {SOURCE_TYPE_LABELS[sig.source_type] ?? sig.source_type}
          </span>
          {sig.submitted_publicly && (
            <span className="border border-[#6da8ff]/38 px-2 py-0.5 text-[11px] uppercase tracking-[0.12em] text-[#6da8ff]/72">
              ◈ public submission
            </span>
          )}
          {inRebirthQueue && (
            <span className="border border-[#d7a85c]/45 px-2 py-0.5 text-[11px] uppercase tracking-[0.12em] text-[#d7a85c]/78">
              ◈ ready for rebirth
            </span>
          )}
        </div>
        <span
          className="shrink-0 text-[13px] uppercase tracking-[0.16em]"
          style={{ color: STATUS_COLORS[sig.status] }}
        >
          ◈ {sig.status}
        </span>
      </div>

      {/* ── TITLE ── */}
      <div className="mb-4 text-[1.2rem] font-medium leading-[1.40] tracking-[0.02em] text-crt/92 md:text-[1.3rem]">
        {sig.title}
      </div>

      {/* ── SUMMARY ── */}
      <p className="mb-6 text-[17px] leading-[1.78] tracking-[0.02em] text-crt/82">
        {sig.summary}
      </p>

      {/* ── METADATA GRID ── */}
      <div className="mb-5 grid grid-cols-2 gap-x-8 gap-y-5 border-t border-crt/10 pt-5 text-[13px] uppercase tracking-[0.12em] md:grid-cols-5">
        <div>
          <div className="mb-2 text-[12px] tracking-[0.16em] text-crt/38">anomaly</div>
          <AnomalyBar score={sig.anomaly_score} />
        </div>
        <div>
          <div className="mb-2 text-[12px] tracking-[0.16em] text-crt/38">category</div>
          <div className="text-[14px] text-crt/72">{sig.category}</div>
        </div>
        <div>
          <div className="mb-2 text-[12px] tracking-[0.16em] text-crt/38">source</div>
          <div className="truncate text-[14px] text-crt/70">{sig.source_name}</div>
        </div>
        <div>
          <div className="mb-2 text-[12px] tracking-[0.16em] text-crt/38">discovered</div>
          <div className="text-[14px] text-crt/70">{sig.discovered_at.slice(0, 10)}</div>
        </div>
        <div>
          <div className="mb-2 text-[12px] tracking-[0.16em] text-crt/38">status</div>
          <div
            className="text-[14px] uppercase tracking-[0.10em]"
            style={{ color: STATUS_COLORS[sig.status] }}
          >
            {sig.status}
          </div>
        </div>
      </div>

      {/* ── TAGS ── */}
      {sig.tags.length > 0 && (
        <div className="mb-5 flex flex-wrap gap-2">
          {sig.tags.map((tag) => (
            <span
              key={tag}
              className="border border-crt/18 px-2.5 py-1 text-[12px] uppercase tracking-[0.12em] text-crt/58"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* ── SOURCE URL ── */}
      {sig.source_url && (
        <div className="mb-5 font-mono text-[13px] tracking-[0.05em] text-crt/48">
          ↗ {sig.source_url}
        </div>
      )}

      {/* ── ACTIONS ── */}
      <div className="flex flex-wrap items-center gap-3 border-t border-crt/12 pt-5">
        {sig.status !== 'approved' && (
          <button
            onClick={() => onStatusChange(sig.id, 'approved')}
            disabled={busy || isRebirthOpen}
            className="border border-[#86d46e]/35 px-5 py-2.5 text-[13px] uppercase tracking-[0.16em] text-[#86d46e]/72 transition-colors hover:border-[#86d46e]/60 hover:text-[#86d46e] disabled:cursor-not-allowed disabled:opacity-25 md:py-3"
          >
            [ approve ]
          </button>
        )}
        {sig.status !== 'archived' && (
          <button
            onClick={() => onStatusChange(sig.id, 'archived')}
            disabled={busy || isRebirthOpen}
            className="border border-[#6da8ff]/30 px-5 py-2.5 text-[13px] uppercase tracking-[0.16em] text-[#6da8ff]/65 transition-colors hover:border-[#6da8ff]/55 hover:text-[#6da8ff] disabled:cursor-not-allowed disabled:opacity-25 md:py-3"
          >
            [ archive ]
          </button>
        )}
        {sig.status !== 'rejected' && (
          <button
            onClick={() => onStatusChange(sig.id, 'rejected')}
            disabled={busy || isRebirthOpen}
            className="border border-[#ff6b6b]/25 px-5 py-2.5 text-[13px] uppercase tracking-[0.16em] text-[#ff6b6b]/55 transition-colors hover:border-[#ff6b6b]/45 hover:text-[#ff6b6b]/85 disabled:cursor-not-allowed disabled:opacity-25 md:py-3"
          >
            [ reject ]
          </button>
        )}

        {/* Rebirth button — right-aligned */}
        <div className="ml-auto">
          {publishedResult ? null : alreadyPublished ? (
            <span className="text-[13px] uppercase tracking-[0.16em] text-crt/25">
              ◈ already reborn
            </span>
          ) : isRebirthOpen ? null : (
            <button
              onClick={() => onRequestRebirth(sig)}
              disabled={busy}
              className={`border px-5 py-2.5 text-[13px] uppercase tracking-[0.16em] transition-colors disabled:cursor-not-allowed disabled:opacity-25 md:py-3 ${
                inRebirthQueue
                  ? 'border-[#d7a85c]/45 text-[#d7a85c]/75 hover:border-[#d7a85c]/70 hover:text-[#d7a85c]'
                  : 'border-crt/25 text-crt/55 hover:border-crt/40 hover:text-crt/80'
              }`}
            >
              [ prepare rebirth ]
            </button>
          )}
        </div>
      </div>

      {/* ── Rebirth panel ── */}
      {isRebirthOpen && !publishedResult && (
        <RebirthPanel
          sig={sig}
          onRebirth={(payload) => onRebirth(sig, payload)}
          onCancel={onCancelRebirth}
          isRebirthPending={isPublishing}
        />
      )}

      {/* ── Share package — shown after successful rebirth ── */}
      {publishedResult && <SharePackagePanel result={publishedResult} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// SignalQueueClient
// ---------------------------------------------------------------------------

export interface SignalQueueClientProps {
  pending:  DbRecoveredSignal[];
  approved: DbRecoveredSignal[];
  archived: DbRecoveredSignal[];
  rejected: DbRecoveredSignal[];
}

export function SignalQueueClient({
  pending:  initialPending,
  approved: initialApproved,
  archived: initialArchived,
  rejected: initialRejected,
}: SignalQueueClientProps) {
  const router = useRouter();
  const [isStatusPending, startStatusTransition] = useTransition();

  const [activeTab,        setActiveTab]        = useState<RecoveredSignalStatus | 'all'>('pending');
  const [filterCategory,   setFilterCategory]   = useState('');
  const [filterSourceType, setFilterSourceType] = useState('');
  const [sortScore,        setSortScore]        = useState<'desc' | 'asc' | null>(null);

  const [showIntake, setShowIntake] = useState(false);

  const [overrides, setOverrides] = useState<Record<string, RecoveredSignalStatus>>({});

  const [publishingId,     setPublishingId]     = useState<string | null>(null);
  const [rebirthOpenId,    setRebirthOpenId]    = useState<string | null>(null);
  const [publishedResults, setPublishedResults] = useState<Record<string, PublishResult>>({});

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const allSignals = [
    ...initialPending,
    ...initialApproved,
    ...initialArchived,
    ...initialRejected,
  ].map((s) => ({ ...s, status: overrides[s.id] ?? s.status }));

  const uniqueCategories  = [...new Set(allSignals.map((s) => s.category))].sort();
  const uniqueSourceTypes = [...new Set(allSignals.map((s) => s.source_type))].sort() as SignalSourceType[];

  const counts: Record<RecoveredSignalStatus | 'all', number> = {
    all:      allSignals.length,
    pending:  allSignals.filter((s) => s.status === 'pending').length,
    approved: allSignals.filter((s) => s.status === 'approved').length,
    archived: allSignals.filter((s) => s.status === 'archived').length,
    rejected: allSignals.filter((s) => s.status === 'rejected').length,
  };

  let visibleSignals =
    activeTab === 'all'
      ? allSignals
      : allSignals.filter((s) => s.status === activeTab);

  if (filterCategory)   visibleSignals = visibleSignals.filter((s) => s.category === filterCategory);
  if (filterSourceType) visibleSignals = visibleSignals.filter((s) => s.source_type === filterSourceType);

  if (sortScore === 'desc') visibleSignals = [...visibleSignals].sort((a, b) => b.anomaly_score - a.anomaly_score);
  if (sortScore === 'asc')  visibleSignals = [...visibleSignals].sort((a, b) => a.anomaly_score - b.anomaly_score);

  const groupedByStatus: Record<RecoveredSignalStatus, DbRecoveredSignal[]> =
    STATUS_SECTION_ORDER.reduce(
      (acc, s) => { acc[s] = visibleSignals.filter((sig) => sig.status === s); return acc; },
      {} as Record<RecoveredSignalStatus, DbRecoveredSignal[]>,
    );

  const rebirthQueueSignals  = visibleSignals.filter(
    (s) => s.status === 'pending' && s.anomaly_score >= REBIRTH_SCORE_THRESHOLD,
  );
  const rebirthQueueIds      = new Set(rebirthQueueSignals.map((s) => s.id));
  const regularPendingSignals = visibleSignals.filter(
    (s) => s.status === 'pending' && !rebirthQueueIds.has(s.id),
  );

  const hasActiveFilter = Boolean(filterCategory || filterSourceType || sortScore);

  function showError(msg: string) {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(null), 6000);
  }

  function handleStatusChange(id: string, status: RecoveredSignalStatus) {
    const prev = overrides[id] ?? allSignals.find((s) => s.id === id)?.status;
    setOverrides((o) => ({ ...o, [id]: status }));

    startStatusTransition(async () => {
      const result = await updateSignalStatusAction({ id, status });
      if ('error' in result) {
        if (prev) setOverrides((o) => ({ ...o, [id]: prev }));
        showError(`signal lost — ${result.error}`);
      } else {
        router.refresh();
      }
    });
  }

  function handleRequestRebirth(sig: DbRecoveredSignal) {
    if (publishingId) return;
    setRebirthOpenId(sig.id);
  }

  function handleCancelRebirth() {
    setRebirthOpenId(null);
  }

  async function handleRebirth(sig: DbRecoveredSignal, payload: RebirthPayload) {
    if (publishingId) return;
    setPublishingId(sig.id);

    try {
      const result = await rebirthSignalAsThreadAction({
        signalId:  sig.id,
        title:     payload.title,
        body:      payload.body,
        category:  payload.category,
        tags:      payload.tags,
      });

      if ('error' in result) {
        showError(`rebirth failed — ${result.error}`);
        setRebirthOpenId(null);
        return;
      }

      const shareData = {
        title:        payload.title,
        category:     payload.category,
        summary:      sig.summary,
        threadSlug:   result.threadSlug,
        sourceName:   sig.source_name,
        anomalyScore: sig.anomaly_score,
        tags:         payload.tags,
      };

      setPublishedResults((p) => ({
        ...p,
        [sig.id]: {
          threadSlug:     result.threadSlug,
          telegramText:   formatTelegramPost(shareData),
          xText:          formatXPost(shareData),
          titleTruncated: xPostTitleTruncated(shareData),
        },
      }));

      setOverrides((o) => ({ ...o, [sig.id]: 'approved' }));
      setRebirthOpenId(null);
      router.refresh();
    } finally {
      setPublishingId(null);
    }
  }

  function renderCard(sig: DbRecoveredSignal) {
    return (
      <SignalCard
        key={sig.id}
        signal={sig}
        onStatusChange={handleStatusChange}
        statusPending={isStatusPending}
        onRequestRebirth={handleRequestRebirth}
        onRebirth={handleRebirth}
        onCancelRebirth={handleCancelRebirth}
        isPublishing={publishingId === sig.id}
        isRebirthOpen={rebirthOpenId === sig.id}
        publishedResult={publishedResults[sig.id] ?? null}
        inRebirthQueue={rebirthQueueIds.has(sig.id)}
      />
    );
  }

  return (
    <div className="relative min-h-screen pb-[72px] pt-[80px] md:pb-12 md:pt-[100px]">
      <AmbientGrid className="pointer-events-none absolute inset-0 opacity-[0.12]" />

      <div className="relative z-10 mx-auto max-w-5xl px-4 md:px-6">

        {/* ── Header panel — no overflow-hidden so sticky toolbar works ── */}
        <div className="forum-shell">

          {/* Header */}
          <div className="border-b border-crt/12 px-6 py-7 md:px-10 md:py-9">
            <div className="mb-2 flex items-start justify-between gap-4">
              <div className="text-[12px] uppercase tracking-[0.26em] text-crt/40">
                swim · internal · curator access only
              </div>
              <button
                onClick={() => setShowIntake((v) => !v)}
                className={`shrink-0 border px-4 py-2 text-[12px] uppercase tracking-[0.18em] transition-colors ${
                  showIntake
                    ? 'border-crt/32 text-crt/65 hover:border-crt/18 hover:text-crt/38'
                    : 'border-crt/22 text-crt/45 hover:border-crt/38 hover:text-crt/68'
                }`}
              >
                {showIntake ? '[ − close intake ]' : '[ + intake signal ]'}
              </button>
            </div>
            <h1 className="text-[1.9rem] tracking-[0.10em] text-crt md:text-[2.3rem]">
              SIGNAL QUEUE
            </h1>
            <p className="mt-2 text-[14px] uppercase tracking-[0.12em] text-crt/48">
              dead signals recovered · curator review required · human approval only
            </p>
          </div>

          {/* Manual intake form */}
          {showIntake && (
            <IntakeFormClient onSuccess={() => setShowIntake(false)} />
          )}

          {/* Status counts */}
          <div className="border-b border-crt/10 bg-[rgba(134,212,110,0.018)] px-6 py-4 md:px-10">
            <div className="flex flex-wrap gap-x-8 gap-y-2.5 text-[13px] uppercase tracking-[0.16em]">
              <span className="text-crt/52">
                <span className="text-crt/32">total</span>
                <span className="mx-2 text-crt/20">//</span>
                {counts.all}
              </span>
              {STATUS_SECTION_ORDER.map((s) => (
                <span key={s} style={{ color: `${STATUS_COLORS[s]}92` }}>
                  <span className="text-crt/32">{s}</span>
                  <span className="mx-2 text-crt/20">//</span>
                  {counts[s]}
                </span>
              ))}
              {counts.pending > 0 && rebirthQueueSignals.length > 0 && (
                <span style={{ color: 'rgba(215,168,92,0.82)' }}>
                  <span className="text-crt/32">rebirth ready</span>
                  <span className="mx-2 text-crt/20">//</span>
                  {rebirthQueueSignals.length}
                </span>
              )}
            </div>
          </div>

          {/* ── Sticky tab + filter toolbar ──
              overflow is NOT set on forum-shell, so sticky works here. */}
          <div className="sticky top-[72px] z-20 border-b border-crt/12 bg-[rgba(2,3,3,0.97)] backdrop-blur-sm md:top-[80px]">

            {/* Status filter tabs */}
            <div className="border-b border-crt/10 px-6 md:px-10">
              <div className="flex gap-0 overflow-x-auto">
                {STATUS_TABS.map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setActiveTab(key)}
                    className={`border-b-2 px-5 py-4 text-[12px] uppercase tracking-[0.20em] transition-colors whitespace-nowrap ${
                      activeTab === key
                        ? 'border-crt/60 text-crt/85'
                        : 'border-transparent text-crt/35 hover:text-crt/60'
                    }`}
                  >
                    {label}
                    {key !== 'all' && (
                      <span className="ml-2 text-[12px] text-crt/32">
                        {counts[key as RecoveredSignalStatus]}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Secondary filters */}
            <div className="px-6 py-3 md:px-10">
              <div className="flex flex-wrap items-center gap-5">
                <div className="flex items-center gap-2.5">
                  <span className="text-[12px] uppercase tracking-[0.16em] text-crt/35">category</span>
                  <select
                    value={filterCategory}
                    onChange={(e) => setFilterCategory(e.target.value)}
                    className="border border-crt/18 bg-transparent px-2.5 py-1.5 font-mono text-[13px] tracking-[0.06em] text-crt/62 focus:border-crt/35 focus:outline-none"
                  >
                    <option value="">all</option>
                    {uniqueCategories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="text-[12px] uppercase tracking-[0.16em] text-crt/35">source</span>
                  <select
                    value={filterSourceType}
                    onChange={(e) => setFilterSourceType(e.target.value)}
                    className="border border-crt/18 bg-transparent px-2.5 py-1.5 font-mono text-[13px] tracking-[0.06em] text-crt/62 focus:border-crt/35 focus:outline-none"
                  >
                    <option value="">all</option>
                    {uniqueSourceTypes.map((t) => (
                      <option key={t} value={t}>{SOURCE_TYPE_LABELS[t]}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2.5">
                  <span className="text-[12px] uppercase tracking-[0.16em] text-crt/35">score</span>
                  <button
                    onClick={() => setSortScore((v) => v === 'desc' ? 'asc' : v === 'asc' ? null : 'desc')}
                    className={`border px-3 py-1.5 text-[12px] uppercase tracking-[0.12em] transition-colors ${
                      sortScore
                        ? 'border-crt/32 text-crt/65 hover:border-crt/20 hover:text-crt/42'
                        : 'border-crt/15 text-crt/35 hover:border-crt/25 hover:text-crt/55'
                    }`}
                  >
                    {sortScore === 'desc' ? '↓ high first' : sortScore === 'asc' ? '↑ low first' : '— default'}
                  </button>
                </div>

                {hasActiveFilter && (
                  <>
                    <button
                      onClick={() => { setFilterCategory(''); setFilterSourceType(''); setSortScore(null); }}
                      className="ml-auto text-[12px] uppercase tracking-[0.16em] text-crt/32 transition-colors hover:text-crt/58"
                    >
                      × clear
                    </button>
                    <span className="text-[12px] uppercase tracking-[0.12em] text-crt/28">
                      {visibleSignals.length} shown
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Error banner */}
          {errorMsg && (
            <div className="border-b border-red-900/45 bg-[rgba(40,10,10,0.65)] px-6 py-3.5 text-[13px] uppercase tracking-[0.16em] text-red-400/85 md:px-10">
              › {errorMsg}
            </div>
          )}

          {/* Signal list */}
          <div className="px-6 py-8 md:px-10 md:py-10">
            {visibleSignals.length === 0 ? (
              <div className="py-20 text-center text-[14px] uppercase tracking-[0.20em] text-crt/32">
                {hasActiveFilter ? 'no signals match current filters' : 'no signals in this state'}
              </div>

            ) : activeTab === 'pending' ? (
              <div>
                {/* Rebirth Queue callout */}
                {rebirthQueueSignals.length > 0 && (
                  <div className="mb-10">
                    <div className="mb-6 border border-[#d7a85c]/22 bg-[rgba(215,168,92,0.045)] px-6 py-5">
                      <div className="mb-1.5 flex items-center gap-3">
                        <span className="h-2 w-2 bg-[#d7a85c]/70" aria-hidden="true" />
                        <span className="text-[13px] uppercase tracking-[0.28em] text-[#d7a85c]/88">
                          ◈ rebirth queue
                        </span>
                      </div>
                      <p className="text-[14px] uppercase tracking-[0.14em] text-[#d7a85c]/58">
                        {rebirthQueueSignals.length} dead signal{rebirthQueueSignals.length !== 1 ? 's' : ''} with anomaly score ≥ {REBIRTH_SCORE_THRESHOLD} — ready for archive
                      </p>
                    </div>
                    <div className="terminal-card-grid">
                      {rebirthQueueSignals.map(renderCard)}
                    </div>
                  </div>
                )}

                {/* Remaining pending */}
                {regularPendingSignals.length > 0 && (
                  <div>
                    {rebirthQueueSignals.length > 0 && (
                      <div className="mb-6 flex items-center gap-4">
                        <div className="h-px flex-1 bg-crt/10" />
                        <span className="shrink-0 text-[12px] uppercase tracking-[0.22em] text-crt/32">
                          remaining · {regularPendingSignals.length}
                        </span>
                        <div className="h-px flex-1 bg-crt/10" />
                      </div>
                    )}
                    <div className="terminal-card-grid">
                      {regularPendingSignals.map(renderCard)}
                    </div>
                  </div>
                )}
              </div>

            ) : activeTab === 'all' ? (
              <div className="space-y-12">
                {STATUS_SECTION_ORDER.map((status) => {
                  const sigs = groupedByStatus[status];
                  if (sigs.length === 0) return null;
                  return (
                    <div key={status}>
                      <div className="mb-5 flex items-center gap-4">
                        <div className="h-px flex-1" style={{ backgroundColor: `${STATUS_COLORS[status]}25` }} />
                        <span
                          className="shrink-0 text-[12px] uppercase tracking-[0.24em]"
                          style={{ color: `${STATUS_COLORS[status]}90` }}
                        >
                          {SECTION_LABELS[status]} · {sigs.length}
                        </span>
                        <div className="h-px flex-1" style={{ backgroundColor: `${STATUS_COLORS[status]}25` }} />
                      </div>
                      <div className="terminal-card-grid">
                        {sigs.map(renderCard)}
                      </div>
                    </div>
                  );
                })}
              </div>

            ) : (
              <div className="terminal-card-grid">
                {visibleSignals.map(renderCard)}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="border-t border-crt/10 px-6 py-5 text-center text-[12px] uppercase tracking-[0.16em] text-crt/28 md:px-10">
            curator queue · service role key required · not accessible to public users
          </div>

        </div>
      </div>
    </div>
  );
}
