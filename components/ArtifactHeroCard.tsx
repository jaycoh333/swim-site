'use client';

// ---------------------------------------------------------------------------
// Source-type configuration — drives accent colors and label
// ---------------------------------------------------------------------------

interface SourceCfg {
  accent:    string;   // #hex or rgba — full color
  bg:        string;   // low-opacity fill
  border:    string;   // border rgba
  glow:      string;   // outer glow rgba
  accentDim: string;   // dimmer for meta keys / secondary text
  text:      string;   // meta value text
  label:     string;   // card label e.g. "BBS RECORD"
}

const SOURCE_CFG: Record<string, SourceCfg> = {
  bbs: {
    accent: '#d7a85c', bg: 'rgba(215,168,92,0.06)', border: 'rgba(215,168,92,0.32)',
    glow: 'rgba(215,168,92,0.14)', accentDim: 'rgba(215,168,92,0.42)', text: 'rgba(225,185,120,0.82)',
    label: 'BBS RECORD',
  },
  wayback: {
    accent: '#86d46e', bg: 'rgba(134,212,110,0.05)', border: 'rgba(134,212,110,0.30)',
    glow: 'rgba(134,212,110,0.12)', accentDim: 'rgba(134,212,110,0.42)', text: 'rgba(180,230,160,0.82)',
    label: 'ARCHIVE RECOVERY',
  },
  archive: {
    accent: '#4db8c8', bg: 'rgba(77,184,200,0.05)', border: 'rgba(77,184,200,0.30)',
    glow: 'rgba(77,184,200,0.12)', accentDim: 'rgba(77,184,200,0.42)', text: 'rgba(140,210,225,0.82)',
    label: 'CASE FILE',
  },
  mediawiki: {
    accent: '#6da8ff', bg: 'rgba(109,168,255,0.05)', border: 'rgba(109,168,255,0.30)',
    glow: 'rgba(109,168,255,0.12)', accentDim: 'rgba(109,168,255,0.42)', text: 'rgba(160,200,255,0.82)',
    label: 'REFERENCE ARCHIVE',
  },
  forum: {
    accent: '#a78bfa', bg: 'rgba(167,139,250,0.05)', border: 'rgba(167,139,250,0.28)',
    glow: 'rgba(167,139,250,0.12)', accentDim: 'rgba(167,139,250,0.40)', text: 'rgba(200,175,255,0.82)',
    label: 'FORUM RECOVERY',
  },
  archive_forum: {
    accent: '#a78bfa', bg: 'rgba(167,139,250,0.05)', border: 'rgba(167,139,250,0.28)',
    glow: 'rgba(167,139,250,0.12)', accentDim: 'rgba(167,139,250,0.40)', text: 'rgba(200,175,255,0.82)',
    label: 'FORUM RECOVERY',
  },
  reddit: {
    accent: '#f97316', bg: 'rgba(249,115,22,0.05)', border: 'rgba(249,115,22,0.28)',
    glow: 'rgba(249,115,22,0.12)', accentDim: 'rgba(249,115,22,0.40)', text: 'rgba(255,175,120,0.82)',
    label: 'COMMUNITY SIGNAL',
  },
  erowid: {
    accent: '#86d46e', bg: 'rgba(134,212,110,0.05)', border: 'rgba(134,212,110,0.28)',
    glow: 'rgba(134,212,110,0.10)', accentDim: 'rgba(134,212,110,0.40)', text: 'rgba(180,230,160,0.80)',
    label: 'ARCHIVE RECORD',
  },
};

const DEFAULT_CFG: SourceCfg = {
  accent: '#86d46e', bg: 'rgba(134,212,110,0.05)', border: 'rgba(134,212,110,0.28)',
  glow: 'rgba(134,212,110,0.10)', accentDim: 'rgba(134,212,110,0.40)', text: 'rgba(180,230,160,0.80)',
  label: 'RECOVERED ARTIFACT',
};

function getCfg(t?: string | null): SourceCfg {
  if (!t) return DEFAULT_CFG;
  return SOURCE_CFG[t.toLowerCase()] ?? DEFAULT_CFG;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Deterministic 4-digit artifact number from slug/ID string
function hashArtifactNumber(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) {
    h = ((h << 5) - h + id.charCodeAt(i)) >>> 0;
  }
  return String((h % 9000) + 1000);
}

// Best single sentence for the pull quote (≤ 180 chars, ≥ 30 chars)
function extractPullQuote(text: string): string {
  if (!text) return '';
  const parts = text.split(/(?<=[.!?])\s+/);
  const good  = parts.filter(s => s.length >= 30 && s.length <= 180);
  if (!good.length) return text.length > 180 ? text.slice(0, 178) + '…' : text;
  // Prefer the longest candidate under 180 chars
  return good.reduce((a, b) => b.length > a.length ? b : a);
}

// First sentence or first ~130 chars as premise
function extractPremise(text: string): string {
  if (!text) return '';
  const m = text.match(/^[^.!?]{15,}[.!?]/);
  if (m && m[0].length <= 160) return m[0];
  return text.length > 130 ? text.slice(0, 128) + '…' : text;
}

function fmtDate(iso?: string): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return iso.slice(0, 10); }
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export interface ArtifactHeroCardProps {
  artifactId:       string;           // thread slug/ID → deterministic artifact number
  title?:           string;           // artifact title (shown in pull-quote header if no excerpt)
  excerpt?:         string;           // used for premise + pull quote
  sourceType?:      string | null;
  sourceName?:      string | null;
  sourceUrl?:       string | null;
  originalDomain?:  string | null;
  archiveYear?:     string | null;
  sourceEra?:       string | null;
  category:         string;
  recoveredAt?:     string;           // ISO date
  authorHandle?:    string;
  /** compact=true → no premise, no archive link (for modal use) */
  compact?:         boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ArtifactHeroCard({
  artifactId,
  title,
  excerpt,
  sourceType,
  sourceName,
  sourceUrl,
  originalDomain,
  archiveYear,
  sourceEra,
  category,
  recoveredAt,
  authorHandle,
  compact = false,
}: ArtifactHeroCardProps) {
  const cfg    = getCfg(sourceType);
  const artNum = hashArtifactNumber(artifactId);
  const premise  = excerpt ? extractPremise(excerpt)   : null;
  const pullQuote = excerpt ? extractPullQuote(excerpt) : null;
  const shortDate = fmtDate(recoveredAt);

  // CSS variable bag — used by .artifact-frame CSS classes
  const cssVars = {
    '--af-accent':     cfg.accent,
    '--af-bg':         cfg.bg,
    '--af-border':     cfg.border,
    '--af-glow':       cfg.glow,
    '--af-accent-dim': cfg.accentDim,
    '--af-text':       cfg.text,
  } as React.CSSProperties;

  return (
    <div className={`artifact-frame${compact ? ' artifact-frame--compact' : ''}`} style={cssVars}>

      {/* Decorative overlays */}
      <div className="artifact-scanline"  aria-hidden="true" />
      <div className="artifact-crt-glow"  aria-hidden="true" />
      <div className="artifact-grid"      aria-hidden="true" />

      {/* ── Titlebar / header strip ── */}
      <div className="artifact-frame-header">
        <div className="artifact-frame-dots" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <span className="artifact-frame-label">{cfg.label}</span>
        <span className="artifact-frame-number">#{artNum}</span>
      </div>

      {/* ── Body ── */}
      <div className={compact ? 'artifact-frame-body artifact-frame-body--compact' : 'artifact-frame-body'}>

        {/* Metadata key-value grid */}
        <div className="artifact-meta-grid">
          {shortDate && (
            <div className="artifact-meta-row">
              <span className="artifact-meta-key">DATE UNEARTHED</span>
              <span className="artifact-meta-val">{shortDate}</span>
            </div>
          )}
          {(sourceEra || archiveYear) && (
            <div className="artifact-meta-row">
              <span className="artifact-meta-key">SOURCE ERA</span>
              <span className="artifact-meta-val">
                {[sourceEra, archiveYear ? `(${archiveYear})` : null].filter(Boolean).join(' ')}
              </span>
            </div>
          )}
          {sourceName && (
            <div className="artifact-meta-row">
              <span className="artifact-meta-key">ARCHIVE SOURCE</span>
              <span className="artifact-meta-val">{sourceName}</span>
            </div>
          )}
          {originalDomain && (
            <div className="artifact-meta-row">
              <span className="artifact-meta-key">ORIGINAL HOST</span>
              <span className="artifact-meta-val">{originalDomain}</span>
            </div>
          )}
          {authorHandle && (
            <div className="artifact-meta-row">
              <span className="artifact-meta-key">ARCHIVIST</span>
              <span className="artifact-meta-val">{authorHandle}</span>
            </div>
          )}
          {sourceType && (
            <div className="artifact-meta-row">
              <span className="artifact-meta-key">SOURCE TYPE</span>
              <span className="artifact-meta-val">{sourceType.toUpperCase()}</span>
            </div>
          )}
          <div className="artifact-meta-row">
            <span className="artifact-meta-key">CATEGORY</span>
            <span className="artifact-meta-val">{category}</span>
          </div>
        </div>

        {/* Premise — full mode only */}
        {!compact && premise && (
          <div className="artifact-premise-block">
            <div className="artifact-premise-label">PREMISE</div>
            <p className="artifact-premise-text">{premise}</p>
          </div>
        )}

        {/* Pull quote */}
        {pullQuote && (
          <blockquote className="artifact-pull-quote">
            <span className="artifact-pull-open" aria-hidden="true">&ldquo;</span>
            {pullQuote}
            <span className="artifact-pull-close" aria-hidden="true">&rdquo;</span>
          </blockquote>
        )}

        {/* Archive link — full mode only */}
        {!compact && sourceUrl && (
          <div className="artifact-source-link-row">
            <a
              href={sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="artifact-source-link"
            >
              ◈ View Archive Source ↗
            </a>
          </div>
        )}
      </div>
    </div>
  );
}
