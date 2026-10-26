export interface LearningSessionRecord {
  id: string;
  timestamp: number;
  language: string;
  question: string;
  concept?: string;
  maxHintLevel: number;
  provider: string;
  wasFallback: boolean;
  mode?: 'hint' | 'alternative_approach';
}

export interface WeakConceptItem {
  concept: string;
  totalQueries: number;
  highStruggleCount: number; // instances requiring Level 2, Level 3, or fallback
  struggleRate: number;      // 0 to 100 percentage
  status: 'Needs Practice' | 'Developing' | 'Solid';
  recommendation: string;
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
  weakConcepts: WeakConceptItem[];
}
