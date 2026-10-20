# SocraticCode — Research Methodology

## 1. Research Question

**Can AST-informed progressive Socratic feedback improve code understanding and independent problem-solving in beginner programmers, compared to direct solution delivery?**

---

## 2. Core Research Concept

**AST-Informed AI Tutoring with Progressive Socratic Programming Feedback**

The hypothesis is that combining verified structural code analysis (from concrete syntax trees) with a progressive hint system (3-level cognitive scaffolding) and solution-leakage guardrails produces more effective learning outcomes than a traditional code-completion or error-fixing tool.

---

## 3. Experimental Variables

### Independent Variables
1. **Tutoring modality** — Progressive Socratic hints vs. direct code correction
2. **Hint level progression** — Conceptual (L1) → Logical Reasoning (L2) → Structural Guidance (L3)
3. **Code analysis integration** — AI responses informed by real AST findings vs. generic responses

### Dependent Variables
1. **Hint depth reached** — Distribution of L1, L2, L3 requests (lower = more independence)
2. **Guardrail intervention rate** — Frequency of solution-leakage detection and fallback deployment
3. **Session count by language** — Engagement across supported languages
4. **Time to resolution** — Duration from first question to session clear/completion

### Control Variables
- Same code analysis engine (Tree-sitter) across all conditions
- Same system prompt policy across all AI interactions
- Same guardrail validation rules regardless of provider

---

## 4. System Design for Evaluation

### 4.1 Analytics Framework

SocraticCode records the following per interaction:

| Field | Type | Purpose |
|-------|------|---------|
| `id` | string | Unique session identifier |
| `timestamp` | number | UTC epoch for temporal analysis |
| `language` | string | Programming language analyzed |
| `question` | string | User's natural-language question |
| `maxHintLevel` | 1 \| 2 \| 3 | Deepest hint level reached in session |
| `provider` | string | AI provider used (Gemini / Demo) |
| `wasFallback` | boolean | Whether guardrails intercepted the response |

### 4.2 Metrics for Evaluation

| Metric | Source | Interpretation |
|--------|--------|----------------|
| L1/L2/L3 distribution | `AnalyticsStore.getSummary()` | Higher L1 proportion = students solving problems with less help |
| Guardrail rate | `guardrailInterventions / totalSessions` | Effectiveness of solution-leakage prevention |
| Provider comparison | Sessions where `provider = 'Demo'` vs `'Gemini'` | AI value-add over rule-based responses |
| Language coverage | `languages` record | Generalizability of the approach |

### 4.3 Guardrail Evaluation

The `ResponseValidator` is independently testable with the following test matrix:

| Test Case | Expected Result |
|-----------|-----------------|
| Valid L1 (no code, has question) | Pass |
| Valid L2 (small code fragment) | Pass |
| Valid L3 (pseudocode, < 25 lines) | Pass |
| L1 with code block | **Reject** |
| Complete function replacement | **Reject** |
| "Here is your corrected code" | **Reject** |
| Malformed response | **Reject** |
| Retry succeeds after first failure | Pass (on retry) |
| Both attempts fail | **Safe fallback deployed** |

**Documented limitation:** Heuristic guardrails can produce false positives (rejecting useful hints) and false negatives (missing some solution disclosures). The validator is a research mechanism, not a perfect guarantee.

---

## 5. Evaluation Protocol (Proposed)

### Phase 1: Technical Validation
- [x] Unit tests for all modules (45 tests, 13 suites)
- [x] Parser accuracy on representative fixtures (Python and C)
- [x] Guardrail test matrix coverage
- [x] Extension compiles, builds, and packages

### Phase 2: Functional Walkthrough
- [ ] Manual testing with 5–10 representative Python programs
- [ ] Verify hint progression (L1 → L2 → L3) produces meaningfully different guidance
- [ ] Verify guardrails intercept at least 1 intentional solution leak
- [ ] Verify Demo Mode produces useful contextual responses

### Phase 3: User Study (If Applicable)
- [ ] Recruit 5–10 beginner programmers
- [ ] Assign debugging tasks with SocraticCode
- [ ] Record hint level distributions via the Learning Dashboard
- [ ] Compare pre/post understanding through brief interview or quiz
- [ ] Collect qualitative feedback on hint usefulness

---

## 6. Limitations and Threats to Validity

### Internal Validity
- **Guardrail heuristics** may not catch all solution leakage patterns, especially novel phrasing
- **AI model behavior** varies by prompt, temperature, and model version — results may differ across Gemini model updates
- **Demo mode** uses deterministic responses that do not adapt to complex or unusual code structures

### External Validity
- Currently supports only **Python and C** — findings may not generalize to other languages
- Tested with **Google Gemini free tier** — behavior may differ with other AI providers
- Beginner programmer population may not represent all learners

### Construct Validity
- "Independent problem-solving" is measured indirectly through hint depth distribution, not through direct assessment of code quality
- Session metadata does not capture whether the student actually understood the hint

---

## 7. Ethical Considerations

- **No automatic code transmission** — user explicitly initiates every AI interaction
- **No personal data collection** — analytics are local to the VS Code instance
- **API key security** — stored in OS credential manager via `SecretStorage`
- **Transparent AI labeling** — Demo Mode responses are never labeled as AI-generated
- **No claim of completeness** — guardrails documented as heuristic, not guaranteed
