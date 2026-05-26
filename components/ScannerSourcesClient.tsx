'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  createScannerSourceAction,
  updateScannerSourceAction,
  toggleScannerSourceAction,
  fetchScannerSourcePreviewAction,
  queueFetchedCandidateAction,
  runFetchSessionAction,
} from '@/app/actions';
import { AdminFlowBanner } from '@/components/AdminFlowBanner';
import type { FetchedCandidate, SignalDuplicate, SessionSourceResult } from '@/lib/scanner-fetch-types';
import type { DbScannerSource, ScannerRiskLevel } from '@/lib/supabase/types';
import { CATEGORY_ORDER } from '@/lib/forum-types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SOURCE_TYPES = [
  { value: 'archive',    label: 'Archive'    },
  { value: 'forum',      label: 'Forum'      },
  { value: 'reddit',     label: 'Reddit'     },
  { value: 'imageboard', label: 'Imageboard' },
  { value: 'bbs',        label: 'BBS'        },
  { value: 'pastebin',   label: 'Paste'      },
  { value: 'other',      label: 'Other'      },
] as const;

const CADENCES = [
  { value: 'daily',    label: 'Daily'    },
  { value: 'weekly',   label: 'Weekly'   },
  { value: 'monthly',  label: 'Monthly'  },
  { value: 'manual',   label: 'Manual'   },
  { value: 'disabled', label: 'Disabled' },
] as const;

const RISK_COLORS: Record<ScannerRiskLevel, string> = {
  low:    '#86d46e',
  medium: '#d7a85c',
  high:   '#ff6b6b',
};
const RISK_BG: Record<ScannerRiskLevel, string> = {
  low:    'rgba(134,212,110,0.08)',
  medium: 'rgba(215,168,92,0.08)',
  high:   'rgba(255,107,107,0.08)',
};

// ---------------------------------------------------------------------------
// Single-source fetch state types
// ---------------------------------------------------------------------------

interface SavedCandidateForm {
  title:        string;
  summary:      string;
  sourceUrl:    string;
  category:     string;
  tags:         string[];
  anomalyScore: number;
}

type FetchState =
  | null
  | { status: 'fetching' }
  | { status: 'preview'; candidate: FetchedCandidate }
  | { status: 'duplicate-warning'; savedForm: SavedCandidateForm; duplicates: SignalDuplicate[] }
  | { status: 'success'; title: string; signalId: string; url: string }
  | { status: 'error'; message: string };

interface PreviewFormState {
  title:        string;
  summary:      string;
  category:     string;
  tags:         string;
  anomalyScore: number;
}

// ---------------------------------------------------------------------------
// Session types
// ---------------------------------------------------------------------------

interface SessionEntry {
  result:       SessionSourceResult;
  actionStatus: 'pending' | 'queued' | 'skipped';
}

interface SessionState {
  status:  'idle' | 'running' | 'complete';
  runAt:   string | null;
  entries: SessionEntry[];
}

interface SessionHistoryRecord {
  runAt:   string;
  scanned: number;
  queued:  number;
  failed:  number;
  dupes:   number;
}

// ---------------------------------------------------------------------------
// Display sub-components
// ---------------------------------------------------------------------------

function RiskBadge({ level }: { level: ScannerRiskLevel }) {
  return (
    <span
      className="inline-flex items-center px-2.5 py-1 text-sm font-semibold"
      style={{
        color:      RISK_COLORS[level],
        background: RISK_BG[level],
        border:     `1px solid ${RISK_COLORS[level]}35`,
      }}
    >
      {level} risk
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex items-center border border-crt/18 px-2.5 py-1 text-sm font-medium uppercase text-crt/52">
      {type}
    </span>
  );
}

// ---------------------------------------------------------------------------
// CandidatePreviewPanel — single-source editable review before queueing
// ---------------------------------------------------------------------------

interface CandidatePreviewPanelProps {
  candidate:  FetchedCandidate;
  isQueueing: boolean;
  onSubmit:   (form: PreviewFormState) => void;
  onCancel:   () => void;
}

function CandidatePreviewPanel({ candidate, isQueueing, onSubmit, onCancel }: CandidatePreviewPanelProps) {
  const [form, setForm] = useState<PreviewFormState>({
    title:        candidate.title,
    summary:      candidate.summary,
    category:     candidate.category,
    tags:         candidate.tags.join(', '),
    anomalyScore: candidate.anomalyScore,
  });

  const inputCls =
    'w-full border border-crt/18 bg-transparent px-3 py-2.5 font-mono text-sm text-crt/82 placeholder:text-crt/22 focus:border-crt/38 focus:outline-none transition-colors';
  const labelCls =
    'mb-1.5 block text-xs font-semibold uppercase tracking-wider text-crt/42';

  function setField(field: keyof PreviewFormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      const value = field === 'anomalyScore' ? parseInt(e.target.value, 10) : e.target.value;
      setForm((f) => ({ ...f, [field]: value }));
    };
  }

  const scoreColor =
    form.anomalyScore >= 8 ? '#ff6b6b' : form.anomalyScore >= 6 ? '#d7a85c' : '#86d46e';

  const canQueue = form.title.trim().length >= 4 && form.summary.trim().length >= 10;

  const confColor =
    candidate.extractionConfidence === 'high'   ? '#86d46e' :
    candidate.extractionConfidence === 'medium' ? '#d7a85c' : '#ff6b6b';
  const confBg =
    candidate.extractionConfidence === 'high'   ? 'rgba(134,212,110,0.08)' :
    candidate.extractionConfidence === 'medium' ? 'rgba(215,168,92,0.08)'  : 'rgba(255,107,107,0.08)';
  const confBorder =
    candidate.extractionConfidence === 'high'   ? 'rgba(134,212,110,0.28)' :
    candidate.extractionConfidence === 'medium' ? 'rgba(215,168,92,0.28)'  : 'rgba(255,107,107,0.28)';

  return (
    <div
      className="border-t border-crt/12 px-6 py-6"
      style={{ background: 'rgba(134,212,110,0.018)' }}
    >
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <div className="text-sm font-semibold text-crt/55">Candidate Preview</div>
        <span
          className="px-2.5 py-1 text-sm font-semibold"
          style={{ color: confColor, background: confBg, border: `1px solid ${confBorder}` }}
        >
          {candidate.extractionConfidence} confidence
        </span>
      </div>
      {candidate.extractionWarning && (
        <div
          className="mb-4 flex items-start gap-2.5 border px-4 py-3"
          style={{ borderColor: 'rgba(255,107,107,0.28)', background: 'rgba(255,107,107,0.06)' }}
        >
          <span className="shrink-0 text-base" style={{ color: '#ff6b6b' }}>⚠</span>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,107,107,0.80)' }}>
            {candidate.extractionWarning}
          </p>
        </div>
      )}
      <div className="mb-4 text-xs text-crt/32">{candidate.categoryNote}</div>

      <div className="space-y-5">
        <div>
          <label className={labelCls}>Title</label>
          <input
            type="text"
            value={form.title}
            onChange={setField('title')}
            maxLength={200}
            className={inputCls}
          />
          <div className="mt-1 flex justify-end text-xs text-crt/25">{form.title.length}/200</div>
        </div>

        <div>
          <label className={labelCls}>Summary</label>
          <textarea
            value={form.summary}
            onChange={setField('summary')}
            rows={6}
            maxLength={2000}
            className={`${inputCls} resize-y`}
          />
          <div className="mt-1 flex justify-end text-xs text-crt/25">{form.summary.length}/2000</div>
        </div>

        <div>
          <label className={labelCls}>
            Source URL <span className="font-normal text-crt/25">— extracted from page</span>
          </label>
          <div className="border border-crt/10 px-3 py-2.5 font-mono text-sm text-crt/35 truncate">
            {candidate.sourceUrl}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Category</label>
            <select value={form.category} onChange={setField('category')} className={`${inputCls} cursor-pointer`}>
              {CATEGORY_ORDER.map((c: string) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>
              Anomaly Score
              <span className="ml-2 font-mono font-normal tabular-nums" style={{ color: scoreColor }}>
                {form.anomalyScore}/10
              </span>
            </label>
            <input
              type="range"
              min={1}
              max={10}
              value={form.anomalyScore}
              onChange={setField('anomalyScore')}
              className="mt-2 w-full accent-crt"
            />
            <div className="mt-1 flex justify-between text-xs text-crt/25">
              <span>low</span><span>high anomaly</span>
            </div>
          </div>
        </div>

        <div>
          <label className={labelCls}>Tags <span className="font-normal text-crt/25">— comma separated</span></label>
          <input
            type="text"
            value={form.tags}
            onChange={setField('tags')}
            maxLength={300}
            className={inputCls}
          />
        </div>

        <div className="flex items-center gap-4 border-t border-crt/10 pt-5">
          <button
            type="button"
            onClick={() => onSubmit(form)}
            disabled={isQueueing || !canQueue}
            className="admin-btn admin-btn-success"
          >
            {isQueueing ? '↯ Queueing…' : 'Queue Candidate →'}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={isQueueing}
            className="text-sm text-crt/35 hover:text-crt/60 transition-colors"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// DuplicateWarningPanel — single-source flow
// ---------------------------------------------------------------------------

interface DuplicateWarningPanelProps {
  duplicates:    SignalDuplicate[];
  isQueueing:    boolean;
  onQueueAnyway: () => void;
  onCancel:      () => void;
}

function DuplicateWarningPanel({ duplicates, isQueueing, onQueueAnyway, onCancel }: DuplicateWarningPanelProps) {
  return (
    <div
      className="border-t border-crt/12 px-6 py-5"
      style={{ background: 'rgba(215,168,92,0.04)' }}
    >
      <div className="mb-3 flex items-center gap-2">
        <span className="text-lg" style={{ color: '#d7a85c' }}>⚠</span>
        <span className="text-base font-semibold" style={{ color: '#d7a85c' }}>Duplicate Risk Detected</span>
      </div>
      <p className="mb-3 text-sm text-crt/45">Similar signals already in the queue:</p>
      <div className="mb-5 space-y-2">
        {duplicates.map((d) => (
          <div key={d.id} className="flex items-center gap-3 border border-crt/10 bg-[rgba(4,7,5,0.5)] px-4 py-2.5">
            <span className="min-w-0 flex-1 text-sm text-crt/58">{d.title}</span>
            <span
              className="shrink-0 text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'rgba(215,168,92,0.55)' }}
            >
              {d.status}
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={onQueueAnyway}
          disabled={isQueueing}
          className="admin-btn admin-btn-warning"
        >
          {isQueueing ? '↯ Queueing…' : 'Queue Anyway →'}
        </button>
        <button
          onClick={onCancel}
          disabled={isQueueing}
          className="text-sm text-crt/35 hover:text-crt/60 transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SourceForm — shared for Add + Edit
// ---------------------------------------------------------------------------

interface SourceFormState {
  name:              string;
  source_type:       string;
  base_url:          string;
  description:       string;
  category_focus:    string;
  risk_level:        ScannerRiskLevel;
  refresh_cadence:   string;
  attribution_rules: string;
}

const EMPTY_FORM: SourceFormState = {
  name:              '',
  source_type:       'other',
  base_url:          '',
  description:       '',
  category_focus:    '',
  risk_level:        'low',
  refresh_cadence:   'manual',
  attribution_rules: '',
};

function sourceToForm(s: DbScannerSource): SourceFormState {
  return {
    name:              s.name,
    source_type:       s.source_type,
    base_url:          s.base_url ?? '',
    description:       s.description ?? '',
    category_focus:    s.category_focus.join(', '),
    risk_level:        s.risk_level,
    refresh_cadence:   s.refresh_cadence ?? 'manual',
    attribution_rules: s.attribution_rules ?? '',
  };
}

interface SourceFormProps {
  initial:     SourceFormState;
  isPending:   boolean;
  error:       string | null;
  submitLabel: string;
  onSubmit:    (form: SourceFormState) => void;
  onCancel?:   () => void;
}

function SourceForm({ initial, isPending, error, submitLabel, onSubmit, onCancel }: SourceFormProps) {
  const [form, setForm] = useState<SourceFormState>(initial);

  const inputCls =
    'w-full border border-crt/18 bg-transparent px-3 py-2.5 font-mono text-sm text-crt/82 placeholder:text-crt/22 focus:border-crt/38 focus:outline-none transition-colors';
  const labelCls =
    'mb-1.5 block text-xs font-semibold uppercase tracking-wider text-crt/42';

  function set(field: keyof SourceFormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [field]: e.target.value }));
    };
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); onSubmit(form); }} className="space-y-5">
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Name <span className="font-normal text-crt/25">— required</span></label>
          <input type="text" value={form.name} onChange={set('name')} placeholder="e.g. Erowid Experience Vaults" maxLength={200} required className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Source Type</label>
          <select value={form.source_type} onChange={set('source_type')} className={`${inputCls} cursor-pointer`}>
            {SOURCE_TYPES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>Base URL <span className="font-normal text-crt/25">— optional</span></label>
        <input type="url" value={form.base_url} onChange={set('base_url')} placeholder="https://…" maxLength={500} className={inputCls} />
      </div>

      <div>
        <label className={labelCls}>Description <span className="font-normal text-crt/25">— optional</span></label>
        <textarea value={form.description} onChange={set('description')} placeholder="What kinds of signals this source contains" rows={3} maxLength={1000} className={`${inputCls} resize-y`} />
      </div>

      <div>
        <label className={labelCls}>Category Focus <span className="font-normal text-crt/25">— comma separated</span></label>
        <input type="text" value={form.category_focus} onChange={set('category_focus')} placeholder="UFOs, Paranormal, Hidden History" maxLength={500} className={inputCls} />
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className={labelCls}>Risk Level</label>
          <select value={form.risk_level} onChange={set('risk_level')} className={`${inputCls} cursor-pointer`}>
            <option value="low">Low — curated, stable, low noise</option>
            <option value="medium">Medium — mixed quality, needs review</option>
            <option value="high">High — volatile, heavy curation required</option>
          </select>
        </div>
        <div>
          <label className={labelCls}>Refresh Cadence</label>
          <select value={form.refresh_cadence} onChange={set('refresh_cadence')} className={`${inputCls} cursor-pointer`}>
            {CADENCES.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
        </div>
      </div>

      <div>
        <label className={labelCls}>Attribution Rules <span className="font-normal text-crt/25">— how to credit this source</span></label>
        <textarea value={form.attribution_rules} onChange={set('attribution_rules')} placeholder="Credit original poster handle and date. Summarize — do not reproduce full text." rows={2} maxLength={500} className={`${inputCls} resize-none`} />
      </div>

      {error && (
        <div className="text-sm text-[#ff6b6b]/80">✗ {error}</div>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="admin-btn admin-btn-primary"
        >
          {isPending ? '↯ Saving…' : submitLabel}
        </button>
        {onCancel && (
          <button type="button" onClick={onCancel} className="text-sm text-crt/35 hover:text-crt/58 transition-colors">
            Cancel
          </button>
        )}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// SessionResultCard — one card per source inside a fetch session
// ---------------------------------------------------------------------------

interface SessionResultCardProps {
  result:         SessionSourceResult;
  actionStatus:   'pending' | 'queued' | 'skipped';
  onStatusChange: (status: 'queued' | 'skipped') => void;
}

function SessionResultCard({ result, actionStatus, onStatusChange }: SessionResultCardProps) {
  const [queuePending, startQueue] = useTransition();
  const [isEditing, setIsEditing]  = useState(false);
  const [queueError, setQueueError] = useState<string | null>(null);

  const [editForm, setEditForm] = useState<PreviewFormState>(() => {
    if (result.status === 'error') {
      return { title: '', summary: '', category: 'Internet Lore', tags: '', anomalyScore: 5 };
    }
    return {
      title:        result.candidate.title,
      summary:      result.candidate.summary,
      category:     result.candidate.category,
      tags:         result.candidate.tags.join(', '),
      anomalyScore: result.candidate.anomalyScore,
    };
  });

  const fieldCls =
    'w-full border border-crt/18 bg-transparent px-3 py-2.5 text-sm text-crt/82 placeholder:text-crt/25 focus:border-crt/35 focus:outline-none transition-colors';
  const labelCls = 'mb-1.5 block text-xs font-semibold uppercase tracking-wider text-crt/40';

  const isActioned  = actionStatus === 'queued' || actionStatus === 'skipped';
  const isDuplicate = result.status === 'duplicate';

  function handleQueue(overrideDuplicate = false) {
    if (result.status === 'error') return;
    const tags = editForm.tags.split(',').map((t) => t.trim()).filter(Boolean);
    setQueueError(null);
    startQueue(async () => {
      const res = await queueFetchedCandidateAction({
        sourceId:          result.sourceId,
        title:             editForm.title,
        summary:           editForm.summary,
        sourceUrl:         result.candidate.sourceUrl,
        category:          editForm.category,
        tags,
        anomalyScore:      editForm.anomalyScore,
        overrideDuplicate,
      });
      if ('error' in res)            { setQueueError(res.error); return; }
      if ('duplicateWarning' in res) { setQueueError('duplicate still detected — use Queue Anyway'); return; }
      onStatusChange('queued');
    });
  }

  // ── Actioned (muted row) ──
  if (isActioned) {
    return (
      <div
        className="flex items-center justify-between gap-4 px-6 py-4"
        style={{ opacity: 0.45 }}
      >
        <div className="min-w-0">
          <span className="block text-sm font-semibold text-crt/55">{result.sourceName}</span>
          {result.status !== 'error' && (
            <span className="block truncate text-base text-crt/40">{editForm.title}</span>
          )}
        </div>
        <span
          className="ml-3 shrink-0 text-sm font-bold"
          style={{ color: actionStatus === 'queued' ? '#86d46e' : 'rgba(134,212,110,0.28)' }}
        >
          {actionStatus === 'queued' ? '✓ Queued' : '— Skipped'}
        </span>
      </div>
    );
  }

  // ── Error ──
  if (result.status === 'error') {
    return (
      <div
        className="px-6 py-5"
        style={{ background: 'rgba(255,107,107,0.018)' }}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="mb-1 text-base font-semibold text-crt/55">{result.sourceName}</div>
            <div className="text-sm text-[#ff6b6b]/55">✗ {result.error}</div>
          </div>
          <button
            onClick={() => onStatusChange('skipped')}
            className="shrink-0 text-sm text-crt/38 hover:text-crt/65 transition-colors"
          >
            Dismiss
          </button>
        </div>
      </div>
    );
  }

  // ── Preview or Duplicate ──
  return (
    <div
      style={{
        borderLeft: `4px solid ${isDuplicate ? 'rgba(215,168,92,0.45)' : 'rgba(134,212,110,0.28)'}`,
      }}
    >
      {/* Card header */}
      <div className="px-6 pt-6 pb-4">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2.5">
            <span className="text-lg font-bold text-crt/82">{result.sourceName}</span>
            {isDuplicate && (
              <span
                className="px-2.5 py-1 text-sm font-semibold"
                style={{ color: '#d7a85c', background: 'rgba(215,168,92,0.10)', border: '1px solid rgba(215,168,92,0.28)' }}
              >
                ⚠ Duplicate Risk
              </span>
            )}
            {result.candidate.extractionConfidence && (
              <span
                className="px-2 py-0.5 text-xs font-semibold"
                style={{
                  color:      result.candidate.extractionConfidence === 'high'   ? 'rgba(134,212,110,0.80)' :
                              result.candidate.extractionConfidence === 'medium' ? '#d7a85c' : '#ff6b6b',
                  background: result.candidate.extractionConfidence === 'high'   ? 'rgba(134,212,110,0.07)' :
                              result.candidate.extractionConfidence === 'medium' ? 'rgba(215,168,92,0.08)' : 'rgba(255,107,107,0.07)',
                  border:     result.candidate.extractionConfidence === 'high'   ? '1px solid rgba(134,212,110,0.22)' :
                              result.candidate.extractionConfidence === 'medium' ? '1px solid rgba(215,168,92,0.25)' : '1px solid rgba(255,107,107,0.25)',
                }}
              >
                {result.candidate.extractionConfidence}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-4">
            {!isEditing && (
              <button
                onClick={() => setIsEditing(true)}
                className="text-sm text-crt/40 hover:text-crt/68 transition-colors"
              >
                Edit ▸
              </button>
            )}
            <button
              onClick={() => onStatusChange('skipped')}
              disabled={queuePending}
              className="text-sm text-crt/35 hover:text-crt/62 transition-colors disabled:opacity-30"
            >
              Skip
            </button>
          </div>
        </div>

        {!isEditing && (
          <>
            <p className="mb-3 text-xl font-semibold text-crt/90 leading-snug">
              {editForm.title}
            </p>
            <p className="mb-3 text-base leading-relaxed text-crt/60 line-clamp-4">
              {editForm.summary}
            </p>
            {result.candidate.extractionWarning && (
              <p className="mb-2 text-sm" style={{ color: 'rgba(255,107,107,0.70)' }}>
                ⚠ {result.candidate.extractionWarning}
              </p>
            )}
            <p className="text-xs text-crt/35">
              {result.candidate.categoryNote}
            </p>

            {isDuplicate && (
              <div className="mt-4 border-t border-crt/8 pt-4 space-y-2">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-crt/38">
                  Similar signals in queue:
                </p>
                {result.duplicates.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 border border-crt/10 px-4 py-2.5">
                    <span className="flex-1 truncate text-sm text-crt/55">{d.title}</span>
                    <span className="text-xs font-medium uppercase tracking-wider text-crt/32">{d.status}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* Inline edit form */}
      {isEditing && (
        <div
          className="border-t border-crt/8 px-6 pb-6 pt-5 space-y-4"
          style={{ background: 'rgba(134,212,110,0.010)' }}
        >
          <div>
            <label className={labelCls}>Title</label>
            <input
              type="text"
              value={editForm.title}
              onChange={(e) => setEditForm((f) => ({ ...f, title: e.target.value }))}
              maxLength={200}
              className={`${fieldCls} font-mono`}
            />
          </div>
          <div>
            <label className={labelCls}>Summary</label>
            <textarea
              value={editForm.summary}
              onChange={(e) => setEditForm((f) => ({ ...f, summary: e.target.value }))}
              rows={5}
              maxLength={2000}
              className={`${fieldCls} resize-y leading-relaxed`}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className={labelCls}>Category</label>
              <select
                value={editForm.category}
                onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                className={`${fieldCls} cursor-pointer`}
              >
                {CATEGORY_ORDER.map((c: string) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>
                Anomaly Score
                <span
                  className="ml-2 font-mono tabular-nums"
                  style={{ color: editForm.anomalyScore >= 8 ? '#ff6b6b' : editForm.anomalyScore >= 6 ? '#d7a85c' : '#86d46e' }}
                >
                  {editForm.anomalyScore}/10
                </span>
              </label>
              <input
                type="range"
                min={1}
                max={10}
                value={editForm.anomalyScore}
                onChange={(e) => setEditForm((f) => ({ ...f, anomalyScore: parseInt(e.target.value, 10) }))}
                className="mt-2.5 w-full accent-crt"
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Tags <span className="font-normal text-crt/30 normal-case">— comma separated</span></label>
            <input
              type="text"
              value={editForm.tags}
              onChange={(e) => setEditForm((f) => ({ ...f, tags: e.target.value }))}
              className={fieldCls}
            />
          </div>
          <button
            onClick={() => setIsEditing(false)}
            className="text-sm font-medium text-crt/42 hover:text-crt/68 transition-colors"
          >
            ✓ Done editing
          </button>
        </div>
      )}

      {/* Action buttons */}
      {!isEditing && (
        <div className="flex flex-wrap items-center gap-3 px-6 pb-6">
          {isDuplicate ? (
            <button
              onClick={() => handleQueue(true)}
              disabled={queuePending}
              className="admin-btn admin-btn-warning"
            >
              {queuePending ? '↯ Queueing…' : 'Queue Anyway →'}
            </button>
          ) : (
            <button
              onClick={() => handleQueue(false)}
              disabled={queuePending}
              className="admin-btn admin-btn-success"
            >
              {queuePending ? '↯ Queueing…' : 'Queue Candidate →'}
            </button>
          )}
        </div>
      )}

      {queueError && (
        <div className="px-6 pb-5 text-sm text-[#ff6b6b]/62">
          ✗ {queueError}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FetchSessionPanel — full session results view
// ---------------------------------------------------------------------------

interface FetchSessionPanelProps {
  entries:        SessionEntry[];
  runAt:          string;
  onStatusChange: (idx: number, status: 'queued' | 'skipped') => void;
  onClose:        () => void;
}

function FetchSessionPanel({ entries, runAt, onStatusChange, onClose }: FetchSessionPanelProps) {
  const scanned = entries.length;
  const queued  = entries.filter((e) => e.actionStatus === 'queued').length;
  const skipped = entries.filter((e) => e.actionStatus === 'skipped').length;
  const failed  = entries.filter((e) => e.result.status === 'error').length;
  const dupes   = entries.filter((e) => e.result.status === 'duplicate').length;
  const pending = entries.filter((e) => e.actionStatus === 'pending').length;

  const stats = [
    { label: 'Scanned',  value: scanned,  color: '#86d46e'                                             },
    { label: 'Queued',   value: queued,   color: queued  > 0 ? '#86d46e'  : 'rgba(134,212,110,0.28)'  },
    { label: 'Skipped',  value: skipped,  color: 'rgba(134,212,110,0.35)'                              },
    { label: 'Dupes',    value: dupes,    color: dupes   > 0 ? '#d7a85c'  : 'rgba(134,212,110,0.28)'  },
    { label: 'Failed',   value: failed,   color: failed  > 0 ? '#ff6b6b'  : 'rgba(134,212,110,0.28)'  },
  ] as const;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-crt/12 px-6 py-5">
        <div>
          <h2 className="text-xl font-bold text-crt/88">Session Results</h2>
          <p className="mt-0.5 text-sm text-crt/40">
            {new Date(runAt).toLocaleTimeString()} · manual · no crawl · one page per source
          </p>
        </div>
        <button
          onClick={onClose}
          className="min-h-[40px] border border-crt/15 px-4 py-1.5 text-sm text-crt/42 transition-colors hover:border-crt/28 hover:text-crt/68"
        >
          Close
        </button>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-5 border-b border-crt/8 bg-[rgba(4,7,5,0.40)]">
        {stats.map(({ label, value, color }) => (
          <div key={label} className="px-4 py-5 text-center">
            <div className="font-mono text-3xl font-bold tabular-nums leading-none" style={{ color: String(color) }}>
              {value}
            </div>
            <div className="mt-2 text-xs font-semibold text-crt/38">{label}</div>
          </div>
        ))}
      </div>

      {/* Results list */}
      <div className="divide-y divide-crt/8">
        {entries.map((entry, idx) => (
          <SessionResultCard
            key={entry.result.sourceId}
            result={entry.result}
            actionStatus={entry.actionStatus}
            onStatusChange={(status) => onStatusChange(idx, status)}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between border-t border-crt/10 px-6 py-5">
        <p className="text-base text-crt/50">
          {pending > 0
            ? `${pending} candidate${pending !== 1 ? 's' : ''} pending review`
            : 'All candidates reviewed'}
        </p>
        <div className="flex items-center gap-4">
          {queued > 0 && (
            <a
              href="/scanner/queue"
              className="admin-btn admin-btn-primary"
            >
              View Queue ({queued}) →
            </a>
          )}
          <button
            onClick={onClose}
            className="text-sm text-crt/35 hover:text-crt/60 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// SourceCard — single source card
// ---------------------------------------------------------------------------

interface SourceCardProps {
  source:    DbScannerSource;
  onToggled: (id: string, enabled: boolean) => void;
  onUpdated: (updated: DbScannerSource) => void;
  onFetched: (id: string, scannedAt: string) => void;
}

function SourceCard({ source, onToggled, onUpdated, onFetched }: SourceCardProps) {
  const [isEditing, setIsEditing]    = useState(false);
  const [editPending, startEdit]     = useTransition();
  const [togglePending, startToggle] = useTransition();
  const [fetchPending, startFetch]   = useTransition();
  const [queuePending, startQueue]   = useTransition();
  const [editError, setEditError]    = useState<string | null>(null);
  const [fetchState, setFetchState]  = useState<FetchState>(null);

  const accentColor = RISK_COLORS[source.risk_level];
  const canFetch    = source.enabled && Boolean(source.base_url);
  const isBusy      = fetchPending || queuePending || fetchState?.status === 'fetching';

  function handleToggle() {
    startToggle(async () => {
      const result = await toggleScannerSourceAction(source.id, !source.enabled);
      if ('error' in result) return;
      onToggled(source.id, !source.enabled);
    });
  }

  function handleEdit(form: SourceFormState) {
    setEditError(null);
    startEdit(async () => {
      const cats = form.category_focus.split(',').map((c) => c.trim()).filter(Boolean);
      const result = await updateScannerSourceAction({
        id:                source.id,
        name:              form.name,
        source_type:       form.source_type,
        base_url:          form.base_url || null,
        description:       form.description || null,
        category_focus:    cats,
        risk_level:        form.risk_level,
        refresh_cadence:   form.refresh_cadence || null,
        attribution_rules: form.attribution_rules || null,
      });
      if ('error' in result) { setEditError(result.error); return; }
      onUpdated({
        ...source,
        name:              form.name,
        source_type:       form.source_type as DbScannerSource['source_type'],
        base_url:          form.base_url || null,
        description:       form.description || null,
        category_focus:    cats,
        risk_level:        form.risk_level,
        refresh_cadence:   form.refresh_cadence || null,
        attribution_rules: form.attribution_rules || null,
      });
      setIsEditing(false);
    });
  }

  function handleFetch() {
    setFetchState({ status: 'fetching' });
    startFetch(async () => {
      const result = await fetchScannerSourcePreviewAction(source.id);
      if ('error' in result) {
        setFetchState({ status: 'error', message: result.error });
        return;
      }
      setFetchState({ status: 'preview', candidate: result.candidate });
    });
  }

  function handleQueueCandidate(form: PreviewFormState) {
    const tags      = form.tags.split(',').map((t) => t.trim()).filter(Boolean);
    const sourceUrl = fetchState?.status === 'preview' ? fetchState.candidate.sourceUrl : '';
    const savedForm: SavedCandidateForm = {
      title: form.title, summary: form.summary, sourceUrl,
      category: form.category, tags, anomalyScore: form.anomalyScore,
    };

    startQueue(async () => {
      const result = await queueFetchedCandidateAction({
        sourceId:    source.id,
        title:       savedForm.title,
        summary:     savedForm.summary,
        sourceUrl:   savedForm.sourceUrl,
        category:    savedForm.category,
        tags:        savedForm.tags,
        anomalyScore: savedForm.anomalyScore,
      });

      if ('error' in result) {
        setFetchState({ status: 'error', message: result.error });
        return;
      }
      if ('duplicateWarning' in result) {
        setFetchState({ status: 'duplicate-warning', savedForm, duplicates: result.duplicates });
        return;
      }
      onFetched(source.id, result.scannedAt);
      setFetchState({ status: 'success', title: result.title, signalId: result.signalId, url: result.url });
    });
  }

  function handleQueueAnyway() {
    if (fetchState?.status !== 'duplicate-warning') return;
    const { savedForm } = fetchState;

    startQueue(async () => {
      const result = await queueFetchedCandidateAction({
        sourceId:          source.id,
        title:             savedForm.title,
        summary:           savedForm.summary,
        sourceUrl:         savedForm.sourceUrl,
        category:          savedForm.category,
        tags:              savedForm.tags,
        anomalyScore:      savedForm.anomalyScore,
        overrideDuplicate: true,
      });

      if ('error' in result) {
        setFetchState({ status: 'error', message: result.error });
        return;
      }
      if ('duplicateWarning' in result) {
        setFetchState({ status: 'error', message: 'unexpected duplicate result' });
        return;
      }
      onFetched(source.id, result.scannedAt);
      setFetchState({ status: 'success', title: result.title, signalId: result.signalId, url: result.url });
    });
  }

  return (
    <div
      className="relative overflow-hidden"
      style={{
        background: 'rgba(8, 12, 6, 0.92)',
        border:     '1px solid rgba(134,212,110,0.12)',
        borderLeft: `4px solid ${accentColor}`,
      }}
    >
      {/* ── CARD HEADER ── */}
      {!isEditing && (
        <div className="px-6 pt-6 pb-5">
          {/* Name row + action buttons */}
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="text-2xl font-bold text-crt/92">{source.name}</h3>
              <TypeBadge type={source.source_type} />
              <RiskBadge level={source.risk_level} />
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              {/* Enable / Disable toggle */}
              <button
                onClick={handleToggle}
                disabled={togglePending}
                className="min-h-[52px] border px-5 py-2 text-base font-bold transition-colors disabled:opacity-40"
                style={
                  source.enabled
                    ? { borderColor: 'rgba(134,212,110,0.55)', color: '#86d46e', background: 'rgba(134,212,110,0.14)' }
                    : { borderColor: 'rgba(134,212,110,0.18)', color: 'rgba(134,212,110,0.42)', background: 'transparent' }
                }
              >
                {togglePending ? '···' : source.enabled ? '● Enabled' : '○ Disabled'}
              </button>

              {/* Fetch preview */}
              {canFetch && (
                <button
                  onClick={handleFetch}
                  disabled={isBusy}
                  title="Fetch base URL — one page, no crawl, preview before queueing"
                  className="min-h-[52px] border border-crt/28 bg-[rgba(134,212,110,0.06)] px-5 py-2 text-base font-semibold text-crt/70 transition-colors hover:border-crt/45 hover:bg-[rgba(134,212,110,0.12)] hover:text-crt/92 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {isBusy ? '↯ Fetching…' : '↯ Fetch Preview'}
                </button>
              )}

              {/* Edit */}
              <button
                onClick={() => { setIsEditing(true); setFetchState(null); }}
                className="min-h-[52px] border border-crt/15 px-5 py-2 text-base text-crt/50 transition-colors hover:border-crt/30 hover:text-crt/75"
              >
                Edit
              </button>
            </div>
          </div>

          {/* Description */}
          {source.description && (
            <p className="mb-5 max-w-2xl text-lg leading-relaxed text-crt/58">
              {source.description}
            </p>
          )}

          {/* Metadata grid */}
          <div className="grid grid-cols-2 gap-x-6 gap-y-4 sm:grid-cols-4">
            {source.base_url && (
              <div>
                <div className="mb-1 text-[15px] font-semibold text-crt/38">URL</div>
                <a
                  href={source.base_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  title={source.base_url}
                  className="block truncate font-mono text-sm text-crt/55 hover:text-crt/82 transition-colors"
                >
                  {source.base_url.replace(/^https?:\/\//, '').replace(/\/$/, '').slice(0, 36)}
                  {source.base_url.replace(/^https?:\/\//, '').length > 36 ? '…' : ''}
                </a>
              </div>
            )}
            <div>
              <div className="mb-1 text-xs font-semibold text-crt/38">Cadence</div>
              <span className="text-base text-crt/72">{source.refresh_cadence ?? 'manual'}</span>
            </div>
            {source.category_focus.length > 0 && (
              <div>
                <div className="mb-1 text-[15px] font-semibold text-crt/38">Categories</div>
                <div className="flex flex-wrap gap-1">
                  {source.category_focus.slice(0, 3).map((c) => (
                    <span key={c} className="border border-crt/16 px-2 py-0.5 text-sm text-crt/55">{c}</span>
                  ))}
                  {source.category_focus.length > 3 && (
                    <span className="text-sm text-crt/35">+{source.category_focus.length - 3}</span>
                  )}
                </div>
              </div>
            )}
            <div>
              <div className="mb-1 text-xs font-semibold text-crt/38">Last Scanned</div>
              <span className="text-base text-crt/72">
                {source.last_scanned_at
                  ? new Date(source.last_scanned_at).toLocaleDateString()
                  : 'Never'}
              </span>
            </div>
          </div>

          {source.attribution_rules && (
            <div className="mt-4 border-t border-crt/8 pt-3 text-sm leading-relaxed text-crt/32">
              <span className="font-semibold text-crt/22">Attribution: </span>
              {source.attribution_rules.slice(0, 120)}{source.attribution_rules.length > 120 ? '…' : ''}
            </div>
          )}
        </div>
      )}

      {/* ── EDIT FORM ── */}
      {isEditing && (
        <div className="border-t border-crt/12 bg-[rgba(134,212,110,0.010)] px-6 py-6">
          <div className="mb-5 flex items-center justify-between">
            <div className="text-base font-medium text-crt/55">
              Editing: <span className="text-crt/80">{source.name}</span>
            </div>
            <button
              onClick={() => { setIsEditing(false); setEditError(null); }}
              className="text-sm text-crt/35 hover:text-crt/60 transition-colors"
            >
              × Cancel
            </button>
          </div>
          <SourceForm
            initial={sourceToForm(source)}
            isPending={editPending}
            error={editError}
            submitLabel="Save Changes"
            onSubmit={handleEdit}
            onCancel={() => { setIsEditing(false); setEditError(null); }}
          />
        </div>
      )}

      {/* ── FETCH LOADING ── */}
      {!isEditing && (fetchPending || fetchState?.status === 'fetching') && (
        <div className="border-t border-crt/8 px-6 py-4">
          <div className="flex items-center gap-3">
            <div
              className="h-2 w-2 rounded-full shrink-0"
              style={{ background: '#86d46e', boxShadow: '0 0 6px #86d46e80' }}
            />
            <span className="text-sm text-crt/48">
              Fetching one page · no crawl · raw html will not be stored
            </span>
          </div>
        </div>
      )}

      {/* ── CANDIDATE PREVIEW ── */}
      {!isEditing && fetchState?.status === 'preview' && (
        <CandidatePreviewPanel
          candidate={fetchState.candidate}
          isQueueing={queuePending}
          onSubmit={handleQueueCandidate}
          onCancel={() => setFetchState(null)}
        />
      )}

      {/* ── DUPLICATE WARNING ── */}
      {!isEditing && fetchState?.status === 'duplicate-warning' && (
        <DuplicateWarningPanel
          duplicates={fetchState.duplicates}
          isQueueing={queuePending}
          onQueueAnyway={handleQueueAnyway}
          onCancel={() => setFetchState(null)}
        />
      )}

      {/* ── SUCCESS ── */}
      {!isEditing && fetchState?.status === 'success' && (
        <div
          className="border-t border-crt/8 px-6 py-5"
          style={{ background: 'rgba(134,212,110,0.028)' }}
        >
          <div className="mb-2 flex items-center gap-2.5">
            <span className="text-xl" style={{ color: '#86d46e' }}>✓</span>
            <span className="text-base font-semibold text-crt/85">Signal queued — pending curator review</span>
          </div>
          <p className="mb-4 truncate font-mono text-sm text-crt/50">{fetchState.title}</p>
          <div className="flex items-center gap-5">
            <a
              href="/scanner/queue"
              className="text-sm font-semibold transition-colors"
              style={{ color: 'rgba(134,212,110,0.68)' }}
            >
              View in queue →
            </a>
            <button
              onClick={() => setFetchState(null)}
              className="text-sm text-crt/30 hover:text-crt/55 transition-colors"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      {/* ── ERROR ── */}
      {!isEditing && fetchState?.status === 'error' && (
        <div
          className="border-t border-crt/8 px-6 py-5"
          style={{ background: 'rgba(255,107,107,0.022)' }}
        >
          <div className="mb-2 flex items-center gap-2.5">
            <span className="text-[#ff6b6b]/80 text-lg">✗</span>
            <span className="text-base font-medium text-[#ff6b6b]/72">Fetch failed</span>
          </div>
          <p className="mb-4 font-mono text-sm text-[#ff6b6b]/48">{fetchState.message}</p>
          <button
            onClick={() => setFetchState(null)}
            className="text-sm text-crt/30 hover:text-crt/55 transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main client component
// ---------------------------------------------------------------------------

interface ScannerSourcesClientProps {
  sources: DbScannerSource[];
}

export function ScannerSourcesClient({ sources: initialSources }: ScannerSourcesClientProps) {
  const router = useRouter();
  const [sources, setSources]         = useState<DbScannerSource[]>(initialSources);
  const [showAddForm, setShowAddForm] = useState(false);
  const [addPending, startAdd]        = useTransition();
  const [addError, setAddError]       = useState<string | null>(null);

  const [session, setSession]           = useState<SessionState>({ status: 'idle', runAt: null, entries: [] });
  const [lastSession, setLastSession]   = useState<SessionHistoryRecord | null>(null);
  const [sessionPending, startSession]  = useTransition();
  const [sessionError, setSessionError] = useState<string | null>(null);

  const enabledCount   = sources.filter((s) => s.enabled).length;
  const enabledWithUrl = sources.filter((s) => s.enabled && s.base_url).length;
  const highRiskCount  = sources.filter((s) => s.risk_level === 'high').length;

  function handleToggled(id: string, enabled: boolean) {
    setSources((prev) => prev.map((s) => (s.id === id ? { ...s, enabled } : s)));
  }

  function handleUpdated(updated: DbScannerSource) {
    setSources((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    router.refresh();
  }

  function handleFetched(id: string, scannedAt: string) {
    setSources((prev) => prev.map((s) => (s.id === id ? { ...s, last_scanned_at: scannedAt } : s)));
  }

  function handleAdd(form: SourceFormState) {
    setAddError(null);
    startAdd(async () => {
      const cats = form.category_focus.split(',').map((c) => c.trim()).filter(Boolean);
      const result = await createScannerSourceAction({
        name:              form.name,
        source_type:       form.source_type,
        base_url:          form.base_url || undefined,
        description:       form.description || undefined,
        category_focus:    cats,
        risk_level:        form.risk_level,
        refresh_cadence:   form.refresh_cadence || undefined,
        attribution_rules: form.attribution_rules || undefined,
      });

      if ('error' in result) { setAddError(result.error); return; }

      setSources((prev) => [
        ...prev,
        {
          id:                result.id,
          name:              form.name,
          source_type:       form.source_type as DbScannerSource['source_type'],
          base_url:          form.base_url || null,
          description:       form.description || null,
          category_focus:    cats,
          risk_level:        form.risk_level,
          refresh_cadence:   form.refresh_cadence || null,
          attribution_rules: form.attribution_rules || null,
          enabled:           false,
          last_scanned_at:   null,
          created_at:        new Date().toISOString(),
        },
      ]);
      setShowAddForm(false);
      router.refresh();
    });
  }

  function handleRunSession() {
    const ids = sources.filter((s) => s.enabled && s.base_url).map((s) => s.id);
    if (!ids.length) return;
    setSessionError(null);
    setSession({ status: 'running', runAt: new Date().toISOString(), entries: [] });
    startSession(async () => {
      const res = await runFetchSessionAction(ids);
      if ('error' in res) {
        setSessionError(res.error);
        setSession({ status: 'idle', runAt: null, entries: [] });
        return;
      }
      setSession({
        status:  'complete',
        runAt:   new Date().toISOString(),
        entries: res.results.map((r) => ({ result: r, actionStatus: 'pending' })),
      });
    });
  }

  function handleSessionStatusChange(idx: number, status: 'queued' | 'skipped') {
    setSession((prev) => ({
      ...prev,
      entries: prev.entries.map((e, i) => (i === idx ? { ...e, actionStatus: status } : e)),
    }));
  }

  function handleCloseSession() {
    const queued = session.entries.filter((e) => e.actionStatus === 'queued').length;
    const failed = session.entries.filter((e) => e.result.status === 'error').length;
    const dupes  = session.entries.filter((e) => e.result.status === 'duplicate').length;
    if (session.runAt) {
      setLastSession({
        runAt:   session.runAt,
        scanned: session.entries.length,
        queued,
        failed,
        dupes,
      });
    }
    setSession({ status: 'idle', runAt: null, entries: [] });
    router.refresh();
  }

  return (
    <div className="relative min-h-screen overflow-hidden pb-8 pt-[80px] md:pt-[100px]">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: 'radial-gradient(circle, #86d46e 1px, transparent 1px)',
          backgroundSize:  '32px 32px',
        }}
      />

      {/* ── STICKY ADMIN TOOLBAR ── */}
      <div className="admin-toolbar sticky top-[72px] z-20 md:top-[80px]">
        <div className="mx-auto max-w-5xl px-4 py-4 md:px-6">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-crt/35">SWIM · Scanner Admin</p>
              <h1 className="text-2xl font-bold text-crt/92 md:text-3xl">Scanner Sources</h1>
              <p className="mt-0.5 text-sm text-crt/42">manual recovery registry · no crawl · one page per call</p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Stats pills */}
              <div className="hidden items-center gap-2.5 sm:flex">
                <div className="flex items-center gap-1.5 border border-crt/14 px-3 py-1.5">
                  <span className="font-mono text-xl font-bold text-crt/80">{sources.length}</span>
                  <span className="text-xs text-crt/38">total</span>
                </div>
                <div className="flex items-center gap-1.5 border border-crt/14 px-3 py-1.5">
                  <span
                    className="font-mono text-xl font-bold"
                    style={{ color: enabledCount > 0 ? '#86d46e' : 'rgba(134,212,110,0.30)' }}
                  >
                    {enabledCount}
                  </span>
                  <span className="text-xs text-crt/38">enabled</span>
                </div>
                {highRiskCount > 0 && (
                  <div
                    className="flex items-center gap-1.5 border px-3 py-1.5"
                    style={{ borderColor: 'rgba(255,107,107,0.28)', background: 'rgba(255,107,107,0.05)' }}
                  >
                    <span className="font-mono text-xl font-bold text-[#ff6b6b]">{highRiskCount}</span>
                    <span className="text-xs" style={{ color: 'rgba(255,107,107,0.55)' }}>high risk</span>
                  </div>
                )}
              </div>

              {/* Nav links */}
              <div className="flex items-center gap-4 text-sm text-crt/38">
                <a href="/scanner/queue" className="hover:text-crt/65 transition-colors">← queue</a>
                <a href="/scanner" className="hover:text-crt/65 transition-colors">scanner →</a>
              </div>

              {/* Run Fetch Session — primary CTA */}
              {session.status === 'idle' && (
                <button
                  onClick={handleRunSession}
                  disabled={sessionPending || enabledWithUrl === 0}
                  title={enabledWithUrl === 0 ? 'Enable at least one source with a base URL first' : undefined}
                  className="admin-btn admin-btn-success"
                >
                  {sessionPending
                    ? '↯ Starting…'
                    : enabledWithUrl > 0
                    ? `↯ Run Session (${enabledWithUrl})`
                    : '↯ Run Session'}
                </button>
              )}

              {/* Add Source */}
              {!showAddForm && (
                <button
                  onClick={() => setShowAddForm(true)}
                  className="min-h-[44px] border border-crt/25 bg-[rgba(134,212,110,0.06)] px-5 py-2 text-sm font-bold text-crt/72 transition-colors hover:border-crt/42 hover:bg-[rgba(134,212,110,0.12)] hover:text-crt/92"
                >
                  + Add Source
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── MAIN CONTENT ── */}
      <div className="relative z-10 mx-auto max-w-5xl px-4 py-6 md:px-6">

        {/* Operator flow */}
        <div className="mb-5">
          <AdminFlowBanner currentStep={1} />
        </div>

        {/* ── PAGE ACTION CARDS ── */}
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <button
            onClick={handleRunSession}
            disabled={sessionPending || enabledWithUrl === 0 || session.status !== 'idle'}
            className="flex flex-col items-start border px-6 py-5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-40 hover:bg-[rgba(134,212,110,0.06)]"
            style={{ borderColor: 'rgba(134,212,110,0.25)', background: 'rgba(8,12,6,0.90)' }}
          >
            <span className="mb-2 text-3xl" style={{ color: '#86d46e' }}>↯</span>
            <span className="text-lg font-bold text-crt/90">Run Fetch Session</span>
            <span className="mt-1 text-sm text-crt/48">
              {enabledWithUrl > 0
                ? `Fetch ${enabledWithUrl} enabled source${enabledWithUrl !== 1 ? 's' : ''}`
                : 'Enable a source with a URL first'}
            </span>
          </button>

          <button
            onClick={() => setShowAddForm(true)}
            disabled={showAddForm}
            className="flex flex-col items-start border border-crt/16 bg-[rgba(8,12,6,0.90)] px-6 py-5 text-left transition-all disabled:cursor-not-allowed disabled:opacity-40 hover:border-crt/30 hover:bg-[rgba(134,212,110,0.03)]"
          >
            <span className="mb-2 text-3xl text-crt/55">+</span>
            <span className="text-lg font-bold text-crt/88">Add Source</span>
            <span className="mt-1 text-sm text-crt/45">Register a new URL to scan</span>
          </button>

          <a
            href="/scanner/queue"
            className="flex flex-col items-start border px-6 py-5 text-left transition-all hover:bg-[rgba(77,184,200,0.04)]"
            style={{ borderColor: 'rgba(77,184,200,0.22)', background: 'rgba(8,12,6,0.90)' }}
          >
            <span className="mb-2 text-3xl" style={{ color: '#4db8c8' }}>→</span>
            <span className="text-lg font-bold text-crt/88">View Queue</span>
            <span className="mt-1 text-sm text-crt/45">Review and rebirth queued signals</span>
          </a>
        </div>

        {/* ── FETCH SESSION PANEL ── */}
        <div
          className="mb-6 overflow-hidden border border-crt/12"
          style={{ background: 'rgba(8,12,6,0.90)' }}
        >
          {session.status === 'idle' && (
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
              <span className="text-xs text-crt/25">
                ◈ manual · no crawl · one page per source · all candidates require review
              </span>
              {sessionError && (
                <span className="text-sm text-[#ff6b6b]/65">✗ {sessionError}</span>
              )}
              {lastSession && !sessionError && (
                <span className="shrink-0 text-xs text-crt/30">
                  Last: {new Date(lastSession.runAt).toLocaleString()}
                  {lastSession.queued > 0 ? ` · ${lastSession.queued} queued` : ''}
                  {lastSession.failed > 0 ? ` · ${lastSession.failed} failed` : ''}
                </span>
              )}
              {enabledWithUrl === 0 && (
                <span className="text-xs text-crt/28">No enabled sources with a URL — enable one below.</span>
              )}
            </div>
          )}

          {session.status === 'running' && (
            <div className="px-6 py-6">
              <div className="flex items-center gap-3">
                <div
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ background: '#86d46e', boxShadow: '0 0 8px #86d46e80' }}
                />
                <div>
                  <p className="text-base font-semibold text-crt/82">
                    Running session — fetching {enabledWithUrl} source{enabledWithUrl !== 1 ? 's' : ''}
                  </p>
                  <p className="mt-0.5 text-sm text-crt/40">no crawl · one page per source · raw html discarded</p>
                </div>
              </div>
            </div>
          )}

          {session.status === 'complete' && (
            <FetchSessionPanel
              entries={session.entries}
              runAt={session.runAt!}
              onStatusChange={handleSessionStatusChange}
              onClose={handleCloseSession}
            />
          )}
        </div>

        {/* ── ADD SOURCE FORM ── */}
        {showAddForm && (
          <div
            className="mb-6 overflow-hidden border border-crt/14"
            style={{ background: 'rgba(8,12,6,0.90)' }}
          >
            <div className="flex items-center justify-between border-b border-crt/10 px-6 py-4">
              <div>
                <h2 className="text-lg font-semibold text-crt/85">New Source</h2>
                <p className="mt-0.5 text-sm text-crt/40">Starts disabled. Enable after setup.</p>
              </div>
              <button
                onClick={() => { setShowAddForm(false); setAddError(null); }}
                className="text-sm text-crt/35 hover:text-crt/60 transition-colors"
              >
                × Close
              </button>
            </div>
            <div className="px-6 py-6">
              <SourceForm
                initial={EMPTY_FORM}
                isPending={addPending}
                error={addError}
                submitLabel="Add Source"
                onSubmit={handleAdd}
                onCancel={() => { setShowAddForm(false); setAddError(null); }}
              />
            </div>
          </div>
        )}

        {/* ── SOURCE LIST ── */}
        {sources.length === 0 ? (
          <div className="border border-crt/10 px-6 py-16 text-center">
            <p className="text-base text-crt/38">No sources registered yet.</p>
            <p className="mt-1 text-sm text-crt/22">Click + Add Source above to create your first source.</p>
          </div>
        ) : (
          (['low', 'medium', 'high'] as const).map((risk) => {
            const group = sources.filter((s) => s.risk_level === risk);
            if (!group.length) return null;
            return (
              <div key={risk} className="mb-8">
                <div className="mb-4 flex items-center gap-3">
                  <div className="h-px flex-1" style={{ background: `${RISK_COLORS[risk]}25` }} />
                  <span
                    className="shrink-0 text-sm font-bold uppercase tracking-wide"
                    style={{ color: `${RISK_COLORS[risk]}80` }}
                  >
                    {risk} Risk — {group.length} source{group.length !== 1 ? 's' : ''}
                  </span>
                  <div className="h-px flex-1" style={{ background: `${RISK_COLORS[risk]}25` }} />
                </div>
                <div className="space-y-4">
                  {group.map((source) => (
                    <SourceCard
                      key={source.id}
                      source={source}
                      onToggled={handleToggled}
                      onUpdated={handleUpdated}
                      onFetched={handleFetched}
                    />
                  ))}
                </div>
              </div>
            );
          })
        )}

        {/* Safety footer */}
        <div className="mt-8 flex flex-wrap gap-x-6 gap-y-1 border-t border-crt/8 pt-5 text-xs text-crt/22">
          <span>◈ manual fetch only</span>
          <span>◈ raw html is discarded</span>
          <span>◈ all signals require curator approval</span>
          <span>◈ no signal is published automatically</span>
        </div>
      </div>
    </div>
  );
}
