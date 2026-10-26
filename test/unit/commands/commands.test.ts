import { describe, it, expect } from 'vitest';
import { COMMAND_IDS } from '../../../src/commands/index';

describe('Command IDs', () => {
  it('should export all 9 required command IDs including exploreAlternative', () => {
    expect(Object.keys(COMMAND_IDS)).toHaveLength(9);
    expect(COMMAND_IDS.openTutor).toBe('socraticcode.openTutor');
    expect(COMMAND_IDS.analyzeFile).toBe('socraticcode.analyzeCurrentFile');
    expect(COMMAND_IDS.askAboutSelection).toBe('socraticcode.askAboutSelection');
    expect(COMMAND_IDS.exploreAlternative).toBe('socraticcode.exploreAlternative');
    expect(COMMAND_IDS.requestNextHint).toBe('socraticcode.requestNextHint');
    expect(COMMAND_IDS.openDashboard).toBe('socraticcode.openDashboard');
    expect(COMMAND_IDS.clearSession).toBe('socraticcode.clearSession');
    expect(COMMAND_IDS.configureProvider).toBe('socraticcode.configureProvider');
    expect(COMMAND_IDS.switchDemoMode).toBe('socraticcode.switchDemoMode');
  });
});
