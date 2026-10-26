import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIProvider } from './types';
import { HintLevel, TutorRequest, TutorResponse } from '../tutor/types';
import { HintEngine } from '../tutor/hintEngine';
import { SOCRATIC_SYSTEM_PROMPT } from '../tutor/systemPrompt';
import { PromptBuilder } from '../tutor/promptBuilder';

export class GeminiProvider implements AIProvider {
  public name = 'Gemini AI';
  private _modelName = 'gemini-2.0-flash';

  constructor(private readonly _getApiKey: () => Promise<string | undefined>) {}

  public async isConfigured(): Promise<boolean> {
    const key = await this._getApiKey();
    return !!key && key.trim().length > 0;
  }

  private readonly _fallbackModels = [
    'gemini-1.5-flash',
    'gemini-2.0-flash',
    'gemini-2.5-flash',
    'gemini-1.5-pro',
  ];

  public async generateResponse(request: TutorRequest): Promise<TutorResponse> {
    const apiKey = await this._getApiKey();
    if (!apiKey) {
      throw new Error(
        'Gemini API key is not configured. Please use "SocraticCode: Configure AI Provider" or switch to Demo Mode.'
      );
    }

    const ai = new GoogleGenerativeAI(apiKey);
    const userPrompt = PromptBuilder.buildPrompt(request);

    // Try current preferred model first, then fall back to stable alternatives
    const modelsToTry = [
      this._modelName,
      ...this._fallbackModels.filter((m) => m !== this._modelName),
    ];

    let lastError: any = null;

    for (const candidateModel of modelsToTry) {
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const model = ai.getGenerativeModel({
            model: candidateModel,
            systemInstruction: SOCRATIC_SYSTEM_PROMPT,
            generationConfig: {
              temperature: 0.3,
              maxOutputTokens: 600,
            },
          });

          // 30s timeout safety
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error('Gemini API request timed out after 30 seconds.')), 30000)
          );

          const generatePromise = model.generateContent(userPrompt);
          const result = await Promise.race([generatePromise, timeoutPromise]);
          const rawText = result.response.text();

          // Seamlessly update active model if fallback succeeded
          if (this._modelName !== candidateModel) {
            console.log(`[GeminiProvider] Switched active model to ${candidateModel} after overload.`);
            this._modelName = candidateModel;
            this.name = `Gemini (${candidateModel})`;
          }

          return GeminiProvider.parseModelOutput(rawText, request.hintLevel);
        } catch (err: any) {
          lastError = err;
          const msg = err?.message || String(err);
          const is503 = msg.includes('503') || msg.includes('overloaded') || msg.includes('Service Unavailable');

          if (is503 && attempt === 0) {
            // Wait 1.2s before retrying once on the same model
            console.warn(`[GeminiProvider] 503 Overload on ${candidateModel}, retrying in 1200ms...`);
            await new Promise((r) => setTimeout(r, 1200));
            continue;
          }

          if (msg.includes('API key not valid') || msg.includes('API_KEY_INVALID')) {
            throw new Error('Invalid Gemini API key. Please reconfigure your key in "SocraticCode: Configure AI Provider".');
          }

          // If this model is overloaded or failed, break inner loop to try next fallback model
          break;
        }
      }
    }

    console.error('All Gemini candidate models failed:', lastError);
    let userMsg = lastError?.message || String(lastError);
    if (userMsg.includes('503') || userMsg.includes('overloaded') || userMsg.includes('Service Unavailable')) {
      userMsg = 'Google Gemini servers are currently overloaded (503 Service Unavailable). SocraticCode tried fallback models and will use Demo Mode in the meantime.';
    } else if (userMsg.includes('429') || userMsg.includes('Quota')) {
      userMsg = 'Gemini free-tier rate limit reached. Please wait a moment or switch to Demo Mode.';
    }

    throw new Error(userMsg);
  }

  public async verifyConnection(): Promise<{ success: boolean; error?: string; modelUsed?: string }> {
    const apiKey = await this._getApiKey();
    if (!apiKey) return { success: false, error: 'API key is missing.' };

    const candidateModels = [
      'gemini-2.5-flash',
      'gemini-2.0-flash',
      'gemini-1.5-flash',
      'gemini-1.5-pro',
    ];
    let lastError = '';

    const ai = new GoogleGenerativeAI(apiKey);

    for (const modelName of candidateModels) {
      try {
        const model = ai.getGenerativeModel({ model: modelName });
        const res = await model.generateContent('Say "OK" in one word.');
        if (res.response.text().trim().length > 0) {
          this._modelName = modelName;
          this.name = `Gemini (${modelName})`;
          return { success: true, modelUsed: modelName };
        }
      } catch (err: any) {
        lastError = err?.message || String(err);
        console.warn(`Model ${modelName} check failed:`, lastError);
      }
    }

    return { success: false, error: lastError };
  }

  public async testConnection(): Promise<boolean> {
    const res = await this.verifyConnection();
    return res.success;
  }

  public static parseModelOutput(rawText: string, hintLevel: HintLevel): TutorResponse {
    const levelLabel = HintEngine.getLevelLabel(hintLevel);

    const explanationMatch = rawText.match(/(?:Explanation|Observation):\s*([\s\S]*?)(?=Guiding Question:|$)/i);
    const questionMatch = rawText.match(/Guiding Question:\s*([\s\S]*?)(?=Try This:|$)/i);
    const tryThisMatch = rawText.match(/Try This:\s*([\s\S]*?)$/i);

    let explanation = explanationMatch ? explanationMatch[1].trim() : '';
    let guidingQuestion = questionMatch ? questionMatch[1].trim() : '';
    const nextStepOrSelfCheck = tryThisMatch ? tryThisMatch[1].trim() : undefined;

    // If model didn't follow the exact format, cleanly extract thoughts
    if (!explanation && !guidingQuestion) {
      const sentences = rawText.split(/(?<=[.?!])\s+/);
      const questionIndex = sentences.findIndex((s) => s.includes('?'));

      if (questionIndex !== -1) {
        explanation = sentences.slice(0, questionIndex).join(' ');
        guidingQuestion = sentences.slice(questionIndex).join(' ');
      } else {
        explanation = rawText.trim();
        guidingQuestion = 'What do you observe when you trace this code?';
      }
    } else if (!guidingQuestion) {
      guidingQuestion = 'What part of this logic can you test next?';
    }

    return {
      hintLevel,
      levelLabel,
      explanation: explanation || 'Consider the logic and structure of your program.',
      guidingQuestion,
      nextStepOrSelfCheck,
      rawText,
    };
  }
}
