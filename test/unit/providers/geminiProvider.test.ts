import { describe, it, expect, vi } from 'vitest';
import { GeminiProvider } from '../../../src/providers/geminiProvider';
import { AnalysisResult } from '../../../src/analysis/types';
import { TutorRequest } from '../../../src/tutor/types';

describe('GeminiProvider', () => {
  const sampleAnalysis: AnalysisResult = {
    language: 'python',
    status: 'success',
    functions: [],
    variables: [],
    loops: [],
    conditions: [],
    functionCalls: [],
    returnStatements: [],
    diagnostics: [],
  };

  it('should report not configured when apiKey is empty', async () => {
    const provider = new GeminiProvider(() => Promise.resolve(undefined));
    expect(await provider.isConfigured()).toBe(false);
  });

  it('should report configured when apiKey is present', async () => {
    const provider = new GeminiProvider(() => Promise.resolve('test-key'));
    expect(await provider.isConfigured()).toBe(true);
    expect(provider.name).toBe('Gemini 2.0 Flash');
  });

  it('should parse two-part structured response accurately', () => {
    const raw = `Explanation: In Python, loop conditions must be updated to terminate.\nGuiding Question: How can you update n inside the loop?`;
    const parsed = GeminiProvider.parseModelOutput(raw, 1);

    expect(parsed.explanation).toContain('loop conditions must be updated');
    expect(parsed.guidingQuestion).toContain('How can you update n');
    expect(parsed.hintLevel).toBe(1);
    expect(parsed.levelLabel).toBe('Conceptual');
  });

  it('should handle unstructured response gracefully without crashing', () => {
    const raw = `Think about your while loop condition. What causes it to stop?`;
    const parsed = GeminiProvider.parseModelOutput(raw, 2);

    expect(parsed.hintLevel).toBe(2);
    expect(parsed.levelLabel).toBe('Logical Reasoning');
    expect(parsed.guidingQuestion.length).toBeGreaterThan(5);
  });
});
