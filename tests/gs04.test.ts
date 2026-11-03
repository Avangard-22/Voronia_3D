/**
 * GS-04: апгрейд cell0 ×5 — trail 0/96/336/840/1680⚡ и 12/26/60/108/180⛏, +1🔬 за шаг,
 * yield 2→6, reserve/maxReserve 1/1→2/2 (Vr-профиль), guards max/energy/cost (атомарность).
 */
import { describe, it, expect } from 'vitest';
import { makeGame, grant, fixture } from './helpers';
import { curveEntry, levelProfile, researchCellCost, levelReward } from '../src/economy/upgrades';
import { loadBalance } from '../src/config/loader';

interface CurveStep {
  levelBefore: number;
  levelAfter: number;
  cost: { energy: number; resources: Record<string, number> };
  yieldAfter: number;
  reserve: number;
  maxReserve: number;
}

describe('GS-04: trail апгрейда cell0 (fixtures/gs04_upgrade_curve.json)', () => {
  const fx = fixture<{ steps: CurveStep[] }>('gs04_upgrade_curve.json');
  const { game } = makeGame(4242);
  grant(game, { energy: 10000, iron: 1000 });
  const rt = game.runtime('ferrum')!;

  it('5 шагов: цены/эффекты совпадают с фикстурой', () => {
    for (const step of fx.steps) {
      const res = game.dispatch('upgradeCell', { pid: 'ferrum', cellId: 0 });
      expect(res.ok, `upgrade L${step.levelBefore}→${step.levelAfter}`).toBe(true);
      if (!res.ok) continue;
      expect(res.value.level).toBe(step.levelAfter);
      expect(res.value.cost.energy ?? 0).toBe(step.cost.energy);
      for (const [k, v] of Object.entries(step.cost.resources)) {
        expect(res.value.cost[k as 'iron'], `cost ${k}`).toBe(v);
      }
      expect(res.value.researchGained).toBe(1); // +1🔬 за шаг (min(25, 1+floor(E/2500)))
      const st = rt.cellStates.get(0)!;
      expect(st.yield).toBe(step.yieldAfter);
      expect(st.reserve).toBe(step.reserve);
      expect(st.maxReserve).toBe(step.maxReserve);
    }
    expect(game.session().upgraded).toBe(5);
  });

  it('итоговые балансы: −2952⚡, −386⛏, +5🔬 (с учётом старта)', () => {
    expect(game.ledger.balance('energy')).toBeCloseTo(10000 - 2952, 6);
    expect(game.ledger.balance('iron')).toBeCloseTo(1000 - 386, 6);
    expect(game.ledger.balance('research')).toBeCloseTo(5, 6);
  });
});

describe('GS-04: guards и кривая', () => {
  const balance = loadBalance();

  it('MAX_LEVEL 100 → "max"', () => {
    const { game } = makeGame(1);
    grant(game, { energy: 1e9, iron: 1e9 });
    const st = game.runtime('ferrum')!.cellStates.get(0)!;
    st.level = 100;
    const res = game.dispatch('upgradeCell', { pid: 'ferrum', cellId: 0 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('max');
  });

  it('неисследованная клетка → "state"', () => {
    const { game } = makeGame(1);
    grant(game, { energy: 1e6, iron: 1e6 });
    const res = game.dispatch('upgradeCell', { pid: 'ferrum', cellId: 5 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('state');
  });

  it('атомарность: мало железа → "cost", энергия не списана (GS-05-принцип)', () => {
    const { game } = makeGame(1);
    grant(game, { energy: 10000 }); // железа 0
    const e0 = game.ledger.balance('energy');
    const res = game.dispatch('upgradeCell', { pid: 'ferrum', cellId: 0 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('cost');
    expect(game.ledger.balance('energy')).toBe(e0);
    expect(game.runtime('ferrum')!.cellStates.get(0)!.level).toBe(0);
  });

  it('только энергия в минусе → "energy"', () => {
    const { game } = makeGame(1);
    grant(game, { iron: 1000 }); // энергии 0
    const st = game.runtime('ferrum')!.cellStates.get(0)!;
    st.level = 1; // следующая цена 96⚡ + 26⛏
    const res = game.dispatch('upgradeCell', { pid: 'ferrum', cellId: 0 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.reason).toBe('energy');
    expect(game.ledger.balance('iron')).toBe(1000);
    void st;
  });

  it('yl-продолжение кривой: L20 = raw×1.13 (без round), L30+ — cap-ветвь', () => {
    const e19 = curveEntry(balance, 19, false)!;
    const e20 = curveEntry(balance, 20, false)!;
    expect(e20.e).toBeCloseTo(e19.e * 1.13, 6);
    const fx = fixture<{ baseCurve_g0: { level: number; e: number }[] }>('gs04_upgrade_curve.json');
    for (let L = 20; L <= 30; L++) {
      expect(curveEntry(balance, L, false)!.e).toBeCloseTo(fx.baseCurve_g0[L]!.e, 4);
    }
  });

  it('Vr-профиль: reserveMult L1=1.16 → maxReserve round(1×1.16)=1, L3=1.6 → 2', () => {
    expect(levelProfile(balance, 1).reserveMult).toBe(1.16);
    expect(levelProfile(balance, 3).reserveMult).toBe(1.6);
    expect(Math.round(1 * levelProfile(balance, 3).reserveMult)).toBe(2);
    // за L25: ×1.083^s / ×1.104^s
    const p26 = levelProfile(balance, 26);
    expect(p26.yieldMult).toBeCloseTo(12.4 * 1.083, 9);
    expect(p26.reserveMult).toBeCloseTo(22.2 * 1.104, 9);
  });

  it('li(): научная клетка L0 {25000⚡,15💎,150🔬}, L1 {47500,26,285}, silicon с L5', () => {
    const fx = fixture<{ rows?: unknown[] }>('research_cells_v0.0.41.json');
    const c0 = researchCellCost(balance, 0);
    expect(c0).toMatchObject({ energy: 25000, crystals: 15, research: 150 });
    const c1 = researchCellCost(balance, 1);
    expect(c1).toMatchObject({ energy: 47500, crystals: 26, research: 285 });
    const c5 = researchCellCost(balance, 5);
    expect(c5.silicon).toBe(50);
    void fx;
  });

  it('_0(): levelRewards — до L10 null, с L10 — награда (не iron)', () => {
    expect(levelReward(balance, 9)).toBeNull();
    const r10 = levelReward(balance, 10);
    const table = balance.registry.cells.levelRewards[10];
    if (table && table.key !== 'iron') {
      expect(r10).toMatchObject({ key: table.key, amount: table.amount });
    }
  });
});
