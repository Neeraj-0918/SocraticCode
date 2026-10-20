import { describe, it, expect, beforeAll } from 'vitest';
import * as path from 'path';
import { CAdapter } from '../../../src/analysis/cAdapter';

describe('CAdapter', () => {
  let adapter: CAdapter;
  const wasmDir = path.resolve(__dirname, '../../../parsers');

  beforeAll(async () => {
    adapter = new CAdapter();
    await adapter.initialize(wasmDir);
  });

  it('should parse a C function with while loop and return statement', async () => {
    const code = `
int countdown(int n) {
    while (n > 0) {
        n--;
    }
    return 0;
}
    `.trim();

    const result = await adapter.parse(code);

    expect(result.language).toBe('c');
    expect(result.status).toBe('success');
    expect(result.functions).toHaveLength(1);
    expect(result.functions[0].name).toBe('countdown');
    expect(result.functions[0].parameters).toContain('n');

    expect(result.loops).toHaveLength(1);
    expect(result.loops[0].type).toBe('while');
    expect(result.loops[0].conditionText).toBe('(n > 0)');

    expect(result.returnStatements).toHaveLength(1);
    expect(result.returnStatements[0].hasValue).toBe(true);
  });

  it('should detect syntax errors in malformed C code', async () => {
    const malformed = `
int broken( {
    while (x >
}
    `.trim();

    const result = await adapter.parse(malformed);
    expect(result.status).toBe('partial');
    expect(result.diagnostics.length).toBeGreaterThan(0);
  });
});
