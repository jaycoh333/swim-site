'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { Category, CreateThreadDraft } from '@/lib/forum-types';
import { useIdentity } from '@/lib/identity';
import { createThreadAction } from '@/app/actions';

interface CreateThreadPanelProps {
  draft: CreateThreadDraft;
  categories: readonly Category[];
}

const IS_LIVE = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
);

export function CreateThreadPanel({ draft, categories }: CreateThreadPanelProps) {
  const router = useRouter();
  const { identity, setMode } = useIdentity();
  const [isPending, startTransition] = useTransition();

  const [category, setCategory] = useState<Category>(draft.category);
  const [title, setTitle] = useState(draft.title);
  const [body, setBody] = useState(draft.body);
  const [tags, setTags] = useState(draft.tags.join(', '));
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  function validate(): string | null {
    if (title.trim().length < 4) return 'title must be at least 4 characters';
    if (body.trim().length < 10) return 'body must be at least 10 characters';
    if (!identity) return 'identity not loaded — refresh and try again';
    return null;
  }

  function handleSubmit() {
    const validationError = validate();
    if (validationError) { setError(validationError); return; }
    if (isPending || done) return;

    setError(null);

    const parsedTags = tags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    startTransition(async () => {
      const result = await createThreadAction({
        title:        title.trim(),
        body:         body.trim(),
        category,
        authorHandle: identity!.handle,
        authorMode:   identity!.mode,
        tags:         parsedTags,
      });

      if ('error' in result) {
        setError(result.error);
        return;
      }

      setDone(true);
      router.push(IS_LIVE ? `/threads/${result.id}` : '/threads');
    });
  }

  if (done) {
    return (
      <div className="panel overflow-hidden px-4 py-6 text-center">
        <div className="text-[14px] uppercase tracking-[0.28em] text-crt/72">
          ✓ thread archived
        </div>
        <div className="mt-2 text-[12px] uppercase tracking-[0.20em] text-crt/42">
          routing to archive<span className="ml-1 blink">█</span>
        </div>
      </div>
    );
  }

  const canPost = title.trim().length >= 4 && body.trim().length >= 10;

  return (
    <div className="panel overflow-hidden">

      {/* Panel header */}
      <div className="flex items-center justify-between border-b border-crt/12 px-4 py-2.5">
        <span className="text-[14px] uppercase tracking-[0.20em] text-crt/80">
          New Thread
        </span>
        <span className="text-[12px] uppercase tracking-[0.16em] text-crt/35">
          {IS_LIVE ? 'live · real post' : 'preview'}
        </span>
      </div>

      <div className="space-y-3 p-3 md:p-4">

        {/* ── Core fields — always visible ── */}

        {/* Category — full-width on mobile for easy tap */}
        <label className="block space-y-1.5">
          <span className="text-[12px] uppercase tracking-[0.20em] text-crt/48">category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as Category)}
            className="compose-select w-full"
          >
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </label>

        {/* Title */}
        <label className="block space-y-1.5">
          <span className="text-[12px] uppercase tracking-[0.20em] text-crt/48">title</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="thread title..."
            className="compose-input w-full"
          />
        </label>

        {/* Body */}
        <label className="block space-y-1.5">
          <span className="text-[12px] uppercase tracking-[0.20em] text-crt/48">body</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="type anonymously... use > for greentext · ctrl+enter to post"
            className="composer-textarea-adaptive"
          />
        </label>

        {/* ── Error ── */}
        {error && (
          <div className="border border-red-900/40 bg-[rgba(40,10,10,0.6)] px-3 py-2.5 text-[12px] uppercase tracking-[0.18em] text-red-400/80">
            › {error}
          </div>
        )}

        {/* ── Submit — full-width on mobile ── */}
        <button
          onClick={handleSubmit}
          disabled={isPending || !canPost}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleSubmit(); }}
          className="compose-submit-btn w-full md:w-auto md:ml-auto md:block"
        >
          {isPending ? '↯ posting...' : '[ post thread ]'}
        </button>

        {/* ── Advanced options toggle ── */}
        <div className="border-t border-crt/10 pt-2.5">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex w-full items-center gap-2 text-[12px] uppercase tracking-[0.18em] text-crt/35 hover:text-crt/58 transition-colors"
          >
            <span>{showAdvanced ? '▾' : '▸'}</span>
            <span>archive options</span>
            <div className="h-px flex-1 bg-crt/10" />
          </button>

          {showAdvanced && (
            <div className="mt-3 space-y-3">

              {/* Identity selector */}
              <div className="space-y-1.5">
                <span className="text-[12px] uppercase tracking-[0.18em] text-crt/40">posting as</span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => setMode('anon')}
                    className={`composer-mode-btn ${identity?.mode === 'anon' ? 'active' : ''}`}
                  >
                    [ anon ]
                  </button>
                  <button
                    onClick={() => setMode('ghost')}
                    className={`composer-mode-btn ${identity?.mode === 'ghost' ? 'active' : ''}`}
                  >
                    [ ghost ]
                  </button>
                  {identity && (
                    <span className="text-[12px] tracking-[0.12em] text-crt/45 ml-1">
                      {identity.handle}
                    </span>
                  )}
                </div>
              </div>

              {/* Tags */}
              <label className="block space-y-1.5">
                <span className="text-[12px] uppercase tracking-[0.18em] text-crt/40">
                  tags (optional, comma-separated)
                </span>
                <input
                  value={tags}
                  onChange={(e) => setTags(e.target.value)}
                  placeholder="classified, signal, unknown"
                  className="compose-input w-full"
                />
              </label>

            </div>
          )}
        </div>

      </div>
    </div>
  );
}
