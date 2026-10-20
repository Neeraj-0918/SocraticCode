import { describe, it, expect, beforeAll } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { PythonAdapter } from '../../../src/analysis/pythonAdapter';

describe('Python Tree-sitter Adapter', () => {
  let adapter: PythonAdapter;
  const parsersDir = path.resolve(__dirname, '../../../parsers');

  beforeAll(async () => {
    adapter = new PythonAdapter();
    await adapter.initialize(parsersDir);
  });

  it('should parse simple function correctly with AST structures', async () => {
    const fixturePath = path.resolve(__dirname, '../../fixtures/python/simple_function.py');
    const code = fs.readFileSync(fixturePath, 'utf8');

    const result = await adapter.parse(code);

    expect(result.language).toBe('python');
    expect(result.status).toBe('success');
    expect(result.functions).toHaveLength(1);
    expect(result.functions[0].name).toBe('calculate_area');
    expect(result.functions[0].parameters).toEqual(['width', 'height']);
    expect(result.functions[0].hasReturn).toBe(true);
    expect(result.returnStatements).toHaveLength(1);
    expect(result.diagnostics).toHaveLength(0);
  });

  it('should detect while loops and function calls in loop_with_bug.py', async () => {
    const fixturePath = path.resolve(__dirname, '../../fixtures/python/loop_with_bug.py');
    const code = fs.readFileSync(fixturePath, 'utf8');

    const result = await adapter.parse(code);

    expect(result.status).toBe('success');
    expect(result.loops).toHaveLength(1);
    expect(result.loops[0].type).toBe('while');
    expect(result.loops[0].conditionText).toContain('n > 0');
    expect(result.functionCalls.some(c => c.functionName === 'print')).toBe(true);
  });

  it('should detect syntax errors honestly with line numbers in syntax_error.py', async () => {
    const fixturePath = path.resolve(__dirname, '../../fixtures/python/syntax_error.py');
    const code = fs.readFileSync(fixturePath, 'utf8');

    const result = await adapter.parse(code);

    expect(result.status).toBe('partial');
    expect(result.diagnostics.length).toBeGreaterThan(0);
    expect(result.diagnostics[0].location.startLine).toBeGreaterThanOrEqual(1);
  });

  it('should handle empty or whitespace source gracefully', async () => {
    const result = await adapter.parse('   \n  \n');
    expect(result.status).toBe('success');
    expect(result.functions).toHaveLength(0);
    expect(result.variables).toHaveLength(0);
    expect(result.loops).toHaveLength(0);
  });
});
