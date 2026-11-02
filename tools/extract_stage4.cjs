/* Voronia 2.0 · tools/extract_stage4.cjs (Этап 4 — аномалии/заряды/синтез/мутанты/deep)
 * Золотой аудит поведения 1.x v0.0.41 через реальные функции бандла (window.__INT):
 *   заряды: i0() ручной разряд, s0() множитель в цепи дохода, a0()/ll(), авто-surge v0.0.39.0;
 *   наука: ng()/tk() c зарядным бустом sciencePct;
 *   аномалии: ветви power/resonance/synth (ce/fm/Uo), синтезатор el/Iy/Cy/ei/ti/Ty/Ay/Ly/$y;
 *   мутанты: ex(armId), ta/tb (ролл 12% при скане — документируется, не исполняется);
 *   deep: b0() переход L8, nr() стоимость апгрейда аномалии, tl() (включая deep-конверсию 4000/500).
 * Время: Date.now заморожен (NOW), продвигается вручную → детерминированный аудит.
 * Выход: fixtures/stage4_audit_v0.0.41.json — ТОЛЬКО ЧТЕНИЕ для кода 2.0 (ADR-011).
 * Запуск: node tools/extract_stage4.cjs  (~10 с; нужен ../uploads/*.html через harness).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { boot, startGame } = require('./harness/boot.cjs');

const OUT = path.join(__dirname, '..', 'fixtures');
fs.mkdirSync(OUT, { recursive: true });
const RANDOM_SEED = 20260401;
let NOW = 1800000000000; // замороженное время аудита

const { env, errors } = boot({ quiet: true, randomSeed: RANDOM_SEED });
if (errors.length) throw new Error('layer errors: ' + JSON.stringify(errors));
if (!startGame(env)) throw new Error('game failed to start');

// Детерминированное время: перехват Date.now ПОСЛЕ бута (конструкторы не трогаем).
const BaseD = env.Date;
env.Date = class extends BaseD { static now() { return NOW; } };
function advance(ms) { NOW += ms; }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const I = env.__INT;
const n = I.state;
const $ = I.planets;
const V = env.__V;
const BAL = env.VORONIA_BALANCE;

const out = {
  note: 'Этап 4 — золотой аудит аномалий/зарядов/синтеза/мутантов/deep (реальные функции 1.x, замороженное время)',
  extractedAt: 'NOW=' + NOW,
  randomSeed: RANDOM_SEED,
  bundle: 'Voronia_2.5D_Hybrid_v0.0.41_PROD.html (uploads/, не изменён)',
  missing: [],
};
function safe(fn, fallback) { try { const v = fn(); return v === undefined ? (fallback === undefined ? null : fallback) : v; } catch (e) { return { _error: String(e && e.message || e).slice(0, 120) }; } }
function gi(name) { try { const v = I[name]; if (v === undefined) { out.missing.push(name); return undefined; } return v; } catch (e) { out.missing.push(name + ':' + String(e.message).slice(0, 40)); return undefined; } }
function ser(v, d = 0) {
  if (v === null || v === undefined) return v;
  const t = typeof v;
  if (t === 'number' || t === 'boolean' || t === 'string') return v;
  if (t === 'function') return '[fn]';
  if (t !== 'object') return String(v);
  if (d > 5) return '[deep]';
  if (Array.isArray(v)) return v.map((x) => ser(x, d + 1));
  const o = {};
  for (const k of Object.keys(v)) { const x = ser(v[k], d + 1); if (x !== undefined) o[k] = x; }
  return o;
}
function snap() {
  return {
    energy: n.energy, iron: n.iron, kriogen: n.kriogen, crystals: n.crystals, research: n.research,
    energyPerSec: n.energyPerSec, ironPerSec: n.ironPerSec, kriogenPerSec: n.kriogenPerSec,
    crystalsPerSec: n.crystalsPerSec, researchPerSec: n.researchPerSec,
    sonarCharges: n.sonarCharges | 0, chargesDone: (n.gameSession && n.gameSession.chargesDone) | 0,
    deepMined: (n.gameSession && n.gameSession.deepMined) | 0, synthRuns: (n.gameSession && n.gameSession.synthRuns) || 0,
    scanned: (n.gameSession && n.gameSession.scanned) | 0,
  };
}
function buffs() { return ser(n.chargeBuffs || {}); }

const F = $[n.activePlanetId] || $.ferrum;
const K = $.krios;
const PID = F.id;

/* ============ §1 КОНФИГИ (registry v0.0.41) ============ */
out.config = {
  charge: ser(BAL.charge),
  transportConfig: ser(BAL.transport && BAL.transport.config),
  mutants: ser(BAL.planet && BAL.planet.mutants),
  deepLevelThreshold: BAL.cells.deepLevelThreshold,
  deepUpgradeCurveLen: (BAL.cells.deepUpgradeCurve || []).length,
  deepUpgradeCurveFirst3: ser((BAL.cells.deepUpgradeCurve || []).slice(0, 3)),
  researchMaxLevel: BAL.cells.researchMaxLevel,
  researchPerLevel: BAL.cells.researchPerLevel,
  branchMeta: ser(gi('Ho')),
  productByBiome: ser(gi('Py')),
  sonarChargeMax: safe(() => BAL.sonar.chargeMax),
  Hr: gi('Hr'),
  unlockedPlanets: [...n.unlockedPlanets],
  activePlanetId: n.activePlanetId,
};

/* ============ §2 ЗАРЯДЫ: отказы и одиночный разряд (ferrum) ============ */
const dis = (out.discharge = {});
const i0 = gi('i0');
const t1f = F.cells.find((c) => c.type === 1 && !c._destroyed);
const t2f = F.cells.find((c) => c.type === 2 && !c._destroyed);
const t0f = F.cells.find((c) => c.type === 0 && !c._destroyed);
{
  // отказы
  dis.reject_type = safe(() => i0(t0f, F));
  dis.reject_unexplored = safe(() => i0(t1f, F)); // ещё не исследована
  F.explored.add(t1f.id);
  dis.reject_destroyed = safe(() => { t1f._destroyed = true; t1f._restoreAt = NOW + 60000; const r = i0(t1f, F); t1f._destroyed = false; t1f._restoreAt = 0; return r; });
  // первый разряд
  const before = snap();
  dis.first = safe(() => i0(t1f, F));
  dis.afterFirst = snap();
  dis.buffsAfterFirst = buffs();
  dis.deltas = { research: n.research - before.research, energyPerSecBefore: before.energyPerSec };
  // кулдаун сразу
  dis.reject_cooldown = safe(() => i0(t1f, F));
  // повтор после кулдауна (бафф истёк → pct сбрасывается)
  advance(46000);
  dis.afterCooldown = safe(() => i0(t1f, F));
  dis.buffsAfterCooldown = buffs();
  // type2 → сонar-заряд
  F.explored.add(t2f.id);
  const sonarBefore = n.sonarCharges | 0;
  advance(1000);
  dis.type2 = safe(() => i0(t2f, F));
  dis.type2_sonarDelta = (n.sonarCharges | 0) - sonarBefore;
  dis.buffsAfterType2 = buffs();
}

/* ============ §3 s0 В ЦЕПИ ДОХОДА + a0/ll ============ */
{
  const a0 = gi('a0'), ll = gi('ll'), s0 = gi('s0');
  out.s0 = {};
  // активный бафф на ferrum (после §2 type2: pct = min(.25, .08*1)=.08; sciencePct=.15)
  out.s0.buffsActive = buffs();
  out.s0.a0 = safe(() => a0(PID));
  out.s0.mult_active = safe(() => s0(PID));
  I.ce();
  out.s0.energyPerSec_buffed = n.energyPerSec;
  out.s0.researchPerSec_buffed = safe(() => I.ng());
  out.s0.breakdown_buffed = safe(() => { const tk = gi('tk'); return tk ? ser(tk()) : null; });
  // истечение + очистка
  advance(200000);
  out.s0.mult_expired = safe(() => s0(PID));
  safe(() => ll && ll());
  out.s0.buffsAfterCleanup = buffs();
  I.ce();
  out.s0.energyPerSec_clean = n.energyPerSec;
  out.s0.researchPerSec_clean = safe(() => I.ng());
  out.s0.ratio_energy = out.s0.energyPerSec_clean ? out.s0.energyPerSec_buffed / out.s0.energyPerSec_clean : null;
}

/* ============ §4 ВЕТВИ АНОМАЛИЙ (ferrum cell type4) ============ */
{
  const a4 = F.cells.find((c) => c.type === 4 && !c._destroyed);
  const br = (out.branches = { cellId: a4.id });
  F.explored.add(a4.id);
  br.Uo_default = safe(() => gi('Uo')(a4)); // 'synth'
  br.Uo_type0 = safe(() => gi('Uo')(t0f)); // null
  const rec = {};
  for (const level of [0, 3]) {
    for (const deep of [false, true]) {
      for (const branch of ['synth', 'power', 'resonance']) {
        a4.level = level; a4.isDeep = deep; a4.anomalyType = branch;
        I.ce();
        rec[`${branch}_L${level}${deep ? '_deep' : ''}`] = { energyPerSec: n.energyPerSec, crystalsPerSec: n.crystalsPerSec };
      }
    }
  }
  br.income = rec;
  // deltas: power−synth (энергия), resonance−synth (кристаллы)
  const dE = (a, b) => rec[a].energyPerSec - rec[b].energyPerSec;
  const dC = (a, b) => rec[a].crystalsPerSec - rec[b].crystalsPerSec;
  br.delta_power_L0 = dE('power_L0', 'synth_L0');
  br.delta_power_L3_deep = dE('power_L3_deep', 'synth_L3_deep');
  br.delta_reson_L0 = dC('resonance_L0', 'synth_L0');
  br.delta_reson_L3_deep = dC('resonance_L3_deep', 'synth_L3_deep');
  // fm(): истощение от power/deep
  const fm = gi('fm');
  a4.anomalyType = 'power'; a4.isDeep = false; br.fm_power = safe(() => fm(F));
  a4.isDeep = true; br.fm_power_deep = safe(() => fm(F));
  a4.anomalyType = 'resonance'; br.fm_resonance = safe(() => fm(F));
  F.explored.delete(a4.id); br.fm_unexplored = safe(() => fm(F));
  F.explored.add(a4.id);
  a4.anomalyType = 'synth'; a4.isDeep = false; a4.level = 0;
  br.fm_synth = safe(() => fm(F));
  br.spc_hidden = safe(() => gi('ao')(PID, 'spc_hidden'));
}

/* ============ §5 СИНТЕЗ (el/Iy/Ly/ti/Cy/ei/Ty/Ay) ============ */
{
  const sy = (out.synth = {});
  const a4 = F.cells.find((c) => c.type === 4);
  sy.el_ferrum = safe(() => gi('el')(PID));
  sy.el_krios = safe(() => K ? gi('el')(K.id) : null);
  sy.Iy_ferrum = safe(() => gi('Iy')(F));
  sy.Ly = safe(() => gi('Ly')());
  sy.y_locked = safe(() => { const $y = gi('$y'); return $y ? $y(PID) : null; });
  sy.product_te = safe(() => { const te = gi('RES'); const p = sy.el_ferrum; return te && te[p] ? { rare: te[p].rare, hidden: te[p].hidden, researchUnlock: te[p].researchUnlock || null } : null; });
  sy.ti_noAnomaliesExplored = safe(() => ser(gi('ti')(PID)));
  // synth-аномалия L2
  a4.anomalyType = 'synth'; a4.level = 2; a4.isDeep = false;
  sy.ei_L2 = safe(() => gi('ei')(a4));
  sy.Cy_L2 = safe(() => gi('Cy')(a4));
  sy.ei_L2_deep = safe(() => { a4.isDeep = true; const v = gi('ei')(a4); a4.isDeep = false; return v; });
  sy.ti_synth_L2 = safe(() => ser(gi('ti')(PID)));
  // krios: продукт может быть разблокирован без исследования
  if (K) {
    const k4 = K.cells.filter((c) => c.type === 4 && !c._destroyed);
    sy.krios_anomalyCount = k4.length;
    if (k4.length) {
      K.explored.add(k4[0].id);
      k4[0].anomalyType = 'synth'; k4[0].level = 1;
      sy.y_locked_krios = safe(() => { const $y = gi('$y'); return $y ? $y(K.id) : null; });
      sy.ti_krios = safe(() => ser(gi('ti')(K.id)));
      // Harness-манипуляция: открываем исследования (1.x: at(i)=!!state.researchPerks[i])
      sy.ftProbe_before = safe(() => gi('ft') ? gi('ft')('unlock_carbon') : 'ft-missing');
      n.researchPerks = n.researchPerks || {};
      n.researchPerks.unlock_carbon = true;
      n.researchPerks.unlock_kriogenBoost = true;
      sy.ftProbe_after = safe(() => gi('ft') ? gi('ft')('unlock_carbon') : 'ft-missing');
      sy.Kt = { iron: safe(() => gi('Kt')('iron')), kriogen: safe(() => gi('Kt')('kriogen')), carbon: safe(() => gi('Kt')('carbon')) };
      sy.y_locked_afterUnlock = safe(() => { const $y = gi('$y'); return $y ? $y(K.id) : null; });
      sy.ti_krios_unlocked = safe(() => ser(gi('ti')(K.id)));
      // Ty на krios (input kriogen)
      const runTy = (pid, tag) => {
        const tk0 = safe(() => ser(gi('ti')(pid)));
        if (!tk0 || tk0.locked || !(tk0.in > 0)) { sy[tag + '_skipped'] = tk0; return; }
        if (!n.unlockedPlanets.has(pid)) { n.unlockedPlanets.add(pid); sy[tag + '_unlockedPlanet'] = true; }
        const before = snap();
        const stockBefore = safe(() => gi('Me')(pid, tk0.input));
        safe(() => gi('At')(pid, tk0.input, 100000));
        const stockAfter = safe(() => gi('Me')(pid, tk0.input));
        const ran = safe(() => gi('Ty')(10));
        const stockEnd = safe(() => gi('Me')(pid, tk0.input));
        const productStock = safe(() => gi('Me')(pid, tk0.product));
        const originSynth = safe(() => gi('tr')(pid, tk0.product, 'synthesized'));
        sy[tag] = {
          ti: tk0, ran, input: tk0.input, product: tk0.product,
          stockBefore, stockAfterAdd: stockAfter, stockAfterTick: stockEnd, productStock,
          originSynthesized: originSynth, inputConsumed: stockAfter - stockEnd,
          synthRunsDelta: (n.gameSession.synthRuns || 0) - before.synthRuns,
          Ay_10s: safe(() => gi('Ay')(pid, 10)),
        };
      };
      runTy(K.id, 'Ty_krios_10s');
      runTy(PID, 'Ty_ferrum_10s');
    }
  }
  // Ds-коллектор: все vs только synth
  sy.Ds_all_ferrum = safe(() => gi('Ds')(F).length);
  sy.Ds_synth_ferrum = safe(() => gi('Ds')(F, 'synth').length);
  a4.level = 0; a4.anomalyType = 'synth';
}

/* ============ §6 МУТАНТЫ И ИСТОЩЕНИЕ (ex/ta/tb) ============ */
{
  const mu = (out.mutants = {});
  const ex = gi('ex');
  mu.ex_byArm = {};
  for (const arm of ['forge', 'frost', 'life', 'void', 'core', 'unknown']) mu.ex_byArm[arm] = safe(() => ser(ex(arm)));
  const v3 = F.cells.find((c) => c.type === 3 && !c._destroyed);
  F.explored.add(v3.id);
  if (!(v3.reserve > 0)) { v3.maxReserve = v3.maxReserve || 150; v3.reserve = v3.maxReserve; }
  v3.cooldownUntil = 0;
  mu.gt = safe(() => gi('gt')(v3));
  const tb = gi('tb'), ta = gi('ta');
  mu.tb_base = safe(() => tb(v3, F));
  v3.mutant = 'ember'; mu.ta_ember = safe(() => ta(v3, F));
  v3.mutant = 'rime'; mu.ta_rime = safe(() => ta(v3, F));
  v3.mutant = 'shadow'; mu.ta_shadow = safe(() => ta(v3, F));
  v3.mutant = null;
  // компоненты цепи tb
  mu.components = {
    Ws: safe(() => gi('Ws')()),
    jy: safe(() => gi('jy')()),
    Wr_idx1: safe(() => gi('Wr')(1)),
    Wr_idx5: safe(() => gi('Wr')(5)),
    Yk: safe(() => gi('Yk')()),
    l1: safe(() => gi('l1')(v3)),
    xt_ferrum: safe(() => ser(gi('xt')(PID))),
    fm_now: safe(() => gi('fm')(F)),
    ironYield: v3.ironYield, kriogenYield: v3.kriogenYield, level: v3.level || 0, isDeep: !!v3.isDeep,
  };
  // fm через power-аномалию влияет на tb
  const a4 = F.cells.find((c) => c.type === 4);
  a4.anomalyType = 'power';
  mu.tb_withPowerAnomaly = safe(() => tb(v3, F));
  a4.anomalyType = 'synth';
  mu.tb_ratio_power = mu.tb_base ? mu.tb_withPowerAnomaly / mu.tb_base : null;
  mu.rollNote = '12% при скане (открытии) жилы type3/5: mutant = ex(planet.armId).id, Math.random (не детерминирован по seed)';
}

/* ============ §7 DEEP: b0 / nr / tl ============ */
{
  const dp = (out.deep = {});
  const b0 = gi('b0');
  const c0 = F.cells.find((c) => c.type === 0 && !c.isDeep);
  dp.fl = gi('fl');
  const dmBefore = (n.gameSession.deepMined) | 0;
  dp.b0_7to8 = safe(() => b0(c0, 7, 8));
  dp.isDeep_after = !!c0.isDeep;
  dp.deepMined_delta = ((n.gameSession.deepMined) | 0) - dmBefore;
  dp.b0_8to9_alreadyDeep = safe(() => b0(c0, 8, 9));
  const c0b = F.cells.find((c) => c.type === 0 && !c.isDeep && c !== c0);
  dp.b0_6to7 = safe(() => b0(c0b, 6, 7));
  // nr: стоимость апгрейда аномалии (50/300 × 3^L × To(idx))
  const nr = gi('nr');
  const a4 = F.cells.find((c) => c.type === 4);
  dp.nr_table_idx1 = [0, 1, 2, 3, 4, 5].map((L) => { a4.level = L; return { L, cost: safe(() => ser(nr(a4))) }; });
  const idxSave = F.planetIndex;
  F.planetIndex = 5;
  a4.level = 0;
  dp.nr_idx5_L0 = safe(() => ser(nr(a4)));
  dp.To_5 = safe(() => gi('To')(5));
  F.planetIndex = idxSave;
  a4.level = 0;
  // tl: живой апгрейд аномалии (UI подавлен __ccAutoQuiet)
  n.energy = 1e9;
  safe(() => gi('At')(PID, 'iron', 1e6));
  safe(() => gi('At')(PID, 'kriogen', 1e6));
  const ucm = (F.perks && F.perks.upgradeCostMult) || 1;
  dp.ucm = ucm;
  const steps = [];
  const quiet = () => { env.__ccAutoQuiet = true; if (env.window && env.window !== env) env.window.__ccAutoQuiet = true; };
  for (let k = 0; k < 7; k++) {
    quiet();
    const before = { level: a4.level || 0, isDeep: !!a4.isDeep, energy: n.energy, iron: safe(() => gi('Me')(PID, 'iron')) };
    const r = safe(() => gi('tl')(a4, 0, 0));
    steps.push({ before, result: ser(r), after: { level: a4.level || 0, isDeep: !!a4.isDeep, energy: n.energy, iron: safe(() => gi('Me')(PID, 'iron')) }, energyDelta: before.energy - n.energy });
    if (a4.isDeep) break;
  }
  dp.tl_steps = steps;
  dp.maxLevel = safe(() => BAL.transport.config.maxLevel);
}

/* ============ §9 ЗАРЯДЫ: соседи / cap баффа / cap сонара (krios) ============ */
function kriosChargeSection() {
  advance(400000); // гарантированно за пределами кулдаунов ferrum
  const q = (out.chargeKrios = {});
  const i0 = gi('i0');
  const t1s = K.cells.filter((c) => c.type === 1 && !c._destroyed);
  const t2s = K.cells.filter((c) => c.type === 2 && !c._destroyed);
  for (const c of [...t1s, ...t2s]) K.explored.add(c.id);
  q.t1count = t1s.length; q.t2count = t2s.length;
  // последовательные разряды всех type1 в ОДИН момент времени: стекание pct до buffCap
  q.sequence = [];
  for (const c of t1s) {
    const before = n.research;
    const r = safe(() => i0(c, K));
    q.sequence.push({
      cellId: c.id, ok: r && r.ok, neighbors: r && r.neighbors, mult: r && r.mult,
      pct: r && r.pct, pctTotal: r && r.pctTotal, dur: r && r.dur, atCap: r && r.atCap,
      scienceDelta: n.research - before,
    });
  }
  q.buffAfterSequence = ser((n.chargeBuffs || {}).krios || null);
  q.a0_krios = safe(() => gi('a0')(K.id));
  q.s0_krios = safe(() => gi('s0')(K.id));
  // соседский бонус: контролируемая мутация — сосед type1-клетки становится type1
  advance(100000); // кулдауны истекли, бафф истёк
  const anchor = t1s[0];
  const nbId = (anchor.neighbors || []).find((id) => { const nb = K.cells[id]; return nb && nb.type === 0 && !nb._destroyed; });
  if (nbId !== undefined) {
    const nb = K.cells[nbId];
    nb.type = 1; nb.ironYield = nb.ironYield || 0;
    K.explored.add(nbId);
    q.neighborTest = { anchorId: anchor.id, mutatedNeighbor: nbId, note: 'harness: type0→type1 для проверки соседского бонуса' };
    const r = safe(() => i0(anchor, K));
    q.neighborTest.result = { neighbors: r && r.neighbors, mult: r && r.mult, pct: r && r.pct, dur: r && r.dur, ok: r && r.ok };
    nb.type = 0;
  }
  // type2: сонar-заряды до капа (chargeMax=3; уже 1 после ferrum)
  q.sonar = [];
  for (const c of t2s) {
    const before = { research: n.research, sonar: n.sonarCharges | 0 };
    const r = safe(() => i0(c, K));
    q.sonar.push({ cellId: c.id, ok: r && r.ok, gained: r && r.sonarChargeGained, sonarBefore: before.sonar, sonarAfter: n.sonarCharges | 0, scienceDelta: n.research - before.research });
  }
  q.unlockedPlanets = [...n.unlockedPlanets];
}

/* ============ §8 АВТО-SURGE v0.0.39.0 (реальный тик 2 с) ============ */
async function surgeSection() {
  const sg = (out.surge = {});
  sg.constants = {
    schedulerGuard: 'window.__voroniaSurgeSchedulerV0390',
    intervalMs: 2000,
    nextAtRand: { type1: [45000, 120000], type2: [90000, 240000] },
    durationMs: { type1: 20000, type2: 25000 },
    basePctFallback: 0.12,
    bonusMult: { type1: 0.65, type2: 1.15 },
    cap: 'cl||.75 (registry buffCap=0.25)',
    scienceAndSonar: 'НЕ выдаются (только ручной разряд i0)',
    busEvent: 'cell:surge {pid,cellId,type,duration,pct}',
    toastThrottleMs: 12000,
  };
  // чистое состояние: баффы ferrum истекли
  advance(300000);
  safe(() => gi('ll') && gi('ll')());
  const t1f = F.cells.find((c) => c.type === 1);
  const pctBefore = n.chargeBuffs && n.chargeBuffs[PID] ? n.chargeBuffs[PID].pct : 0;
  t1f._v039SurgeNextAt = NOW - 1;
  t1f._v039SurgeUntil = 0;
  await sleep(2600);
  sg.triggered = {
    surgeNextAt: t1f._v039SurgeNextAt, // NOW + rand(45..120s)
    surgeUntil: t1f._v039SurgeUntil, // NOW + 20000
    chargedAt: t1f._chargedAt, chargedEver: !!t1f._chargedEver, chargeCooldown: t1f._chargeCooldown,
    pctBefore, buffs: buffs(),
  };
  sg.busSurges = safe(() => { const h = V.bus.history(60); return ser((h || []).filter((e) => e && (e.type === 'cell:surge' || e.type === 'cell:discharged')).slice(-6)); });
}

async function main() {
  kriosChargeSection();
  await surgeSection();
  // финальный хвост шины
  out.busTail = safe(() => ser((V.bus.history(40) || []).slice(-14)));
  out.stateFinal = snap();
  const p = path.join(OUT, 'stage4_audit_v0.0.41.json');
  fs.writeFileSync(p, JSON.stringify(out, null, 1));
  console.log('saved', p, fs.statSync(p).size, 'B; missing:', JSON.stringify(out.missing));
  process.exit(0);
}
main().catch((e) => { console.error(e); process.exit(1); });
