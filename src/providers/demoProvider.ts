import { AIProvider } from './types';
import { HintLevel, TutorRequest, TutorResponse } from '../tutor/types';
import { HintEngine } from '../tutor/hintEngine';

export class DemoProvider implements AIProvider {
  public readonly name = 'Demo Provider';

  public async isConfigured(): Promise<boolean> {
    return true;
  }

  public async generateResponse(request: TutorRequest): Promise<TutorResponse> {
    const { analysis, hintLevel, question, mode } = request;
    const levelLabel = HintEngine.getLevelLabel(hintLevel);

    // 0. Handle Alternative / Optimized Approach Mode
    if (mode === 'alternative_approach') {
      return this._handleAlternativeApproach(request);
    }

    // 1. Check for Syntax Errors
    if (analysis.diagnostics.length > 0) {
      return this._handleSyntaxError(analysis.diagnostics[0], hintLevel, levelLabel);
    }

    // 2. Check for Infinite / Unmodified While Loops
    const whileLoop = analysis.loops.find((l) => l.type === 'while');
    if (whileLoop) {
      return this._handleWhileLoop(whileLoop, hintLevel, levelLabel);
    }

    // 3. Check for Function Missing Return
    const funcWithoutReturn = analysis.functions.find((f) => !f.hasReturn);
    if (funcWithoutReturn && (question?.toLowerCase().includes('return') || question?.toLowerCase().includes('output') || question?.toLowerCase().includes('none'))) {
      return this._handleMissingReturn(funcWithoutReturn, hintLevel, levelLabel);
    }

    // 4. Default / General Code Guidance
    return this._handleGeneralGuidance(request, levelLabel);
  }

  private _handleAlternativeApproach(request: TutorRequest): TutorResponse {
    const { analysis, codeContext } = request;
    const hasLoops = (analysis.loops && analysis.loops.length > 0) || false;
    const hasConditionals = (analysis.conditions && analysis.conditions.length > 0) || false;

    let observation = 'Examining the structure of your code reveals potential opportunities to simplify logic and enhance performance.';
    let question = 'Could this task be solved with fewer nested checks or by utilizing a built-in data structure like a set or dictionary?';
    let tryThis = 'Consider whether calculating the result iteratively or using a standard library utility reduces time complexity from O(n²) to O(n).';

    if (hasLoops && hasConditionals) {
      observation = 'Your selection features nested loops and conditional filters. In computer science, nested iteration often multiplies execution time.';
      question = 'What if you grouped or filtered the elements beforehand, rather than repeatedly testing the condition inside every loop cycle?';
      tryThis = 'Map out the input-to-output flow: could an early exit (guard clause) or lookup map eliminate unnecessary passes?';
    } else if (hasLoops) {
      observation = 'Your implementation uses explicit index iteration. In high-level languages, direct iteration or list transformations are often cleaner and less error-prone.';
      question = 'Would iterating directly over the items instead of tracking indices eliminate off-by-one risks and make your code more readable?';
      tryThis = 'Try writing down the core transformation in one sentence, then check if a standard method already does that step.';
    }

    return {
      hintLevel: 1,
      levelLabel: 'Alternative Approach',
      conceptCategory: 'Algorithm Optimization',
      explanation: observation,
      guidingQuestion: question,
      nextStepOrSelfCheck: tryThis,
      rawText: `${observation} Question: ${question} Try: ${tryThis}`,
      mode: 'alternative_approach',
    };
  }

  private _handleSyntaxError(
    diagnostic: any,
    hintLevel: HintLevel,
    levelLabel: string
  ): TutorResponse {
    const line = diagnostic.location.startLine;

    switch (hintLevel) {
      case 1:
        return {
          hintLevel: 1,
          levelLabel,
          conceptCategory: 'Syntax Rules & Grammar',
          explanation: `A syntax error was detected around Line ${line}. Think of syntax like punctuation in English: if you miss a comma or quote, the reader gets confused.`,
          guidingQuestion: 'What punctuation symbol does Python require at the end of block headers (like def, if, while)?',
          nextStepOrSelfCheck: `Look at the very end of Line ${line} and check if a colon ':' is missing.`,
          rawText: `Line ${line}: Syntax issue observed. Check Python punctuation.`,
        };
      case 2:
        return {
          hintLevel: 2,
          levelLabel,
          conceptCategory: 'Syntax Rules & Grammar',
          explanation: `Inspect Line ${line} closely. Statement headers (function definitions, loops, if statements) need balanced parentheses and must end with a colon ':'.`,
          guidingQuestion: 'Does your statement on Line ${line} have both an opening and closing parenthesis, plus a terminating colon?',
          nextStepOrSelfCheck: 'Count your opening "(" and closing ")" on that line to make sure they match.',
          rawText: `Check Line ${line}: look for missing ':' or unmatched '()'.`,
        };
      case 3:
        return {
          hintLevel: 3,
          levelLabel,
          conceptCategory: 'Syntax Rules & Grammar',
          explanation: `To fix a syntax error at a header, make sure the structure follows: keyword name(parameters): followed by an indented block.`,
          guidingQuestion: 'Have you closed the parameter list and added the colon at the end of Line ${line}?',
          nextStepOrSelfCheck: 'Ensure the line following this header is indented with 4 spaces or a tab.',
          codeSnippet: `# Correct header pattern:\ndef function_name(param1, param2):\n    # indented body`,
          rawText: `Pattern: def name(params):`,
        };
    }
  }

  private _handleWhileLoop(
    loop: any,
    hintLevel: HintLevel,
    levelLabel: string
  ): TutorResponse {
    const cond = loop.conditionText || 'condition';
    const line = loop.location.startLine;

    switch (hintLevel) {
      case 1:
        return {
          hintLevel: 1,
          levelLabel,
          conceptCategory: 'Loop Termination & Iteration',
          explanation: `Your code has a while loop at Line ${line} with condition (${cond}). Think of a while loop like a security gate: it stays open as long as the pass is valid.`,
          guidingQuestion: `Under what circumstances will the condition (${cond}) become False so the loop can safely finish?`,
          nextStepOrSelfCheck: 'Check if any variable mentioned in the condition gets updated inside the loop body.',
          rawText: `Examine the loop termination condition (${cond}).`,
        };
      case 2:
        return {
          hintLevel: 2,
          levelLabel,
          conceptCategory: 'Loop Termination & Iteration',
          explanation: `Trace the variables inside (${cond}) across each iteration. If the loop counter never changes, the condition stays True forever (an infinite loop).`,
          guidingQuestion: `How does the state of the loop variable change during each pass? Is it moving closer to the exit condition?`,
          nextStepOrSelfCheck: 'Add a temporary print statement inside the loop to observe the variable value on each pass.',
          rawText: `Trace loop state on each iteration. Are variables updated?`,
        };
      case 3:
        return {
          hintLevel: 3,
          levelLabel,
          conceptCategory: 'Loop Termination & Iteration',
          explanation: `To prevent infinite execution, update the controlling variable on every iteration toward the stopping boundary.`,
          guidingQuestion: `Where in your loop body should you increment or decrement the counter variable?`,
          nextStepOrSelfCheck: 'Verify that every execution path inside the loop leads to a counter step.',
          codeSnippet: `# Typical loop progression pattern:\nwhile counter > 0:\n    # perform task\n    counter = counter - 1  # progress toward condition exit`,
          rawText: `Ensure counter is updated inside the loop: counter = counter - 1`,
        };
    }
  }

  private _handleMissingReturn(
    func: any,
    hintLevel: HintLevel,
    levelLabel: string
  ): TutorResponse {
    const fnName = func.name;

    switch (hintLevel) {
      case 1:
        return {
          hintLevel: 1,
          levelLabel,
          conceptCategory: 'Function Return vs Output',
          explanation: `The function '${fnName}' runs statements but does not explicitly return a value. Think of 'return' like handing a homework paper to your teacher, while 'print' just shouts the answer into the room.`,
          guidingQuestion: `Does the caller of '${fnName}' expect to receive a computed value back to store in a variable?`,
          nextStepOrSelfCheck: 'Check if you are trying to assign the result of this function to a variable in another line.',
          rawText: `Functions without 'return' return None in Python.`,
        };
      case 2:
        return {
          hintLevel: 2,
          levelLabel,
          conceptCategory: 'Function Return vs Output',
          explanation: `Printing displays text on screen, but gives nothing back to your code. Python automatically returns 'None' when there is no return statement.`,
          guidingQuestion: `Do you want the function to print its result, or return the calculated value so another variable can use it?`,
          nextStepOrSelfCheck: 'Replace print(...) with return ... if you need the caller to receive the data.',
          rawText: `Distinguish between printing and returning.`,
        };
      case 3:
        return {
          hintLevel: 3,
          levelLabel,
          conceptCategory: 'Function Return vs Output',
          explanation: `Use the 'return' keyword at the end of the function body to pass the computed result back to the caller.`,
          guidingQuestion: `What specific variable or expression should follow the 'return' keyword in '${fnName}'?`,
          nextStepOrSelfCheck: 'Confirm your return statement is inside the function body and reachable before the function exits.',
          codeSnippet: `def ${fnName}(...):\n    result = ...\n    return result`,
          rawText: `Use 'return result' at end of function.`,
        };
    }
  }

  private _handleGeneralGuidance(
    request: TutorRequest,
    levelLabel: string
  ): TutorResponse {
    const { hintLevel, analysis } = request;
    const fnCount = analysis.functions.length;

    switch (hintLevel) {
      case 1:
        return {
          hintLevel: 1,
          levelLabel,
          conceptCategory: 'General Problem Solving',
          explanation: `Let's break down the logic of this code. It contains ${fnCount > 0 ? `${fnCount} function(s)` : 'statements'} and control flow elements.`,
          guidingQuestion: 'What is the specific goal of this program, and what input/output do you expect?',
          nextStepOrSelfCheck: 'Write down a simple example input and what the exact correct output should look like.',
          rawText: `Identify the intended program goal and expected output.`,
        };
      case 2:
        return {
          hintLevel: 2,
          levelLabel,
          conceptCategory: 'Variable State & Scope',
          explanation: `Trace through the code line by line with a sample input value (e.g. 0, 1, or negative numbers).`,
          guidingQuestion: 'When you step through the statements with test data, does the data flow match your expectations?',
          nextStepOrSelfCheck: 'Draw a small table of variable values after each line executes.',
          rawText: `Step through with test data to observe data flow.`,
        };
      case 3:
        return {
          hintLevel: 3,
          levelLabel,
          conceptCategory: 'Algorithm Optimization',
          explanation: `Consider breaking the task down into discrete steps: validate inputs, process data in sequence or loop, and return or display the outcome.`,
          guidingQuestion: 'Which step in that sequence is behaving unexpectedly?',
          nextStepOrSelfCheck: 'Isolate that specific step and test it independently.',
          codeSnippet: `# General structured approach:\n# 1. Initialize variables\n# 2. Process logic / loop\n# 3. Return or output result`,
          rawText: `Step-by-step algorithmic breakdown.`,
        };
    }
  }
}
