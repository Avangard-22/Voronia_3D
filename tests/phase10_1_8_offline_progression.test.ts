import { describe, it, expect } from 'vitest';
import { Game } from '../src/core/game';
import { ManualDriver } from '../src/core/gameClock';
import { MemoryStorage, SAVE_KEY } from '../src/persistence/storage';

const unlock = (game: Game, id: string): void => game.tech.setResearch(id, 1);

describe('Phase 10.1.8 — V1 offline production and recovery', () => {
  it('applies capped offline reactor progress once and re-anchors the save timestamp', () => {
    const storage = new MemoryStorage();
    const source = new Game({ storage, clockDriver: new ManualDriver(), rngSeed: 8018 });
    unlock(source, 'recipe_steel');
    source.dispatch('grant', { delta: { carbon: 100, energy: 10000 }, reason: 'test-offline-inputs' });
    source.dispatch('craftEnqueue', { recipeId: 'steel', runs: 20 });
    source.dispatch('save', {});

    const raw = JSON.parse(storage.getItem(SAVE_KEY)!) as Record<string, unknown>;
    raw['savedAt'] = Date.now() - 5 * 60 * 1000; // 5 min × 50% = 150 s = five 30 s runs
    storage.setItem(SAVE_KEY, JSON.stringify(raw));

    const restored = new Game({ storage, clockDriver: new ManualDriver(), rngSeed: 2 });
    expect(restored.dispatch('load', {}).ok).toBe(true);
    expect(restored.ledger.balance('steel')).toBe(5);
    expect(restored.snapshot().reactor.queue[0]?.done).toBe(5);
    const firstLoadGameMs = restored.clock.gameMsNow;
    expect(firstLoadGameMs).toBeCloseTo(150_000, -1);

    // load() immediately saves the recovered state; the same interval cannot be credited twice.
    expect(restored.dispatch('load', {}).ok).toBe(true);
    expect(restored.ledger.balance('steel')).toBe(5);
    expect(restored.clock.gameMsNow).toBe(firstLoadGameMs);
  });

  it('does not credit intervals shorter than the configured minimum', () => {
    const storage = new MemoryStorage();
    const source = new Game({ storage, clockDriver: new ManualDriver(), rngSeed: 8019 });
    unlock(source, 'recipe_steel');
    source.dispatch('grant', { delta: { carbon: 100, energy: 10000 }, reason: 'test-offline-inputs' });
    source.dispatch('craftEnqueue', { recipeId: 'steel', runs: 3 });
    source.dispatch('save', {});
    const raw = JSON.parse(storage.getItem(SAVE_KEY)!) as Record<string, unknown>;
    raw['savedAt'] = Date.now() - 30_000;
    storage.setItem(SAVE_KEY, JSON.stringify(raw));

    const restored = new Game({ storage, clockDriver: new ManualDriver(), rngSeed: 3 });
    expect(restored.dispatch('load', {}).ok).toBe(true);
    expect(restored.ledger.balance('steel')).toBe(0);
    expect(restored.clock.gameMsNow).toBe(0);
  });

  it('explicit import restores the snapshot without granting pre-import offline time', () => {
    const source = new Game({ clockDriver: new ManualDriver(), rngSeed: 8020 });
    source.dispatch('save', {});
    const payload = source.dispatch('exportSave', {});
    expect(payload.ok).toBe(true);
    if (!payload.ok) return;
    const data = JSON.parse(payload.value.payload) as Record<string, unknown>;
    data['savedAt'] = Date.now() - 60 * 60 * 1000;

    const target = new Game({ storage: new MemoryStorage(), clockDriver: new ManualDriver(), rngSeed: 4 });
    expect(target.dispatch('importSave', { payload: JSON.stringify(data) }).ok).toBe(true);
    expect(target.clock.gameMsNow).toBe(0);
  });
});
