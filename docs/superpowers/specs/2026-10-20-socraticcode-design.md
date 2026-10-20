# SocraticCode — Design Document

> **Product:** SocraticCode — AI-Powered Programming Education & Debugging Assistant
> **Platform:** Visual Studio Code Extension
> **Tagline:** Think Better. Code Smarter.
> **Author:** Niraj (with AI pair-programming support)
> **Date:** 2026-10-20
> **Status:** Draft — Awaiting Review

---

## 1. Intent and the Why

### The Problem

AI tools like ChatGPT have become the default "tutor" for beginner programmers. But they teach students to **copy, not to think**. A student pastes their broken code, gets a working solution back, submits it — and learns nothing. The feedback loop that builds genuine understanding (struggle → hypothesis → test → insight) is completely bypassed.

### The Solution

**SocraticCode** is a VS Code extension that reverses this dynamic. Instead of giving answers, it asks questions. Instead of writing code for the student, it helps the student understand their own code — using actual structural analysis of what they've written, combined with AI-powered Socratic questioning at progressively more specific hint levels.

The core research concept: **AST-Informed AI Tutoring with Progressive Socratic Programming Feedback.**

The educational workflow: **ANALYZE → QUESTION → GUIDE → REASON → LEARN**

### Why Now

- AI coding tools are everywhere, but none are designed for *learning*
- Tree-sitter makes real, fast, in-editor code analysis practical
- Gemini's free tier makes AI-powered tutoring accessible to students with zero budget
- VS Code is the dominant editor among CS students — the extension meets them where they already work

### What Success Looks Like

A student opens their buggy Python file, clicks "Analyze," gets a guiding question that makes them look at their loop condition differently, traces through the logic themselves, and fixes the bug — understanding *why* it was wrong. The evaluator installs the VSIX, tries it with demo mode, and sees genuine pedagogical value.

---

## 2. Goals, Non-Goals, and Anti-Goals

### Goals

1. **Working VS Code extension** that installs from a VSIX and activates without errors
2. **Real code structure analysis** using Tree-sitter for Python (primary) and C (if low-effort)
3. **Progressive 3-level Socratic hints** — conceptual → logical reasoning → structural guidance
4. **Gemini AI integration** with secure API key storage and a meaningful tutor prompt
5. **Demo mode** that works fully without an API key — real parsing, deterministic tutoring responses
6. **Solution-leakage guardrails** — validate AI responses to prevent handing out complete solutions
7. **Local learning analytics** — session history, hint usage, concept tracking
8. **Research documentation** — methodology, evaluation framework, architecture diagrams
9. **Professional sidebar UI** integrated with VS Code's look and feel
10. **Automated tests** for parser, guardrails, and core tutor logic

### Non-Goals (Not Now, Maybe Later)

- VS Code Marketplace publishing (local VSIX is sufficient for RP)
- Multiple AI providers (architecture supports it, but only Gemini is implemented)
- Java and C++ language support (future scope, documented in the paper)
- Real-time collaboration features
- Cloud-based analytics or telemetry
- Mobile or web-based interfaces

### Anti-Goals (Would Make This a Failure Even If It "Works")

- **Becoming another ChatGPT wrapper** — if it just sends code to Gemini and shows the response, it has failed its entire purpose
- **Fabricating analysis results** — showing fake variables, invented line numbers, or pretending parsing succeeded when it didn't
- **Oversized, flashy UI that doesn't feel like VS Code** — it should feel like a native developer tool, not a web app crammed into a sidebar
- **Hardcoded API keys or insecure credential handling**
- **Auto-executing student code** — the extension analyzes structure, never runs code
- **Claiming the guardrails are perfect** — they reduce leakage, they don't eliminate it; the paper must be honest

---

## 3. Target Users

**Primary:** Beginner programmers and CS students (SEM 1-4) who:
- Are learning Python (or C) as their first/second language
- Use VS Code as their editor
- Struggle with debugging and understanding why their code doesn't work
- Currently rely on ChatGPT for help and get solutions instead of understanding

**Secondary:** The RP evaluator / faculty who:
- Needs to install and try the extension quickly
- Wants to see genuine research value and technical depth
- Evaluates based on working functionality, not just documentation

---

## 4. Architecture Overview

```
┌──────────────────────────────────────────────────────┐
│                    VS Code Host                       │
│                                                      │
│  ┌────────────┐    ┌─────────────────────────────┐   │
│  │  Commands   │    │     Webview Sidebar          │   │
│  │  & Menus    │───▶│  (HTML/CSS/JS)              │   │
│  └────────────┘    │  - Branding & Status         │   │
│                    │  - Question Input             │   │
│       ▲            │  - Hint Cards (L1/L2/L3)     │   │
│       │            │  - Analysis Findings          │   │
│       │            │  - Session History            │   │
│       │            │  - Analytics Dashboard        │   │
│       │            └──────────┬──────────────────┘   │
│       │                       │ postMessage           │
│       │                       ▼                       │
│  ┌────┴───────────────────────────────────────────┐  │
│  │              Extension Host (TypeScript)         │  │
│  │                                                  │  │
│  │  ┌──────────────┐  ┌──────────────────────────┐ │  │
│  │  │ Analysis      │  │ Tutor Service             │ │  │
│  │  │ Service       │  │  - Hint Level State       │ │  │
│  │  │               │  │  - Session History        │ │  │
│  │  │ ┌───────────┐ │  │  - Prompt Builder         │ │  │
│  │  │ │ Python    │ │  │                            │ │  │
│  │  │ │ Adapter   │ │  └──────────┬───────────────┘ │  │
│  │  │ ├───────────┤ │             │                  │  │
│  │  │ │ C Adapter │ │             ▼                  │  │
│  │  │ │ (if added)│ │  ┌──────────────────────────┐ │  │
│  │  │ └───────────┘ │  │ AI Provider Interface     │ │  │
│  │  │               │  │  ┌────────────────────┐  │ │  │
│  │  │ Tree-sitter   │  │  │ Gemini Provider    │  │ │  │
│  │  │ Parsers       │  │  ├────────────────────┤  │ │  │
│  │  └──────────────┘  │  │ Demo Provider      │  │ │  │
│  │                     │  └────────────────────┘  │ │  │
│  │  ┌──────────────┐  └──────────────────────────┘ │  │
│  │  │ Guardrails   │                                │  │
│  │  │ (Validation) │  ┌──────────────────────────┐ │  │
│  │  └──────────────┘  │ Analytics Store           │ │  │
│  │                     │ (VS Code State)           │ │  │
│  │                     └──────────────────────────┘ │  │
│  └──────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────┘
```

### Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Parser | Tree-sitter (via `web-tree-sitter`) | Works in Node.js/WASM, fast, real grammars for Python and C |
| AI Provider | Google Gemini API (free tier) | Zero cost for students, good quality |
| UI Framework | VS Code Webview API (raw HTML/CSS/JS) | No framework overhead, direct VS Code integration |
| Build Tool | esbuild | Fast, simple, good VS Code extension support |
| Test Framework | Vitest | Fast, TypeScript-native, good DX |
| State Storage | VS Code ExtensionContext globalState/workspaceState | No external DB needed, persists across sessions |
| Credentials | VS Code SecretStorage | Built-in secure storage, no custom crypto |
| Packaging | @vscode/vsce | Standard VS Code extension packaging |

---

## 5. Core Components — What Gets Built

### 5A. Code Analysis Engine

**What it does:** Takes a source file, parses it with Tree-sitter, and extracts structured findings — functions, variables, loops, conditions, return statements, function calls, with source locations.

**Languages:**
- **Python** — Full support. Tree-sitter Python grammar via WASM.
- **C** — If adding the C grammar WASM and writing the adapter takes less than ~2 hours of effort beyond the Python adapter. Same Tree-sitter infrastructure, different query patterns. Decision: include it, since the adapter pattern makes it low-cost.
- **Java, C++** — Future scope. Architecture supports adding them.

**Key rules:**
- Never fabricate findings. If parsing fails, say so.
- Never execute student code.
- Report partial analysis honestly when code is malformed.
- Source locations (line numbers) come from the parser, not guesses.

**Output structure:**
```typescript
interface AnalysisResult {
  language: string;
  status: 'success' | 'partial' | 'error';
  functions: FunctionInfo[];
  variables: VariableInfo[];
  loops: LoopInfo[];
  conditions: ConditionInfo[];
  functionCalls: CallInfo[];
  returnStatements: ReturnInfo[];
  diagnostics: ParserDiagnostic[];
  rawStructure?: string; // simplified structural summary
}
```

### 5B. Progressive 3-Level Hint Engine

**What it does:** Manages hint state per session and enforces the progression rules.

**Level 1 — Conceptual:** "Think about the condition controlling this loop. Under what circumstances will that condition become false?"

**Level 2 — Logical Reasoning:** "Trace how the loop variable `i` changes during each iteration. Does it move closer to the condition that terminates the loop?"

**Level 3 — Structural Guidance:** "Consider initializing the counter before the loop, updating it on each iteration, and checking that the termination condition can eventually be satisfied. Here's the general pattern in pseudocode..."

**Rules:**
- Student must explicitly request next hint (button click)
- Never skip levels
- Clarifying questions don't reset the level
- Level 3 ≠ "give the full solution"
- Each request is recorded for analytics

### 5C. Socratic Tutor Service

**What it does:** Orchestrates the tutoring interaction — takes the student's question, the code context, the analysis findings, and the current hint level, then builds a prompt and gets a response (from AI or demo provider).

**Inputs:**
- Programming language
- Student's question
- Selected code OR current file (explicit action only)
- Analysis findings from 5A
- Current hint level
- Session history (recent turns)

**Key rules:**
- Never send entire files automatically — prefer selected code + analysis
- Distinguish verified parser observations from hypotheses
- Acknowledge uncertainty when evidence is insufficient
- Responses must be relevant, concise, and beginner-appropriate

### 5D. AI Provider — Gemini Integration

**What it does:** Sends structured prompts to Google Gemini API and parses responses.

**Provider interface (modular):**
```typescript
interface AIProvider {
  name: string;
  isConfigured(): Promise<boolean>;
  generateResponse(request: TutorRequest): Promise<TutorResponse>;
  testConnection(): Promise<boolean>;
}
```

**Gemini specifics:**
- Uses `@google/generative-ai` SDK (official)
- Model: `gemini-2.0-flash` (free tier, fast, capable)
- API key stored in VS Code SecretStorage
- Timeout: 30 seconds
- Max 2 retries on transient failures
- Rate limit handling with user-friendly messages

**Credential flow:**
1. User runs "Configure AI Provider" command
2. Input box asks for Gemini API key
3. Key stored in SecretStorage (never logged, never shown in full)
4. Status shown in sidebar (configured / not configured / error)
5. User can remove/replace key anytime

### 5E. Demo Mode

**What it does:** Provides a fully functional tutoring experience without an API key.

**How it works:**
- Real parsing still happens (Tree-sitter runs locally)
- Tutoring responses are deterministic, rule-based
- Responses use the actual language, analysis findings, and hint level
- Clearly labelled as "Demo Mode" in the UI
- Never claims to be AI-generated

**Rule-based response strategy:**
- Detect common patterns (missing return, infinite loop, unused variable, off-by-one, etc.) from analysis findings
- Map patterns to pre-written Socratic question templates
- Fill templates with actual variable names, line numbers, construct types from analysis
- Provide distinct responses for each hint level
- Generic fallback for patterns not in the template library

### 5F. Solution-Leakage Guardrails

**What it does:** Validates AI responses before showing them to the student.

**Checks:**
1. Code-block length — reject responses with >15 lines of code at Level 1, >25 at Level 2
2. Complete-program detection — reject if response contains a full replacement program (has main/function def + logic + return that matches the student's structure)
3. Hint-level policy — Level 1 must not contain code blocks, Level 2 may have small fragments, Level 3 may have pseudocode
4. Direct-answer detection — pattern matching for "here's the fix", "change X to Y", "the corrected code is"
5. Structured response validation — response must have explanation + guiding question sections

**Recovery:**
1. Reject invalid response
2. Re-prompt with stricter instructions (one retry)
3. If retry fails, return safe fallback (generic Socratic question based on analysis)
4. Inform student response was adjusted

**Documented limitations:** Heuristics. Can miss some leaks. Can flag legitimate hints. Paper must be honest about this.

### 5G. Sidebar UI (Webview)

**What it does:** The student-facing interface, integrated into VS Code's activity bar.

**Sections:**
1. **Header** — SocraticCode branding, language badge, file name, provider status
2. **Analysis Panel** — "Analyze Code" button, findings display with source locations
3. **Question Panel** — Text input, "Ask" button, "Ask About Selection" button
4. **Hint Cards** — Progressive cards showing L1/L2/L3 responses, "Next Hint" button
5. **Session History** — Collapsible past interactions
6. **Analytics Link** — Opens dashboard in a webview panel
7. **Footer** — Demo mode indicator, clear session, settings

**Design principles:**
- Dark by default, respects VS Code CSS variables (`--vscode-*`)
- Compact cards, professional spacing
- No flashy gradients or oversized elements — feels like a native VS Code panel
- Safe rendering (sanitize AI output before display)
- Keyboard accessible
- Responsive for narrow sidebars (min-width ~300px)

### 5H. Learning Analytics

**What it does:** Tracks and displays local learning activity.

**Stored data (VS Code globalState):**
- Sessions: timestamp, language, file, questions asked, hints requested per level
- Aggregates: total sessions, questions by language, hint progression patterns, common concepts
- No PII beyond what's in the code they analyze

**Dashboard:**
- Total sessions and questions
- Hint level distribution (how often L1 vs L2 vs L3)
- Language breakdown
- Recent session list
- "Clear All Data" button

### 5I. VS Code Commands

| Command | Action |
|---------|--------|
| `SocraticCode: Open Tutor` | Opens/focuses the sidebar |
| `SocraticCode: Analyze Current File` | Runs parser on active file, shows findings |
| `SocraticCode: Ask About Selected Code` | Sends selection + question to tutor |
| `SocraticCode: Request Next Hint` | Advances hint level and gets next response |
| `SocraticCode: Open Learning Dashboard` | Opens analytics panel |
| `SocraticCode: Clear Learning Session` | Clears current session state |
| `SocraticCode: Configure AI Provider` | Prompts for Gemini API key |
| `SocraticCode: Switch Demo Mode` | Toggles between AI and demo provider |

---

## 6. Constraints

1. **Windows development environment** — all scripts and paths must work on Windows/PowerShell
2. **No auto-browsing or auto-running by the AI assistant** — Niraj tests manually and reports results
3. **Gemini free tier only** — no paid API dependencies
4. **VS Code extension environment** — Node.js runtime, WASM for Tree-sitter, no native modules that won't bundle
5. **VSIX packaging** — must produce a locally installable .vsix file
6. **No code execution** — the extension never runs student code
7. **No cloud infrastructure** — everything runs locally
8. **Tree-sitter WASM compatibility** — parsers must work via `web-tree-sitter` WASM bindings, not native Node bindings
9. **Research project standards** — needs clear documentation, reproducible setup, honest evaluation

---

## 7. Technical Risks and Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Tree-sitter WASM setup is tricky in VS Code extensions | Medium | High | Validate with a minimal Python parse test in Phase 2 before building anything on top |
| Gemini free tier rate limits hit during demo | Low | Medium | Demo mode as fallback, rate limit handling with clear user messages |
| Guardrails produce too many false positives | Medium | Medium | Tunable thresholds, tested with diverse fixtures, documented limitations |
| VSIX packaging fails with WASM assets | Medium | High | Test packaging early (Phase 2), ensure `.wasm` files are in `dist/` |
| esbuild doesn't bundle WASM properly | Medium | Medium | Copy WASM files as static assets, not bundled imports |

---

## 8. File Structure (Planned)

```
SocraticCode/
├── .vscode/
│   ├── launch.json              # Extension debug config
│   └── tasks.json               # Build tasks
├── src/
│   ├── extension.ts             # Entry point, activation, command registration
│   ├── commands/
│   │   └── index.ts             # All command handlers
│   ├── analysis/
│   │   ├── types.ts             # AnalysisResult, SourceLocation, etc.
│   │   ├── analysisService.ts   # Orchestrates parsing
│   │   ├── pythonAdapter.ts     # Python Tree-sitter adapter
│   │   └── cAdapter.ts          # C Tree-sitter adapter (if included)
│   ├── tutor/
│   │   ├── types.ts             # TutorRequest, TutorResponse, HintLevel
│   │   ├── tutorService.ts      # Orchestrates tutoring workflow
│   │   ├── hintEngine.ts        # Hint level state and progression
│   │   ├── promptBuilder.ts     # Builds structured prompts
│   │   └── systemPrompt.ts      # Version-controlled tutor system prompt
│   ├── providers/
│   │   ├── types.ts             # AIProvider interface
│   │   ├── geminiProvider.ts    # Google Gemini implementation
│   │   └── demoProvider.ts      # Local deterministic provider
│   ├── guardrails/
│   │   ├── types.ts             # ValidationResult, ValidationCheck
│   │   ├── validator.ts         # Response validation orchestrator
│   │   └── checks/              # Individual check implementations
│   │       ├── codeBlockCheck.ts
│   │       ├── completeProgramCheck.ts
│   │       ├── hintLevelPolicyCheck.ts
│   │       └── directAnswerCheck.ts
│   ├── analytics/
│   │   ├── types.ts             # Session, AnalyticsEvent
│   │   ├── analyticsStore.ts    # Persistence via globalState
│   │   └── analyticsService.ts  # Aggregation and queries
│   ├── webview/
│   │   ├── sidebarProvider.ts   # WebviewViewProvider implementation
│   │   └── dashboardPanel.ts    # Analytics webview panel
│   └── utils/
│       ├── languageDetector.ts  # File → language mapping
│       └── sanitizer.ts        # HTML sanitization for webview
├── webview/
│   ├── sidebar/
│   │   ├── index.html           # Sidebar webview HTML
│   │   ├── styles.css           # Sidebar styles (VS Code theme vars)
│   │   └── main.js              # Sidebar client-side logic
│   └── dashboard/
│       ├── index.html           # Dashboard webview HTML
│       ├── styles.css           # Dashboard styles
│       └── main.js              # Dashboard client-side logic
├── parsers/                     # Tree-sitter WASM files (copied at build)
│   ├── tree-sitter.wasm
│   ├── tree-sitter-python.wasm
│   └── tree-sitter-c.wasm       # If C adapter included
├── test/
│   ├── unit/
│   │   ├── analysis/
│   │   │   ├── pythonAdapter.test.ts
│   │   │   └── cAdapter.test.ts
│   │   ├── tutor/
│   │   │   ├── hintEngine.test.ts
│   │   │   └── promptBuilder.test.ts
│   │   ├── guardrails/
│   │   │   └── validator.test.ts
│   │   └── analytics/
│   │       └── analyticsStore.test.ts
│   └── fixtures/
│       ├── python/
│       │   ├── simple_function.py
│       │   ├── loop_with_bug.py
│       │   ├── missing_return.py
│       │   └── syntax_error.py
│       └── c/
│           ├── hello_world.c
│           └── array_bug.c
├── docs/
│   ├── architecture.md          # System architecture documentation
│   ├── research-methodology.md  # Research framing and evaluation
│   ├── setup-guide.md           # Reproducible setup instructions
│   └── superpowers/
│       ├── specs/               # Design documents
│       └── plans/               # Implementation plans
├── resources/
│   └── icon.png                 # Extension icon
├── package.json                 # Extension manifest
├── tsconfig.json                # TypeScript config (strict)
├── esbuild.js                   # Build script
├── vitest.config.ts             # Test configuration
├── .vscodeignore                # Files excluded from VSIX
├── .gitignore
├── CHANGELOG.md
└── README.md                    # User-facing documentation
```

---

## 9. Phased Delivery (High-Level)

These phases map to the GEMINI.md milestones but are grouped for practical delivery:

| Phase | What Gets Built | What You Can Show |
|-------|----------------|-------------------|
| **Phase 1: Foundation** | Project scaffold, extension entry point, sidebar shell, commands registered, builds and launches | Extension appears in VS Code with icon and empty sidebar |
| **Phase 2: Code Analysis** | Tree-sitter setup, Python adapter, analysis service, parser tests, findings display | Sidebar shows real structural analysis of Python files |
| **Phase 3: Socratic Tutor + Demo** | Hint engine, demo provider, tutor service, question input, hint cards, session history | Full tutoring workflow works without API key |
| **Phase 4: Gemini AI** | Gemini provider, secure key storage, prompt builder, real AI tutoring | Live AI-powered Socratic tutoring |
| **Phase 5: Guardrails** | Response validator, all checks, recovery flow, guardrail tests | AI responses are validated before display |
| **Phase 6: Analytics & Polish** | Analytics store, dashboard, C adapter (if time), final UI polish | Learning dashboard, complete feature set |
| **Phase 7: Research & Package** | Documentation, architecture diagrams, evaluation framework, VSIX packaging | Installable VSIX, complete RP submission package |

**Code review happens at the end of each phase** — we review what was built, verify it works, identify issues, and fix before moving on.

---

## 10. Decisions Left to the Builder (Implementation Plan)

These are resolved during detailed task planning, not in this design:

- Exact Tree-sitter query patterns for each language construct
- Demo response template library — specific patterns and questions
- Guardrail threshold values (code block line limits, etc.) — tuned during testing
- Exact Gemini model parameters (temperature, top-p, max tokens)
- Analytics data schema details
- Specific CSS values for the sidebar (follows VS Code theme vars)
- Commit message conventions
- Test fixture content

---

## 11. What This Is NOT

To be explicit and aligned with GEMINI.md anti-goals:

- **Not a ChatGPT wrapper.** The AI is one component. The extension's value comes from AST analysis + progressive hints + guardrails.
- **Not a code generator.** It never writes code for the student.
- **Not a mockup or landing page.** Every component described here will be implemented as working code.
- **Not a linter or compiler.** It analyzes structure, not correctness. It doesn't claim bugs unless evidence supports it.
- **Not infallible.** Guardrails reduce leakage, they don't eliminate it. The parser gives structural information, not semantic proof. The paper will be honest about limitations.

---

## 12. Tutor System Prompt (Base Policy)

```
You are SocraticCode, an educational programming tutor.

Your primary goal is to help students understand code and develop independent
problem-solving skills.

Use the supplied programming language, student question, code context, and
verified code-analysis findings to provide targeted guidance.

RULES:
1. Never provide the complete solution or corrected code.
2. Ask guiding questions that help the student reason about their code.
3. Reference specific variables, functions, and line numbers from the
   analysis when relevant.
4. Distinguish between verified parser observations and your hypotheses.
5. Match your response to the requested hint level:
   - Level 1: Conceptual — explain the relevant concept, ask a guiding
     question, no code.
   - Level 2: Logical reasoning — reference specific code elements, ask
     the student to trace or predict behavior, small fragments OK.
   - Level 3: Structural guidance — describe an approach, limited
     pseudocode OK, but never the complete implementation.
6. Be concise, respectful, and appropriate for beginner programmers.
7. If the evidence is insufficient to diagnose the issue, say so.
8. Never claim you executed the code or observed runtime behavior.
9. Never fabricate variables, line numbers, or analysis results.
10. Encourage the student to test their understanding by making predictions.
```

---

*This document captures the full design as discussed. The detailed implementation plan will be created after this design is approved.*
