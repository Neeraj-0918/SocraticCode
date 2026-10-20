import { HintLevel } from './types';

export class HintEngine {
  private _currentLevel: number = 0;
  private readonly _maxLevel: number = 3;

  public get currentLevel(): number {
    return this._currentLevel;
  }

  public get hasMoreHints(): boolean {
    return this._currentLevel < this._maxLevel;
  }

  public get nextLevel(): HintLevel | null {
    if (!this.hasMoreHints) {
      return null;
    }
    return (this._currentLevel + 1) as HintLevel;
  }

  public requestNextLevel(): HintLevel {
    if (this._currentLevel < this._maxLevel) {
      this._currentLevel++;
    }
    return Math.min(this._currentLevel, this._maxLevel) as HintLevel;
  }

  public reset(): void {
    this._currentLevel = 0;
  }

  public static getLevelLabel(level: HintLevel): string {
    switch (level) {
      case 1:
        return 'Conceptual';
      case 2:
        return 'Logical Reasoning';
      case 3:
        return 'Structural Guidance';
      default:
        return 'General Guidance';
    }
  }

  public static getLevelDescription(level: HintLevel): string {
    switch (level) {
      case 1:
        return 'Identifies the core programming concept and asks a guiding question. (No code)';
      case 2:
        return 'References specific variables, control flow, and encourages tracing program state.';
      case 3:
        return 'Provides an algorithmic step-by-step approach and safe pseudocode without giving the complete solution.';
      default:
        return '';
    }
  }
}
