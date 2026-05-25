'use client';

/**
 * IntakeFormClient — manual signal intake form for /scanner/queue.
 *
 * SAFETY RULES (see docs/scanner-source-registry.md):
 *   - Summarize, do not copy full copyrighted text
 *   - No PII (names, addresses, email)
 *   - No illegal instructions
 *   - All signals start as pending — curator must approve before publishing
 *
 * CURATOR GATE: only rendered when CURATOR_QUEUE_ENABLED=true
 */

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { createRecoveredSignalAction } from '@/app/actions';
import { CATEGORY_ORDER } from '@/lib/forum-types';
import type { SignalSourceType } from '@/lib/supabase/types';

const SOURCE_TYPES: { value: SignalSourceType; label: string }[] = [
  { value: 'reddit',     label: 'Reddit'         },
  { value: 'forum',      label: 'Forum (old)'    },
  { value: 'pastebin',   label: 'Paste archive'  },
  { value: 'wayback',    label: 'Wayback/archive'},
  { value: 'imageboard', label: 'Imageboard'     },
  { value: 'irc',        label: 'IRC / chat log' },
  { value: 'other',      label: 'Other'          },
];

interface FormState {
  title:       string;
  summary:     string;
  category:    string;
  sourceName:  string;
  sourceUrl:   string;
  sourceType:  SignalSourceType;
  anomalyScore: string;
  tags:        string;
}

const EMPTY: FormState = {
  title:        '',
  summary:      '',
  category:     'Paranormal',
  sourceName:   '',
  sourceUrl:    '',
  sourceType:   'other',
  anomalyScore: '5',
  tags:         '',
};

interface IntakeFormClientProps {
  onSuccess?: () => void;
}

export function IntakeFormClient({ onSuccess }: IntakeFormClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [error, setError]   = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function set(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [field]: e.target.value }));
      setError(null);
      setSuccess(false);
    };
  }

  function validate(): string | null {
    if (!form.title.trim())      return 'title is required';
    if (!form.summary.trim())    return 'summary is required';
    if (!form.category)          return 'category is required';
    if (!form.sourceName.trim()) return 'source name is required';
    const score = parseInt(form.anomalyScore, 10);
    if (isNaN(score) || score < 1 || score > 10) return 'anomaly score must be 1–10';
    return null;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const err = validate();
    if (err) { setError(err); return; }

    startTransition(async () => {
      const tags = form.tags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      const result = await createRecoveredSignalAction({
        title:        form.title.trim(),
        summary:      form.summary.trim(),
        category:     form.category,
        sourceName:   form.sourceName.trim(),
        sourceUrl:    form.sourceUrl.trim() || undefined,
        sourceType:   form.sourceType,
        anomalyScore: parseInt(form.anomalyScore, 10),
        tags:         tags.length > 0 ? tags : undefined,
      });

      if ('error' in result) {
        setError(`intake failed — ${result.error}`);
        return;
      }

      setForm(EMPTY);
      setSuccess(true);
      router.refresh();
      onSuccess?.();
    });
  }

  const scoreNum = parseInt(form.anomalyScore, 10);
  const scoreColor =
    !isNaN(scoreNum) && scoreNum >= 8 ? '#ff6b6b'
    : !isNaN(scoreNum) && scoreNum >= 6 ? '#d7a85c'
    : '#86d46e';

  const inputBase =
    'w-full border border-crt/18 bg-transparent px-3 py-2 font-mono text-[13px] tracking-[0.04em] text-crt/80 placeholder:text-crt/22 focus:border-crt/38 focus:outline-none';
  const labelBase =
    'mb-1 block text-[10px] uppercase tracking-[0.22em] text-crt/35';

  return (
    <form
      onSubmit={handleSubmit}
      className="space-y-5 border-t border-crt/10 bg-[rgba(134,212,110,0.012)] px-6 py-7 md:px-10 md:py-8"
    >
      <div className="mb-5 text-[11px] uppercase tracking-[0.24em] text-crt/38">
        manual signal intake · all fields summarize — do not copy verbatim text
      </div>

      {/* Title */}
      <div>
        <label className={labelBase}>title</label>
        <input
          type="text"
          value={form.title}
          onChange={set('title')}
          placeholder="descriptive signal title"
          maxLength={200}
          className={inputBase}
        />
      </div>

      {/* Summary */}
      <div>
        <label className={labelBase}>summary <span className="text-crt/22">— your words, not a paste</span></label>
        <textarea
          value={form.summary}
          onChange={set('summary')}
          placeholder="brief factual summary of the anomaly — what happened, why it matters, what corroborates it"
          rows={4}
          maxLength={2000}
          className={`${inputBase} resize-y`}
        />
      </div>

      {/* Category + Source Type row */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className={labelBase}>category</label>
          <select
            value={form.category}
            onChange={set('category')}
            className={`${inputBase} cursor-pointer`}
          >
            {CATEGORY_ORDER.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelBase}>source type</label>
          <select
            value={form.sourceType}
            onChange={set('sourceType')}
            className={`${inputBase} cursor-pointer`}
          >
            {SOURCE_TYPES.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Source name + URL row */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className={labelBase}>source name</label>
          <input
            type="text"
            value={form.sourceName}
            onChange={set('sourceName')}
            placeholder="e.g. r/Paranormal, AboveTopSecret"
            maxLength={200}
            className={inputBase}
          />
        </div>
        <div>
          <label className={labelBase}>source url <span className="text-crt/22">— optional</span></label>
          <input
            type="url"
            value={form.sourceUrl}
            onChange={set('sourceUrl')}
            placeholder="https://web.archive.org/..."
            maxLength={500}
            className={inputBase}
          />
        </div>
      </div>

      {/* Anomaly score + Tags row */}
      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <label className={labelBase}>
            anomaly score
            <span className="ml-2 tabular-nums" style={{ color: scoreColor }}>
              {form.anomalyScore}/10
            </span>
          </label>
          <input
            type="range"
            min={1}
            max={10}
            value={form.anomalyScore}
            onChange={set('anomalyScore')}
            className="w-full accent-crt"
          />
          <div className="mt-1 flex justify-between text-[10px] text-crt/22">
            <span>low signal</span>
            <span>high anomaly</span>
          </div>
        </div>
        <div>
          <label className={labelBase}>tags <span className="text-crt/22">— comma separated</span></label>
          <input
            type="text"
            value={form.tags}
            onChange={set('tags')}
            placeholder="ufo, abduction, triangular craft"
            maxLength={300}
            className={inputBase}
          />
        </div>
      </div>

      {/* Error / success */}
      {error && (
        <div className="text-[12px] uppercase tracking-[0.16em] text-[#ff6b6b]/80">
          › {error}
        </div>
      )}
      {success && (
        <div className="text-[12px] uppercase tracking-[0.16em] text-[#86d46e]/80">
          ✓ signal queued — pending curator review
        </div>
      )}

      {/* Submit */}
      <div className="pt-1">
        <button
          type="submit"
          disabled={isPending}
          className="border border-crt/25 px-5 py-2 text-[11px] uppercase tracking-[0.22em] text-crt/60 transition-colors hover:border-crt/42 hover:text-crt/85 disabled:cursor-not-allowed disabled:opacity-30"
        >
          {isPending ? '↯ queuing...' : '[ submit signal ]'}
        </button>
      </div>
    </form>
  );
}
