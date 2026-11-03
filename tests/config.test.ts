/**
 * GS-12 + STAGE1 §1: реестр/baseline — значения сверяются с fixtures (runtime-извлечение v0.0.41),
 * loader fail-fast на битых данных (список проблемных путей).
 */
import { describe, it, expect } from 'vitest';
import { loadBalance, validateRegistry, validateBaseline, BalanceValidationError } from '../src/config/loader';
import { fixture } from './helpers';

describe('config: реестр v0.0.41 (GS-12)', () => {
  const balance = loadBalance();
  const reg = balance.registry;

  it('bus.historyCap = 50', () => {
    expect(reg.bus.historyCap).toBe(50);
  });

  it('склад: baseTons 10, tonsPerLevel 5, bonusPerLevel 0.05, energy 800×1.6^L, alloy (L+1)², cap 10', () => {
    expect(reg.warehouse).toMatchObject({ baseTons: 10, tonsPerLevel: 5, bonusPerLevel: 0.05, energyCostBase: 800, energyCostGrowth: 1.6, alloyCostFactor: 2, upgradeMax: 10 });
  });

  it('cells: curveGrowth 1.13, cap 25, afterCap 1.025, deepLevelThreshold 8, researchMaxLevel 15', () => {
    expect(reg.cells.curveGrowth).toBe(1.13);
    expect(reg.cells.curveGrowthCap).toBe(25);
    expect(reg.cells.curveGrowthAfterCap).toBe(1.025);
    expect(reg.cells.deepLevelThreshold).toBe(8);
    expect(reg.cells.researchMaxLevel).toBe(15);
  });

  it('cells.upgradeCurve — 20 записей, L0 {e:0,a:10}, L5 {e:2500,a:230} (fixtures/gs04)', () => {
    const curve = reg.cells.upgradeCurve;
    expect(curve).toHaveLength(20);
    expect(curve[0]).toMatchObject({ e: 0, a: 10, b: 0, g: 0, x: 0 });
    expect(curve[5]).toMatchObject({ e: 2500, a: 230, b: 80 });
    const fx = fixture<{ baseCurve_g0: { level: number; e: number; a: number }[] }>('gs04_upgrade_curve.json');
    for (let L = 0; L < 20; L++) {
      expect(curve[L]?.e).toBe(fx.baseCurve_g0[L]?.e);
      expect(curve[L]?.a).toBe(fx.baseCurve_g0[L]?.a);
    }
  });

  it('react-cooldowns: 300000 + 150000×n, cap 1800000/20 (fixtures/veins_audit)', () => {
    expect(reg.cells.reactCooldownBaseMs).toBe(300000);
    expect(reg.cells.reactCooldownPerCntMs).toBe(150000);
    expect(reg.cells.reactCooldownMaxMs).toBe(1800000);
    expect(reg.cells.reactCooldownCntCap).toBe(20);
  });

  it('dispatch batch 50/50 (кап research на планету = 50+50×idx)', () => {
    expect(reg.dispatch).toMatchObject({ batchEnergy: 50, batchIron: 50 });
  });

  it('galaxy.arms: 4 рукава, b 0.55, r0 3.5, width 3.2', () => {
    expect(reg.galaxy.arms).toMatchObject({ arms: 4, b: 0.55, r0: 3.5, width: 3.2 });
  });

  it('tech.costScaleCurve[0] = 1.15 (live-рост цены скана fresh)', () => {
    expect(reg.tech.costScaleCurve.costScale[0]).toBe(1.15);
  });

  it('planet: biomeMults ferrum 1 / krios 0.6; mutants core → prime (×1.4/×1.2)', () => {
    expect(reg.planet.biomeMults['ferrum']).toMatchObject({ mult: 1 });
    expect(reg.planet.biomeMults['krios']).toMatchObject({ mult: 0.6 });
    expect(reg.planet.mutants['core']).toMatchObject({ id: 'prime', yieldMult: 1.4, depletionMult: 1.2 });
  });

  it('offline: maxSeconds/efficiency присутствуют', () => {
    expect(reg.offline.maxSeconds).toBeGreaterThan(0);
    expect(reg.offline.efficiency).toBeGreaterThan(0);
  });

  it('baseline: скан 10, рост [1.03,1.3], ×0.9 core; аномалия +1000⚡/+50⛏/10..24🔬', () => {
    const b = balance.baseline;
    expect(b.scan.baseCost).toBe(10);
    expect(b.scan.growthMin).toBe(1.03);
    expect(b.scan.growthMax).toBe(1.3);
    expect(b.scan.chargeDiscountCoreArm).toBe(0.9);
    expect(b.anomaly).toMatchObject({ energyInstantReward: 1000, ironInstantReward: 50, scienceRandomMin: 10, scienceRandomSpan: 15 });
    expect(b.upgrade.maxLevel).toBe(100);
    expect(b.veins.baseIronYieldOnScan).toBe(0.1);
  });

  it('baseline.galaxy.arms — полная таблица рукавов (fixtures/galaxy_arms_full)', () => {
    const fx = fixture<Record<string, unknown>>('galaxy_arms_full.json');
    const arms = balance.baseline.galaxy.arms;
    const core = fx['core_Df'] as Record<string, unknown>;
    expect(arms['core']).toMatchObject({ scan: core['scan'], deplete: core['deplete'], event: core['event'] });
    for (const id of ['forge', 'frost', 'life', 'void']) {
      const spiral = (fx['spiral_Lr'] as Record<string, unknown>[]).find((a) => a['id'] === id);
      expect(arms[id]?.energy).toBe(spiral?.['energy']);
      expect(arms[id]?.scan).toBe(spiral?.['scan']);
    }
  });

  it('fail-fast: битый реестр → BalanceValidationError со списком путей', () => {
    const broken = JSON.parse(JSON.stringify(loadBalance().registry.raw)) as Record<string, unknown>;
    delete broken['warehouse'];
    const problems = validateRegistry(broken);
    expect(problems.length).toBeGreaterThan(0);
    expect(problems.some((p) => p.path.startsWith('warehouse.'))).toBe(true);
  });

  it('fail-fast: битый baseline → список проблем', () => {
    const problems = validateBaseline({ scan: {}, upgrade: { baseCurve: [] } });
    expect(problems.length).toBeGreaterThan(0);
  });

  it('BalanceValidationError содержит все проблемы одним списком', () => {
    const err = new BalanceValidationError([
      { path: 'a.b', problem: 'x' },
      { path: 'c', problem: 'y' },
    ]);
    expect(err.message).toContain('a.b');
    expect(err.message).toContain('c');
    expect(err.problems).toHaveLength(2);
  });
});
