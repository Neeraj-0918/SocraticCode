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
}

export interface TutorResponse {
  hintLevel: HintLevel;
  levelLabel: string;
  explanation: string;
  guidingQuestion: string;
  codeSnippet?: string;
  rawText: string;
  isFallback?: boolean;
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
