# SocraticCode — System Architecture

## 1. Overview

SocraticCode is a VS Code extension that provides AST-informed, progressive Socratic tutoring for beginner programmers. The system integrates real code structure analysis with AI-assisted pedagogy, enforced through solution-leakage guardrails.

**Core Educational Workflow:**

```
ANALYZE → QUESTION → GUIDE → REASON → LEARN
```

---

## 2. High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   VS Code Extension Host                 │
│                                                          │
│  ┌──────────┐    ┌──────────────┐    ┌───────────────┐  │
│  │ Commands  │───▶│  extension.ts │───▶│ SidebarProvider│  │
│  │ (8 cmds)  │    │  (Entry Point)│    │  (Webview UI)  │  │
│  └──────────┘    └──────┬───────┘    └───────────────┘  │
│                         │                                │
│            ┌────────────┼────────────┐                   │
│            ▼            ▼            ▼                   │
│  ┌──────────────┐ ┌───────────┐ ┌──────────────┐       │
│  │AnalysisService│ │TutorService│ │AnalyticsStore│       │
│  │              │ │           │ │              │       │
│  │ PythonAdapter │ │ HintEngine │ │ globalState  │       │
│  │ CAdapter      │ │ Guardrails │ │ persistence  │       │
│  └──────┬───────┘ └─────┬─────┘ └──────────────┘       │
│         │               │                                │
│    Tree-sitter     ┌────┴────┐                           │
│    WASM Parsers    │Provider │                           │
│                    │Interface│                           │
│                    └────┬────┘                           │
│                   ┌─────┴─────┐                          │
│                   │           │                          │
│             DemoProvider  GeminiProvider                  │
│             (offline)     (API + SecretStorage)          │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Module Descriptions

### 3.1 Analysis Engine (`src/analysis/`)

**Purpose:** Produce structured, language-aware findings from source code using real parsers.

| Component | Responsibility |
|-----------|---------------|
| `types.ts` | Shared interfaces: `AnalysisResult`, `FunctionInfo`, `LoopInfo`, `ConditionInfo`, `CallInfo`, `ReturnInfo`, `VariableInfo`, `ParserDiagnostic`, `SourceLocation` |
| `analysisService.ts` | Multi-language adapter registry. Dispatches parsing to the correct adapter based on detected language. |
| `pythonAdapter.ts` | Tree-sitter Python parser. Extracts functions, loops, conditions, variables, calls, returns, and syntax errors from a concrete syntax tree. |
| `cAdapter.ts` | Tree-sitter C parser. Handles `function_definition`, `while_statement`, `for_statement`, `do_statement`, `if_statement`, `declaration`, `call_expression`, `return_statement`. |
| `languageDetector.ts` | Maps VS Code `languageId` and file extensions to supported language keys. |

**Parser Note:** Tree-sitter produces *concrete* syntax trees (CSTs). The adapters derive normalized structural features for tutoring, which are described as "AST-informed" in the research context. This is not identical to a compiler's abstract syntax tree.

### 3.2 Tutor Engine (`src/tutor/`)

**Purpose:** Orchestrate the Socratic tutoring conversation with progressive hints.

| Component | Responsibility |
|-----------|---------------|
| `types.ts` | `TutorRequest`, `TutorResponse`, `HintLevel` (1 \| 2 \| 3), `ChatTurn`, `TutorSession` |
| `hintEngine.ts` | State machine managing hint level progression (0 → 1 → 2 → 3). Prevents skipping levels. Tracks whether more hints are available. |
| `tutorService.ts` | Central orchestrator. Calls the active AI provider, validates responses through guardrails, manages retry/fallback, records chat history. |
| `promptBuilder.ts` | Constructs the system prompt for AI providers incorporating the Socratic policy, hint-level rules, and code analysis context. |

### 3.3 AI Providers (`src/providers/`)

**Purpose:** Abstraction layer for AI response generation.

| Component | Responsibility |
|-----------|---------------|
| `types.ts` | `AIProvider` interface with `generateResponse(request: TutorRequest): Promise<TutorResponse>` |
| `demoProvider.ts` | Rule-based offline provider. Generates contextual Socratic responses based on detected loops, syntax errors, and missing returns. |
| `geminiProvider.ts` | Google Gemini API client. Auto-discovers working models (`gemini-3.5-flash-lite`, `gemini-3.8-flash`). Handles timeouts, errors, and response parsing. |
| `keyManager.ts` | Wraps VS Code `SecretStorage` for encrypted API key management. |

### 3.4 Guardrails (`src/guardrails/`)

**Purpose:** Independent response validation to reduce solution leakage.

| Component | Responsibility |
|-----------|---------------|
| `types.ts` | `ValidationResult` interface |
| `validator.ts` | `ResponseValidator` with 6 checks: missing guiding question, Level 1 code ban, Level 2/3 line caps, complete function detector, direct giveaway phrases |
| `safeFallback.ts` | `SafeFallbackGenerator` produces deterministic, level-appropriate safe responses when validation fails twice |

**Recovery Flow:**
1. AI response → validate → if valid → return
2. If invalid → inject policy reminder → regenerate → validate
3. If still invalid → deploy safe deterministic fallback with `isFallback: true`

### 3.5 Analytics (`src/analytics/`)

**Purpose:** Track learning sessions for research evaluation.

| Component | Responsibility |
|-----------|---------------|
| `types.ts` | `LearningSessionRecord`, `AnalyticsSummary` |
| `analyticsStore.ts` | Persistence layer using VS Code `globalState`. Records sessions, aggregates hint distributions, counts guardrail interventions. |

### 3.6 Webview UI (`src/webview/`)

| Component | Responsibility |
|-----------|---------------|
| `sidebarProvider.ts` | Main sidebar: branding, analysis display, question input, hint cards, session controls |
| `dashboardPanel.ts` | Full-panel analytics dashboard: stat cards, bar chart, language breakdown, session table |

---

## 4. Data Flow

### Tutoring Request Flow

```
User types question → Webview postMessage('askQuestion')
    → SidebarProvider relays to command
    → extension.ts: handleAskQuestion()
        → AnalysisService.analyzeDocument() [if not cached]
        → TutorService.askQuestion()
            → HintEngine.requestNextLevel() → Level 1
            → AIProvider.generateResponse(TutorRequest)
            → ResponseValidator.validate(response)
                → if valid: return response
                → if invalid: retry with policy note
                → if still invalid: SafeFallbackGenerator.generate()
            → push to ChatTurn history
        → formatResponseToCardHtml()
    → SidebarProvider.postMessage('hintResult')
    → AnalyticsStore.recordSession()
```

---

## 5. Security Model

| Concern | Mitigation |
|---------|------------|
| API Key exposure | VS Code `SecretStorage` (encrypted OS credential store) |
| Webview XSS | CSP with nonce-based script allowlisting |
| Code transmission | Only on explicit user action (Analyze/Ask/Hint) |
| User code storage | Never persisted to disk; analytics store only records metadata |
| AI content injection | HTML escaping of all AI-generated text before DOM insertion |

---

## 6. Technology Choices

| Technology | Version | Rationale |
|------------|---------|-----------|
| TypeScript | 5.3.x | Type safety, VS Code API compatibility |
| web-tree-sitter | 0.20.8 | WASM ABI compatibility with `tree-sitter-wasms` grammars |
| tree-sitter-wasms | 0.1.x | Pre-built WASM grammar binaries for Python and C |
| @google/generative-ai | 0.24.x | Official Google Gemini SDK |
| esbuild | 0.20.x | Fast bundling for extension packaging |
| vitest | 1.6.x | Unit testing framework with TypeScript support |
