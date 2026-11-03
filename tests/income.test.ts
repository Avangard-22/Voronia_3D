/**
 * Доход (fixtures/income_midgame_documented.json + income_audit_v0.0.41.json):
 * — документированный midgame: explored [0,1,2,3], cell0 L5, steel 1000 → 42⚡ / 0.69⛏ / 0.002🔬 ТОЧНО;
 * — полный аудит (все 12, compound 1): 20⚡ (7+3+10) / 0.23⛏;
 * — compound-кап ×6 (Fa), вклад ×6 = 1+min(Σunits×bonus, 5).
 */
import { describe, it, expect } from 'vitest';
import { makeGame, grant, fixture } from './helpers';
import { compoundBonusMult } from '../src/contracts/resources';

function setupMidgame() {
  const { game } = makeGame(31337);
  grant(game, { steel: 1000 });
  const rt = game.runtime('ferrum')!;
  // состояние фикстуры: explored [0,1,2,3], cell0 L5 (yield 6), жила cell1 активна (ironYield 0.1, reserve 126)
  for (const cid of [1, 2, 3]) rt.explored.add(cid);
  const st0 = rt.cellStates.get(0)!;
  st0.level = 5;
  st0.yield = 6;
  const st1 = rt.cellStates.get(1)!;
  st1.ironYield = 0.1;
  return { game, rt };
}

describe('доход: документированный midgame (42 / 0.69 / 0.002)', () => {
  const { game } = setupMidgame();
  const { snapshot: inc } = game.income.computeIncome(game.activeRuntimes(), game.incomeContext());
  const fx = fixture<{ income: { energyPerSec: number; ironPerSec: number; researchPerSec: number; planetIncome: { ferrum: { energyByType: Record<string, number> } } } }>('income_midgame_documented.json');

  it('42⚡/с = Σ(1+L)×compound6 = (6+1)×6', () => {
    expect(inc.energyPerSec).toBeCloseTo(42, 9);
    expect(inc.energyPerSec).toBeCloseTo(fx.income.energyPerSec, 9);
  });

  it('0.69⛏/с = 0.1 × 1.15(«Каменистый») × 6', () => {
    expect(inc.ironPerSec).toBeCloseTo(0.69, 9);
    expect(inc.ironPerSec).toBeCloseTo(fx.income.ironPerSec, 9);
  });

  it('0.002🔬/с = 2 type0 × 0.001 (кап планеты 50+50×idx=100 не связывает)', () => {
    expect(inc.researchPerSec).toBeCloseTo(0.002, 12);
    expect(inc.researchPerSec).toBeCloseTo(fx.income.researchPerSec, 12);
  });

  it('energyByType {0:42, 3:0} — аномалия (synth-дефолт) пассивного дохода не даёт', () => {
    const p = inc.byPlanet['ferrum']!;
    expect(p.energyByType[0]).toBeCloseTo(42, 9);
    expect(p.energyByType[3] ?? 0).toBe(0);
    expect(inc.kriogenPerSec).toBe(0);
    expect(inc.crystalsPerSec).toBe(0);
  });

  it('compound: steel 1000 → ×6 (кап); steel 2000 → тоже ×6; формула 1+min(Σu×bonus,5)', () => {
    expect(compoundBonusMult({ steel: 1000 })).toBe(6);
    expect(compoundBonusMult({ steel: 2000 })).toBe(6);
    expect(compoundBonusMult({})).toBe(1);
    expect(compoundBonusMult({ steel: 200 })).toBe(2); // 1+200×0.005
    expect(compoundBonusMult({ relic: 10 })).toBe(2); // 1+10×0.1
    expect(fx.income.energyPerSec / 7).toBe(6);
  });
});

describe('доход: полный аудит ferrum (все 12, raw)', () => {
  const { game } = makeGame(31337);
  const rt = game.runtime('ferrum')!;
  for (const c of rt.data.cells) rt.explored.add(c.id);
  for (const c of rt.data.cells) {
    const st = rt.cellStates.get(c.id)!;
    if (c.type === 3) st.ironYield = 0.1;
    st.mutant = null; // мутант-эффекты — Этап 4; аудит raw
  }
  const { snapshot: inc } = game.income.computeIncome(game.activeRuntimes(), game.incomeContext());
  const fx = fixture<{ income: { energyPerSec: number; ironPerSec: number; planetIncome: { ferrum: { energyByType: Record<string, number> } } } }>('income_audit_v0.0.41.json');

  it('20⚡ = type0 7 + type1 3 + type2 10 (compound 1)', () => {
    expect(inc.energyPerSec).toBeCloseTo(20, 9);
    expect(inc.energyPerSec).toBeCloseTo(fx.income.energyPerSec, 9);
    const p = inc.byPlanet['ferrum']!;
    expect(p.energyByType[0]).toBeCloseTo(7, 9);
    expect(p.energyByType[1]).toBeCloseTo(3, 9);
    expect(p.energyByType[2]).toBeCloseTo(10, 9);
  });

  it('0.23⛏ = 2 жилы × 0.1 × 1.15', () => {
    expect(inc.ironPerSec).toBeCloseTo(0.23, 9);
    expect(inc.ironPerSec).toBeCloseTo(fx.income.ironPerSec, 9);
  });

  it('research: 7 type0 × 0.001 = 0.007 (кап 100)', () => {
    expect(inc.researchPerSec).toBeCloseTo(0.007, 12);
  });
});
