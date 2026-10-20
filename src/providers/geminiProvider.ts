import { GoogleGenerativeAI } from '@google/generative-ai';
import { AIProvider } from './types';
import { HintLevel, TutorRequest, TutorResponse } from '../tutor/types';
import { HintEngine } from '../tutor/hintEngine';
import { SOCRATIC_SYSTEM_PROMPT } from '../tutor/systemPrompt';
import { PromptBuilder } from '../tutor/promptBuilder';

export class GeminiProvider implements AIProvider {
  public readonly name = 'Gemini 2.0 Flash';
  private readonly _modelName = 'gemini-2.0-flash';

  constructor(private readonly _getApiKey: () => Promise<string | undefined>) {}

  public async isConfigured(): Promise<boolean> {
    const key = await this._getApiKey();
    return !!key && key.trim().length > 0;
  }

  public async generateResponse(request: TutorRequest): Promise<TutorResponse> {
    const apiKey = await this._getApiKey();
    if (!apiKey) {
      throw new Error(
        'Gemini API key is not configured. Please use "SocraticCode: Configure AI Provider" or switch to Demo Mode.'
      );
    }

    const ai = new GoogleGenerativeAI(apiKey);
    const model = ai.getGenerativeModel({
      model: this._modelName,
      systemInstruction: SOCRATIC_SYSTEM_PROMPT,
      generationConfig: {
        temperature: 0.3,
        maxOutputTokens: 600,
      },
    });

    const userPrompt = PromptBuilder.buildPrompt(request);

    try {
      // 30s timeout safety
      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('Gemini API request timed out after 30 seconds.')), 30000)
      );

      const generatePromise = model.generateContent(userPrompt);
      const result = await Promise.race([generatePromise, timeoutPromise]);
      const rawText = result.response.text();

      return GeminiProvider.parseModelOutput(rawText, request.hintLevel);
    } catch (err: any) {
      console.error('Gemini API call failed:', err);

      let userMsg = err?.message || String(err);
      if (userMsg.includes('429') || userMsg.includes('Quota')) {
        userMsg = 'Gemini free-tier rate limit reached. Please wait a moment or switch to Demo Mode.';
      } else if (userMsg.includes('API key not valid') || userMsg.includes('API_KEY_INVALID')) {
        userMsg = 'Invalid Gemini API key. Please reconfigure your key in "SocraticCode: Configure AI Provider".';
      }

      throw new Error(userMsg);
    }
  }

  public async testConnection(): Promise<boolean> {
    const apiKey = await this._getApiKey();
    if (!apiKey) return false;

    try {
      const ai = new GoogleGenerativeAI(apiKey);
      const model = ai.getGenerativeModel({ model: this._modelName });
      const res = await model.generateContent('Say "OK" in one word.');
      return res.response.text().trim().length > 0;
    } catch {
      return false;
    }
  }

  public static parseModelOutput(rawText: string, hintLevel: HintLevel): TutorResponse {
    const levelLabel = HintEngine.getLevelLabel(hintLevel);

    const explanationMatch = rawText.match(/Explanation:\s*([\s\S]*?)(?=Guiding Question:|$)/i);
    const questionMatch = rawText.match(/Guiding Question:\s*([\s\S]*?)$/i);

    let explanation = explanationMatch ? explanationMatch[1].trim() : '';
    let guidingQuestion = questionMatch ? questionMatch[1].trim() : '';

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
      rawText,
    };
  }
}
