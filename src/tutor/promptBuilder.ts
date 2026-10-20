import { HintLevel, TutorRequest } from './types';
import { HintEngine } from './hintEngine';

export class PromptBuilder {
  public static buildPrompt(request: TutorRequest): string {
    const { language, question, codeContext, analysis, hintLevel, sessionHistory } = request;
    const levelLabel = HintEngine.getLevelLabel(hintLevel);
    const levelInstruction = PromptBuilder.getHintLevelInstruction(hintLevel);

    const sections: string[] = [
      `Language: ${language}`,
      `Current Hint Level: Level ${hintLevel} (${levelLabel})`,
      `Hint Level Directive: ${levelInstruction}`,
    ];

    if (question && question.trim()) {
      sections.push(`Student Question: ${question.trim()}`);
    } else {
      sections.push(`Student Action: Requested progressive hint Level ${hintLevel} on their code.`);
    }

    if (codeContext && codeContext.trim()) {
      sections.push(`Code Context:\n\`\`\`${language}\n${codeContext.trim()}\n\`\`\``);
    }

    if (analysis) {
      sections.push(
        `Verified Code Analysis Findings:\n${analysis.summaryText || 'Structure parsed.'}`
      );
      if (analysis.diagnostics.length > 0) {
        sections.push(
          `Parser Diagnostics:\n${analysis.diagnostics.map((d) => `- Line ${d.location.startLine}: ${d.message}`).join('\n')}`
        );
      }
    }

    if (sessionHistory && sessionHistory.length > 0) {
      const historySummary = sessionHistory
        .slice(-4)
        .map((t) => `${t.role === 'student' ? 'Student' : 'Tutor'}: ${t.text}`)
        .join('\n');
      sections.push(`Recent Conversation Context:\n${historySummary}`);
    }

    return sections.join('\n\n');
  }

  public static getHintLevelInstruction(level: HintLevel): string {
    switch (level) {
      case 1:
        return 'Level 1 (Conceptual): Explain the core programming concept and ask a guiding question. DO NOT include code blocks or direct solutions.';
      case 2:
        return 'Level 2 (Logical reasoning): Point the student to specific variables, conditions, and lines. Ask them to trace state or predict outcomes. Small code fragments allowed, but no full solution.';
      case 3:
        return 'Level 3 (Structural guidance): Provide step-by-step algorithmic guidance or limited pseudocode outlining the approach. NEVER provide a ready-to-run copy-paste solution.';
      default:
        return 'Provide general Socratic guidance.';
    }
  }
}
