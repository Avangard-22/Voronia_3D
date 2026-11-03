/**
 * Жилы (fixtures/veins_audit_v0.0.41.json): истощение 0.056/с, кулдаун 300000+150000n (кап 1.8M/20),
 * реактивация 65/101/136/172⚡ (Xs=min(14,1+0.55n)), guards cooldown/type/state, резерв → maxReserve.
 * Криоген-анлок: Kt('kriogen') = unlock_kriogenBoost.
 */
import { describe, it, expect } from 'vitest';
import { makeGame, grant, advance, fixture } from './helpers';
import { veinLevelDepleteMult, planetIndexDepleteMult } from '../src/economy/production';
import { TechState } from '../src/progression/tech';
import { loadBalance } from '../src/config/loader';

function scannedVeinGame() {
  const { game } = makeGame(999);
  grant(game, { energy: 1000 });
  game.dispatch('scanCell', { pid: 'ferrum', cellId: 1 });
  return game;
}

describe('жилы: истощение', () => {
  const balance = loadBalance();

  it('ta = 0.1 × 0.8 (рукав core) × 0.7 («Мёрзлый») = 0.056/с', () => {
    const game = scannedVeinGame();
    const rt = game.runtime('ferrum')!;
    const fx = fixture<{ veins: { id: number; depletePerSec_ta: number }[] }>('veins_audit_v0.0.41.json');
    const expected = fx.veins.find((v) => v.id === 1)!.depletePerSec_ta;
    expect(game.production.depletePerSec(rt, 1)).toBeCloseTo(expected, 12);
    expect(game.production.depletePerSec(rt, 1)).toBeCloseTo(0.056, 12);
  });

  it('тик 500 мс: резерв −0.028 (parity tickLog)', () => {
    const game = scannedVeinGame();
    const rt = game.runtime('ferrum')!;
    advance(game, 1, 500);
    expect(rt.cellStates.get(1)!.reserve).toBeCloseTo(125.972, 9);
    advance(game, 1, 500);
    expect(rt.cellStates.get(1)!.reserve).toBeCloseTo(125.944, 9);
  });

  it('полное истощение: reserve→0, cooldownUntil = gameMs+300000, reactCount 1, событие cell:depleted', () => {
    const game = scannedVeinGame();
    const rt = game.runtime('ferrum')!;
    const depleted: number[] = [];
    game.bus.on('cell:depleted', (p) => depleted.push(p.cellId));
    // 126 / 0.056 = 2250 с ≈ 4500 тиков по 500 мс (+запас на float-дрейф)
    advance(game, 4520, 500);
    const st = rt.cellStates.get(1)!;
    expect(st.reserve).toBe(0);
    expect(st.reactCount).toBe(1);
    expect(Math.abs(st.cooldownUntil - (game.clock.gameMsNow + 300000))).toBeLessThanOrEqual(20 * 500);
    expect(depleted).toEqual([1]);
    // доход жилы остановлен
    const { snapshot: inc } = game.income.computeIncome(game.activeRuntimes(), game.incomeContext());
    expect(inc.ironPerSec).toBe(0);
  });

  it('кулдаун: 300000+150000×n, кап registry (1.8M при n≥20)', () => {
    const game = scannedVeinGame();
    const rt = game.runtime('ferrum')!;
    const st = rt.cellStates.get(1)!;
    st.reactCount = 0;
    expect(game.production.cooldownMs(st)).toBe(300000);
    st.reactCount = 1;
    expect(game.production.cooldownMs(st)).toBe(450000);
    st.reactCount = 3;
    expect(game.production.cooldownMs(st)).toBe(750000);
    st.reactCount = 20;
    expect(game.production.cooldownMs(st)).toBe(1800000);
    st.reactCount = 50;
    expect(game.production.cooldownMs(st)).toBe(1800000);
    st.reactCount = 0;
  });

  it('l1 = 1+max(0,L−9)×0.07; Wr(idx=1) = 1', () => {
    expect(veinLevelDepleteMult({ level: 9 } as never)).toBe(1);
    expect(veinLevelDepleteMult({ level: 12 } as never)).toBeCloseTo(1.21, 12);
    expect(planetIndexDepleteMult(balance, 1)).toBe(1);
    expect(planetIndexDepleteMult(balance, 5)).toBe(1); // start 3 + offset 2
    expect(planetIndexDepleteMult(balance, 7)).toBeCloseTo(1.14, 12);
  });
});

describe('жилы: реактивация', () => {
  it('цены 65/101/136/172⚡ при reactCount 0/1/2/3 (×1.2 «Мёрзлый»)', () => {
    const game = scannedVeinGame();
    const rt = game.runtime('ferrum')!;
    const st = rt.cellStates.get(1)!;
    const costs: number[] = [];
    for (const rc of [0, 1, 2, 3]) {
      st.reactCount = rc;
      costs.push(game.production.reactivationCost(rt, 1));
    }
    expect(costs).toEqual([65, 101, 136, 172]);
  });

  it('Xs = min(14, 1+0.55n): n=0→1, n=24→14 (кап)', () => {
    const game = scannedVeinGame();
    const st = game.runtime('ferrum')!.cellStates.get(1)!;
    st.reactCount = 0;
    expect(game.production.reactYieldMult(st)).toBe(1);
    st.reactCount = 24;
    expect(game.production.reactYieldMult(st)).toBe(14);
  });

  it('guard "cooldown" пока не истёк; после — списание энергии, reserve=maxReserve, cooldown сбрасывается', () => {
    const game = scannedVeinGame();
    const rt = game.runtime('ferrum')!;
    const st = rt.cellStates.get(1)!;
    // истощаем
    advance(game, 4500, 500);
    expect(st.reserve).toBe(0);
    const early = game.dispatch('reactivateCell', { pid: 'ferrum', cellId: 1 });
    expect(early.ok).toBe(false);
    if (!early.ok) expect(early.reason).toBe('cooldown');
    // мотаем кулдаун (300 с = 600 тиков по 500 мс)
    advance(game, 601, 500);
    grant(game, { energy: 1000 });
    const e0 = game.ledger.balance('energy');
    const res = game.dispatch('reactivateCell', { pid: 'ferrum', cellId: 1 });
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.cost).toBe(101); // reactCount=1 после истощения
    expect(game.ledger.balance('energy')).toBeCloseTo(e0 - 101, 9);
    expect(st.reserve).toBe(st.maxReserve);
    expect(st.cooldownUntil).toBe(0);
  });

  it('guards: не-жила → "type"; неисследованная → "state"; нет энергии → "energy"', () => {
    const game = scannedVeinGame();
    const t = game.dispatch('reactivateCell', { pid: 'ferrum', cellId: 0 });
    expect(t.ok).toBe(false);
    if (!t.ok) expect(t.reason).toBe('type');
    const s = game.dispatch('reactivateCell', { pid: 'ferrum', cellId: 10 });
    expect(s.ok).toBe(false);
    if (!s.ok) expect(s.reason).toBe('state');
    // гасим резерв и сбрасываем cooldown (короткий путь: guard именно на энергии)
    const rt = game.runtime('ferrum')!;
    const st = rt.cellStates.get(1)!;
    st.reserve = 0;
    st.cooldownUntil = 0;
    const bal = game.ledger.balance('energy');
    grant(game, { energy: -bal });
    const e = game.dispatch('reactivateCell', { pid: 'ferrum', cellId: 1 });
    expect(e.ok).toBe(false);
    if (!e.ok) expect(e.reason).toBe('energy');
  });
});

describe('Kt/gt: анлоки жил', () => {
  const balance = loadBalance();

  it('iron открыт всегда; kriogen — за unlock_kriogenBoost', () => {
    const tech = new TechState(balance.registry.tech);
    expect(tech.isUnlocked('iron')).toBe(true);
    expect(tech.isUnlocked('kriogen')).toBe(false);
    tech.setResearch('unlock_kriogenBoost', 1);
    expect(tech.isUnlocked('kriogen')).toBe(true);
    expect(tech.isUnlocked('carbon')).toBe(false);
    tech.setResearch('unlock_carbon', 1);
    expect(tech.isUnlocked('carbon')).toBe(true);
  });

  it('costScaleMult: fresh → costScaleCurve[0] = 1.15', () => {
    const tech = new TechState(balance.registry.tech);
    expect(tech.costScaleMult()).toBe(1.15);
  });

  it('запертая жила не истощается и не даёт доход', () => {
    const game = scannedVeinGame();
    const rt = game.runtime('ferrum')!;
    // превращаем cell1 в криогеновую жилу (структурная проверка gating)
    const st = rt.cellStates.get(1)!;
    st.kriogenYield = 0.1;
    st.ironYield = 0;
    (rt.data.cells[1] as { type: number }).type = 5;
    advance(game, 10, 500);
    expect(st.reserve).toBe(126); // не истощается — kriogen заперт
    const { snapshot: inc } = game.income.computeIncome(game.activeRuntimes(), game.incomeContext());
    expect(inc.kriogenPerSec).toBe(0);
  });
});
