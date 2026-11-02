/* Voronia 2.0 · tools/extract_stage5.cjs (Этап 5 — type7-доход, discoverPlanet, setActivePlanet)
 * Золотой аудит поведения 1.x v0.0.41 через реальные функции бандла (window.__INT + window.GAME):
 *   type7 «ядро грани»: Ur=core.baseYield(100), энергия ×Ws ВСЕГДА (не зависит от isDeep),
 *     кристаллы core.crystalRate(0.03)×кристальная цепь (ce @125605);
 *   discoverPlanet (@103509): id planet_NN (Fr+1), награда floor(500×2.2^max(0,idx−2))🔬,
 *     unlockedPlanets.add, bus planet:discovered, session.planetsUnlocked, узел графа Yf;
 *   setActivePlanet (@112270): guard PLANETS+unlockedPlanets; On()/yy() — СВОП storage
 *     (iron/kriogen/extraResources глобальные ↔ планетные; TV-25/Этап 9); rotX/rotY/selectedCellId/planetPage.
 * Время: Date.now заморожен (NOW). Выход: fixtures/stage5_audit_v0.0.41.json — ТОЛЬКО ЧТЕНИЕ (ADR-011).
 * Запуск: node tools/extract_stage5.cjs (~15 с; нужен ../uploads/*.html через harness).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { boot, startGame } = require('./harness/boot.cjs');

const OUT = path.join(__dirname, '..', 'fixtures');
fs.mkdirSync(OUT, { recursive: true });
const RANDOM_SEED = 20260501;
let NOW = 1800000000000;

const { env, errors } = boot({ quiet: true, randomSeed: RANDOM_SEED });
if (errors.length) throw new Error('layer errors: ' + JSON.stringify(errors));
if (!startGame(env)) throw new Error('game failed to start');

const BaseD = env.Date;
env.Date = class extends BaseD { static now() { return NOW; } };

const I = env.__INT;
const n = I.state;
const $ = I.planets;
const GAME = env.GAME;
const V = env.__V;
const BAL = env.VORONIA_BALANCE;

const out = {
  note: 'Этап 5 — золотой аудит type7-дохода, discoverPlanet, setActivePlanet (реальные функции 1.x, замороженное время)',
  extractedAt: 'NOW=' + NOW,
  randomSeed: RANDOM_SEED,
  bundle: 'Voronia_2.5D_Hybrid_v0.0.41_PROD.html (uploads/, не изменён)',
  missing: [],
};
function safe(fn, fallback) { try { const v = fn(); return v === undefined ? (fallback === undefined ? null : fallback) : v; } catch (e) { return { _error: String((e && e.message) || e).slice(0, 160) }; } }
function gi(name) { try { const v = I[name]; if (v === undefined) { out.missing.push(name); return undefined; } return v; } catch (e) { out.missing.push(name + ':' + String(e.message).slice(0, 40)); return undefined; } }
function inc() { I.ce(); return { energyPerSec: n.energyPerSec, ironPerSec: n.ironPerSec, kriogenPerSec: n.kriogenPerSec, crystalsPerSec: n.crystalsPerSec, researchPerSec: n.researchPerSec, energyByType: JSON.parse(JSON.stringify(n.energyByType || {})) }; }

// — конфиг
out.config = {
  baseYield: safe(() => gi('Ao')), crystalRate: safe(() => gi('Ys')), Ws: safe(() => I.Ws()),
  hiddenId: safe(() => gi('Bs')), hiddenWorldIndex: BAL.planet.hiddenWorldIndex,
  ur7: safe(() => I.Ur({ type: 7 })), ur1: safe(() => I.Ur({ type: 1, _memberCount: 1 })),
  ur0_L3: safe(() => I.Ur({ type: 0, level: 3, _memberCount: 1 })),
  ur7_member: safe(() => I.Ur({ type: 7, _memberCount: 3 })), // type7 НЕ умножается на _memberCount
};

// — §type7: мутация исследованной клетки ferrum в type7
{
  const t7 = {};
  const rt = $.ferrum;
  const cellId = 0; // s0 (type0 L0, исследована)
  const cell = rt.cells[cellId];
  const orig = { type: cell.type, level: cell.level, isDeep: cell.isDeep };
  const before = inc();
  cell.type = 7; cell.isDeep = false;
  const asType7 = inc();
  cell.isDeep = true;
  const asType7deep = inc();
  cell.type = orig.type; cell.level = orig.level; cell.isDeep = orig.isDeep;
  const restored = inc();
  t7.before = before;
  t7.type7 = asType7;
  t7.type7_deep = asType7deep;
  t7.restored = restored;
  t7.deltaEnergy = asType7.energyPerSec - before.energyPerSec; // ждём 200−1=199 (100×Ws(2) − базовая 1)
  t7.deltaCrystals = asType7.crystalsPerSec - before.crystalsPerSec; // ждём +0.03×цепь
  t7.deepInvariance = asType7deep.energyPerSec === asType7.energyPerSec && asType7deep.crystalsPerSec === asType7.crystalsPerSec;
  t7.energyByType7 = asType7.energyByType['7'] ?? null;
  out.type7 = t7;
}

// — §discover: discoverPlanet c фиксированными seed
{
  const d = {};
  d.before = {
    research: n.research, researchTotal: n.researchTotal, Fr: safe(() => I.Fr()),
    unlockedPlanets: [...n.unlockedPlanets], planetsUnlocked: n.gameSession ? n.gameSession.planetsUnlocked : null,
    planetsKeys: Object.keys($),
  };
  const busBefore = safe(() => V.bus.history(60).length);
  const p3 = safe(() => GAME.discoverPlanet({ seed: 777001, name: 'Гелика-Прайм' }));
  d.first = p3 && p3 !== null && !p3._error ? {
    id: p3.id, planetIndex: p3.planetIndex, name: p3.name, biome: p3.biome, f: p3.f,
    geometry: p3.geometry, geometryName: p3.geometryName, seed: p3.seed >>> 0, armId: p3.armId,
    role: p3.role || null, isUnique: !!p3.isUnique, cellCount: p3.cells.length,
    resourceList: [...(p3.resourceList || [])],
    explored: [...(p3.explored || [])], startingCellId: p3.startingCellId ?? null,
    storage: p3.storage ? { iron: p3.storage.iron, kriogen: p3.storage.kriogen } : null,
  } : p3;
  d.afterFirst = {
    research: n.research, researchTotal: n.researchTotal,
    researchDelta: n.research - d.before.research, // ждём 1100 = floor(500×2.2^1)
    unlockedPlanets: [...n.unlockedPlanets],
    planetsUnlocked: n.gameSession ? n.gameSession.planetsUnlocked : null,
    activePlanetId: n.activePlanetId, // НЕ переключается автоматически
    node: safe(() => { const g = GAME.PlanetaryGraph; const nn = g && g.nodes && g.nodes[d.first.id]; return nn ? { id: nn.id, x: nn.x, y: nn.y, z: nn.z, armId: nn.armId, discovered: nn.discovered, biome: nn.biome } : null; }),
    edges: safe(() => JSON.parse(JSON.stringify(GAME.PlanetaryGraph.edges))),
  };
  d.busTail = safe(() => {
    const h = V.bus.history(60) || [];
    return JSON.parse(JSON.stringify(h.slice(busBefore ?? Math.max(0, h.length - 8))));
  });
  const rBefore4 = n.research;
  const p4 = safe(() => GAME.discoverPlanet({ seed: 888002 }));
  d.second = p4 && !p4._error ? { id: p4.id, planetIndex: p4.planetIndex, biome: p4.biome, f: p4.f, geometry: p4.geometry, seed: p4.seed >>> 0, armId: p4.armId, name: p4.name } : p4;
  d.secondRewardDelta = n.research - rBefore4; // ждём 2420 = floor(500×2.2^2)
  const rBefore5 = n.research;
  const p5 = safe(() => GAME.discoverPlanet({ seed: 999003, geometry: 'cube', frequency: 2, biome: 'ferrum' }));
  d.override = p5 && !p5._error ? { id: p5.id, geometry: p5.geometry, f: p5.f, biome: p5.biome, armId: p5.armId, resourceList: [...(p5.resourceList || [])] } : p5; // biome ferrum → ресурсы НЕ переназначаются рукавом
  d.overrideRewardDelta = n.research - rBefore5;
  d.researchFinal = n.research;
  out.discover = d;
}
// явная фиксация наград (порядок вызовов выше мог смешать дельты)
out.discover.rewardByIdx = safe(() => {
  const g = (idx) => Math.floor(500 * Math.pow(2.2, Math.max(0, idx - 2)));
  return { idx1: g(1), idx2: g(2), idx3: g(3), idx4: g(4), idx5: g(5), idx6: g(6) };
});

// — §setActive: переключение + своп storage (On/yy)
{
  const a = {};
  n.iron = 1234; n.kriogen = 77;
  I.On(); // зафиксировать глобальные запасы в storage ferrum (как перед свитчем)
  a.ferrumStorageAfterOn = { iron: $.ferrum.storage.iron, kriogen: $.ferrum.storage.kriogen };
  a.globalAfterOn = { iron: n.iron, kriogen: n.kriogen };
  const pid3 = out.discover.first.id;
  a.targetStorageBefore = safe(() => ({ iron: $[pid3].storage.iron, kriogen: $[pid3].storage.kriogen }));
  a.switchToDiscovered = safe(() => GAME.setActivePlanet(pid3)); // true
  a.after = {
    activePlanetId: n.activePlanetId, iron: n.iron, kriogen: n.kriogen,
    selectedCellId: n.selectedCellId, planetPage: n.planetPage, rotX: n.rotX, rotY: n.rotY,
    offlinePlanetId: n.offlinePlanetId,
  };
  a.switchToLockedKrios = safe(() => GAME.setActivePlanet('krios')); // false (не открыта)
  a.afterLocked = { activePlanetId: n.activePlanetId };
  a.switchToUnknown = safe(() => GAME.setActivePlanet('nope')); // false
  a.switchBack = safe(() => GAME.setActivePlanet('ferrum')); // true
  a.backAfter = { activePlanetId: n.activePlanetId, iron: n.iron, kriogen: n.kriogen }; // своп обратно → 1234/77
  out.setActive = a;
}

// — §hiddenWorld: формула seed (sm() не вызываем — недра UI-потока)
out.hidden = {
  id: out.config.hiddenId, worldIndex: out.config.hiddenWorldIndex,
  seedFormula: '(gameStartSeed ^ 1212761156) >>> 0', f: 6, geometry: 'icosahedron',
  biome: 'hidden', armId: 'void', node: { x: 0, y: 12, z: 0 },
  seedForCurrentGame: safe(() => (n.gameStartSeed ^ 1212761156) >>> 0),
  gameStartSeed: n.gameStartSeed,
  codeAnchor: 'sm() @384269',
};

out.stateFinal = {
  research: n.research, energy: n.energy, iron: n.iron, kriogen: n.kriogen, crystals: n.crystals,
  unlockedPlanets: [...n.unlockedPlanets], activePlanetId: n.activePlanetId,
  planetsUnlocked: n.gameSession ? n.gameSession.planetsUnlocked : null,
};

fs.writeFileSync(path.join(OUT, 'stage5_audit_v0.0.41.json'), JSON.stringify(out, null, 1));
console.log('OK → fixtures/stage5_audit_v0.0.41.json; missing:', out.missing.length ? out.missing.join(',') : '—');
process.exit(0);
