# AI Scanner Readiness — Integration Plan

Status: **PLANNED — no AI API is connected.**
All current analysis is mock/deterministic. See `lib/ai-analysis.ts`.

---

## 1. Architecture intent

The SWIM scanner intake pipeline is designed in three phases:

```
Phase 1 (current)
  Manual curator intake
  → curator writes summaries
  → curator sets category, tags, anomaly score
  → human approves / rebirths

Phase 2 (planned)
  Curator intake + AI analysis assist
  → AI suggests category, tags, rationale, safety flags
  → curator reviews AI suggestions before acting
  → human approval still required for every publish

Phase 3 (future)
  Partial automation
  → AI summarizes source material
  → AI drafts analysis report
  → curator approves or edits before publish
  → human approval gate never removed
```

**The human approval gate is permanent.** No automated pathway will publish
content to public threads without explicit curator confirmation.

---

## 2. Planned API integration

### Preferred model: Claude (Anthropic)

Claude is the preferred model for signal analysis because:
- Instruction-following for structured JSON output
- Strong safety refusals for illegal / doxxing / harmful content
- Summarization quality on irregular source text
- Cost-per-call fits batch intake workflow

Alternative: OpenAI GPT-4o for bulk classification if cost is a constraint.

### Call pattern

```typescript
// Future implementation of analyzeRecoveredSignal()
// (replaces the mock body in lib/ai-analysis.ts)

export async function analyzeRecoveredSignal(
  sig: DbRecoveredSignal,
): Promise<SignalAnalysis> {
  const response = await anthropic.messages.create({
    model: 'claude-opus-4-7',
    max_tokens: 600,
    system: ANALYSIS_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: buildAnalysisPrompt(sig) }],
  });

  return parseAnalysisResponse(response, sig);
}
```

The `SignalAnalysis` interface in `lib/ai-analysis.ts` is the stable contract.
UI callers require no changes when the implementation goes live.

### Environment variable required

```
ANTHROPIC_API_KEY=sk-ant-...
```

Add to `.env.local` for local dev. Add to Vercel/hosting env for production.
This key must never appear in the client bundle. Call only from server actions
or server components.

---

## 3. Prompt design rules

### System prompt principles

The analysis system prompt must include all of the following constraints:

1. **Summarize, never copy.** The model must produce summaries in its own words.
   No verbatim reproduction of source material.
2. **No doxxing.** If the source contains real names, addresses, contact info,
   or other personally identifying information, the model must flag it and
   exclude it from any output or summary.
3. **No illegal instructions.** If the source contains instructions for illegal
   activities (drug synthesis, weapon construction, fraud, etc.), the model
   must flag it with severity=high and recommend `reject`. It must not
   reproduce or summarize the instructions.
4. **No speculative real-world attribution.** The model must not name real
   individuals as responsible for anomalous events without verified sourcing.
5. **Copyright safety.** Summaries must be paraphrases. If the model detects
   likely verbatim copying in the curator's draft, it flags it.
6. **Structured output only.** The model returns JSON matching `SignalAnalysis`.
   No free-form prose outside the defined fields.

### Example system prompt (abbreviated)

```
You are a signal analyst for an anomaly archive.
Your role is to evaluate recovered signals for publication.

Rules:
- Return valid JSON only, matching the SignalAnalysis schema.
- Summarize in your own words. Never reproduce verbatim source text.
- If PII is detected in the input, flag it (type: "pii", severity: "high").
- If illegal instructions are detected, flag them (type: "illegal",
  severity: "high") and set publishRecommendation to "reject".
- If doxxing risk is detected, flag it (type: "doxxing", severity: "high").
- Be concise and factual in anomalyRationale. No embellishment.
- isMock must always be false in live output.
```

---

## 4. Source summarization rules

These rules apply to all curator intake AND future automated summarization:

| Rule | Detail |
|------|--------|
| **Own words** | Every summary must be written or reviewed by a curator in their own words. No paste-from-source. |
| **No personal info** | Real names, addresses, usernames that could identify real people must be removed or generalized. |
| **No illegal content** | If the source describes or instructs illegal activity, the signal is rejected. The summary must not reproduce it. |
| **Atmospheric, not instructional** | Summaries describe *that* something strange happened, not *how* to reproduce it. |
| **Source acknowledgment** | Source name and type are always recorded. URL is optional but preferred for archival traceability. |
| **Anomaly score honesty** | Score reflects cross-corroboration and pattern strength, not how interesting the curator finds it. Scores ≥ 7 require at least two corroborating accounts or a strong single-source with specific verifiable detail. |
| **No speculation about real individuals** | Do not name living or dead real people as participants in anomalous events without documented sourcing. |

---

## 5. Safety flag handling

The `safetyFlags` array in `SignalAnalysis` follows this severity matrix:

| Severity | Action required |
|----------|----------------|
| `high`   | Signal must not be published. Curator must resolve or reject. Publish recommendation is auto-set to `reject`. |
| `medium` | Curator must review the flagged section before approving. Does not block publish automatically. |
| `low`    | Informational. Curator should be aware but no action is required. |

Flag types:
- `pii` — personal identifying information (name, address, contact details)
- `doxxing` — content that could identify or expose a real individual
- `illegal` — instructions or content for illegal activity
- `copyright` — likely verbatim reproduction of copyrighted material
- `other` — catch-all for edge cases

---

## 6. Human approval requirement

This is non-negotiable at every phase:

- **Phase 1, 2, 3**: A curator must click an explicit action (Approve / Rebirth as Thread) before any content reaches the public archive.
- No signal transitions from `pending` to `approved` automatically.
- No thread is created from a signal without curator confirmation.
- AI analysis output is advisory only. It does not change signal status.
- The `publishRecommendation` field in `SignalAnalysis` is a suggestion,
  not an instruction. The curator may override it at any time.

---

## 7. Transition checklist (Phase 1 → Phase 2)

- [ ] Add `ANTHROPIC_API_KEY` to hosting environment
- [ ] Implement `buildAnalysisPrompt(sig)` in `lib/ai-analysis.ts`
- [ ] Implement `parseAnalysisResponse(response, sig)` with schema validation
- [ ] Change `analyzeRecoveredSignal` to async, update all call sites
- [ ] Add server action wrapper: `analyzeSignalAction(signalId: string)`
- [ ] Add "re-analyze" button to curator queue card
- [ ] Remove `isMock: true` hard-coding from the live path
- [ ] Store analysis result in `recovered_signals` as JSONB column (schema migration required)
- [ ] Add rate limiting: max N analyses per minute per curator session
- [ ] Log all analysis calls to `scanner_analysis_log` table for audit trail

---

## 8. What is NOT planned

- Autonomous scraping of external sites
- Automatic publishing without human approval
- Auto-posting to Telegram or X without human confirmation
- Training on SWIM archive data
- Storing user fingerprints in the analysis pipeline
- Analysis of reply content or reaction data
