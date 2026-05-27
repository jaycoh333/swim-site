/**
 * Parse scanner metadata embedded in recovered signal thread bodies.
 * Both formatSignalBody (repository) and buildRichThreadBody (scanner client)
 * produce structured bodies that this utility can decode.
 */

export interface ThreadMeta {
  isRecoveredSignal: boolean;
  excerpt: string;
  sourceEra: string | null;
  archiveYear: string | null;
  sourceName: string | null;
  sourceUrl: string | null;
  sourceImageUrl: string | null;
  scannerLines: string[];
  sourceLines: string[];
  captureLines: string[];
}

const DIVIDER_RE = /^[─\-]{4,}$/;
const SECTION_HDR_RE = /^>\s+([A-Z][A-Z0-9 /]+)$/;

export function parseThreadMeta(body: string): ThreadMeta {
  const lines = body.split('\n');

  const dividerIdx = lines.findIndex(l => DIVIDER_RE.test(l.trim()));
  const hasScanner = body.includes('> SCANNER ANALYSIS');
  const isRecoveredSignal = dividerIdx >= 0 && hasScanner;

  // Excerpt: non-empty lines before the divider
  const rawExcerptLines = dividerIdx >= 0 ? lines.slice(0, dividerIdx) : lines.slice(0, 4);
  const excerpt = rawExcerptLines.filter(l => l.trim()).join(' ').trim();

  // Extract sections: collect ">" lines between section headers
  const sections: Record<string, string[]> = {};
  let currentSection: string | null = null;

  for (const line of lines) {
    const hdr = SECTION_HDR_RE.exec(line);
    if (hdr) {
      currentSection = hdr[1];
      sections[currentSection] = [];
      continue;
    }
    if (currentSection) {
      if (line.startsWith('> ')) {
        sections[currentSection].push(line.slice(2).trim());
      } else if (line.trim() !== '') {
        currentSection = null;
      }
    }
  }

  const scannerLines = sections['SCANNER ANALYSIS'] ?? [];
  const sourceLines  = sections['SOURCE ATTRIBUTION'] ?? [];
  const captureLines = sections['CAPTURE NOTES'] ?? [];

  // Extract specific key-value pairs from sourceLines
  const findKv = (arr: string[], key: string) => {
    const pfx = key + ': ';
    const match = arr.find(l => l.toLowerCase().startsWith(pfx.toLowerCase()));
    return match ? match.slice(pfx.length).trim() : null;
  };

  const sourceName     = findKv(sourceLines, 'Source');
  const sourceUrl      = findKv(sourceLines, 'URL');
  const sourceImageUrl = findKv(sourceLines, 'Image');

  // Archive era from scanner lines (e.g. "Archive era: 1990s web (1997)")
  const eraRaw = findKv(scannerLines, 'Archive era');
  let sourceEra: string | null = null;
  let archiveYear: string | null = null;
  if (eraRaw) {
    const m = eraRaw.match(/\((\d{4})\)/);
    if (m) archiveYear = m[1];
    sourceEra = eraRaw.replace(/\s*\(\d{4}\)/, '').trim();
  }

  return {
    isRecoveredSignal,
    excerpt,
    sourceEra,
    archiveYear,
    sourceName,
    sourceUrl,
    sourceImageUrl,
    scannerLines,
    sourceLines,
    captureLines,
  };
}

export function getEraClass(era: string | null): string {
  if (!era) return '';
  const e = era.toLowerCase();
  if (e.includes('1990') || e.includes('90s'))      return 'era-1990s-web';
  if (e.includes('bbs'))                             return 'era-bbs-archive';
  if (e.includes('2000') || e.includes('early 2000')) return 'era-early-2000s';
  if (e.includes('pre-social'))                      return 'era-presocial';
  return '';
}
