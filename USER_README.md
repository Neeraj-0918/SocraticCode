# SocraticCode VS Code Extension

**Tagline:** *Think Better. Code Smarter.*

---

## 🎯 Project Overview
SocraticCode is a **research‑grade VS Code extension** that teaches beginner programmers how to reason about their code using a **progressive Socratic tutoring workflow**. It analyses source files with language‑aware parsers, presents structured findings, and then guides the learner through three hint levels:

1. **Conceptual hint** – surface the underlying programming concept.
2. **Logical & algorithmic reasoning** – ask the learner to trace variables / logic.
3. **Structural guidance / pseudocode** – suggest concrete steps without giving a full solution.

The tutor runs in **demo mode** (no API key required) or in **AI‑powered mode** using Google Gemini (or any future provider). All analytics are stored locally for a personal learning dashboard.

---

## 📦 Current Status (as of 2026‑10‑31)
| Check | Status |
|------|--------|
| **Git branch** | `master` (all work **merged** from `feature-branch`) |
| **TypeScript compilation** | ✅ `tsc --noEmit` – 0 errors |
| **Unit tests** | ✅ 49 tests / 13 files – all passing |
| **VSIX package** | ✅ `socraticcode-0.1.1.vsix` built (≈1.96 MiB) |
| **Uncommitted changes** | ✅ All changes have been committed |
| **Learning Dashboard** | Fixed – now displays analytics (CSP added, error handling, defensive checks) |
| **Extension identifier** | `socraticcode.socraticcode` |
| **Publisher** | `socraticcode` (local only; no marketplace publish) |
| **.gitignore** | ✅ Updated – `.agents/` added to ignore list |

You can safely continue development on `master` or publish the VSIX to a private marketplace.

---

## 🌐 Repository
The project lives in the local workspace:

```
D:\Niraj Study\Niraj-college\SEM-5\RP\SocraticCode
```

If you push it to a remote, the recommended URL is:

```
https://github.com/your‑username/socraticcode
```
*(Replace `your‑username` with the appropriate GitHub account.)*

---

## 🛠️ Prerequisites
- **Node.js 20+** (LTS) – `node -v` should show `v20.x`
- **npm** (comes with Node) – `npm -v`
- **VS Code** (latest) with the *Extension Development* extension installed
- **Git** – for version control
- Optional (AI mode): a **Google Gemini API key** (store via the *Configure AI Provider* command)

---

## 🚀 Setup & Installation
```bash
# 1️⃣ Clone / open the workspace (already opened in your IDE)
# 2️⃣ Install dependencies
npm ci

# 3️⃣ Build the TypeScript sources (produces `dist/`)
npx tsc --noEmit   # just type‑checks
npx esbuild src/extension.ts --bundle --outfile=dist/extension.js \
    --external:vscode --format=cjs --platform=node --sourcemap

# 4️⃣ Run the test suite
npx vitest run   # all 49 tests should pass

# 5️⃣ Package a VSIX (optional, for manual installation)
npx -y @vscode/vsce package --out socraticcode-0.1.1.vsix
```

---

## ▶️ Running the Extension (Development Host)
1. Open the workspace folder in VS Code.
2. Press **F5** – this launches an *Extension Development Host* window.
3. In the new window you will see a **SocraticCode** icon in the Activity Bar.
4. Click the icon to open the **SocraticCode Sidebar**.
5. Use the commands (see below) or the context‑menu actions to start analysing a file, ask questions, or open the **Learning Dashboard**.

---

## ✨ Core Features
- **AST‑informed code analysis** for Python, Java, C, and C++ (Tree‑sitter based).
- **Three‑level progressive hints** with strict solution‑leakage guardrails.
- **Demo mode** – fully functional UI without any external API.
- **AI mode** – plug‑and‑play Gemini provider (or any future provider) with secure `SecretStorage` for the API key.
- **Learning Dashboard** – visual heat‑map of weak concepts, hint counts, language usage, and recent interaction log.
- **Local analytics persistence** via VS Code `globalState` (or an in‑memory fallback).
- **Robust error handling** – dashboard shows a friendly error page if analytics loading fails.
- **Unit‑tested (Vitest)** – 49 passing tests covering analysis, tutoring, guardrails, and UI helpers.
- **Fully typed TypeScript** with strict settings (`tsconfig.json` → `strict: true`).

---

## 📜 VS Code Commands (registered in `package.json`)
| Command ID | Description |
|------------|-------------|
| `socraticcode.openTutor` | Opens the SocraticCode sidebar.
| `socraticcode.analyzeFile` | Parses the active file and sends findings to the sidebar.
| `socraticcode.askAboutSelection` | Prompts for a question about the current selection.
| `socraticcode.requestNextHint` | Requests the next hint level for the current tutoring session.
| `socraticcode.openDashboard` | Shows the Learning Dashboard webview.
| `socraticcode.clearSession` | Clears the current tutoring session and analytics history.
| `socraticcode.configureProvider` | Opens an input box to set or remove the Gemini API key.
| `socraticcode.switchDemoMode` | Toggles between Demo mode and AI mode.

All commands are also available via the **Command Palette** (`Ctrl+Shift+P`).

---

## 📊 Learning Dashboard UI
- **Header** – shows total sessions, hint counts per level, and a refresh/clear button.
- **Priority banner** – highlights the concept that needs the most practice.
- **Concept cards** – colour‑coded status (Needs Practice, Developing, Solid) with a short practice tip.
- **Language statistics** – table of sessions per language.
- **Interaction history** – recent sessions with time, language, concept, hint level, and the original question (truncated).
- **Responsive layout** – works in narrow sidebars and adapts to the current VS Code theme.

If the dashboard ever appears blank, click **↻ Refresh** – the panel will either render the data or show a detailed error page with a **Retry** button.

---

## 📦 Packaging & Distribution
```bash
# Create a VSIX for manual distribution
npx -y @vscode/vsce package --out socraticcode-0.1.1.vsix
```
Install the VSIX in any VS Code instance via **Extensions → Install from VSIX…**.

*Note:* The extension does **not** publish to the public Marketplace automatically – you would need a publisher account and `vsce` login to do that.

---

## 🐞 Known Issues & Tips
- **Restricted mode** in the Extension Development Host can block webview loading. Ensure the host is **not** in *Restricted Mode* (status bar indicator). If needed, click *Allow* when prompted.
- The first time you run the extension in AI mode, you will be asked for a Gemini API key. The key is stored securely via VS Code `SecretStorage` and never appears in logs or UI.
- The dashboard uses a **nonce‑based CSP**; if you modify `dashboardPanel.ts` make sure to keep the `<meta http‑equiv="Content‑Security‑Policy">` line intact.

---

## 🤝 Contributing
1. Fork the repository.
2. Create a feature branch off `master` (e.g., `git checkout -b my‑feature`).
3. Follow the existing code‑style (TSLint is disabled; rely on `eslint` + Prettier settings).
4. Add or update unit tests (`src/**/*.test.ts`).
5. Run `npx vitest run` to ensure all tests still pass.
6. Open a Pull Request targeting `master`.

---

## 📄 License
This project is released under the **MIT License** – see the `LICENSE` file for the full text.

---

## 📞 Contact & Further Reading
- **Research paper** – *AST‑Informed AI Tutoring with Progressive Socratic Programming Feedback* (internal draft in `docs/`).
- **Issue tracker** – open issues in the GitHub repository (once pushed).
- **Documentation** – source code is heavily commented; see the `src/` folder for the architecture overview.

---

*Happy coding, and enjoy watching your students think better and code smarter!*
