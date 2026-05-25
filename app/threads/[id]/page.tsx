import { THREAD_SEED } from '@/lib/seed-data';
import { ThreadView } from '@/components/ThreadView';
import { getThread, getReplies } from '@/lib/supabase/repository';

/**
 * Allow on-demand SSR for thread slugs not in the initial seed.
 * Static pages for the 16 seed threads are still pre-built at deploy time.
 * New threads created via Supabase get a server-rendered page on first visit.
 */
export const dynamicParams = true;

export function generateStaticParams() {
  return THREAD_SEED.map((t) => ({ id: t.id }));
}

type Params = Promise<{ id: string }>;

export default async function ThreadPage({ params }: { params: Params }) {
  const { id } = await params;

  // Load from repository — uses Supabase when configured, mockDb otherwise.
  // Results are passed as props so ThreadView doesn't need a client-side fetch.
  const [thread, replies] = await Promise.all([
    getThread(id),
    getReplies(id),
  ]);

  return (
    <ThreadView
      threadId={id}
      initialThread={thread}
      initialReplies={replies}
    />
  );
}
