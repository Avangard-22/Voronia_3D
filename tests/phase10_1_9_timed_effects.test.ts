import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/game';
import { ManualDriver } from '../src/core/gameClock';
import { MemoryStorage, SAVE_KEY } from '../src/persistence/storage';

describe('Phase 10.1.9 — V1 timed effects and surge recovery', () => {
  it('skips missed offline surges and rearms the next active-planet schedule', () => {
    const storage = new MemoryStorage();
    const source = new Game({ storage, clockDriver: new ManualDriver(), rngSeed: 9019 });
    const rt = source.runtime('ferrum')!;
    const cell = rt.data.cells.find((c) => c.type === 1 || c.type === 2)!;
    rt.explored.add(cell.id);
    const state = rt.cellStates.get(cell.id)!;
    state.surgeNextAt = 10_000;
    state.surgeUntil = 5_000;
    state.chargeCooldownUntil = 8_000;
    source.dispatch('save', {});

    const raw = JSON.parse(storage.getItem(SAVE_KEY)!) as Record<string, unknown>;
    raw['savedAt'] = Date.now() - 5 * 60 * 1000;
    storage.setItem(SAVE_KEY, JSON.stringify(raw));

    const restored = new Game({ storage, clockDriver: new ManualDriver(), rngSeed: 1 });
    expect(restored.dispatch('load', {}).ok).toBe(true);
    const recovered = restored.runtime('ferrum')!.cellStates.get(cell.id)!;
    expect(recovered.surgeNextAt).toBeGreaterThan(restored.clock.gameMsNow);
    expect(recovered.surgeUntil).toBe(0);
    expect(recovered.chargeCooldownUntil).toBeLessThanOrEqual(restored.clock.gameMsNow);
    expect(restored.charge.status('ferrum')).toBeNull();
  });

  it('does not rearm a future surge timer during an ordinary short import', () => {
    const source = new Game({ clockDriver: new ManualDriver(), rngSeed: 9020 });
    const rt = source.runtime('ferrum')!;
    const cell = rt.data.cells.find((c) => c.type === 1 || c.type === 2)!;
    rt.explored.add(cell.id);
    rt.cellStates.get(cell.id)!.surgeNextAt = 90_000;
    const exported = source.dispatch('exportSave', {});
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    const target = new Game({ storage: new MemoryStorage(), clockDriver: new ManualDriver(), rngSeed: 2 });
    expect(target.dispatch('importSave', { payload: exported.value.payload }).ok).toBe(true);
    expect(target.runtime('ferrum')!.cellStates.get(cell.id)!.surgeNextAt).toBe(90_000);
  });
});
