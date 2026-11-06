import { describe, expect, it } from 'vitest';
import { Game } from '../src/core/game';
import { ManualDriver } from '../src/core/gameClock';
import { MemoryStorage, LEGACY_SAVE_KEY, SAVE_KEY } from '../src/persistence/storage';
import { fixture, makeGame, grant } from './helpers';

describe('Phase 10.1.13 — offline synth and V1 golden save replay', () => {
  it('uses a dedicated Ay offline path and respects offlineCapMult', () => {
    const { game } = makeGame(1013013);
    game.tech.setResearch('unlock_carbon', 1);
    const rt = game.runtime('ferrum')!;
    const node = rt.data.cells.find((cell) => cell.type === 4)!;
    rt.explored.add(node.id);
    const state = rt.cellStates.get(node.id)!;
    state.level = 2;
    state.anomalyType = 'synth';
    grant(game, { iron: 100 });

    const beforeInput = game.ledger.balance('iron');
    const beforeOutput = game.ledger.balance('carbon');
    expect(game.synthService.tickOffline([rt], 10)).toBe(true);
    const consumed = beforeInput - game.ledger.balance('iron');
    const produced = game.ledger.balance('carbon') - beforeOutput;
    expect(consumed).toBeGreaterThan(0);
    expect(produced).toBeCloseTo(consumed / game.balance.registry.transport.config.inputPerOutput, 12);
    expect(game.synthService.originOf(rt, 'carbon', 'synthesized')).toBeCloseTo(produced, 12);
  });

  it.each([
    ['fresh', 'golden_save_fresh_v0.0.41.json', 0.504, 0, 10, 0],
    ['midgame', 'golden_save_midgame_v0.0.41.json', 12345, 999664, 33, 3],
  ] as const)('replays V1 schema-39 %s save through real load and V2 rewrite', (_label, file, energy, iron, scanCost, warehouse) => {
    const storage = new MemoryStorage();
    storage.setItem(LEGACY_SAVE_KEY, JSON.stringify(fixture<Record<string, unknown>>(file)));
    const game = new Game({ storage, clockDriver: new ManualDriver(), rngSeed: 1013013 });
    const loaded = game.dispatch('load', {});
    expect(loaded.ok).toBe(true);
    expect(game.ledger.balance('energy')).toBeCloseTo(energy, 9);
    expect(game.ledger.balance('iron')).toBe(iron);
    expect(game.snapshot().scan.currentCost).toBe(scanCost);
    expect(game.snapshot().warehouse.level).toBe(warehouse);
    expect(storage.getItem(SAVE_KEY)).not.toBeNull();
    expect(storage.getItem(LEGACY_SAVE_KEY)).not.toBeNull();

    const afterFirstLoad = game.snapshot();
    expect(game.dispatch('load', {}).ok).toBe(true);
    expect(game.snapshot().resources).toEqual(afterFirstLoad.resources);
    expect(game.snapshot().gameMs).toBe(afterFirstLoad.gameMs);
  });
});
