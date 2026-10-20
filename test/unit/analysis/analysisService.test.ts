import { describe, it, expect, beforeAll } from 'vitest';
import * as path from 'path';
import { AnalysisService } from '../../../src/analysis/analysisService';

describe('Analysis Service', () => {
  let service: AnalysisService;
  const parsersDir = path.resolve(__dirname, '../../../parsers');

  beforeAll(async () => {
    service = new AnalysisService();
    await service.initialize(parsersDir);
  });

  it('should analyze python file correctly', async () => {
    const code = 'def greet(name):\n    print(f"Hello {name}")\n';
    const result = await service.analyzeDocument('test.py', 'python', code);

    expect(result.language).toBe('python');
    expect(result.status).toBe('success');
    expect(result.functions).toHaveLength(1);
    expect(result.functions[0].name).toBe('greet');
  });

  it('should handle unsupported languages with honest error status', async () => {
    const code = 'public class Main {}';
    const result = await service.analyzeDocument('Main.java', 'java', code);

    expect(result.status).toBe('error');
    expect(result.diagnostics).toHaveLength(1);
    expect(result.diagnostics[0].message).toContain('Unsupported language');
  });

  it('should format analysis result into readable HTML', () => {
    const html = service.formatFindingsToHtml({
      language: 'python',
      status: 'success',
      functions: [{
        name: 'test_func',
        parameters: ['x'],
        location: { startLine: 1, startColumn: 1, endLine: 2, endColumn: 10 },
        hasReturn: true
      }],
      variables: [],
      loops: [],
      conditions: [],
      functionCalls: [],
      returnStatements: [],
      diagnostics: [],
    });

    expect(html).toContain('test_func');
    expect(html).toContain('Line 1');
  });
});
