'use server';

/**
 * Server Actions — thin wrappers around the repository.
 *
 * Runs server-side so the service role key (when present) stays out of the
 * client bundle.  Falls back to mock data when Supabase env vars are absent.
 *
 * Import from client components directly — Next.js handles the RPC boundary.
 */

import {
  createThread,
  createReply,
  addReaction,
  reportContent,
  type CreateThreadInput,
  type CreateReplyInput,
  type AddReactionInput,
  type ReportContentInput,
} from '@/lib/supabase/repository';

export async function createThreadAction(
  input: CreateThreadInput,
): Promise<{ id: string } | { error: string }> {
  return createThread(input);
}

export async function createReplyAction(
  input: CreateReplyInput,
): Promise<{ id: string } | { error: string }> {
  return createReply(input);
}

export async function addReactionAction(
  input: AddReactionInput,
): Promise<{ ok: true } | { error: string }> {
  return addReaction(input);
}

// Reports are stored anonymously — no reporter identity is recorded.
// Admin review UI is a future phase; for now reports are visible directly in Supabase.
export async function reportContentAction(
  input: ReportContentInput,
): Promise<{ ok: true } | { error: string }> {
  return reportContent(input);
}
