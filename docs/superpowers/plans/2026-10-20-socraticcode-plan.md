# SocraticCode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete, working VS Code extension that provides AST-informed Socratic tutoring for beginner programmers, with real code analysis, progressive hints, Gemini AI integration, demo mode, solution-leakage guardrails, and local analytics.

**Architecture:** Tree-sitter WASM parses Python (and C) code to extract structural findings. A tutor service combines these findings with a student's question and hint level to build prompts for a modular AI provider (Gemini or demo). A guardrail validator checks responses before display. A VS Code webview sidebar renders the entire interaction. Analytics are stored locally via VS Code state.

**Tech Stack:** TypeScript (strict), VS Code Extension API, web-tree-sitter (WASM), @google/generative-ai, esbuild, Vitest, HTML/CSS/JS webview, @vscode/vsce

**Spec:** [2026-10-20-socraticcode-design.md](file:///d:/Niraj%20Study/Niraj-college/SEM-5/RP/SocraticCode/docs/superpowers/specs/2026-10-20-socraticcode-design.md)

## Global Constraints

- Product name is **SocraticCode** everywhere — code, UI, metadata, docs
- Publisher: `socraticcode`, identifier: `socraticcode.socraticcode`
- TypeScript strict mode (`"strict": true` in tsconfig)
- Windows development — all commands are PowerShell compatible
- VS Code engine: `^1.85.0` (recent stable, supports webview API)
- Node.js: 18+ (VS Code's embedded runtime)
- Never execute student code
- Never fabricate parser findings
- Never hardcode or log API keys
- All WASM files are static assets copied to `dist/`, not bundled by esbuild
- Tests use Vitest
- Each phase ends with a code review checkpoint before moving on

## Review Focus

1. **Unsupported language selected** — User opens a Java file and clicks Analyze. Expected: clear "Language not supported" message, not a crash or empty results.
2. **Empty or whitespace-only file** — User analyzes a blank file. Expected: graceful "Nothing to analyze" message.
3. **Malformed code with syntax errors** — User's Python has missing colons, unmatched parentheses. Expected: partial analysis or honest error, never fabricated results.
4. **API key removed mid-session** — User deletes their Gemini key while a session is active. Expected: graceful fallback to demo mode or clear error, no crash.
5. **Extremely long student code** — User pastes 1000+ lines and clicks analyze. Expected: analysis completes (may be slow) or times out gracefully, never hangs VS Code.

---

# PHASE 1: FOUNDATION

> **Outcome:** Extension compiles, launches in Extension Development Host, shows SocraticCode icon in activity bar, opens an empty sidebar, and all 8 commands are registered.

---

### Task 1.1: Project Scaffold and Configuration

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `.vscodeignore`
- Create: `.gitignore`
- Create: `.vscode/launch.json`
- Create: `.vscode/tasks.json`
- Create: `esbuild.js`
- Create: `vitest.config.ts`

**Interfaces:**
- Produces: Build toolchain that all later tasks depend on — `npm run compile`, `npm run watch`, `npm run test`, `npm run package`

- [ ] **Step 1: Initialize npm project**

Run: `npm init -y`

- [ ] **Step 2: Install core dependencies**

Run: `npm install --save-dev typescript @types/vscode @types/node esbuild vitest @vscode/vsce`

- [ ] **Step 3: Create `tsconfig.json`**

```json
{
  "compilerOptions": {
    "module": "commonjs",
    "target": "ES2022",
    "lib": ["ES2022"],
    "outDir": "out",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true
  },
  "exclude": ["node_modules", "dist", "test", "webview"]
}
```

- [ ] **Step 4: Create `esbuild.js`**

Build script that:
- Bundles `src/extension.ts` to `dist/extension.js`
- Sets `platform: 'node'`, `format: 'cjs'`
- Externalizes `vscode`
- Copies `parsers/*.wasm` to `dist/parsers/` (glob copy, runs even if dir is empty yet)
- Copies `webview/` to `dist/webview/`
- Supports `--watch` flag

- [ ] **Step 5: Create `package.json` extension manifest**

Must include:
- `name`: `socraticcode`
- `displayName`: `SocraticCode`
- `publisher`: `socraticcode`
- `description`: `Think Better. Code Smarter. — AST-Informed AI Tutor for Progressive Socratic Programming Feedback`
- `version`: `0.1.0`
- `engines.vscode`: `^1.85.0`
- `main`: `./dist/extension.js`
- `activationEvents`: `["onView:socraticcode-sidebar"]`
- `categories`: `["Education"]`
- All 8 commands in `contributes.commands`
- `viewsContainers.activitybar` with SocraticCode icon
- `contributes.views.socraticcode-container` with sidebar view `socraticcode-sidebar`
- Scripts: `compile`, `watch`, `test`, `package`, `lint`

- [ ] **Step 6: Create `.vscode/launch.json`**

Extension Development Host launch config — `extensionDevelopmentPath` points to workspace root.

- [ ] **Step 7: Create `.vscode/tasks.json`**

Watch task that runs `npm run watch`.

- [ ] **Step 8: Create `.vscodeignore` and `.gitignore`**

`.vscodeignore`: Exclude `src/`, `test/`, `node_modules/`, `.vscode/`, `docs/`, `*.ts` (except `dist/`)
`.gitignore`: `node_modules/`, `dist/`, `out/`, `*.vsix`, `.socratic/`

- [ ] **Step 9: Create `vitest.config.ts`**

```typescript
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['test/**/*.test.ts'],
  },
});
```

- [ ] **Step 10: Verify build toolchain**

Run: `npm run compile`
Expected: Clean compilation, `dist/extension.js` exists, zero errors.

- [ ] **Step 11: Commit**

```bash
git init
git add .
git commit -m "chore: scaffold project with build toolchain"
```

---

### Task 1.2: Extension Entry Point and Command Registration

**Files:**
- Create: `src/extension.ts`
- Create: `src/commands/index.ts`
- Test: `test/unit/commands/commands.test.ts`

**Interfaces:**
- Consumes: `package.json` command IDs from Task 1.1
- Produces: `activate(context)` function, `deactivate()` function, all 8 command handlers (stubs initially)

- [ ] **Step 1: Write failing test for command registration**

```typescript
// test/unit/commands/commands.test.ts
import { describe, it, expect } from 'vitest';
import { COMMAND_IDS } from '../../../src/commands/index';

describe('Command IDs', () => {
  it('should export all 8 required command IDs', () => {
    expect(Object.keys(COMMAND_IDS)).toHaveLength(8);
    expect(COMMAND_IDS.openTutor).toBe('socraticcode.openTutor');
    expect(COMMAND_IDS.analyzeFile).toBe('socraticcode.analyzeCurrentFile');
    expect(COMMAND_IDS.askAboutSelection).toBe('socraticcode.askAboutSelection');
    expect(COMMAND_IDS.requestNextHint).toBe('socraticcode.requestNextHint');
    expect(COMMAND_IDS.openDashboard).toBe('socraticcode.openDashboard');
    expect(COMMAND_IDS.clearSession).toBe('socraticcode.clearSession');
    expect(COMMAND_IDS.configureProvider).toBe('socraticcode.configureProvider');
    expect(COMMAND_IDS.switchDemoMode).toBe('socraticcode.switchDemoMode');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/commands/commands.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement `src/commands/index.ts`**

Export `COMMAND_IDS` object mapping friendly names to the 8 command ID strings.
Export `registerCommands(context: vscode.ExtensionContext): void` that registers all commands with stub handlers (each shows an info message like "SocraticCode: [CommandName] — coming soon").

- [ ] **Step 4: Implement `src/extension.ts`**

`activate(context)`: Calls `registerCommands(context)`. Logs activation message.
`deactivate()`: Empty for now.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/unit/commands/commands.test.ts`
Expected: PASS

- [ ] **Step 6: Verify compilation**

Run: `npm run compile`
Expected: Zero errors

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: extension entry point with all 8 command stubs"
```

---

### Task 1.3: Sidebar Webview Shell

**Files:**
- Create: `src/webview/sidebarProvider.ts`
- Create: `webview/sidebar/index.html`
- Create: `webview/sidebar/styles.css`
- Create: `webview/sidebar/main.js`
- Modify: `src/extension.ts` — register sidebar provider

**Interfaces:**
- Consumes: `activate(context)` from Task 1.2
- Produces: `SocraticSidebarProvider` class implementing `vscode.WebviewViewProvider`, registered on view ID `socraticcode-sidebar`

- [ ] **Step 1: Create `src/webview/sidebarProvider.ts`**

Implement `SocraticSidebarProvider`:
- Implements `vscode.WebviewViewProvider`
- `resolveWebviewView()` sets up webview with `enableScripts: true`, `localResourceRoots`
- Loads `webview/sidebar/index.html` with VS Code webview URI for CSS/JS
- Handles `postMessage` / `onDidReceiveMessage` (empty handlers for now)
- Exposes `postMessageToWebview(message)` for extension host to webview communication

- [ ] **Step 2: Create `webview/sidebar/index.html`**

Shell HTML:
- SocraticCode header with branding
- Language badge placeholder
- "Analyze Code" button (disabled state)
- Question input with "Ask" button
- Empty hint cards container
- Session history container (empty)
- Footer with demo mode indicator
- Links to `styles.css` and `main.js` via `${webviewUri}` placeholders

- [ ] **Step 3: Create `webview/sidebar/styles.css`**

VS Code-native styling:
- Use `var(--vscode-*)` CSS variables for all colors
- Dark by default (no hardcoded colors — inherits from VS Code theme)
- Compact card layout
- Button styles matching VS Code conventions
- Input field styling
- Typography: VS Code's default font stack
- Responsive for narrow sidebar (min-width 280px)

- [ ] **Step 4: Create `webview/sidebar/main.js`**

Client-side JS:
- `vscode = acquireVsCodeApi()`
- Message handler scaffold: `window.addEventListener('message', handler)`
- Button click handlers that post messages to extension host
- State management for UI sections (show/hide/loading)

- [ ] **Step 5: Register sidebar provider in `src/extension.ts`**

Add to `activate()`:
```typescript
const sidebarProvider = new SocraticSidebarProvider(context.extensionUri);
context.subscriptions.push(
  vscode.window.registerWebviewViewProvider('socraticcode-sidebar', sidebarProvider)
);
```

- [ ] **Step 6: Verify build**

Run: `npm run compile`
Expected: Zero errors, `dist/` contains extension.js and webview files

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: sidebar webview shell with VS Code-native styling"
```

---

### PHASE 1 CODE REVIEW CHECKPOINT

**Verify before proceeding:**
1. `npm run compile` — zero errors
2. `npx vitest run` — all tests pass
3. Manual check: Launch Extension Development Host (F5), SocraticCode icon appears in activity bar, clicking it opens the sidebar with branding and empty UI shell
4. All 8 commands appear in the command palette with "SocraticCode:" prefix
5. Commands show info messages when invoked

**Review questions:**
- Does the sidebar feel native to VS Code? No jarring colors or fonts?
- Does the build produce `dist/extension.js` and `dist/webview/` correctly?
- Are there any TypeScript strict-mode violations?

---

# PHASE 2: CODE ANALYSIS ENGINE

> **Outcome:** Tree-sitter WASM parses Python code, the Python adapter extracts structured findings (functions, variables, loops, conditions, calls, returns with source locations), and the sidebar displays real analysis results.

---

### Task 2.1: Analysis Types and Language Detection

**Files:**
- Create: `src/analysis/types.ts`
- Create: `src/utils/languageDetector.ts`
- Test: `test/unit/utils/languageDetector.test.ts`

**Interfaces:**
- Produces: `AnalysisResult`, `FunctionInfo`, `VariableInfo`, `LoopInfo`, `ConditionInfo`, `CallInfo`, `ReturnInfo`, `SourceLocation`, `ParserDiagnostic` types; `detectLanguage(fileName: string, languageId?: string): SupportedLanguage | null`

- [ ] **Step 1: Write failing test for language detection**

```typescript
describe('detectLanguage', () => {
  it('should detect Python from .py extension', () => {
    expect(detectLanguage('script.py')).toBe('python');
  });
  it('should detect C from .c extension', () => {
    expect(detectLanguage('main.c')).toBe('c');
  });
  it('should return null for unsupported .java', () => {
    expect(detectLanguage('App.java')).toBeNull();
  });
  it('should detect from VS Code languageId', () => {
    expect(detectLanguage('file.txt', 'python')).toBe('python');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/utils/languageDetector.test.ts`
Expected: FAIL

- [ ] **Step 3: Create `src/analysis/types.ts`**

Define all analysis interfaces:
- `SupportedLanguage = 'python' | 'c'`
- `AnalysisStatus = 'success' | 'partial' | 'error'`
- `SourceLocation { line: number; column: number; endLine: number; endColumn: number }`
- `FunctionInfo { name: string; location: SourceLocation; parameters: string[]; hasReturn: boolean }`
- `VariableInfo { name: string; location: SourceLocation; scope: string }`
- `LoopInfo { type: 'for' | 'while'; location: SourceLocation; bodyLines: number }`
- `ConditionInfo { type: 'if' | 'elif' | 'else'; location: SourceLocation }`
- `CallInfo { functionName: string; location: SourceLocation; argumentCount: number }`
- `ReturnInfo { location: SourceLocation; hasValue: boolean }`
- `ParserDiagnostic { message: string; location?: SourceLocation; severity: 'error' | 'warning' | 'info' }`
- `AnalysisResult { language: SupportedLanguage; status: AnalysisStatus; functions: FunctionInfo[]; variables: VariableInfo[]; loops: LoopInfo[]; conditions: ConditionInfo[]; functionCalls: CallInfo[]; returnStatements: ReturnInfo[]; diagnostics: ParserDiagnostic[]; rawStructure?: string }`

- [ ] **Step 4: Implement `src/utils/languageDetector.ts`**

Map file extensions and VS Code language IDs to `SupportedLanguage`.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/unit/utils/languageDetector.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: analysis types and language detection"
```

---

### Task 2.2: Tree-sitter WASM Setup and Python Adapter

**Files:**
- Create: `src/analysis/pythonAdapter.ts`
- Create: `src/analysis/analysisService.ts`
- Create: `parsers/` directory (WASM files downloaded here)
- Create: `test/fixtures/python/simple_function.py`
- Create: `test/fixtures/python/loop_with_bug.py`
- Create: `test/fixtures/python/missing_return.py`
- Create: `test/fixtures/python/syntax_error.py`
- Test: `test/unit/analysis/pythonAdapter.test.ts`

**Interfaces:**
- Consumes: Types from Task 2.1
- Produces: `PythonAdapter.analyze(code: string): Promise<AnalysisResult>`, `AnalysisService.analyzeCode(code: string, language: SupportedLanguage): Promise<AnalysisResult>`

- [ ] **Step 1: Install Tree-sitter WASM dependencies**

Run: `npm install web-tree-sitter`

Research and download the correct WASM grammar files for Python (and C if available) into the `parsers/` directory. Verify the `.wasm` files load correctly.

> **CRITICAL:** This is the highest-risk step. Tree-sitter WASM setup in Node.js/VS Code can be tricky. If `web-tree-sitter` doesn't work, investigate `tree-sitter-wasms` package or pre-built WASM binaries from the tree-sitter GitHub releases.

- [ ] **Step 2: Create test fixtures**

```python
# test/fixtures/python/simple_function.py
def greet(name):
    message = "Hello, " + name
    return message

def add(a, b):
    result = a + b
    return result
```

```python
# test/fixtures/python/loop_with_bug.py
def find_max(numbers):
    max_val = numbers[0]
    for i in range(len(numbers)):
        if numbers[i] > max_val:
            max_val = numbers[i]
    return max_val
```

```python
# test/fixtures/python/missing_return.py
def calculate_average(numbers):
    total = sum(numbers)
    average = total / len(numbers)
```

```python
# test/fixtures/python/syntax_error.py
def broken_function(x
    if x > 0
        return x
```

- [ ] **Step 3: Write failing tests for Python adapter**

```typescript
describe('PythonAdapter', () => {
  it('should detect functions with parameters and return', async () => {
    const code = readFixture('simple_function.py');
    const result = await adapter.analyze(code);
    expect(result.status).toBe('success');
    expect(result.functions).toHaveLength(2);
    expect(result.functions[0].name).toBe('greet');
    expect(result.functions[0].parameters).toEqual(['name']);
    expect(result.functions[0].hasReturn).toBe(true);
  });

  it('should detect loops and conditions', async () => {
    const code = readFixture('loop_with_bug.py');
    const result = await adapter.analyze(code);
    expect(result.loops.length).toBeGreaterThanOrEqual(1);
    expect(result.conditions.length).toBeGreaterThanOrEqual(1);
  });

  it('should detect missing return', async () => {
    const code = readFixture('missing_return.py');
    const result = await adapter.analyze(code);
    expect(result.functions[0].hasReturn).toBe(false);
  });

  it('should handle syntax errors gracefully', async () => {
    const code = readFixture('syntax_error.py');
    const result = await adapter.analyze(code);
    expect(['partial', 'error']).toContain(result.status);
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `npx vitest run test/unit/analysis/pythonAdapter.test.ts`
Expected: FAIL

- [ ] **Step 5: Implement `src/analysis/pythonAdapter.ts`**

`PythonAdapter` class:
- Initializes `web-tree-sitter` with the Python WASM grammar
- `analyze(code: string): Promise<AnalysisResult>`
- Walks the concrete syntax tree to extract:
  - `function_definition` nodes → `FunctionInfo`
  - `assignment` / `augmented_assignment` nodes → `VariableInfo`
  - `for_statement` / `while_statement` nodes → `LoopInfo`
  - `if_statement` / `elif_clause` / `else_clause` nodes → `ConditionInfo`
  - `call` expression nodes → `CallInfo`
  - `return_statement` nodes → `ReturnInfo`
- Checks for `ERROR` nodes in the tree → `ParserDiagnostic`
- Builds `rawStructure` summary string

- [ ] **Step 6: Implement `src/analysis/analysisService.ts`**

`AnalysisService` class:
- Holds a map of language to adapter
- `analyzeCode(code: string, language: SupportedLanguage): Promise<AnalysisResult>`
- Returns error result for unsupported languages
- Handles empty/whitespace-only code

- [ ] **Step 7: Run tests to verify they pass**

Run: `npx vitest run test/unit/analysis/pythonAdapter.test.ts`
Expected: PASS

- [ ] **Step 8: Verify WASM files copy to dist**

Run: `npm run compile`
Expected: `dist/parsers/tree-sitter.wasm` and `dist/parsers/tree-sitter-python.wasm` exist

- [ ] **Step 9: Commit**

```bash
git add .
git commit -m "feat: Tree-sitter Python adapter with real AST analysis"
```

---

### Task 2.3: Wire Analysis to Sidebar

**Files:**
- Modify: `src/commands/index.ts` — implement `analyzeCurrentFile` command
- Modify: `src/webview/sidebarProvider.ts` — handle analysis messages
- Modify: `webview/sidebar/main.js` — render analysis findings
- Modify: `webview/sidebar/styles.css` — analysis card styles
- Modify: `webview/sidebar/index.html` — analysis results section

**Interfaces:**
- Consumes: `AnalysisService.analyzeCode()` from Task 2.2, `SocraticSidebarProvider` from Task 1.3
- Produces: Working "Analyze Current File" command that parses the active editor's code and displays findings in the sidebar

- [ ] **Step 1: Implement `analyzeCurrentFile` command handler**

Gets active text editor → gets document text and language → calls `analysisService.analyzeCode()` → sends result to sidebar via `postMessageToWebview({ type: 'analysisResult', data: result })`.

Handles: no active editor, unsupported language, empty file.

- [ ] **Step 2: Update sidebar provider to receive analysis results**

Handle incoming messages from command handlers. Forward analysis results to the webview.

- [ ] **Step 3: Update webview JS to render analysis findings**

Render structured cards:
- Function cards with name, parameters, line number, return status
- Variable list with names and locations
- Loop and condition summary
- Function call list
- Diagnostic messages (if any)
- Status badge (success / partial / error)

- [ ] **Step 4: Update CSS for analysis cards**

Styled cards using VS Code theme variables. Code elements in monospace. Line numbers as subtle badges.

- [ ] **Step 5: Verify build and manual test**

Run: `npm run compile`
Manual: Open a Python file → run "SocraticCode: Analyze Current File" → verify findings appear in sidebar.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: wire analysis results to sidebar display"
```

---

### PHASE 2 CODE REVIEW CHECKPOINT

**Verify before proceeding:**
1. `npm run compile` — zero errors
2. `npx vitest run` — all tests pass (language detection + Python adapter)
3. Manual: Analyze `simple_function.py` → sidebar shows 2 functions, their parameters, return status, variables
4. Manual: Analyze `syntax_error.py` → sidebar shows partial/error status with diagnostics
5. Manual: Analyze a `.java` file → sidebar shows "Language not supported"
6. Manual: Analyze with no file open → graceful message
7. WASM files exist in `dist/parsers/`

**Review questions:**
- Are source locations (line numbers) accurate?
- Does analysis of malformed code produce honest results, not fabricated ones?
- Is Tree-sitter initialization fast enough? (Should be <500ms)

---

# PHASE 3: SOCRATIC TUTOR + DEMO MODE

> **Outcome:** Full tutoring workflow works without an API key. Student can ask questions, get progressive Socratic hints (L1/L2/L3), see session history, and clear sessions. All powered by demo mode with real parser findings.

---

### Task 3.1: Tutor Types and Hint Engine

**Files:**
- Create: `src/tutor/types.ts`
- Create: `src/tutor/hintEngine.ts`
- Test: `test/unit/tutor/hintEngine.test.ts`

**Interfaces:**
- Produces: `HintLevel` enum (`CONCEPTUAL = 1, LOGICAL = 2, STRUCTURAL = 3`), `TutorRequest`, `TutorResponse`, `HintEngine` class with `getCurrentLevel(): HintLevel`, `advanceLevel(): HintLevel`, `resetLevel(): void`, `canAdvance(): boolean`

- [ ] **Step 1: Write failing tests for hint engine**

```typescript
describe('HintEngine', () => {
  it('should start at Level 1', () => {
    const engine = new HintEngine();
    expect(engine.getCurrentLevel()).toBe(HintLevel.CONCEPTUAL);
  });

  it('should advance from L1 to L2 to L3', () => {
    const engine = new HintEngine();
    expect(engine.advanceLevel()).toBe(HintLevel.LOGICAL);
    expect(engine.advanceLevel()).toBe(HintLevel.STRUCTURAL);
  });

  it('should not advance beyond L3', () => {
    const engine = new HintEngine();
    engine.advanceLevel(); // L2
    engine.advanceLevel(); // L3
    expect(engine.canAdvance()).toBe(false);
    expect(engine.advanceLevel()).toBe(HintLevel.STRUCTURAL);
  });

  it('should reset to L1', () => {
    const engine = new HintEngine();
    engine.advanceLevel();
    engine.resetLevel();
    expect(engine.getCurrentLevel()).toBe(HintLevel.CONCEPTUAL);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/tutor/hintEngine.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `src/tutor/types.ts`**

Define:
- `HintLevel` enum
- `TutorRequest { language, question, code, analysisResult, hintLevel, sessionHistory }`
- `TutorResponse { explanation, guidingQuestion, hintLevel, codeReferences, isDemo }`
- `SessionEntry { timestamp, question, response, hintLevel }`

- [ ] **Step 4: Implement `src/tutor/hintEngine.ts`**

Stateful class managing current hint level with progression rules.

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/unit/tutor/hintEngine.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: hint engine with 3-level progression"
```

---

### Task 3.2: Demo Provider

**Files:**
- Create: `src/providers/types.ts`
- Create: `src/providers/demoProvider.ts`
- Test: `test/unit/providers/demoProvider.test.ts`

**Interfaces:**
- Consumes: `TutorRequest`, `TutorResponse` from Task 3.1, `AnalysisResult` from Task 2.1
- Produces: `AIProvider` interface, `DemoProvider` class implementing `AIProvider`

- [ ] **Step 1: Write failing tests for demo provider**

```typescript
describe('DemoProvider', () => {
  it('should always report as configured', async () => {
    expect(await provider.isConfigured()).toBe(true);
  });

  it('should return distinct responses for each hint level', async () => {
    const l1 = await provider.generateResponse(makeRequest(HintLevel.CONCEPTUAL));
    const l2 = await provider.generateResponse(makeRequest(HintLevel.LOGICAL));
    const l3 = await provider.generateResponse(makeRequest(HintLevel.STRUCTURAL));
    expect(l1.explanation).not.toBe(l2.explanation);
    expect(l2.explanation).not.toBe(l3.explanation);
  });

  it('should mark responses as demo', async () => {
    const response = await provider.generateResponse(makeRequest(HintLevel.CONCEPTUAL));
    expect(response.isDemo).toBe(true);
  });

  it('should include a guiding question', async () => {
    const response = await provider.generateResponse(makeRequest(HintLevel.CONCEPTUAL));
    expect(response.guidingQuestion).toBeTruthy();
    expect(response.guidingQuestion.endsWith('?')).toBe(true);
  });

  it('should use analysis findings when available', async () => {
    const request = makeRequest(HintLevel.LOGICAL);
    request.analysisResult = makeAnalysisWithFunction('calculate_sum');
    const response = await provider.generateResponse(request);
    expect(response.explanation).toContain('calculate_sum');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/providers/demoProvider.test.ts`
Expected: FAIL

- [ ] **Step 3: Create `src/providers/types.ts`**

```typescript
export interface AIProvider {
  readonly name: string;
  isConfigured(): Promise<boolean>;
  generateResponse(request: TutorRequest): Promise<TutorResponse>;
  testConnection(): Promise<boolean>;
}
```

- [ ] **Step 4: Implement `src/providers/demoProvider.ts`**

Rule-based demo provider:
- Pattern detection from analysis findings (missing return, loops without termination, unused variables, etc.)
- Template library with Socratic questions for each pattern x hint level
- Templates reference actual variable names, function names, line numbers from analysis
- Generic fallback templates for unrecognized patterns
- All responses include `guidingQuestion` ending with "?"
- All responses marked `isDemo: true`
- Distinct response depth per hint level

- [ ] **Step 5: Run test to verify it passes**

Run: `npx vitest run test/unit/providers/demoProvider.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: demo provider with rule-based Socratic responses"
```

---

### Task 3.3: Tutor Service and Prompt Builder

**Files:**
- Create: `src/tutor/tutorService.ts`
- Create: `src/tutor/promptBuilder.ts`
- Create: `src/tutor/systemPrompt.ts`
- Test: `test/unit/tutor/promptBuilder.test.ts`

**Interfaces:**
- Consumes: `AIProvider` from Task 3.2, `HintEngine` from Task 3.1, `AnalysisResult` from Task 2.1
- Produces: `TutorService` class with `askQuestion(question, code, analysisResult): Promise<TutorResponse>`, `requestNextHint(): Promise<TutorResponse>`, `clearSession(): void`, `getSessionHistory(): SessionEntry[]`

- [ ] **Step 1: Write failing test for prompt builder**

```typescript
describe('PromptBuilder', () => {
  it('should include system prompt', () => {
    const prompt = buildPrompt(makeRequest(HintLevel.CONCEPTUAL));
    expect(prompt).toContain('SocraticCode');
    expect(prompt).toContain('educational programming tutor');
  });

  it('should include hint level instruction', () => {
    const prompt = buildPrompt(makeRequest(HintLevel.LOGICAL));
    expect(prompt).toContain('Level 2');
  });

  it('should include analysis findings when present', () => {
    const req = makeRequest(HintLevel.CONCEPTUAL);
    req.analysisResult = makeAnalysisWithFunction('my_func');
    const prompt = buildPrompt(req);
    expect(prompt).toContain('my_func');
  });

  it('should include student question', () => {
    const req = makeRequest(HintLevel.CONCEPTUAL);
    req.question = 'Why does my loop run forever?';
    const prompt = buildPrompt(req);
    expect(prompt).toContain('Why does my loop run forever?');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run test/unit/tutor/promptBuilder.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement `src/tutor/systemPrompt.ts`**

Export the version-controlled system prompt string from the design doc Section 12.

- [ ] **Step 4: Implement `src/tutor/promptBuilder.ts`**

`buildPrompt(request: TutorRequest): string`
Combines: system prompt + hint level instructions + analysis summary + code context + student question + session history excerpt.

- [ ] **Step 5: Implement `src/tutor/tutorService.ts`**

Orchestrator:
- Holds `HintEngine`, `AIProvider` reference, session history
- `askQuestion()`: builds request → calls provider → stores in history → returns response
- `requestNextHint()`: advances hint level → re-asks with same context at new level
- `clearSession()`: resets hint engine + clears history
- `getSessionHistory()`: returns session entries

- [ ] **Step 6: Run test to verify it passes**

Run: `npx vitest run test/unit/tutor/promptBuilder.test.ts`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: tutor service with prompt builder and session management"
```

---

### Task 3.4: Wire Tutor to Sidebar

**Files:**
- Modify: `src/commands/index.ts` — implement ask, hint, clear commands
- Modify: `src/webview/sidebarProvider.ts` — handle tutor messages
- Modify: `webview/sidebar/main.js` — render hint cards, question input, session history
- Modify: `webview/sidebar/styles.css` — hint card styles, loading states
- Modify: `webview/sidebar/index.html` — tutor UI sections

**Interfaces:**
- Consumes: `TutorService` from Task 3.3, `SocraticSidebarProvider` from Task 1.3
- Produces: Full interactive tutoring UI — ask questions, see hint cards, request next hint, view session history, clear session

- [ ] **Step 1: Implement command handlers**

- `askAboutSelection`: Get selected text → get question from input box → call `tutorService.askQuestion()` → send response to sidebar
- `requestNextHint`: Call `tutorService.requestNextHint()` → send response to sidebar
- `clearSession`: Call `tutorService.clearSession()` → notify sidebar
- `switchDemoMode`: Toggle between demo and AI provider → show status

- [ ] **Step 2: Update webview HTML for tutor sections**

Add:
- Question input area with "Ask" and "Ask About Selection" buttons
- Hint card container that shows L1/L2/L3 cards progressively
- "Request Next Hint" button (disabled when at L3 or no active question)
- Session history section with collapsible past interactions
- Demo mode badge in footer
- Loading spinner for async operations
- Error message display

- [ ] **Step 3: Update webview JS for tutor interaction**

Handle messages:
- `tutorResponse` → render hint card with level badge, explanation, guiding question
- `sessionHistory` → render past interactions
- `loading` → show/hide loading state
- `error` → display error message

Post messages:
- `ask` → sends question and selected code to extension host
- `nextHint` → requests next hint level
- `clearSession` → clears session

- [ ] **Step 4: Style hint cards**

- L1 card: blue-ish accent (conceptual)
- L2 card: amber accent (reasoning)
- L3 card: green accent (structural)
- Each card shows: level badge, explanation text, guiding question in italics
- Code references in monospace
- Smooth fade-in animation for new cards

- [ ] **Step 5: Verify build and full demo workflow**

Run: `npm run compile`
Manual test the complete flow:
1. Open Python file → Analyze → see findings
2. Ask question → see L1 hint card
3. Click "Next Hint" → see L2 card
4. Click "Next Hint" → see L3 card
5. "Next Hint" button disabled at L3
6. Session history shows all interactions
7. Clear session resets everything
8. Demo mode badge visible

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: complete demo tutoring workflow in sidebar"
```

---

### PHASE 3 CODE REVIEW CHECKPOINT

**Verify before proceeding:**
1. `npm run compile` — zero errors
2. `npx vitest run` — all tests pass
3. Manual: Full demo workflow (analyze → ask → L1 → L2 → L3 → clear)
4. Demo responses reference actual code elements from analysis
5. Demo responses are distinct across hint levels
6. Session history works
7. All states handled: loading, error, empty file, no selection

**Review questions:**
- Are demo responses genuinely helpful for a beginner?
- Do hint levels feel progressively more specific?
- Is the demo mode clearly labelled so no one thinks it's AI-generated?

---

# PHASE 4: GEMINI AI INTEGRATION

> **Outcome:** Real AI-powered Socratic tutoring using Google Gemini free tier, with secure credential management and proper error handling.

---

### Task 4.1: Gemini Provider

**Files:**
- Create: `src/providers/geminiProvider.ts`
- Modify: `src/commands/index.ts` — implement `configureProvider` command
- Test: `test/unit/providers/geminiProvider.test.ts`

**Interfaces:**
- Consumes: `AIProvider` interface from Task 3.2, `TutorRequest`/`TutorResponse` from Task 3.1
- Produces: `GeminiProvider` class implementing `AIProvider`

- [ ] **Step 1: Install Gemini SDK**

Run: `npm install @google/generative-ai`

- [ ] **Step 2: Write failing tests for Gemini provider**

Test the provider's structure and error handling (not actual API calls — those are integration tests):

```typescript
describe('GeminiProvider', () => {
  it('should report not configured when no API key', async () => {
    const provider = new GeminiProvider(mockSecretStorage);
    expect(await provider.isConfigured()).toBe(false);
  });

  it('should report configured after key is stored', async () => {
    await mockSecretStorage.store('socraticcode.geminiApiKey', 'test-key');
    const provider = new GeminiProvider(mockSecretStorage);
    expect(await provider.isConfigured()).toBe(true);
  });

  it('should have name "Gemini"', () => {
    expect(provider.name).toBe('Gemini');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run test/unit/providers/geminiProvider.test.ts`
Expected: FAIL

- [ ] **Step 4: Implement `src/providers/geminiProvider.ts`**

`GeminiProvider`:
- Constructor takes `vscode.SecretStorage`
- API key stored/retrieved from SecretStorage under key `socraticcode.geminiApiKey`
- `isConfigured()`: checks if key exists in SecretStorage
- `generateResponse(request)`:
  - Retrieves API key from SecretStorage
  - Initializes `GoogleGenerativeAI` client
  - Uses model `gemini-2.0-flash`
  - Builds prompt using `promptBuilder`
  - Sets `generationConfig`: temperature 0.7, maxOutputTokens 1024
  - Timeout: 30 seconds (AbortController)
  - Parses response text into `TutorResponse` structure
  - Error handling: auth failure, rate limit, network error, timeout
  - Max 1 retry on transient 500/503 errors
- `testConnection()`: Makes a minimal request to verify the key works
- `storeApiKey(key)` / `removeApiKey()` / `getKeyPreview()` (shows first 4 chars + masked)
- Never logs or displays the full API key

- [ ] **Step 5: Implement `configureProvider` command**

Shows input box → stores key in SecretStorage → tests connection → reports success/failure.
Also offers "Remove API Key" option via quick pick.

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run test/unit/providers/geminiProvider.test.ts`
Expected: PASS

- [ ] **Step 7: Wire provider switching**

`switchDemoMode` command toggles between `GeminiProvider` and `DemoProvider` in the `TutorService`. Shows notification of active mode. Sidebar updates demo badge.

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "feat: Gemini provider with secure key storage"
```

---

### PHASE 4 CODE REVIEW CHECKPOINT

**Verify before proceeding:**
1. `npm run compile` — zero errors
2. `npx vitest run` — all tests pass
3. Manual: Configure API key → test connection → works
4. Manual: Ask a question with Gemini → get a real Socratic response
5. Manual: Remove API key → falls back to demo mode gracefully
6. Manual: Invalid key → clear error message
7. API key never appears in logs or UI (check developer console)
8. Switch between demo/AI mode works

**Review questions:**
- Does the Gemini response feel Socratic, not solution-giving?
- Is error handling clear enough for a beginner who mistyped their API key?
- Does timeout work? (Simulate by disconnecting network if possible)

---

# PHASE 5: SOLUTION-LEAKAGE GUARDRAILS

> **Outcome:** AI responses are validated before display. Responses that contain full solutions are rejected and regenerated. If regeneration fails, a safe fallback is shown.

---

### Task 5.1: Guardrail Validator

**Files:**
- Create: `src/guardrails/types.ts`
- Create: `src/guardrails/checks/codeBlockCheck.ts`
- Create: `src/guardrails/checks/completeProgramCheck.ts`
- Create: `src/guardrails/checks/hintLevelPolicyCheck.ts`
- Create: `src/guardrails/checks/directAnswerCheck.ts`
- Create: `src/guardrails/validator.ts`
- Test: `test/unit/guardrails/validator.test.ts`

**Interfaces:**
- Consumes: `TutorResponse` from Task 3.1, `HintLevel` from Task 3.1
- Produces: `ResponseValidator.validate(response, hintLevel): ValidationResult`, `ValidationResult { isValid, failedChecks, adjustedResponse? }`

- [ ] **Step 1: Write failing tests — mandatory test cases from spec**

```typescript
describe('ResponseValidator', () => {
  // Valid responses
  it('should pass a valid Level 1 response (no code)', ...);
  it('should pass a valid Level 2 response (small fragment)', ...);
  it('should pass a valid Level 3 response (pseudocode)', ...);

  // Invalid responses
  it('should reject a response containing a complete solution', ...);
  it('should reject a response with excessive code block (>15 lines at L1)', ...);
  it('should pass a response with a small legitimate code fragment at L2', ...);
  it('should reject a malformed model response', ...);
  it('should reject a claim of code execution', ...);

  // Recovery
  it('should succeed after regeneration when first attempt fails', ...);
  it('should use safe fallback when both attempts fail', ...);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run test/unit/guardrails/validator.test.ts`
Expected: FAIL

- [ ] **Step 3: Implement individual checks**

Each check is a pure function: `(response: string, hintLevel: HintLevel) => CheckResult`

- `codeBlockCheck`: Counts lines in markdown code blocks, applies per-level limits (L1: 0, L2: 10, L3: 20)
- `completeProgramCheck`: Detects full program patterns (def main, import + class + def, #include + int main, etc.)
- `hintLevelPolicyCheck`: L1 must have no code blocks, L2 may have fragments, L3 may have pseudocode
- `directAnswerCheck`: Pattern matches "here's the fix", "corrected code", "change X to Y", "the solution is"

- [ ] **Step 4: Implement `src/guardrails/validator.ts`**

`ResponseValidator`:
- Runs all checks against a response
- Returns `ValidationResult` with details of which checks failed
- `validateAndRecover(response, hintLevel, provider, request)`:
  1. Validate response
  2. If invalid: re-prompt with stricter instructions (one retry)
  3. Validate retry
  4. If still invalid: return safe fallback response
  5. Log validation events for analytics

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run test/unit/guardrails/validator.test.ts`
Expected: PASS

- [ ] **Step 6: Wire guardrails into TutorService**

Modify `TutorService.askQuestion()` to pass AI responses through `ResponseValidator.validateAndRecover()` before returning.

Demo mode responses skip guardrails (they're deterministic and already safe).

- [ ] **Step 7: Commit**

```bash
git add .
git commit -m "feat: solution-leakage guardrails with validation and recovery"
```

---

### PHASE 5 CODE REVIEW CHECKPOINT

**Verify before proceeding:**
1. `npm run compile` — zero errors
2. `npx vitest run` — all tests pass (including all 10 mandatory guardrail tests)
3. Manual: Ask Gemini a question → verify response passes through guardrails
4. Review: Are thresholds reasonable? Not too aggressive (blocking good hints) or too permissive?

**Review questions:**
- Can you manually construct a prompt that tricks Gemini into giving a full solution? Does the guardrail catch it?
- Are false positive rates acceptable?
- Is the safe fallback actually helpful, or is it too generic?

---

# PHASE 6: ANALYTICS AND POLISH

> **Outcome:** Learning dashboard shows session statistics, hint usage patterns, and language breakdown. C adapter added if low-effort. UI polished for final presentation.

---

### Task 6.1: Analytics Store and Service

**Files:**
- Create: `src/analytics/types.ts`
- Create: `src/analytics/analyticsStore.ts`
- Create: `src/analytics/analyticsService.ts`
- Test: `test/unit/analytics/analyticsStore.test.ts`

**Interfaces:**
- Produces: `AnalyticsStore.recordSession(session)`, `AnalyticsStore.getStatistics(): AnalyticsStats`, `AnalyticsStore.clearAll()`, `AnalyticsService.recordEvent(event)`, `AnalyticsService.getAggregates()`

- [ ] **Step 1: Write failing tests**

```typescript
describe('AnalyticsStore', () => {
  it('should record a session and retrieve it', ...);
  it('should count hint levels correctly', ...);
  it('should aggregate by language', ...);
  it('should clear all data', ...);
  it('should handle empty state', ...);
});
```

- [ ] **Step 2: Run tests to verify they fail**

- [ ] **Step 3: Implement analytics types, store, and service**

Store uses a mock globalState interface (injectable for testing, real globalState in extension).

- [ ] **Step 4: Run tests to verify they pass**

- [ ] **Step 5: Wire analytics recording into TutorService**

Record events after each tutor interaction.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "feat: local analytics store with session tracking"
```

---

### Task 6.2: Analytics Dashboard

**Files:**
- Create: `src/webview/dashboardPanel.ts`
- Create: `webview/dashboard/index.html`
- Create: `webview/dashboard/styles.css`
- Create: `webview/dashboard/main.js`
- Modify: `src/commands/index.ts` — implement `openDashboard` command

**Interfaces:**
- Consumes: `AnalyticsService.getAggregates()` from Task 6.1
- Produces: Working dashboard webview panel showing learning statistics

- [ ] **Step 1: Implement dashboard panel provider**

`DashboardPanel` class that creates a webview panel (not sidebar — full panel).

- [ ] **Step 2: Create dashboard HTML/CSS/JS**

Displays:
- Total sessions count
- Total questions asked
- Hint level distribution (L1 / L2 / L3 counts — simple bar chart or progress bars using CSS)
- Language breakdown
- Recent sessions list with timestamps
- "Clear All Data" button with confirmation

VS Code-native styling, dark theme, clean data presentation.

- [ ] **Step 3: Implement `openDashboard` command**

Opens the dashboard panel, sends current stats.

- [ ] **Step 4: Verify build and manual test**

Run: `npm run compile`
Manual: Use the tutor a few times → open dashboard → verify stats match actual usage.

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "feat: learning analytics dashboard"
```

---

### Task 6.3: C Adapter (Low-Effort Addition)

**Files:**
- Create: `src/analysis/cAdapter.ts`
- Create: `test/fixtures/c/hello_world.c`
- Create: `test/fixtures/c/array_bug.c`
- Test: `test/unit/analysis/cAdapter.test.ts`
- Modify: `src/analysis/analysisService.ts` — register C adapter

**Interfaces:**
- Consumes: Same adapter interface as Python adapter from Task 2.2
- Produces: `CAdapter.analyze(code: string): Promise<AnalysisResult>`

- [ ] **Step 1: Download C Tree-sitter WASM grammar**

Add `tree-sitter-c.wasm` to `parsers/` directory.

- [ ] **Step 2: Create C test fixtures**

```c
// test/fixtures/c/hello_world.c
#include <stdio.h>

int add(int a, int b) {
    return a + b;
}

int main() {
    int result = add(3, 5);
    printf("Result: %d\n", result);
    return 0;
}
```

- [ ] **Step 3: Write failing tests**

Similar structure to Python adapter tests — detect functions, variables, loops, conditions in C code.

- [ ] **Step 4: Implement `src/analysis/cAdapter.ts`**

Same pattern as Python adapter but with C-specific Tree-sitter node types:
- `function_definition` → `FunctionInfo`
- `declaration` / `init_declarator` → `VariableInfo`
- `for_statement` / `while_statement` → `LoopInfo`
- `if_statement` → `ConditionInfo`
- `call_expression` → `CallInfo`
- `return_statement` → `ReturnInfo`

- [ ] **Step 5: Register C adapter in AnalysisService**

- [ ] **Step 6: Run tests to verify they pass**

- [ ] **Step 7: Update esbuild to copy C WASM file**

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "feat: C language adapter using Tree-sitter"
```

---

### Task 6.4: UI Polish Pass

**Files:**
- Modify: `webview/sidebar/styles.css`
- Modify: `webview/sidebar/index.html`
- Modify: `webview/sidebar/main.js`
- Create: `src/utils/sanitizer.ts`
- Create: `resources/icon.png` (or SVG)

**Interfaces:**
- Consumes: All existing UI components
- Produces: Polished, accessible, consistent UI

- [ ] **Step 1: Create extension icon**

Simple, clean SVG icon for the activity bar — a stylized question mark or lightbulb representing Socratic inquiry.

- [ ] **Step 2: Implement HTML sanitizer**

`sanitize(html: string): string` — strips dangerous tags/attributes from AI responses before rendering in webview. Allow: `<p>`, `<code>`, `<pre>`, `<em>`, `<strong>`, `<br>`, `<ul>`, `<ol>`, `<li>`. Strip everything else.

- [ ] **Step 3: Polish sidebar UI**

- Smooth transitions for card appearance
- Proper empty states ("No analysis yet — open a file and click Analyze")
- Loading spinner during analysis and AI calls
- Error banners that auto-dismiss
- Hint level badges with correct colors
- "Analyze Code" button shows current file name
- Provider status indicator (Gemini or Demo Mode)
- Keyboard accessibility — all buttons focusable, Enter to submit question

- [ ] **Step 4: Verify all edge cases**

Manual test:
- Narrow sidebar (300px)
- Very long function names
- Very long AI responses
- Multiple rapid clicks on "Next Hint"
- Switching files while session is active

- [ ] **Step 5: Commit**

```bash
git add .
git commit -m "polish: UI refinements, sanitizer, and edge case handling"
```

---

### PHASE 6 CODE REVIEW CHECKPOINT

**Verify before proceeding:**
1. `npm run compile` — zero errors
2. `npx vitest run` — all tests pass
3. Manual: Analytics dashboard shows accurate data
4. Manual: C files analyze correctly (if adapter was added)
5. Manual: UI looks clean and professional in dark theme
6. Manual: All edge cases handled gracefully

---

# PHASE 7: RESEARCH DOCUMENTATION AND PACKAGING

> **Outcome:** Complete research documentation, reproducible setup guide, VSIX package ready for submission.

---

### Task 7.1: Documentation

**Files:**
- Create: `README.md`
- Create: `docs/architecture.md`
- Create: `docs/research-methodology.md`
- Create: `docs/setup-guide.md`
- Create: `CHANGELOG.md`

**Interfaces:**
- Produces: Complete documentation package for RP submission

- [ ] **Step 1: Write README.md**

- Product name, tagline, description
- Key features list
- Screenshots placeholder (add after final UI)
- Quick start guide
- Requirements
- Installation from VSIX
- Usage walkthrough
- Demo mode instructions
- Gemini API setup
- Supported languages
- Architecture overview (link to docs/)
- Contributing section
- License

- [ ] **Step 2: Write architecture documentation**

- System architecture diagram (text-based)
- Component descriptions
- Data flow: ANALYZE → QUESTION → GUIDE → REASON → LEARN
- Parser pipeline
- Provider abstraction
- Guardrail pipeline
- Webview communication protocol
- State management

- [ ] **Step 3: Write research methodology documentation**

- Research question
- AST-informed approach explanation
- Progressive Socratic method
- Evaluation framework
- Metrics: hint progression, time-to-understanding, self-correction rate
- Limitations and future work
- Tree-sitter terminology clarification (concrete syntax tree vs AST)

- [ ] **Step 4: Write setup guide**

Step-by-step, Windows PowerShell:
1. Prerequisites (Node.js 18+, VS Code, Git)
2. Clone repository
3. `npm install`
4. `npm run compile`
5. F5 to launch Extension Development Host
6. Configure Gemini API key (optional)
7. Open a Python file and start tutoring

- [ ] **Step 5: Write CHANGELOG.md**

Initial release notes covering all implemented features.

- [ ] **Step 6: Commit**

```bash
git add .
git commit -m "docs: complete documentation for RP submission"
```

---

### Task 7.2: Webview Security Hardening

**Files:**
- Modify: `src/webview/sidebarProvider.ts`
- Modify: `src/webview/dashboardPanel.ts`

**Interfaces:**
- Consumes: Existing webview providers
- Produces: Hardened webview configuration

- [ ] **Step 1: Apply Content Security Policy**

Set CSP meta tag in webview HTML:
```
default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};
```

Generate unique nonce per webview resolution.

- [ ] **Step 2: Verify no inline scripts without nonce**

All `<script>` tags use the nonce attribute. No `onclick` handlers in HTML — all event listeners in JS.

- [ ] **Step 3: Verify sanitizer is applied to all AI content**

Every AI response runs through `sanitize()` before being inserted into DOM.

- [ ] **Step 4: Commit**

```bash
git add .
git commit -m "security: webview CSP and content sanitization"
```

---

### Task 7.3: Final Verification and VSIX Packaging

**Files:**
- No new files — verification and packaging only

**Interfaces:**
- Produces: `socraticcode-0.1.0.vsix` file

- [ ] **Step 1: Run full test suite**

Run: `npx vitest run`
Expected: All tests pass

- [ ] **Step 2: TypeScript strict compilation**

Run: `npx tsc --noEmit`
Expected: Zero errors

- [ ] **Step 3: Build production bundle**

Run: `npm run compile`
Expected: `dist/` contains all necessary files

- [ ] **Step 4: Verify dist contents**

Check that `dist/` contains:
- `extension.js`
- `parsers/tree-sitter.wasm`
- `parsers/tree-sitter-python.wasm`
- `parsers/tree-sitter-c.wasm` (if C adapter included)
- `webview/sidebar/` (HTML, CSS, JS)
- `webview/dashboard/` (HTML, CSS, JS)

- [ ] **Step 5: Package VSIX**

Run: `npx @vscode/vsce package --no-dependencies`
Expected: `socraticcode-0.1.0.vsix` created

- [ ] **Step 6: Install VSIX and smoke test**

Run: `code --install-extension socraticcode-0.1.0.vsix`
Test in a clean VS Code window:
1. SocraticCode icon in activity bar
2. Sidebar opens
3. Analyze a Python file
4. Ask a question in demo mode
5. Get L1 → L2 → L3 hints
6. Open dashboard
7. All commands in palette

- [ ] **Step 7: Commit and tag**

```bash
git add .
git commit -m "release: SocraticCode v0.1.0"
git tag v0.1.0
```

---

### PHASE 7 FINAL REVIEW CHECKPOINT

**Complete verification:**
1. All tests pass
2. TypeScript compiles with zero errors
3. VSIX installs and works in a clean profile
4. Documentation is complete and accurate
5. No hardcoded API keys anywhere
6. All 8 commands work
7. Demo mode provides full workflow without API key
8. Gemini mode works with valid API key
9. Guardrails catch obvious solution leaks
10. Analytics track actual usage
11. UI is clean, professional, and VS Code-native

---

## Summary: What Each Phase Delivers

| Phase | Tests Added | Commands Working | Can Demo |
|-------|------------|-----------------|----------|
| 1 | Command ID tests | All registered (stubs) | Empty sidebar |
| 2 | Language detection + Python parser | Analyze Current File | Real analysis results |
| 3 | Hint engine + demo provider + prompt builder | Ask, Next Hint, Clear | Full demo tutoring |
| 4 | Gemini provider structure | Configure Provider, Switch Mode | Live AI tutoring |
| 5 | 10+ guardrail tests | (integrated into existing) | Validated AI responses |
| 6 | Analytics store | Open Dashboard | Complete feature set |
| 7 | (no new — verification) | All 8 fully working | Installable VSIX |

---

*This plan implements the design from the spec document. Each phase ends with a code review checkpoint. No phase is skipped.*
