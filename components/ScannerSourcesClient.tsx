'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  createScannerSourceAction,
  updateScannerSourceAction,
  toggleScannerSourceAction,
} from '@/app/actions';
import type { DbScannerSource, ScannerRiskLevel } from '@/lib/supabase/types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SOURCE_TYPES = [
  { value: 'archive',    label: 'Archive'     },
  { value: 'forum',      label: 'Forum'       },
  { value: 'reddit',     label: 'Reddit'      },
  { value: 'imageboard', label: 'Imageboard'  },
  { value: 'bbs',        label: 'BBS'         },
  { value: 'pastebin',   label: 'Paste'       },
  { value: 'other',      label: 'Other'       },
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
// Sub-components
// ---------------------------------------------------------------------------

function StatusBar() {
  return (
    <div className="border-b border-crt/10 bg-[rgba(134,212,110,0.012)] px-6 py-3 md:px-10">
      <div className="flex flex-wrap gap-x-6 gap-y-1 text-[10px] uppercase tracking-[0.20em]">
        <span style={{ color: '#86d46e' }}>◈ registry only</span>
        <span className="text-crt/35">◈ no fetchers connected</span>
        <span className="text-crt/35">◈ human approval required at every stage</span>
        <span className="text-crt/35">◈ enabling a source does not trigger scanning</span>
      </div>
    </div>
  );
}

function RiskBadge({ level }: { level: ScannerRiskLevel }) {
  return (
    <span
      className="inline-block px-2 py-0.5 text-[9px] uppercase tracking-[0.18em]"
      style={{
        color:      RISK_COLORS[level],
        background: RISK_BG[level],
        border:     `1px solid ${RISK_COLORS[level]}30`,
      }}
    >
      {level} risk
    </span>
  );
}

function TypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-block border border-crt/15 px-2 py-0.5 text-[9px] uppercase tracking-[0.16em] text-crt/45">
      {type}
    </span>
  );
}

function CategoryTags({ categories }: { categories: string[] }) {
  if (!categories.length) return null;
  return (
    <div className="flex flex-wrap gap-1">
      {categories.map((c) => (
        <span
          key={c}
          className="border border-crt/10 px-1.5 py-0.5 text-[9px] tracking-[0.10em] text-crt/35"
        >
          {c}
        </span>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Source form (shared for Add + Edit)
// ---------------------------------------------------------------------------

interface SourceFormState {
  name:              string;
  source_type:       string;
  base_url:          string;
  description:       string;
  category_focus:    string; // comma-separated text
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
  initial:    SourceFormState;
  isPending:  boolean;
  error:      string | null;
  submitLabel: string;
  onSubmit:   (form: SourceFormState) => void;
  onCancel?:  () => void;
}

function SourceForm({ initial, isPending, error, submitLabel, onSubmit, onCancel }: SourceFormProps) {
  const [form, setForm] = useState<SourceFormState>(initial);

  const inputBase =
    'w-full border border-crt/18 bg-transparent px-3 py-2 font-mono text-[12px] tracking-[0.04em] text-crt/80 placeholder:text-crt/22 focus:border-crt/38 focus:outline-none transition-colors';
  const labelBase =
    'mb-1 block text-[10px] uppercase tracking-[0.20em] text-crt/38';

  function set(field: keyof SourceFormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [field]: e.target.value }));
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit(form);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Name + type row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelBase}>name <span className="text-crt/20">— required</span></label>
          <input
            type="text"
            value={form.name}
            onChange={set('name')}
            placeholder="e.g. Erowid Experience Vaults"
            maxLength={200}
            required
            className={inputBase}
          />
        </div>
        <div>
          <label className={labelBase}>source type</label>
          <select value={form.source_type} onChange={set('source_type')} className={`${inputBase} cursor-pointer`}>
            {SOURCE_TYPES.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Base URL */}
      <div>
        <label className={labelBase}>base url <span className="text-crt/20">— optional</span></label>
        <input
          type="url"
          value={form.base_url}
          onChange={set('base_url')}
          placeholder="https://..."
          maxLength={500}
          className={inputBase}
        />
      </div>

      {/* Description */}
      <div>
        <label className={labelBase}>description <span className="text-crt/20">— optional</span></label>
        <textarea
          value={form.description}
          onChange={set('description')}
          placeholder="what kinds of signals this source contains and how to evaluate them"
          rows={3}
          maxLength={1000}
          className={`${inputBase} resize-y`}
        />
      </div>

      {/* Category focus */}
      <div>
        <label className={labelBase}>
          category focus <span className="text-crt/20">— comma separated · optional</span>
        </label>
        <input
          type="text"
          value={form.category_focus}
          onChange={set('category_focus')}
          placeholder="UFOs, Paranormal, Hidden History"
          maxLength={500}
          className={inputBase}
        />
      </div>

      {/* Risk + cadence row */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label className={labelBase}>risk level</label>
          <select value={form.risk_level} onChange={set('risk_level')} className={`${inputBase} cursor-pointer`}>
            <option value="low">Low — curated, stable, low noise</option>
            <option value="medium">Medium — mixed quality, needs review</option>
            <option value="high">High — volatile, heavy curation required</option>
          </select>
        </div>
        <div>
          <label className={labelBase}>refresh cadence</label>
          <select value={form.refresh_cadence} onChange={set('refresh_cadence')} className={`${inputBase} cursor-pointer`}>
            {CADENCES.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Attribution rules */}
      <div>
        <label className={labelBase}>
          attribution rules <span className="text-crt/20">— how to credit this source</span>
        </label>
        <textarea
          value={form.attribution_rules}
          onChange={set('attribution_rules')}
          placeholder='e.g. "Credit original poster handle and date. Summarize — do not reproduce full text."'
          rows={2}
          maxLength={500}
          className={`${inputBase} resize-none`}
        />
      </div>

      {error && (
        <div className="text-[11px] uppercase tracking-[0.16em] text-[#ff6b6b]/80">› {error}</div>
      )}

      <div className="flex items-center gap-3 pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="border border-crt/25 px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-crt/60 transition-colors hover:border-crt/42 hover:text-crt/85 disabled:cursor-not-allowed disabled:opacity-30"
        >
          {isPending ? '↯ saving...' : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="text-[10px] uppercase tracking-[0.18em] text-crt/30 hover:text-crt/55 transition-colors"
          >
            cancel
          </button>
        )}
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// SourceRow — single source card
// ---------------------------------------------------------------------------

interface SourceRowProps {
  source:     DbScannerSource;
  onToggled:  (id: string, enabled: boolean) => void;
  onUpdated:  (updated: DbScannerSource) => void;
}

function SourceRow({ source, onToggled, onUpdated }: SourceRowProps) {
  const [isEditing, setIsEditing]   = useState(false);
  const [isPending, startTransition] = useTransition();
  const [togglePending, startToggle] = useTransition();
  const [editError, setEditError]   = useState<string | null>(null);

  const accentColor = RISK_COLORS[source.risk_level];

  function handleToggle() {
    startToggle(async () => {
      const result = await toggleScannerSourceAction(source.id, !source.enabled);
      if ('error' in result) return;
      onToggled(source.id, !source.enabled);
    });
  }

  function handleEdit(form: SourceFormState) {
    setEditError(null);
    startTransition(async () => {
      const cats = form.category_focus
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);

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

      if ('error' in result) {
        setEditError(result.error);
        return;
      }

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

  return (
    <div
      className="relative overflow-hidden"
      style={{
        background:  `rgba(10,14,8,0.65)`,
        border:      `1px solid rgba(134,212,110,0.10)`,
        borderLeft:  `3px solid ${accentColor}`,
        marginBottom: '1px',
      }}
    >
      {/* Collapsed display */}
      {!isEditing && (
        <div className="px-5 py-4">
          {/* Top row: name + type + enable toggle */}
          <div className="flex flex-wrap items-start gap-3">
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <span className="font-mono text-[13px] tracking-[0.05em] text-crt/85">{source.name}</span>
                <TypeBadge type={source.source_type} />
                <RiskBadge level={source.risk_level} />
              </div>

              {source.description && (
                <p className="text-[11px] leading-relaxed tracking-[0.03em] text-crt/45 mb-2 line-clamp-2">
                  {source.description}
                </p>
              )}

              {source.base_url && (
                <div className="text-[10px] tracking-[0.06em] text-crt/30 mb-2 truncate">
                  {source.base_url}
                </div>
              )}

              <CategoryTags categories={source.category_focus} />
            </div>

            {/* Actions */}
            <div className="flex flex-col items-end gap-2 shrink-0">
              <button
                onClick={handleToggle}
                disabled={togglePending}
                className="border px-3 py-1.5 text-[10px] uppercase tracking-[0.20em] transition-colors disabled:opacity-40"
                style={
                  source.enabled
                    ? { borderColor: '#86d46e40', color: '#86d46e', background: 'rgba(134,212,110,0.06)' }
                    : { borderColor: 'rgba(134,212,110,0.15)', color: 'rgba(134,212,110,0.35)' }
                }
              >
                {togglePending ? '···' : source.enabled ? '● enabled' : '○ disabled'}
              </button>
              <button
                onClick={() => setIsEditing(true)}
                className="text-[10px] uppercase tracking-[0.16em] text-crt/28 hover:text-crt/55 transition-colors"
              >
                edit ▸
              </button>
            </div>
          </div>

          {/* Footer meta row */}
          <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 border-t border-crt/8 pt-2.5 text-[9px] uppercase tracking-[0.16em] text-crt/28">
            {source.refresh_cadence && (
              <span>cadence: {source.refresh_cadence}</span>
            )}
            <span>
              last scanned:{' '}
              {source.last_scanned_at
                ? new Date(source.last_scanned_at).toLocaleDateString()
                : 'never — no fetchers connected'}
            </span>
            {source.attribution_rules && (
              <span className="truncate max-w-[40ch]">attr: {source.attribution_rules.slice(0, 60)}{source.attribution_rules.length > 60 ? '…' : ''}</span>
            )}
          </div>
        </div>
      )}

      {/* Edit form */}
      {isEditing && (
        <div className="border-t border-crt/12 bg-[rgba(134,212,110,0.012)] px-5 py-5">
          <div className="mb-3 text-[10px] uppercase tracking-[0.24em] text-crt/35">
            editing · {source.name}
          </div>
          <SourceForm
            initial={sourceToForm(source)}
            isPending={isPending}
            error={editError}
            submitLabel="[ save changes ]"
            onSubmit={handleEdit}
            onCancel={() => { setIsEditing(false); setEditError(null); }}
          />
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
  const [sources, setSources]           = useState<DbScannerSource[]>(initialSources);
  const [showAddForm, setShowAddForm]   = useState(false);
  const [addPending, startAdd]          = useTransition();
  const [addError, setAddError]         = useState<string | null>(null);

  // Stats
  const enabledCount  = sources.filter((s) => s.enabled).length;
  const highRiskCount = sources.filter((s) => s.risk_level === 'high').length;
  const byType = sources.reduce<Record<string, number>>((acc, s) => {
    acc[s.source_type] = (acc[s.source_type] ?? 0) + 1;
    return acc;
  }, {});

  function handleToggled(id: string, enabled: boolean) {
    setSources((prev) => prev.map((s) => (s.id === id ? { ...s, enabled } : s)));
  }

  function handleUpdated(updated: DbScannerSource) {
    setSources((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
    router.refresh();
  }

  function handleAdd(form: SourceFormState) {
    setAddError(null);
    startAdd(async () => {
      const cats = form.category_focus
        .split(',')
        .map((c) => c.trim())
        .filter(Boolean);

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

      if ('error' in result) {
        setAddError(result.error);
        return;
      }

      // Optimistic local entry while page refreshes
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

  return (
    <div className="relative min-h-screen overflow-hidden pb-[72px] pt-[80px] md:pb-8 md:pt-[100px]">
      {/* Ambient bg dots */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            'radial-gradient(circle, #86d46e 1px, transparent 1px)',
          backgroundSize: '32px 32px',
        }}
      />

      <div className="relative z-10 mx-auto max-w-5xl px-4 py-4 md:px-6 md:py-6">
        <div
          className="overflow-hidden"
          style={{
            background: 'rgba(8,12,6,0.92)',
            border:     '1px solid rgba(134,212,110,0.12)',
          }}
        >
          {/* ── Header ── */}
          <div className="border-b border-crt/12 px-6 py-8 md:px-10 md:py-10">
            <div className="mb-1 text-[10px] uppercase tracking-[0.30em] text-crt/35">
              swim · scanner admin
            </div>
            <h1 className="mb-1 text-[1.6rem] tracking-[0.10em] text-crt md:text-[2rem]">
              SOURCE REGISTRY
            </h1>
            <p className="mt-2 max-w-xl text-[0.95rem] leading-relaxed tracking-[0.03em] text-crt/50">
              Candidate sources for future signal recovery. No automated scanning is active.
              All entries are registry-only until a fetch pipeline is connected.
            </p>

            {/* Nav links */}
            <div className="mt-4 flex flex-wrap gap-4 text-[10px] uppercase tracking-[0.18em]">
              <a href="/scanner/queue" className="text-crt/35 hover:text-crt/60 transition-colors">
                ← queue
              </a>
              <span className="text-crt/60">sources</span>
              <a href="/scanner" className="text-crt/35 hover:text-crt/60 transition-colors">
                scanner →
              </a>
            </div>
          </div>

          {/* ── Status bar ── */}
          <StatusBar />

          {/* ── Stats row ── */}
          <div className="grid grid-cols-2 gap-px border-b border-crt/10 bg-crt/5 sm:grid-cols-4">
            {[
              { label: 'total sources',  value: sources.length,   color: '#86d46e' },
              { label: 'enabled',        value: enabledCount,     color: enabledCount > 0 ? '#86d46e' : 'rgba(134,212,110,0.25)' },
              { label: 'high risk',      value: highRiskCount,    color: highRiskCount > 0 ? '#ff6b6b' : 'rgba(134,212,110,0.25)' },
              { label: 'last scan',      value: 'never',          color: 'rgba(134,212,110,0.25)' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-[rgba(8,12,6,0.92)] px-5 py-4">
                <div className="text-[9px] uppercase tracking-[0.22em] text-crt/30 mb-1">{label}</div>
                <div className="font-mono text-[1.4rem] tracking-[0.06em]" style={{ color }}>
                  {value}
                </div>
              </div>
            ))}
          </div>

          {/* ── Source type breakdown ── */}
          {Object.keys(byType).length > 0 && (
            <div className="border-b border-crt/8 px-6 py-3 md:px-10">
              <div className="flex flex-wrap gap-x-5 gap-y-1 text-[9px] uppercase tracking-[0.18em] text-crt/28">
                {Object.entries(byType).map(([type, count]) => (
                  <span key={type}>{type}: {count}</span>
                ))}
              </div>
            </div>
          )}

          {/* ── Add source section ── */}
          <div className="border-b border-crt/10 px-6 py-5 md:px-10">
            {!showAddForm ? (
              <button
                onClick={() => setShowAddForm(true)}
                className="border border-crt/20 px-4 py-2 text-[11px] uppercase tracking-[0.22em] text-crt/50 transition-colors hover:border-crt/38 hover:text-crt/75"
              >
                + add source
              </button>
            ) : (
              <div>
                <div className="mb-4 text-[11px] uppercase tracking-[0.24em] text-crt/40">
                  new source · all sources start disabled
                </div>
                <SourceForm
                  initial={EMPTY_FORM}
                  isPending={addPending}
                  error={addError}
                  submitLabel="[ add source ]"
                  onSubmit={handleAdd}
                  onCancel={() => { setShowAddForm(false); setAddError(null); }}
                />
              </div>
            )}
          </div>

          {/* ── Source list ── */}
          <div className="px-6 py-6 md:px-10">
            {sources.length === 0 ? (
              <div className="py-10 text-center text-[11px] uppercase tracking-[0.22em] text-crt/25">
                no sources registered yet
              </div>
            ) : (
              <>
                {/* Group by risk level */}
                {(['low', 'medium', 'high'] as const).map((risk) => {
                  const group = sources.filter((s) => s.risk_level === risk);
                  if (!group.length) return null;
                  return (
                    <div key={risk} className="mb-6">
                      <div
                        className="mb-2 text-[9px] uppercase tracking-[0.24em]"
                        style={{ color: `${RISK_COLORS[risk]}80` }}
                      >
                        {risk} risk — {group.length} source{group.length !== 1 ? 's' : ''}
                      </div>
                      {group.map((source) => (
                        <SourceRow
                          key={source.id}
                          source={source}
                          onToggled={handleToggled}
                          onUpdated={handleUpdated}
                        />
                      ))}
                    </div>
                  );
                })}
              </>
            )}
          </div>

          {/* ── Footer note ── */}
          <div className="border-t border-crt/8 px-6 py-5 md:px-10">
            <div className="grid gap-1.5 text-[10px] uppercase tracking-[0.16em] text-crt/22 sm:grid-cols-2">
              <div>◈ registry only — no automated scanning is running</div>
              <div>◈ enabling a source flags it for future pipeline use only</div>
              <div>◈ all signal recovery requires curator approval</div>
              <div>◈ no content is published without human review</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
