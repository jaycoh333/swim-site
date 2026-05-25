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

// When Supabase is configured, route to the new thread's slug page.
// In mock-fallback mode there is no real page, so go to the thread list.
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
  const [showTags, setShowTags] = useState(false);

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
      // Route to new thread if live; threads list in mock mode
      router.push(IS_LIVE ? `/threads/${result.id}` : '/threads');
    });
  }

  if (done) {
    return (
      <div className="panel overflow-hidden px-4 py-5 text-center">
        <div className="text-[10px] uppercase tracking-[0.3em] text-crt/45">
          ✓ thread archived
        </div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.22em] text-crt/30">
          routing to archive<span className="ml-1 blink">█</span>
        </div>
      </div>
    );
  }

  return (
    <div className="panel overflow-hidden">

      {/* Panel header */}
      <div className="flex items-center justify-between border-b border-crt/12 px-3 py-2">
        <span className="text-[13px] uppercase tracking-[0.22em] text-phosphor/68">
          Post New Thread
        </span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-crt/24">
          no account · ghost post
        </span>
      </div>

      <div className="space-y-3 p-3">

        {/* Identity selector — compact row */}
        <div className="flex flex-wrap items-center gap-2 text-[10px] uppercase tracking-[0.18em]">
          <span className="text-crt/28">as:</span>
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
            <span className="text-crt/38 ml-1 tracking-[0.12em]">{identity.handle}</span>
          )}
        </div>

        {/* Category + Title — always visible */}
        <div className="grid gap-2 md:grid-cols-[180px_1fr]">
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-[0.22em] text-crt/28">category</span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value as Category)}
              className="w-full border border-crt/16 bg-[rgba(4,8,6,.95)] px-2.5 py-1.5 text-[0.95rem] text-crt outline-none"
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-[0.22em] text-crt/28">title</span>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="thread title (min 4 chars)"
              className="w-full border border-crt/16 bg-[rgba(4,8,6,.95)] px-2.5 py-1.5 text-[0.95rem] text-crt outline-none placeholder:text-crt/20"
            />
          </label>
        </div>

        {/* Body — compact initially on mobile, expands on focus */}
        <label className="block space-y-1">
          <span className="text-[10px] uppercase tracking-[0.22em] text-crt/28">body</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="type anonymously... (min 10 chars · use > for greentext)"
            className="composer-textarea-adaptive"
          />
        </label>

        {/* Tags — collapsed on mobile, always visible on desktop */}
        <div>
          <button
            type="button"
            onClick={() => setShowTags((v) => !v)}
            className="flex w-full items-center justify-between py-1 text-[10px] uppercase tracking-[0.22em] text-crt/28 md:hidden"
          >
            <span>tags (optional)</span>
            <span className="text-crt/40">{showTags ? '−' : '+'}</span>
          </button>
          <span className="hidden text-[10px] uppercase tracking-[0.22em] text-crt/28 md:block">
            tags (optional, comma-separated)
          </span>
          <div className={showTags ? 'mt-1' : 'hidden md:block md:mt-1'}>
            <input
              value={tags}
              onChange={(e) => setTags(e.target.value)}
              placeholder="classified, signal, unknown"
              className="w-full border border-crt/16 bg-[rgba(4,8,6,.95)] px-2.5 py-1.5 text-[0.95rem] text-crt outline-none placeholder:text-crt/20"
            />
          </div>
        </div>

        {/* Terminal-style error */}
        {error && (
          <div className="border border-crt/15 bg-[rgba(40,10,10,0.6)] px-3 py-2 text-[11px] uppercase tracking-[0.2em] text-red-400/80">
            › error: {error}
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-crt/10 pt-2.5">
          <span className="text-[10px] uppercase tracking-[0.16em] text-crt/25">
            {IS_LIVE ? 'live · posts are real' : 'preview · no db'}
          </span>
          <button
            onClick={handleSubmit}
            disabled={isPending || !title.trim() || !body.trim()}
            className="pixel-btn px-4 py-1.5 text-crt/76 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {isPending ? 'posting...' : '[ queue thread ]'}
          </button>
        </div>
      </div>
    </div>
  );
}
