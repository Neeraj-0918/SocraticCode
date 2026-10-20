import { TutorResponse } from '../tutor/types';
import { ValidationResult } from './types';

export class ResponseValidator {
  private static readonly DIRECT_GIVEAWAY_PATTERNS = [
    /here is (?:the|your) (?:fixed|corrected|complete|full) (?:code|solution)/i,
    /the (?:full|complete|corrected) solution is/i,
    /replace (?:your code|everything) with/i,
    /copy and paste this/i,
  ];

  public static validate(response: TutorResponse): ValidationResult {
    const violations: string[] = [];
    const textToCheck = `${response.explanation} ${response.guidingQuestion} ${response.codeSnippet || ''} ${response.rawText || ''}`;

    // 1. Check for missing guiding question
    if (!response.guidingQuestion || response.guidingQuestion.trim() === '') {
      violations.push('Response is missing an engaging guiding question.');
    }

    // 2. Level 1 Policy: No code blocks allowed
    if (response.hintLevel === 1) {
      if (response.codeSnippet || textToCheck.includes('```')) {
        violations.push('Level 1 policy violation: Contains code block when only conceptual guidance is allowed.');
      }
    }

    // 3. Level 2 Policy: Code block line limits
    if (response.hintLevel === 2 && response.codeSnippet) {
      const lineCount = response.codeSnippet.split('\n').length;
      if (lineCount > 10) {
        violations.push(`Level 2 policy violation: Code block (${lineCount} lines) exceeds maximum allowed reasoning fragment limit (10 lines).`);
      }
    }

    // 4. Level 3 Policy: Code block line limits
    if (response.hintLevel === 3 && response.codeSnippet) {
      const lineCount = response.codeSnippet.split('\n').length;
      if (lineCount > 25) {
        violations.push(`Level 3 policy violation: Pseudocode block (${lineCount} lines) exceeds allowed structural limit (25 lines).`);
      }
    }

    // 5. Complete Program Detector (e.g. def func(...): ... loop ... return ...)
    const fullFunctionPattern = /def\s+\w+\s*\(.*?\)\s*:[\s\S]*?(?:while|for|if)[\s\S]*?(?:return|print\s*\()/;
    if (response.codeSnippet && fullFunctionPattern.test(response.codeSnippet)) {
      violations.push('Complete solution leak detected: Response contains a full executable function replacement.');
    }

    // 6. Direct Giveaway Phrases
    for (const pattern of ResponseValidator.DIRECT_GIVEAWAY_PATTERNS) {
      if (pattern.test(textToCheck)) {
        violations.push(`Direct giveaway phrase detected: Matches '${pattern.source}'.`);
        break;
      }
    }

    return {
      isValid: violations.length === 0,
      violations,
    };
  }
}
