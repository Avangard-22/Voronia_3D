import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/game';
import { ManualDriver } from '../src/core/gameClock';
import { migrateLegacyV39 } from '../src/persistence/schema';
import { makeGame, grant } from './helpers';

describe('Phase 10.1.4 — V1 planet switching and local stock', () => {
  it('swaps iron/kriogen/extra resources per planet while global resources stay shared', () => {
    const { game } = makeGame(101401);
    grant(game, { energy: 9000, iron: 1234, kriogen: 77, silicon: 88 });
    const energy = game.ledger.balance('energy');
    const opened = game.dispatch('discoverPlanet', { seed: 777001, name: 'Helica Prime' });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;

    expect(game.dispatch('setActivePlanet', { pid: opened.value.id }).ok).toBe(true);
    expect(game.ledger.balance('energy')).toBe(energy);
    expect(game.ledger.balance('iron')).toBe(0);
    expect(game.ledger.balance('kriogen')).toBe(0);
    expect(game.ledger.balance('silicon')).toBe(0);

    grant(game, { iron: 42, silicon: 9 });
    expect(game.dispatch('setActivePlanet', { pid: 'ferrum' }).ok).toBe(true);
    expect(game.ledger.balance('iron')).toBe(1234);
    expect(game.ledger.balance('kriogen')).toBe(77);
    expect(game.ledger.balance('silicon')).toBe(88);
    expect(game.ledger.balance('energy')).toBe(energy);

    expect(game.dispatch('setActivePlanet', { pid: opened.value.id }).ok).toBe(true);
    expect(game.ledger.balance('iron')).toBe(42);
    expect(game.ledger.balance('silicon')).toBe(9);
  });

  it('persists inactive and active planet stock through save/load', () => {
    const first = new Game({ clockDriver: new ManualDriver(), rngSeed: 101402 });
    grant(first, { research: 100_000, iron: 1234, silicon: 88 });
    const opened = first.dispatch('discoverPlanet', { seed: 777001, name: 'Helica Prime' });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;
    first.dispatch('setActivePlanet', { pid: opened.value.id });
    grant(first, { iron: 42, silicon: 9 });
    const save = first.collectState();

    const restored = new Game({ clockDriver: new ManualDriver(), rngSeed: 1 });
    restored.applyState(save);
    expect(restored.ledger.balance('iron')).toBe(42);
    expect(restored.ledger.balance('silicon')).toBe(9);
    restored.dispatch('setActivePlanet', { pid: 'ferrum' });
    expect(restored.ledger.balance('iron')).toBe(1234);
    expect(restored.ledger.balance('silicon')).toBe(88);
    expect(restored.runtime('ferrum')?.explored.size).toBe(first.runtime('ferrum')?.explored.size);
  });

  it('assigns legacy v2 balances to active planet when planetResources is absent', () => {
    const { game } = makeGame(101403);
    grant(game, { iron: 321, kriogen: 12, carbon: 5 });
    const oldV2 = { ...game.collectState(), planetResources: undefined };
    const restored = new Game({ clockDriver: new ManualDriver(), rngSeed: 2 });
    restored.applyState(oldV2);
    expect(restored.ledger.balance('iron')).toBe(321);
    expect(restored.ledger.balance('kriogen')).toBe(12);
    expect(restored.ledger.balance('carbon')).toBe(5);
  });

  it('migrates v39 inactive planet storage and active top-level stock separately', () => {
    const migrated = migrateLegacyV39({
      version: 39,
      activePlanetId: 'ferrum',
      unlockedPlanets: ['ferrum', 'planet_03'],
      iron: 1234,
      kriogen: 77,
      extraResources: { silicon: 88 },
      planets: {
        ferrum: { explored: [], revealed: [], cellStates: [], storage: { iron: 1, kriogen: 2, silicon: 3 } },
        planet_03: { explored: [], revealed: [], cellStates: [], storage: { iron: 456, kriogen: 8, silicon: 99 } },
      },
    });
    expect(migrated.planetResources?.ferrum).toMatchObject({ iron: 1234, kriogen: 77, silicon: 88 });
    expect(migrated.planetResources?.planet_03).toMatchObject({ iron: 456, kriogen: 8, silicon: 99 });
  });

  it('runs production against active planet only', () => {
    const { game } = makeGame(101404);
    game.dispatch('discoverPlanet', { seed: 777001 });
    expect(game.activeRuntimes().map((runtime) => runtime.data.id)).toEqual(['ferrum']);
    expect(game.unlockedRuntimes().map((runtime) => runtime.data.id)).toContain('planet_03');
  });
});
