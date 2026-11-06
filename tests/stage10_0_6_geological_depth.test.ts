import { describe, expect, it } from 'vitest';
import { grant, makeGame } from './helpers';

describe('Stage 10.0.6 — geological depth, ore quality and stratification', () => {
  it('keeps the geological passport hidden until a deposit is scanned', () => {
    const { game } = makeGame(999);
    const rt = game.runtime('ferrum')!;
    const vein = rt.data.cells.find((cell) => cell.type === 3 && rt.revealed.has(cell.id))!;
    expect(game.snapshot().planets.find((p) => p.id === 'ferrum')!.cells.find((c) => c.id === vein.id)!.geology).toBeNull();
    grant(game, { energy: 1000 });
    expect(game.dispatch('scanCell', { pid: 'ferrum', cellId: vein.id }).ok).toBe(true);
    const geology = game.snapshot().planets.find((p) => p.id === 'ferrum')!.cells.find((c) => c.id === vein.id)!.geology;
    expect(geology).not.toBeNull();
    expect(geology).toMatchObject({ depth: expect.any(String), oreQuality: expect.any(String), stratum: expect.any(String) });
    expect(geology!.depthMeters).toBeGreaterThan(0);
    expect(geology!.qualityPct).toBeGreaterThanOrEqual(0);
    expect(geology!.qualityPct).toBeLessThanOrEqual(100);
  });

  it('uses stable descriptive geology without changing legacy extraction economics', () => {
    const { game } = makeGame(999);
    const rt = game.runtime('ferrum')!;
    const vein = rt.data.cells.find((cell) => cell.type === 3 && rt.revealed.has(cell.id))!;
    grant(game, { energy: 1000 });
    game.dispatch('scanCell', { pid: 'ferrum', cellId: vein.id });
    const first = game.snapshot().planets.find((p) => p.id === 'ferrum')!.cells.find((c) => c.id === vein.id)!;
    const second = game.snapshot().planets.find((p) => p.id === 'ferrum')!.cells.find((c) => c.id === vein.id)!;
    expect(first.geology).toEqual(second.geology);
    expect(first.depletionPerSec).toBeCloseTo(0.056, 12);
    expect(first.geologicalReward?.baseRate).toBe(rt.cellStates.get(vein.id)!.ironYield);
  });
});
