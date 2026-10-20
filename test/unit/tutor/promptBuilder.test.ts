import { describe, it, expect } from 'vitest';
import { PromptBuilder } from '../../../src/tutor/promptBuilder';
import { TutorRequest } from '../../../src/tutor/types';
import { AnalysisResult } from '../../../src/analysis/types';

describe('PromptBuilder', () => {
  const sampleAnalysis: AnalysisResult = {
    language: 'python',
    status: 'success',
    functions: [{
      name: 'factorial',
      parameters: ['n'],
      location: { startLine: 1, startColumn: 1, endLine: 4, endColumn: 10 },
      hasReturn: true,
    }],
    variables: [],
    loops: [],
    conditions: [{
      type: 'if',
      conditionText: 'n == 0',
      location: { startLine: 2, startColumn: 5, endLine: 3, endColumn: 16 },
    }],
    functionCalls: [],
    returnStatements: [],
    diagnostics: [],
    summaryText: 'Functions (1): factorial(n) [L1]',
  };

  it('should build prompt containing language, AST findings, and hint level', () => {
    const request: TutorRequest = {
      language: 'python',
      question: 'How do I handle the base case?',
      codeContext: 'def factorial(n):\n    if n == 0:\n        return 1\n    return n * factorial(n-1)',
      analysis: sampleAnalysis,
      hintLevel: 1,
    };

    const prompt = PromptBuilder.buildPrompt(request);

    expect(prompt).toContain('Language: python');
    expect(prompt).toContain('Student Question: How do I handle the base case?');
    expect(prompt).toContain('Verified Code Analysis Findings:');
    expect(prompt).toContain('factorial(n)');
    expect(prompt).toContain('Current Hint Level: Level 1 (Conceptual)');
  });

  it('should include strict hint level instructions for Level 1, Level 2, Level 3', () => {
    const req1: TutorRequest = { language: 'python', analysis: sampleAnalysis, hintLevel: 1 };
    expect(PromptBuilder.getHintLevelInstruction(1)).toContain('DO NOT include code blocks');

    const req2: TutorRequest = { language: 'python', analysis: sampleAnalysis, hintLevel: 2 };
    expect(PromptBuilder.getHintLevelInstruction(2)).toContain('Logical reasoning');

    const req3: TutorRequest = { language: 'python', analysis: sampleAnalysis, hintLevel: 3 };
    expect(PromptBuilder.getHintLevelInstruction(3)).toContain('Structural guidance');
  });
});
