import { describe, it, expect, beforeEach } from 'vitest';
import { AnalyticsStore } from '../../../src/analytics/analyticsStore';

describe('AnalyticsStore', () => {
  let store: AnalyticsStore;

  beforeEach(() => {
    store = new AnalyticsStore();
  });

  it('should initialize with empty metrics', async () => {
    const summary = await store.getSummary();
    expect(summary.totalSessions).toBe(0);
    expect(summary.recentSessions).toHaveLength(0);
  });

  it('should record sessions and aggregate metrics by hint level and language', async () => {
    await store.recordSession({
      id: 'session-1',
      timestamp: Date.now(),
      language: 'python',
      question: 'How do loops terminate?',
      maxHintLevel: 1,
      provider: 'Gemini',
      wasFallback: false,
    });

    await store.recordSession({
      id: 'session-2',
      timestamp: Date.now(),
      language: 'c',
      question: 'Why does this pointer segfault?',
      maxHintLevel: 3,
      provider: 'Gemini',
      wasFallback: true,
    });

    const summary = await store.getSummary();
    expect(summary.totalSessions).toBe(2);
    expect(summary.hintsByLevel.l1).toBe(1);
    expect(summary.hintsByLevel.l3).toBe(1);
    expect(summary.languages['python']).toBe(1);
    expect(summary.languages['c']).toBe(1);
    expect(summary.guardrailInterventions).toBe(1);
  });

  it('should clear stored session history', async () => {
    await store.recordSession({
      id: 'session-1',
      timestamp: Date.now(),
      language: 'python',
      question: 'Question',
      maxHintLevel: 2,
      provider: 'Demo',
      wasFallback: false,
    });

    await store.clearAnalytics();
    const summary = await store.getSummary();
    expect(summary.totalSessions).toBe(0);
  });
});
