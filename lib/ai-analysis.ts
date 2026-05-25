/**
 * ai-analysis.ts
 *
 * Deterministic mock signal analysis.
 *
 * All output is derived from the signal's own fields — no AI API is called.
 * `isMock` is always `true` so callers can assert they are not using live output.
 *
 * Transition path to live AI:
 *   Replace the body of `analyzeRecoveredSignal` with an async call to the
 *   analysis endpoint (Claude, GPT-4o, etc.). Keep the `SignalAnalysis` return
 *   type identical; callers and the queue UI require zero changes.
 *
 * See docs/ai-scanner-readiness.md for the full integration plan.
 */

import type { DbRecoveredSignal } from '@/lib/supabase/types';

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export type SafetyFlagType       = 'copyright' | 'pii' | 'illegal' | 'doxxing' | 'other';
export type SafetyFlagSeverity   = 'low' | 'medium' | 'high';
export type DuplicateRisk        = 'low' | 'medium' | 'high';
export type PublishRecommendation = 'publish' | 'review' | 'archive' | 'reject';

export interface SafetyFlag {
  type:     SafetyFlagType;
  severity: SafetyFlagSeverity;
  note:     string;
}

export interface SignalAnalysis {
  suggestedCategory:     string;
  categoryMatch:         boolean;        // true = same as current category
  newTags:               string[];       // inferred tags not already on signal
  anomalyRationale:      string;
  safetyFlags:           SafetyFlag[];
  duplicateRisk:         DuplicateRisk;
  duplicateRiskNote:     string;
  publishRecommendation: PublishRecommendation;
  recommendationNote:    string;
  confidence:            number;         // 0–100, rounded to nearest 5
  isMock:                true;           // always true — guard against live callers
  analysisVersion:       string;
}

// ---------------------------------------------------------------------------
// Internal: stable hash (no randomness)
// ---------------------------------------------------------------------------

function strHash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

function pick<T>(arr: readonly T[], seed: number): T {
  return arr[seed % arr.length];
}

// ---------------------------------------------------------------------------
// Category inference
// ---------------------------------------------------------------------------

const CATEGORY_PATTERNS: ReadonlyArray<{ pattern: RegExp; category: string }> = [
  { pattern: /\b(dream|sleep|nightmare|lucid|hypnagogic)\b/i,                      category: 'Dreams'            },
  { pattern: /\b(simulation|matrix|glitch|rendering|reality\s+break)\b/i,          category: 'Simulation Theory' },
  { pattern: /\b(cassette|broadcast|lost\s+media|tape|tv\s+program|regional\s+program)\b/i, category: 'Lost Media' },
  { pattern: /\b(government|classified|redact|military|facility|clearance)\b/i,    category: 'Redacted Files'    },
  { pattern: /\b(ufo|alien|entity|paranormal|supernatural|haunted|apparition)\b/i, category: 'Paranormal'        },
  { pattern: /\b(surveillance|intercept|monitored|tracked|wiretap|server\s+log)\b/i, category: 'Surveillance State' },
  { pattern: /\b(hidden\s+history|cover.up|suppressed|unofficial\s+record)\b/i,    category: 'Hidden History'    },
  { pattern: /\b(\bai\b|gpt|language\s+model|artificial\s+intelligence|fine.tun)\b/i, category: 'AI'             },
  { pattern: /\b(urban\s+explor|abandoned|derelict|acoustic\s+anomal)\b/i,         category: 'Hidden History'    },
  { pattern: /\b(irc|bbs|geocities|phpbb|message\s+board)\b/i,                     category: 'Internet Lore'     },
];

function inferCategory(sig: DbRecoveredSignal): string {
  const text = `${sig.title} ${sig.summary}`;
  for (const { pattern, category } of CATEGORY_PATTERNS) {
    if (pattern.test(text)) return category;
  }
  return sig.category;
}

// ---------------------------------------------------------------------------
// Tag inference (returns only tags not already on the signal)
// ---------------------------------------------------------------------------

const TAG_RULES: ReadonlyArray<{ pattern: RegExp; tag: string }> = [
  { pattern: /\bdelet(ed|ion)\b/i,                              tag: 'deleted-content'    },
  { pattern: /\barchiv(e|ed|al)\b/i,                            tag: 'archived-source'    },
  { pattern: /\b(independen|unrelated|no\s+apparent\s+conn)\b/i, tag: 'cross-corroborated' },
  { pattern: /\b(multiple|several|fourteen|eleven|nine|seven|twenty-two)\b/i, tag: 'multiple-accounts' },
  { pattern: /\b(wayback|archive\.org)\b/i,                     tag: 'wayback-preserved'  },
  { pattern: /\b(reddit|subreddit)\b/i,                         tag: 'reddit-origin'      },
  { pattern: /\birc\b/i,                                        tag: 'irc-origin'         },
  { pattern: /\b(official\s+denial|denied\s+by|no\s+record)\b/i, tag: 'official-denial'  },
  { pattern: /\b(photograph|visual\s+seam|correction\s+line)\b/i, tag: 'visual-evidence' },
  { pattern: /\b(recording|tape|cassette|audio)\b/i,            tag: 'audio-evidence'     },
  { pattern: /\b(recurring|repeated|same\s+structure|identical\s+room)\b/i, tag: 'recurring-pattern' },
  { pattern: /\b(bbs|textfile|usenet)\b/i,                      tag: 'bbs-origin'         },
  { pattern: /\b(geocities|early\s+web|1990s|1980s)\b/i,        tag: 'historical-web'     },
  { pattern: /\b(urban\s+explor|abandoned\s+structure)\b/i,     tag: 'urban-exploration'  },
  { pattern: /\b(single\s+witness|one\s+(person|account)|anonymous\s+firsthand)\b/i, tag: 'single-source' },
  { pattern: /\bpushshift\b/i,                                  tag: 'pushshift-archived' },
  { pattern: /\bplace\s+names?\b/i,                             tag: 'place-names'        },
];

function inferNewTags(sig: DbRecoveredSignal): string[] {
  const text     = `${sig.title} ${sig.summary}`;
  const existing = new Set(sig.tags.map((t) => t.toLowerCase()));
  return TAG_RULES
    .filter(({ pattern, tag }) => pattern.test(text) && !existing.has(tag))
    .map(({ tag }) => tag)
    .slice(0, 4);
}

// ---------------------------------------------------------------------------
// Anomaly rationale templates (deterministic pick by ID hash)
// ---------------------------------------------------------------------------

const HIGH_RATIONALE = [
  'Multiple independent accounts describe identical details with no apparent coordination. Cross-corroboration score is high. Pattern matches known signal clusters in this category.',
  'Source material shows strong consistency across unrelated reporters over an extended timeframe. Anomaly density in the summary is above category average. Prioritise for archive.',
  'Primary account corroborated by secondary sources with no indication of mutual awareness. Specific structural or visual details recur verbatim across accounts.',
] as const;

const MED_RATIONALE = [
  'Account contains internally consistent specific details. Source unavailability limits independent corroboration. Moderate pattern match to archived signals in this category.',
  'Single-source or two-source account with specific verifiable claims that cannot currently be confirmed. Category assignment is consistent with signal vocabulary.',
  'Source is archived or no longer accessible at origin. Signal value depends on whether future corroborating entries emerge. Tag for follow-up.',
] as const;

const LOW_RATIONALE = [
  'Standard account. No strong cross-corroboration markers detected. Anomaly density is below category average. Suitable for archive if detail value emerges later.',
  'Single-source general account with limited distinguishing anomaly markers. Category assignment is approximate. Consider archiving without a public thread.',
  'Brief or detail-sparse summary. Insufficient internal evidence to score confidently. Default-low assignment; curator judgment required.',
] as const;

function buildRationale(sig: DbRecoveredSignal): string {
  const h = strHash(sig.id);
  if (sig.anomaly_score >= 8) return pick(HIGH_RATIONALE, h);
  if (sig.anomaly_score >= 6) return pick(MED_RATIONALE,  h);
  return pick(LOW_RATIONALE, h);
}

// ---------------------------------------------------------------------------
// Safety flag checks
// ---------------------------------------------------------------------------

const SAFETY_CHECKS: ReadonlyArray<{
  pattern:  RegExp;
  type:     SafetyFlagType;
  severity: SafetyFlagSeverity;
  note:     string;
}> = [
  {
    pattern:  /\b(full\s+name|real\s+name|home\s+address|phone\s+number|email\s+address)\b/i,
    type:     'pii',
    severity: 'high',
    note:     'Possible personal identifying information in summary. Verify no real-world identity is exposed before publishing.',
  },
  {
    pattern:  /\b(dox|doxx|personally\s+identif)\b/i,
    type:     'doxxing',
    severity: 'high',
    note:     'Possible doxxing risk. Review carefully before any publication.',
  },
  {
    pattern:  /\b(how\s+to|step.by.step|instruc.*?(build|make|synthesize)|manufacture.*?(weapon|explosive))\b/i,
    type:     'illegal',
    severity: 'high',
    note:     'Possible instructional content detected. Review for illegal instructions before any publication.',
  },
  {
    pattern:  /\b(verbatim|full\s+text|copied\s+directly|paste\s+from|entire\s+transcript)\b/i,
    type:     'copyright',
    severity: 'medium',
    note:     "Possible verbatim reproduction of source material. Ensure summary is in the curator's own words.",
  },
  {
    pattern:  /\b(residential\s+address|property\s+records|street\s+address)\b/i,
    type:     'pii',
    severity: 'low',
    note:     'Location references detected. Confirm no identifiable residential addresses are included.',
  },
];

function checkSafety(sig: DbRecoveredSignal): SafetyFlag[] {
  const text  = `${sig.title} ${sig.summary}`;
  const flags: SafetyFlag[] = [];
  const seen  = new Set<string>();

  for (const { pattern, type, severity, note } of SAFETY_CHECKS) {
    if (pattern.test(text) && !seen.has(type)) {
      seen.add(type);
      flags.push({ type, severity, note });
    }
  }

  return flags;
}

// ---------------------------------------------------------------------------
// Duplicate risk
// ---------------------------------------------------------------------------

const COMMON_SOURCES = new Set<string>(['reddit', 'forum']);

function inferDuplicateRisk(sig: DbRecoveredSignal): DuplicateRisk {
  if (sig.anomaly_score >= 8) return 'low';
  if (COMMON_SOURCES.has(sig.source_type) && sig.anomaly_score <= 5) return 'medium';
  return 'low';
}

const DUPLICATE_RISK_NOTES: Record<DuplicateRisk, string> = {
  low:    'Signal vocabulary and source origin appear distinct from current archive entries.',
  medium: 'Source type is common. Similar accounts may exist — cross-reference by category before publishing.',
  high:   'High probability of archived duplicate. Manual cross-reference required before publish.',
};

// ---------------------------------------------------------------------------
// Publish recommendation
// ---------------------------------------------------------------------------

function inferRecommendation(
  sig:   DbRecoveredSignal,
  flags: SafetyFlag[],
): PublishRecommendation {
  if (flags.some((f) => f.severity === 'high')) return 'reject';
  if (sig.anomaly_score >= 7)                   return 'publish';
  if (sig.anomaly_score >= 5)                   return 'review';
  return 'archive';
}

const RECOMMENDATION_NOTES: Record<PublishRecommendation, string> = {
  publish: 'Anomaly score and signal pattern meet the threshold for archive publication.',
  review:  'Moderate anomaly score. Curator review and judgment required before deciding.',
  archive: 'Low anomaly score. Suitable for archive without a public thread.',
  reject:  'High-severity safety flag detected. Do not publish without resolving the flagged issue.',
};

// ---------------------------------------------------------------------------
// Confidence
// ---------------------------------------------------------------------------

function computeConfidence(sig: DbRecoveredSignal): number {
  const lengthFactor = Math.min(sig.summary.length / 450, 1.0);
  const tagFactor    = Math.min(sig.tags.length / 5, 1.0);
  const scoreFactor  = sig.anomaly_score / 10;
  const raw          = 0.38 + lengthFactor * 0.28 + tagFactor * 0.12 + scoreFactor * 0.12;
  return Math.round(raw * 20) * 5; // rounds to nearest 5%
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * analyzeRecoveredSignal — deterministic mock analysis.
 *
 * Returns the same output for the same input every time.
 * No external API is called. `isMock` is always `true`.
 *
 * Transition to live AI: replace this function body with an async call to
 * the analysis endpoint and change the return type to `Promise<SignalAnalysis>`.
 * The `isMock` field becomes `false` in the live implementation.
 * See docs/ai-scanner-readiness.md for the full plan.
 */
export function analyzeRecoveredSignal(sig: DbRecoveredSignal): SignalAnalysis {
  const safetyFlags      = checkSafety(sig);
  const suggestedCategory = inferCategory(sig);
  const duplicateRisk    = inferDuplicateRisk(sig);
  const recommendation   = inferRecommendation(sig, safetyFlags);

  return {
    suggestedCategory,
    categoryMatch:         suggestedCategory === sig.category,
    newTags:               inferNewTags(sig),
    anomalyRationale:      buildRationale(sig),
    safetyFlags,
    duplicateRisk,
    duplicateRiskNote:     DUPLICATE_RISK_NOTES[duplicateRisk],
    publishRecommendation: recommendation,
    recommendationNote:    RECOMMENDATION_NOTES[recommendation],
    confidence:            computeConfidence(sig),
    isMock:                true,
    analysisVersion:       '0.1-mock',
  };
}
