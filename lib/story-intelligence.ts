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
  // expanded anomaly terms
  'missing time', 'signal', 'archive', 'entity', 'coordinates', 'unexplained', 'recurring',
];

// Expanded eyewitness phrases for soft-pass detection
export const EYEWITNESS_EXPANDED: string[] = [
  'i saw', 'i experienced', 'my friend', 'we found', 'happened to me',
  'i was there', 'i noticed', 'i witnessed', 'we saw', 'i heard',
];

// Internet mystery terms — old web, archives, forgotten sites
export const INTERNET_MYSTERY: string[] = [
  'deleted', 'mirror', 'wayback', 'guestbook', 'old web', 'bbs', 'forum',
  'dead link', 'archived page', 'geocities', 'angelfire', 'tripod',
  'lost page', 'removed', '404', 'cached',
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
  qualityTier?:  'strong' | 'soft-pass';
}

const SPAM_DOMAINS = /\b(onlyfans|camsite|escort|promo|referral|discount code)\b/i;

/**
 * Score a Reddit post for story quality.
 *
 * STRONG pass: 2+ of [longform>300, score>20, comments>10, anomaly phrase]
 * SOFT pass:   2+ of [title>40, comments>5, body>120, anomaly phrase, eyewitness phrase, score>8]
 * Hard reject: deleted/removed, meme/image-only, title<18 chars, spam, stickied
 */
export function scoreRedditQuality(p: RedditQualityInput): RedditQualityResult {
  const titleLc = p.title.toLowerCase();
  const textLc  = (p.selftext ?? '').toLowerCase();

  // ── Hard rejects ─────────────────────────────────────────────────────────
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
  if (p.title.trim().length < 18) {
    return { passes: false, criteriaCount: 0, passReason: '', rejectReason: 'title too short' };
  }
  if (SPAM_DOMAINS.test(p.title) || SPAM_DOMAINS.test(p.selftext ?? '')) {
    return { passes: false, criteriaCount: 0, passReason: '', rejectReason: 'spam content' };
  }
  // Allow title-only posts (is_self=false links) through; only reject truly empty self posts
  if (p.is_self && p.selftext.trim().length < 30 && p.title.trim().length < 40) {
    return { passes: false, criteriaCount: 0, passReason: '', rejectReason: 'no text content' };
  }

  const combined = `${titleLc} ${textLc}`;

  // ── Strong pass: original 4-criteria gate ────────────────────────────────
  const strong: string[] = [];
  if (p.selftext.trim().length > 300) strong.push('longform');
  if (p.score > 20)                   strong.push(`${p.score}↑`);
  if (p.num_comments > 10)            strong.push(`${p.num_comments} comments`);
  if (ANOMALY_PHRASES.some((ph) => combined.includes(ph))) strong.push('anomaly phrase');

  if (strong.length >= 2) {
    return {
      passes: true, criteriaCount: strong.length,
      passReason: strong.slice(0, 3).join(' · '), qualityTier: 'strong',
    };
  }

  // ── Soft pass: relaxed 7-criteria gate ───────────────────────────────────
  const soft: string[] = [];
  if (p.title.trim().length > 40)          soft.push('descriptive title');
  if (p.num_comments > 5)                  soft.push(`${p.num_comments} comments`);
  if ((p.selftext ?? '').trim().length > 120) soft.push('body text');
  if (ANOMALY_PHRASES.some((ph) => combined.includes(ph))) soft.push('anomaly phrase');
  if (EYEWITNESS_EXPANDED.some((ph) => combined.includes(ph))) soft.push('eyewitness language');
  if (p.score > 8)                         soft.push(`${p.score}↑`);

  if (soft.length >= 2) {
    return {
      passes: true, criteriaCount: soft.length,
      passReason: soft.slice(0, 3).join(' · '), qualityTier: 'soft-pass',
    };
  }

  const total = Math.max(strong.length, soft.length);
  return {
    passes:        false,
    criteriaCount: total,
    passReason:    '',
    rejectReason:  total === 0
      ? 'no story criteria met'
      : 'insufficient story signals (need 2+ of: body text, engagement, anomaly phrase, eyewitness language)',
  };
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

  // Expanded eyewitness / internet mystery groups (lower weight — secondary signals)
  if (!signals.includes('eyewitness') && EYEWITNESS_EXPANDED.some((s) => lc.includes(s))) {
    score += 10; signals.push('eyewitness');
  }
  if (INTERNET_MYSTERY.some((s) => lc.includes(s))) { score += 6; signals.push('internet mystery'); }

  // Length bonus — more substance in longer text
  if (text.length > 300)  score += 5;
  if (text.length > 700)  score += 5;
  if (text.length > 1200) score += 5;

  return { storyScore: Math.min(score, 100), storySignals: signals };
}
