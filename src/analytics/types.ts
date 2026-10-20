export interface LearningSessionRecord {
  id: string;
  timestamp: number;
  language: string;
  question: string;
  maxHintLevel: number;
  provider: string;
  wasFallback: boolean;
}

export interface AnalyticsSummary {
  totalSessions: number;
  totalQuestions: number;
  hintsByLevel: {
    l1: number;
    l2: number;
    l3: number;
  };
  languages: Record<string, number>;
  guardrailInterventions: number;
  recentSessions: LearningSessionRecord[];
}
