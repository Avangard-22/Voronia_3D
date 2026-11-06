import { describe, expect, it } from 'vitest';
import { makeGame, grant } from './helpers';

describe('Stage 10.0.4 — geological rewards and resource discovery', () => {
  it('keeps geological reward data hidden until the cell is explored', () => {
    const { game } = makeGame(777);
    const rt = game.runtime('ferrum')!;
    const vein = rt.data.cells.find((cell) => cell.type === 3 && rt.revealed.has(cell.id))!;
    const before = game.snapshot().planets.find((planet) => planet.id === 'ferrum')!;
    expect(before.cells.find((cell) => cell.id === vein.id)?.geologicalReward).toBeNull();

    grant(game, { energy: 1000 });
    const result = game.dispatch('scanCell', { pid: 'ferrum', cellId: vein.id });
    expect(result.ok).toBe(true);
    const after = game.snapshot().planets.find((planet) => planet.id === 'ferrum')!;
    expect(after.cells.find((cell) => cell.id === vein.id)?.geologicalReward).toMatchObject({
      resourceKey: 'iron',
      baseRate: game.balance.baseline.veins.baseIronYieldOnScan,
    });
  });

  it('describes the actual baseline reward for the starting energy cell', () => {
    const { game } = makeGame(777);
    const cell = game.snapshot().planets.find((planet) => planet.id === 'ferrum')!.cells[0]!;
    expect(cell.geologicalReward).toMatchObject({ resourceKey: 'energy', baseRate: 1 });
  });

  it('does not change scan rewards or the economic ledger', () => {
    const { game } = makeGame(777);
    const rt = game.runtime('ferrum')!;
    const vein = rt.data.cells.find((cell) => cell.type === 3 && rt.revealed.has(cell.id))!;
    grant(game, { energy: 1000 });
    const ironBefore = game.ledger.balance('iron');
    const result = game.dispatch('scanCell', { pid: 'ferrum', cellId: vein.id });
    expect(result.ok).toBe(true);
    expect(game.ledger.balance('iron')).toBe(ironBefore);
    expect(rt.cellStates.get(vein.id)?.ironYield).toBe(game.balance.baseline.veins.baseIronYieldOnScan);
  });
});
