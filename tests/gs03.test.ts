/**
 * GS-03: скан-trail 1→2→3 — цены 9/9/10, ΔE −9/−9/+990, currentCost 10→13,
 * наука +1/+1/[10..24] (аномалия), guards state/hidden/energy/unknown-cell, активация жилы (ironYield 0.1).
 */
import { describe, it, expect } from 'vitest';
import { makeGame, grant, fixture } from './helpers';

interface TrailStep {
  cellId: number;
  charge: number;
  currentCostBefore: number;
  currentCostAfter: number;
  energyDelta: number;
  researchDelta: number;
  cellType: number;
}

describe('GS-03: скан-trail (fixtures/gs03_scan_trail.json)', () => {
  const fx = fixture<{ steps: TrailStep[] }>('gs03_scan_trail.json');
  const { game } = makeGame(777);
  grant(game, { energy: 1000 });

  it('trail 1→2→3: цены/дельты/рост currentCost совпадают с фикстурой', () => {
    let energyBefore = game.ledger.balance('energy');
    let researchBefore = game.ledger.balance('research');
    for (const step of fx.steps) {
      expect(game.pricing.getCurrentCost(), `currentCostBefore cell${step.cellId}`).toBe(step.currentCostBefore);
      const res = game.dispatch('scanCell', { pid: 'ferrum', cellId: step.cellId });
      expect(res.ok, `scan cell${step.cellId}`).toBe(true);
      if (!res.ok) continue;
      expect(res.value.cost).toBe(step.charge);
      const energyAfter = game.ledger.balance('energy');
      expect(energyAfter - energyBefore).toBe(step.energyDelta);
      const researchAfter = game.ledger.balance('research');
      const rd = researchAfter - researchBefore;
      if (step.cellType === 4) {
        // аномалия: 10 + floor(rng×15) — rng 2.0 свой (GS-исключение), проверяем диапазон
        expect(rd).toBeGreaterThanOrEqual(10);
        expect(rd).toBeLessThanOrEqual(24);
      } else {
        expect(rd).toBeCloseTo(step.researchDelta, 9);
      }
      expect(game.pricing.getCurrentCost()).toBe(step.currentCostAfter);
      energyBefore = energyAfter;
      researchBefore = researchAfter;
    }
  });

  it('аномалия (cell3, type4): +1000⚡ и +50⛏ мгновенно (ΔE +990 = −10 charge + 1000)', () => {
    expect(game.ledger.balance('iron')).toBeGreaterThanOrEqual(50);
    const st = game.runtime('ferrum')!.cellStates.get(3)!;
    expect(st.anomalyType).toBeNull(); // ветвь выбирается на Этапе 4
  });

  it('жила cell1 активирована: ironYield = 0.1; explored/revealed обновлены', () => {
    const rt = game.runtime('ferrum')!;
    expect(rt.cellStates.get(1)!.ironYield).toBeCloseTo(0.1, 12);
    expect([...rt.explored]).toEqual([0, 1, 2, 3]);
    for (const cid of [1, 2, 3]) {
      const node = rt.data.cells[cid]!;
      for (const nb of node.neighbors) expect(rt.revealed.has(nb), `neighbor ${nb} of ${cid}`).toBe(true);
    }
  });

  it('мутант жилы: 12%-ролл структурен (null или id из таблицы рукава)', () => {
    const st = game.runtime('ferrum')!.cellStates.get(1)!;
    expect(st.mutant === null || st.mutant === 'prime').toBe(true);
  });
});

describe('GS-03: guards скана', () => {
  const { game } = makeGame(777);
  grant(game, { energy: 1000 });

  it('повторный скан → "state"', () => {
    expect(game.dispatch('scanCell', { pid: 'ferrum', cellId: 0 }).ok).toBe(false);
    const res = game.dispatch('scanCell', { pid: 'ferrum', cellId: 0 });
    if (!res.ok) expect(res.reason).toBe('state');
  });

  it('нераскрытая клетка → "hidden"', () => {
    const rt = game.runtime('ferrum')!;
    const hidden = rt.data.cells.find((c) => !rt.revealed.has(c.id))!;
    const res = game.dispatch('scanCell', { pid: 'ferrum', cellId: hidden.id });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('hidden');
  });

  it('неизвестная клетка → "unknown-cell"', () => {
    const res = game.dispatch('scanCell', { pid: 'ferrum', cellId: 99 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('unknown-cell');
  });

  it('неизвестная планета → "unknown-cell"', () => {
    const res = game.dispatch('scanCell', { pid: 'krios', cellId: 1 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('unknown-cell');
  });

  it('нет энергии → "energy", атомарно (revealed/explored не меняются)', () => {
    const rt = game.runtime('ferrum')!;
    const before = [...rt.explored].join(',');
    // тратим всю энергию
    const bal = game.ledger.balance('energy');
    grant(game, { energy: -bal });
    const target = rt.data.cells.find((c) => !rt.explored.has(c.id) && rt.revealed.has(c.id))!;
    const res = game.dispatch('scanCell', { pid: 'ferrum', cellId: target.id });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('energy');
    expect([...rt.explored].join(',')).toBe(before);
    expect(game.ledger.balance('energy')).toBe(0);
  });
});
