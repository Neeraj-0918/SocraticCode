import { describe, it, expect } from 'vitest';
import { ResponseValidator } from '../../../src/guardrails/validator';
import { TutorResponse } from '../../../src/tutor/types';

describe('ResponseValidator Guardrails', () => {
  it('should pass valid Level 1 response without code', () => {
    const response: TutorResponse = {
      hintLevel: 1,
      levelLabel: 'Conceptual',
      explanation: 'Consider how while loops determine when to exit.',
      guidingQuestion: 'Under what condition does the loop stop?',
      rawText: '...',
    };

    const result = ResponseValidator.validate(response);
    expect(result.isValid).toBe(true);
    expect(result.violations).toHaveLength(0);
  });

  it('should reject Level 1 response containing code blocks', () => {
    const leakedL1: TutorResponse = {
      hintLevel: 1,
      levelLabel: 'Conceptual',
      explanation: 'Here is what you need: ```python\nn -= 1\n```',
      guidingQuestion: 'Do you see it?',
      rawText: '...',
    };

    const result = ResponseValidator.validate(leakedL1);
    expect(result.isValid).toBe(false);
    expect(result.violations.some(v => v.includes('Level 1 policy'))).toBe(true);
  });

  it('should reject responses containing complete replacement programs', () => {
    const fullSolution: TutorResponse = {
      hintLevel: 3,
      levelLabel: 'Structural Guidance',
      explanation: 'Here is your fixed code:',
      guidingQuestion: 'Does this make sense?',
      codeSnippet: `def countdown(n):\n    while n > 0:\n        print(n)\n        n -= 1\n    return n`,
      rawText: 'Here is your fixed code:\ndef countdown(n):\n    while n > 0:\n        print(n)\n        n -= 1\n    return n',
    };

    const result = ResponseValidator.validate(fullSolution);
    expect(result.isValid).toBe(false);
    expect(result.violations.some(v => v.includes('Complete solution'))).toBe(true);
  });

  it('should reject responses with direct giveaway phrases', () => {
    const giveaway: TutorResponse = {
      hintLevel: 2,
      levelLabel: 'Logical Reasoning',
      explanation: 'The full solution is to change line 2 to while n >= 0.',
      guidingQuestion: 'Try that.',
      rawText: 'The full solution is to change line 2 to while n >= 0.',
    };

    const result = ResponseValidator.validate(giveaway);
    expect(result.isValid).toBe(false);
    expect(result.violations.some(v => v.includes('Direct giveaway phrase'))).toBe(true);
  });

  it('should allow legitimate small pseudocode or fragments in Level 3', () => {
    const validL3: TutorResponse = {
      hintLevel: 3,
      levelLabel: 'Structural Guidance',
      explanation: 'Inside the loop body, decrement the counter on each iteration.',
      guidingQuestion: 'Where will you place the decrement?',
      codeSnippet: `# pattern:\ncounter = counter - 1`,
      rawText: '...',
    };

    const result = ResponseValidator.validate(validL3);
    expect(result.isValid).toBe(true);
  });

  it('should reject responses missing a guiding question', () => {
    const missingQuestion: TutorResponse = {
      hintLevel: 2,
      levelLabel: 'Logical Reasoning',
      explanation: 'Your loop runs forever because n never changes.',
      guidingQuestion: '',
      rawText: '...',
    };

    const result = ResponseValidator.validate(missingQuestion);
    expect(result.isValid).toBe(false);
    expect(result.violations.some(v => v.includes('guiding question'))).toBe(true);
  });
});
