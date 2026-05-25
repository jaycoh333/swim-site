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
  updateSignalStatus,
  publishSignalAsThread,
  type CreateThreadInput,
  type CreateReplyInput,
  type AddReactionInput,
  type ReportContentInput,
  type UpdateSignalStatusInput,
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

// Curator action — approve, archive, or reject a recovered signal.
// Requires service role key (env: SUPABASE_SERVICE_ROLE_KEY).
// TELEGRAM / X INTEGRATION POINT:
//   When status='approved', a future webhook or cron reads the signal and
//   queues it for the Telegram/X posting pipeline.
//   Human approval here is the mandatory gate before any public post goes out.
export async function updateSignalStatusAction(
  input: UpdateSignalStatusInput,
): Promise<{ ok: true } | { error: string }> {
  return updateSignalStatus(input);
}

// Curator action — publish a recovered signal as a SWIM thread.
// Creates the thread, then stamps the signal with the thread UUID and
// sets status='approved'. Prevents duplicate publishing.
//
// HUMAN APPROVAL GATE:
//   Nothing calls this automatically. A curator must click [ publish to thread ]
//   in /scanner/queue for this to run.
//
// TELEGRAM / X INTEGRATION POINT:
//   After a signal is published, the growth workflow (docs/growth-playbook.md)
//   describes how to share the resulting thread on Telegram/X.
//   Automated sharing is a future phase; this action does not trigger it.
export async function publishSignalAsThreadAction(
  signalId: string,
): Promise<{ threadSlug: string } | { error: string }> {
  return publishSignalAsThread(signalId);
}
