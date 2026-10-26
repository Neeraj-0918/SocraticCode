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
    const summary = await this._analyticsStore.getSummary();
    this._panel.webview.html = this.getHtmlForWebview(summary);
  }

  public dispose(): void {
    DashboardPanel.currentPanel = undefined;
    this._panel.dispose();
    while (this._disposables.length) {
      const d = this._disposables.pop();
      if (d) d.dispose();
    }
  }

  private getHtmlForWebview(summary: AnalyticsSummary): string {
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

    const recentRows = summary.recentSessions.length > 0
      ? summary.recentSessions
          .map(
            (s) => {
              const conceptName = s.concept || 'General Problem Solving';
              const isAlt = s.mode === 'alternative_approach';
              const modePill = isAlt
                ? '<span class="badge badge-alt">✨ Alternative Approach</span>'
                : `<span class="badge badge-l${s.maxHintLevel}">Level ${s.maxHintLevel} Hint</span>`;

              return `
              <tr>
                <td style="white-space: nowrap; color: var(--vscode-descriptionForeground); font-size: 11px;">${new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
                <td style="text-transform: capitalize; font-weight: 600;">${escapeHtml(s.language)}</td>
                <td><span class="badge badge-concept">${escapeHtml(conceptName)}</span></td>
                <td>${modePill}</td>
                <td title="${escapeHtml(s.question)}">${escapeHtml(s.question.slice(0, 48))}${s.question.length > 48 ? '...' : ''}</td>
                <td><span style="font-size: 11px; color: var(--vscode-descriptionForeground);">${escapeHtml(s.provider)}</span></td>
                <td>${s.wasFallback ? '<span class="badge-guard">🛡️ Shield Active</span>' : '<span style="color:#22c55e; font-weight: 600; font-size: 11px;">✓ Clean</span>'}</td>
              </tr>`;
            }
          )
          .join('')
      : '<tr><td colspan="7" style="text-align: center; color: var(--vscode-descriptionForeground); padding: 32px;">No learning sessions recorded yet. Ask questions or request hints in the SocraticCode sidebar to generate analytics!</td></tr>';

    // Weak Concept Heatmap Cards
    const weakConceptCards = (summary.weakConcepts && summary.weakConcepts.length > 0)
      ? summary.weakConcepts.map((item) => {
          let statusClass = 'status-solid';
          let statusIcon = '✅';
          let meterColor = '#22c55e';
          if (item.status === 'Needs Practice') {
            statusClass = 'status-needs-practice';
            statusIcon = '⚠️';
            meterColor = '#ef4444';
          } else if (item.status === 'Developing') {
            statusClass = 'status-developing';
            statusIcon = '🔄';
            meterColor = '#f59e0b';
          }

          return `
          <div class="concept-card ${statusClass}">
            <div class="concept-card-top">
              <div class="concept-title-group">
                <span class="concept-name">${escapeHtml(item.concept)}</span>
                <span class="concept-tag ${statusClass}">${statusIcon} ${item.status}</span>
              </div>
              <div class="concept-rate-number">${item.struggleRate}% struggle</div>
            </div>
            <div class="meter-track">
              <div class="meter-fill" style="width: ${Math.max(item.struggleRate, 6)}%; background: ${meterColor};"></div>
            </div>
            <div class="concept-meta">
              <span><strong>${item.totalQueries}</strong> queries</span> · 
              <span><strong>${item.highStruggleCount}</strong> required deeper hints (L2/L3)</span>
            </div>
            <div class="concept-tip">
              <span class="tip-label">💡 Recommended Practice:</span>
              <p class="tip-text">${escapeHtml(item.recommendation)}</p>
            </div>
          </div>`;
        }).join('')
      : `<div class="empty-heatmap">
          <p>🎯 No concept struggle data yet. As you ask questions and explore hints, SocraticCode will highlight your focus areas here!</p>
        </div>`;

    const topWeak = summary.weakConcepts?.find(c => c.status === 'Needs Practice');
    const priorityBanner = topWeak
      ? `<div class="priority-banner">
          <div class="banner-icon">🎯</div>
          <div class="banner-content">
            <div class="banner-title">High Priority Practice Recommendation: <strong>${escapeHtml(topWeak.concept)}</strong></div>
            <div class="banner-desc">${escapeHtml(topWeak.recommendation)}</div>
          </div>
        </div>`
      : '';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SocraticCode Analytics Dashboard</title>
  <style>
    :root {
      --bg: var(--vscode-editor-background, #181825);
      --card-bg: var(--vscode-editorWidget-background, #1e1e2e);
      --fg: var(--vscode-editor-foreground, #cdd6f4);
      --border: var(--vscode-widget-border, #313244);
      --muted: var(--vscode-descriptionForeground, #a6adc8);
      --accent: var(--vscode-button-background, #89b4fa);
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
      font-size: 22px;
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
      padding: 8px 16px;
      border-radius: 6px;
      cursor: pointer;
      font-weight: 600;
      font-size: 12px;
      transition: opacity 0.15s ease;
    }
    button:hover {
      opacity: 0.9;
    }
    button.secondary {
      background: var(--vscode-button-secondaryBackground, #313244);
      color: var(--vscode-button-secondaryForeground, #cdd6f4);
      border: 1px solid var(--border);
    }
    button.danger {
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }
    button.danger:hover {
      background: #dc2626;
      color: #fff;
    }

    .priority-banner {
      background: linear-gradient(135deg, rgba(239, 68, 68, 0.12), rgba(245, 158, 11, 0.08));
      border: 1px solid rgba(239, 68, 68, 0.3);
      border-radius: 8px;
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
      font-size: 14px;
      font-weight: 600;
      color: #fca5a5;
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
      border-radius: 8px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
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
      font-size: 16px;
      font-weight: 700;
      margin: 28px 0 14px 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .section-desc {
      font-size: 12px;
      color: var(--muted);
      margin: -10px 0 14px 0;
    }

    /* Heatmap Grid */
    .heatmap-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(290px, 1fr));
      gap: 16px;
      margin-bottom: 28px;
    }
    .concept-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 16px;
      display: flex;
      flex-direction: column;
      gap: 10px;
      position: relative;
    }
    .concept-card.status-needs-practice {
      border-left: 4px solid #ef4444;
      background: linear-gradient(180deg, rgba(239, 68, 68, 0.04) 0%, var(--card-bg) 100%);
    }
    .concept-card.status-developing {
      border-left: 4px solid #f59e0b;
      background: linear-gradient(180deg, rgba(245, 158, 11, 0.04) 0%, var(--card-bg) 100%);
    }
    .concept-card.status-solid {
      border-left: 4px solid #22c55e;
      background: linear-gradient(180deg, rgba(34, 197, 94, 0.04) 0%, var(--card-bg) 100%);
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
      padding: 2px 6px;
      border-radius: 4px;
      width: fit-content;
    }
    .concept-tag.status-needs-practice {
      background: rgba(239, 68, 68, 0.2);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.3);
    }
    .concept-tag.status-developing {
      background: rgba(245, 158, 11, 0.2);
      color: #fbbf24;
      border: 1px solid rgba(245, 158, 11, 0.3);
    }
    .concept-tag.status-solid {
      background: rgba(34, 197, 94, 0.2);
      color: #4ade80;
      border: 1px solid rgba(34, 197, 94, 0.3);
    }
    .concept-rate-number {
      font-size: 12px;
      font-weight: 700;
      color: var(--muted);
    }

    .meter-track {
      background: rgba(255, 255, 255, 0.08);
      height: 6px;
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
      background: rgba(0, 0, 0, 0.2);
      border-radius: 6px;
      padding: 10px;
      font-size: 12px;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .tip-label {
      font-weight: 600;
      color: var(--muted);
      font-size: 11px;
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
      border-radius: 8px;
      padding: 16px;
      margin-bottom: 28px;
    }
    .bar-wrapper {
      height: 16px;
      display: flex;
      border-radius: 8px;
      overflow: hidden;
      margin: 12px 0;
      background: rgba(255, 255, 255, 0.06);
    }
    .bar-l1 { background: #3b82f6; width: ${p1}%; }
    .bar-l2 { background: #eab308; width: ${p2}%; }
    .bar-l3 { background: #22c55e; width: ${p3}%; }
    .bar-legend {
      display: flex;
      gap: 20px;
      font-size: 12px;
      flex-wrap: wrap;
    }
    .legend-dot {
      display: inline-block;
      width: 10px;
      height: 10px;
      border-radius: 50%;
      margin-right: 6px;
    }

    table {
      width: 100%;
      border-collapse: collapse;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 8px;
      overflow: hidden;
    }
    th, td {
      padding: 10px 14px;
      text-align: left;
      border-bottom: 1px solid var(--border);
      font-size: 12px;
    }
    th {
      background: rgba(255, 255, 255, 0.03);
      color: var(--muted);
      font-weight: 600;
      text-transform: uppercase;
      font-size: 11px;
      letter-spacing: 0.5px;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      white-space: nowrap;
    }
    .badge-l1 { background: rgba(59, 130, 246, 0.15); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.3); }
    .badge-l2 { background: rgba(234, 179, 8, 0.15); color: #facc15; border: 1px solid rgba(234, 179, 8, 0.3); }
    .badge-l3 { background: rgba(34, 197, 94, 0.15); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.3); }
    .badge-alt { background: linear-gradient(135deg, rgba(168, 85, 247, 0.2), rgba(59, 130, 246, 0.2)); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.3); }
    .badge-concept { background: rgba(255, 255, 255, 0.07); color: var(--fg); border: 1px solid var(--border); }
    .badge-guard { background: rgba(239, 68, 68, 0.15); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.3); padding: 2px 6px; border-radius: 4px; font-size: 10px; font-weight: 600; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title-area">
      <h1>⚡ SocraticCode Learning & Concept Diagnostics</h1>
      <p class="subtitle">Cognitive scaffolding metrics, weak concept detection, and solution-leakage guardrail logs.</p>
    </div>
    <div class="actions">
      <button class="secondary" onclick="sendMessage('refresh')">↻ Refresh</button>
      <button class="danger" onclick="sendMessage('clear')">Clear History</button>
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
      <div class="stat-value" style="color: #60a5fa;">${l1}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Level 2: Reasoning</div>
      <div class="stat-value" style="color: #facc15;">${l2}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Level 3: Structural</div>
      <div class="stat-value" style="color: #4ade80;">${l3}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Guardrail Shield Interventions</div>
      <div class="stat-value" style="color: #f87171;">${summary.guardrailInterventions}</div>
    </div>
  </div>

  <!-- Weak Concepts Heatmap & Practice Hub -->
  <div class="section-title">🔥 Concept Diagnostics & Practice Heatmap</div>
  <p class="section-desc">Identifies programming concepts where you required Level 2/3 hints or guardrail interventions, with targeted practice tips.</p>
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
      <div><span class="legend-dot" style="background: #3b82f6;"></span> Level 1 (Conceptual): ${p1}%</div>
      <div><span class="legend-dot" style="background: #eab308;"></span> Level 2 (Logical Reasoning): ${p2}%</div>
      <div><span class="legend-dot" style="background: #22c55e;"></span> Level 3 (Structural Guidance): ${p3}%</div>
    </div>
  </div>

  <!-- Active Languages -->
  <div class="section-title">💻 Practiced Programming Languages</div>
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
  <div class="section-title">📋 Learning Interaction Logs</div>
  <table>
    <thead>
      <tr>
        <th>Time</th>
        <th>Lang</th>
        <th>Concept Area</th>
        <th>Interaction Mode</th>
        <th>User Question</th>
        <th>Provider</th>
        <th>Integrity Shield</th>
      </tr>
    </thead>
    <tbody>
      ${recentRows}
    </tbody>
  </table>

  <script>
    const vscode = acquireVsCodeApi();
    function sendMessage(type) {
      vscode.postMessage({ type });
    }
  </script>
</body>
</html>`;
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
