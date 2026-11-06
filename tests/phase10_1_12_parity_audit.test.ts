import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const matrix = JSON.parse(fs.readFileSync(path.resolve('docs/PHASE10_1_12_PARITY_MATRIX.json'), 'utf8')) as {
  baseline: { v1: string; save_schema: number };
  summary: Record<string, number>;
  mechanics: Array<{ id: string; status: string; evidence: string[] }>;
};

describe('Phase 10.1.12 — V1/V2 parity audit', () => {
  it('anchors the audit to the exact V1 release and save schema', () => {
    expect(matrix.baseline).toEqual({ v1: 'v0.0.41.0', save_schema: 39 });
  });

  it('has unique mechanics, explicit evidence and internally consistent status counts', () => {
    expect(new Set(matrix.mechanics.map((item) => item.id)).size).toBe(matrix.mechanics.length);
    for (const item of matrix.mechanics) {
      expect(['PASS', 'PARTIAL', 'GAP', 'BLOCKED']).toContain(item.status);
      expect(item.evidence.length).toBeGreaterThan(0);
      for (const ref of item.evidence) expect(fs.existsSync(path.resolve(ref.split('#')[0]))).toBe(true);
    }
    for (const status of ['PASS', 'PARTIAL', 'GAP', 'BLOCKED']) {
      expect(matrix.mechanics.filter((item) => item.status === status)).toHaveLength(matrix.summary[status]);
    }
    expect(matrix.summary.total).toBe(matrix.mechanics.length);
  });

  it('does not misrepresent unresolved hooks as closed parity', () => {
    const game = fs.readFileSync(path.resolve('src/core/game.ts'), 'utf8');
    const synth = fs.readFileSync(path.resolve('src/economy/synth.ts'), 'utf8');
    expect(game).toMatch(/spcHiddenFor:\s*\(\)\s*=>\s*false/);
    expect(synth).toMatch(/roleMultFor\?\.\(rt\)\s*\?\?\s*1/);
    expect(synth).toMatch(/modsFor\?\.\(rt\)\s*\?\?\s*1/);
    expect(matrix.summary.GAP).toBeGreaterThan(0);
  });
});
