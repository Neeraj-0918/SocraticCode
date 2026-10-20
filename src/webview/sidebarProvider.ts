import * as vscode from 'vscode';
import * as path from 'path';

export class SocraticSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'socraticcode-sidebar';

  private _view?: vscode.WebviewView;

  constructor(private readonly _extensionUri: vscode.Uri) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    _context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, 'dist'),
      ],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (data) => {
      switch (data.type) {
        case 'analyzeFile': {
          vscode.commands.executeCommand('socraticcode.analyzeCurrentFile');
          break;
        }
        case 'askQuestion': {
          vscode.commands.executeCommand('socraticcode.askAboutSelection', data.text);
          break;
        }
        case 'requestNextHint': {
          vscode.commands.executeCommand('socraticcode.requestNextHint');
          break;
        }
        case 'openDashboard': {
          vscode.commands.executeCommand('socraticcode.openDashboard');
          break;
        }
        case 'clearSession': {
          vscode.commands.executeCommand('socraticcode.clearSession');
          break;
        }
      }
    });
  }

  public postMessage(message: any): void {
    if (this._view) {
      this._view.webview.postMessage(message);
    }
  }

  public show(): void {
    if (this._view) {
      this._view.show?.(true);
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const stylesUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'sidebar', 'styles.css')
    );
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'sidebar', 'main.js')
    );

    // Nonce for CSP security
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <link rel="stylesheet" href="${stylesUri}">
  <title>SocraticCode Tutor</title>
</head>
<body>
  <div class="sidebar-container">
    <!-- Header -->
    <header class="header">
      <div class="branding">
        <span class="logo">⚡</span>
        <h2 class="title">SocraticCode</h2>
      </div>
      <div class="status-bar">
        <span id="lang-badge" class="badge">No file open</span>
        <span id="provider-badge" class="badge mode-demo">Demo Mode</span>
      </div>
    </header>

    <!-- Analysis Action Section -->
    <section class="section analysis-section">
      <div class="section-header">
        <h3>Code Analysis</h3>
        <button id="btn-analyze" class="btn btn-primary">Analyze File</button>
      </div>
      <div id="analysis-results" class="analysis-box empty">
        <p class="placeholder-text">Click "Analyze File" or select code in the editor to inspect AST structure.</p>
      </div>
    </section>

    <!-- Socratic Question & Interaction Section -->
    <section class="section question-section">
      <div class="section-header">
        <h3>Ask Tutor</h3>
      </div>
      <div class="input-group">
        <textarea id="question-input" rows="2" placeholder="Ask what your code does or where you're stuck..."></textarea>
        <div class="button-row">
          <button id="btn-ask" class="btn btn-secondary">Ask Question</button>
        </div>
      </div>
    </section>

    <!-- Progressive Hint Cards Section -->
    <section class="section hints-section">
      <div class="section-header">
        <h3>Progressive Hints</h3>
        <span id="hint-level-indicator" class="hint-level">Level 0/3</span>
      </div>
      <div id="hints-container" class="hints-container">
        <div class="hint-card empty-card">
          <p class="placeholder-text">Hints will guide you step-by-step: Conceptual → Logical Reasoning → Structural Guidance.</p>
        </div>
      </div>
      <div class="hint-actions">
        <button id="btn-next-hint" class="btn btn-outline" disabled>Request Next Hint (L1)</button>
      </div>
    </section>

    <!-- Session Footer Actions -->
    <footer class="footer">
      <button id="btn-dashboard" class="btn-link">📊 View Learning Dashboard</button>
      <button id="btn-clear" class="btn-link btn-danger">Clear Session</button>
    </footer>
  </div>

  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }
}

function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}
