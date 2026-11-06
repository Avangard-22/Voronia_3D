import { describe, expect, it } from 'vitest';
import { makeGame, grant } from './helpers';

function addSynthCell(game: ReturnType<typeof makeGame>['game'], pid: string, level = 2) {
  const rt = game.runtime(pid)!;
  const node = rt.data.cells.find((cell) => cell.type === 4)!;
  rt.explored.add(node.id);
  const state = rt.cellStates.get(node.id)!;
  state.level = level;
  state.anomalyType = 'synth';
  return { rt, state };
}

describe('Phase 10.1.7 — synthesizer, mutants and production parity', () => {
  it('synthesizes only for the active planet and uses that planet local stock', () => {
    const { game } = makeGame(101407);
    game.tech.setResearch('unlock_carbon', 1);
    game.tech.setResearch('unlock_kriogenBoost', 1);
    const ferrum = addSynthCell(game, 'ferrum');

    const save = game.collectState();
    game.applyState({ ...save, unlockedPlanets: [...save.unlockedPlanets, 'krios'] });
    const krios = addSynthCell(game, 'krios', 1);

    grant(game, { iron: 100 });
    const ferrumIronBefore = game.ledger.balance('iron');
    expect(game.activeRuntimes().map((rt) => rt.data.id)).toEqual(['ferrum']);
    expect(game.synthService.tick(game.activeRuntimes(), 10)).toBe(true);
    expect(game.ledger.balance('iron')).toBeLessThan(ferrumIronBefore);
    const ferrumIronAfter = game.ledger.balance('iron');
    const ferrumCarbon = game.ledger.balance('carbon');

    expect(game.dispatch('setActivePlanet', { pid: 'krios' }).ok).toBe(true);
    grant(game, { kriogen: 100 });
    const kriosKriogenBefore = game.ledger.balance('kriogen');
    expect(game.synthService.tick(game.activeRuntimes(), 10)).toBe(true);
    expect(game.ledger.balance('kriogen')).toBeLessThan(kriosKriogenBefore);
    expect(game.ledger.balance('carbon')).toBeGreaterThan(ferrumCarbon);
    const kriosKriogenAfter = game.ledger.balance('kriogen');

    expect(game.dispatch('setActivePlanet', { pid: 'ferrum' }).ok).toBe(true);
    expect(game.ledger.balance('iron')).toBeCloseTo(ferrumIronAfter, 12);
    expect(game.synthService.status(ferrum.rt).anomalies).toBe(1);
    expect(game.synthService.status(krios.rt).anomalies).toBe(1);
    expect(kriosKriogenAfter).toBeLessThan(kriosKriogenBefore);
  });

  it('mutant yield and depletion multipliers remain independent V1 factors', () => {
    const { game } = makeGame(101708);
    const rt = game.runtime('ferrum')!;
    const vein = rt.data.cells.find((cell) => cell.type === 3)!;
    rt.explored.add(vein.id);
    const state = rt.cellStates.get(vein.id)!;
    state.ironYield = 0.1;
    state.reserve = state.maxReserve = 100;

    state.mutant = null;
    const baseYield = game.income.computeIncome([rt], game.incomeContext()).snapshot.ironPerSec;
    const baseDepletion = game.production.depletePerSec(rt, vein.id);

    state.mutant = 'ember';
    expect(game.income.computeIncome([rt], game.incomeContext()).snapshot.ironPerSec).toBeCloseTo(baseYield * 1.5, 12);
    expect(game.production.depletePerSec(rt, vein.id)).toBeCloseTo(baseDepletion * 1.5, 12);

    state.mutant = 'rime';
    expect(game.income.computeIncome([rt], game.incomeContext()).snapshot.ironPerSec).toBeCloseTo(baseYield * 1.2, 12);
    expect(game.production.depletePerSec(rt, vein.id)).toBeCloseTo(baseDepletion * 0.8, 12);

    state.mutant = 'shadow';
    expect(game.income.computeIncome([rt], game.incomeContext()).snapshot.ironPerSec).toBeCloseTo(baseYield * 2, 12);
    expect(game.production.depletePerSec(rt, vein.id)).toBeCloseTo(baseDepletion * 2, 12);
  });


  it('rejects zero, negative and non-finite synthesis time steps without ledger changes', () => {
    const { game } = makeGame(101710);
    game.tech.setResearch('unlock_carbon', 1);
    const { rt } = addSynthCell(game, 'ferrum');
    grant(game, { iron: 50 });
    const before = game.ledger.snapshot();
    expect(game.synthService.tick([rt], 0)).toBe(false);
    expect(game.synthService.tick([rt], -1)).toBe(false);
    expect(game.synthService.tick([rt], Number.NaN)).toBe(false);
    expect(game.ledger.snapshot()).toEqual(before);
  });

  it('unknown mutant id safely falls back to neutral multipliers', () => {
    const { game } = makeGame(101709);
    const rt = game.runtime('ferrum')!;
    const vein = rt.data.cells.find((cell) => cell.type === 3)!;
    rt.explored.add(vein.id);
    const state = rt.cellStates.get(vein.id)!;
    state.ironYield = 0.1;
    state.mutant = null;
    const baseline = game.production.depletePerSec(rt, vein.id);
    state.mutant = 'unknown-mutant';
    expect(game.production.depletePerSec(rt, vein.id)).toBeCloseTo(baseline, 12);
  });
});
