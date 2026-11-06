/** Phase 10.1.2 — lock the V1 v0.0.41 core loop against executable golden trails. */
import { describe, expect, it } from 'vitest';
import { makeGame, grant, advance, fixture } from './helpers';

describe('Phase 10.1.2 — V1 core loop parity lock', () => {
  it('scan: preserves V1 price growth, reward, reveal order and anomaly reward', () => {
    const { game } = makeGame(2301356963);
    grant(game, { energy: 1000 });
    const rt = game.runtime('ferrum')!;
    const trail = fixture<{ steps: Array<{ cellId: number; charge: number; currentCostAfter: number; energyDelta: number; researchDelta: number; exploredAfter: number[]; revealedAfter: number[] }> }>('gs03_scan_trail.json');
    for (const expected of trail.steps) {
      const beforeEnergy = game.ledger.balance('energy');
      const beforeResearch = game.ledger.balance('research');
      const result = game.dispatch('scanCell', { pid: 'ferrum', cellId: expected.cellId });
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.value.cost).toBe(expected.charge);
      expect(result.value.currentCostAfter).toBe(expected.currentCostAfter);
      expect(game.ledger.balance('energy') - beforeEnergy).toBe(expected.energyDelta);
      expect(game.ledger.balance('research') - beforeResearch).toBeCloseTo(expected.researchDelta, 9);
      expect([...rt.explored]).toEqual(expected.exploredAfter);
      expect([...rt.revealed]).toEqual(expected.revealedAfter);
    }
    expect(game.ledger.balance('iron')).toBe(50);
    expect(game.ledger.balance('research')).toBeCloseTo(20, 9);
  });

  it('scan rejects hidden cells without charging resources or changing exploration state', () => {
    const { game } = makeGame();
    grant(game, { energy: 1000 });
    const rt = game.runtime('ferrum')!;
    const energy = game.ledger.balance('energy');
    const explored = [...rt.explored];
    const result = game.dispatch('scanCell', { pid: 'ferrum', cellId: 11 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('hidden');
    expect(game.ledger.balance('energy')).toBe(energy);
    expect([...rt.explored]).toEqual(explored);
  });

  it('upgrade: keeps the V1 cost curve, yield, reserve and research trail', () => {
    const { game } = makeGame(4242);
    grant(game, { energy: 10000, iron: 1000 });
    const expected = fixture<{ steps: Array<{ levelAfter: number; cost: { energy: number; resources: Record<string, number> }; yieldAfter: number; reserve: number; maxReserve: number }> }>('gs04_upgrade_curve.json');
    const rt = game.runtime('ferrum')!;
    for (const step of expected.steps) {
      const result = game.dispatch('upgradeCell', { pid: 'ferrum', cellId: 0 });
      expect(result.ok).toBe(true);
      if (!result.ok) continue;
      expect(result.value.level).toBe(step.levelAfter);
      expect(result.value.cost.energy ?? 0).toBe(step.cost.energy);
      expect(result.value.cost.iron ?? 0).toBe(step.cost.resources.iron ?? 0);
      const state = rt.cellStates.get(0)!;
      expect(state.yield).toBe(step.yieldAfter);
      expect(state.reserve).toBe(step.reserve);
      expect(state.maxReserve).toBe(step.maxReserve);
    }
    expect(game.session().upgraded).toBe(expected.steps.length);
  });

  it('vein: scan activates extraction, depletion starts cooldown, reactivation restores full reserve', () => {
    const { game } = makeGame();
    grant(game, { energy: 1_000_000 });
    const rt = game.runtime('ferrum')!;
    const scanned = game.dispatch('scanCell', { pid: 'ferrum', cellId: 1 });
    expect(scanned.ok).toBe(true);
    const state = rt.cellStates.get(1)!;
    expect(state.ironYield).toBeGreaterThan(0);
    const rate = game.production.activeDepletePerSec(rt, 1);
    expect(rate).toBeCloseTo(0.056, 9);
    game.production.tick([rt], state.reserve / rate + 1);
    expect(state.reserve).toBe(0);
    expect(state.cooldownUntil).toBeGreaterThan(game.clock.gameMsNow);
    expect(game.production.activeDepletePerSec(rt, 1)).toBe(0);
    const duringCooldown = game.dispatch('reactivateCell', { pid: 'ferrum', cellId: 1 });
    expect(duringCooldown.ok).toBe(false);
    if (!duringCooldown.ok) expect(duringCooldown.reason).toBe('cooldown');
    // Advance only game time; no wall-clock dependency in the parity test.
    advance(game, 601, 500);
    const restored = game.dispatch('reactivateCell', { pid: 'ferrum', cellId: 1 });
    expect(restored.ok).toBe(true);
    expect(state.reserve).toBe(state.maxReserve);
    expect(state.cooldownUntil).toBe(0);
  });
});
