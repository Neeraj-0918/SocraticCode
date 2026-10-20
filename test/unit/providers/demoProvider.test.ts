import { describe, it, expect, beforeEach } from 'vitest';
import { DemoProvider } from '../../../src/providers/demoProvider';
import { AnalysisResult } from '../../../src/analysis/types';
import { TutorRequest } from '../../../src/tutor/types';

describe('DemoProvider', () => {
  let provider: DemoProvider;

  beforeEach(() => {
    provider = new DemoProvider();
  });

  it('should always be configured', async () => {
    expect(await provider.isConfigured()).toBe(true);
    expect(provider.name).toBe('Demo Provider');
  });

  it('should generate Socratic loop hints for countdown infinite loop at L1, L2, L3', async () => {
    const analysis: AnalysisResult = {
      language: 'python',
      status: 'success',
      functions: [{
        name: 'countdown',
        parameters: ['n'],
        location: { startLine: 1, startColumn: 1, endLine: 3, endColumn: 10 },
        hasReturn: false,
      }],
      variables: [],
      loops: [{
        type: 'while',
        conditionText: 'n > 0',
        variables: [],
        location: { startLine: 2, startColumn: 5, endLine: 3, endColumn: 16 },
      }],
      conditions: [],
      functionCalls: [{
        functionName: 'print',
        arguments: ['n'],
        location: { startLine: 3, startColumn: 9, endLine: 3, endColumn: 16 },
      }],
      returnStatements: [],
      diagnostics: [],
    };

    // Level 1: Conceptual
    const reqL1: TutorRequest = {
      language: 'python',
      question: 'Why does my loop not stop?',
      analysis,
      hintLevel: 1,
    };
    const resL1 = await provider.generateResponse(reqL1);
    expect(resL1.hintLevel).toBe(1);
    expect(resL1.levelLabel).toBe('Conceptual');
    expect(resL1.codeSnippet).toBeUndefined(); // L1 must not contain code!
    expect(resL1.guidingQuestion.toLowerCase()).toContain('condition');

    // Level 2: Logical Reasoning
    const reqL2: TutorRequest = {
      language: 'python',
      analysis,
      hintLevel: 2,
    };
    const resL2 = await provider.generateResponse(reqL2);
    expect(resL2.hintLevel).toBe(2);
    expect(resL2.levelLabel).toBe('Logical Reasoning');
    expect(resL2.explanation.toLowerCase()).toContain('iteration');

    // Level 3: Structural Guidance
    const reqL3: TutorRequest = {
      language: 'python',
      analysis,
      hintLevel: 3,
    };
    const resL3 = await provider.generateResponse(reqL3);
    expect(resL3.hintLevel).toBe(3);
    expect(resL3.levelLabel).toBe('Structural Guidance');
    expect(resL3.codeSnippet).toBeDefined();
  });

  it('should handle syntax error analysis truthfully', async () => {
    const analysis: AnalysisResult = {
      language: 'python',
      status: 'partial',
      functions: [],
      variables: [],
      loops: [],
      conditions: [],
      functionCalls: [],
      returnStatements: [],
      diagnostics: [{
        severity: 'error',
        message: "Syntax error at or near 'def broken('",
        location: { startLine: 1, startColumn: 1, endLine: 1, endColumn: 12 },
      }],
    };

    const req: TutorRequest = {
      language: 'python',
      question: 'What is wrong with my syntax?',
      analysis,
      hintLevel: 1,
    };
    const res = await provider.generateResponse(req);
    expect(res.explanation).toContain('Line 1');
    expect(res.guidingQuestion.length).toBeGreaterThan(10);
  });
});
