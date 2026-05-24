# SWIM — Supabase Security Notes

This document covers the anonymous-posting threat model for SWIM and the
mitigations already baked into the schema, plus outstanding items to address
before opening to real traffic.

---

## 1. Anonymous Posting Risks

SWIM allows any visitor to post threads and replies with no account.
That is intentional — it is the core design.  The risks are:

| Risk | Severity | Current mitigation |
|------|----------|--------------------|
| Spam / flooding | High | RLS input-length CHECK constraints; unique reaction fingerprint |
| Illegal content (CSAM, drugs, weapons) | Critical | Content policy in RLS CHECKs; moderation table; service-role-only reads |
| Doxxing / personal information | High | Moderation layer; `reports` table; no identity linking |
| Harassment / threats | High | Reports flow; admin `moderation_actions` table |
| SQL injection | Low | Supabase parameterized queries; no raw interpolation |
| RLS bypass | Medium | Service role key server-only; anon key is intentionally limited |
| Reaction spam (stuffing) | Medium | `anon_fingerprint` UNIQUE constraint per target/type/fingerprint |
| Coordinated brigading | Medium | Rate limiting (not yet implemented — see §4) |


## 2. Rate Limiting

**Not yet implemented.** Before opening to real traffic, add rate limiting at
one or more of these layers:

### Recommended approach — Supabase Edge Functions or Vercel middleware

```
// middleware.ts (Vercel)
// Limit /api/threads POST to 5 req / minute per IP using @upstash/ratelimit
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
```

Alternatively, enable **Supabase's built-in rate limiting** (Dashboard →
Settings → API → Rate Limits) which enforces per-IP limits on REST and
realtime connections.

Targets to rate-limit:
- `POST /api/threads` — max ~3 per hour per IP
- `POST /api/replies` — max ~10 per hour per IP
- `POST /api/reactions` — anon_fingerprint uniqueness already prevents double-voting; limit to ~20 reaction inserts per minute per IP anyway
- `POST /api/reports` — max ~5 per day per IP


## 3. Moderation Requirements

The `moderation_actions` table has no RLS for the `anon` role (no access).
Admin-level operations must use `SUPABASE_SERVICE_ROLE_KEY` — never expose
this key to the browser.

### Minimum viable moderation before launch

- [ ] Admin dashboard (internal, password-protected) reading `reports` via service role
- [ ] Thread/reply hide action writing to `moderation_actions`
- [ ] Automated keyword filter (word list matched at INSERT via Edge Function or CHECK)
- [ ] Email alert to admin when `reports.status = 'pending'` count exceeds threshold

### What moderators CANNOT do with anon key

Per RLS: anon users cannot UPDATE or DELETE any row.  Moderators must use
the service role key via a server-side admin panel.


## 4. Content Policy (enforced in RLS + community)

The following content is **not allowed** and will be removed:

- Instructions for illegal activity (hacking, fraud, drug synthesis, weapons)
- Doxxing or personally identifying information about real people
- Threats of violence or harassment targeting specific individuals
- Illegal content of any kind (CSAM, contraband, etc.)
- Spam, commercial advertising, or coordinated manipulation
- Extremist content promoting real-world harm

SWIM is for: stories, speculation, folklore, anonymous memory, weird internet
culture, and discussion.  It is **not** a marketplace, an operational security
forum, or a communications channel for illegal activity.

This policy should be surfaced to users in the UI (posting rules panel).


## 5. No Doxxing / Threats / Illegal Instructions

The schema's `reports.reason` enum includes `doxxing`, `illegal_content`, and
`harassment`.  These map to escalated moderation priority:

- `doxxing` → immediate hide + admin review
- `illegal_content` → immediate hide + admin review + possible platform report
- `harassment` → 24h review window


## 6. Spam Prevention

### Current
- RLS `WITH CHECK` constraints enforce minimum/maximum body length
- `anon_fingerprint` UNIQUE prevents reaction spam
- No anon UPDATE/DELETE prevents edit-based spam escalation

### Recommended additions
- **Cloudflare Turnstile** (preferred over reCAPTCHA — no tracking) on thread/reply submit
- **Honeypot field** in the post form (hidden input that bots fill, humans don't)
- **Edge Function keyword filter** rejecting posts with known spam patterns before INSERT


## 7. CAPTCHA / Turnstile Integration

When ready to add Turnstile:

1. Add Cloudflare Turnstile site key to `.env.local`:
   ```
   NEXT_PUBLIC_TURNSTILE_SITE_KEY=0x...
   ```
2. Add secret key server-side:
   ```
   TURNSTILE_SECRET_KEY=0x...
   ```
3. Render `<Turnstile siteKey={...} />` in `CreateThreadPanel` and reply composer
4. Validate token in a server action before calling `repository.createThread()`

Turnstile is invisible-first and degrades gracefully — no user friction unless
the score is low.


## 8. Admin Role Separation

| Role | Key | Access |
|------|-----|--------|
| Anonymous user | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Read everything; insert threads/replies/reactions/reports/ghosts |
| Server (read/write) | `NEXT_PUBLIC_SUPABASE_ANON_KEY` (server-side only) | Same as above, but from trusted infra |
| Admin / moderation | `SUPABASE_SERVICE_ROLE_KEY` | Full access, bypasses RLS; reads reports; writes moderation_actions |

**Never expose `SUPABASE_SERVICE_ROLE_KEY` in:**
- Client-side JavaScript
- `NEXT_PUBLIC_*` env vars
- Frontend components
- Logs

Store it only in server-side env vars (Vercel → Settings → Environment Variables,
restricted to Production + Preview).


## 9. Future Hardening Checklist

- [ ] Rate limiting (Upstash Redis + Vercel middleware)
- [ ] Turnstile on post/reply forms
- [ ] Keyword filter Edge Function
- [ ] Admin moderation dashboard (service-role, password-protected)
- [ ] Alerting on `reports` volume spikes
- [ ] Audit log for all `moderation_actions`
- [ ] Periodic review of RLS policies after schema changes
- [ ] Consider Supabase Vault for any future secrets stored in DB
- [ ] Enable Supabase audit logging (Dashboard → Settings → Logs)
