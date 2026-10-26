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

  it('should detect weak concepts and compute struggle rate and recommendations', async () => {
    // 2 struggle sessions on while loops (Level 2 & Level 3)
    await store.recordSession({
      id: 'sess-loop-1',
      timestamp: Date.now(),
      language: 'python',
      question: 'Why is my while loop stuck infinitely?',
      concept: 'Loop Termination & Iteration',
      maxHintLevel: 2,
      provider: 'Demo',
      wasFallback: false,
    });
    await store.recordSession({
      id: 'sess-loop-2',
      timestamp: Date.now(),
      language: 'python',
      question: 'How do I stop this loop?',
      concept: 'Loop Termination & Iteration',
      maxHintLevel: 3,
      provider: 'Demo',
      wasFallback: false,
    });
    // 1 solid session on conditionals (Level 1)
    await store.recordSession({
      id: 'sess-cond-1',
      timestamp: Date.now(),
      language: 'python',
      question: 'How does if-else branch work?',
      concept: 'Branching & Conditionals',
      maxHintLevel: 1,
      provider: 'Demo',
      wasFallback: false,
    });

    const summary = await store.getSummary();
    expect(summary.weakConcepts).toBeDefined();
    expect(summary.weakConcepts.length).toBeGreaterThanOrEqual(2);

    const loopConcept = summary.weakConcepts.find((c) => c.concept === 'Loop Termination & Iteration');
    expect(loopConcept).toBeDefined();
    expect(loopConcept?.totalQueries).toBe(2);
    expect(loopConcept?.highStruggleCount).toBe(2);
    expect(loopConcept?.struggleRate).toBe(100);
    expect(loopConcept?.status).toBe('Needs Practice');
    expect(loopConcept?.recommendation).toContain('loop');

    const condConcept = summary.weakConcepts.find((c) => c.concept === 'Branching & Conditionals');
    expect(condConcept?.status).toBe('Solid');
  });
});

