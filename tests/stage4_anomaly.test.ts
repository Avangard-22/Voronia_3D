/**
 * Этап 4 — аномалии type4: ветви (power/resonance/synth), fm-истощение, deep-конверсии, мутанты.
 * Золотые (fixtures/stage4_audit_v0.0.41.json §branches/§mutants/§deep):
 *   power: +4×(1+L)×dc ⚡/с (L0 → +4, L0 deep → +8, L3 → +16, L3 deep → +32);
 *   resonance: +0.005×(1+L)×dc 💎/с (.005/.01/.02/.04); synth: пассивного дохода нет;
 *   fm: power 0.7 / deep-power 0.5 (истощение жил); мутанты: ember ×1.5, rime ×0.8, shadow ×2 (depletion);
 *   nr: {iron 50×3^L×To(idx), energy 300×3^L×To(idx)}; tl: deep-конверсия 4800⚡+600⛏ (×1.2 ucm), maxLevel 5.
 */
import { describe, it, expect } from 'vitest';
import { makeGame, grant, fixture } from './helpers';
import { anomalyUpgradeCost } from '../src/economy/upgrades';
import { fmFor, branchOf } from '../src/planets/anomalies';
import { loadBalance } from '../src/config/loader';

interface Audit {
  branches: {
    income: Record<string, { energyPerSec: number; crystalsPerSec: number }>;
    delta_power_L0: number; delta_power_L3_deep: number;
    delta_reson_L0: number; delta_reson_L3_deep: number;
    fm_power: number; fm_power_deep: number; fm_resonance: number; fm_unexplored: number; fm_synth: number;
    Uo_default: string; Uo_type0: null;
  };
  mutants: { tb_base: number; ta_ember: number; ta_rime: number; ta_shadow: number; tb_withPowerAnomaly: number; tb_ratio_power: number; ex_byArm: Record<string, { id: string; yieldMult: number; depletionMult: number } | null> };
  deep: { fl: number; nr_table_idx1: { L: number; cost: { iron: number; energy: number } }[]; nr_idx5_L0: { iron: number; energy: number }; To_5: number; ucm: number; tl_steps: { before: { level: number; isDeep: boolean; energy: number; iron: number }; after: { level: number; isDeep: boolean; energy: number; iron: number }; energyDelta: number }[]; maxLevel: number };
}
const fx = fixture<Audit>('stage4_audit_v0.0.41.json');
const balance = loadBalance();

function setup(branch?: 'synth' | 'power' | 'resonance', level = 0, deep = false) {
  const { game } = makeGame(31337);
  const rt = game.runtime('ferrum')!;
  // база аудита (14 ⚡/с = type0 1 + type1 3 + type2 10): харнесс 1.x исследовал t1/t2
  const t1 = rt.data.cells.find((c) => c.type === 1)!;
  const t2 = rt.data.cells.find((c) => c.type === 2)!;
  rt.explored.add(t1.id);
  rt.explored.add(t2.id);
  const a4 = rt.data.cells.find((c) => c.type === 4)!;
  rt.explored.add(a4.id);
  const st = rt.cellStates.get(a4.id)!;
  st.level = level;
  st.isDeep = deep;
  if (branch) st.anomalyType = branch;
  return { game, rt, a4, st };
}

function inc(game: ReturnType<typeof makeGame>['game']) {
  const { snapshot } = game.income.computeIncome(game.activeRuntimes(), game.incomeContext());
  return snapshot;
}

describe('ветви аномалий: доход (аудит §branches.income)', () => {
  const cases: [string, 'synth' | 'power' | 'resonance', number, boolean][] = [
    ['synth_L0', 'synth', 0, false],
    ['power_L0', 'power', 0, false],
    ['resonance_L0', 'resonance', 0, false],
    ['synth_L0_deep', 'synth', 0, true],
    ['power_L0_deep', 'power', 0, true],
    ['resonance_L0_deep', 'resonance', 0, true],
    ['synth_L3', 'synth', 3, false],
    ['power_L3', 'power', 3, false],
    ['resonance_L3', 'resonance', 3, false],
    ['synth_L3_deep', 'synth', 3, true],
    ['power_L3_deep', 'power', 3, true],
    ['resonance_L3_deep', 'resonance', 3, true],
  ];
  for (const [key, branch, level, deep] of cases) {
    it(`${key}: энергия/кристаллы — байт-в-байт с 1.x`, () => {
      const { game } = setup(branch, level, deep);
      const s = inc(game);
      expect(s.energyPerSec).toBeCloseTo(fx.branches.income[key]!.energyPerSec, 9);
      expect(s.crystalsPerSec).toBeCloseTo(fx.branches.income[key]!.crystalsPerSec, 12);
    });
  }

  it('дельты: power +4/+32(L3 deep), resonance +.005/+.04 — формулы 4×(1+L)×dc и .005×(1+L)×dc', () => {
    const dP0 = fx.branches.income['power_L0']!.energyPerSec - fx.branches.income['synth_L0']!.energyPerSec;
    expect(dP0).toBeCloseTo(fx.branches.delta_power_L0, 9);
    expect(fx.branches.delta_power_L3_deep).toBeCloseTo(32, 9);
    expect(fx.branches.delta_reson_L0).toBeCloseTo(0.005, 12);
    expect(fx.branches.delta_reson_L3_deep).toBeCloseTo(0.04, 12);
  });

  it('Uo: дефолт ветви synth, не-type4 → null', () => {
    const { rt, a4, st } = setup();
    st.anomalyType = null;
    expect(branchOf(rt.data.cells[a4.id], st)).toBe(fx.branches.Uo_default);
    const t0 = rt.data.cells.find((c) => c.type === 0)!;
    expect(branchOf(t0, rt.cellStates.get(t0.id))).toBeNull();
    st.anomalyType = 'power';
    expect(branchOf(rt.data.cells[a4.id], st)).toBe('power');
  });
});

describe('выбор ветви (1.x um → команда chooseAnomalyBranch)', () => {
  it('не-type4 → "type"; неисследованная → "state"; успех → событие + повтор → "state"', () => {
    const { game, rt, a4 } = setup();
    const t0 = rt.data.cells.find((c) => c.type === 0)!;
    const r0 = game.dispatch('chooseAnomalyBranch', { pid: 'ferrum', cellId: t0.id, branch: 'power' });
    expect(r0.ok).toBe(false);
    if (!r0.ok) expect(r0.reason).toBe('type');
    rt.explored.delete(a4.id);
    const ru = game.dispatch('chooseAnomalyBranch', { pid: 'ferrum', cellId: a4.id, branch: 'power' });
    expect(ru.ok).toBe(false);
    if (!ru.ok) expect(ru.reason).toBe('state');
    rt.explored.add(a4.id);
    const r1 = game.dispatch('chooseAnomalyBranch', { pid: 'ferrum', cellId: a4.id, branch: 'resonance' });
    expect(r1.ok).toBe(true);
    if (r1.ok) expect(r1.value.branch).toBe('resonance');
    expect(rt.cellStates.get(a4.id)!.anomalyType).toBe('resonance');
    const ev = game.bus.getHistory().filter((e) => e.type === 'cell:branchChosen');
    expect(ev.length).toBe(1);
    const r2 = game.dispatch('chooseAnomalyBranch', { pid: 'ferrum', cellId: a4.id, branch: 'power' });
    expect(r2.ok).toBe(false);
    if (!r2.ok) expect(r2.reason).toBe('state');
    const r3 = game.dispatch('chooseAnomalyBranch', { pid: 'ferrum', cellId: a4.id, branch: 'nope' });
    expect(r3.ok).toBe(false);
    if (!r3.ok) expect(r3.reason).toBe('type');
  });
});

describe('fm(): множитель истощения от power-аномалий (аудит §branches.fm*, §mutants)', () => {
  it('power 0.7, deep-power 0.5, resonance/synth/неисследованная 1', () => {
    const { game, rt, a4, st } = setup('power');
    expect(fmFor(rt)).toBe(fx.branches.fm_power);
    st.isDeep = true;
    expect(fmFor(rt)).toBe(fx.branches.fm_power_deep);
    st.anomalyType = 'resonance';
    expect(fmFor(rt)).toBe(fx.branches.fm_resonance);
    rt.explored.delete(a4.id);
    expect(fmFor(rt)).toBe(fx.branches.fm_unexplored);
    rt.explored.add(a4.id);
    st.anomalyType = 'synth';
    st.isDeep = false;
    expect(fmFor(rt)).toBe(fx.branches.fm_synth);
    // истощение жилы: 0.056 → ×0.7 при power
    const v3 = rt.data.cells.find((c) => c.type === 3)!;
    rt.explored.add(v3.id);
    const vst = rt.cellStates.get(v3.id)!;
    vst.ironYield = 0.1;
    vst.mutant = null;
    st.anomalyType = 'synth';
    expect(game.production.depletePerSec(rt, v3.id)).toBeCloseTo(fx.mutants.tb_base, 12);
    st.anomalyType = 'power';
    expect(game.production.depletePerSec(rt, v3.id)).toBeCloseTo(fx.mutants.tb_withPowerAnomaly, 12);
    expect(game.production.depletePerSec(rt, v3.id) / fx.mutants.tb_base).toBeCloseTo(fx.mutants.tb_ratio_power, 12);
  });

  it('мутанты: ember ×1.5, rime ×0.8, shadow ×2 к истощению (аудит ta_*)', () => {
    const { game, rt } = setup();
    const v3 = rt.data.cells.find((c) => c.type === 3)!;
    rt.explored.add(v3.id);
    const vst = rt.cellStates.get(v3.id)!;
    vst.ironYield = 0.1;
    vst.mutant = 'ember';
    expect(game.production.depletePerSec(rt, v3.id)).toBeCloseTo(fx.mutants.ta_ember, 12);
    vst.mutant = 'rime';
    expect(game.production.depletePerSec(rt, v3.id)).toBeCloseTo(fx.mutants.ta_rime, 12);
    vst.mutant = 'shadow';
    expect(game.production.depletePerSec(rt, v3.id)).toBeCloseTo(fx.mutants.ta_shadow, 12);
    vst.mutant = null;
  });

  it('mutant yieldMult в доходе жилы: ember ×1.5 к ⛏/с', () => {
    const { game, rt } = setup();
    const v3 = rt.data.cells.find((c) => c.type === 3)!;
    rt.explored.add(v3.id);
    const vst = rt.cellStates.get(v3.id)!;
    vst.ironYield = 0.1;
    vst.mutant = null;
    const base = inc(game).ironPerSec;
    vst.mutant = 'ember';
    expect(inc(game).ironPerSec).toBeCloseTo(base * fx.mutants.ex_byArm['forge']!.yieldMult, 12);
    vst.mutant = 'rime';
    expect(inc(game).ironPerSec).toBeCloseTo(base * fx.mutants.ex_byArm['frost']!.yieldMult, 12);
    vst.mutant = null;
  });

  it('таблица мутантов по рукавам (registry planet.mutants = 1.x su)', () => {
    expect(balance.registry.planet.mutants['forge']!.id).toBe(fx.mutants.ex_byArm['forge']!.id);
    expect(balance.registry.planet.mutants['core']!.id).toBe('prime');
    expect(balance.registry.planet.mutants['unknown']).toBeUndefined();
    expect(fx.mutants.ex_byArm['unknown']).toBeNull();
    for (const arm of ['forge', 'frost', 'life', 'void', 'core']) {
      expect(balance.registry.planet.mutants[arm]!.yieldMult).toBe(fx.mutants.ex_byArm[arm]!.yieldMult);
      expect(balance.registry.planet.mutants[arm]!.depletionMult).toBe(fx.mutants.ex_byArm[arm]!.depletionMult);
    }
  });
});

describe('deep: nr-цены, tl-апгрейд аномалии, конверсия (аудит §deep)', () => {
  it('nr(L, idx1) = {50×3^L, 300×3^L}; To(5)=1.8225 → {91, 547}', () => {
    for (const row of fx.deep.nr_table_idx1) {
      expect(anomalyUpgradeCost(balance, row.L, 1)).toEqual(row.cost);
    }
    expect(anomalyUpgradeCost(balance, 0, 5)).toEqual(fx.deep.nr_idx5_L0);
    expect(Math.pow(1.35, 2)).toBeCloseTo(fx.deep.To_5, 12);
    expect(balance.registry.transport.config.maxLevel).toBe(fx.deep.maxLevel);
  });

  it('tl-паразит: 5 апгрейдов (300/900/2700/8100/24300⚡ + 60/180/540/1620/4860⛏) и deep-конверсия 4800⚡+600⛏', () => {
    const { game, rt, a4, st } = setup('power');
    grant(game, { energy: 1_000_000, iron: 1_000_000, kriogen: 1_000_000 });
    expect(fx.deep.ucm).toBe(1.2); // «Мёрзлый» ferrum
    const energyBefore = game.ledger.balance('energy');
    const ironBefore = game.ledger.balance('iron');
    let e = energyBefore;
    let ir = ironBefore;
    for (let k = 0; k < 5; k++) {
      const r = game.dispatch('upgradeAnomalyCell', { pid: 'ferrum', cellId: a4.id });
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      expect(r.value.level).toBe(k + 1);
      expect(r.value.deepConverted).toBe(false);
      const step = fx.deep.tl_steps[k]!;
      expect(step.energyDelta).toBe(r.value.cost['energy']);
      e -= r.value.cost['energy']!;
      ir -= r.value.cost['iron']!;
      expect(game.ledger.balance('energy')).toBeCloseTo(e, 6);
      expect(game.ledger.balance('iron')).toBeCloseTo(ir, 6);
    }
    expect(st.level).toBe(5);
    // 6-й вызов: deep-конверсия
    const rd = game.dispatch('upgradeAnomalyCell', { pid: 'ferrum', cellId: a4.id });
    expect(rd.ok).toBe(true);
    if (!rd.ok) return;
    expect(rd.value.deepConverted).toBe(true);
    expect(rd.value.cost['energy']).toBe(4800); // round(4000×1.2)
    expect(rd.value.cost['iron']).toBe(600); // round(500×1.2)
    expect(st.isDeep).toBe(true);
    expect(game.session().deepMined).toBe(1);
    const last = fx.deep.tl_steps[5]!;
    expect(last.after.isDeep).toBe(true);
    expect(last.before.energy - last.after.energy).toBe(4800);
    // 7-й → 'max'
    const rm = game.dispatch('upgradeAnomalyCell', { pid: 'ferrum', cellId: a4.id });
    expect(rm.ok).toBe(false);
    if (!rm.ok) expect(rm.reason).toBe('max');
    void rt;
  });

  it('отказы: не-type4 → "type", недостаточно ресурсов → "cost"/"energy"', () => {
    const { game, rt, a4 } = setup();
    const t0 = rt.data.cells.find((c) => c.type === 0)!;
    const r0 = game.dispatch('upgradeAnomalyCell', { pid: 'ferrum', cellId: t0.id });
    expect(r0.ok).toBe(false);
    if (!r0.ok) expect(r0.reason).toBe('type');
    const r1 = game.dispatch('upgradeAnomalyCell', { pid: 'ferrum', cellId: a4.id });
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(['cost', 'energy']).toContain(r1.reason);
  });

  it('обычная клетка: L8 → isDeep (b0), доход ×2 и +0.05💎/с (type0-deep)', () => {
    const { game } = makeGame(31337);
    grant(game, { energy: 1e9, iron: 1e9 });
    const rt = game.runtime('ferrum')!;
    const c0 = rt.data.cells.find((c) => c.type === 0 && rt.explored.has(c.id))!;
    const st0 = rt.cellStates.get(c0.id)!;
    expect(balance.registry.cells.deepLevelThreshold).toBe(fx.deep.fl);
    for (let k = 0; k < 8; k++) {
      const r = game.dispatch('upgradeCell', { pid: 'ferrum', cellId: c0.id });
      expect(r.ok).toBe(true);
    }
    expect(st0.level).toBe(8);
    expect(st0.isDeep).toBe(true);
    expect(game.session().deepMined).toBe(1);
    const s = inc(game);
    // (1+8)×2 = 18 ⚡ от клетки (deepMult Ws=2) + кристалл 0.05/с
    expect(s.crystalsPerSec).toBeCloseTo(0.05, 12);
    expect(s.energyPerSec).toBeGreaterThanOrEqual(18);
  });
});
