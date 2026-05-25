'use client';

/**
 * SignalQueueClient — curator review console for /scanner/queue.
 *
 * Admin-only. Readability-first layout.
 * Nothing publishes without explicit curator action (human approval gate).
 */

import Link from 'next/link';
import { useState, useMemo, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { AmbientGrid } from '@/components/AmbientGrid';
import { IntakeFormClient } from '@/components/IntakeFormClient';
import { analyzeRecoveredSignal } from '@/lib/ai-analysis';
import type { SignalAnalysis } from '@/lib/ai-analysis';
import { computeDuplicateRisk } from '@/lib/duplicate-detection';
import type { DuplicateRiskResult, RelatedSignal } from '@/lib/duplicate-detection';
import {
  updateSignalStatusAction,
  updateCuratorNotesAction,
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
  { key: 'all',           label: 'All'           },
  { key: 'pending',       label: 'Pending'       },
  { key: 'reviewing',     label: 'Reviewing'     },
  { key: 'rebirth-ready', label: 'Rebirth Ready' },
  { key: 'approved',      label: 'Approved'      },
  { key: 'archived',      label: 'Archived'      },
  { key: 'rejected',      label: 'Rejected'      },
];

const STATUS_SECTION_ORDER: RecoveredSignalStatus[] = [
  'pending', 'reviewing', 'rebirth-ready', 'approved', 'archived', 'rejected',
];

const SECTION_LABELS: Record<RecoveredSignalStatus, string> = {
  pending:         'Pending',
  reviewing:       'Reviewing',
  'rebirth-ready': 'Rebirth Ready',
  approved:        'Approved',
  archived:        'Archived',
  rejected:        'Rejected',
};

const STATUS_COLORS: Record<RecoveredSignalStatus, string> = {
  pending:         '#d7a85c',
  reviewing:       '#4db8c8',
  'rebirth-ready': '#c084fc',
  approved:        '#86d46e',
  archived:        '#6da8ff',
  rejected:        '#ff6b6b',
};

const STATUS_BG: Record<RecoveredSignalStatus, string> = {
  pending:         'rgba(215,168,92,0.12)',
  reviewing:       'rgba(77,184,200,0.10)',
  'rebirth-ready': 'rgba(192,132,252,0.10)',
  approved:        'rgba(134,212,110,0.10)',
  archived:        'rgba(109,168,255,0.10)',
  rejected:        'rgba(255,107,107,0.09)',
};

const STATUS_BORDER: Record<RecoveredSignalStatus, string> = {
  pending:         'rgba(215,168,92,0.40)',
  reviewing:       'rgba(77,184,200,0.45)',
  'rebirth-ready': 'rgba(192,132,252,0.45)',
  approved:        'rgba(134,212,110,0.38)',
  archived:        'rgba(109,168,255,0.35)',
  rejected:        'rgba(255,107,107,0.30)',
};

const SOURCE_TYPE_LABELS: Record<SignalSourceType, string> = {
  reddit:     'Reddit',
  forum:      'Forum',
  pastebin:   'Pastebin',
  wayback:    'Wayback Machine',
  imageboard: 'Imageboard',
  irc:        'IRC',
  other:      'Other',
};

const REBIRTH_CHECKLIST: ReadonlyArray<{ id: string; label: string }> = [
  { id: 'title',     label: 'Title is clear and cleaned up' },
  { id: 'summary',   label: 'Summary is in my own words — not verbatim source text' },
  { id: 'category',  label: 'Category is correct' },
  { id: 'source',    label: 'Source name and type are confirmed' },
  { id: 'duplicate', label: 'Checked for duplicates in the archive' },
  { id: 'safe',      label: 'No PII, no illegal content, safe to publish' },
];

const DUPLICATE_RISK_COLORS: Record<DuplicateRiskResult['risk'], string> = {
  low:    'rgba(134,212,110,0.55)',
  medium: '#d7a85c',
  high:   '#ff6b6b',
};

const AI_SCANNER_ROWS = [
  { label: 'Mode',         value: 'Manual intake',  dim: false },
  { label: 'Intelligence', value: 'Planned',         dim: true  },
  { label: 'Sources',      value: 'Offline',         dim: true  },
  { label: 'Approval',     value: 'Human required',  dim: false },
  { label: 'Auto-post',    value: 'Never',           dim: false },
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

  if (sig.attribution_text) {
    lines.push('', `Attribution: ${sig.attribution_text}`);
  }
  if (sig.source_url) lines.push(`Source: ${sig.source_url}`);

  const hasEvidence = sig.source_image_url || sig.media_url;
  if (hasEvidence) {
    lines.push('', '> Evidence:');
    if (sig.source_image_url) lines.push(`> Screenshot / capture: ${sig.source_image_url}`);
    if (sig.media_url) lines.push(`> Media (${sig.media_type ?? 'file'}): ${sig.media_url}`);
  }

  if (sig.source_capture_notes) {
    lines.push('', `> Capture notes: ${sig.source_capture_notes}`);
  }

  if (sig.tags.length > 0) {
    lines.push('', `tags: ${sig.tags.join(' · ')}`);
  }

  lines.push(
    '',
    '[ curator note: add context about how this signal was found and why it matters — remove this line before publishing ]',
  );
  return lines.join('\n');
}

// ---------------------------------------------------------------------------
// AnomalyScore
// ---------------------------------------------------------------------------

function AnomalyScore({ score }: { score: number }) {
  const color = score >= 8 ? '#ff6b6b' : score >= 6 ? '#d7a85c' : '#86d46e';
  return (
    <div className="flex items-center gap-2.5">
      <div className="flex gap-[2px]">
        {Array.from({ length: 10 }, (_, i) => (
          <div
            key={i}
            className="h-4 w-2.5"
            style={{ backgroundColor: i < score ? color : 'rgba(134,212,110,0.12)' }}
          />
        ))}
      </div>
      <span className="text-[16px] font-semibold tabular-nums" style={{ color }}>
        {score}/10
      </span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// StatusBadge — "Reborn" when approved + published
// ---------------------------------------------------------------------------

function StatusBadge({ sig }: { sig: DbRecoveredSignal }) {
  const isReborn = sig.status === 'approved' && Boolean(sig.published_thread_id);

  const label  = isReborn ? 'Reborn' : SECTION_LABELS[sig.status];
  const color  = isReborn ? '#c084fc' : STATUS_COLORS[sig.status];
  const bg     = isReborn ? 'rgba(192,132,252,0.12)' : STATUS_BG[sig.status];
  const border = isReborn ? 'rgba(192,132,252,0.45)' : STATUS_BORDER[sig.status];

  return (
    <span
      className="px-3 py-1 text-[13px] font-semibold"
      style={{ background: bg, border: `1px solid ${border}`, color }}
    >
      {label}
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
      className="text-sm text-crt/45 transition-colors hover:text-crt/72"
    >
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  );
}

// ---------------------------------------------------------------------------
// PipelineBar — workflow stage tracker (Task 3)
// ---------------------------------------------------------------------------

const PIPELINE_STAGES = [
  { key: 'pending'       as const, label: 'Pending'   },
  { key: 'reviewing'     as const, label: 'Reviewing' },
  { key: 'rebirth-ready' as const, label: 'Ready'     },
  { key: 'reborn'        as const, label: 'Reborn'    },
];

function PipelineBar({
  sig,
  publishedResult,
}: {
  sig: DbRecoveredSignal;
  publishedResult: PublishResult | null;
}) {
  const isReborn = publishedResult !== null || (sig.status === 'approved' && Boolean(sig.published_thread_id));
  const currentKey = isReborn
    ? 'reborn'
    : (['pending', 'reviewing', 'rebirth-ready'] as string[]).includes(sig.status)
    ? sig.status
    : null;

  if (!currentKey) return null;

  const stageIdx = PIPELINE_STAGES.findIndex((s) => s.key === currentKey);

  return (
    <div className="flex items-center border-b border-crt/8 bg-[rgba(2,3,3,0.30)] px-5 py-2.5 md:px-6">
      {PIPELINE_STAGES.map((stage, i) => {
        const isPast    = i < stageIdx;
        const isCurrent = i === stageIdx;
        const dotColor = isCurrent
          ? stage.key === 'reborn' ? '#c084fc' : STATUS_COLORS[stage.key as RecoveredSignalStatus]
          : isPast  ? 'rgba(134,212,110,0.50)'
          : 'rgba(134,212,110,0.14)';
        const textColor = isCurrent
          ? stage.key === 'reborn' ? '#c084fc' : STATUS_COLORS[stage.key as RecoveredSignalStatus]
          : isPast  ? 'rgba(134,212,110,0.38)'
          : 'rgba(134,212,110,0.20)';
        return (
          <div key={stage.key} className="flex items-center">
            {i > 0 && (
              <div
                className="mx-2 h-px w-6 shrink-0 sm:w-10"
                style={{ background: isPast ? 'rgba(134,212,110,0.28)' : 'rgba(134,212,110,0.08)' }}
              />
            )}
            <div className="flex flex-col items-center gap-0.5">
              <div
                className="h-2 w-2 rounded-full"
                style={{ background: dotColor, boxShadow: isCurrent ? `0 0 6px ${dotColor}` : 'none' }}
              />
              <span className="whitespace-nowrap text-[10px] font-semibold" style={{ color: textColor }}>
                {stage.label}
              </span>
            </div>
          </div>
        );
      })}
      {isReborn && sig.published_thread_id && (
        <Link
          href={`/threads/${sig.published_thread_id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="ml-auto text-xs font-medium text-[#c084fc]/65 hover:text-[#c084fc] transition-colors"
        >
          ✓ Published · Open ↗
        </Link>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// EvidenceSection — original source + media area (Task 3/4)
// ---------------------------------------------------------------------------

function EvidenceSection({ sig }: { sig: DbRecoveredSignal }) {
  return (
    <div className="border-t border-crt/12">
      {/* Section header */}
      <div className="flex items-center justify-between bg-[rgba(2,3,3,0.35)] px-5 py-2.5 md:px-6">
        <span className="text-xs font-semibold uppercase tracking-wider text-crt/38">
          Original Evidence
        </span>
        <span className="text-xs text-crt/25">{SOURCE_TYPE_LABELS[sig.source_type] ?? sig.source_type}</span>
      </div>

      <div className="px-5 py-4 md:px-6">
        {/* Source metadata card */}
        <div className="mb-4 flex flex-wrap items-start gap-3">
          {/* Source name block */}
          <div className="flex-1 min-w-[160px] border border-crt/14 bg-[rgba(4,7,5,0.55)] px-4 py-3">
            <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-crt/30">Source</p>
            <p className="text-base font-medium text-crt/85">{sig.source_name}</p>
            <p className="mt-0.5 text-sm text-crt/45">{SOURCE_TYPE_LABELS[sig.source_type] ?? sig.source_type}</p>
          </div>
          {/* Metadata block */}
          <div className="flex-1 min-w-[140px] border border-crt/14 bg-[rgba(4,7,5,0.55)] px-4 py-3">
            <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-crt/30">Metadata</p>
            <p className="text-sm text-crt/65">Discovered: {sig.discovered_at.slice(0, 10)}</p>
            {sig.approved_at && (
              <p className="text-sm text-crt/50">Approved: {sig.approved_at.slice(0, 10)}</p>
            )}
            <p className="mt-0.5 text-xs text-crt/35">
              {sig.submitted_publicly ? 'Public submission' : 'Curator intake'}
            </p>
          </div>
        </div>

        {/* Source URL card */}
        {sig.source_url && (
          <div className="mb-4 flex items-center justify-between gap-3 border border-crt/18 bg-[rgba(134,212,110,0.03)] px-4 py-3">
            <span className="min-w-0 truncate text-sm text-crt/50 font-mono">{sig.source_url}</span>
            <a
              href={sig.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 border border-crt/25 bg-[rgba(134,212,110,0.06)] px-3 py-1.5 text-sm font-medium text-crt/70 transition-colors hover:border-crt/40 hover:text-crt/90"
            >
              View Source ↗
            </a>
          </div>
        )}

        {/* Attribution + capture notes */}
        {(sig.attribution_text || sig.source_capture_notes) && (
          <div className="mb-4 space-y-2">
            {sig.attribution_text && (
              <div className="flex items-start gap-2 border border-crt/14 bg-[rgba(4,7,5,0.45)] px-4 py-2.5">
                <span className="shrink-0 text-xs font-semibold text-crt/35 pt-0.5">CREDIT</span>
                <p className="text-sm leading-relaxed text-crt/70">{sig.attribution_text}</p>
              </div>
            )}
            {sig.source_capture_notes && (
              <div className="flex items-start gap-2 border border-crt/12 bg-[rgba(4,7,5,0.35)] px-4 py-2.5">
                <span className="shrink-0 text-xs font-semibold text-crt/30 pt-0.5">CAPTURE</span>
                <p className="text-sm leading-relaxed text-crt/55">{sig.source_capture_notes}</p>
              </div>
            )}
          </div>
        )}

        {/* Media / screenshot frame */}
        {sig.source_image_url ? (
          <div className="overflow-hidden border-2 border-crt/15">
            <div className="flex items-center justify-between bg-[rgba(2,3,3,0.5)] px-3 py-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-crt/30">Screenshot / Capture</span>
            </div>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={sig.source_image_url} alt="Source capture" className="max-h-72 w-full object-cover" />
          </div>
        ) : sig.media_url ? (
          <div className="border-2 border-crt/15">
            <div className="flex items-center justify-between bg-[rgba(2,3,3,0.5)] px-3 py-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-crt/30">
                Attached Media — {sig.media_type ?? 'file'}
              </span>
              <a
                href={sig.media_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-[#86d46e]/65 hover:text-[#86d46e] transition-colors"
              >
                Open ↗
              </a>
            </div>
            <div className="px-4 py-6 text-center text-sm text-crt/40">Media attached — click Open to view</div>
          </div>
        ) : (
          <div className="border-2 border-dashed border-crt/10">
            <div className="flex items-center bg-[rgba(2,3,3,0.35)] px-3 py-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-wider text-crt/22">Media Frame</span>
            </div>
            <div className="px-5 py-5 text-center">
              <p className="text-sm text-crt/30">No media attached</p>
              <p className="mt-1 text-xs text-crt/18 leading-relaxed">
                Future: screenshots · archived images · document fragments · video stills · audio clips
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RebirthSuccessPanel (Task 2 — clear success state)
// ---------------------------------------------------------------------------

function BigCopyButton({
  text,
  label,
  accentColor,
  accentBg,
  meta,
}: {
  text:        string;
  label:       string;
  accentColor: string;
  accentBg:    string;
  meta?:       React.ReactNode;
}) {
  const [copied,      setCopied]      = useState(false);
  const [showPreview, setShowPreview] = useState(false);

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
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="border border-crt/14 bg-[rgba(4,7,5,0.55)]">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-crt/10 px-4 py-3">
        <div className="flex items-center gap-3">
          <span className="text-sm font-semibold text-crt/65">{label}</span>
          {meta}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="text-xs text-crt/35 transition-colors hover:text-crt/58"
          >
            {showPreview ? 'Hide preview' : 'Preview'}
          </button>
        </div>
      </div>
      <div className="px-4 py-3">
        <button
          onClick={handleCopy}
          className="flex w-full items-center justify-center gap-2 border-2 py-3 text-base font-bold transition-all sm:w-auto sm:px-8"
          style={{
            borderColor: copied ? `${accentColor}80` : `${accentColor}55`,
            background:  copied ? accentBg.replace('0.10', '0.18') : accentBg,
            color:       accentColor,
          }}
        >
          {copied ? `✓ Copied!` : `Copy ${label}`}
        </button>
      </div>
      {showPreview && (
        <div className="border-t border-crt/10 px-4 pb-3">
          <div className="max-h-40 overflow-y-auto bg-[rgba(4,7,5,0.75)] px-3 py-2.5 font-mono text-[13px] leading-relaxed text-crt/55 whitespace-pre-wrap">
            {text}
          </div>
        </div>
      )}
    </div>
  );
}

function RebirthSuccessPanel({ result }: { result: PublishResult }) {
  return (
    <div className="border-t-2 border-[#86d46e]/45 bg-[rgba(134,212,110,0.04)] px-5 py-6 md:px-6">
      {/* Success heading */}
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1.5 flex items-center gap-2.5">
            <span className="text-2xl text-[#86d46e]">✓</span>
            <span className="text-xl font-bold text-crt/92">Thread Reborn</span>
          </div>
          <p className="text-base text-crt/55">
            The signal is now a public SWIM thread.
          </p>
        </div>
        <Link
          href={`/threads/${result.threadSlug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 border-2 border-[#86d46e]/55 bg-[rgba(134,212,110,0.10)] px-5 py-3 text-base font-bold text-[#86d46e] transition-colors hover:bg-[rgba(134,212,110,0.18)]"
        >
          Open Thread ↗
        </Link>
      </div>

      {/* Step 4 label */}
      <p className="mb-4 text-sm font-semibold text-crt/45">
        Step 4 — Copy social posts and share manually (no API calls made)
      </p>

      <div className="space-y-4">
        <BigCopyButton
          text={result.telegramText}
          label="Telegram"
          accentColor="#86d46e"
          accentBg="rgba(134,212,110,0.10)"
        />
        <BigCopyButton
          text={result.xText}
          label="X / Twitter"
          accentColor="#4db8c8"
          accentBg="rgba(77,184,200,0.10)"
          meta={
            <div className="flex items-center gap-2">
              <span
                className="text-sm tabular-nums"
                style={{ color: result.xText.length > 260 ? '#d7a85c' : 'rgba(134,212,110,0.45)' }}
              >
                {result.xText.length}/280
              </span>
              {result.titleTruncated && (
                <span className="text-xs text-[#d7a85c]/75">title truncated</span>
              )}
            </div>
          }
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// RebirthPanel — large readable editor (Task 4)
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
  const [checked,  setChecked]  = useState<Set<string>>(new Set());
  const [showPreview, setShowPreview] = useState(false);

  const allChecked = checked.size === REBIRTH_CHECKLIST.length;

  function toggleCheck(id: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

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

  const fieldCls =
    'w-full border border-crt/22 bg-[rgba(4,7,5,0.85)] px-4 py-3 text-base text-crt/90 placeholder:text-crt/25 focus:border-crt/42 focus:outline-none transition-colors';
  const labelCls = 'mb-2 block text-base font-medium text-crt/65';

  return (
    <div className="border-t-2 border-[#c084fc]/30 bg-[rgba(2,3,3,0.70)]">
      {/* Header */}
      <div className="border-b border-crt/12 px-5 py-5 md:px-6">
        <div className="mb-1 text-xs font-semibold uppercase tracking-widest text-[#c084fc]/70">
          Rebirth as Thread
        </div>
        <p className="text-lg font-medium text-crt/88">
          This will create a public SWIM thread in:{' '}
          <span className="text-[#c084fc]">{category}</span>
        </p>
        <p className="mt-1 text-sm text-crt/50">
          Edit the content below, complete the checklist, then click Publish.
          Remove the curator note from the body before publishing.
        </p>
      </div>

      <div className="px-5 py-6 md:px-6">
        {/* Title */}
        <div className="mb-6">
          <label className={labelCls}>Public thread title</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            disabled={isRebirthPending}
            className={`${fieldCls} text-lg`}
            placeholder="Thread title as it will appear publicly…"
          />
          <p className="mt-1.5 text-xs text-crt/30">{title.length}/200 characters</p>
        </div>

        {/* Category */}
        <div className="mb-6">
          <label className={labelCls}>Category</label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            disabled={isRebirthPending}
            className={`${fieldCls} cursor-pointer`}
          >
            {CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
          <p className="mt-1.5 text-xs text-crt/30">
            Thread will publish to: <span className="text-[#c084fc]/70">{category}</span>
          </p>
        </div>

        {/* Body */}
        <div className="mb-6">
          <label className={labelCls}>
            Thread body
            <span className="ml-2 text-sm font-normal text-crt/40">
              — delete the curator note line before publishing
            </span>
          </label>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={18}
            disabled={isRebirthPending}
            className={`${fieldCls} resize-y font-mono text-[15px] leading-relaxed`}
          />
        </div>

        {/* Tags */}
        <div className="mb-8">
          <label className={labelCls}>
            Tags
            <span className="ml-2 text-sm font-normal text-crt/40">comma separated</span>
          </label>
          <input
            type="text"
            value={tagsStr}
            onChange={(e) => setTagsStr(e.target.value)}
            maxLength={300}
            disabled={isRebirthPending}
            className={fieldCls}
            placeholder="e.g. deletion, audio, independent-witnesses"
          />
        </div>

        {/* Social preview (collapsible) */}
        <div className="mb-8 border border-crt/12">
          <button
            type="button"
            onClick={() => setShowPreview((v) => !v)}
            className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-crt/55 transition-colors hover:text-crt/75"
          >
            <span>Preview share text (Telegram / X)</span>
            <span className="text-crt/35">{showPreview ? '▾' : '▸'}</span>
          </button>
          {showPreview && (
            <div className="space-y-4 border-t border-crt/10 px-4 py-4">
              <div>
                <div className="mb-2 text-sm font-medium text-crt/45">Telegram</div>
                <div className="max-h-40 overflow-y-auto bg-[rgba(4,7,5,0.8)] px-4 py-3 font-mono text-sm leading-relaxed text-crt/55 whitespace-pre-wrap">
                  {telegramPreview}
                </div>
              </div>
              <div>
                <div className="mb-2 flex items-center gap-3">
                  <span className="text-sm font-medium text-crt/45">X / Twitter</span>
                  <span
                    className="text-sm tabular-nums"
                    style={{ color: xCharCount > 260 ? '#d7a85c' : 'rgba(134,212,110,0.38)' }}
                  >
                    {xCharCount}/280
                  </span>
                  {xTruncated && (
                    <span className="text-xs text-[#d7a85c]/80">title truncated</span>
                  )}
                </div>
                <div className="bg-[rgba(4,7,5,0.8)] px-4 py-3 font-mono text-sm leading-relaxed text-crt/55 whitespace-pre-wrap">
                  {xPreview}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Pre-publish checklist */}
        <div className="mb-8 border border-crt/18 bg-[rgba(4,7,5,0.5)] px-5 py-5">
          <h5 className="mb-4 text-sm font-semibold text-crt/65">
            Pre-publish checklist — complete all before publishing
          </h5>
          <div className="space-y-3">
            {REBIRTH_CHECKLIST.map(({ id, label }) => {
              const isChecked = checked.has(id);
              return (
                <label key={id} className="flex cursor-pointer items-start gap-3">
                  <span
                    className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center border text-xs transition-colors"
                    style={{
                      borderColor: isChecked ? 'rgba(192,132,252,0.70)' : 'rgba(134,212,110,0.25)',
                      background:  isChecked ? 'rgba(192,132,252,0.14)' : 'transparent',
                      color:       isChecked ? '#c084fc' : 'transparent',
                    }}
                    onClick={() => toggleCheck(id)}
                  >
                    ✓
                  </span>
                  <span className={`text-base leading-snug ${isChecked ? 'text-crt/80' : 'text-crt/48'}`}>
                    {label}
                  </span>
                </label>
              );
            })}
          </div>
          {!allChecked && (
            <p className="mt-4 text-sm text-crt/35">
              {REBIRTH_CHECKLIST.length - checked.size} item{REBIRTH_CHECKLIST.length - checked.size !== 1 ? 's' : ''} remaining
            </p>
          )}
        </div>

        {/* Commit buttons */}
        <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center">
          <button
            onClick={() => onRebirth({ title, body, category, tags: parsedTags })}
            disabled={isRebirthPending || !title.trim() || !body.trim() || !allChecked}
            className="w-full border border-[#c084fc]/50 bg-[rgba(192,132,252,0.12)] px-6 py-3.5 text-base font-semibold text-[#c084fc] transition-colors hover:bg-[rgba(192,132,252,0.22)] hover:border-[#c084fc]/72 disabled:cursor-not-allowed disabled:opacity-30 sm:w-auto"
          >
            {isRebirthPending ? 'Publishing…' : 'Publish Thread'}
          </button>
          <button
            onClick={onCancel}
            disabled={isRebirthPending}
            className="w-full border border-crt/18 px-6 py-3.5 text-base text-crt/55 transition-colors hover:border-crt/32 hover:text-crt/75 disabled:cursor-not-allowed disabled:opacity-30 sm:w-auto"
          >
            Cancel
          </button>
          {!allChecked && (
            <p className="text-sm text-crt/35 sm:ml-2">Complete the checklist to publish</p>
          )}
        </div>
        <p className="mt-3 text-xs text-crt/28">
          Author will be set to ARCHIVIST · "recovered-signal" tag added automatically
        </p>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CuratorNotesField — private, never shown publicly
// ---------------------------------------------------------------------------

function CuratorNotesField({ signalId, initialNotes }: { signalId: string; initialNotes: string }) {
  const [isOpen,      setIsOpen]      = useState(false);
  const [value,       setValue]       = useState(initialNotes);
  const [isSaving,    setIsSaving]    = useState(false);
  const [savedRecent, setSavedRecent] = useState(false);

  async function handleBlur() {
    if (value === initialNotes) return;
    setIsSaving(true);
    await updateCuratorNotesAction(signalId, value);
    setIsSaving(false);
    setSavedRecent(true);
    setTimeout(() => setSavedRecent(false), 2500);
  }

  return (
    <div className="border-t border-crt/10">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        className="flex w-full items-center justify-between bg-[rgba(2,3,3,0.35)] px-5 py-2.5 text-left transition-colors hover:bg-[rgba(2,3,3,0.55)] md:px-6"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold uppercase tracking-wider text-crt/38">Curator Notes</span>
          <span
            className="px-1.5 py-0.5 text-[11px] font-medium"
            style={{ background: 'rgba(109,168,255,0.10)', border: '1px solid rgba(109,168,255,0.22)', color: 'rgba(109,168,255,0.60)' }}
          >
            Private
          </span>
          {initialNotes && !isOpen && (
            <span className="text-xs text-crt/30 italic">has notes</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {isSaving && <span className="text-xs text-crt/30">Saving…</span>}
          {savedRecent && !isSaving && <span className="text-xs text-[#86d46e]/55">✓ Saved</span>}
          <span className="text-xs text-crt/28">{isOpen ? '▾' : '▸'}</span>
        </div>
      </button>
      {isOpen && (
        <div className="px-5 py-3 md:px-6">
          <textarea
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={handleBlur}
            placeholder="Internal notes — not visible to the public. Remove sensitive info before rebirth."
            rows={3}
            className="w-full resize-none border border-crt/14 bg-[rgba(4,7,5,0.7)] px-3 py-2.5 text-[15px] leading-relaxed text-crt/75 placeholder:text-crt/25 focus:border-crt/28 focus:outline-none"
          />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// RelatedSignalsPanel
// ---------------------------------------------------------------------------

function RelatedSignalsPanel({ result }: { result: DuplicateRiskResult }) {
  const { risk, reasons, related } = result;
  const riskColor = DUPLICATE_RISK_COLORS[risk];

  return (
    <div className="border-t border-crt/12 bg-[rgba(2,3,3,0.35)] px-5 py-5 md:px-6">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-crt/55">Duplicate Risk:</span>
        <span
          className="px-2.5 py-0.5 text-sm font-semibold"
          style={{ color: riskColor, border: `1px solid ${riskColor}55`, background: `${riskColor}14` }}
        >
          {risk.charAt(0).toUpperCase() + risk.slice(1)}
        </span>
        {risk === 'high' && (
          <span className="text-sm text-[#ff6b6b]/75">— review before publishing</span>
        )}
        <span className="ml-auto text-xs text-crt/25">heuristic · no AI</span>
      </div>

      {reasons.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2">
          {reasons.map((r) => (
            <span key={r} className="border border-crt/14 px-2.5 py-0.5 text-sm text-crt/55">
              {r}
            </span>
          ))}
        </div>
      )}

      {related.length > 0 ? (
        <div className="space-y-2">
          {related.map((rel: RelatedSignal) => {
            const statusColor = STATUS_COLORS[rel.status as RecoveredSignalStatus] ?? 'rgba(134,212,110,0.40)';
            return (
              <div key={rel.id} className="border border-crt/12 bg-[rgba(4,7,5,0.55)] px-4 py-3">
                <p className="mb-1 text-[15px] text-crt/78 leading-snug">{rel.title}</p>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
                  <span className="text-crt/40">{rel.category}</span>
                  <span className="text-crt/20">·</span>
                  <span className="font-medium" style={{ color: statusColor }}>{SECTION_LABELS[rel.status as RecoveredSignalStatus] ?? rel.status}</span>
                  <span className="text-crt/20">·</span>
                  <span className="text-crt/42">{rel.similarityNote}</span>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p className="text-sm text-crt/38">No similar signals found in the current queue.</p>
      )}

      <p className="mt-3 text-xs text-crt/22">
        Matches on: title words · tags · source URL · phrase overlap — no embeddings used
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// AnalysisPanel — mock AI (collapsed by default)
// ---------------------------------------------------------------------------

const REC_COLORS: Record<SignalAnalysis['publishRecommendation'], string> = {
  publish: '#86d46e', review: '#d7a85c', archive: '#6da8ff', reject: '#ff6b6b',
};
const REC_BG: Record<SignalAnalysis['publishRecommendation'], string> = {
  publish: 'rgba(134,212,110,0.08)', review: 'rgba(215,168,92,0.10)',
  archive: 'rgba(109,168,255,0.08)', reject: 'rgba(255,107,107,0.07)',
};
const FLAG_COLORS: Record<SignalAnalysis['safetyFlags'][number]['severity'], string> = {
  low: 'rgba(215,168,92,0.60)', medium: '#d7a85c', high: '#ff6b6b',
};

function AnalysisPanel({ analysis }: { analysis: SignalAnalysis }) {
  const recColor = REC_COLORS[analysis.publishRecommendation];
  const recBg    = REC_BG[analysis.publishRecommendation];

  return (
    <div className="border-t border-crt/12 bg-[rgba(2,3,3,0.40)] px-5 py-5 md:px-6">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="text-sm font-semibold text-crt/55">Mock Analysis Output</span>
        <span className="rounded px-2 py-0.5 text-xs font-medium"
          style={{ background: 'rgba(215,168,92,0.10)', border: '1px solid rgba(215,168,92,0.30)', color: 'rgba(215,168,92,0.75)' }}>
          Preview only — no AI API
        </span>
        <span className="ml-auto font-mono text-xs text-crt/22">v{analysis.analysisVersion}</span>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div className="space-y-4">
          {/* Category */}
          <div>
            <p className="mb-1 text-sm font-medium text-crt/45">Suggested Category</p>
            <div className="flex items-center gap-2.5">
              <span className="text-[15px] text-crt/82">{analysis.suggestedCategory}</span>
              {analysis.categoryMatch ? (
                <span className="text-sm text-[#86d46e]/65">✓ matches current</span>
              ) : (
                <span className="text-sm text-[#d7a85c]/72">≠ differs</span>
              )}
            </div>
          </div>
          {/* Inferred tags */}
          <div>
            <p className="mb-1.5 text-sm font-medium text-crt/45">Inferred Tags</p>
            {analysis.newTags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {analysis.newTags.map((tag) => (
                  <span key={tag} className="border border-crt/18 bg-[rgba(134,212,110,0.04)] px-2 py-0.5 text-sm text-crt/60">
                    + {tag}
                  </span>
                ))}
              </div>
            ) : (
              <span className="text-sm text-crt/35">No new tags inferred</span>
            )}
          </div>
          {/* Safety flags */}
          <div>
            <p className="mb-1.5 text-sm font-medium text-crt/45">Safety Flags</p>
            {analysis.safetyFlags.length === 0 ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-[#86d46e]/65">✓</span>
                <span className="text-sm text-crt/50">No flags detected</span>
              </div>
            ) : (
              <div className="space-y-2">
                {analysis.safetyFlags.map((flag, i) => (
                  <div key={i} className="border-l-2 pl-3" style={{ borderLeftColor: FLAG_COLORS[flag.severity] }}>
                    <span className="text-sm font-semibold" style={{ color: FLAG_COLORS[flag.severity] }}>
                      {flag.severity} · {flag.type}
                    </span>
                    <p className="text-sm leading-relaxed text-crt/55">{flag.note}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {/* Recommendation */}
          <div>
            <p className="mb-1.5 text-sm font-medium text-crt/45">Recommendation</p>
            <div className="mb-1.5 inline-flex items-center gap-2 px-3 py-1.5" style={{ background: recBg, border: `1px solid ${recColor}44` }}>
              <span className="text-[15px] font-semibold" style={{ color: recColor }}>
                {analysis.publishRecommendation.charAt(0).toUpperCase() + analysis.publishRecommendation.slice(1)}
              </span>
            </div>
            <p className="text-sm leading-relaxed text-crt/52">{analysis.recommendationNote}</p>
          </div>
          {/* Rationale */}
          <div>
            <p className="mb-1.5 text-sm font-medium text-crt/45">Anomaly Rationale</p>
            <p className="text-sm leading-relaxed text-crt/62">{analysis.anomalyRationale}</p>
          </div>
          {/* Confidence */}
          <div>
            <p className="mb-1.5 text-sm font-medium text-crt/45">Confidence</p>
            <div className="flex items-center gap-3">
              <div className="h-2 w-28 bg-[rgba(134,212,110,0.10)]">
                <div className="h-full bg-crt/40 transition-all" style={{ width: `${analysis.confidence}%` }} />
              </div>
              <span className="font-mono text-[15px] text-crt/65">{analysis.confidence}%</span>
            </div>
          </div>
        </div>
      </div>

      <p className="mt-4 text-xs text-crt/22">
        Deterministic mock — same signal always returns same output — no external API calls
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// WorkflowStepBanner — contextual step indicator per card
// ---------------------------------------------------------------------------

const WORKFLOW_STEPS: Partial<Record<RecoveredSignalStatus, {
  num:   number;
  label: string;
  hint:  string;
  color: string;
}>> = {
  pending:         { num: 1, label: 'Review Evidence',  hint: 'Read the signal, verify the source, check for red flags — then click Review',        color: STATUS_COLORS.pending         },
  reviewing:       { num: 2, label: 'Prepare Rebirth',  hint: 'Satisfied with quality? Click Prepare Rebirth — or Approve/Archive/Reject below',  color: STATUS_COLORS.reviewing       },
  'rebirth-ready': { num: 3, label: 'Publish Thread',   hint: 'Open the editor, review the thread body, complete the checklist, then publish',      color: STATUS_COLORS['rebirth-ready'] },
  approved:        { num: 3, label: 'Publish Thread',   hint: 'Signal approved — open the rebirth editor to publish it as a public thread',         color: STATUS_COLORS.approved        },
};

function WorkflowStepBanner({
  sig,
  isReborn,
}: {
  sig:      DbRecoveredSignal;
  isReborn: boolean;
}) {
  if (isReborn) {
    return (
      <div className="border-t-2 border-[#c084fc]/30 bg-[rgba(192,132,252,0.06)] px-5 py-4 md:px-6">
        <p className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider text-[#c084fc]/55">
          Step 4
        </p>
        <p className="text-lg font-semibold text-[#c084fc]/85">Copy Social Posts</p>
        <p className="mt-0.5 text-sm text-crt/48">Thread is live — use the copy buttons below</p>
      </div>
    );
  }

  const step = WORKFLOW_STEPS[sig.status];
  if (!step) return null;

  return (
    <div
      className="border-t-2 px-5 py-4 md:px-6"
      style={{ borderTopColor: `${step.color}45`, background: `${step.color}07` }}
    >
      <p
        className="mb-0.5 text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: `${step.color}88` }}
      >
        Step {step.num}
      </p>
      <p className="text-lg font-semibold" style={{ color: `${step.color}cc` }}>
        {step.label}
      </p>
      <p className="mt-0.5 text-sm text-crt/48">{step.hint}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SignalCard
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
  duplicateResult:  DuplicateRiskResult;
  allSignals:       DbRecoveredSignal[];
  isActiveReview:   boolean;
  anyRebirthOpen:   boolean;
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
  duplicateResult,
  allSignals: _allSignals,
  isActiveReview,
  anyRebirthOpen,
}: SignalCardProps) {
  const [showAdvanced,  setShowAdvanced]  = useState(false);
  const [showAnalysis,  setShowAnalysis]  = useState(false);
  const [showRelated,   setShowRelated]   = useState(false);
  const analysis = analyzeRecoveredSignal(sig);

  const isReborn         = publishedResult !== null || (sig.status === 'approved' && Boolean(sig.published_thread_id));
  const alreadyPublished = Boolean(sig.published_thread_id) && !publishedResult;
  const busy             = statusPending || isPublishing;

  const accentColor = isActiveReview
    ? '#4db8c8'
    : inRebirthQueue
    ? STATUS_COLORS['rebirth-ready']
    : STATUS_COLORS[sig.status];

  const cardBg = isActiveReview ? 'rgba(77,184,200,0.018)' : 'rgba(4,7,5,0.97)';
  const isDimmed = anyRebirthOpen && !isRebirthOpen;

  return (
    <div
      className="relative transition-all duration-300"
      style={{
        background:   cardBg,
        border:       `1px solid rgba(134,212,110,0.12)`,
        borderLeft:   `4px solid ${accentColor}`,
        boxShadow:    isRebirthOpen
          ? `0 8px 40px rgba(0,0,0,0.65), 0 0 0 1px ${accentColor}30`
          : '0 4px 20px rgba(0,0,0,0.40)',
        opacity:      isDimmed ? 0.45 : 1,
        pointerEvents: isDimmed ? 'none' : undefined,
      }}
    >
      {/* ── TOP ROW: status + category + dup warning ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-crt/10 px-5 py-3 md:px-6">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge sig={sig} />
          <span className="text-sm font-medium text-crt/65">{sig.category}</span>
          <span className="text-crt/20">·</span>
          <span className="text-sm text-crt/45">{SOURCE_TYPE_LABELS[sig.source_type] ?? sig.source_type}</span>
          {sig.submitted_publicly && (
            <span
              className="px-2 py-0.5 text-xs font-medium"
              style={{ background: 'rgba(109,168,255,0.12)', border: '1px solid rgba(109,168,255,0.32)', color: '#6da8ff' }}
            >
              Public submission
            </span>
          )}
          {isActiveReview && (
            <span
              className="px-2 py-0.5 text-xs font-medium"
              style={{ background: 'rgba(77,184,200,0.12)', border: '1px solid rgba(77,184,200,0.45)', color: '#4db8c8' }}
            >
              ● Under review
            </span>
          )}
          {duplicateResult.risk !== 'low' && (
            <span
              className="px-2 py-0.5 text-xs font-semibold"
              style={{
                background: `${DUPLICATE_RISK_COLORS[duplicateResult.risk]}12`,
                border:     `1px solid ${DUPLICATE_RISK_COLORS[duplicateResult.risk]}45`,
                color:      DUPLICATE_RISK_COLORS[duplicateResult.risk],
              }}
            >
              Dup risk: {duplicateResult.risk}
            </span>
          )}
        </div>
        <AnomalyScore score={sig.anomaly_score} />
      </div>

      {/* ── PIPELINE BAR ── */}
      <PipelineBar sig={sig} publishedResult={publishedResult} />

      {/* ── TITLE + SUMMARY ── */}
      <div className="px-5 pb-3 pt-6 md:px-6">
        <h3 className="text-2xl font-semibold leading-tight text-crt/95 md:text-[1.7rem]">
          {sig.title}
        </h3>
      </div>

      <div className="px-5 pb-6 md:px-6">
        <p className="text-lg leading-relaxed text-crt/78">
          {sig.summary}
        </p>
      </div>

      {/* ── SOURCE LINE (always visible) ── */}
      <div className="border-t border-crt/10 px-5 py-3 md:px-6">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span className="text-sm font-semibold text-crt/82">{sig.source_name}</span>
          <span className="text-sm text-crt/38">{SOURCE_TYPE_LABELS[sig.source_type] ?? sig.source_type}</span>
          {sig.source_url && (
            <a
              href={sig.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm font-medium text-crt/55 underline underline-offset-2 transition-colors hover:text-crt/85"
            >
              View Source ↗
            </a>
          )}
          {(sig.source_image_url || sig.media_url) && (
            <span className="text-xs font-semibold" style={{ color: 'rgba(134,212,110,0.55)' }}>
              ◈ evidence attached
            </span>
          )}
          {sig.attribution_text && (
            <span className="text-xs italic text-crt/35">— {sig.attribution_text}</span>
          )}
        </div>
      </div>

      {/* ── WORKFLOW STEP BANNER ── */}
      {!publishedResult && <WorkflowStepBanner sig={sig} isReborn={isReborn} />}

      {/* ── PRIMARY ACTIONS ── */}
      {!publishedResult && !isRebirthOpen && (
        <div className="border-t border-crt/15 bg-[rgba(2,3,3,0.18)] px-5 py-5 md:px-6">
          {/* Next-step primary button */}
          <div className="mb-4">
            {sig.status === 'pending' && (
              <button
                onClick={() => onStatusChange(sig.id, 'reviewing')}
                disabled={busy}
                className="flex w-full items-center justify-between border-2 border-[#4db8c8]/55 bg-[rgba(77,184,200,0.10)] px-5 py-3.5 text-base font-bold text-[#4db8c8] transition-colors hover:bg-[rgba(77,184,200,0.18)] disabled:cursor-not-allowed disabled:opacity-30 sm:inline-flex sm:w-auto"
              >
                <span>Review →</span>
              </button>
            )}
            {sig.status === 'reviewing' && (
              <button
                onClick={() => onStatusChange(sig.id, 'rebirth-ready')}
                disabled={busy}
                className="flex w-full items-center justify-between border-2 border-[#c084fc]/55 bg-[rgba(192,132,252,0.10)] px-5 py-3.5 text-base font-bold text-[#c084fc] transition-colors hover:bg-[rgba(192,132,252,0.18)] disabled:cursor-not-allowed disabled:opacity-30 sm:inline-flex sm:w-auto"
              >
                <span>Prepare Rebirth →</span>
              </button>
            )}
            {(sig.status === 'rebirth-ready' || (sig.status === 'approved' && !sig.published_thread_id)) && (
              <button
                onClick={() => onRequestRebirth(sig)}
                disabled={busy}
                className="flex w-full items-center justify-between border-2 border-[#c084fc]/70 bg-[rgba(192,132,252,0.14)] px-5 py-3.5 text-base font-bold text-[#c084fc] transition-colors hover:bg-[rgba(192,132,252,0.24)] disabled:cursor-not-allowed disabled:opacity-30 sm:inline-flex sm:w-auto"
              >
                <span>Publish Thread →</span>
              </button>
            )}
            {alreadyPublished && (
              <Link
                href={`/threads/${sig.published_thread_id}`}
                target="_blank"
                className="inline-flex items-center gap-2 border-2 border-[#c084fc]/55 bg-[rgba(192,132,252,0.10)] px-5 py-3.5 text-base font-bold text-[#c084fc] transition-colors hover:bg-[rgba(192,132,252,0.20)]"
              >
                Open Published Thread ↗
              </Link>
            )}
          </div>

          {/* Secondary actions */}
          <div className="flex flex-wrap gap-2">
            {sig.status !== 'approved' && sig.status !== 'rebirth-ready' && (
              <button
                onClick={() => onStatusChange(sig.id, 'approved')}
                disabled={busy}
                className="border border-[#86d46e]/38 px-4 py-2 text-sm font-medium text-[#86d46e]/78 transition-colors hover:bg-[rgba(134,212,110,0.08)] disabled:cursor-not-allowed disabled:opacity-30"
              >
                Approve
              </button>
            )}
            {sig.status !== 'archived' && (
              <button
                onClick={() => onStatusChange(sig.id, 'archived')}
                disabled={busy}
                className="border border-[#6da8ff]/28 px-4 py-2 text-sm font-medium text-[#6da8ff]/62 transition-colors hover:bg-[rgba(109,168,255,0.07)] disabled:cursor-not-allowed disabled:opacity-30"
              >
                Archive
              </button>
            )}
            {sig.status !== 'rejected' && (
              <button
                onClick={() => onStatusChange(sig.id, 'rejected')}
                disabled={busy}
                className="border border-[#ff6b6b]/20 px-4 py-2 text-sm font-medium text-[#ff6b6b]/52 transition-colors hover:bg-[rgba(255,107,107,0.07)] disabled:cursor-not-allowed disabled:opacity-30"
              >
                Reject
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── ADVANCED DETAILS (collapsed by default) ── */}
      <div className="border-t border-crt/8">
        <button
          onClick={() => setShowAdvanced((v) => !v)}
          className="flex w-full items-center justify-between px-5 py-3 text-left transition-colors hover:bg-[rgba(134,212,110,0.018)] md:px-6"
        >
          <div className="flex items-center gap-3">
            <span className="text-sm font-medium text-crt/40">Advanced details</span>
            {!showAdvanced && (
              <span className="text-xs text-crt/22">
                evidence · tags · curator notes · AI · duplicates
              </span>
            )}
          </div>
          <span className="text-xs text-crt/25">{showAdvanced ? '▾' : '▸'}</span>
        </button>

        {showAdvanced && (
          <>
            <EvidenceSection sig={sig} />

            {sig.tags.length > 0 && (
              <div className="border-t border-crt/10">
                <div className="bg-[rgba(2,3,3,0.35)] px-5 py-2 md:px-6">
                  <span className="text-xs font-semibold uppercase tracking-wider text-crt/32">Tags</span>
                </div>
                <div className="flex flex-wrap gap-2 px-5 py-3 md:px-6">
                  {sig.tags.map((tag) => (
                    <span key={tag} className="border border-crt/15 px-2.5 py-1 text-sm text-crt/55">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <CuratorNotesField signalId={sig.id} initialNotes={sig.curator_notes ?? ''} />

            <div className="border-t border-crt/10">
              <button
                onClick={() => setShowAnalysis((v) => !v)}
                className="flex w-full items-center justify-between px-5 py-3 text-left transition-colors hover:bg-[rgba(134,212,110,0.018)] md:px-6"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-crt/42">AI Analysis (mock)</span>
                  <span className="text-sm text-crt/25">
                    {analysis.publishRecommendation}
                    {analysis.safetyFlags.some((f) => f.severity === 'high') && (
                      <span className="ml-2 text-[#ff6b6b]/60">⚠ flags</span>
                    )}
                  </span>
                </div>
                <span className="text-xs text-crt/25">{showAnalysis ? '▾' : '▸'}</span>
              </button>
              {showAnalysis && <AnalysisPanel analysis={analysis} />}
            </div>

            <div className="border-t border-crt/10">
              <button
                onClick={() => setShowRelated((v) => !v)}
                className="flex w-full items-center justify-between px-5 py-3 text-left transition-colors hover:bg-[rgba(134,212,110,0.018)] md:px-6"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-medium text-crt/42">Related Signals</span>
                  {duplicateResult.related.length > 0 ? (
                    <span className="text-sm" style={{ color: DUPLICATE_RISK_COLORS[duplicateResult.risk] }}>
                      {duplicateResult.related.length} found ({duplicateResult.risk} risk)
                    </span>
                  ) : (
                    <span className="text-sm text-crt/22">none found</span>
                  )}
                </div>
                <span className="text-xs text-crt/25">{showRelated ? '▾' : '▸'}</span>
              </button>
              {showRelated && <RelatedSignalsPanel result={duplicateResult} />}
            </div>
          </>
        )}
      </div>

      {/* ── REBIRTH EDITOR ── */}
      {isRebirthOpen && !publishedResult && (
        <RebirthPanel
          sig={sig}
          onRebirth={(payload) => onRebirth(sig, payload)}
          onCancel={onCancelRebirth}
          isRebirthPending={isPublishing}
        />
      )}

      {/* ── SUCCESS STATE ── */}
      {publishedResult && <RebirthSuccessPanel result={publishedResult} />}
    </div>
  );
}

// ---------------------------------------------------------------------------
// QueueStats — sidebar
// ---------------------------------------------------------------------------

function QueueStats({
  counts,
  rebirthQueueCount,
}: {
  counts:            Record<RecoveredSignalStatus | 'all', number>;
  rebirthQueueCount: number;
}) {
  const rows: Array<{ key: RecoveredSignalStatus; label: string; color: string }> = [
    { key: 'pending',         label: 'Pending',       color: STATUS_COLORS.pending          },
    { key: 'reviewing',       label: 'Reviewing',     color: STATUS_COLORS.reviewing        },
    { key: 'rebirth-ready',   label: 'Ready',         color: STATUS_COLORS['rebirth-ready'] },
    { key: 'approved',        label: 'Approved',      color: STATUS_COLORS.approved         },
    { key: 'archived',        label: 'Archived',      color: STATUS_COLORS.archived         },
    { key: 'rejected',        label: 'Rejected',      color: STATUS_COLORS.rejected         },
  ];

  return (
    <div className="border border-crt/14 bg-[rgba(4,7,5,0.97)]" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.35)' }}>
      <div className="border-b border-crt/10 px-4 py-3">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-crt/45">Queue</h3>
        <div className="mt-1 flex items-baseline gap-2">
          <span className="font-mono text-2xl font-bold text-crt/85">{counts.all}</span>
          <span className="text-sm text-crt/35">signals total</span>
        </div>
      </div>
      <div className="p-4 space-y-2">
        {rows.map(({ key, label, color }) => (
          <div key={key} className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full" style={{ background: counts[key] > 0 ? color : `${color}30` }} />
              <span className="text-sm" style={{ color: counts[key] > 0 ? `${color}cc` : 'rgba(134,212,110,0.28)' }}>
                {label}
              </span>
            </div>
            <span
              className="font-mono text-base font-semibold tabular-nums"
              style={{ color: counts[key] > 0 ? color : 'rgba(134,212,110,0.22)' }}
            >
              {counts[key]}
            </span>
          </div>
        ))}
      </div>
      {rebirthQueueCount > 0 && (
        <div className="border-t border-[#c084fc]/15 bg-[rgba(192,132,252,0.04)] px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-[#c084fc]/75">◈ Rebirth Ready</span>
            <span className="font-mono text-base font-bold text-[#c084fc]">{rebirthQueueCount}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// OperationsPanel — sidebar live operations
// ---------------------------------------------------------------------------

function OperationsPanel({
  activeReviews,
  rebirthReady,
  duplicateWarnings,
  latestPublishedTitle,
}: {
  activeReviews:        number;
  rebirthReady:         number;
  duplicateWarnings:    number;
  latestPublishedTitle: string | null;
}) {
  return (
    <div className="border border-crt/14 bg-[rgba(4,7,5,0.97)]" style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.35)' }}>
      <div className="border-b border-crt/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full" style={{ background: '#4db8c8', boxShadow: '0 0 5px #4db8c880' }} />
          <h3 className="text-xs font-semibold uppercase tracking-wider text-crt/45">Operations</h3>
        </div>
      </div>

      <div className="divide-y divide-crt/8">
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-medium text-[#4db8c8]/80">Active Reviews</p>
          </div>
          <span
            className="font-mono text-xl font-bold tabular-nums"
            style={{ color: activeReviews > 0 ? '#4db8c8' : 'rgba(134,212,110,0.22)' }}
          >
            {activeReviews}
          </span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-medium text-[#c084fc]/80">Rebirth Ready</p>
          </div>
          <span
            className="font-mono text-xl font-bold tabular-nums"
            style={{ color: rebirthReady > 0 ? '#c084fc' : 'rgba(134,212,110,0.22)' }}
          >
            {rebirthReady}
          </span>
        </div>
        <div className="flex items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-medium" style={{ color: duplicateWarnings > 0 ? '#d7a85c' : 'rgba(134,212,110,0.35)' }}>
              Dup Warnings
            </p>
          </div>
          <span
            className="font-mono text-xl font-bold tabular-nums"
            style={{ color: duplicateWarnings > 0 ? '#d7a85c' : 'rgba(134,212,110,0.22)' }}
          >
            {duplicateWarnings}
          </span>
        </div>
        <div className="px-4 py-3">
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-crt/30">Latest Reborn</p>
          {latestPublishedTitle ? (
            <p className="text-sm leading-snug text-crt/55 line-clamp-2">{latestPublishedTitle}</p>
          ) : (
            <p className="text-sm text-crt/22">No threads published yet</p>
          )}
        </div>
      </div>

      <div className="border-t border-crt/8 px-4 py-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-crt/25">Scanner</p>
        <div className="space-y-1">
          {AI_SCANNER_ROWS.map(({ label, value, dim }) => (
            <div key={label} className="flex items-baseline justify-between gap-2">
              <span className="text-xs text-crt/35">{label}</span>
              <span className={`text-xs font-medium ${dim ? 'text-crt/22' : 'text-crt/52'}`}>{value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SignalQueueClient — main console
// ---------------------------------------------------------------------------

export interface SignalQueueClientProps {
  pending:      DbRecoveredSignal[];
  reviewing:    DbRecoveredSignal[];
  rebirthReady: DbRecoveredSignal[];
  approved:     DbRecoveredSignal[];
  archived:     DbRecoveredSignal[];
  rejected:     DbRecoveredSignal[];
}

export function SignalQueueClient({
  pending:      initialPending,
  reviewing:    initialReviewing,
  rebirthReady: initialRebirthReady,
  approved:     initialApproved,
  archived:     initialArchived,
  rejected:     initialRejected,
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
    ...initialReviewing,
    ...initialRebirthReady,
    ...initialApproved,
    ...initialArchived,
    ...initialRejected,
  ].map((s) => ({ ...s, status: overrides[s.id] ?? s.status }));

  const uniqueCategories  = [...new Set(allSignals.map((s) => s.category))].sort();
  const uniqueSourceTypes = [...new Set(allSignals.map((s) => s.source_type))].sort() as SignalSourceType[];

  const counts: Record<RecoveredSignalStatus | 'all', number> = {
    all:             allSignals.length,
    pending:         allSignals.filter((s) => s.status === 'pending').length,
    reviewing:       allSignals.filter((s) => s.status === 'reviewing').length,
    'rebirth-ready': allSignals.filter((s) => s.status === 'rebirth-ready').length,
    approved:        allSignals.filter((s) => s.status === 'approved').length,
    archived:        allSignals.filter((s) => s.status === 'archived').length,
    rejected:        allSignals.filter((s) => s.status === 'rejected').length,
  };

  const duplicateMap = useMemo(
    () => new Map(allSignals.map((s) => [s.id, computeDuplicateRisk(s, allSignals)])),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allSignals.map((s) => s.id).join(',')],
  );

  const duplicateWarnings = Array.from(duplicateMap.values()).filter((r) => r.risk !== 'low').length;

  const latestPublished = allSignals
    .filter((s) => Boolean(s.published_thread_id))
    .sort((a, b) => (b.approved_at ?? '').localeCompare(a.approved_at ?? ''))[0]?.title ?? null;

  // Tab filter
  let visibleSignals =
    activeTab === 'all' ? allSignals : allSignals.filter((s) => s.status === activeTab);

  if (searchQuery.trim()) {
    const q = searchQuery.toLowerCase();
    visibleSignals = visibleSignals.filter(
      (s) => s.title.toLowerCase().includes(q) || s.summary.toLowerCase().includes(q) || s.source_name.toLowerCase().includes(q),
    );
  }
  if (filterCategory)   visibleSignals = visibleSignals.filter((s) => s.category === filterCategory);
  if (filterSourceType) visibleSignals = visibleSignals.filter((s) => s.source_type === filterSourceType);
  if (sortScore === 'desc') visibleSignals = [...visibleSignals].sort((a, b) => b.anomaly_score - a.anomaly_score);
  if (sortScore === 'asc')  visibleSignals = [...visibleSignals].sort((a, b) => a.anomaly_score - b.anomaly_score);

  const groupedByStatus: Record<RecoveredSignalStatus, DbRecoveredSignal[]> =
    STATUS_SECTION_ORDER.reduce(
      (acc, s) => { acc[s] = visibleSignals.filter((sig) => sig.status === s); return acc; },
      {} as Record<RecoveredSignalStatus, DbRecoveredSignal[]>,
    );

  const rebirthQueueSignals = visibleSignals.filter(
    (s) => s.status === 'rebirth-ready' || (s.status === 'pending' && s.anomaly_score >= 7),
  );
  const rebirthQueueIds       = new Set(rebirthQueueSignals.map((s) => s.id));
  const regularPendingSignals = visibleSignals.filter((s) => s.status === 'pending' && !rebirthQueueIds.has(s.id));
  const reviewingSignals      = visibleSignals.filter((s) => s.status === 'reviewing');
  const reviewingIds          = new Set(allSignals.filter((s) => s.status === 'reviewing').map((s) => s.id));
  const hasActiveFilter       = Boolean(searchQuery.trim() || filterCategory || filterSourceType || sortScore);

  function clearFilters() {
    setSearchQuery(''); setFilterCategory(''); setFilterSourceType(''); setSortScore(null);
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
        signalId: sig.id, title: payload.title, body: payload.body,
        category: payload.category, tags: payload.tags,
      });
      if ('error' in result) {
        showError(`Rebirth failed — ${result.error}`);
        setRebirthOpenId(null);
        return;
      }
      const shareData = {
        title:           payload.title,
        category:        payload.category,
        summary:         sig.summary,
        threadSlug:      result.threadSlug,
        sourceName:      sig.source_name,
        anomalyScore:    sig.anomaly_score,
        tags:            payload.tags,
        hasEvidence:     Boolean(sig.source_image_url || sig.media_url),
        attributionText: sig.attribution_text ?? undefined,
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
        duplicateResult={duplicateMap.get(sig.id) ?? { risk: 'low', reasons: [], related: [] }}
        allSignals={allSignals}
        isActiveReview={reviewingIds.has(sig.id)}
        anyRebirthOpen={Boolean(rebirthOpenId)}
      />
    );
  }

  return (
    <div className="relative min-h-screen pb-16 pt-[80px] md:pt-[100px]">
      <AmbientGrid className="pointer-events-none absolute inset-0 opacity-[0.08]" />

      {/* ── Sticky toolbar ── */}
      <div className="sticky top-[72px] z-20 border-b border-crt/15 bg-[rgba(2,3,3,0.98)] backdrop-blur-sm md:top-[80px]">

        {/* Title bar */}
        <div className="border-b border-crt/10 px-4 py-3 md:px-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-medium text-crt/35">
                SWIM · Curator Console · Restricted Access
              </p>
              <h1 className="text-2xl font-bold text-crt/92 md:text-3xl">
                Signal Queue
              </h1>
            </div>
            <button
              onClick={() => setShowIntake((v) => !v)}
              className={`border px-4 py-2 text-[15px] font-medium transition-colors ${
                showIntake
                  ? 'border-crt/28 text-crt/60 hover:border-crt/15 hover:text-crt/40'
                  : 'border-crt/22 text-crt/50 hover:border-crt/38 hover:text-crt/75'
              }`}
            >
              {showIntake ? '− Close Intake' : '+ Add Signal'}
            </button>
          </div>
        </div>

        {/* Status tabs */}
        <div className="border-b border-crt/8 px-4 md:px-8">
          <div className="flex overflow-x-auto">
            {STATUS_TABS.map(({ key, label }) => {
              const count = key !== 'all' ? counts[key as RecoveredSignalStatus] : null;
              const isActive = activeTab === key;
              return (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`shrink-0 border-b-2 px-4 py-3 text-[15px] font-medium transition-colors ${
                    isActive ? 'border-crt/60 text-crt/88' : 'border-transparent text-crt/40 hover:text-crt/65'
                  }`}
                >
                  {label}
                  {count !== null && (
                    <span className={`ml-1.5 text-sm ${isActive ? 'text-crt/52' : 'text-crt/28'}`}>
                      {count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* Filter row */}
        <div className="px-4 py-2.5 md:px-8">
          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[160px] max-w-xs flex-1">
              <input
                type="search"
                placeholder="Search title, summary, source…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full border border-crt/18 bg-transparent px-3 py-1.5 text-[15px] text-crt/75 placeholder:text-crt/28 focus:border-crt/35 focus:outline-none"
              />
            </div>
            <select
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="border border-crt/18 bg-[rgba(4,7,5,0.8)] px-3 py-1.5 text-[14px] text-crt/65 focus:border-crt/32 focus:outline-none"
            >
              <option value="">All categories</option>
              {uniqueCategories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              value={filterSourceType}
              onChange={(e) => setFilterSourceType(e.target.value)}
              className="border border-crt/18 bg-[rgba(4,7,5,0.8)] px-3 py-1.5 text-[14px] text-crt/65 focus:border-crt/32 focus:outline-none"
            >
              <option value="">All sources</option>
              {uniqueSourceTypes.map((t) => <option key={t} value={t}>{SOURCE_TYPE_LABELS[t]}</option>)}
            </select>
            <button
              onClick={() => setSortScore((v) => v === 'desc' ? 'asc' : v === 'asc' ? null : 'desc')}
              className={`border px-3 py-1.5 text-[14px] transition-colors ${
                sortScore ? 'border-crt/30 text-crt/65' : 'border-crt/15 text-crt/40 hover:border-crt/25'
              }`}
            >
              Score {sortScore === 'desc' ? '↓' : sortScore === 'asc' ? '↑' : '—'}
            </button>
            {hasActiveFilter && (
              <button
                onClick={clearFilters}
                className="ml-auto text-[14px] text-crt/40 transition-colors hover:text-crt/65"
              >
                × Clear ({visibleSignals.length} shown)
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
          <div className="mb-5 border border-red-900/45 bg-[rgba(40,10,10,0.65)] px-5 py-3 text-base text-red-400/85">
            {errorMsg}
          </div>
        )}

        {/* Two-column */}
        <div className="flex flex-col gap-6 md:flex-row md:items-start lg:gap-10">

          {/* Signal cards */}
          <div className="min-w-0 flex-1">
            {visibleSignals.length === 0 ? (
              <div className="border border-crt/12 bg-[rgba(4,7,5,0.97)] py-20 text-center text-base text-crt/38">
                {hasActiveFilter ? 'No signals match the current filters.' : 'No signals in this state.'}
              </div>

            ) : activeTab === 'pending' ? (
              <div className="space-y-6">
                {rebirthQueueSignals.length > 0 && (
                  <section>
                    <div className="mb-3 flex items-center gap-3">
                      <div className="h-px flex-1" style={{ background: 'rgba(192,132,252,0.25)' }} />
                      <span className="shrink-0 text-sm font-semibold" style={{ color: '#c084fc99' }}>
                        ◈ Rebirth Ready — {rebirthQueueSignals.length}
                      </span>
                      <div className="h-px flex-1" style={{ background: 'rgba(192,132,252,0.25)' }} />
                    </div>
                    <div className="space-y-6">{rebirthQueueSignals.map(renderCard)}</div>
                  </section>
                )}
                {reviewingSignals.length > 0 && (
                  <section>
                    <div className="mb-3 flex items-center gap-3">
                      <div className="h-px flex-1" style={{ background: 'rgba(77,184,200,0.22)' }} />
                      <span className="shrink-0 text-sm font-semibold" style={{ color: '#4db8c890' }}>
                        ● Under Review — {reviewingSignals.length}
                      </span>
                      <div className="h-px flex-1" style={{ background: 'rgba(77,184,200,0.22)' }} />
                    </div>
                    <div className="space-y-6">{reviewingSignals.map(renderCard)}</div>
                  </section>
                )}
                {regularPendingSignals.length > 0 && (
                  <section>
                    {(rebirthQueueSignals.length > 0 || reviewingSignals.length > 0) && (
                      <div className="mb-3 flex items-center gap-3">
                        <div className="h-px flex-1 bg-crt/10" />
                        <span className="shrink-0 text-sm text-crt/38">
                          Awaiting Review — {regularPendingSignals.length}
                        </span>
                        <div className="h-px flex-1 bg-crt/10" />
                      </div>
                    )}
                    <div className="space-y-6">{regularPendingSignals.map(renderCard)}</div>
                  </section>
                )}
              </div>

            ) : activeTab === 'all' ? (
              <div className="space-y-12">
                {STATUS_SECTION_ORDER.map((status) => {
                  const sigs = groupedByStatus[status];
                  if (sigs.length === 0) return null;
                  return (
                    <section key={status}>
                      <div className="mb-4 flex items-center gap-3">
                        <div className="h-px flex-1" style={{ backgroundColor: `${STATUS_COLORS[status]}22` }} />
                        <span className="shrink-0 text-sm font-semibold"
                          style={{ color: `${STATUS_COLORS[status]}90` }}>
                          {SECTION_LABELS[status]} — {sigs.length}
                        </span>
                        <div className="h-px flex-1" style={{ backgroundColor: `${STATUS_COLORS[status]}22` }} />
                      </div>
                      <div className="space-y-6">{sigs.map(renderCard)}</div>
                    </section>
                  );
                })}
              </div>

            ) : (
              <div className="space-y-6">{visibleSignals.map(renderCard)}</div>
            )}
          </div>

          {/* Sidebar */}
          <div className="w-full shrink-0 space-y-4 md:w-[268px] lg:w-[288px]">
            <QueueStats counts={counts} rebirthQueueCount={rebirthQueueSignals.length} />
            <OperationsPanel
              activeReviews={counts.reviewing}
              rebirthReady={counts['rebirth-ready']}
              duplicateWarnings={duplicateWarnings}
              latestPublishedTitle={latestPublished}
            />
            <p className="text-center text-xs text-crt/22">
              Requires service role key · Not accessible to public
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
