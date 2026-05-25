# SWIM Social Automation Plan

> Status: Prep phase. No live API calls. No auto-posting.
> Human approval is mandatory at every stage. This document defines the
> architecture so it can be implemented incrementally without surprises.

---

## Current State (as of this phase)

The publish-to-thread flow is live:
1. Curator reviews a recovered signal at `/scanner/queue`
2. Curator clicks `[ publish to thread ]`
3. A SWIM thread is created with `author_handle='ARCHIVIST'`
4. The signal is stamped with `published_thread_id` and `status='approved'`
5. A share package (Telegram copy + X copy) appears in the queue UI

**What is not yet automated:**
- No post is sent to Telegram automatically
- No post is sent to X automatically
- No API keys are wired in
- `postToTelegram()` and `postToX()` are stubs only

---

## Environment Variables Required

Add these to `.env.local` when you are ready to wire real posting.
None of these are required until Phase 2/3 below.

```
# Telegram
TELEGRAM_BOT_TOKEN=        # from @BotFather — format: 123456:ABC-xyz...
TELEGRAM_CHANNEL_ID=       # channel username (@swim_signals) or numeric ID

# X (Twitter) API v2 — OAuth 1.0a app-only
X_API_KEY=                 # Consumer Key
X_API_SECRET=              # Consumer Secret
X_ACCESS_TOKEN=            # Access Token (read+write)
X_ACCESS_SECRET=           # Access Token Secret
```

**Security rules:**
- These are server-only env vars. Never reference them in client components.
- Never commit `.env.local` to git.
- The X credentials need "Read and Write" permissions in the developer portal.
- The Telegram bot must be added as an admin of the target channel.

---

## Post Format Spec

Formatters live in `lib/social-formatters.ts`. They are pure functions with no
side effects — safe to call in the browser for preview generation.

### Telegram format

No hard character limit. Aim for under 500 chars for readability.

```
RECOVERED SIGNAL // [CATEGORY]

"[title]"

[summary, truncated to 200 chars if needed]...

Source: [source_name]
Anomaly score: [score]/10

Read the archive: https://www.sw1m.me/threads/[slug]
```

Tags (if present) appended as hashtag-free labels:
```
─ [tag1] · [tag2] · [tag3]
```

### X format

Hard limit: 280 characters. URL counts as ~23 chars (t.co wrapping), but
the formatter counts the full URL to stay conservative.

```
RECOVERED SIGNAL // [CATEGORY]

"[title, truncated if needed]"

sw1m.me/threads/[slug]
```

No hashtags by default. They can be added manually before posting if
the content warrants them.

---

## Architecture

```
lib/social-formatters.ts    ← pure, client-safe, no API calls
lib/social-poster.ts        ← server-only, stubs now → real API calls later
app/actions.ts              ← server actions wrapping poster functions
components/SignalQueueClient.tsx  ← share package preview (uses formatters)
```

Data flow (current):
```
curator clicks [ publish to thread ]
  → publishSignalAsThreadAction (server)
  → thread created in Supabase
  → signal.published_thread_id stamped
  → share package computed client-side (formatters only)
  → curator manually copies and posts
```

Data flow (Phase 3 — future):
```
curator clicks [ approve + auto-post ]
  → publishSignalAsThreadAction (server)
  → postToTelegramAction (server) ← calls real Telegram API
  → postToXAction (server) ← calls real X API v2
  → curator sees confirmation with post IDs
```

---

## Implementation Phases

### Phase 1 — Manual sharing (current)
- Share package preview in queue UI ✓
- Curator copies text and posts manually ✓
- Formatters live in `lib/social-formatters.ts` ✓
- `postToTelegram` / `postToX` are stubs ✓

### Phase 2 — Telegram bot
**Prerequisites:** `TELEGRAM_BOT_TOKEN` + `TELEGRAM_CHANNEL_ID` set in production

Steps:
1. Implement `postToTelegram(text)` in `lib/social-poster.ts`:
   - `POST https://api.telegram.org/bot{token}/sendMessage`
   - Body: `{ chat_id: CHANNEL_ID, text, parse_mode: 'HTML' }`
2. Add `postToTelegramAction(signalId)` to `app/actions.ts`
3. Add `[ post to telegram ]` button in queue UI (separate from publish)
4. Store `telegram_posted_at` on the signal row (schema migration required)
5. Test with a private channel before posting to the public channel

**Do NOT:**
- Auto-post on publish. Keep them separate buttons.
- Post without the curator reviewing the formatted text first.

### Phase 3 — X auto-post
**Prerequisites:** X API v2 credentials with "Read and Write" permissions

Steps:
1. Implement `postToX(text)` in `lib/social-poster.ts`:
   - `POST https://api.twitter.com/2/tweets`
   - OAuth 1.0a signing (use `oauth-1.0a` or `twitter-api-v2` package)
   - Body: `{ text }`
2. Add `postToXAction(signalId)` to `app/actions.ts`
3. Add `[ post to x ]` button in queue UI
4. Store `x_posted_at` on signal row (schema migration required)

**Character limit enforcement:**
- `formatXPost` hard-truncates to 280 chars
- Warn in UI if the thread title is long enough to trigger truncation

### Phase 4 — Approval queue bot (optional, high effort)
A Telegram bot that sends the share preview to a private curator channel
with `[ approve ]` / `[ skip ]` inline keyboard buttons.
This replaces the web queue UI with a mobile-first approval flow.
Not planned until Phase 2/3 are proven to work reliably.

---

## Safety Constraints (non-negotiable)

1. No post goes out without a human having read the signal
2. No automated post on publish — always a separate explicit action
3. No doxxing, no real identities, no illegal content in any post
4. Telegram bot token never touches client code
5. X credentials never touch client code
6. Every post links back to SWIM, never to external raw sources
7. If a post fails, it fails silently (log + UI error) — never retries automatically

---

*This file lives at `docs/social-automation-plan.md` and is not served to users.*
