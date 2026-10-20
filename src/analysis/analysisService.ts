import { AnalysisResult, LanguageAdapter } from './types';
import { PythonAdapter } from './pythonAdapter';
import { detectLanguage, isSupportedLanguage } from '../utils/languageDetector';

export class AnalysisService {
  private _adapters: Map<string, LanguageAdapter> = new Map();
  private _isInitialized = false;

  public async initialize(wasmDir: string): Promise<void> {
    if (this._isInitialized) return;

    // Register Python adapter
    const pythonAdapter = new PythonAdapter();
    await pythonAdapter.initialize(wasmDir);
    this._adapters.set('python', pythonAdapter);

    this._isInitialized = true;
  }

  public registerAdapter(adapter: LanguageAdapter): void {
    this._adapters.set(adapter.language.toLowerCase(), adapter);
  }

  public async analyzeDocument(
    filePath: string,
    languageId: string,
    content: string
  ): Promise<AnalysisResult> {
    const detectedLang = detectLanguage(filePath, languageId);

    if (!isSupportedLanguage(detectedLang)) {
      return {
        language: detectedLang,
        status: 'error',
        functions: [],
        variables: [],
        loops: [],
        conditions: [],
        functionCalls: [],
        returnStatements: [],
        diagnostics: [
          {
            severity: 'error',
            message: `Unsupported language '${languageId || detectedLang}'. Currently SocraticCode supports Python (and C).`,
            location: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
          },
        ],
        summaryText: `Language '${detectedLang}' is not supported yet.`,
      };
    }

    const adapter = this._adapters.get(detectedLang);
    if (!adapter) {
      return {
        language: detectedLang,
        status: 'error',
        functions: [],
        variables: [],
        loops: [],
        conditions: [],
        functionCalls: [],
        returnStatements: [],
        diagnostics: [
          {
            severity: 'error',
            message: `No active parser adapter loaded for language '${detectedLang}'.`,
            location: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 1 },
          },
        ],
        summaryText: `Parser adapter for ${detectedLang} not initialized.`,
      };
    }

    return adapter.parse(content);
  }

  public formatFindingsToHtml(result: AnalysisResult): string {
    if (result.status === 'error' && result.diagnostics.length > 0) {
      return `<div class="analysis-item error-item">
        <strong>⚠️ Analysis Error:</strong>
        <p>${result.diagnostics.map(d => d.message).join('<br>')}</p>
      </div>`;
    }

    const items: string[] = [];

    // Diagnostics / Syntax issues
    if (result.diagnostics.length > 0) {
      items.push(`<div class="finding-group syntax-warning">
        <span class="finding-label">⚠️ Syntax Observations:</span>
        <ul>
          ${result.diagnostics.map(d => `<li>Line ${d.location.startLine}: ${escapeHtml(d.message)}</li>`).join('')}
        </ul>
      </div>`);
    }

    // Functions
    if (result.functions.length > 0) {
      items.push(`<div class="finding-group">
        <span class="finding-label">Functions (${result.functions.length}):</span>
        <ul>
          ${result.functions.map(f => `<li><code>${escapeHtml(f.name)}(${f.parameters.join(', ')})</code> (Line ${f.location.startLine}) — ${f.hasReturn ? 'Returns value' : 'No explicit return'}</li>`).join('')}
        </ul>
      </div>`);
    }

    // Loops
    if (result.loops.length > 0) {
      items.push(`<div class="finding-group">
        <span class="finding-label">Loops (${result.loops.length}):</span>
        <ul>
          ${result.loops.map(l => `<li><code>${l.type}</code> loop at Line ${l.location.startLine}${l.conditionText ? ` (condition: <code>${escapeHtml(l.conditionText)}</code>)` : ''}</li>`).join('')}
        </ul>
      </div>`);
    }

    // Conditionals
    if (result.conditions.length > 0) {
      items.push(`<div class="finding-group">
        <span class="finding-label">Conditionals (${result.conditions.length}):</span>
        <ul>
          ${result.conditions.map(c => `<li><code>${c.type}</code> at Line ${c.location.startLine}${c.conditionText ? ` (<code>${escapeHtml(c.conditionText)}</code>)` : ''}</li>`).join('')}
        </ul>
      </div>`);
    }

    // Function calls
    if (result.functionCalls.length > 0) {
      const uniqueCalls = Array.from(new Set(result.functionCalls.map(c => c.functionName)));
      items.push(`<div class="finding-group">
        <span class="finding-label">Function Calls:</span>
        <p>${uniqueCalls.map(c => `<code>${escapeHtml(c)}()</code>`).join(', ')}</p>
      </div>`);
    }

    if (items.length === 0) {
      return `<p class="placeholder-text">Clean file parsed. No functions, loops, or conditionals detected.</p>`;
    }

    return items.join('');
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
