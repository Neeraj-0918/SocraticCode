# SocraticCode

**Think Better. Code Smarter.**

> AST-Informed AI Tutor for Progressive Socratic Programming Feedback

A Visual Studio Code extension that helps beginner programmers understand their code, reason about programming problems, and develop independent solutions through contextual questions and progressively more specific hints — rather than receiving complete corrected code.

---

## ⚡ Features

### 🧠 AST-Informed Code Analysis
Real structural analysis of your code using Tree-sitter concrete syntax trees, not regex heuristics.
- **Python** — full function, loop, condition, variable, and call extraction
- **C** — function definitions, while/for/do-while loops, if/else branches, declarations, return statements

### 📚 Progressive 3-Level Socratic Hints
A cognitive scaffolding system that respects the learning process:

| Level | Name | What You Get |
|-------|------|--------------|
| **1** | Conceptual Hint | The relevant programming concept + a guiding question. No code. |
| **2** | Logical Reasoning | Variable tracing strategy + specific reasoning prompts. Minimal code. |
| **3** | Structural Guidance | Pseudocode or algorithmic steps. Never a complete solution. |

### 🤖 AI Provider Integration
- **Google Gemini** (free tier) with automatic model discovery (`gemini-3.5-flash-lite`)
- **Demo Mode** — fully functional offline tutoring with rule-based responses
- Secure API key storage via VS Code `SecretStorage`

### 🛡️ Solution-Leakage Guardrails
An independent response validation module that:
- Detects complete function replacements
- Enforces per-level code-block policies
- Blocks direct giveaway phrases
- Attempts controlled regeneration before deploying a safe fallback

### 📊 Learning Analytics Dashboard
- Session tracking (questions, hint levels, languages, providers)
- Cognitive scaffolding distribution visualization
- Guardrail intervention statistics
- Data clearing controls

---

## 🚀 Quick Start

### Prerequisites
- **VS Code** ≥ 1.85.0
- **Node.js** ≥ 18.x (for development only)

### Install from VSIX (Local)
1. Download the `.vsix` file from the releases directory
2. In VS Code: `Ctrl+Shift+P` → **Extensions: Install from VSIX...**
3. Select the `.vsix` file
4. Reload VS Code

### Development Setup
```powershell
# Clone the repository
git clone <repository-url>
cd SocraticCode

# Install dependencies
npm install

# Compile the extension
npm run compile

# Run tests
npm test

# Launch Extension Development Host
# Press F5 in VS Code
```

---

## 🎓 Usage

### 1. Analyze Code
Open a Python (`.py`) or C (`.c`) file, then click **Analyze Code** in the SocraticCode sidebar or run `SocraticCode: Analyze Current File` from the command palette.

### 2. Ask a Question
Type your question in the text box and click **Ask Tutor**. The tutor will provide a Level 1 conceptual hint based on your code's AST structure.

### 3. Request Deeper Hints
Click **Next Hint** to progress through Level 2 (logical reasoning) and Level 3 (structural guidance). You control the pace.

### 4. Configure AI
Run `SocraticCode: Configure AI Provider` to add your Google Gemini API key from [Google AI Studio](https://aistudio.google.com/apikey). The extension works in Demo Mode without an API key.

### 5. View Learning Dashboard
Run `SocraticCode: Open Learning Dashboard` to see your session history, hint distribution, and guardrail statistics.

---

## 📋 Commands

| Command | Description |
|---------|-------------|
| `SocraticCode: Open Tutor` | Focus the SocraticCode sidebar |
| `SocraticCode: Analyze Current File` | Run AST analysis on the active file |
| `SocraticCode: Ask About Selected Code` | Ask the tutor about your code/selection |
| `SocraticCode: Request Next Hint` | Advance to the next hint level |
| `SocraticCode: Open Learning Dashboard` | Open the analytics dashboard panel |
| `SocraticCode: Clear Learning Session` | Reset the current tutoring session |
| `SocraticCode: Configure AI Provider` | Set or remove the Gemini API key |
| `SocraticCode: Switch Demo Mode` | Toggle between Gemini AI and Demo Mode |

---

## 🏗️ Architecture

```
src/
├── extension.ts           # Entry point, command wiring, lifecycle
├── analysis/
│   ├── types.ts           # AnalysisResult, FunctionInfo, LoopInfo, etc.
│   ├── analysisService.ts # Multi-language adapter orchestrator
│   ├── pythonAdapter.ts   # Tree-sitter Python concrete syntax tree parser
│   └── cAdapter.ts        # Tree-sitter C concrete syntax tree parser
├── tutor/
│   ├── types.ts           # TutorRequest, TutorResponse, HintLevel
│   ├── hintEngine.ts      # 3-level progressive hint state machine
│   ├── tutorService.ts    # Orchestrator with guardrail integration
│   └── promptBuilder.ts   # System prompt construction
├── providers/
│   ├── types.ts           # AIProvider interface
│   ├── demoProvider.ts    # Rule-based offline Socratic responses
│   ├── geminiProvider.ts  # Google Gemini API integration
│   └── keyManager.ts      # VS Code SecretStorage credential manager
├── guardrails/
│   ├── types.ts           # ValidationResult interface
│   ├── validator.ts       # ResponseValidator with 6 policy checks
│   └── safeFallback.ts    # Deterministic safe response generator
├── analytics/
│   ├── types.ts           # LearningSessionRecord, AnalyticsSummary
│   └── analyticsStore.ts  # Persistent session tracking store
├── utils/
│   └── languageDetector.ts # File extension & VS Code languageId mapper
└── webview/
    ├── sidebarProvider.ts  # Main sidebar webview provider
    └── dashboardPanel.ts   # Analytics dashboard webview panel
```

---

## 🧪 Testing

```powershell
# Run all unit tests
npm test

# Run tests in watch mode
npm run test:watch

# Type-check without emitting
npm run lint
```

**Test coverage spans:**
- Parser adapters (Python, C)
- Analysis service orchestration
- Hint engine progression
- Demo provider responses
- Gemini provider (mocked API)
- Key manager (mocked SecretStorage)
- Response validator guardrails
- Tutor service with guardrail interception
- Analytics store persistence
- Command registration

---

## 🔒 Privacy & Security

- **No automatic data transmission.** Code is only sent to an AI provider when the user explicitly asks a question or requests a hint.
- **API keys** are stored in VS Code's encrypted `SecretStorage`, never in plaintext files.
- **Webview CSP** restricts script execution to nonce-authenticated sources.
- **Demo Mode** works entirely offline with no network requests.
- All learning analytics are stored **locally** in VS Code's `globalState`.

---

## 📄 License

This project is developed as part of a Research Project (RP) at the undergraduate level. See the university submission guidelines for distribution terms.

---

## 🙏 Acknowledgments

- [Tree-sitter](https://tree-sitter.github.io/) — Concrete syntax tree parser
- [Google Gemini](https://ai.google.dev/) — AI language model API
- [VS Code Extension API](https://code.visualstudio.com/api) — Extension platform
