'use client';

import { useState } from 'react';

import { Category, CreateThreadDraft } from '@/lib/forum-types';

interface CreateThreadPanelProps {
  draft: CreateThreadDraft;
  categories: readonly Category[];
}

export function CreateThreadPanel({ draft, categories }: CreateThreadPanelProps) {
  const [selectedCategory, setSelectedCategory] = useState<Category>(draft.category);

  return (
    <div className="panel overflow-hidden">
      <div className="flex items-center justify-between border-b border-crt/12 px-3 py-2">
        <span className="text-[13px] uppercase tracking-[0.22em] text-phosphor/68">
          Post New Thread
        </span>
        <span className="text-[10px] uppercase tracking-[0.2em] text-crt/24">
          ghost post
        </span>
      </div>

      <div className="space-y-3 p-3">
        <div className="grid gap-3 md:grid-cols-[180px_1fr]">
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-[0.22em] text-crt/28">category</span>
            <select
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value as Category)}
              className="w-full border border-crt/16 bg-[rgba(4,8,6,.95)] px-3 py-2 text-[0.98rem] text-crt outline-none"
            >
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-[0.22em] text-crt/28">title</span>
            <input
              defaultValue={draft.title}
              placeholder="thread title"
              className="w-full border border-crt/16 bg-[rgba(4,8,6,.95)] px-3 py-2 text-[0.98rem] text-crt outline-none placeholder:text-crt/20"
            />
          </label>
        </div>

        <label className="block space-y-1">
          <span className="text-[10px] uppercase tracking-[0.22em] text-crt/28">body</span>
          <textarea
            defaultValue={draft.body}
            rows={7}
            placeholder="type anonymously..."
            className="w-full resize-none border border-crt/16 bg-[rgba(4,8,6,.95)] px-3 py-2.5 text-[0.98rem] leading-relaxed text-crt outline-none placeholder:text-crt/20"
          />
        </label>

        <div className="grid gap-3 md:grid-cols-[1fr_200px]">
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-[0.22em] text-crt/28">optional tags</span>
            <input
              defaultValue={draft.tags.join(', ')}
              className="w-full border border-crt/16 bg-[rgba(4,8,6,.95)] px-3 py-2 text-[0.98rem] text-crt outline-none"
            />
          </label>

          <div className="space-y-1">
            <span className="text-[10px] uppercase tracking-[0.22em] text-crt/28">image upload</span>
            <div className="flex h-[40px] items-center justify-between border border-dashed border-crt/16 bg-[rgba(4,8,6,.95)] px-3 text-[0.98rem] text-crt/38">
              <span>placeholder only</span>
              <span>[ attach ]</span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-crt/10 pt-3 text-[10px] uppercase tracking-[0.18em] text-crt/28">
          <span>frontend architecture only | no email | optional passphrase later</span>
          <button className="pixel-btn px-4 py-1.5 text-crt/76">
            queue thread
          </button>
        </div>
      </div>
    </div>
  );
}
