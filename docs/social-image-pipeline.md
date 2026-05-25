# SWIM Social Image Pipeline

Future roadmap for generating and approving visual social cards from recovered signals.

**Current state:** Text-only social copy (Telegram + X). Evidence URLs stored. No image generation.

---

## Phase 1 — Now (implemented)

- `source_image_url` stored per signal — curator adds archived screenshot URL during intake
- `media_url` + `media_type` stored — links to video stills, audio files, document captures
- `attribution_text` stored — credit line for original source
- `source_capture_notes` stored — curator notes on how/when evidence was saved
- Telegram copy says "Evidence attached — see full thread" when media exists
- Thread body includes evidence links under `> Evidence:` block

---

## Phase 2 — Screenshot Capture (manual)

1. Curator navigates to source URL (or Wayback snapshot)
2. Curator takes screenshot using OS tools or browser extension
3. Curator uploads screenshot to a hosting service (Imgur, Cloudinary, etc.)
4. Curator pastes the hosted URL into `source_image_url` in the intake form
5. Screenshot appears in the Evidence panel in `/scanner/queue`
6. Screenshot URL is included in the reborn thread body

**No automation at this stage. No scraping. Human-only capture.**

---

## Phase 3 — Evidence Crop + Card Generation (future)

When a signal is `rebirth-ready`, a future tool could:

1. Fetch the `source_image_url`
2. Present a crop UI — curator selects the relevant region of the screenshot
3. Overlay SWIM card template:
   - Black background with CRT green accents
   - Signal title (top)
   - Cropped evidence (center)
   - Source attribution (bottom left)
   - SWIM branding + anomaly score (bottom right)
4. Curator reviews and approves the card
5. Card URL stored as `social_card_url` on the signal (column not yet added)

**Not automated. Curator approves every card before it can be used.**

---

## Phase 4 — Social Post with Image (future)

When curator clicks "Post to Telegram" or "Post to X":

1. System reads `social_card_url` from the signal
2. Composes post:
   - Telegram: sends photo with caption (current text copy)
   - X: attaches image card to tweet
3. Curator confirms in the queue UI
4. Post goes out

**Human approval required at every step. No auto-post. No bypassing the queue.**

---

## Data model additions needed for Phase 3/4

```sql
ALTER TABLE recovered_signals
  ADD COLUMN IF NOT EXISTS social_card_url TEXT;
  -- URL of the generated/approved social image card

ALTER TABLE recovered_signals
  ADD COLUMN IF NOT EXISTS social_card_approved_at TIMESTAMPTZ;
  -- When the curator approved the card; NULL = not yet approved
```

---

## What NOT to do

- Do not scrape screenshots automatically
- Do not generate images without curator review
- Do not post images that contain PII, real faces, or private information
- Do not use copyrighted images in social cards without clear fair-use justification
- Do not auto-post to any platform without human click-through confirmation
