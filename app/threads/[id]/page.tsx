import { THREAD_SEED } from '@/lib/seed-data';
import { ThreadView } from '@/components/ThreadView';
import { getThread, getReplies, getRelatedThreads } from '@/lib/supabase/repository';

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

  const thread = await getThread(id);
  const [replies, related] = await Promise.all([
    getReplies(id),
    getRelatedThreads(thread?.category ?? '', id, 5),
  ]);

  return (
    <ThreadView
      threadId={id}
      initialThread={thread}
      initialReplies={replies}
      relatedThreads={related}
    />
  );
}
