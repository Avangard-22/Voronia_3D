/* Voronia 2.0 · tools/extract_stage0.js (восстановлен)
 * Runtime-извлечение фикстур из монолита v0.0.41 через harness (node+vm+DOM-заглушки).
 * Каждый раздел — отдельный бут (изоляция состояния), детерминированный Math.random (seed фиксирован).
 * Выход: work/fixtures/*.json — ТОЛЬКО ЧТЕНИЕ для кода 2.0 (ADR-011: данные — runtime-аудит, не ТЗ).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { boot, startGame, resolveInt } = require('./harness/boot.cjs');

const OUT = path.join(__dirname, '..', 'fixtures');
fs.mkdirSync(OUT, { recursive: true });
const RANDOM_SEED = 20260102;
const results = [];
const t00 = Date.now();
function sec(name){ console.log(`[${((Date.now()-t00)/1000).toFixed(1)}s] ${name}`); }

function save(name, obj) {
  const p = path.join(OUT, name);
  fs.writeFileSync(p, JSON.stringify(obj, null, 1));
  results.push(`${name} (${fs.statSync(p).size} B)`);
}

function fresh(opts = {}) {
  const { env, errors } = boot({ quiet: true, randomSeed: RANDOM_SEED, ...opts });
  if (errors.length) throw new Error('layer errors: ' + JSON.stringify(errors));
  const started = startGame(env);
  if (!started) throw new Error('game failed to start');
  const I = env.__INT, L = env.__V.legacy, n = I.state, $ = I.planets;
  return { env, I, L, n, $ };
}

function ser(v, depth = 0) {
  if (v === null || v === undefined) return v;
  const t = typeof v;
  if (t === 'number' || t === 'boolean' || t === 'string') return v;
  if (t === 'function') return undefined;
  if (t !== 'object') return String(v);
  if (depth > 6) return '[deep]';
  const cn = v.constructor && v.constructor.name;
  if (cn === 'Set') return [...v].map((x) => ser(x, depth + 1));
  if (cn === 'Map') { const o = {}; for (const [k, val] of v) o[String(k)] = ser(val, depth + 1); return o; }
  if (Array.isArray(v) || cn === 'Array') return v.map((x) => ser(x, depth + 1));
  const out = {};
  for (const k of Object.keys(v)) {
    if (k.startsWith('_') && !['_visited', 'destroyed'].includes(k)) { const val = v[k]; if (typeof val !== 'object' && typeof val !== 'function') out[k] = val; continue; }
    const val = ser(v[k], depth + 1);
    if (val !== undefined) out[k] = val;
  }
  return out;
}

function cellDump(c) {
  return {
    id: c.id, type: c.type, displayType: c.displayType, level: c.level || 0,
    yield: c.yield || 0, ironYield: c.ironYield, kriogenYield: c.kriogenYield,
    reserve: c.reserve, maxReserve: c.maxReserve, cooldownUntil: c.cooldownUntil || 0,
    reactCount: c.reactCount || 0, neighbors: [...(c.neighbors || [])],
    resourceKey: c.resourceKey || null, anomalyType: c.anomalyType || null,
    isDeep: !!c.isDeep, mutant: c.mutant || null,
    center: c.center ? [...c.center] : null,
  };
}

function planetDump(p) {
  return {
    id: p.id, name: p.name, seed: p.seed, f: p.f, biome: p.biome, geometry: p.geometry,
    geometryName: p.geometryName, planetIndex: p.planetIndex, armId: p.armId || null, role: p.role || null,
    isUnique: p.isUnique, descriptors: ser(p.descriptors), perks: ser(p.perks),
    palette: ser(p.palette), lore: p.lore || null, resourceList: [...(p.resourceList || [])],
    scanBonus: ser(p.scanBonus), origin: ser(p.origin), availableEvents: ser(p.availableEvents),
    storage: ser(p.storage), verts: ser(p.verts), faces: ser(p.faces),
    startingCellId: p.startingCellId, _visited: p._visited,
    explored: p.explored ? [...p.explored] : [], revealed: p.revealed ? [...p.revealed] : [],
    cells: (p.cells || []).map(cellDump),
    cellCount: (p.cells || []).length,
    typeDistribution: (p.cells || []).reduce((a, c) => ((a[c.type] = (a[c.type] || 0) + 1), a), {}),
  };
}

function safe(fn, fallback = null) { try { const v = fn(); return v === undefined ? fallback : v; } catch (e) { return fallback; } }

function busTail(env, k = 20) {
  try { const h = env.__V.bus.history(k); return ser(h); } catch { return []; }
}

function snap(n) {
  return {
    energy: n.energy, iron: n.iron, kriogen: n.kriogen, crystals: n.crystals,
    research: n.research, dust: n.dust, essence: n.essence, shards: n.shards,
    currentCost: n.currentCost, baseCost: n.baseCost, MAX_LEVEL: n.MAX_LEVEL,
    extraResources: ser(n.extraResources), compoundResources: ser(n.compoundResources),
    energyPerSec: n.energyPerSec, ironPerSec: n.ironPerSec, kriogenPerSec: n.kriogenPerSec,
    crystalsPerSec: n.crystalsPerSec, researchPerSec: n.researchPerSec,
    warehouseLevel: n.warehouseLevel, activePlanetId: n.activePlanetId,
    unlockedPlanets: [...n.unlockedPlanets], gameStartSeed: n.gameStartSeed,
    extraResourcesPerSec: ser(n.extraResourcesPerSec),
  };
}

/* ============ §0 META ============ */
sec('§0 META');
{
  const { env, I, n } = fresh();
  const missing = resolveInt(env).missing;
  save('meta.json', {
    extractedAt: new Date().toISOString(),
    bundle: 'Voronia_2.5D_Hybrid_v0.0.41_PROD.html (uploads/, 2949932 B, не изменён)',
    version: env.__VORONIA_VERSION,
    saveSchema: env.__V.core.SAVE_SCHEMA_VERSION,
    gameVersion: env.__V.core.GAME_VERSION,
    harness: { randomSeed: RANDOM_SEED, injection: 'window.__LvScanGrowth=LvScanGrowth; +__INT getters', layers: 30 },
    intMissing: missing,
    registrySections: Object.keys(env.VORONIA_BALANCE).length,
    freshState: snap(n),
  });
}

/* ============ §1 GS-01 fresh state ============ */
sec('§1 GS-01 fresh state');
{
  const { env, I, n, $ } = fresh();
  save('gs01_fresh_state.json', {
    scenario: 'GS-01: новая игра — все ресурсы 0, currentCost=10, ferrum активен, unlocked=[ferrum], MAX_LEVEL=100',
    snapshot: snap(n),
    session: ser(n.gameSession),
    prestigeGrab: { until: n.prestigeGrabUntil, used: n.prestigeGrabsUsed },
    busHistory: busTail(env),
  });
}

/* ============ §2 planets: ferrum full + krios + summary ============ */
sec('§2 planets: ferrum full + krios + summary');
{
  const { env, I, n, $ } = fresh();
  const f = $.ferrum, k = $.krios;
  save('planet_ferrum_full.json', { scenario: 'GS-02: explored=[0], revealed=[0,2,1,3,6,7] включая порядок вставки', planet: planetDump(f) });
  save('planet_krios_full.json', { planet: planetDump(k) });
  save('planets_summary.json', {
    ferrum: { id: f.id, seed: f.seed, biome: f.biome, geometry: f.geometry, cellCount: f.cells.length, typeDistribution: planetDump(f).typeDistribution, armId: f.armId, role: f.role, descriptors: ser(f.descriptors), perks: ser(f.perks) },
    krios: { id: k.id, seed: k.seed, biome: k.biome, geometry: k.geometry, cellCount: k.cells.length, typeDistribution: planetDump(k).typeDistribution, armId: k.armId, role: k.role, descriptors: ser(k.descriptors), perks: ser(k.perks) },
    graph: ser(env.GAME.PlanetaryGraph),
  });
  // геометрия/таблицы генератора для Этапа 3
  save('planetgen_tables.json', {
    geometry: ser(env.__V.balanceTables.geometry),
    climate: ser(I.CLIM),
    nameGen: ser(I.$f),
    goldenRatio: (1 + Math.sqrt(5)) / 2,
    events: ser(I.EVENTS),
  });
}

/* ============ §3 golden save fresh (schema 39) ============ */
sec('§3 golden save fresh (schema 39)');
{
  const { env, I, n } = fresh();
  env.__V.save.saveGame(true);
  const raw = env.localStorage.getItem('cosmicClickerV19');
  if (!raw) throw new Error('no save written');
  const j = JSON.parse(raw);
  save('golden_save_fresh_v0.0.41.json', j);
  save('save_schema39_keys.json', {
    top: Object.keys(j).sort(),
    schema: j.schema,
    extensions: j.extensions ? Object.keys(j.extensions) : null,
    extensionManifests: ser(env.__V.core.extensionManifests),
  });
}

/* ============ §4 GS-03 scan trail 1→2→3 ============ */
sec('§4 GS-03 scan trail 1→2→3');
{
  const { env, I, n, $ } = fresh();
  const f = $.ferrum;
  n.energy = 1000; // грант под сценарий (как в оригинальном golden trail)
  const before = snap(n);
  const steps = [];
  for (const cid of [1, 2, 3]) {
    const cell = f.cells[cid];
    const pre = { charge: I.ln(), currentCost: n.currentCost, energy: n.energy, research: n.research, explored: [...f.explored], revealed: [...f.revealed], cellType: cell.type, mutant: cell.mutant || null };
    const res = I.Sd(cell, { manual: true });
    steps.push({
      cellId: cid, charge: pre.charge, currentCostBefore: pre.currentCost, currentCostAfter: n.currentCost,
      energyBefore: pre.energy, energyAfter: n.energy, energyDelta: n.energy - pre.energy,
      researchBefore: pre.research, researchAfter: n.research, researchDelta: n.research - pre.research,
      result: ser(res), cellType: pre.cellType, anomalyType: cell.anomalyType || null, mutantAfter: cell.mutant || null,
      exploredAfter: [...f.explored], revealedAfter: [...f.revealed], sessionScanned: n.gameSession.scanned,
      events: busTail(env, 6).filter((e) => /scan|cell/.test(e.type || e.name || '')),
    });
  }
  save('gs03_scan_trail.json', {
    scenario: 'GS-03: trail 1→2→3; ожидаемо цены 9,9,10; дельты −9,−9,+990 (type4 +1000); currentCost 10→13',
    before, steps, after: snap(n),
    scanGrowthLive: env.__LvScanGrowth(),
    costComponents: {
      perksScanMult: safe(() => f.perks && f.perks.scanCostMult),
      Co_scan: safe(() => I.Co('ferrum', 'scan')), xt_scan: safe(() => (I.xt('ferrum') || {}).scan),
      mt_scan: safe(() => I.mt('ferrum', 'scanCostMult')), fn_scan: safe(() => I.fn('ferrum', 'scanCostMult')),
      nw: safe(() => I.nw()), iw: safe(() => I.iw()), fv: safe(() => I.fv()), js: safe(() => I.js(f.planetIndex)), armId: f.armId, Ap_arm: safe(() => I.Ap(f.armId)),
      sleeping: safe(() => I.Wo(f)), biomeMult: safe(() => I.Xc(f)),
    },
    scienceFormula: 'min(10, 1+floor(charge/1000)) для не-аномалий',
  });
}

/* ============ §5 GS-04 upgrade curve (cell0 ×5) ============ */
sec('§5 GS-04 upgrade curve (cell0 ×5)');
{
  const { env, I, n, $ } = fresh();
  const f = $.ferrum;
  n.energy = 1e7; I.At('ferrum', 'iron', 1e6); n.iron = 1e6;
  const cell = f.cells[0];
  const steps = [];
  for (let up = 0; up < 5; up++) {
    const cost = I.zn(cell, f);
    const pre = { energy: n.energy, ironStorage: I.Me('ferrum', 'iron'), research: n.research, level: cell.level, yield: cell.yield, reserve: cell.reserve, maxReserve: cell.maxReserve };
    const res = I.Ni(cell, 'ferrum', { countSession: true });
    steps.push({
      levelBefore: pre.level, levelAfter: cell.level,
      cost: ser(cost),
      energyDelta: n.energy - pre.energy,
      ironDelta: I.Me('ferrum', 'iron') - pre.ironStorage,
      researchDelta: n.research - pre.research,
      yieldAfter: cell.yield, reserve: cell.reserve, maxReserve: cell.maxReserve,
      result: ser(res),
    });
  }
  // полная кривая type0 до L30 через yl(g0, L) (включая hardcore-ветвь за капом)
  const curve = [];
  for (let L = 0; L <= 30; L++) { const c = I.yl(I.g0, L); curve.push({ level: L, e: c.e, a: c.a, b: c.b, g: c.g, x: c.x }); }
  save('gs04_upgrade_curve.json', {
    scenario: 'GS-04: апгрейд cell0 ×5; ожидаемо 96→336→840→1680⚡, +iron 12/26/60/108/180, +1🔬×5, yield 6',
    cellType: cell.type, steps, baseCurve_g0: curve,
    multipliers: {
      perkUpgrade: safe(() => f.perks && f.perks.upgradeCostMult),
      mt_upgrade: safe(() => I.mt('ferrum', 'upgradeCostMult')),
      r0: safe(() => I.r0()), To: safe(() => I.To(f.planetIndex)), Ig: safe(() => I.Ig('upgradeCostMult')), E0: safe(() => I.E0(f.planetIndex)), q0: safe(() => I.q0(f)),
      primaryResource: safe(() => I.c1(f)),
    },
  });
}

/* ============ §6 income audit (midgame-ferrum: всё исследовано) ============ */
sec('§6 income audit (midgame-ferrum: всё исследовано)');
{
  const { env, I, n, $ } = fresh();
  const f = $.ferrum;
  n.energy = 1e7;
  // исследуем все 12 клеток (порядок по id; аномалия даст +1000 — учтётся в дельтах)
  const scanLog = [];
  for (let cid = 1; cid < f.cells.length; cid++) {
    const cell = f.cells[cid];
    if (f.explored.has(cid)) continue;
    const e0 = n.energy;
    const r = I.Sd(cell, { manual: false });
    scanLog.push({ cid, type: cell.type, ok: r.ok, reason: r.reason || null, energyDelta: n.energy - e0, charge: Math.round(e0 - n.energy) });
  }
  I.ce();
  const income = {
    energyPerSec: n.energyPerSec, ironPerSec: n.ironPerSec, kriogenPerSec: n.kriogenPerSec,
    crystalsPerSec: n.crystalsPerSec, researchPerSec: n.researchPerSec,
    extraResourcesPerSec: ser(n.extraResourcesPerSec),
    planetIncome: ser(n.planetIncome),
  };
  const comp = {};
  for (const k of ['Ac', 'Gi', 'fa', 'Ld', 'am', 'ld', 'Tp', 'Tg', 'Ng', 'al', 'Bg', 'lf', 'Ws', 'Vg', 'Gg', 'Wg', 'Yg', 'qg', 'jg', 'Zl', 'ed', 'ts', 'Ti', 'td', 'od', 'cd']) {
    try { const fn = I[k]; comp[k] = typeof fn === 'function' ? fn() : fn; } catch (e) { comp[k] = 'ERR'; }
  }
  save('income_audit_v0.0.41.json', {
    scenario: 'midgame-ferrum: все 12 клеток исследованы, уровни 0; ожидаемо 42⚡/с (=7×6), 0.69⛏/с (=0.115×6), 0.002🔬/с',
    scanLog, income,
    state: snap(n),
    ferrumModifiers: {
      armId: f.armId, Ap_arm: safe(() => I.Ap(f.armId)), Xc_biome: safe(() => I.Xc(f)), perks: ser(f.perks), descriptors: ser(f.descriptors),
      Co_energy: safe(() => I.Co('ferrum', 'energy')), Co_iron: safe(() => I.Co('ferrum', 'iron')), Co_rare: safe(() => I.Co('ferrum', 'rare')),
      xt: safe(() => ser(I.xt('ferrum'))), mt_allMult: safe(() => I.mt('ferrum', 'allMult')), mt_energyMult: safe(() => I.mt('ferrum', 'energyMult')),
      fn_allMult: safe(() => I.fn('ferrum', 'allMult')), fn_energyMult: safe(() => I.fn('ferrum', 'energyMult')), fn_ironMult: safe(() => I.fn('ferrum', 'ironMult')),
      s0: safe(() => I.s0('ferrum')), sr: safe(() => I.sr(f.planetIndex)), scanBonusActive: safe(() => f.scanBonus && Date.now() < f.scanBonus.until ? f.scanBonus.mult : 1),
    },
    globalComponents: comp,
    cells: f.cells.map(cellDump),
  });
}

/* ============ §7 veins audit (истощение/кулдаун/реактивация) ============ */
sec('§7 veins audit (истощение/кулдаун/реактивация)');
{
  const { env, I, n, $ } = fresh();
  const f = $.ferrum;
  n.energy = 1e7;
  for (let cid = 1; cid < f.cells.length; cid++) if (!f.explored.has(cid)) I.Sd(f.cells[cid], { manual: false });
  const veins = f.cells.filter((c) => c.type === 3 || c.type === 5).map((c) => ({
    id: c.id, type: c.type, resourceKey: c.resourceKey, reserve: c.reserve, maxReserve: c.maxReserve,
    active_gt: I.gt(c), depletePerSec_ta: I.ta(c, f), reactivationCost_$n: I.$n(c, 'ferrum'),
    cooldownMs_$l: I.$l(c), Xs_mult: I.Xs(c), unlockReq_zr: I.zr(c), reactCount: c.reactCount || 0,
  }));
  // тиковый прогон: истощение жилы за 10 c (20 тиков по 500 мс)
  const v0 = f.cells.find((c) => (c.type === 3 || c.type === 5) && I.gt(c));
  let tickLog = [];
  if (v0) {
    const r0 = v0.reserve;
    let t = env.performance.now();
    for (let i = 0; i < 20; i++) {
      t += 500; env.__timeShift(500);
      n.lastTime = t - 500;
      I.C1(t);
      tickLog.push({ tick: i + 1, reserve: +v0.reserve.toFixed(6), cooldownUntil: v0.cooldownUntil || 0, reactCount: v0.reactCount || 0 });
    }
    tickLog.unshift({ tick: 0, reserve: r0 });
  }
  // кривая Xs (reactCount 0..15) и стоимости реактивации
  const xsCurve = [], reactCosts = [];
  if (v0) {
    for (let rc = 0; rc <= 15; rc++) { v0.reactCount = rc; xsCurve.push({ reactCount: rc, Xs: I.Xs(v0), reactivation: I.$n(v0, 'ferrum'), cooldownMs: I.$l(v0) }); }
    v0.reactCount = 0;
  }
  save('veins_audit_v0.0.41.json', {
    scenario: 'жилы: ожидаемо истощение 0.056/с (0.1×0.7×0.8), кулдаун 300с+150с×n, реактивация 65/101⚡, Xs min(14,1+0.55n)',
    veins: ser(veins), tickLog: ser(tickLog), xsCurve: ser(xsCurve),
    registryCells: { reactivation: env.VORONIA_BALANCE.core.reactivate, veinYieldGrowth: env.VORONIA_BALANCE.cells.veinYieldGrowth, veinReserveGrowth: env.VORONIA_BALANCE.cells.veinReserveGrowth },
  });
}

/* ============ §8 warehouse audit ============ */
sec('§8 warehouse audit');
{
  const { env, I, n, $ } = fresh();
  const f = $.ferrum;
  const reg = env.VORONIA_BALANCE.warehouse;
  const levels = [];
  for (let L = 0; L <= reg.upgradeMax; L++) {
    n.warehouseLevel = L;
    let vi, gi, ey, cap;
    try { vi = I.Vi(); } catch { vi = null; }
    try { gi = I.Gi(); } catch { gi = null; }
    try { ey = I.Ey('ferrum'); } catch { ey = null; }
    try { cap = I._y(f.cells[0]); } catch { cap = null; }
    levels.push({ L, Vi_tonsPerCell: vi, Gi_bonusMult: gi, Ey_ferrum_mass: ey, _y_cell0: cap, warehouseLevelBonus: I.L ? null : null });
  }
  n.warehouseLevel = 0;
  // стоимость апгрейда склада: ищем функцию через legacy/state
  const costProbe = {};
  try { costProbe.legacyWarehouseLevelBonus = env.__V.legacy.warehouseLevelBonus; } catch {}
  save('warehouse_audit_v0.0.41.json', {
    scenario: 'склад: ожидаемо Vi 10+5L т/ячейка, Gi ×(1+0.05L), Td {alloy (L+1)²·factor, energy ceil(800×1.6^L)}',
    registry: reg, levels, costProbe,
  });
}

/* ============ §9 research cells (type6) ============ */
sec('§9 research cells (type6)');
{
  const { env, I, n, $ } = fresh();
  const f = $.ferrum;
  const L = env.__V.legacy;
  const cell = f.cells[5]; cell.type = 6; cell.displayType = 6; f.explored.add(5); f.revealed.add(5);
  n.energy = 1e12; n.crystals = 1e9; n.research = 1e9; I.At('ferrum', 'silicon', 1e9);
  const rows = [];
  for (let lvl = 0; lvl < 15; lvl++) {
    const costExpected = L.researchCellCost ? ser(L.researchCellCost(lvl)) : null;
    const yieldExpected = L.researchCellYield ? L.researchCellYield({ level: lvl, type: 6 }) : null;
    const r = I.x0(cell, null, null);
    rows.push({ levelBefore: lvl, levelAfter: cell.level, cost: costExpected, yieldFn: yieldExpected, ok: r.ok, reason: r.reason || null, researchPerSec: n.researchPerSec });
    if (!r.ok) break;
  }
  save('research_cells_v0.0.41.json', {
    scenario: 'наука type6 линейна 5×L; cap 15 (cells.researchMaxLevel); кривая цены researchCellCost (25000×1.9^L ⚡, 15×1.7^L 💎, 150×1.9^L 🔬, silicon с L5)',
    rows, cap: L.RCELL_MAX_LEVEL, registryCells: ser(env.VORONIA_BALANCE.cells),
  });
}

/* ============ §10 RNG determinism ============ */
sec('§10 RNG determinism');
{
  const { env, I } = fresh();
  const seqs = {};
  for (const s of [1, 42, 777, 15929600, 13045769]) {
    const g = I.qe(s); const a = []; for (let i = 0; i < 8; i++) a.push(g());
    seqs[s] = a;
  }
  save('rng_determinism.json', { note: 'qe(seed) — mulberry32-совместимый PRNG 1.x; последовательности для parity-тестов детерминизма генератора', seqs, ferrumSeed: 15929600, kriosSeed: 13045769 });
}

/* ============ §11 planet generator samples (Этап 3) ============ */
sec('§11 planet generator samples (Этап 3)');
{
  const samples = [];
  for (const seed of [101, 202, 303, 404, 505, 606]) {
    const { env, I, L, n, $ } = fresh();
    const p = env.GAME.discoverPlanet({ name: 'Ген-Тест', seed });
    samples.push({ seed, planet: planetDump(p), graph: ser(env.GAME.PlanetaryGraph.nodes[p.id]) });
  }
  save('planetgen_samples.json', { note: 'детерминизм: одинаковый seed → одинаковая планета (ТЗ §5.4); GAME.discoverPlanet', samples });
  // повторная проверка детерминизма: тот же seed во втором буте
  const { env: e2 } = fresh();
  const p2 = e2.GAME.discoverPlanet({ name: 'Ген-Тест', seed: 101 });
  if (!p2) throw new Error('planetAdd returned falsy on second boot');
  if (!p2.explored) { try { p2.initStart(); } catch (e) { console.log('initStart fail:', e.message); } }
  const d2 = planetDump(p2);
  const match = JSON.stringify(d2.cells) === JSON.stringify(samples[0].planet.cells) && d2.seed === samples[0].planet.seed && d2.geometry === samples[0].planet.geometry;
  save('planetgen_determinism_check.json', { seed: 101, secondBootCellsMatch: match, geometry: d2.geometry, biome: d2.biome, descriptors: d2.descriptors, armId: d2.armId });
}

/* ============ §12 galaxy graph / arms / roles ============ */
sec('§12 galaxy graph / arms / roles');
{
  const { env, I, L, n, $ } = fresh();
  const arms = { CC_ARMS: ser(env.CC_ARMS), CC_CORE: ser(env.CC_CORE), CC_SPIRAL: ser(env.CC_SPIRAL), CC_INTERARM: ser(env.CC_INTERARM), armSpan: typeof env.__LvArmSpan === 'function' ? env.__LvArmSpan() : null };
  // er() — спираль: сэмплируем значения
  let erSamples = null;
  try { erSamples = [0, 0.25, 0.5, 0.75, 1, 2, 3].map((x) => ({ x, er: I.er(x) })); } catch (e) { erSamples = String(e.message); }
  save('galaxy_arms.json', { arms, erSamples, roles: ser(L.ROLES), ferrumArm: $.ferrum.armId, armIdForPosFerrum: L.armIdForPos ? null : null, registryGalaxy: ser(env.VORONIA_BALANCE.galaxy), registryRoles: ser(env.VORONIA_BALANCE.roles) });
}

/* ============ §13 golden save midgame (синтез) ============ */
sec('§13 golden save midgame (синтез)');
{
  const { env, I, n, $ } = fresh();
  const f = $.ferrum;
  n.energy = 1e7; I.At('ferrum', 'iron', 1e6); n.iron = 1e6;
  for (let cid = 1; cid < f.cells.length; cid++) if (!f.explored.has(cid)) I.Sd(f.cells[cid], { manual: false });
  for (let up = 0; up < 5; up++) I.Ni(f.cells[0], 'ferrum', { countSession: true });
  n.warehouseLevel = 3; n.energy = 12345; n.research = 678;
  I.ce();
  env.__V.save.saveGame(true);
  const raw = env.localStorage.getItem('cosmicClickerV19');
  save('golden_save_midgame_v0.0.41.json', JSON.parse(raw));
}

/* ============ §14 bus events catalog ============ */
sec('§14 bus events catalog');
{
  const { env, I, n, $ } = fresh();
  const f = $.ferrum;
  n.energy = 1e7;
  I.Sd(f.cells[1], { manual: true });
  I.Ni(f.cells[0], 'ferrum', {});
  save('bus_events.json', { history: busTail(env, 40), note: 'payload-структуры событий cell:scanned / cell:upgraded и др.' });
}


/* ============ §15 documented midgame income (42 / 0.69 / 0.002) ============ */
sec('§15 documented midgame income');
{
  const { env, I, n, $ } = fresh();
  const f = $.ferrum;
  n.energy = 1e7; I.At('ferrum', 'iron', 1e6); n.iron = 1e6;
  // GS-03 trail + GS-04 upgrades — состояние документированного midgame
  for (const cid of [1, 2, 3]) I.Sd(f.cells[cid], { manual: false });
  for (let up = 0; up < 5; up++) I.Ni(f.cells[0], 'ferrum', { countSession: true });
  // compound-бонус в капе ×6 (steel 1000 × 0.005 = 5 → min(5,5))
  n.compoundResources.steel = (n.compoundResources.steel || 0) + 1000;
  I.ce();
  const ngBreakdown = safe(() => I.tk ? I.tk() : null);
  save('income_midgame_documented.json', {
    scenario: 'README parity: midgame-ferrum 42⚡/с = 7 × compound 6; 0.69⛏/с = 0.115 × 6; 0.002🔬/с (2 type0 × 0.001)',
    state: { explored: [...f.explored], cell0Level: f.cells[0].level, cell0Yield: f.cells[0].yield, steel: n.compoundResources.steel },
    compoundBonusMult: safe(() => I.Ac()),
    income: { energyPerSec: n.energyPerSec, ironPerSec: n.ironPerSec, kriogenPerSec: n.kriogenPerSec, crystalsPerSec: n.crystalsPerSec, researchPerSec: safe(() => I.ng()), planetIncome: ser(n.planetIncome) },
    research: { perSec: safe(() => I.ng()), breakdown: ngBreakdown, globalMult: safe(() => I.Yu()), capConstants: { Zu: safe(() => I.Zu), ef: safe(() => I.ef) }, RCELL_PER_LEVEL: env.__V.legacy.RCELL_PER_LEVEL, RCELL_MAX_LEVEL: env.__V.legacy.RCELL_MAX_LEVEL },
    cells: f.cells.map(cellDump),
  });
}

/* ============ §16 warehouse exact curve ============ */
sec('§16 warehouse curve');
{
  const { env, I, n, $ } = fresh();
  const f = $.ferrum;
  const Ls = env.VORONIA_BALANCE.warehouse.upgradeMax;
  const rows = [];
  for (let L = 0; L <= Ls; L++) {
    n.warehouseLevel = L;
    rows.push({
      L, Td: ser(safe(() => I.Td(L))), Vi: safe(() => I.Vi()), Gi: safe(() => I.Gi()),
      Hf_ferrum: safe(() => I.Hf(f)), warehouseLevelBonus: safe(() => env.__V.legacy.warehouseLevelBonus()),
    });
  }
  n.warehouseLevel = 0;
  // веса грузов dn(key)
  const weights = {};
  for (const k of Object.keys(I.RES)) weights[k] = safe(() => I.dn(k));
  save('warehouse_curve_v0.0.41.json', {
    note: 'Td(L)={alloy:ceil(2(L+1)²/2·ov), energy:ceil(800·1.6^L·ov)}; Vi=10+5L; Gi=1+0.05L; Hf=explored×Vi×mt; Ey=Σ storage×dn',
    rows, cargoWeights: weights, registry: env.VORONIA_BALANCE.warehouse, ov: safe(() => I.ov()), Ls,
  });
}

/* ============ §17 anomalies + galaxy arms ============ */
sec('§17 anomalies + galaxy');
{
  const { env, I, n, $ } = fresh();
  save('anomaly_types.json', { Ho: ser(safe(() => I.Ho)), rw_perkAnomalyMult: safe(() => env.__V.economy.researchPerkAnomalyMult()), fm_sleepMult_ferrum: safe(() => I.fm($.ferrum)) });
  save('galaxy_arms_full.json', {
    core_Df: ser(safe(() => I.Df)), inter_Za: ser(safe(() => I.Za)), spiral_Lr: ser(safe(() => I.Lr)),
    armsConstants_Fn: ser(safe(() => I.Fn)), registryGalaxy: ser(env.VORONIA_BALANCE.galaxy),
    CC_ARMS: ser(env.CC_ARMS), CC_CORE: ser(env.CC_CORE), CC_SPIRAL: ser(env.CC_SPIRAL), CC_INTERARM: ser(env.CC_INTERARM),
    erSamples: safe(() => [{ x: { x: 0, z: 0 }, arm: I.er({ x: 0, z: 0 }) }, { x: { x: 3, z: 0.6 }, arm: I.er({ x: 3, z: 0.6 }) }, { x: { x: -2.6, z: 0.4 }, arm: I.er({ x: -2.6, z: 0.4 }) }, { x: { x: 12, z: 9 }, arm: I.er({ x: 12, z: 9 }) }]),
    graphNodes: ser(env.GAME.PlanetaryGraph.nodes),
    nodeCosts: safe(() => { const out = {}; for (let i = 3; i <= 12; i++) out[i] = ser(env.__V.legacy.planetNodeCost(i)); return out; }),
  });
}

console.log('=== FIXTURES WRITTEN ===');
results.forEach((r) => console.log(' -', r));
process.exit(0);
