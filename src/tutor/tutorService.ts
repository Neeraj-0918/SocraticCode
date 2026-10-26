import { AIProvider } from '../providers/types';
import { HintEngine } from './hintEngine';
import { ChatTurn, HintLevel, TutorRequest, TutorResponse } from './types';
import { AnalysisResult } from '../analysis/types';
import { ResponseValidator } from '../guardrails/validator';
import { SafeFallbackGenerator } from '../guardrails/safeFallback';

export class TutorService {
  private _provider: AIProvider;
  private _hintEngine: HintEngine;
  private _turns: ChatTurn[] = [];
  private _responses: TutorResponse[] = [];
  private _lastQuestion: string = '';
  private _guardrailInterventionsCount: number = 0;

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

  public get guardrailInterventionsCount(): number {
    return this._guardrailInterventionsCount;
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

    const level: HintLevel =
      this._hintEngine.currentLevel === 0
        ? this._hintEngine.requestNextLevel()
        : (this._hintEngine.currentLevel as HintLevel);

    const request: TutorRequest = {
      language: analysis.language,
      question,
      codeContext,
      analysis,
      hintLevel: level,
      sessionHistory: this._turns,
    };

    const response = await this.generateWithGuardrails(request);

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

    const response = await this.generateWithGuardrails(request);

    this._turns.push({
      role: 'tutor',
      text: `${response.explanation} ${response.guidingQuestion}`,
      timestamp: Date.now(),
      hintLevel: nextLevel,
    });
    this._responses.push(response);

    return response;
  }

  private async generateWithGuardrails(request: TutorRequest): Promise<TutorResponse> {
    try {
      const initialResponse = await this._provider.generateResponse(request);
      const validation = ResponseValidator.validate(initialResponse);

      if (validation.isValid) {
        return initialResponse;
      }

      this._guardrailInterventionsCount++;

      // Attempt 1: Controlled regeneration with explicit policy reminder
      const retryRequest: TutorRequest = {
        ...request,
        question: `${request.question || ''}\n[SYSTEM NOTE: Previous response violated Socratic policy: ${validation.violations.join('; ')}. Re-generate adhering strictly to Level ${request.hintLevel} rules without full code.]`,
      };

      try {
        const retryResponse = await this._provider.generateResponse(retryRequest);
        const retryValidation = ResponseValidator.validate(retryResponse);

        if (retryValidation.isValid) {
          return retryResponse;
        }

        // If retry also failed, deploy safe deterministic fallback
        return SafeFallbackGenerator.generate(request, retryValidation.violations);
      } catch {
        return SafeFallbackGenerator.generate(request, validation.violations);
      }
    } catch {
      // If provider threw an error entirely, fallback safely
      return SafeFallbackGenerator.generate(request, ['Provider request failed']);
    }
  }

  public async exploreAlternative(
    codeContext: string,
    analysis: AnalysisResult
  ): Promise<TutorResponse> {
    const question = 'Explore alternative or more optimal approaches for this code.';
    this._turns.push({
      role: 'student',
      text: question,
      timestamp: Date.now(),
    });

    const request: TutorRequest = {
      language: analysis.language,
      question,
      codeContext,
      analysis,
      hintLevel: 1,
      mode: 'alternative_approach',
      sessionHistory: this._turns,
    };

    const response = await this.generateWithGuardrails(request);
    this._turns.push({
      role: 'tutor',
      text: `${response.explanation} ${response.guidingQuestion}`,
      timestamp: Date.now(),
      hintLevel: 1,
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
    const isAlt = response.mode === 'alternative_approach';
    const levelClass = isAlt ? 'hint-alternative' : `hint-level-${response.hintLevel}`;
    const escapedExplanation = escapeHtml(response.explanation);
    const escapedQuestion = escapeHtml(response.guidingQuestion);

    let snippetHtml = '';
    if (response.codeSnippet) {
      snippetHtml = `<div class="hint-code-snippet">
        <pre><code>${escapeHtml(response.codeSnippet)}</code></pre>
      </div>`;
    }

    const fallbackBadge = response.isFallback
      ? `<span class="fallback-badge" title="Response calibrated to prevent solution leakage">🛡️ Shield Active</span>`
      : '';

    const conceptBadge = response.conceptCategory
      ? `<span class="concept-badge">🏷️ ${escapeHtml(response.conceptCategory)}</span>`
      : '';

    const tryThisHtml = response.nextStepOrSelfCheck
      ? `<div class="novice-try-this">
          <span class="step-icon">🎯</span>
          <div class="step-content">
            <span class="step-label">Try This Next:</span>
            <span class="step-desc">${escapeHtml(response.nextStepOrSelfCheck)}</span>
          </div>
        </div>`
      : '';

    const headerTitle = isAlt
      ? '✨ Alternative / Optimized Approach'
      : `Level ${response.hintLevel}: ${response.levelLabel}`;

    return `<div class="hint-card ${levelClass}">
      <div class="hint-card-header">
        <span class="hint-badge">${headerTitle}</span>
        <div class="header-badges">
          ${conceptBadge}
          ${fallbackBadge}
        </div>
      </div>
      <div class="hint-card-body">
        <div class="novice-observation">
          <span class="obs-icon">🔍</span>
          <p class="explanation">${escapedExplanation}</p>
        </div>
        <div class="guiding-question">
          <span class="question-icon">💡</span>
          <strong>${escapedQuestion}</strong>
        </div>
        ${tryThisHtml}
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
