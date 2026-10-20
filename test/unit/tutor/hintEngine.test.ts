import { describe, it, expect, beforeEach } from 'vitest';
import { HintEngine } from '../../../src/tutor/hintEngine';

describe('HintEngine', () => {
  let engine: HintEngine;

  beforeEach(() => {
    engine = new HintEngine();
  });

  it('should initialize at level 0 (no hint yet)', () => {
    expect(engine.currentLevel).toBe(0);
    expect(engine.hasMoreHints).toBe(true);
    expect(engine.nextLevel).toBe(1);
  });

  it('should advance levels progressively (0 -> 1 -> 2 -> 3)', () => {
    expect(engine.requestNextLevel()).toBe(1);
    expect(engine.currentLevel).toBe(1);
    expect(engine.nextLevel).toBe(2);

    expect(engine.requestNextLevel()).toBe(2);
    expect(engine.currentLevel).toBe(2);
    expect(engine.nextLevel).toBe(3);

    expect(engine.requestNextLevel()).toBe(3);
    expect(engine.currentLevel).toBe(3);
    expect(engine.hasMoreHints).toBe(false);
    expect(engine.nextLevel).toBeNull();
  });

  it('should not advance beyond level 3', () => {
    engine.requestNextLevel(); // 1
    engine.requestNextLevel(); // 2
    engine.requestNextLevel(); // 3
    expect(engine.requestNextLevel()).toBe(3);
    expect(engine.currentLevel).toBe(3);
  });

  it('should reset level on session reset', () => {
    engine.requestNextLevel(); // 1
    engine.requestNextLevel(); // 2
    engine.reset();
    expect(engine.currentLevel).toBe(0);
    expect(engine.nextLevel).toBe(1);
  });

  it('should provide clear level metadata and labels', () => {
    expect(HintEngine.getLevelLabel(1)).toBe('Conceptual');
    expect(HintEngine.getLevelLabel(2)).toBe('Logical Reasoning');
    expect(HintEngine.getLevelLabel(3)).toBe('Structural Guidance');
  });
});
