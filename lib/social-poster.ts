/**
 * social-poster.ts — stub posting functions for Telegram and X.
 *
 * SERVER ONLY — imports env vars. Never import from client components.
 *
 * No live API calls are made yet. Env vars are read but not used.
 * Functions return { error: 'not implemented' } in all cases.
 *
 * See docs/social-automation-plan.md for the full integration plan.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * TELEGRAM INTEGRATION POINT (Phase 2):
 *   Implement postToTelegram() using:
 *   - TELEGRAM_BOT_TOKEN (env var)
 *   - TELEGRAM_CHANNEL_ID (env var)
 *   - Endpoint: POST https://api.telegram.org/bot{token}/sendMessage
 *   - Body: { chat_id, text, parse_mode: 'HTML' }
 *
 * X INTEGRATION POINT (Phase 3):
 *   Implement postToX() using:
 *   - X_API_KEY, X_API_SECRET, X_ACCESS_TOKEN, X_ACCESS_SECRET (env vars)
 *   - Endpoint: POST https://api.twitter.com/2/tweets
 *   - Auth: OAuth 1.0a (use twitter-api-v2 package or oauth-1.0a)
 *   - Body: { text }
 * ─────────────────────────────────────────────────────────────────────────
 *
 * HUMAN APPROVAL GATE:
 *   These functions must never be called automatically on thread publish.
 *   They require an explicit curator action. See app/actions.ts.
 */

// ---------------------------------------------------------------------------
// Env var references (server-only)
// ---------------------------------------------------------------------------

const TELEGRAM_BOT_TOKEN   = process.env.TELEGRAM_BOT_TOKEN   ?? '';
const TELEGRAM_CHANNEL_ID  = process.env.TELEGRAM_CHANNEL_ID  ?? '';
const X_API_KEY            = process.env.X_API_KEY             ?? '';
const X_API_SECRET         = process.env.X_API_SECRET         ?? '';
const X_ACCESS_TOKEN       = process.env.X_ACCESS_TOKEN       ?? '';
const X_ACCESS_SECRET      = process.env.X_ACCESS_SECRET      ?? '';

export const hasTelegramConfig = Boolean(TELEGRAM_BOT_TOKEN && TELEGRAM_CHANNEL_ID);
export const hasXConfig        = Boolean(X_API_KEY && X_API_SECRET && X_ACCESS_TOKEN && X_ACCESS_SECRET);

// ---------------------------------------------------------------------------
// Telegram — stub
// ---------------------------------------------------------------------------

export interface TelegramResult {
  ok:        true;
  messageId: number;
}

/**
 * Post a pre-formatted text message to the configured Telegram channel.
 *
 * STUB — returns { error: 'not implemented' } until Phase 2 is wired.
 *
 * Phase 2 implementation:
 *   const res = await fetch(
 *     `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
 *     {
 *       method:  'POST',
 *       headers: { 'Content-Type': 'application/json' },
 *       body:    JSON.stringify({ chat_id: TELEGRAM_CHANNEL_ID, text }),
 *     }
 *   );
 *   const json = await res.json();
 *   if (!json.ok) return { error: json.description };
 *   return { ok: true, messageId: json.result.message_id };
 */
export async function postToTelegram(
  text: string,
): Promise<TelegramResult | { error: string }> {
  if (!hasTelegramConfig) {
    return { error: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHANNEL_ID not set' };
  }

  // TELEGRAM INTEGRATION POINT — replace this stub with the fetch call above
  console.log('[social-poster] postToTelegram stub called — not implemented');
  console.log('[social-poster] channel:', TELEGRAM_CHANNEL_ID);
  console.log('[social-poster] text preview:', text.slice(0, 80));

  return { error: 'not implemented — see docs/social-automation-plan.md Phase 2' };
}

// ---------------------------------------------------------------------------
// X (Twitter) — stub
// ---------------------------------------------------------------------------

export interface XPostResult {
  ok:     true;
  tweetId: string;
}

/**
 * Post a pre-formatted tweet to the configured X account.
 *
 * STUB — returns { error: 'not implemented' } until Phase 3 is wired.
 *
 * Phase 3 implementation (using twitter-api-v2 package):
 *   import { TwitterApi } from 'twitter-api-v2';
 *   const client = new TwitterApi({
 *     appKey:         X_API_KEY,
 *     appSecret:      X_API_SECRET,
 *     accessToken:    X_ACCESS_TOKEN,
 *     accessSecret:   X_ACCESS_SECRET,
 *   });
 *   const { data } = await client.v2.tweet(text);
 *   return { ok: true, tweetId: data.id };
 *
 * Character limit: 280 chars. Use formatXPost() from social-formatters.ts
 * to pre-format; it hard-truncates to fit.
 */
export async function postToX(
  text: string,
): Promise<XPostResult | { error: string }> {
  if (!hasXConfig) {
    return { error: 'X API credentials not set (X_API_KEY / X_API_SECRET / X_ACCESS_TOKEN / X_ACCESS_SECRET)' };
  }

  if (text.length > 280) {
    return { error: `text exceeds 280 chars (${text.length}) — use formatXPost() to truncate` };
  }

  // X INTEGRATION POINT — replace this stub with the TwitterApi call above
  console.log('[social-poster] postToX stub called — not implemented');
  console.log('[social-poster] char count:', text.length);
  console.log('[social-poster] text preview:', text.slice(0, 80));

  return { error: 'not implemented — see docs/social-automation-plan.md Phase 3' };
}
