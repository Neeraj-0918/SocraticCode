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
    }

    return {
      totalSessions: sessions.length,
      totalQuestions: sessions.length,
      hintsByLevel,
      languages,
      guardrailInterventions,
      recentSessions: sessions.slice(0, 10),
    };
  }

  public async clearAnalytics(): Promise<void> {
    await this._storage.update(AnalyticsStore.STORAGE_KEY, []);
  }
}
