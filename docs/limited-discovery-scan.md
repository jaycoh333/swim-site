# Limited Discovery Scan

A controlled, curator-supervised feature that discovers a small number of candidate links from an already-registered source page.

## What it does

1. Fetches the source's `base_url` (same single-page fetch as the manual session).
2. Extracts anchor `<a href>` links from the page HTML.
3. Filters for links that match content-related keywords (story, experience, thread, report, sighting, etc.).
4. Returns up to **5** candidate URLs — no more, never recursive.
5. Curator reviews each discovered link and clicks **Fetch Preview** to pull metadata for any that look interesting.
6. Curator edits the preview and clicks **Queue Candidate** — only then is anything written to the database.

## Hard limits

| Limit | Value |
|---|---|
| Max links returned | 5 |
| Recursion depth | 0 — source page only, never follows discovered links automatically |
| Domain scope | Same hostname as `base_url`, unless source type is `archive` / `wayback` |
| Scheduling | None — curator must click Discover Links manually |
| DB writes | Zero until curator clicks Queue Candidate |
| Raw HTML stored | Never |

## Keyword match list

Links are scored by checking URL path + link text against:

`story`, `experience`, `thread`, `report`, `archive`, `forum`, `sighting`, `dream`, `glitch`, `lost`, `encounter`, `witness`, `strange`, `anomaly`, `paranormal`, `ufo`, `case`, `incident`, `found`, `missing`, `secret`, `hidden`, `recovered`

For `archive` / `wayback` source types, the keyword filter is relaxed and all same-origin links are included (since archive URLs embed the original domain in the path).

## Safety design

- No automatic or scheduled invocation.
- No cross-domain fetches (for non-archive sources).
- No link-following after the first page — discovering a link does **not** fetch it; that requires a separate explicit Fetch Preview click.
- No binary or media stored — only metadata extracted from HTML head tags.
- Curator sees and edits every candidate before anything enters the queue.
- All signals created via this flow enter `status='pending'` and require full curator review before rebirth.

## Flow diagram

```
Curator clicks [ Discover Links ]
  → discoverSourceLinksAction(sourceId)
      → fetch base_url (1 page, timeout 12s)
      → extract <a> links
      → same-domain filter
      → keyword filter
      → return max 5 links (no DB writes)
  → UI shows DiscoveryLinksPanel

Curator clicks [ Fetch Preview ] on one link
  → fetchDiscoveredLinkPreviewAction(sourceId, url)
      → same-domain validation (server-side)
      → fetch discovered URL (1 page, timeout 12s)
      → extract metadata (title, summary, og:image)
      → return FetchedCandidate (no DB writes)
  → existing CandidatePreviewPanel takes over

Curator reviews + edits + clicks [ Queue Candidate ]
  → queueFetchedCandidateAction (existing flow)
      → duplicate check
      → createRecoveredSignal (status=pending)
  → signal enters queue for full review
```

## Files

| File | Role |
|---|---|
| `app/actions.ts` | `discoverSourceLinksAction`, `fetchDiscoveredLinkPreviewAction` |
| `lib/scanner-fetch-types.ts` | `DiscoveredLink` interface |
| `components/ScannerSourcesClient.tsx` | `DiscoveryLinksPanel`, discover button, `DiscoverState` |
| `docs/manual-fetch-prototype.md` | Parent doc for the manual scanner system |
