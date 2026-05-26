/**
 * Story intelligence — pure scoring, filtering, and narrative extraction.
 *
 * No AI. No external APIs. No fabrication.
 * All analysis is pattern matching on curator-fetched text.
 */

// ---------------------------------------------------------------------------
// Anomaly vocabulary
// ---------------------------------------------------------------------------

export const ANOMALY_PHRASES: string[] = [
  'remember', 'dream', 'missing', 'disappeared', 'glitch', 'strange', 'weird',
  "can't explain", "couldn't explain", 'everyone saw', 'no one believes',
  'hard to explain', 'still haunts', 'never found', 'vanished',
  'alternate', 'timeline', 'mandela', 'impossible',
  'happened to me', 'never told anyone', 'witnessed', 'saw something', 'heard something',
  'to this day', 'still unexplained', 'recovered', 'deleted',
  'true story', 'it really happened', 'no one believed', 'lost memory',
];

// ---------------------------------------------------------------------------
// Reddit quality gate
// ---------------------------------------------------------------------------

const IMAGE_EXTENSIONS = /\.(jpg|jpeg|png|gif|webp|bmp|svg|mp4|mov|webm)(\?|$)/i;

const GENERIC_PROMPTS = [
  "what's your most", 'what is your most', 'have you ever', 'share your',
  'best stories about', 'do you believe', 'who else has', 'weekly thread',
  'discussion thread', 'megathread', 'weekly discussion', 'monthly thread',
  'tell me your', '[weekly]', '[monthly]', '[mod post]', 'anyone else',
];

const MOD_ACCOUNTS = new Set(['automoderator', '[deleted]', '[removed]']);

export interface RedditQualityInput {
  title:        string;
  selftext:     string;
  is_self:      boolean;
  url?:         string;
  score:        number;
  num_comments: number;
  stickied?:    boolean;
  author?:      string;
}

export interface RedditQualityResult {
  passes:        boolean;
  criteriaCount: number;
  passReason:    string;
  rejectReason?: string;
}

/**
 * Score a Reddit post for story quality.
 * Requires 2+ of: longform text, engagement score, comment count, anomaly phrase.
 */
export function scoreRedditQuality(p: RedditQualityInput): RedditQualityResult {
  const titleLc = p.title.toLowerCase();
  const textLc  = (p.selftext ?? '').toLowerCase();

  if (p.stickied) {
    return { passes: false, criteriaCount: 0, passReason: '', rejectReason: 'stickied post' };
  }
  if (p.author && MOD_ACCOUNTS.has(p.author.toLowerCase())) {
    return { passes: false, criteriaCount: 0, passReason: '', rejectReason: 'mod/deleted account' };
  }
  if (!p.is_self && p.url && IMAGE_EXTENSIONS.test(p.url)) {
    return { passes: false, criteriaCount: 0, passReason: '', rejectReason: 'image-only post' };
  }
  if (GENERIC_PROMPTS.some((prompt) => titleLc.includes(prompt))) {
    return { passes: false, criteriaCount: 0, passReason: '', rejectReason: 'generic discussion prompt' };
  }
  if (p.is_self && p.selftext.trim().length < 50) {
    return { passes: false, criteriaCount: 0, passReason: '', rejectReason: 'no text content' };
  }

  const met: string[] = [];
  if (p.selftext.trim().length > 300) met.push('longform');
  if (p.score > 20)                   met.push(`${p.score}↑`);
  if (p.num_comments > 10)            met.push(`${p.num_comments} comments`);

  const combined = `${titleLc} ${textLc}`;
  if (ANOMALY_PHRASES.some((ph) => combined.includes(ph))) met.push('anomaly phrase');

  const count = met.length;
  if (count < 2) {
    return {
      passes:        false,
      criteriaCount: count,
      passReason:    '',
      rejectReason:  count === 0
        ? 'no story criteria met'
        : `only 1/2 criteria met (need longform, score>20, comments>10, or anomaly phrase)`,
    };
  }

  return { passes: true, criteriaCount: count, passReason: met.slice(0, 3).join(' · ') };
}

// ---------------------------------------------------------------------------
// Narrative extraction — cleaner text from Reddit posts
// ---------------------------------------------------------------------------

const EDIT_PATTERNS: RegExp[] = [
  /\n{0,2}\*{0,2}edit\s*\d*[:\s][^\n]*/gi,
  /\n{0,2}\*{0,2}update\s*\d*[:\s][^\n]*/gi,
  /\n{0,2}\*{0,2}tl;?dr[:\s][^\n]*/gi,
];

const META_PREFIX = /^(edit|update|note|disclaimer|tl;?dr|context|background)\b/i;

/**
 * Extract the first meaningful narrative paragraph(s) from Reddit selftext.
 * Strips edit blocks, URLs, formatting noise, and boilerplate.
 */
export function extractNarrative(rawText: string): string {
  if (!rawText?.trim()) return '';

  let text = rawText;
  for (const re of EDIT_PATTERNS) text = text.replace(re, '');

  text = text
    .replace(/https?:\/\/\S+/g, '')           // raw URLs
    .replace(/\^[^\s]+/g, '')                  // reddit ^superscript
    .replace(/~~[^~]+~~/g, '')                 // ~~strikethrough~~
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')  // [text](url) → text
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.replace(/\n/g, ' ').trim())
    .filter((p) => p.length > 30);

  if (!paragraphs.length) return text.slice(0, 1200);

  const narrIdx = paragraphs.findIndex(
    (p) => p.length > 80 && /[.!?]/.test(p) && !META_PREFIX.test(p),
  );
  const startIdx = narrIdx >= 0 ? narrIdx : 0;

  return paragraphs.slice(startIdx, startIdx + 3).join('\n\n').slice(0, 1500);
}

// ---------------------------------------------------------------------------
// Story heuristics — semantic signal scoring
// ---------------------------------------------------------------------------

const EYEWITNESS = [
  'i saw', 'i heard', 'i felt', 'i noticed', 'i witnessed', 'i remember',
  'we saw', 'we heard', 'we noticed', 'i was there', 'i found', 'i woke up',
];
const CORROBORATION = [
  'other people', 'someone else', 'my wife', 'my husband', 'my partner',
  'can confirm', 'two people', 'three people', 'multiple people', 'everyone present',
  'the whole', 'several others', 'others also',
];
const TIMELINE_CONFUSION = [
  "can't remember", "don't remember", 'no memory of', 'lost time', 'missing time',
  'hours had passed', 'suddenly it was', 'the next thing i', 'woke up and',
  'came to', 'blacked out', 'hours later', 'no idea how long',
];
const UNRESOLVED = [
  'never found', 'never explained', 'still unknown', 'no explanation',
  'never figured out', 'remains unexplained', 'to this day', 'still happens',
  'no one knows why', 'nobody knew', 'no record of', 'never came back',
];
const INTENSITY = [
  'terrified', 'horrified', 'scared', 'shaking', 'frozen', 'paralyzed',
  'speechless', 'screaming', 'ran away', 'could not move',
  'still haunts', 'never forget', 'chills', 'trembling', 'panic',
];

export interface StoryHeuristicsResult {
  storyScore:   number;   // 0–100
  storySignals: string[]; // badge labels: 'eyewitness', 'corroborated', etc.
}

/**
 * Analyse text for narrative and anomaly signals.
 * Higher score = more compelling recovered story.
 */
export function scoreStoryHeuristics(text: string): StoryHeuristicsResult {
  const lc = text.toLowerCase();
  const signals: string[] = [];
  let score = 0;

  if (EYEWITNESS.some((s)           => lc.includes(s))) { score += 20; signals.push('eyewitness');      }
  if (CORROBORATION.some((s)        => lc.includes(s))) { score += 15; signals.push('corroborated');     }
  if (TIMELINE_CONFUSION.some((s)   => lc.includes(s))) { score += 12; signals.push('timeline anomaly'); }
  if (UNRESOLVED.some((s)           => lc.includes(s))) { score += 15; signals.push('unresolved');       }
  if (INTENSITY.some((s)            => lc.includes(s))) { score += 10; signals.push('high intensity');   }
  if (ANOMALY_PHRASES.some((s)      => lc.includes(s))) { score +=  8; signals.push('anomaly phrase');   }

  // Length bonus — more substance in longer text
  if (text.length > 300)  score += 5;
  if (text.length > 700)  score += 5;
  if (text.length > 1200) score += 5;

  return { storyScore: Math.min(score, 100), storySignals: signals };
}
