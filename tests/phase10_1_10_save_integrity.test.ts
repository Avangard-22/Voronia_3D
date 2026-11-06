import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/game';
import { ManualDriver } from '../src/core/gameClock';
import { MemoryStorage, SAVE_KEY } from '../src/persistence/storage';
import { validateSaveV2 } from '../src/persistence/schema';

const make = (storage = new MemoryStorage()) => new Game({ storage, clockDriver: new ManualDriver(), rngSeed: 1010 });

describe('Phase 10.1.10 — save integrity and recovery regression', () => {
  it('rejects invalid timestamps, duplicate cell ids and inconsistent active planet', () => {
    const save = make().collectState();
    expect(validateSaveV2(save).ok).toBe(true);
    const badTime = { ...save, savedAt: Number.NaN };
    expect(validateSaveV2(badTime).ok).toBe(false);
    const [pid, planet] = Object.entries(save.planets)[0]!;
    const duplicateCell = { ...save, planets: { ...save.planets, [pid]: { ...planet, cellStates: [{ id: 0, ...planet.cellStates[0] }, { id: 0, ...planet.cellStates[0] }] } } };
    expect(validateSaveV2(duplicateCell).ok).toBe(false);
    expect(validateSaveV2({ ...save, activePlanetId: 'not-unlocked' }).ok).toBe(false);
  });

  it('round-trips cell timers, reactor queue, planet stocks and progression without drift', () => {
    const storage = new MemoryStorage();
    const original = make(storage);
    const rt = original.runtime('ferrum')!;
    const cell = rt.data.cells.find((c) => c.type === 1 || c.type === 2)!;
    rt.explored.add(cell.id);
    Object.assign(rt.cellStates.get(cell.id)!, { surgeNextAt: 123456, surgeUntil: 120000, chargeCooldownUntil: 150000 });
    original.dispatch('save', {});
    const before = original.collectState();
    const restored = make(storage);
    expect(restored.dispatch('load', {}).ok).toBe(true);
    const after = restored.collectState();
    expect(after.ledger.balances).toEqual(before.ledger.balances);
    expect(after.planetResources).toEqual(before.planetResources);
    expect(after.planets.ferrum?.cellStates).toEqual(before.planets.ferrum?.cellStates);
    expect(after.reactor).toEqual(before.reactor);
    expect(after.unlockedPlanets).toEqual(before.unlockedPlanets);
  });

  it('does not mutate live game state when stored save is corrupt', () => {
    const storage = new MemoryStorage();
    const game = make(storage);
    game.dispatch('grant', { delta: { energy: 777 }, reason: 'integrity-test' });
    storage.setItem(SAVE_KEY, '{broken-json');
    const before = game.ledger.balance('energy');
    const result = game.dispatch('load', {});
    expect(result.ok).toBe(false);
    expect(game.ledger.balance('energy')).toBe(before);
  });

  it('rejects a storage write that cannot be read back', () => {
    const storage = new MemoryStorage();
    const game = make(storage);
    const brokenStorage = {
      getItem: (_key: string) => null,
      setItem: (_key: string, _value: string) => undefined,
      removeItem: (_key: string) => undefined,
      keys: () => [],
    };
    const failing = new Game({ storage: brokenStorage, clockDriver: new ManualDriver(), rngSeed: 10 });
    expect(() => failing.saves.save()).toThrow(/не подтверждено/);
    expect(game).toBeTruthy();
  });
});
