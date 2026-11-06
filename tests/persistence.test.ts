/**
 * Персистентность (README Этап 2): roundtrip save→load, export/import, миграция legacy v39
 * (fixtures/golden_save_fresh_v0.0.41.json), валидатор отвергает битые сейвы.
 */
import { describe, it, expect } from 'vitest';
import { Game } from '../src/core/game';
import { ManualDriver } from '../src/core/gameClock';
import { MemoryStorage, SAVE_KEY, LEGACY_SAVE_KEY } from '../src/persistence/storage';
import { migrateLegacyV39, validateSaveV2 } from '../src/persistence/schema';
import { makeGame, grant, advance, fixture } from './helpers';

function scriptGame(game: Game): void {
  grant(game, { energy: 5000, iron: 500, steel: 1000, alloy: 10 });
  game.dispatch('scanCell', { pid: 'ferrum', cellId: 1 });
  game.dispatch('scanCell', { pid: 'ferrum', cellId: 2 });
  game.dispatch('scanCell', { pid: 'ferrum', cellId: 3 });
  game.dispatch('upgradeCell', { pid: 'ferrum', cellId: 0 });
  game.dispatch('upgradeCell', { pid: 'ferrum', cellId: 0 });
  game.dispatch('upgradeWarehouse', {});
  advance(game, 4, 500);
}

describe('persistence: roundtrip', () => {
  it('save → load в том же Game: состояние идентично', () => {
    const storage = new MemoryStorage();
    const g1 = new Game({ storage, clockDriver: new ManualDriver(), rngSeed: 8888 });
    scriptGame(g1);
    const before = g1.snapshot();
    const saved = g1.dispatch('save', {});
    expect(saved.ok).toBe(true);

    // «перезапуск»: новый Game на том же storage
    const g2 = new Game({ storage, clockDriver: new ManualDriver(), rngSeed: 1 });
    const res = g2.dispatch('load', {});
    expect(res.ok).toBe(true);
    const after = g2.snapshot();

    expect(after.resources).toEqual(before.resources);
    expect(after.scan.currentCost).toBe(before.scan.currentCost);
    expect(after.warehouse.level).toBe(before.warehouse.level);
    expect(after.session.scanned).toBe(3);
    expect(after.session.upgraded).toBe(2);
    expect(after.session.warehouseUpgrades).toBe(1);
    const pl1 = before.planets[0]!;
    const pl2 = after.planets[0]!;
    expect(pl2.cells.filter((c) => c.status === 'explored').map((c) => c.id)).toEqual(pl1.cells.filter((c) => c.status === 'explored').map((c) => c.id));
    expect(pl2.cells.filter((c) => c.status === 'revealed').map((c) => c.id)).toEqual(pl1.cells.filter((c) => c.status === 'revealed').map((c) => c.id));
    expect(pl2.cells[0]!.level).toBe(2);
    expect(after.gameMs).toBe(before.gameMs);
  });

  it('порядок revealed сохраняется через сейв (Set → массив → Set)', () => {
    const storage = new MemoryStorage();
    const g1 = new Game({ storage, clockDriver: new ManualDriver(), rngSeed: 8888 });
    const g2 = new Game({ storage, clockDriver: new ManualDriver(), rngSeed: 8888 });
    g1.dispatch('save', {});
    g2.dispatch('load', {});
    expect([...g2.runtime('ferrum')!.revealed]).toEqual([...g1.runtime('ferrum')!.revealed]);
    expect([...g2.runtime('ferrum')!.revealed]).toEqual([0, 2, 1, 3, 6, 7]);
  });

  it('export → import строкой: payload валиден, состояние переносится', () => {
    const { game } = makeGame(2468);
    scriptGame(game);
    const exp = game.dispatch('exportSave', {});
    expect(exp.ok).toBe(true);
    if (!exp.ok) return;
    const { game: g2 } = makeGame(1111);
    const imp = g2.dispatch('importSave', { payload: exp.value.payload });
    expect(imp.ok).toBe(true);
    expect(g2.snapshot().resources).toEqual(game.snapshot().resources);
  });

  it('битый payload → import "state", состояние не тронуто', () => {
    const { game } = makeGame(2468);
    const e0 = game.ledger.balance('energy');
    const res = game.dispatch('importSave', { payload: '{не json' });
    expect(res.ok).toBe(false);
    expect(game.ledger.balance('energy')).toBe(e0);
    const res2 = game.dispatch('importSave', { payload: JSON.stringify({ version: 2, garbage: true }) });
    expect(res2.ok).toBe(false);
  });

  it('пустое хранилище → load "empty"', () => {
    const { game } = makeGame(1);
    const res = game.dispatch('load', {});
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('state');
  });
});

describe('persistence: legacy v39 (golden save)', () => {
  const golden = fixture<Record<string, unknown>>('golden_save_fresh_v0.0.41.json');

  it('migrateLegacyV39: 20 ресурсов, ferrum explored/revealed, currentCost 10, tech', () => {
    const v2 = migrateLegacyV39(golden);
    expect(v2.version).toBe(2);
    expect(v2.ledger.balances['energy']).toBeCloseTo(0.504, 9);
    expect(v2.ledger.balances['iron']).toBe(0);
    expect(v2.pricing.currentCost).toBe(10);
    expect(v2.activePlanetId).toBe('ferrum');
    expect(v2.planets['ferrum']!.explored).toEqual([0]);
    expect(v2.planets['ferrum']!.revealed).toEqual([0, 2, 1, 3, 6, 7]);
    expect(v2.planets['ferrum']!.cellStates[0]).toMatchObject({ id: 0, level: 0, yield: 1, isDeep: false });
    expect(v2.tech.levels.costScale).toBe(0);
    expect(v2.warehouseLevel).toBe(0);
    expect(v2.gameStartSeed).toBe(2301357296);
  });

  it('mid-game V1 golden save migrates without losing economy or planet progress', () => {
    const midgame = fixture<Record<string, unknown>>('golden_save_midgame_v0.0.41.json');
    const v2 = migrateLegacyV39(midgame);
    expect(v2.version).toBe(2);
    expect(v2.ledger.balances['energy']).toBe(12345);
    expect(v2.ledger.balances['iron']).toBe(999664);
    expect(v2.ledger.balances['research']).toBe(678);
    expect(v2.pricing.currentCost).toBe(33);
    expect(v2.warehouseLevel).toBe(3);
    expect(v2.activePlanetId).toBe('ferrum');
    expect(v2.planets['ferrum']!.explored).toHaveLength(12);
    expect(v2.planets['ferrum']!.revealed).toHaveLength(12);
    expect(v2.planets['krios']!.explored).toHaveLength(0);
  });

  it('загрузка legacy из storage под ключом cosmicClickerV19 → migrated', () => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_SAVE_KEY, JSON.stringify(golden));
    const game = new Game({ storage, clockDriver: new ManualDriver(), rngSeed: 1 });
    const res = game.saves.load();
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.migrated).toBe(true);
    const snap = game.snapshot();
    expect(snap.resources.energy).toBeCloseTo(0.504, 9);
    expect(snap.scan.currentCost).toBe(10);
    expect([...game.runtime('ferrum')!.revealed]).toEqual([0, 2, 1, 3, 6, 7]);
    // после миграции — сохранение уже в своём ключе v2
    game.dispatch('save', {});
    expect(storage.getItem(SAVE_KEY)).not.toBeNull();
  });

  it('неизвестная версия → отказ (не v2, не v39)', () => {
    const storage = new MemoryStorage();
    storage.setItem(SAVE_KEY, JSON.stringify({ version: 7, energy: 1 }));
    const game = new Game({ storage, clockDriver: new ManualDriver(), rngSeed: 1 });
    const res = game.saves.load();
    expect(res.ok).toBe(false);
  });

  it('validateSaveV2 ловит: version, ledger, planets, pricing', () => {
    expect(validateSaveV2(null).ok).toBe(false);
    expect(validateSaveV2({ version: 2 }).ok).toBe(false);
    const v2 = migrateLegacyV39(golden);
    expect(validateSaveV2(v2).ok).toBe(true);
    const broken = JSON.parse(JSON.stringify(v2)) as Record<string, unknown>;
    (broken['pricing'] as Record<string, unknown>)['currentCost'] = -5;
    expect(validateSaveV2(broken).ok).toBe(false);
  });
});
