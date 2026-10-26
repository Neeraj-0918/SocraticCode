import { HintLevel, TutorRequest, TutorResponse } from '../tutor/types';

export class SafeFallbackGenerator {
  public static generate(request: TutorRequest, violations: string[]): TutorResponse {
    const level = request.hintLevel;
    const lang = request.language;
    const violationSummary = violations.length > 0 ? ` [Adjusted: ${violations[0]}]` : '';

    if (request.mode === 'alternative_approach') {
      return {
        hintLevel: 1,
        levelLabel: 'Alternative Approach',
        conceptCategory: 'Algorithm Optimization',
        explanation: `Refining this algorithm involves considering alternative patterns that simplify control flow or avoid unnecessary iterations.${violationSummary}`,
        guidingQuestion: 'Could this problem be broken into a direct lookup or single-pass operation instead of nested passes?',
        nextStepOrSelfCheck: 'Compare the number of operations in your current approach against an approach using a helper dictionary or set.',
        rawText: 'Safe fallback alternative approach guidance provided.',
        isFallback: true,
        mode: 'alternative_approach',
      };
    }

    if (level === 1) {
      return {
        hintLevel: 1,
        levelLabel: 'Conceptual Hint',
        conceptCategory: 'General Problem Solving',
        explanation: `To solve this problem in ${lang}, pause and look closely at the control flow and state variables.${violationSummary}`,
        guidingQuestion: 'What condition controls whether this section of code executes or stops, and what value should change during execution?',
        nextStepOrSelfCheck: 'Locate the variable controlling execution and trace its initial value.',
        rawText: 'Safe fallback conceptual guidance provided.',
        isFallback: true,
      };
    }

    if (level === 2) {
      return {
        hintLevel: 2,
        levelLabel: 'Logical Reasoning',
        conceptCategory: 'Variable State & Scope',
        explanation: `Trace the program variables step-by-step from the start of the block to the end.${violationSummary}`,
        guidingQuestion: 'If you trace through the first iteration with a sample input, does the variable move closer to the terminating condition or stay the same?',
        nextStepOrSelfCheck: 'Write down values of the main variables before and after the first pass.',
        rawText: 'Safe fallback logical guidance provided.',
        isFallback: true,
      };
    }

    return {
      hintLevel: 3,
      levelLabel: 'Structural Guidance',
      conceptCategory: 'Loop Termination & Iteration',
      explanation: `Break down the logic into three sequential steps: 1) Initialize state before the block, 2) Execute the core action, 3) Update state toward the termination condition.${violationSummary}`,
      guidingQuestion: 'Can you write pseudocode or a comment expressing the update step that prevents an infinite loop or wrong state?',
      nextStepOrSelfCheck: 'Verify that every code branch has a clear exit or return statement.',
      codeSnippet: '# 1. Check condition\n# 2. Perform work\n# 3. Advance/decrement state',
      rawText: 'Safe fallback structural guidance provided.',
      isFallback: true,
    };
  }
}
