'use client';

/**
 * SignalQueueClient — curator console for recovered signal management.
 *
 * OPERATOR MODE: admin dashboard layout, readability-first.
 *   - Large admin cards (title 24px, summary 18px, meta 15px, buttons 15px)
 *   - Sticky toolbar: search + status tabs + category/source filters + sort
 *   - Two-column desktop layout: signal cards | queue stats + AI scanner panel
 *   - Filled action buttons: Approve (green) / Archive (blue) / Reject (red) / Rebirth (amber)
 *   - Rebirth panel: large edit form with full-width inputs
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
  { key: 'all',      label: 'All'      },
  { key: 'pending',  label: 'Pending'  },
  { key: 'approved', label: 'Approved' },
  { key: 'archived', label: 'Archived' },
  { key: 'rejected', label: 'Rejected' },
];

const STATUS_SECTION_ORDER: RecoveredSignalStatus[] = ['pending', 'approved', 'archived', 'rejected'];

const SECTION_LABELS: Record<RecoveredSignalStatus, string> = {
  pending:  'Pending Review',
  approved: 'Approved',
  archived: 'Archived',
  rejected: 'Rejected',
};

const STATUS_COLORS: Record<RecoveredSignalStatus, string> = {
  pending:  '#d7a85c',
  approved: '#86d46e',
  archived: '#6da8ff',
  rejected: '#ff6b6b',
};

const STATUS_BG: Record<RecoveredSignalStatus, string> = {
  pending:  'rgba(215,168,92,0.10)',
  approved: 'rgba(134,212,110,0.08)',
  archived: 'rgba(109,168,255,0.08)',
  rejected: 'rgba(255,107,107,0.07)',
};

const STATUS_BORDER: Record<RecoveredSignalStatus, string> = {
  pending:  'rgba(215,168,92,0.38)',
  approved: 'rgba(134,212,110,0.35)',
  archived: 'rgba(109,168,255,0.32)',
  rejected: 'rgba(255,107,107,0.28)',
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

const AI_SCANNER_ROWS = [
  { label: 'Mode',        value: 'Manual intake',   dim: false },
  { label: 'Intelligence', value: 'Planned',         dim: true  },
  { label: 'Sources',     value: 'Offline',          dim: true  },
  { label: 'Approval',    value: 'Human required',   dim: false },
  { label: 'Auto-post',   value: 'Never',            dim: false },
];

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
// Utilities
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
// AnomalyScore
// ---------------------------------------------------------------------------

function AnomalyScore({ score }: { score: number }) {
  const color = score >= 8 ? '#ff6b6b' : score >= 6 ? '#d7a85c' : '#86d46e';
  return (
    <div className="flex items-center gap-3">
      <div className="flex gap-[3px]">
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={i}
            className="h-[18px] w-[10px]"
            style={{ backgroundColor: i < score ? color : 'rgba(134,212,110,0.10)' }}
          />
        ))}
      </div>
      <span className="text-[15px] font-medium tabular-nums" style={{ color }}>
        {score}/10
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatusBadge
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: RecoveredSignalStatus }) {
  return (
    <span
      className="px-2.5 py-1 text-[12px] font-medium uppercase tracking-[0.08em]"
      style={{
        background: STATUS_BG[status],
        border:     `1px solid ${STATUS_BORDER[status]}`,
        color:      STATUS_COLORS[status],
      }}
    >
      {status}
    </span>
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
      className="text-[13px] uppercase tracking-[0.10em] text-crt/42 transition-colors hover:text-crt/72"
    >
      {copied ? '✓ copied' : '[ copy ]'}
    </button>
  );
}

// ---------------------------------------------------------------------------
// SharePackagePanel
// ---------------------------------------------------------------------------

function SharePackagePanel({ result }: { result: PublishResult }) {
  return (
    <div className="mt-6 border-t border-crt/12 bg-[rgba(134,212,110,0.018)] px-6 py-6 md:px-8">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 text-[13px] uppercase tracking-[0.18em] text-[#d7a85c]/85">
            ◈ Thread reborn
          </div>
          <div className="text-[14px] text-crt/48">Story restored to archive</div>
        </div>
        <Link
          href={`/threads/${result.threadSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[14px] text-[#86d46e]/75 transition-colors hover:text-[#86d46e]"
        >
          ✓ View reborn thread ↗
        </Link>
      </div>

      <div className="mb-2 text-[12px] uppercase tracking-[0.16em] text-crt/35">
        Share package — copy and post manually
      </div>

      <div className="space-y-4">
        <div>
          <div className="mb-2 flex items-center justify-between">
            <span className="text-[13px] uppercase tracking-[0.12em] text-crt/38">Telegram</span>
            <CopyButton text={result.telegramText} />
          </div>
          <div className="border border-crt/12 bg-[rgba(4,7,5,0.8)] px-4 py-3 font-mono text-[13px] leading-relaxed text-crt/55 whitespace-pre-wrap">
            {result.telegramText}
          </div>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-[13px] uppercase tracking-[0.12em] text-crt/38">X / Twitter</span>
              <span
                className="text-[13px] tabular-nums"
                style={{ color: result.xText.length > 260 ? '#d7a85c' : 'rgba(134,212,110,0.38)' }}
              >
                {result.xText.length}/280
              </span>
              {result.titleTruncated && (
                <span className="text-[12px] text-[#d7a85c]/72">title truncated</span>
              )}
            </div>
            <CopyButton text={result.xText} />
          </div>
          <div className="border border-crt/12 bg-[rgba(4,7,5,0.8)] px-4 py-3 font-mono text-[13px] leading-relaxed text-crt/55 whitespace-pre-wrap">
            {result.xText}
          </div>
          <p className="mt-2 text-[12px] text-crt/28">
            No API calls made — copy and post manually
          </p>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RebirthPanel — large admin edit form
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

  const inputCls =
    'w-full border border-crt/20 bg-[rgba(4,7,5,0.85)] px-4 py-3 text-[16px] text-crt/88 placeholder:text-crt/25 focus:border-crt/42 focus:outline-none transition-colors';
  const labelCls = 'mb-2 block text-[13px] text-crt/50';

  return (
    <div className="border-t-2 border-[#d7a85c]/28 bg-[rgba(215,168,92,0.03)]">
      {/* Header */}
      <div className="border-b border-[#d7a85c]/15 px-6 py-5 md:px-8">
        <div className="mb-1 flex items-center gap-2">
          <span className="h-2 w-2 bg-[#d7a85c]/72" />
          <span className="text-[13px] uppercase tracking-[0.16em] text-[#d7a85c]/85">
            Prepare Rebirth
          </span>
        </div>
        <p className="text-[15px] leading-relaxed text-crt/55">
          Edit the content below, then publish as a SWIM thread.
          Remove the curator note from the body before confirming.
        </p>
      </div>

      <div className="px-6 py-6 md:px-8">
        {/* Title */}
        <div className="mb-5">
          <label className={labelCls}>Thread Title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            disabled={isRebirthPending}
            className={`${inputCls} text-[18px]`}
          />
        </div>

        {/* Body */}
        <div className="mb-5">
          <label className={labelCls}>
            Thread Body
            <span className="ml-2 text-crt/30">— remove curator note before publishing</span>
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={16}
            disabled={isRebirthPending}
            className={`${inputCls} resize-y font-mono text-[15px]`}
          />
        </div>

        {/* Category + Tags */}
        <div className="mb-6 grid grid-cols-1 gap-5 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              disabled={isRebirthPending}
              className={`${inputCls} cursor-pointer`}
            >
              {CATEGORY_ORDER.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>
              Tags <span className="text-crt/30">— comma separated</span>
            </label>
            <input
              type="text"
              value={tagsStr}
              onChange={(e) => setTagsStr(e.target.value)}
              maxLength={300}
              disabled={isRebirthPending}
              className={inputCls}
            />
          </div>
        </div>

        {/* Social preview */}
        <div className="mb-6 space-y-4 border-t border-crt/10 pt-5">
          <div className="text-[13px] uppercase tracking-[0.14em] text-crt/35">
            Social preview — live
          </div>

          <div>
            <div className="mb-2 text-[13px] text-crt/35">Telegram</div>
            <div className="max-h-36 overflow-y-auto border border-crt/12 bg-[rgba(4,7,5,0.8)] px-4 py-3 font-mono text-[13px] leading-relaxed text-crt/50 whitespace-pre-wrap">
              {telegramPreview}
            </div>
          </div>

          <div>
            <div className="mb-2 flex items-center gap-3">
              <span className="text-[13px] text-crt/35">X / Twitter</span>
              <span
                className="text-[13px] tabular-nums"
                style={{ color: xCharCount > 260 ? '#d7a85c' : 'rgba(134,212,110,0.35)' }}
              >
                {xCharCount}/280
              </span>
              {xTruncated && (
                <span className="text-[12px] text-[#d7a85c]/72">title truncated</span>
              )}
            </div>
            <div className="border border-crt/12 bg-[rgba(4,7,5,0.8)] px-4 py-3 font-mono text-[13px] leading-relaxed text-crt/50 whitespace-pre-wrap">
              {xPreview}
            </div>
          </div>
        </div>

        {/* Commit buttons */}
        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => onRebirth({ title, body, category, tags: parsedTags })}
            disabled={isRebirthPending || !title.trim() || !body.trim()}
            className="bg-[rgba(215,168,92,0.15)] border border-[#d7a85c]/50 px-8 py-3 text-[15px] font-medium text-[#d7a85c] transition-colors hover:bg-[rgba(215,168,92,0.25)] hover:border-[#d7a85c]/72 disabled:cursor-not-allowed disabled:opacity-30"
          >
            {isRebirthPending ? '↯ Rebirthng...' : '◈ Rebirth as Thread'}
          </button>
          <button
            onClick={onCancel}
            disabled={isRebirthPending}
            className="border border-crt/18 px-6 py-3 text-[15px] text-crt/45 transition-colors hover:border-crt/30 hover:text-crt/70 disabled:cursor-not-allowed disabled:opacity-30"
          >
            Cancel
          </button>
        </div>
        <p className="mt-3 text-[13px] text-crt/28">
          Thread created with author=ARCHIVIST · signal marked approved · recovered-signal tag added automatically
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SignalCard — large admin card layout
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

  const leftAccent = inRebirthQueue
    ? 'rgba(215,168,92,0.70)'
    : `${STATUS_COLORS[sig.status]}55`;

  return (
    <div
      className="border border-crt/18 bg-[rgba(4,7,5,0.97)]"
      style={{ borderLeftColor: leftAccent, borderLeftWidth: '4px' }}
    >
      {/* ── TOP BAR: ID · category · source type · badges · status ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-crt/10 px-5 py-3 md:px-6">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <span className="font-mono text-[12px] text-crt/32">
            {sig.id.slice(0, 13).toUpperCase()}
          </span>
          <span className="text-crt/20">·</span>
          <span className="text-[13px] uppercase tracking-[0.08em] text-crt/68">
            {sig.category}
          </span>
          <span className="text-crt/20">·</span>
          <span className="text-[13px] text-crt/45">
            {SOURCE_TYPE_LABELS[sig.source_type] ?? sig.source_type}
          </span>
          {sig.submitted_publicly && (
            <span
              className="px-2 py-0.5 text-[11px] font-medium"
              style={{ background: 'rgba(109,168,255,0.12)', border: '1px solid rgba(109,168,255,0.32)', color: '#6da8ff' }}
            >
              public
            </span>
          )}
          {inRebirthQueue && (
            <span
              className="px-2 py-0.5 text-[11px] font-medium uppercase tracking-[0.08em]"
              style={{ background: 'rgba(215,168,92,0.12)', border: '1px solid rgba(215,168,92,0.40)', color: '#d7a85c' }}
            >
              ◈ rebirth ready
            </span>
          )}
        </div>
        <StatusBadge status={sig.status} />
      </div>

      {/* ── TITLE ── */}
      <div className="px-5 pb-3 pt-5 md:px-6">
        <h3 className="text-[1.5rem] font-medium leading-[1.28] tracking-[0.01em] text-crt/95 md:text-[1.6rem]">
          {sig.title}
        </h3>
      </div>

      {/* ── SUMMARY ── */}
      <div className="px-5 pb-5 md:px-6">
        <p className="text-[17px] leading-[1.72] tracking-[0.02em] text-crt/82 md:text-[18px]">
          {sig.summary}
        </p>
      </div>

      {/* ── SOURCE ── */}
      <div className="border-t border-crt/10 px-5 py-4 md:px-6">
        <div className="mb-1.5 text-[12px] uppercase tracking-[0.12em] text-crt/38">Source</div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-[15px] text-crt/75">{sig.source_name}</span>
          <span className="text-crt/22">·</span>
          <span className="text-[14px] uppercase tracking-[0.06em] text-crt/48">
            {SOURCE_TYPE_LABELS[sig.source_type] ?? sig.source_type}
          </span>
          {sig.source_url && (
            <a
              href={sig.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-[14px] text-crt/38 transition-colors hover:text-crt/65"
            >
              ↗ view source
            </a>
          )}
        </div>
      </div>

      {/* ── METADATA GRID ── */}
      <div className="border-t border-crt/10 px-5 py-4 md:px-6">
        <div className="grid grid-cols-2 gap-x-8 gap-y-4 sm:grid-cols-4">
          <div>
            <div className="mb-2 text-[12px] uppercase tracking-[0.12em] text-crt/38">Anomaly</div>
            <AnomalyScore score={sig.anomaly_score} />
          </div>
          <div>
            <div className="mb-2 text-[12px] uppercase tracking-[0.12em] text-crt/38">Discovered</div>
            <div className="text-[15px] text-crt/72">{sig.discovered_at.slice(0, 10)}</div>
          </div>
          <div>
            <div className="mb-2 text-[12px] uppercase tracking-[0.12em] text-crt/38">Approved</div>
            <div className="text-[15px] text-crt/72">
              {sig.approved_at ? sig.approved_at.slice(0, 10) : '—'}
            </div>
          </div>
          <div>
            <div className="mb-2 text-[12px] uppercase tracking-[0.12em] text-crt/38">Origin</div>
            <div className="text-[15px] text-crt/65">
              {sig.submitted_publicly ? 'Public submission' : 'Curator intake'}
            </div>
          </div>
        </div>
      </div>

      {/* ── TAGS ── */}
      {sig.tags.length > 0 && (
        <div className="border-t border-crt/10 px-5 py-4 md:px-6">
          <div className="mb-2.5 text-[12px] uppercase tracking-[0.12em] text-crt/38">Tags</div>
          <div className="flex flex-wrap gap-2">
            {sig.tags.map((tag) => (
              <span
                key={tag}
                className="border border-crt/20 px-2.5 py-1 text-[13px] text-crt/60"
              >
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ── ACTIONS ── */}
      <div className="border-t border-crt/12 px-5 py-4 md:px-6">
        <div className="flex flex-wrap items-center gap-3">

          {/* Status actions */}
          {sig.status !== 'approved' && (
            <button
              onClick={() => onStatusChange(sig.id, 'approved')}
              disabled={busy || isRebirthOpen}
              className="border border-[#86d46e]/38 bg-[rgba(134,212,110,0.08)] px-5 py-2.5 text-[14px] font-medium text-[#86d46e] transition-colors hover:bg-[rgba(134,212,110,0.16)] hover:border-[#86d46e]/60 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Approve
            </button>
          )}
          {sig.status !== 'archived' && (
            <button
              onClick={() => onStatusChange(sig.id, 'archived')}
              disabled={busy || isRebirthOpen}
              className="border border-[#6da8ff]/32 bg-[rgba(109,168,255,0.07)] px-5 py-2.5 text-[14px] font-medium text-[#6da8ff]/82 transition-colors hover:bg-[rgba(109,168,255,0.14)] hover:border-[#6da8ff]/55 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Archive
            </button>
          )}
          {sig.status !== 'rejected' && (
            <button
              onClick={() => onStatusChange(sig.id, 'rejected')}
              disabled={busy || isRebirthOpen}
              className="border border-[#ff6b6b]/25 bg-[rgba(255,107,107,0.05)] px-5 py-2.5 text-[14px] font-medium text-[#ff6b6b]/62 transition-colors hover:bg-[rgba(255,107,107,0.12)] hover:border-[#ff6b6b]/45 disabled:cursor-not-allowed disabled:opacity-30"
            >
              Reject
            </button>
          )}

          {/* Rebirth — right-aligned */}
          <div className="ml-auto">
            {publishedResult ? null : alreadyPublished ? (
              <span className="text-[14px] text-crt/28">◈ Already reborn</span>
            ) : isRebirthOpen ? null : (
              <button
                onClick={() => onRequestRebirth(sig)}
                disabled={busy}
                className={`border px-5 py-2.5 text-[14px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-30 ${
                  inRebirthQueue
                    ? 'border-[#d7a85c]/50 bg-[rgba(215,168,92,0.10)] text-[#d7a85c] hover:bg-[rgba(215,168,92,0.20)] hover:border-[#d7a85c]/72'
                    : 'border-crt/25 bg-[rgba(134,212,110,0.04)] text-crt/58 hover:border-crt/38 hover:text-crt/80'
                }`}
              >
                ◈ Prepare Rebirth
              </button>
            )}
          </div>
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

      {/* ── Share package ── */}
      {publishedResult && <SharePackagePanel result={publishedResult} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// QueueStats — sidebar widget
// ---------------------------------------------------------------------------

function QueueStats({
  counts,
  rebirthQueueCount,
}: {
  counts:            Record<RecoveredSignalStatus | 'all', number>;
  rebirthQueueCount: number;
}) {
  return (
    <div className="border border-crt/15 bg-[rgba(4,7,5,0.97)] p-5">
      <h3 className="mb-4 text-[12px] uppercase tracking-[0.16em] text-crt/42">
        Queue Status
      </h3>
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-[14px] text-crt/52">Total</span>
          <span className="font-mono text-[15px] font-medium text-crt/80">{counts.all}</span>
        </div>
        {(Object.entries({
          pending:  { label: 'Pending',  color: STATUS_COLORS.pending  },
          approved: { label: 'Approved', color: STATUS_COLORS.approved },
          archived: { label: 'Archived', color: STATUS_COLORS.archived },
          rejected: { label: 'Rejected', color: STATUS_COLORS.rejected },
        }) as Array<[RecoveredSignalStatus, { label: string; color: string }]>).map(([key, { label, color }]) => (
          <div key={key} className="flex items-center justify-between">
            <span className="text-[14px]" style={{ color: `${color}88` }}>{label}</span>
            <span className="font-mono text-[15px] font-medium" style={{ color }}>{counts[key]}</span>
          </div>
        ))}

        {rebirthQueueCount > 0 && (
          <div className="border-t border-crt/10 pt-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[14px] text-[#d7a85c]/72">Rebirth ready</span>
              <span className="font-mono text-[15px] font-medium text-[#d7a85c]">
                {rebirthQueueCount}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AIScannerPanel — sidebar widget (placeholder, non-functional)
// ---------------------------------------------------------------------------

function AIScannerPanel() {
  return (
    <div className="border border-crt/15 bg-[rgba(4,7,5,0.97)] p-5">
      <div className="mb-1 flex items-center gap-2">
        <span className="h-1.5 w-1.5 bg-crt/25" />
        <h3 className="text-[12px] uppercase tracking-[0.16em] text-crt/42">
          AI Scanner
        </h3>
      </div>
      <p className="mb-4 text-[12px] text-crt/28">future phase — not active</p>

      <div className="space-y-2">
        {AI_SCANNER_ROWS.map(({ label, value, dim }) => (
          <div key={label} className="flex items-baseline justify-between gap-3">
            <span className="text-[13px] text-crt/42">{label}</span>
            <span className={`text-[13px] font-medium ${dim ? 'text-crt/28' : 'text-crt/65'}`}>
              {value}
            </span>
          </div>
        ))}
      </div>

      <p className="mt-4 text-[12px] leading-relaxed text-crt/30">
        Automated signal recovery planned for a future phase.
        Current intake is manual curator workflow only.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SignalQueueClient — main console
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

  // Toolbar state
  const [activeTab,        setActiveTab]        = useState<RecoveredSignalStatus | 'all'>('pending');
  const [searchQuery,      setSearchQuery]      = useState('');
  const [filterCategory,   setFilterCategory]   = useState('');
  const [filterSourceType, setFilterSourceType] = useState('');
  const [sortScore,        setSortScore]        = useState<'desc' | 'asc' | null>(null);

  // Intake form
  const [showIntake, setShowIntake] = useState(false);

  // Optimistic status overrides
  const [overrides, setOverrides] = useState<Record<string, RecoveredSignalStatus>>({});

  // Rebirth state
  const [publishingId,     setPublishingId]     = useState<string | null>(null);
  const [rebirthOpenId,    setRebirthOpenId]    = useState<string | null>(null);
  const [publishedResults, setPublishedResults] = useState<Record<string, PublishResult>>({});

  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Merge + apply optimistic overrides
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

  // Tab filter
  let visibleSignals =
    activeTab === 'all'
      ? allSignals
      : allSignals.filter((s) => s.status === activeTab);

  // Search filter
  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    visibleSignals = visibleSignals.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.summary.toLowerCase().includes(q) ||
        s.source_name.toLowerCase().includes(q),
    );
  }

  // Category / source type filters
  if (filterCategory)   visibleSignals = visibleSignals.filter((s) => s.category === filterCategory);
  if (filterSourceType) visibleSignals = visibleSignals.filter((s) => s.source_type === filterSourceType);

  // Sort
  if (sortScore === 'desc') visibleSignals = [...visibleSignals].sort((a, b) => b.anomaly_score - a.anomaly_score);
  if (sortScore === 'asc')  visibleSignals = [...visibleSignals].sort((a, b) => a.anomaly_score - b.anomaly_score);

  // Grouped for "all" tab
  const groupedByStatus: Record<RecoveredSignalStatus, DbRecoveredSignal[]> =
    STATUS_SECTION_ORDER.reduce(
      (acc, s) => { acc[s] = visibleSignals.filter((sig) => sig.status === s); return acc; },
      {} as Record<RecoveredSignalStatus, DbRecoveredSignal[]>,
    );

  // Rebirth queue split
  const rebirthQueueSignals  = visibleSignals.filter(
    (s) => s.status === 'pending' && s.anomaly_score >= REBIRTH_SCORE_THRESHOLD,
  );
  const rebirthQueueIds      = new Set(rebirthQueueSignals.map((s) => s.id));
  const regularPendingSignals = visibleSignals.filter(
    (s) => s.status === 'pending' && !rebirthQueueIds.has(s.id),
  );

  const hasActiveFilter = Boolean(searchQuery.trim() || filterCategory || filterSourceType || sortScore);

  function clearFilters() {
    setSearchQuery('');
    setFilterCategory('');
    setFilterSourceType('');
    setSortScore(null);
  }

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
        showError(`Status update failed — ${result.error}`);
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
        showError(`Rebirth failed — ${result.error}`);
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
    <div className="relative min-h-screen pb-16 pt-[80px] md:pt-[100px]">
      <AmbientGrid className="pointer-events-none absolute inset-0 opacity-[0.10]" />

      {/* ── Sticky toolbar ── */}
      <div className="sticky top-[72px] z-20 border-b border-crt/15 bg-[rgba(2,3,3,0.98)] backdrop-blur-sm md:top-[80px]">

        {/* Title bar */}
        <div className="border-b border-crt/10 px-4 py-3 md:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-crt/35">
                swim · curator console · restricted access
              </div>
              <h1 className="text-[1.5rem] font-semibold tracking-[0.05em] text-crt/92 md:text-[1.7rem]">
                Signal Queue
              </h1>
            </div>
            <button
              onClick={() => setShowIntake((v) => !v)}
              className={`border px-4 py-2 text-[13px] font-medium transition-colors ${
                showIntake
                  ? 'border-crt/30 text-crt/65 hover:border-crt/18 hover:text-crt/40'
                  : 'border-crt/22 text-crt/48 hover:border-crt/38 hover:text-crt/72'
              }`}
            >
              {showIntake ? '− Close Intake' : '+ New Signal'}
            </button>
          </div>
        </div>

        {/* Status tabs */}
        <div className="border-b border-crt/8 px-4 md:px-8">
          <div className="flex gap-0 overflow-x-auto">
            {STATUS_TABS.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key)}
                className={`border-b-2 px-5 py-3 text-[14px] font-medium transition-colors whitespace-nowrap ${
                  activeTab === key
                    ? 'border-crt/60 text-crt/88'
                    : 'border-transparent text-crt/38 hover:text-crt/65'
                }`}
              >
                {label}
                {key !== 'all' && (
                  <span className={`ml-2 text-[13px] ${activeTab === key ? 'text-crt/50' : 'text-crt/28'}`}>
                    {counts[key as RecoveredSignalStatus]}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Filter row */}
        <div className="px-4 py-2.5 md:px-8">
          <div className="flex flex-wrap items-center gap-3">
            {/* Search */}
            <div className="min-w-[160px] flex-1 max-w-xs">
              <input
                type="search"
                placeholder="Search title / summary / source…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border border-crt/18 bg-transparent px-3 py-1.5 text-[14px] text-crt/72 placeholder:text-crt/28 focus:border-crt/35 focus:outline-none"
              />
            </div>

            {/* Category */}
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="border border-crt/18 bg-transparent px-3 py-1.5 text-[13px] text-crt/62 focus:border-crt/32 focus:outline-none"
            >
              <option value="">All categories</option>
              {uniqueCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Source type */}
            <select
              value={filterSourceType}
              onChange={(e) => setFilterSourceType(e.target.value)}
              className="border border-crt/18 bg-transparent px-3 py-1.5 text-[13px] text-crt/62 focus:border-crt/32 focus:outline-none"
            >
              <option value="">All sources</option>
              {uniqueSourceTypes.map((t) => (
                <option key={t} value={t}>{SOURCE_TYPE_LABELS[t]}</option>
              ))}
            </select>

            {/* Score sort */}
            <button
              onClick={() => setSortScore((v) => v === 'desc' ? 'asc' : v === 'asc' ? null : 'desc')}
              className={`border px-3 py-1.5 text-[13px] transition-colors ${
                sortScore
                  ? 'border-crt/30 text-crt/65 hover:border-crt/18 hover:text-crt/42'
                  : 'border-crt/15 text-crt/38 hover:border-crt/25 hover:text-crt/58'
              }`}
            >
              Score {sortScore === 'desc' ? '↓' : sortScore === 'asc' ? '↑' : '—'}
            </button>

            {/* Clear */}
            {hasActiveFilter && (
              <button
                onClick={clearFilters}
                className="ml-auto text-[13px] text-crt/35 transition-colors hover:text-crt/62"
              >
                × Clear filters
                <span className="ml-2 text-crt/25">({visibleSignals.length} shown)</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ── Main layout ── */}
      <div className="relative z-10 mx-auto max-w-7xl px-4 py-6 md:px-8 md:py-8">

        {/* Intake form */}
        {showIntake && (
          <div className="mb-6 border border-crt/18 bg-[rgba(4,7,5,0.97)]">
            <IntakeFormClient onSuccess={() => setShowIntake(false)} />
          </div>
        )}

        {/* Error */}
        {errorMsg && (
          <div className="mb-5 border border-red-900/45 bg-[rgba(40,10,10,0.65)] px-5 py-3 text-[14px] text-red-400/85">
            › {errorMsg}
          </div>
        )}

        {/* Two-column */}
        <div className="flex flex-col gap-6 md:flex-row md:items-start lg:gap-8">

          {/* ── Signal cards (main column) ── */}
          <div className="min-w-0 flex-1">
            {visibleSignals.length === 0 ? (
              <div className="border border-crt/12 bg-[rgba(4,7,5,0.97)] py-20 text-center text-[15px] text-crt/35">
                {hasActiveFilter ? 'No signals match the current filters.' : 'No signals in this state.'}
              </div>

            ) : activeTab === 'pending' ? (
              <div className="space-y-6">
                {/* Rebirth Queue */}
                {rebirthQueueSignals.length > 0 && (
                  <div>
                    <div className="mb-3 flex items-center gap-3">
                      <div className="h-px flex-1 bg-[rgba(215,168,92,0.22)]" />
                      <span className="shrink-0 text-[13px] uppercase tracking-[0.14em] text-[#d7a85c]/80">
                        ◈ Rebirth Queue — {rebirthQueueSignals.length} signal{rebirthQueueSignals.length !== 1 ? 's' : ''} · anomaly ≥ {REBIRTH_SCORE_THRESHOLD}
                      </span>
                      <div className="h-px flex-1 bg-[rgba(215,168,92,0.22)]" />
                    </div>
                    <div className="space-y-4">
                      {rebirthQueueSignals.map(renderCard)}
                    </div>
                  </div>
                )}

                {/* Remaining pending */}
                {regularPendingSignals.length > 0 && (
                  <div>
                    {rebirthQueueSignals.length > 0 && (
                      <div className="mb-3 flex items-center gap-3">
                        <div className="h-px flex-1 bg-crt/10" />
                        <span className="shrink-0 text-[13px] text-crt/35">
                          Remaining · {regularPendingSignals.length}
                        </span>
                        <div className="h-px flex-1 bg-crt/10" />
                      </div>
                    )}
                    <div className="space-y-4">
                      {regularPendingSignals.map(renderCard)}
                    </div>
                  </div>
                )}
              </div>

            ) : activeTab === 'all' ? (
              <div className="space-y-10">
                {STATUS_SECTION_ORDER.map((status) => {
                  const sigs = groupedByStatus[status];
                  if (sigs.length === 0) return null;
                  return (
                    <div key={status}>
                      <div className="mb-4 flex items-center gap-3">
                        <div className="h-px flex-1" style={{ backgroundColor: `${STATUS_COLORS[status]}22` }} />
                        <span
                          className="shrink-0 text-[13px] uppercase tracking-[0.12em]"
                          style={{ color: `${STATUS_COLORS[status]}90` }}
                        >
                          {SECTION_LABELS[status]} · {sigs.length}
                        </span>
                        <div className="h-px flex-1" style={{ backgroundColor: `${STATUS_COLORS[status]}22` }} />
                      </div>
                      <div className="space-y-4">
                        {sigs.map(renderCard)}
                      </div>
                    </div>
                  );
                })}
              </div>

            ) : (
              <div className="space-y-4">
                {visibleSignals.map(renderCard)}
              </div>
            )}
          </div>

          {/* ── Sidebar ── */}
          <div className="w-full shrink-0 space-y-4 md:w-[268px] lg:w-[288px]">
            <QueueStats counts={counts} rebirthQueueCount={rebirthQueueSignals.length} />
            <AIScannerPanel />

            {/* Footer note */}
            <p className="text-center text-[12px] text-crt/22">
              Service role key required · Not accessible to public users
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
