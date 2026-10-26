import { AnalysisResult } from '../analysis/types';

export type HintLevel = 1 | 2 | 3;

export interface ChatTurn {
  role: 'student' | 'tutor';
  text: string;
  timestamp: number;
  hintLevel?: HintLevel;
}

export interface TutorRequest {
  language: string;
  question?: string;
  codeContext?: string;
  analysis: AnalysisResult;
  hintLevel: HintLevel;
  sessionHistory?: ChatTurn[];
  mode?: 'hint' | 'alternative_approach';
}

export interface TutorResponse {
  hintLevel: HintLevel;
  levelLabel: string;
  explanation: string;
  guidingQuestion: string;
  analogyOrObservation?: string;
  nextStepOrSelfCheck?: string;
  conceptCategory?: string;
  codeSnippet?: string;
  rawText: string;
  isFallback?: boolean;
  mode?: 'hint' | 'alternative_approach';
}

export interface TutorSession {
  sessionId: string;
  language: string;
  currentHintLevel: number;
  turns: ChatTurn[];
  responses: TutorResponse[];
  createdAt: number;
  lastActiveAt: number;
}
