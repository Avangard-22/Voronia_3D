/**
 * Этап 4 — синтезатор (ветвь 'synth'): продукт/вход, locked-логика Kt, rates (ei/Cy/Ly), тик Ty.
 * Золотые (fixtures/stage4_audit_v0.0.41.json §synth):
 *   el='carbon' (ferrum и krios); Iy: ferrum→iron, krios→kriogen;
 *   ferrum L2: {out .054, in .432} (=basePerSec .02 × ei 3 × (0.5+rare .4), ×8); deep → ei 6;
 *   krios L1 (ОБА перка): {out .036, in .288}; без unlock_carbon/unlock_kriogenBoost → locked;
 *   Ty(10с) ferrum: −4.32 железа, +0.54 углерода, origin.synthesized=0.54.
 */
import { describe, it, expect } from 'vitest';
import { makeGame, grant, fixture } from './helpers';
import { loadBalance } from '../src/config/loader';

interface SynthAudit {
  el_ferrum: string; el_krios: string; Iy_ferrum: string; Ly: number;
  product_te: { rare: number; researchUnlock: string };
  ei_L2: number; Cy_L2: number; ei_L2_deep: number;
  ti_noAnomaliesExplored: { out: number; in: number; product: string; input: string; anomalies: number; locked: boolean };
  ti_krios_unlocked: { out: number; in: number; product: string; input: string; anomalies: number; locked: boolean };
  Ty_ferrum_10s: { stockAfterAdd: number; stockAfterTick: number; productStock: number; originSynthesized: number; inputConsumed: number };
  Ty_krios_10s: { stockAfterTick: number; productStock: number; originSynthesized: number; inputConsumed: number };
  Ds_synth_ferrum: number;
}
const fx = fixture<{ synth: SynthAudit }>('stage4_audit_v0.0.41.json').synth;
const balance = loadBalance();
const cfg = balance.registry.transport.config;

function ferrumSynth(unlock = true, level = 0, deep = false) {
  const { game } = makeGame(31337);
  if (unlock) game.tech.setResearch('unlock_carbon', 1);
  const rt = game.runtime('ferrum')!;
  const a4 = rt.data.cells.find((c) => c.type === 4)!;
  rt.explored.add(a4.id);
  const st = rt.cellStates.get(a4.id)!;
  st.level = level;
  st.isDeep = deep;
  return { game, rt, a4, st };
}

/** 1.x-харнесс аудита открывал krios вручную; в 2.0 команды открытия ещё нет (Этап 5) — через save-цикл. */
function unlockKrios(game: ReturnType<typeof makeGame>['game']) {
  const save = game.collectState();
  game.applyState({ ...save, unlockedPlanets: [...save.unlockedPlanets, 'krios'] });
  return game.runtime('krios')!;
}

describe('synth: продукт/вход (1.x el/Iy)', () => {
  it('ferrum: carbon/iron; krios: carbon/kriogen', () => {
    const { game } = ferrumSynth(false);
    const rtF = game.runtime('ferrum')!;
    const rtK = unlockKrios(game);
    expect(game.synthService.productFor(rtF)).toBe(fx.el_ferrum);
    expect(game.synthService.inputFor(rtF)).toBe(fx.Iy_ferrum);
    expect(game.synthService.productFor(rtK)).toBe(fx.el_krios);
    expect(game.synthService.inputFor(rtK)).toBe('kriogen');
    expect(game.synthService.lyMult()).toBe(fx.Ly);
  });

  it('константы: basePerSec .02, inputPerOutput 8, deepMult 2, rare(carbon) .4', () => {
    expect(cfg.basePerSec).toBe(0.02);
    expect(cfg.inputPerOutput).toBe(8);
    expect(cfg.deepMult).toBe(2);
    expect(fx.product_te.rare).toBeCloseTo(0.4, 12);
    expect(fx.product_te.researchUnlock).toBe('unlock_carbon');
  });
});

describe('synth: статус ti()', () => {
  it('без unlock_carbon → locked {out 0, in 0, anomalies 1}', () => {
    const { game, rt } = ferrumSynth(false);
    expect(game.synthService.status(rt)).toEqual({
      out: 0, in: 0, product: 'carbon', input: 'iron', anomalies: 1, locked: true,
    });
    expect(game.synthService.status(rt)).toMatchObject({ locked: fx.ti_noAnomaliesExplored.locked, anomalies: fx.ti_noAnomaliesExplored.anomalies });
  });

  it('ferrum L2: out .054, in .432 (ei=3, Cy=.06); deep L2 → ei 6 → out .108', () => {
    const { game, rt, st } = ferrumSynth(true, 2);
    expect(game.synthService.cellMult(st)).toBe(fx.ei_L2);
    expect(game.synthService.cellRate(st)).toBeCloseTo(fx.Cy_L2, 12);
    const s = game.synthService.status(rt);
    expect(s.out).toBeCloseTo(0.054, 12);
    expect(s.in).toBeCloseTo(0.432, 12);
    expect(s.locked).toBe(false);
    st.isDeep = true;
    expect(game.synthService.cellMult(st)).toBe(fx.ei_L2_deep);
    const sd = game.synthService.status(rt);
    expect(sd.out).toBeCloseTo(0.108, 12);
    expect(sd.in).toBeCloseTo(0.864, 12);
  });

  it('Ly: boost_synth ×1.5, +boost_synth2 ×2', () => {
    const { game, rt } = ferrumSynth(true, 2);
    game.tech.setResearch('boost_synth', 1);
    expect(game.synthService.lyMult()).toBe(1.5);
    expect(game.synthService.status(rt).out).toBeCloseTo(0.054 * 1.5, 12);
    game.tech.setResearch('boost_synth2', 1);
    expect(game.synthService.lyMult()).toBe(3);
    expect(game.synthService.status(rt).out).toBeCloseTo(0.054 * 3, 12);
  });

  it('krios: нужен ОБА перка; L1 → {out .036, in .288} (аудит ti_krios_unlocked)', () => {
    const { game } = makeGame(31337);
    const rt = unlockKrios(game);
    const a4 = rt.data.cells.find((c) => c.type === 4)!;
    rt.explored.add(a4.id);
    rt.cellStates.get(a4.id)!.level = 1;
    // только carbon: вход kriogen закрыт → locked
    game.tech.setResearch('unlock_carbon', 1);
    const s1 = game.synthService.status(rt);
    expect(s1.locked).toBe(true);
    expect(s1.input).toBe('kriogen');
    // оба перка → разблокирован
    game.tech.setResearch('unlock_kriogenBoost', 1);
    const s2 = game.synthService.status(rt);
    expect(s2.out).toBeCloseTo(fx.ti_krios_unlocked.out, 12);
    expect(s2.in).toBeCloseTo(fx.ti_krios_unlocked.in, 12);
    expect(s2.anomalies).toBe(fx.ti_krios_unlocked.anomalies);
    expect(s2.locked).toBe(false);
    expect(s2.product).toBe('carbon');
  });

  it('Ds: ветвь ≠ synth не считается (power → anomalies 0)', () => {
    const { game, rt, st } = ferrumSynth(true, 2);
    expect(game.synthService.synthCells(rt).length).toBe(fx.Ds_synth_ferrum);
    st.anomalyType = 'power';
    expect(game.synthService.synthCells(rt)).toEqual([]);
    const s = game.synthService.status(rt);
    expect(s.anomalies).toBe(0);
    expect(s.out).toBe(0);
    expect(s.locked).toBe(false);
    st.anomalyType = 'synth';
    expect(game.synthService.synthCells(rt).length).toBe(1);
  });
});

describe('synth: тик Ty() — потребление входа / выпуск продукта', () => {
  it('ferrum L2, 10 с, железо 100000 → −4.32⛏ / +0.54🧪, origin.synthesized, событие', () => {
    const { game, rt } = ferrumSynth(true, 2);
    grant(game, { iron: 100_000 });
    expect(game.ledger.balance('iron')).toBe(fx.Ty_ferrum_10s.stockAfterAdd);
    const ran = game.synthService.tick([rt], 10);
    expect(ran).toBe(true);
    expect(game.ledger.balance('iron')).toBeCloseTo(fx.Ty_ferrum_10s.stockAfterTick, 9);
    expect(game.ledger.balance('carbon')).toBeCloseTo(fx.Ty_ferrum_10s.productStock, 12);
    expect(game.synthService.originOf(rt, 'carbon', 'synthesized')).toBeCloseTo(fx.Ty_ferrum_10s.originSynthesized, 12);
    const ev = game.bus.getHistory().filter((e) => e.type === 'synth:produced');
    expect(ev.length).toBe(1);
  });

  it('krios L1, 10 с, криоген 100000 → −2.88 / +0.36', () => {
    const { game } = makeGame(31337);
    const rt = unlockKrios(game);
    game.tech.setResearch('unlock_carbon', 1);
    game.tech.setResearch('unlock_kriogenBoost', 1);
    const a4 = rt.data.cells.find((c) => c.type === 4)!;
    rt.explored.add(a4.id);
    rt.cellStates.get(a4.id)!.level = 1;
    grant(game, { kriogen: 100_000 });
    expect(game.synthService.tick([rt], 10)).toBe(true);
    expect(game.ledger.balance('kriogen')).toBeCloseTo(fx.Ty_krios_10s.stockAfterTick, 9);
    expect(game.ledger.balance('carbon')).toBeCloseTo(fx.Ty_krios_10s.productStock, 12);
    expect(game.synthService.originOf(rt, 'carbon', 'synthesized')).toBeCloseTo(fx.Ty_krios_10s.originSynthesized, 12);
  });

  it('нехватка входа → частичный синтез; ноль → tick=false, без изменений', () => {
    const { game, rt } = ferrumSynth(true, 2);
    grant(game, { iron: 2 });
    expect(game.synthService.tick([rt], 10)).toBe(true); // c = min(4.32, 2) = 2
    expect(game.ledger.balance('iron')).toBeCloseTo(0, 12);
    expect(game.ledger.balance('carbon')).toBeCloseTo(2 / cfg.inputPerOutput, 12); // 0.25
    expect(game.synthService.tick([rt], 10)).toBe(false); // запас 0
    expect(game.ledger.balance('carbon')).toBeCloseTo(0.25, 12);
  });

  it('locked-планета не синтезирует (tick пропускает)', () => {
    const { game, rt } = ferrumSynth(false, 2);
    grant(game, { iron: 10_000 });
    expect(game.synthService.tick([rt], 10)).toBe(false);
    expect(game.ledger.balance('iron')).toBe(10_000);
    expect(game.ledger.balance('carbon')).toBe(0);
  });

  it('интеграция: тикер Game гоняет синтез каждый шаг; snapshot.synth — статус активной планеты', () => {
    const { game } = makeGame(31337);
    game.tech.setResearch('unlock_carbon', 1);
    const rt = game.runtime('ferrum')!;
    const a4 = rt.data.cells.find((c) => c.type === 4)!;
    rt.explored.add(a4.id);
    rt.cellStates.get(a4.id)!.level = 2;
    grant(game, { iron: 100_000 });
    const snap0 = game.snapshot();
    expect(snap0.synth).not.toBeNull();
    expect(snap0.synth!.out).toBeCloseTo(0.054, 12);
    // 50 шагов по 200 мс = 10 с (как тикер 1.x); параллельно идёт добыча жил → железо сравниваем диапазоном
    game.advance(200);
    for (let i = 0; i < 49; i++) game.advance(200);
    expect(game.ledger.balance('carbon')).toBeCloseTo(0.54, 9); // углерод даёт только синтез
    const iron = game.ledger.balance('iron');
    expect(iron).toBeLessThan(100_000); // синтез (−4.32) превысил добычу жил за 10 с
    expect(iron).toBeGreaterThan(100_000 - 4.32 - 2);
    expect(game.session().synthRuns).toBeGreaterThanOrEqual(1);
  });
});
