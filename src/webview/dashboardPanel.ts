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
      .map(([lang, count]) => `<tr><td style="text-transform: capitalize; font-weight: 500;">${lang}</td><td>${count} sessions</td></tr>`)
      .join('');

    const recentRows = summary.recentSessions.length > 0
      ? summary.recentSessions
          .map(
            (s) => `
          <tr>
            <td>${new Date(s.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</td>
            <td style="text-transform: capitalize;">${escapeHtml(s.language)}</td>
            <td><span class="badge badge-l${s.maxHintLevel}">Level ${s.maxHintLevel}</span></td>
            <td>${escapeHtml(s.question.slice(0, 45))}${s.question.length > 45 ? '...' : ''}</td>
            <td>${escapeHtml(s.provider)}</td>
            <td>${s.wasFallback ? '<span class="badge-guard">Shield Deployed</span>' : '<span style="color:#22c55e;">Clean</span>'}</td>
          </tr>`
          )
          .join('')
      : '<tr><td colspan="6" style="text-align: center; color: var(--vscode-descriptionForeground); padding: 24px;">No learning sessions recorded yet. Start coding and ask the tutor questions in the sidebar!</td></tr>';

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SocraticCode Analytics Dashboard</title>
  <style>
    body {
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-editor-foreground);
      background-color: var(--vscode-editor-background);
      padding: 24px 32px;
      line-height: 1.5;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--vscode-widget-border, #333);
      padding-bottom: 16px;
      margin-bottom: 24px;
    }
    .title-area h1 {
      margin: 0 0 4px 0;
      font-size: 22px;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .subtitle {
      color: var(--vscode-descriptionForeground);
      margin: 0;
      font-size: 13px;
    }
    .actions {
      display: flex;
      gap: 10px;
    }
    button {
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      padding: 6px 14px;
      border-radius: 4px;
      cursor: pointer;
      font-weight: 500;
    }
    button:hover {
      background: var(--vscode-button-hoverBackground);
    }
    button.secondary {
      background: var(--vscode-button-secondaryBackground, #3a3d41);
      color: var(--vscode-button-secondaryForeground, #fff);
    }
    button.danger {
      background: #dc2626;
      color: #fff;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 16px;
      margin-bottom: 28px;
    }
    .stat-card {
      background: var(--vscode-editorWidget-background, #252526);
      border: 1px solid var(--vscode-widget-border, #3c3c3c);
      border-radius: 6px;
      padding: 16px;
    }
    .stat-label {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 8px;
    }
    .stat-value {
      font-size: 26px;
      font-weight: 600;
    }
    .section-title {
      font-size: 16px;
      font-weight: 600;
      margin: 24px 0 12px 0;
    }
    .bar-container {
      background: var(--vscode-editorWidget-background, #252526);
      border: 1px solid var(--vscode-widget-border, #3c3c3c);
      border-radius: 6px;
      padding: 16px;
      margin-bottom: 28px;
    }
    .bar-wrapper {
      height: 18px;
      display: flex;
      border-radius: 9px;
      overflow: hidden;
      margin: 12px 0;
      background: #1e1e1e;
    }
    .bar-l1 { background: #3b82f6; width: ${p1}%; }
    .bar-l2 { background: #eab308; width: ${p2}%; }
    .bar-l3 { background: #22c55e; width: ${p3}%; }
    .bar-legend {
      display: flex;
      gap: 20px;
      font-size: 12px;
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
      background: var(--vscode-editorWidget-background, #252526);
      border: 1px solid var(--vscode-widget-border, #3c3c3c);
      border-radius: 6px;
      overflow: hidden;
    }
    th, td {
      padding: 10px 14px;
      text-align: left;
      border-bottom: 1px solid var(--vscode-widget-border, #3c3c3c);
      font-size: 13px;
    }
    th {
      background: rgba(255, 255, 255, 0.04);
      color: var(--vscode-descriptionForeground);
      font-weight: 600;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
    }
    .badge-l1 { background: rgba(59, 130, 246, 0.2); color: #60a5fa; border: 1px solid rgba(59, 130, 246, 0.4); }
    .badge-l2 { background: rgba(234, 179, 8, 0.2); color: #facc15; border: 1px solid rgba(234, 179, 8, 0.4); }
    .badge-l3 { background: rgba(34, 197, 94, 0.2); color: #4ade80; border: 1px solid rgba(34, 197, 94, 0.4); }
    .badge-guard { background: rgba(239, 68, 68, 0.2); color: #f87171; border: 1px solid rgba(239, 68, 68, 0.4); padding: 2px 6px; border-radius: 4px; font-size: 11px; }
  </style>
</head>
<body>
  <div class="header">
    <div class="title-area">
      <h1>⚡ SocraticCode Learning & Research Analytics</h1>
      <p class="subtitle">Progressive scaffolding metrics, AST analysis insights, and solution-leakage guardrail logs.</p>
    </div>
    <div class="actions">
      <button class="secondary" onclick="sendMessage('refresh')">Refresh</button>
      <button class="danger" onclick="sendMessage('clear')">Clear History</button>
    </div>
  </div>

  <div class="stats-grid">
    <div class="stat-card">
      <div class="stat-label">Total Sessions</div>
      <div class="stat-value">${summary.totalSessions}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Level 1: Conceptual Hints</div>
      <div class="stat-value" style="color: #60a5fa;">${l1}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Level 2: Reasoning Hints</div>
      <div class="stat-value" style="color: #facc15;">${l2}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Level 3: Structural Hints</div>
      <div class="stat-value" style="color: #4ade80;">${l3}</div>
    </div>
    <div class="stat-card">
      <div class="stat-label">Guardrail Shield Interventions</div>
      <div class="stat-value" style="color: #f87171;">${summary.guardrailInterventions}</div>
    </div>
  </div>

  <div class="section-title">Cognitive Scaffolding Distribution</div>
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

  <div class="section-title">Active Programming Languages</div>
  <table style="margin-bottom: 28px;">
    <thead>
      <tr>
        <th>Language</th>
        <th>Recorded Practice Count</th>
      </tr>
    </thead>
    <tbody>
      ${langRows || '<tr><td colspan="2" style="color: var(--vscode-descriptionForeground); text-align: center;">No language data yet</td></tr>'}
    </tbody>
  </table>

  <div class="section-title">Recent Learning Sessions</div>
  <table>
    <thead>
      <tr>
        <th>Time</th>
        <th>Language</th>
        <th>Scaffolding Depth</th>
        <th>User Question</th>
        <th>Provider</th>
        <th>Guardrail Protection</th>
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
