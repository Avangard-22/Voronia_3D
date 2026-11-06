import { describe, expect, it } from 'vitest';
import { makeGame, grant } from './helpers';

describe('Phase 10.1.5 — V1 warehouse and planetary stock capacity', () => {
  it('capacity and used mass follow the active planet-local stock during V1 On()/yy() switching', () => {
    const { game } = makeGame(101501);
    grant(game, { iron: 6 });
    const ferrumRuntime = game.runtime('ferrum')!;
    expect(game.warehouse.storedMass()).toBe(6);

    const opened = game.dispatch('discoverPlanet', { seed: 777101, name: 'Warehouse Test World' });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    expect(game.dispatch('setActivePlanet', { pid: opened.value.id }).ok).toBe(true);
    const newRuntime = game.runtime(opened.value.id)!;
    expect(game.warehouse.storedMass()).toBe(0);
    expect(game.warehouse.capacityFor(newRuntime)).toBe(newRuntime.explored.size * game.warehouse.tonsPerCell());

    grant(game, { carbon: 2 }); // dn(carbon)=3 → 6 tonnes
    expect(game.warehouse.storedMass()).toBe(6);
    expect(game.dispatch('setActivePlanet', { pid: 'ferrum' }).ok).toBe(true);
    expect(game.warehouse.storedMass()).toBe(6);
    expect(game.ledger.balance('iron')).toBe(6);
    expect(game.dispatch('setActivePlanet', { pid: opened.value.id }).ok).toBe(true);
    expect(game.warehouse.storedMass()).toBe(6);
    expect(game.ledger.balance('carbon')).toBe(2);
    expect(ferrumRuntime.explored.size).toBeGreaterThan(0);
  });
});
