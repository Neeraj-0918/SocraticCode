import { AnalyticsSummary, LearningSessionRecord } from './types';

export interface StorageAdapter {
  get<T>(key: string, defaultValue?: T): T;
  update(key: string, value: any): Thenable<void> | Promise<void> | void;
}


export class InMemoryStorage implements StorageAdapter {
  private _data = new Map<string, any>();

  public get<T>(key: string, defaultValue?: T): T {
    if (this._data.has(key)) {
      return this._data.get(key);
    }
    return defaultValue as T;
  }

  public update(key: string, value: any): void {
    this._data.set(key, value);
  }
}

export class AnalyticsStore {
  private static readonly STORAGE_KEY = 'socraticcode.analytics.sessions';
  private _storage: StorageAdapter;

  constructor(storage?: StorageAdapter) {
    this._storage = storage || new InMemoryStorage();
  }

  public async recordSession(record: LearningSessionRecord): Promise<void> {
    const sessions = this._storage.get<LearningSessionRecord[]>(AnalyticsStore.STORAGE_KEY, []);
    sessions.unshift(record);

    // Keep max 100 historical sessions
    if (sessions.length > 100) {
      sessions.length = 100;
    }

    await this._storage.update(AnalyticsStore.STORAGE_KEY, sessions);
  }

  public async getSummary(): Promise<AnalyticsSummary> {
    const sessions = this._storage.get<LearningSessionRecord[]>(AnalyticsStore.STORAGE_KEY, []);

    const hintsByLevel = { l1: 0, l2: 0, l3: 0 };
    const languages: Record<string, number> = {};
    const conceptStats: Record<string, { total: number; struggle: number }> = {};
    let guardrailInterventions = 0;

    for (const session of sessions) {
      if (session.maxHintLevel === 1) hintsByLevel.l1++;
      else if (session.maxHintLevel === 2) hintsByLevel.l2++;
      else if (session.maxHintLevel >= 3) hintsByLevel.l3++;

      const lang = session.language.toLowerCase() || 'unknown';
      languages[lang] = (languages[lang] || 0) + 1;

      if (session.wasFallback) {
        guardrailInterventions++;
      }

      // Infer concept if not explicitly provided
      const concept = session.concept || AnalyticsStore.inferConcept(session.question, session.language);
      if (!conceptStats[concept]) {
        conceptStats[concept] = { total: 0, struggle: 0 };
      }
      conceptStats[concept].total++;
      if (session.maxHintLevel >= 2 || session.wasFallback) {
        conceptStats[concept].struggle++;
      }
    }

    const weakConcepts = Object.entries(conceptStats)
      .map(([concept, stats]) => {
        const rate = Math.round((stats.struggle / stats.total) * 100);
        let status: 'Needs Practice' | 'Developing' | 'Solid' = 'Solid';
        if (rate >= 60 && stats.total >= 1) {
          status = 'Needs Practice';
        } else if (rate >= 30) {
          status = 'Developing';
        }

        return {
          concept,
          totalQueries: stats.total,
          highStruggleCount: stats.struggle,
          struggleRate: rate,
          status,
          recommendation: AnalyticsStore.getRecommendation(concept, status),
        };
      })
      .sort((a, b) => b.struggleRate - a.struggleRate || b.highStruggleCount - a.highStruggleCount);

    return {
      totalSessions: sessions.length,
      totalQuestions: sessions.length,
      hintsByLevel,
      languages,
      guardrailInterventions,
      recentSessions: sessions.slice(0, 15),
      weakConcepts,
    };
  }

  public static inferConcept(question: string, _language: string): string {
    const q = question.toLowerCase();
    if (q.includes('while') || q.includes('infinite') || q.includes('loop') || q.includes('for') || q.includes('iterate')) {
      return 'Loop Termination & Iteration';
    }
    if (q.includes('return') || q.includes('none') || q.includes('output') || q.includes('print')) {
      return 'Function Return vs Output';
    }
    if (q.includes('syntax') || q.includes('colon') || q.includes('indent') || q.includes('parenthes')) {
      return 'Syntax Rules & Grammar';
    }
    if (q.includes('if') || q.includes('else') || q.includes('elif') || q.includes('condition') || q.includes('boolean')) {
      return 'Branching & Conditionals';
    }
    if (q.includes('variable') || q.includes('scope') || q.includes('assign') || q.includes('state')) {
      return 'Variable State & Scope';
    }
    if (q.includes('alternative') || q.includes('optimize') || q.includes('approach')) {
      return 'Algorithm Optimization';
    }
    return 'General Problem Solving';
  }

  public static getRecommendation(concept: string, status: 'Needs Practice' | 'Developing' | 'Solid'): string {
    if (status === 'Solid') {
      return `Mastery demonstrated in ${concept}. Ready for advanced challenges.`;
    }
    switch (concept) {
      case 'Loop Termination & Iteration':
        return 'Practice tracing loop counters with dry-runs. Verify condition variable updates on every iteration.';
      case 'Function Return vs Output':
        return 'Review the difference between print() side-effects and return statements passing values to callers.';
      case 'Syntax Rules & Grammar':
        return 'Double-check statement terminators (colons, braces) and indent structure before running code.';
      case 'Branching & Conditionals':
        return 'Test edge values (boundary conditions, 0, null, negatives) against your comparison operators.';
      case 'Variable State & Scope':
        return 'Sketch variable states on paper before and after each statement block.';
      case 'Algorithm Optimization':
        return 'Focus on recognizing redundant operations and selecting appropriate data structures.';
      default:
        return 'Step through code line-by-line with small sample inputs to build confidence.';
    }
  }

  public async clearAnalytics(): Promise<void> {
    await this._storage.update(AnalyticsStore.STORAGE_KEY, []);
  }
}
