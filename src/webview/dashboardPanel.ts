import * as vscode from 'vscode';
import { AnalyticsStore } from '../analytics/analyticsStore';
import { AnalyticsSummary } from '../analytics/types';

export class DashboardPanel {
  public static currentPanel: DashboardPanel | undefined;
  private readonly _panel: vscode.WebviewPanel;
  private readonly _extensionUri: vscode.Uri;
  private readonly _analyticsStore: AnalyticsStore;
  private _disposables: vscode.Disposable[] = [];

  public static createOrShow(extensionUri: vscode.Uri, analyticsStore: AnalyticsStore): void {
    const column = vscode.window.activeTextEditor
      ? vscode.window.activeTextEditor.viewColumn
      : undefined;

    if (DashboardPanel.currentPanel) {
      DashboardPanel.currentPanel._panel.reveal(column);
      DashboardPanel.currentPanel.refresh();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'socraticcodeDashboard',
      'SocraticCode Learning Dashboard',
      column || vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'dist'),
          vscode.Uri.joinPath(extensionUri, 'resources'),
        ],
      }
    );

    DashboardPanel.currentPanel = new DashboardPanel(panel, extensionUri, analyticsStore);
  }

  private constructor(
    panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    analyticsStore: AnalyticsStore
  ) {
    this._panel = panel;
    this._extensionUri = extensionUri;
    this._analyticsStore = analyticsStore;

    this._panel.webview.html = this.getLoadingHtml();
    this.refresh();

    this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

    this._panel.webview.onDidReceiveMessage(
      async (message) => {
        switch (message.type) {
          case 'refresh':
            await this.refresh();
            break;
          case 'clear': {
            const confirm = await vscode.window.showWarningMessage(
              'Are you sure you want to clear all SocraticCode learning analytics history?',
              { modal: true },
              'Yes, Clear All'
            );
            if (confirm === 'Yes, Clear All') {
              await this._analyticsStore.clearAnalytics();
              vscode.window.showInformationMessage('SocraticCode analytics cleared.');
              await this.refresh();
            }
            break;
          }
        }
      },
      null,
      this._disposables
    );
  }

  public async refresh(): Promise<void> {
    try {
      const summary = await this._analyticsStore.getSummary();
      this._panel.webview.html = this.getHtmlForWebview(summary);
    } catch (err) {
      console.error('SocraticCode Dashboard refresh failed:', err);
      const errorMsg = err instanceof Error ? err.message : String(err);
      this._panel.webview.html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SocraticCode Dashboard Error</title>
</head>
<body style="font-family: var(--vscode-font-family, sans-serif); color: var(--vscode-editor-foreground, #ccc); background: var(--vscode-editor-background, #1e1e2e); padding: 40px; text-align: center;">
  <h2>⚠️ Dashboard Error</h2>
  <p style="color: #f87171;">Failed to load analytics: ${errorMsg}</p>
  <p style="color: var(--vscode-descriptionForeground, #888);">Try clicking Refresh, or clear analytics data and retry.</p>
  <button onclick="const vscode = acquireVsCodeApi(); vscode.postMessage({ type: 'refresh' });"
    style="margin-top: 16px; padding: 8px 20px; background: var(--vscode-button-background, #89b4fa); color: #fff; border: none; border-radius: 6px; cursor: pointer; font-weight: 600;">
    ↻ Retry
  </button>
</body>
</html>`;
    }
  }

  public dispose(): void {
    DashboardPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const d = this._disposables.pop();
      if (d) d.dispose();
    }
  }

  private getLoadingHtml(): string {
    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SocraticCode Learning Dashboard</title>
</head>
<body style="font-family: var(--vscode-font-family, -apple-system, sans-serif); color: var(--vscode-editor-foreground, #cdd6f4); background-color: var(--vscode-editor-background, #181825); display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0;">
  <div style="text-align: center;">
    <h2 style="font-size: 20px; font-weight: 700; margin: 0 0 8px 0;">⚡ SocraticCode Learning Dashboard</h2>
    <p style="color: var(--vscode-descriptionForeground, #a6adc8); font-size: 13px; margin: 0;">Loading analytics and concept diagnostics...</p>
  </div>
</body>
</html>`;
  }

  private getNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let nonce = '';
    for (let i = 0; i < 32; i++) {
      nonce += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return nonce;
  }

  private getHtmlForWebview(summary: AnalyticsSummary): string {
    const nonce = this.getNonce();
    const l1 = summary.hintsByLevel.l1;
    const l2 = summary.hintsByLevel.l2;
    const l3 = summary.hintsByLevel.l3;
    const totalHints = l1 + l2 + l3 || 1;

    const p1 = Math.round((l1 / totalHints) * 100);
    const p2 = Math.round((l2 / totalHints) * 100);
    const p3 = Math.round((l3 / totalHints) * 100);

    const langRows = Object.entries(summary.languages)
      .map(([lang, count]) => `<tr><td style="text-transform: capitalize; font-weight: 500;">${escapeHtml(lang)}</td><td><strong>${count}</strong> sessions</td></tr>`)
      .join('');

    const recentRows = (summary.recentSessions && summary.recentSessions.length > 0)
      ? summary.recentSessions
          .filter(Boolean)
          .map(
            (s) => {
              const conceptName = s.concept || 'General Problem Solving';
              const isAlt = s.mode === 'alternative_approach';
              const hintLevel = typeof s.maxHintLevel === 'number' ? s.maxHintLevel : 1;
              const modePill = isAlt
                ? '<span class="badge badge-alt">✨ Alternative</span>'
                : `<span class="badge badge-l${hintLevel}">Level ${hintLevel}</span>`;
              const timeStr = s.timestamp ? new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-';
              const rawQ = s.question;
              const qText = (typeof rawQ === 'string' && rawQ.trim().length > 0)
                ? rawQ.trim()
                : (typeof rawQ === 'object' && rawQ !== null ? 'Code inquiry' : 'General inquiry');
              const truncatedQ = qText.length > 56 ? qText.slice(0, 56) + '...' : qText;

              return `
              <tr>
                <td style="white-space: nowrap; color: var(--muted); font-size: 11px;">${timeStr}</td>
                <td style="text-transform: capitalize; font-weight: 500;">${escapeHtml(s.language || 'unknown')}</td>
                <td><span class="badge badge-concept">${escapeHtml(conceptName)}</span></td>
                <td>${modePill}</td>
                <td title="${escapeHtml(qText)}" style="color: var(--fg);">${escapeHtml(truncatedQ)}</td>
              </tr>`;
            }
          )
          .join('')
      : '<tr><td colspan="5" style="text-align: center; color: var(--muted); padding: 32px;">No learning sessions recorded yet. Ask questions or request hints in the SocraticCode sidebar to generate insights!</td></tr>';

    // Encouraging Concept Practice Cards
    const weakConceptCards = (summary.weakConcepts && summary.weakConcepts.length > 0)
      ? summary.weakConcepts.map((item) => {
          let statusClass = 'status-solid';
          let statusIcon = '✨';
          let statusLabel = 'Confident';
          let meterGradient = 'linear-gradient(90deg, #10b981, #34d399)';
          if (item.status === 'Needs Practice') {
            statusClass = 'status-focus';
            statusIcon = '🎯';
            statusLabel = 'Focus Area';
            meterGradient = 'linear-gradient(90deg, #6366f1, #818cf8)';
          } else if (item.status === 'Developing') {
            statusClass = 'status-progress';
            statusIcon = '🔄';
            statusLabel = 'In Progress';
            meterGradient = 'linear-gradient(90deg, #f59e0b, #fbbf24)';
          }

          const meterWidth = Math.min(Math.max(item.struggleRate, 14), 100);

          return `
          <div class="concept-card ${statusClass}">
            <div class="concept-card-top">
              <div class="concept-title-group">
                <span class="concept-name">${escapeHtml(item.concept)}</span>
                <span class="concept-tag ${statusClass}">${statusIcon} ${statusLabel}</span>
              </div>
              <div class="concept-rate-number">${item.highStruggleCount} deeper hints</div>
            </div>
            <div class="meter-track">
              <div class="meter-fill" style="width: ${meterWidth}%; background: ${meterGradient};"></div>
            </div>
            <div class="concept-meta">
              <span><strong>${item.totalQueries}</strong> questions explored</span>
            </div>
            <div class="concept-tip">
              <span class="tip-label">💡 Recommended Practice</span>
              <p class="tip-text">${escapeHtml(item.recommendation)}</p>
            </div>
          </div>`;
        }).join('')
      : `<div class="empty-heatmap">
          <p>🎯 No concept data yet. As you ask questions and explore hints, SocraticCode will highlight your study focus areas here!</p>
        </div>`;

    const topWeak = summary.weakConcepts?.find(c => c.status === 'Needs Practice');
    const priorityBanner = topWeak
      ? `<div class="priority-banner">
          <div class="banner-icon">🎯</div>
          <div class="banner-content">
            <div class="banner-title">Recommended Study Focus: <strong>${escapeHtml(topWeak.concept)}</strong></div>
            <div class="banner-desc">${escapeHtml(topWeak.recommendation)}</div>
          </div>
        </div>`
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this._panel.webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
  <title>SocraticCode Learning Dashboard</title>
  <style>
    :root {
      --bg: var(--vscode-editor-background, #181825);
      --card-bg: var(--vscode-editorWidget-background, #1e1e2e);
      --fg: var(--vscode-editor-foreground, #cdd6f4);
      --border: var(--vscode-widget-border, #313244);
      --muted: var(--vscode-descriptionForeground, #a6adc8);
      --accent: var(--vscode-button-background, #6366f1);
    }
    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif);
      font-size: var(--vscode-font-size, 13px);
      color: var(--fg);
      background-color: var(--bg);
      padding: 24px 36px;
      line-height: 1.5;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--border);
      padding-bottom: 18px;
      margin-bottom: 24px;
    }
    .title-area h1 {
      margin: 0 0 6px 0;
      font-size: 21px;
      font-weight: 700;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .subtitle {
      color: var(--muted);
      margin: 0;
      font-size: 13px;
    }
    .actions {
      display: flex;
      gap: 10px;
    }
    button {
      background: var(--accent);
      color: var(--vscode-button-foreground, #fff);
      border: none;
      padding: 7px 15px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
      font-size: 12px;
      transition: all 0.15s ease;
    }
    button:hover {
      opacity: 0.9;
    }
    button.secondary {
      background: var(--vscode-button-secondaryBackground, #313244);
      color: var(--vscode-button-secondaryForeground, #cdd6f4);
      border: 1px solid var(--border);
    }
    button.clear-btn {
      background: transparent;
      color: var(--muted);
      border: 1px solid var(--border);
    }
    button.clear-btn:hover {
      background: rgba(239, 68, 68, 0.12);
      color: #f87171;
      border-color: rgba(239, 68, 68, 0.25);
    }

    .priority-banner {
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(56, 189, 248, 0.05));
      border: 1px solid rgba(99, 102, 241, 0.25);
      border-radius: 10px;
      padding: 14px 18px;
      display: flex;
      align-items: center;
      gap: 14px;
      margin-bottom: 24px;
    }
    .banner-icon {
      font-size: 24px;
      flex-shrink: 0;
    }
    .banner-title {
      font-size: 13px;
      font-weight: 600;
      color: #c7d2fe;
      margin-bottom: 2px;
    }
    .banner-desc {
      font-size: 12px;
      color: var(--fg);
    }

    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      margin-bottom: 28px;
    }
    .stat-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      transition: border-color 0.2s ease;
    }
    .stat-card:hover {
      border-color: rgba(99, 102, 241, 0.3);
    }
    .stat-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: var(--muted);
      font-weight: 600;
    }
    .stat-value {
      font-size: 26px;
      font-weight: 700;
      letter-spacing: -0.5px;
    }

    .section-title {
      font-size: 15px;
      font-weight: 700;
      margin: 28px 0 12px 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .section-desc {
      font-size: 12px;
      color: var(--muted);
      margin: -8px 0 14px 0;
    }

    /* Concept Cards Grid */
    .heatmap-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(290px, 1fr));
      gap: 16px;
      margin-bottom: 28px;
    }
    .concept-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      position: relative;
      transition: all 0.2s ease;
    }
    .concept-card:hover {
      border-color: rgba(99, 102, 241, 0.3);
      transform: translateY(-1px);
    }
    .concept-card.status-focus {
      border-top: 3px solid #818cf8;
    }
    .concept-card.status-progress {
      border-top: 3px solid #fbbf24;
    }
    .concept-card.status-solid {
      border-top: 3px solid #34d399;
    }

    .concept-card-top {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
    }
    .concept-title-group {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .concept-name {
      font-size: 14px;
      font-weight: 600;
      color: var(--fg);
    }
    .concept-tag {
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      padding: 2px 7px;
      border-radius: 4px;
      width: fit-content;
    }
    .concept-tag.status-focus {
      background: rgba(99, 102, 241, 0.15);
      color: #a5b4fc;
      border: 1px solid rgba(99, 102, 241, 0.3);
    }
    .concept-tag.status-progress {
      background: rgba(245, 158, 11, 0.15);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.3);
    }
    .concept-tag.status-solid {
      background: rgba(16, 185, 129, 0.15);
      color: #34d399;
      border: 1px solid rgba(16, 185, 129, 0.3);
    }
    .concept-rate-number {
      font-size: 11px;
      font-weight: 600;
      color: var(--muted);
      white-space: nowrap;
    }

    .meter-track {
      background: rgba(255, 255, 255, 0.06);
      height: 5px;
      border-radius: 3px;
      overflow: hidden;
    }
    .meter-fill {
      height: 100%;
      border-radius: 3px;
      transition: width 0.3s ease;
    }
    .concept-meta {
      font-size: 11px;
      color: var(--muted);
    }
    .concept-tip {
      background: rgba(0, 0, 0, 0.15);
      border-radius: 6px;
      padding: 10px 12px;
      font-size: 12px;
      display: flex;
      flex-direction: column;
      gap: 3px;
    }
    .tip-label {
      font-weight: 600;
      color: var(--muted);
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .tip-text {
      margin: 0;
      line-height: 1.4;
      color: var(--fg);
    }
    .empty-heatmap {
      grid-column: 1 / -1;
      background: var(--card-bg);
      border: 1px dashed var(--border);
      border-radius: 8px;
      padding: 24px;
      text-align: center;
      color: var(--muted);
    }

    /* Scaffolding Bar */
    .bar-container {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 16px;
      margin-bottom: 28px;
    }
    .bar-wrapper {
      height: 14px;
      display: flex;
      border-radius: 7px;
      overflow: hidden;
      margin: 12px 0;
      background: rgba(255, 255, 255, 0.06);
    }
    .bar-l1 { background: #38bdf8; width: ${p1}%; }
    .bar-l2 { background: #fbbf24; width: ${p2}%; }
    .bar-l3 { background: #34d399; width: ${p3}%; }
    .bar-legend {
      display: flex;
      gap: 20px;
      font-size: 12px;
      flex-wrap: wrap;
    }
    .legend-dot {
      display: inline-block;
      width: 9px;
      height: 9px;
      border-radius: 50%;
      margin-right: 6px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 10px;
      overflow: hidden;
    }
    th, td {
      padding: 10px 14px;
      text-align: left;
      border-bottom: 1px solid var(--border);
      font-size: 12px;
    }
    th {
      background: rgba(255, 255, 255, 0.02);
      color: var(--muted);
      font-weight: 600;
      text-transform: uppercase;
      font-size: 10px;
      letter-spacing: 0.5px;
    }
    .badge {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
    }
    .badge-l1 { background: rgba(56, 189, 248, 0.12); color: #38bdf8; border: 1px solid rgba(56, 189, 248, 0.25); }
    .badge-l2 { background: rgba(251, 191, 36, 0.12); color: #fbbf24; border: 1px solid rgba(251, 191, 36, 0.25); }
    .badge-l3 { background: rgba(52, 211, 153, 0.12); color: #34d399; border: 1px solid rgba(52, 211, 153, 0.25); }
    .badge-alt { background: rgba(168, 85, 247, 0.12); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.25); }
    .badge-concept { background: rgba(255, 255, 255, 0.05); color: var(--fg); border: 1px solid var(--border); }
  </style>
</head>
<body>
  <div class="header">
    <div class="title-area">
      <h1>🧠 SocraticCode Learning Dashboard</h1>
      <p class="subtitle">Cognitive scaffolding distribution, concept mastery, and learning journey insights.</p>
    </div>
    <div class="actions">
      <button class="secondary" onclick="sendMessage('refresh')">↻ Refresh</button>
      <button class="clear-btn" onclick="sendMessage('clear')">Clear History</button>
    </div>
  </div>

  ${priorityBanner}

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-label">Total Sessions</div>
      <div class="stat-value">${summary.totalSessions}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Level 1: Conceptual</div>
      <div class="stat-value" style="color: #38bdf8;">${l1}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Level 2: Reasoning</div>
      <div class="stat-value" style="color: #fbbf24;">${l2}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Level 3: Structural</div>
      <div class="stat-value" style="color: #34d399;">${l3}</div>
    </div>
  </div>

  <!-- Concept Diagnostics & Practice Hub -->
  <div class="section-title">💡 Concept Focus & Practice Recommendations</div>
  <p class="section-desc">Key programming topics explored, highlighting where deeper hints were requested to guide your practice.</p>
  <div class="heatmap-grid">
    ${weakConceptCards}
  </div>

  <!-- Cognitive Scaffolding Distribution -->
  <div class="section-title">📊 Cognitive Scaffolding Distribution</div>
  <div class="bar-container">
    <div class="bar-wrapper">
      <div class="bar-l1" title="Level 1: ${p1}%"></div>
      <div class="bar-l2" title="Level 2: ${p2}%"></div>
      <div class="bar-l3" title="Level 3: ${p3}%"></div>
    </div>
    <div class="bar-legend">
      <div><span class="legend-dot" style="background: #38bdf8;"></span> Level 1 (Conceptual): ${p1}%</div>
      <div><span class="legend-dot" style="background: #fbbf24;"></span> Level 2 (Logical Reasoning): ${p2}%</div>
      <div><span class="legend-dot" style="background: #34d399;"></span> Level 3 (Structural Guidance): ${p3}%</div>
    </div>
  </div>

  <!-- Practiced Languages -->
  <div class="section-title">💻 Practiced Languages</div>
  <table style="margin-bottom: 28px;">
    <thead>
      <tr>
        <th>Language</th>
        <th>Recorded Sessions</th>
      </tr>
    </thead>
    <tbody>
      ${langRows || '<tr><td colspan="2" style="color: var(--muted); text-align: center;">No language data yet</td></tr>'}
    </tbody>
  </table>

  <!-- Detailed Learning Log Table -->
  <div class="section-title">📋 Learning Interaction History</div>
  <table>
    <thead>
      <tr>
        <th>Time</th>
        <th>Language</th>
        <th>Concept Area</th>
        <th>Guidance Mode</th>
        <th>Question / Query</th>
      </tr>
    </thead>
    <tbody>
      ${recentRows}
    </tbody>
  </table>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    function sendMessage(type) {
      vscode.postMessage({ type });
    }
  </script>
</body>
</html>`;
  }
}

function escapeHtml(text?: string | null): string {
  if (text === undefined || text === null) {
    return '';
  }
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
