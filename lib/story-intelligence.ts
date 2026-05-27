/**
 * Story intelligence — pure scoring, filtering, and narrative extraction.
 *
 * No AI. No external APIs. No fabrication.
 * All analysis is pattern matching on curator-fetched text.
 */

import type { FetchedCandidate } from './scanner-fetch-types';

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
  'missing time', 'signal', 'archive', 'entity', 'coordinates', 'unexplained', 'recurring',
];

export const EYEWITNESS_EXPANDED: string[] = [
  'i saw', 'i experienced', 'my friend', 'we found', 'happened to me',
  'i was there', 'i noticed', 'i witnessed', 'we saw', 'i heard',
];

export const INTERNET_MYSTERY: string[] = [
  'deleted', 'mirror', 'wayback', 'guestbook', 'old web', 'bbs', 'forum',
  'dead link', 'archived page', 'geocities', 'angelfire', 'tripod',
  'lost page', 'removed', '404', 'cached',
];

// Heuristic signal groups — shared by extractNarrative scoring and scoreStoryHeuristics
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
  if (p.title.trim().length > 40)             soft.push('descriptive title');
  if (p.num_comments > 5)                     soft.push(`${p.num_comments} comments`);
  if ((p.selftext ?? '').trim().length > 120) soft.push('body text');
  if (ANOMALY_PHRASES.some((ph) => combined.includes(ph)))   soft.push('anomaly phrase');
  if (EYEWITNESS_EXPANDED.some((ph) => combined.includes(ph))) soft.push('eyewitness language');
  if (p.score > 8)                            soft.push(`${p.score}↑`);

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
// Narrative extraction v2 — recover the best story excerpt from raw text
// ---------------------------------------------------------------------------

const STRIP_PATTERNS: RegExp[] = [
  /\n{0,2}\*{0,2}edit\s*\d*[:\s][^\n]*/gi,
  /\n{0,2}\*{0,2}update\s*\d*[:\s][^\n]*/gi,
  /\n{0,2}\*{0,2}tl;?dr[:\s][^\n]*/gi,
  /\n{0,2}\*{0,2}note\s*[:\s][^\n]*/gi,
  /\n{0,2}\*{0,2}disclaimer[:\s][^\n]*/gi,
  /\n{0,2}---\s*moderator[^---]*---/gi, // mod post dividers
];

const META_PREFIX = /^(edit|update|note|disclaimer|tl;?dr|context|background|mod(erator)?|cross-?post|source:|originally posted|submitted to)\b/i;

const NAV_JUNK = /^(see also|related:|sidebar|wiki:|faq:|rules:|posted (in|to|by)|please read|subreddit|community|welcome to r\/)/i;

function scoreParagraphNarrative(p: string, idx: number): number {
  const lc = p.toLowerCase();
  let score = 0;

  // Length signal
  if (p.length > 300) score += 15;
  else if (p.length > 150) score += 8;
  else if (p.length > 80) score += 3;

  // Has sentence-ending punctuation — feels like prose
  if (/[.!?]/.test(p)) score += 4;

  // Narrative signal groups
  if (EYEWITNESS.some((s) => lc.includes(s)))        score += 20;
  if (EYEWITNESS_EXPANDED.some((s) => lc.includes(s))) score += 10;
  if (ANOMALY_PHRASES.some((s) => lc.includes(s)))   score += 12;
  if (TIMELINE_CONFUSION.some((s) => lc.includes(s))) score += 15;
  if (INTENSITY.some((s) => lc.includes(s)))          score += 10;
  if (UNRESOLVED.some((s) => lc.includes(s)))         score += 10;
  if (INTERNET_MYSTERY.some((s) => lc.includes(s)))   score +=  8;

  // Strong penalty for meta/nav/boilerplate opening words
  if (META_PREFIX.test(p)) score -= 25;
  if (NAV_JUNK.test(p))    score -= 30;

  // Mild position preference — first few paragraphs are usually most relevant
  score -= idx * 2;

  return score;
}

/**
 * Extract the best narrative excerpt from raw text (Reddit selftext or any scraped body).
 * Strips junk, scores paragraphs by story signal strength, selects top-scoring prose.
 * Min 120 chars, max ~900 chars. No hallucination, no paraphrasing.
 */
export function extractNarrative(rawText: string): string {
  if (!rawText?.trim()) return '';

  let text = rawText;
  for (const re of STRIP_PATTERNS) text = text.replace(re, '');

  text = text
    .replace(/https?:\/\/\S+/g, '')             // raw URLs
    .replace(/\^[^\s]+/g, '')                    // reddit ^superscript
    .replace(/~~[^~]+~~/g, '')                   // ~~strikethrough~~
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')    // [text](url) → text
    .replace(/#{1,6}\s+/g, '')                   // markdown headers
    .replace(/\*{1,2}([^*\n]+)\*{1,2}/g, '$1') // **bold** / *italic*
    .replace(/`([^`\n]+)`/g, '$1')              // `inline code`
    .replace(/[ \t]{2,}/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

  const paragraphs = text
    .split(/\n\n+/)
    .map((p) => p.replace(/\n/g, ' ').trim())
    .filter((p) => p.length > 30);

  if (!paragraphs.length) return text.slice(0, 900);

  // Score all paragraphs and pick the best subset in reading order
  const scored = paragraphs.map((p, i) => ({
    text: p,
    score: scoreParagraphNarrative(p, i),
    index: i,
  }));

  const positiveScored = scored.filter((s) => s.score >= 0);
  const pool = positiveScored.length > 0 ? positiveScored : scored;

  const topIndices = pool
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((s) => s.index)
    .sort((a, b) => a - b); // restore reading order

  const selected = topIndices.map((i) => paragraphs[i]);
  let result = selected.join('\n\n').slice(0, 900);

  // Pad to minimum 120 chars if needed
  if (result.length < 120) {
    for (const p of paragraphs) {
      if (!selected.includes(p) && p.length >= 80) {
        result = `${result}\n\n${p}`.slice(0, 900);
        break;
      }
    }
  }

  return result;
}

// ---------------------------------------------------------------------------
// Story heuristics — semantic signal scoring
// ---------------------------------------------------------------------------

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

  if (!signals.includes('eyewitness') && EYEWITNESS_EXPANDED.some((s) => lc.includes(s))) {
    score += 10; signals.push('eyewitness');
  }
  if (INTERNET_MYSTERY.some((s) => lc.includes(s))) { score += 6; signals.push('internet mystery'); }

  if (text.length > 300)  score += 5;
  if (text.length > 700)  score += 5;
  if (text.length > 1200) score += 5;

  return { storyScore: Math.min(score, 100), storySignals: signals };
}

// ---------------------------------------------------------------------------
// Signal analysis — template-based, no AI, no hallucination
// ---------------------------------------------------------------------------

export interface SignalAnalysis {
  surfacedBecause:    string;
  anomalyMarkers:     string[];
  corroborationLevel: 'none' | 'weak' | 'moderate' | 'strong';
  rarityLevel:        'common' | 'notable' | 'rare' | 'exceptional';
  sourceReliability:  'unknown' | 'low' | 'moderate' | 'high';
  summaryLine:        string;
}

/**
 * Generate template-based signal analysis for a recovered candidate.
 * No AI. No API. No fabrication. Output is derived entirely from
 * structured fields already attached to the candidate.
 */
export function generateSignalAnalysis(candidate: FetchedCandidate): SignalAnalysis {
  const signals = candidate.storySignals ?? [];

  // ── Why surfaced ─────────────────────────────────────────────────────────
  const surfaceReasons: string[] = [];
  if (candidate.qualityTier === 'strong')   surfaceReasons.push('passed strong quality gate');
  if (candidate.qualityTier === 'soft-pass') surfaceReasons.push('passed relaxed quality gate');
  if (signals.includes('eyewitness'))        surfaceReasons.push('first-person eyewitness language detected');
  if (signals.includes('corroborated'))      surfaceReasons.push('multiple witnesses mentioned');
  if (signals.includes('timeline anomaly'))  surfaceReasons.push('temporal disorientation described');
  if (signals.includes('unresolved'))        surfaceReasons.push('mystery remains unresolved');
  if (signals.includes('internet mystery'))  surfaceReasons.push('lost or archived digital artifact');
  if (candidate.passReason && surfaceReasons.length === 0) {
    surfaceReasons.push(candidate.passReason);
  }

  const surfacedBecause = surfaceReasons.length > 0
    ? surfaceReasons.slice(0, 2).join('; ')
    : 'matched source scan patterns';

  // ── Anomaly markers ───────────────────────────────────────────────────────
  const anomalyMarkers: string[] = [];
  if (signals.includes('timeline anomaly'))  anomalyMarkers.push('temporal gap / missing time');
  if (signals.includes('unresolved'))        anomalyMarkers.push('mystery unresolved');
  if (signals.includes('eyewitness'))        anomalyMarkers.push('first-person account');
  if (signals.includes('corroborated'))      anomalyMarkers.push('independent witnesses');
  if (signals.includes('high intensity'))    anomalyMarkers.push('high emotional intensity');
  if (signals.includes('internet mystery'))  anomalyMarkers.push('lost / archived artifact');
  if (signals.includes('anomaly phrase'))    anomalyMarkers.push('anomaly language');

  // ── Corroboration level ───────────────────────────────────────────────────
  const corrScore = candidate.corroborationScore ?? 0;
  const corrNotes = candidate.corroborationNotes ?? [];
  let corroborationLevel: SignalAnalysis['corroborationLevel'] = 'none';
  if      (corrScore >= 20 || corrNotes.length >= 3) corroborationLevel = 'strong';
  else if (corrScore >= 10 || corrNotes.length >= 2) corroborationLevel = 'moderate';
  else if (corrScore >= 5  || corrNotes.length >= 1) corroborationLevel = 'weak';
  else if (signals.includes('corroborated'))          corroborationLevel = 'weak';

  // ── Rarity level ─────────────────────────────────────────────────────────
  const score      = candidate.storyScore ?? 0;
  const sigCount   = signals.length;
  let rarityLevel: SignalAnalysis['rarityLevel'] = 'common';
  if      (score >= 70 || sigCount >= 5) rarityLevel = 'exceptional';
  else if (score >= 50 || sigCount >= 3) rarityLevel = 'rare';
  else if (score >= 30 || sigCount >= 2) rarityLevel = 'notable';

  // ── Source reliability ────────────────────────────────────────────────────
  const sourceType = candidate.sourceType ?? '';
  let sourceReliability: SignalAnalysis['sourceReliability'] = 'unknown';
  if (['reddit', 'mediawiki', 'erowid'].includes(sourceType)) sourceReliability = 'moderate';
  if (sourceType === 'wayback' || candidate.isArchived)        sourceReliability = 'high';
  if (candidate.qualityTier === 'strong' && sourceReliability === 'unknown') {
    sourceReliability = 'moderate';
  }

  // ── Summary line ─────────────────────────────────────────────────────────
  const rarityLabel =
    rarityLevel === 'exceptional' ? 'Exceptional signal' :
    rarityLevel === 'rare'        ? 'Rare signal'        :
    rarityLevel === 'notable'     ? 'Notable signal'     : 'Recovered signal';

  const srcLabel = sourceType
    ? `from ${sourceType.charAt(0).toUpperCase() + sourceType.slice(1)}`
    : 'recovered';

  const topMarker = anomalyMarkers[0] ?? 'story pattern detected';
  const summaryLine = `${rarityLabel} ${srcLabel} — ${topMarker}`;

  return { surfacedBecause, anomalyMarkers, corroborationLevel, rarityLevel, sourceReliability, summaryLine };
}
