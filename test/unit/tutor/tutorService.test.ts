import { describe, it, expect, beforeEach } from 'vitest';
import { TutorService } from '../../../src/tutor/tutorService';
import { DemoProvider } from '../../../src/providers/demoProvider';
import { AnalysisResult } from '../../../src/analysis/types';

describe('TutorService', () => {
  let tutorService: TutorService;
  const sampleAnalysis: AnalysisResult = {
    language: 'python',
    status: 'success',
    functions: [],
    variables: [],
    loops: [{
      type: 'while',
      conditionText: 'count < 10',
      variables: [],
      location: { startLine: 1, startColumn: 1, endLine: 2, endColumn: 10 },
    }],
    conditions: [],
    functionCalls: [],
    returnStatements: [],
    diagnostics: [],
  };

  beforeEach(() => {
    tutorService = new TutorService(new DemoProvider());
  });

  it('should start at hint level 1 when asking a question', async () => {
    const res = await tutorService.askQuestion('Why does this while loop run forever?', 'while count < 10:\n    pass', sampleAnalysis);
    expect(res.hintLevel).toBe(1);
    expect(res.levelLabel).toBe('Conceptual');
    expect(tutorService.currentHintLevel).toBe(1);
  });

  it('should advance to level 2 and 3 on requestNextHint', async () => {
    await tutorService.askQuestion('Help me debug this loop', 'while count < 10:\n    pass', sampleAnalysis);

    const hint2 = await tutorService.requestNextHint('while count < 10:\n    pass', sampleAnalysis);
    expect(hint2.hintLevel).toBe(2);
    expect(hint2.levelLabel).toBe('Logical Reasoning');

    const hint3 = await tutorService.requestNextHint('while count < 10:\n    pass', sampleAnalysis);
    expect(hint3.hintLevel).toBe(3);
    expect(hint3.levelLabel).toBe('Structural Guidance');
  });

  it('should clear session state properly', async () => {
    await tutorService.askQuestion('Test question', '', sampleAnalysis);
    expect(tutorService.currentHintLevel).toBe(1);

    tutorService.resetSession();
    expect(tutorService.currentHintLevel).toBe(0);
    expect(tutorService.sessionTurns).toHaveLength(0);
  });

  it('should format response into a structured hint card HTML', () => {
    const cardHtml = tutorService.formatResponseToCardHtml({
      hintLevel: 1,
      levelLabel: 'Conceptual',
      explanation: 'A while loop runs as long as the condition evaluates to True.',
      guidingQuestion: 'What causes the condition to become False?',
      rawText: '...',
    });

    expect(cardHtml).toContain('Level 1: Conceptual');
    expect(cardHtml).toContain('guiding-question');
    expect(cardHtml).toContain('What causes the condition to become False?');
  });
});
