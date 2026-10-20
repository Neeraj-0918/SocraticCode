import { AIProvider } from './types';
import { HintLevel, TutorRequest, TutorResponse } from '../tutor/types';
import { HintEngine } from '../tutor/hintEngine';

export class DemoProvider implements AIProvider {
  public readonly name = 'Demo Provider';

  public async isConfigured(): Promise<boolean> {
    return true;
  }

  public async generateResponse(request: TutorRequest): Promise<TutorResponse> {
    const { analysis, hintLevel, question } = request;
    const levelLabel = HintEngine.getLevelLabel(hintLevel);

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
          explanation: `A syntax error was detected around Line ${line}. In programming, syntax represents the strict grammatical rules of the language.`,
          guidingQuestion: 'What punctuation or closing symbol is required by Python at the end of block statements or definitions?',
          rawText: `Line ${line}: Syntax issue observed. Consider Python grammar requirements.`,
        };
      case 2:
        return {
          hintLevel: 2,
          levelLabel,
          explanation: `Inspect Line ${line} closely. Python function definitions and control flow statements require matching parentheses and must terminate with a colon ':'.`,
          guidingQuestion: 'Does your statement on Line ${line} have balanced parentheses and a terminating colon?',
          rawText: `Check Line ${line}: look for missing ':' or unmatched '()'.`,
        };
      case 3:
        return {
          hintLevel: 3,
          levelLabel,
          explanation: `To fix a syntax error at a header, make sure the structure follows: keyword name(parameters): followed by an indented block.`,
          guidingQuestion: 'Have you closed the parameter list and added the colon at the end of Line ${line}?',
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
          explanation: `Your code contains a while loop at Line ${line} with condition (${cond}). A while loop continues running as long as its test condition evaluates to True.`,
          guidingQuestion: `Under what circumstances will the condition (${cond}) become False so the loop can safely terminate?`,
          rawText: `Examine the loop termination condition (${cond}).`,
        };
      case 2:
        return {
          hintLevel: 2,
          levelLabel,
          explanation: `Trace the variables inside the loop condition (${cond}) across each iteration. If the variables tested in the condition never change within the loop body, the program enters an infinite loop.`,
          guidingQuestion: `How does the state of the loop variable change during each pass through the loop? Is it moving closer to the exit condition?`,
          rawText: `Trace loop state on each iteration. Are variables updated?`,
        };
      case 3:
        return {
          hintLevel: 3,
          levelLabel,
          explanation: `To prevent infinite execution, ensure that the variable controlling the loop is updated on every pass toward the stopping boundary.`,
          guidingQuestion: `Where in your loop body should you update the counter variable?`,
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
          explanation: `The function '${fnName}' executes statements, but does not explicitly return a value. In Python, functions without a return statement implicitly return 'None'.`,
          guidingQuestion: `Does the caller of '${fnName}' expect to receive a calculated value back, or just perform an action?`,
          rawText: `Functions without 'return' return None in Python.`,
        };
      case 2:
        return {
          hintLevel: 2,
          levelLabel,
          explanation: `Printing a value inside a function displays it on the screen, but does not make that value available to other parts of your code that called the function.`,
          guidingQuestion: `Do you want the function to print its result, or return the calculated value so another variable can store it?`,
          rawText: `Distinguish between printing and returning.`,
        };
      case 3:
        return {
          hintLevel: 3,
          levelLabel,
          explanation: `Use the 'return' keyword at the end of the function body to pass the computed result back to the caller.`,
          guidingQuestion: `What specific variable or expression should follow the 'return' keyword in '${fnName}'?`,
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
          explanation: `Let's break down the logic of this code. It contains ${fnCount > 0 ? `${fnCount} function(s)` : 'statements'} and control flow elements.`,
          guidingQuestion: 'What is the specific goal of this program, and what input/output do you expect?',
          rawText: `Identify the intended program goal and expected output.`,
        };
      case 2:
        return {
          hintLevel: 2,
          levelLabel,
          explanation: `Trace through the code line by line with a sample input value (e.g. 0, 1, or negative numbers).`,
          guidingQuestion: 'When you step through the statements with test data, does the data flow match your expectations?',
          rawText: `Step through with test data to observe data flow.`,
        };
      case 3:
        return {
          hintLevel: 3,
          levelLabel,
          explanation: `Consider breaking the task down into discrete steps: validate inputs, process data in sequence or loop, and return or display the outcome.`,
          guidingQuestion: 'Which step in that sequence is behaving unexpectedly?',
          codeSnippet: `# General structured approach:\n# 1. Initialize variables\n# 2. Process logic / loop\n# 3. Return or output result`,
          rawText: `Step-by-step algorithmic breakdown.`,
        };
    }
  }
}
