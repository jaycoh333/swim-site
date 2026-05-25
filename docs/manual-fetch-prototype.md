# SWIM Manual Fetch Prototype

Safe, single-page fetch for curator-supervised signal recovery.

**Status:** Prototype — manual, one page at a time, no automation.

---

## What this does

When a curator clicks **↯ fetch** on an enabled source in `/scanner/sources`:

1. The server fetches `source.base_url` once — no link following, no crawl.
2. The server extracts:
   - Page title (prefers `og:title`, fallback `<title>`)
   - Meta description (prefers `og:description`, fallback `meta[name=description]`)
   - Canonical URL (from `<link rel="canonical">` if present)
   - First ~400 characters of readable text (scripts/styles stripped)
3. Raw HTML is **discarded immediately** — never written to any database.
4. A `recovered_signals` row is inserted with `status='pending'`.
5. `last_scanned_at` is stamped on the source registry entry.
6. The curator sees a success panel with the queued signal title and a "view in queue →" link.

---

## Hard limits

| Constraint | Value |
|---|---|
| Pages per click | 1 (base_url only) |
| Link following | None |
| Crawl depth | 0 |
| Stored HTML | None |
| Max HTML processed | 100 KB (rest discarded) |
| Request timeout | 12 seconds |
| Output stored | title, description, canonical URL, ~400-char snippet |
| Signal status | always `pending` — curator must review |
| Auto-publish | Never |

---

## Safety requirements before fetching

A source can only be fetched if:

- `enabled = true` (curator must explicitly toggle in registry)
- `base_url` is set
- The curator manually clicks ↯ fetch — nothing is automated

---

## What the pending signal contains

| Field | Value |
|---|---|
| `title` | Extracted page title (max 200 chars) |
| `summary` | Meta description or text snippet (max 2000 chars) |
| `source_name` | Registry source name |
| `source_url` | Canonical URL or base_url |
| `source_type` | Mapped from registry source_type |
| `category` | `source.category_focus[0]` or `Internet Lore` |
| `anomaly_score` | 5 (curator sets the real score during review) |
| `tags` | `['scanner-source', source_type]` |
| `status` | `pending` |

The curator should review and edit all fields in `/scanner/queue` before publishing.

---

## What NOT to do

- Do not add cron jobs or scheduled tasks that call `fetchScannerSourceAction`
- Do not extend this to follow links or crawl multiple pages
- Do not store raw HTML in any database column
- Do not auto-approve signals created by this path
- Do not remove the `enabled` check — it is the gate that stops blind scanning
- Do not use this on high-risk sources (risk_level='high') without curator oversight

---

## Phase 3 — next steps (future, not built yet)

When the manual prototype is validated:

1. **Targeted URL fetch** — curator pastes a specific URL from a source (not just base_url)
2. **Archive search** — query Wayback CDX API for snapshots of a source domain
3. **Feed/sitemap scanning** — parse RSS/Atom feeds or sitemaps for new entries
4. **Batch cadence** — run a registered source on its `refresh_cadence` schedule (daily/weekly)
5. **Dedup check** — before inserting, check if a signal with the same URL already exists

Each phase requires explicit decision + curator review gates remain mandatory.

---

## User-Agent policy

All fetches use:

```
User-Agent: SWIM-Archive-Scout/1.0 (human-curator-supervised; research archive)
```

This identifies the bot honestly. Do not change it to impersonate a browser.
If a site blocks this UA, the curator should add that site's content via the manual intake form (`/scanner/queue`) instead.
