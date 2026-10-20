import { AIProvider } from '../providers/types';
import { HintEngine } from './hintEngine';
import { ChatTurn, HintLevel, TutorRequest, TutorResponse } from './types';
import { AnalysisResult } from '../analysis/types';

export class TutorService {
  private _provider: AIProvider;
  private _hintEngine: HintEngine;
  private _turns: ChatTurn[] = [];
  private _responses: TutorResponse[] = [];
  private _lastQuestion: string = '';

  constructor(provider: AIProvider) {
    this._provider = provider;
    this._hintEngine = new HintEngine();
  }

  public setProvider(provider: AIProvider): void {
    this._provider = provider;
  }

  public get providerName(): string {
    return this._provider.name;
  }

  public get currentHintLevel(): number {
    return this._hintEngine.currentLevel;
  }

  public get hasMoreHints(): boolean {
    return this._hintEngine.hasMoreHints;
  }

  public get sessionTurns(): ReadonlyArray<ChatTurn> {
    return this._turns;
  }

  public async askQuestion(
    question: string,
    codeContext: string,
    analysis: AnalysisResult
  ): Promise<TutorResponse> {
    this._lastQuestion = question;
    this._turns.push({
      role: 'student',
      text: question,
      timestamp: Date.now(),
    });

    // Advance to Level 1 if no hint yet
    const level: HintLevel = this._hintEngine.currentLevel === 0 ? this._hintEngine.requestNextLevel() : (this._hintEngine.currentLevel as HintLevel);

    const request: TutorRequest = {
      language: analysis.language,
      question,
      codeContext,
      analysis,
      hintLevel: level,
      sessionHistory: this._turns,
    };

    const response = await this._provider.generateResponse(request);

    this._turns.push({
      role: 'tutor',
      text: `${response.explanation} ${response.guidingQuestion}`,
      timestamp: Date.now(),
      hintLevel: level,
    });
    this._responses.push(response);

    return response;
  }

  public async requestNextHint(
    codeContext: string,
    analysis: AnalysisResult
  ): Promise<TutorResponse> {
    const nextLevel = this._hintEngine.requestNextLevel();

    const request: TutorRequest = {
      language: analysis.language,
      question: this._lastQuestion || 'Can you give me the next hint for this code?',
      codeContext,
      analysis,
      hintLevel: nextLevel,
      sessionHistory: this._turns,
    };

    const response = await this._provider.generateResponse(request);

    this._turns.push({
      role: 'tutor',
      text: `${response.explanation} ${response.guidingQuestion}`,
      timestamp: Date.now(),
      hintLevel: nextLevel,
    });
    this._responses.push(response);

    return response;
  }

  public resetSession(): void {
    this._hintEngine.reset();
    this._turns = [];
    this._responses = [];
    this._lastQuestion = '';
  }

  public formatResponseToCardHtml(response: TutorResponse): string {
    const levelClass = `hint-level-${response.hintLevel}`;
    const escapedExplanation = escapeHtml(response.explanation);
    const escapedQuestion = escapeHtml(response.guidingQuestion);

    let snippetHtml = '';
    if (response.codeSnippet) {
      snippetHtml = `<div class="hint-code-snippet">
        <pre><code>${escapeHtml(response.codeSnippet)}</code></pre>
      </div>`;
    }

    return `<div class="hint-card ${levelClass}">
      <div class="hint-card-header">
        <span class="hint-badge">Level ${response.hintLevel}: ${response.levelLabel}</span>
      </div>
      <div class="hint-card-body">
        <p class="explanation">${escapedExplanation}</p>
        <div class="guiding-question">
          <span class="question-icon">💡</span>
          <strong>${escapedQuestion}</strong>
        </div>
        ${snippetHtml}
      </div>
    </div>`;
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
