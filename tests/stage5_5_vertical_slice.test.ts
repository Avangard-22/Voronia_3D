/** Stage 5.5 — проверка полного жизненного цикла планеты, переключения и восстановления. */
import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/game';
import { ManualDriver } from '../src/core/gameClock';
import { MemoryStorage } from '../src/persistence/storage';
import { makeGame, grant } from './helpers';

describe('Stage 5.5: planet lifecycle', () => {
  it('переключает активную планету только на открытую и сохраняет выбор', () => {
    const storage = new MemoryStorage();
    const first = new Game({ storage, clockDriver: new ManualDriver(), rngSeed: 77123 });
    grant(first, { research: 1_000_000, energy: 1_000_000 });
    const opened = first.dispatch('discoverPlanet', { seed: 556677, name: 'Test Meridian' });
    expect(opened.ok).toBe(true);
    if (!opened.ok) return;

    const switched = first.dispatch('setActivePlanet', { pid: opened.value.id });
    expect(switched.ok).toBe(true);
    expect(first.snapshot().activePlanetId).toBe(opened.value.id);
    const locked = first.dispatch('setActivePlanet', { pid: 'not-unlocked' });
    expect(locked.ok).toBe(false);

    expect(first.dispatch('save', {}).ok).toBe(true);
    const restored = new Game({ storage, clockDriver: new ManualDriver(), rngSeed: 1 });
    expect(restored.dispatch('load', {}).ok).toBe(true);
    expect(restored.snapshot().activePlanetId).toBe(opened.value.id);
    expect(restored.snapshot().planets.map((p) => p.id)).toContain(opened.value.id);
    expect(restored.snapshot().planets.find((p) => p.id === opened.value.id)?.name).toBe('Test Meridian');
  });

  it('сохраняет прогресс каждой планеты независимо при переключении', () => {
    const { game } = makeGame(15929600);
    grant(game, { research: 1_000_000, energy: 1_000_000, iron: 1_000_000, kriogen: 1_000_000, crystals: 1_000_000, steel: 1_000_000, alloy: 1_000_000, silicon: 1_000_000 });
    const target = game.runtime('ferrum')!.data.cells.find((c) => game.runtime('ferrum')!.revealed.has(c.id) && !game.runtime('ferrum')!.explored.has(c.id) && c.type !== 4 && c.type !== 6);
    expect(target).toBeDefined();
    if (!target) return;
    expect(game.dispatch('scanCell', { pid: 'ferrum', cellId: target.id }).ok).toBe(true);
    const scannedBefore = game.runtime('ferrum')!.explored.has(target.id);
    expect(scannedBefore).toBe(true);

    const discovered = game.dispatch('discoverPlanet', { seed: 991122 });
    expect(discovered.ok).toBe(true);
    if (!discovered.ok) return;
    expect(game.dispatch('setActivePlanet', { pid: discovered.value.id }).ok).toBe(true);
    expect(game.dispatch('setActivePlanet', { pid: 'ferrum' }).ok).toBe(true);
    expect(game.runtime('ferrum')!.explored.has(target.id)).toBe(true);
    expect(game.snapshot().activePlanetId).toBe('ferrum');
  });

  it('экспортируемый payload можно импортировать в чистый экземпляр', () => {
    const { game } = makeGame(45123);
    grant(game, { energy: 4321, research: 987 });
    const exported = game.dispatch('exportSave', {});
    expect(exported.ok).toBe(true);
    if (!exported.ok) return;
    const imported = makeGame(999).game;
    const result = imported.dispatch('importSave', { payload: exported.value.payload });
    expect(result.ok).toBe(true);
    expect(imported.snapshot().resources.energy).toBe(game.snapshot().resources.energy);
    expect(imported.snapshot().resources.research).toBe(game.snapshot().resources.research);
  });
});
