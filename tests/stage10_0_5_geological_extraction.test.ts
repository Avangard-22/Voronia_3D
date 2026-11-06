import { describe, expect, it } from 'vitest';
import { advance, grant, makeGame } from './helpers';

describe('Stage 10.0.5 — geological extraction and deposit depletion', () => {
  function gameWithScannedVein() {
    const { game } = makeGame(999);
    grant(game, { energy: 1000 });
    const result = game.dispatch('scanCell', { pid: 'ferrum', cellId: 1 });
    expect(result.ok).toBe(true);
    return game;
  }

  it('exposes active depletion rate and estimated reserve lifetime in the snapshot', () => {
    const game = gameWithScannedVein();
    const cell = game.snapshot().planets.find((p) => p.id === 'ferrum')!.cells.find((c) => c.id === 1)!;
    expect(cell.depletionPerSec).toBeCloseTo(0.056, 12);
    expect(cell.reserveLifetimeSeconds).toBeCloseTo(126 / 0.056, 8);
  });

  it('updates the reserve and remaining lifetime as extraction advances', () => {
    const game = gameWithScannedVein();
    const rt = game.runtime('ferrum')!;
    advance(game, 10, 500);
    const state = rt.cellStates.get(1)!;
    expect(state.reserve).toBeCloseTo(125.72, 8);
    const cell = game.snapshot().planets.find((p) => p.id === 'ferrum')!.cells.find((c) => c.id === 1)!;
    expect(cell.reserveLifetimeSeconds).toBeCloseTo(state.reserve / 0.056, 8);
  });

  it('marks exhausted deposits inactive during cooldown and restores their reserve on reactivation', () => {
    const game = gameWithScannedVein();
    const rt = game.runtime('ferrum')!;
    const state = rt.cellStates.get(1)!;
    state.reserve = 0;
    state.cooldownUntil = game.clock.gameMsNow + 30_000;
    const cooling = game.snapshot().planets.find((p) => p.id === 'ferrum')!.cells.find((c) => c.id === 1)!;
    expect(cooling.depletionPerSec).toBe(0);
    expect(cooling.reserveLifetimeSeconds).toBeNull();

    advance(game, 61, 500);
    grant(game, { energy: 1000 });
    const result = game.dispatch('reactivateCell', { pid: 'ferrum', cellId: 1 });
    expect(result.ok).toBe(true);
    const restored = game.snapshot().planets.find((p) => p.id === 'ferrum')!.cells.find((c) => c.id === 1)!;
    expect(restored.reserve).toBe(restored.maxReserve);
    expect(restored.depletionPerSec).toBeCloseTo(0.056, 12);
    expect(restored.reserveLifetimeSeconds).toBeCloseTo(restored.maxReserve / 0.056, 8);
  });

  it('does not expose extraction estimates for unscanned or non-vein cells', () => {
    const { game } = makeGame(999);
    const cells = game.snapshot().planets.find((p) => p.id === 'ferrum')!.cells;
    const hidden = cells.find((c) => c.status !== 'explored')!;
    const energy = cells.find((c) => c.id === 0)!;
    expect(hidden.depletionPerSec).toBe(0);
    expect(hidden.reserveLifetimeSeconds).toBeNull();
    expect(energy.depletionPerSec).toBe(0);
    expect(energy.reserveLifetimeSeconds).toBeNull();
  });
});
