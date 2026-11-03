/**
 * Этап 4 — заряды жил type1/2 (fixtures/stage4_audit_v0.0.41.json §discharge/§s0/§chargeKrios/§surge):
 * порт i0()/s0()/a0()/ll() + авто-surge v0.0.39.0 → ChargeService (economy/charge.ts).
 * Золотые: pct-стек .03→.25 (cap), mult соседа 1.15, dur 20+5s, science 5/15×mult, sonar-кап 3,
 * s0 ×1.11 в энергии (14→15.54), chargeScience ×1.2 в науке (.001→.0012), surge pct .0195 = .03×.65.
 */
import { describe, it, expect } from 'vitest';
import { makeGame, fixture, advance } from './helpers';
import { ChargeService } from '../src/economy/charge';
import { ResourceLedger } from '../src/economy/ledger';
import { EventBus } from '../src/core/eventBus';
import { Rng } from '../src/core/rng';
import { loadBalance } from '../src/config/loader';
import { buildCatalog } from '../src/planets/catalog';
import { createPlanetRuntime } from '../src/planets/runtime';
import type { PlanetRuntime } from '../src/contracts/planets';

interface Audit {
  discharge: { first: { pct: number; pctTotal: number; dur: number; mult: number; leftSec: number }; type2: { pct: number; pctTotal: number }; type2_sonarDelta: number };
  s0: { mult_active: number; energyPerSec_buffed: number; energyPerSec_clean: number; ratio_energy: number; researchPerSec_buffed: number; researchPerSec_clean: number; breakdown_buffed: { perPlanet: { ferrum: { boost: number } } } };
  chargeKrios: { sequence: { pctTotal: number; atCap: boolean }[]; buffAfterSequence: { pct: number; sciencePct: number }; s0_krios: number; sonar: { gained: boolean }[]; neighborTest: { result: { neighbors: number; mult: number; pct: number; dur: number } } };
  surge: { triggered: { surgeUntil: number; chargedAt: number; chargeCooldown: number; buffs: { ferrum: { pct: number } } } };
}
const fx = fixture<Audit>('stage4_audit_v0.0.41.json');

function makeEnv(pid: 'ferrum' | 'krios' = 'krios') {
  const balance = loadBalance();
  const bus = new EventBus({ historyCap: balance.registry.bus.historyCap });
  const ledger = new ResourceLedger(bus);
  let now = 1_000_000;
  let sonar = 0;
  const svc = new ChargeService({
    balance,
    ledger,
    bus,
    gameMs: () => now,
    addSonarCharge: () => {
      if (sonar >= balance.registry.sonar.chargeMax) return false;
      sonar += 1;
      return true;
    },
  });
  const rt: PlanetRuntime = createPlanetRuntime(buildCatalog().get(pid)!);
  return {
    balance, bus, ledger, svc, rt,
    now: () => now,
    setNow: (v: number) => { now = v; },
    advance: (ms: number) => { now += ms; },
    sonar: () => sonar,
    cellsOfType: (t: number) => rt.data.cells.filter((c) => c.type === t && !rt.cellStates.get(c.id)?.destroyed),
  };
}

describe('заряды: одиночный разряд и отказы (1.x i0)', () => {
  const env = makeEnv('ferrum');
  const t1 = env.cellsOfType(1)[0]!;
  const t2 = env.cellsOfType(2)[0]!;
  const t0 = env.cellsOfType(0)[0]!;

  it('отказ type0 → reason "type"', () => {
    const r = env.svc.discharge(env.rt, t0.id);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toBe('type');
  });

  it('неисследованная → reason "state" (1.x "unexplored" → закрытый набор 2.0)', () => {
    const r = env.svc.discharge(env.rt, t1.id);
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.reason).toBe('state'); expect(r.detail).toBe('unexplored'); }
  });

  it('разрушенная → reason "state" (1.x "destroyed")', () => {
    env.rt.explored.add(t1.id);
    const st = env.rt.cellStates.get(t1.id)!;
    st.destroyed = true;
    const r = env.svc.discharge(env.rt, t1.id);
    st.destroyed = false;
    expect(r.ok).toBe(false);
    if (!r.ok) { expect(r.reason).toBe('state'); expect(r.detail).toBe('destroyed'); }
  });

  it('первый разряд: pct .03, dur 20, mult 1, leftSec 45, science +5 (аудит §discharge.first)', () => {
    const r = env.svc.discharge(env.rt, t1.id);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.pct).toBeCloseTo(fx.discharge.first.pct, 12);
    expect(r.value.pctTotal).toBeCloseTo(fx.discharge.first.pctTotal, 12);
    expect(r.value.dur).toBe(fx.discharge.first.dur);
    expect(r.value.mult).toBe(fx.discharge.first.mult);
    expect(r.value.leftSec).toBe(fx.discharge.first.leftSec);
    expect(r.value.science).toBe(5);
    expect(r.value.sonarChargeGained).toBe(false);
    expect(env.ledger.balance('research')).toBeCloseTo(5, 9);
  });

  it('кулдаун 45с: повтор → reason "cooldown", после 46с — снова ok (бафф истёк → pct сбрасывается)', () => {
    const cd = env.svc.discharge(env.rt, t1.id);
    expect(cd.ok).toBe(false);
    if (!cd.ok) expect(cd.reason).toBe('cooldown');
    env.advance(46_000);
    const r = env.svc.discharge(env.rt, t1.id);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.pctTotal).toBeCloseTo(0.03, 12);
  });

  it('type2: pct .08, стек .03+.08=.11, science +15, sonar +1 (аудит §discharge.type2)', () => {
    env.rt.explored.add(t2.id);
    env.advance(1_000); // бафф type1 ещё активен (until = t0+46s+20s)
    const before = env.ledger.balance('research');
    const r = env.svc.discharge(env.rt, t2.id);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.pct).toBeCloseTo(fx.discharge.type2.pct, 12);
    expect(r.value.pctTotal).toBeCloseTo(fx.discharge.type2.pctTotal, 12);
    expect(r.value.science).toBe(15);
    expect(r.value.sonarChargeGained).toBe(true);
    expect(env.sonar()).toBe(fx.discharge.type2_sonarDelta);
    expect(env.ledger.balance('research') - before).toBeCloseTo(15, 9);
    // sciencePct-стек: .05+.15=.2 (аудит buffsAfterType2)
    expect(env.svc.scienceBoostFor('ferrum')).toBeCloseTo(1.2, 12);
  });

  it('событие шины cell:discharged (имя 1.x) c science/buffPct', () => {
    const h = env.bus.getHistory().filter((e) => e.type === 'cell:discharged');
    expect(h.length).toBeGreaterThan(0);
    const d = h[h.length - 1]!.detail as { pid: string; type: number; science: number; buffPct: number };
    expect(d.pid).toBe('ferrum');
    expect(d.type).toBe(2);
    expect(d.science).toBe(15);
    expect(d.buffPct).toBeCloseTo(0.15, 12);
  });
});

describe('заряды: соседи, стек до капа, sonar-кап (аудит §chargeKrios)', () => {
  const env = makeEnv('krios');
  const t1s = env.cellsOfType(1);
  const t2s = env.cellsOfType(2);
  for (const c of [...t1s, ...t2s]) env.rt.explored.add(c.id);

  it('9 последовательных разрядов type1: стек .03→.25, atCap на 9-м, s0=1.25, sciencePct .45', () => {
    const totals: number[] = [];
    let atCapSeen = false;
    for (const c of t1s) {
      const r = env.svc.discharge(env.rt, c.id);
      expect(r.ok).toBe(true);
      if (!r.ok) return;
      totals.push(r.value.pctTotal);
      if (r.value.atCap) atCapSeen = true;
    }
    expect(totals.map((v) => Math.round(v * 100))).toEqual(fx.chargeKrios.sequence.map((s) => Math.round(s.pctTotal * 100)));
    expect(atCapSeen).toBe(true);
    expect(totals[totals.length - 1]).toBeCloseTo(0.25, 9);
    expect(env.svc.multFor('krios')).toBeCloseTo(fx.chargeKrios.s0_krios, 12);
    // scienceCap .5 не достигнут: 9×.05 = .45
    expect(env.svc.scienceBoostFor('krios')).toBeCloseTo(1 + fx.chargeKrios.buffAfterSequence.sciencePct, 9);
    expect(env.ledger.balance('research')).toBeCloseTo(45, 9);
  });

  it('sonar-кап 3 (registry sonar.chargeMax): 4 разряда type2 → gained true×3, false', () => {
    const gained: boolean[] = [];
    for (const c of t2s) {
      const r = env.svc.discharge(env.rt, c.id);
      expect(r.ok).toBe(true);
      if (r.ok) gained.push(r.value.sonarChargeGained);
    }
    expect(gained).toEqual([true, true, true, false]);
    expect(env.sonar()).toBe(3);
  });

  it('сосед того же типа: mult=min(2,1+.15×1)=1.15, dur 25, pct .0345 (аудит neighborTest)', () => {
    env.advance(200_000); // кулдауны/бафф истекли
    const anchor = t1s[0]!;
    const nbId = anchor.neighbors.find((id) => env.rt.data.cells[id]?.type === 0);
    expect(nbId).toBeDefined();
    const nbNode = env.rt.data.cells[nbId!]!;
    (nbNode as { type: number }).type = 1; // harness-мутация как в аудите
    env.rt.explored.add(nbId!);
    const r = env.svc.discharge(env.rt, anchor.id);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value.neighbors).toBe(fx.chargeKrios.neighborTest.result.neighbors);
    expect(r.value.mult).toBeCloseTo(fx.chargeKrios.neighborTest.result.mult, 12);
    expect(r.value.pct).toBeCloseTo(fx.chargeKrios.neighborTest.result.pct, 12);
    expect(r.value.dur).toBe(fx.chargeKrios.neighborTest.result.dur);
    expect(r.value.science).toBe(6); // round(5×1.15)
    (nbNode as { type: number }).type = 0;
  });

  it('a0/ll: статус null после истечения + cleanup; multFor → 1', () => {
    env.advance(200_000);
    expect(env.svc.status('krios')).toBeNull();
    env.svc.cleanup();
    expect(env.svc.buffsSnapshot().has('krios')).toBe(false);
    expect(env.svc.multFor('krios')).toBe(1);
  });
});

describe('заряды в Game: s0 в цепи энергии, chargeScience в науке (аудит §s0)', () => {
  const { game } = makeGame(31337);
  const rt = game.runtime('ferrum')!;
  const t1 = rt.data.cells.find((c) => c.type === 1)!;
  const t2 = rt.data.cells.find((c) => c.type === 2)!;
  rt.explored.add(t1.id);
  rt.explored.add(t2.id);

  it('база: 14⚡/с (type0 1 + type1 3 + type2 10), 0.001🔬/с — как в аудите (clean)', () => {
    const { snapshot } = game.income.computeIncome(game.activeRuntimes(), game.incomeContext());
    expect(snapshot.energyPerSec).toBeCloseTo(fx.s0.energyPerSec_clean, 9);
    expect(snapshot.researchPerSec).toBeCloseTo(fx.s0.researchPerSec_clean, 12);
  });

  it('разряды t1+t2 → стек .11: энергия ×1.11 = 15.54, наука ×1.2 = 0.0012', () => {
    const r1 = game.dispatch('dischargeCell', { pid: 'ferrum', cellId: t1.id });
    expect(r1.ok).toBe(true);
    game.advance(1_000);
    const r2 = game.dispatch('dischargeCell', { pid: 'ferrum', cellId: t2.id });
    expect(r2.ok).toBe(true);
    const { snapshot } = game.income.computeIncome(game.activeRuntimes(), game.incomeContext());
    expect(snapshot.energyPerSec).toBeCloseTo(fx.s0.energyPerSec_buffed, 9);
    expect(snapshot.energyPerSec / fx.s0.energyPerSec_clean).toBeCloseTo(fx.s0.ratio_energy, 9);
    expect(snapshot.researchPerSec).toBeCloseTo(fx.s0.researchPerSec_buffed, 12);
    expect(fx.s0.breakdown_buffed.perPlanet.ferrum.boost).toBeCloseTo(1.2, 9);
    expect(game.session().chargesDone).toBe(2);
    expect(game.sonarCharges()).toBe(1);
  });

  it('истечение: через 200с множители снова 1 (surge погашен, чтобы не переназначил бафф)', () => {
    // отключаем авто-surge на этих клетках: иначе планировщик тикера зажжёт выброс внутри окна
    for (const c of [t1, t2]) rt.cellStates.get(c.id)!.surgeNextAt = Number.MAX_SAFE_INTEGER;
    advance(game, 400, 500); // +200с игрового времени
    const { snapshot } = game.income.computeIncome(game.activeRuntimes(), game.incomeContext());
    expect(snapshot.energyPerSec).toBeCloseTo(fx.s0.energyPerSec_clean, 9);
    expect(snapshot.researchPerSec).toBeCloseTo(fx.s0.researchPerSec_clean, 12);
  });

  it('snapshot UI: charge-статус и sonarCharges присутствуют', () => {
    const snap = game.snapshot();
    expect(snap.sonarCharges).toBe(1);
    expect(snap.charge).toBeNull(); // истёк
    const cell = snap.planets[0]!.cells.find((c) => c.id === t2.id)!;
    expect(cell.chargedEver).toBe(true);
    expect(cell.chargeCooldownUntil).toBeGreaterThan(0);
  });
});

describe('авто-surge v0.0.39.0 (аудит §surge)', () => {
  const env = makeEnv('ferrum');
  const t1 = env.cellsOfType(1)[0]!;
  const t2 = env.cellsOfType(2)[0]!;
  env.rt.explored.add(t1.id);
  env.rt.explored.add(t2.id);
  const rng = new Rng(4242);

  it('первый тик: только инициализация surgeNextAt (45..120с для type1), баффа нет', () => {
    env.svc.surgeTick(env.rt, rng);
    const st = env.rt.cellStates.get(t1.id)!;
    expect(st.surgeNextAt).toBeGreaterThanOrEqual(env.now() + 45_000);
    expect(st.surgeNextAt).toBeLessThanOrEqual(env.now() + 120_000);
    expect(env.svc.multFor('ferrum')).toBe(1);
  });

  it('выброс type1: pct .0195 = basePct .03 × .65, dur 20с, cooldown=until, БЕЗ науки/сонара', () => {
    const st = env.rt.cellStates.get(t1.id)!;
    st.surgeNextAt = env.now() - 1;
    const researchBefore = env.ledger.balance('research');
    env.svc.surgeTick(env.rt, rng);
    expect(st.surgeUntil).toBe(env.now() + 20_000);
    expect(st.chargeCooldownUntil).toBe(st.surgeUntil);
    expect(st.chargedEver).toBe(true);
    const buff = env.svc.buffsSnapshot().get('ferrum')!;
    expect(buff.pct).toBeCloseTo(fx.surge.triggered.buffs.ferrum.pct, 12); // .0195
    expect(buff.until).toBe(st.surgeUntil);
    expect(buff.sciencePct).toBe(0);
    expect(env.ledger.balance('research')).toBe(researchBefore);
    expect(env.sonar()).toBe(0);
    const ev = env.bus.getHistory().filter((e) => e.type === 'cell:surge');
    expect(ev.length).toBe(1);
    const d = ev[0]!.detail as { duration: number; pct: number; type: number };
    expect(d.type).toBe(1);
    expect(d.duration).toBe(20);
    expect(d.pct).toBeCloseTo(0.0195, 12);
    // следующий выброс назначен в будущем (45..120с)
    expect(st.surgeNextAt).toBeGreaterThan(env.now());
  });

  it('выброс type2: bonus .08×1.15=.092, dur 25с', () => {
    const st2 = env.rt.cellStates.get(t2.id)!;
    env.svc.surgeTick(env.rt, rng); // инициализация nextAt
    st2.surgeNextAt = env.now() - 1;
    env.svc.surgeTick(env.rt, rng);
    expect(st2.surgeUntil).toBe(env.now() + 25_000);
    const buff = env.svc.buffsSnapshot().get('ferrum')!;
    // .0195 (istёк? нет — buff type1 активен 20с, текущий now не двигали) → стек .0195+.092
    expect(buff.pct).toBeCloseTo(0.0195 + 0.092, 9);
  });

  it('константы планировщика — из baseline.surge (аудит §surge.constants)', () => {
    const s = loadBalance().baseline.surge;
    expect(s.intervalMs).toBe(2000);
    expect([s.nextAtMinType1, s.nextAtMaxType1]).toEqual([45000, 120000]);
    expect([s.nextAtMinType2, s.nextAtMaxType2]).toEqual([90000, 240000]);
    expect([s.durationMsType1, s.durationMsType2]).toEqual([20000, 25000]);
    expect([s.bonusMultType1, s.bonusMultType2]).toEqual([0.65, 1.15]);
    expect(s.basePctFallback).toBe(0.12);
  });

  it('детерминизм: одинаковый seed rng → одинаковый surgeNextAt', () => {
    const e1 = makeEnv('ferrum');
    const e2 = makeEnv('ferrum');
    const c1 = e1.cellsOfType(1)[0]!;
    const c2 = e2.cellsOfType(1)[0]!;
    e1.rt.explored.add(c1.id);
    e2.rt.explored.add(c2.id);
    e1.svc.surgeTick(e1.rt, new Rng(777));
    e2.svc.surgeTick(e2.rt, new Rng(777));
    expect(e1.rt.cellStates.get(c1.id)!.surgeNextAt).toBe(e2.rt.cellStates.get(c2.id)!.surgeNextAt);
  });

  it('Game-интеграция: surge-шаг живёт в тикере (session.surges)', () => {
    const { game } = makeGame(99);
    const rt = game.runtime('ferrum')!;
    const c1 = rt.data.cells.find((c) => c.type === 1)!;
    rt.explored.add(c1.id);
    const st = rt.cellStates.get(c1.id)!;
    st.surgeNextAt = 0; // «просрочен» → следующий тик fires
    game.advance(500);
    expect(st.surgeUntil).toBeGreaterThan(0);
    expect(game.session().surges).toBe(1);
  });
});
