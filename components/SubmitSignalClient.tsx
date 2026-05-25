'use client';

import { useState, useTransition } from 'react';
import { AmbientGrid } from '@/components/AmbientGrid';
import { NetworkFooter } from '@/components/NetworkFooter';
import { createPublicSignalAction } from '@/app/actions';
import { CATEGORY_ORDER } from '@/lib/forum-types';
import type { SignalSourceType } from '@/lib/supabase/types';

const SOURCE_TYPES: { value: SignalSourceType; label: string }[] = [
  { value: 'reddit',     label: 'Reddit / social media'  },
  { value: 'forum',      label: 'Old forum / phpBB / SMF' },
  { value: 'wayback',    label: 'Wayback / archive.org'  },
  { value: 'pastebin',   label: 'Paste archive'           },
  { value: 'imageboard', label: 'Imageboard (/x/, etc.)'  },
  { value: 'irc',        label: 'IRC / chat log'          },
  { value: 'other',      label: 'Other / unknown'         },
];

interface FormState {
  title:      string;
  summary:    string;
  category:   string;
  sourceName: string;
  sourceUrl:  string;
  sourceType: SignalSourceType;
  tags:       string;
  _hp:        string; // honeypot — always stays empty for real users
}

const EMPTY: FormState = {
  title:      '',
  summary:    '',
  category:   'Paranormal',
  sourceName: '',
  sourceUrl:  '',
  sourceType: 'other',
  tags:       '',
  _hp:        '',
};

function validate(f: FormState): string | null {
  if (f.title.trim().length < 8)     return 'title must be at least 8 characters';
  if (f.title.trim().length > 200)   return 'title is too long (200 char max)';
  if (f.summary.trim().length < 40)  return 'summary must be at least 40 characters';
  if (f.summary.trim().length > 2000) return 'summary is too long (2000 char max)';
  if (!f.category)                   return 'category is required';
  if (f.sourceName.trim().length < 2) return 'source name is required';
  if (f.sourceUrl.trim() && !f.sourceUrl.trim().startsWith('http')) {
    return 'source URL must start with http:// or https://';
  }
  return null;
}

const inputBase =
  'w-full border border-crt/18 bg-transparent px-3 py-2.5 font-mono text-[13px] tracking-[0.04em] text-crt/80 placeholder:text-crt/22 focus:border-crt/38 focus:outline-none transition-colors';
const labelBase =
  'mb-1.5 block text-[10px] uppercase tracking-[0.22em] text-crt/40';

export function SubmitSignalClient() {
  const [isPending, startTransition] = useTransition();
  const [form, setForm]     = useState<FormState>(EMPTY);
  const [fieldError, setFieldError] = useState<string | null>(null);
  const [submitted, setSubmitted]   = useState(false);

  function set(field: keyof FormState) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
      setForm((f) => ({ ...f, [field]: e.target.value }));
      setFieldError(null);
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    const err = validate(form);
    if (err) { setFieldError(err); return; }

    startTransition(async () => {
      const tags = form.tags
        .split(',')
        .map((t) => t.trim().toLowerCase())
        .filter(Boolean);

      const result = await createPublicSignalAction({
        title:      form.title.trim(),
        summary:    form.summary.trim(),
        category:   form.category,
        sourceName: form.sourceName.trim(),
        sourceUrl:  form.sourceUrl.trim() || undefined,
        sourceType: form.sourceType,
        tags:       tags.length > 0 ? tags : undefined,
        _hp:        form._hp,
      });

      if ('error' in result) {
        setFieldError(`submission failed — ${result.error}`);
        return;
      }

      setSubmitted(true);
      setForm(EMPTY);
    });
  }

  if (submitted) {
    return (
      <div className="relative min-h-screen overflow-hidden pb-[72px] pt-[80px] md:pb-8 md:pt-[100px]">
        <AmbientGrid className="pointer-events-none absolute inset-0 opacity-20" />
        <div className="relative z-10 mx-auto max-w-2xl px-4 py-4 md:px-6 md:py-6">
          <div className="forum-shell overflow-hidden">
            <div className="px-6 py-16 text-center md:px-10 md:py-20">
              <div className="mb-3 text-[11px] uppercase tracking-[0.30em] text-crt/35">
                transmission received
              </div>
              <h2 className="mb-5 text-[1.8rem] tracking-[0.10em] text-crt md:text-[2.2rem]">
                SIGNAL QUEUED
              </h2>
              <p className="mb-8 max-w-md mx-auto text-[1rem] leading-relaxed tracking-[0.04em] text-crt/55">
                Your signal is pending curator review. If it contains a genuine anomaly,
                it will enter the archive under the relevant channel.
              </p>
              <div className="mb-10 border border-crt/12 bg-[rgba(134,212,110,0.018)] px-5 py-4 text-left font-mono text-[11px] leading-relaxed tracking-[0.06em] text-crt/38">
                <div>status          ··· PENDING</div>
                <div>anomaly score   ··· assessed by curator</div>
                <div>next step       ··· human review</div>
                <div>publish         ··· curator decision only</div>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
                <button
                  onClick={() => setSubmitted(false)}
                  className="create-thread-cta"
                >
                  [ submit another signal ]
                </button>
                <a href="/scanner" className="create-thread-cta">
                  [ return to scanner ]
                </a>
              </div>
            </div>
            <NetworkFooter />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen overflow-hidden pb-[72px] pt-[80px] md:pb-8 md:pt-[100px]">
      <AmbientGrid className="pointer-events-none absolute inset-0 opacity-20" />

      <div className="relative z-10 mx-auto max-w-2xl px-4 py-4 md:px-6 md:py-6">
        <div className="forum-shell overflow-hidden">

          {/* ── Header ── */}
          <div className="border-b border-crt/12 px-6 py-8 md:px-10 md:py-10">
            <div className="mb-2 text-[11px] uppercase tracking-[0.30em] text-crt/38">
              swim · recovered signals
            </div>
            <h1 className="text-[1.8rem] tracking-[0.10em] text-crt md:text-[2.2rem]">
              SUBMIT FOUND SIGNAL
            </h1>
            <p className="mt-3 max-w-xl text-[1.05rem] leading-relaxed tracking-[0.04em] text-crt/60">
              Submit a strange thread, archive fragment, old forum post, or impossible story.
              Curators review all submissions before anything enters the archive.
            </p>
          </div>

          {/* ── Safety notice ── */}
          <div className="border-b border-crt/10 bg-[rgba(134,212,110,0.018)] px-6 py-5 md:px-10">
            <div className="grid gap-2 text-[11px] uppercase tracking-[0.16em] text-crt/38 sm:grid-cols-2">
              <div>◈ summaries only — do not paste full copyrighted text</div>
              <div>◈ no real names, addresses, or personal information</div>
              <div>◈ no illegal instructions or harmful content</div>
              <div>◈ all signals are pending until a curator reviews them</div>
            </div>
          </div>

          {/* ── Form ── */}
          <form onSubmit={handleSubmit} className="px-6 py-8 md:px-10 md:py-10">
            {/* Honeypot — hidden from real users, filled by bots */}
            <div aria-hidden="true" className="absolute opacity-0 pointer-events-none" style={{ left: '-9999px', top: '-9999px' }}>
              <label htmlFor="website">Website</label>
              <input
                id="website"
                type="text"
                name="website"
                value={form._hp}
                onChange={set('_hp')}
                tabIndex={-1}
                autoComplete="off"
              />
            </div>

            <div className="space-y-6">
              {/* Title */}
              <div>
                <label htmlFor="signal-title" className={labelBase}>
                  title <span className="text-crt/22">— 8 chars min</span>
                </label>
                <input
                  id="signal-title"
                  type="text"
                  value={form.title}
                  onChange={set('title')}
                  placeholder="brief descriptive title for the anomaly"
                  maxLength={200}
                  className={inputBase}
                />
              </div>

              {/* Summary */}
              <div>
                <label htmlFor="signal-summary" className={labelBase}>
                  summary{' '}
                  <span className="text-crt/22">— your words, not a verbatim paste · 40 chars min</span>
                </label>
                <textarea
                  id="signal-summary"
                  value={form.summary}
                  onChange={set('summary')}
                  placeholder="describe the anomaly: what happened, where it was found, what makes it strange. be specific."
                  rows={5}
                  maxLength={2000}
                  className={`${inputBase} resize-y`}
                />
                <div className="mt-1 flex justify-end text-[10px] tracking-[0.10em] text-crt/22">
                  {form.summary.length}/2000
                </div>
              </div>

              {/* Category + Source type */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="signal-category" className={labelBase}>category</label>
                  <select
                    id="signal-category"
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
                  <label htmlFor="signal-source-type" className={labelBase}>source type</label>
                  <select
                    id="signal-source-type"
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

              {/* Source name + URL */}
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="signal-source-name" className={labelBase}>
                    where did you find it
                  </label>
                  <input
                    id="signal-source-name"
                    type="text"
                    value={form.sourceName}
                    onChange={set('sourceName')}
                    placeholder="e.g. r/Paranormal, AboveTopSecret, Wayback"
                    maxLength={200}
                    className={inputBase}
                  />
                </div>
                <div>
                  <label htmlFor="signal-source-url" className={labelBase}>
                    source url <span className="text-crt/22">— optional</span>
                  </label>
                  <input
                    id="signal-source-url"
                    type="url"
                    value={form.sourceUrl}
                    onChange={set('sourceUrl')}
                    placeholder="https://web.archive.org/..."
                    maxLength={500}
                    className={inputBase}
                  />
                </div>
              </div>

              {/* Tags */}
              <div>
                <label htmlFor="signal-tags" className={labelBase}>
                  tags <span className="text-crt/22">— optional · comma separated</span>
                </label>
                <input
                  id="signal-tags"
                  type="text"
                  value={form.tags}
                  onChange={set('tags')}
                  placeholder="ufo, triangular craft, multiple witnesses"
                  maxLength={300}
                  className={inputBase}
                />
              </div>

              {/* Error */}
              {fieldError && (
                <div className="text-[12px] uppercase tracking-[0.16em] text-[#ff6b6b]/80">
                  › {fieldError}
                </div>
              )}

              {/* Submit */}
              <div className="flex items-center justify-between gap-4 pt-2">
                <p className="text-[10px] uppercase tracking-[0.16em] text-crt/25">
                  signal enters pending queue · curator review required
                </p>
                <button
                  type="submit"
                  disabled={isPending}
                  className="shrink-0 border border-crt/25 px-5 py-2.5 text-[11px] uppercase tracking-[0.22em] text-crt/60 transition-colors hover:border-crt/42 hover:text-crt/85 disabled:cursor-not-allowed disabled:opacity-30"
                >
                  {isPending ? '↯ transmitting...' : '[ transmit signal ]'}
                </button>
              </div>
            </div>
          </form>

          <NetworkFooter />
        </div>
      </div>
    </div>
  );
}
