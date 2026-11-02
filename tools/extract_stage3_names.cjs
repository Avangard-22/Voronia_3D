/* Voronia 2.0 · tools/extract_stage3_names.cjs (Этап 3)
 * Дополнение к planetgen_samples: сэмплы Этапа 0 создавались с явным именем «Ген-Тест»,
 * поэтому Rf (авто-имена), Br для planet_04+, unique-ветка и lastVoronia-ветка не покрыты.
 * Один бут → последовательные discoverPlanet (idx 3..N), детерминированный Math.random.
 * Выход: fixtures/planetgen_named_v0.0.41.json — ТОЛЬКО ЧТЕНИЕ для кода 2.0 (ADR-011).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { boot, startGame } = require('./harness/boot.cjs');

const OUT = path.join(__dirname, '..', 'fixtures');
fs.mkdirSync(OUT, { recursive: true });
const RANDOM_SEED = 20260102;

const { env, errors } = boot({ quiet: true, randomSeed: RANDOM_SEED });
if (errors.length) throw new Error('layer errors: ' + JSON.stringify(errors));
if (!startGame(env)) throw new Error('game failed to start');
const GAME = env.GAME;

function dump(p) {
  const node = GAME.PlanetaryGraph.nodes[p.id];
  return {
    id: p.id, seed: p.seed, planetIndex: p.planetIndex, name: p.name, isUnique: !!p.isUnique,
    geometry: p.geometry, f: p.f, biome: p.biome, armId: p.armId || null,
    resourceList: [...(p.resourceList || [])],
    cellCount: (p.cells || []).length,
    startingCellId: p.startingCellId,
    _mixed: !!p._mixed,
    node: node ? { x: node.x, y: node.y, z: node.z, armId: node.armId } : null,
    edgesAfter: GAME.PlanetaryGraph.edges.map((e) => [...e]),
  };
}

// 1) последовательные открытия: idx 3..16 (включает lastVoronia-ветку на idx 15)
const SEEDS = [101, 202, 303, 404, 505, 606, 707, 808, 909, 1010, 1111, 1212, 1313, 1414];
const sequential = [];
for (const seed of SEEDS) {
  const p = GAME.discoverPlanet({ seed });
  if (!p) throw new Error('discoverPlanet returned falsy for seed ' + seed);
  sequential.push(dump(p));
}

// 2) unique-миры: скан 5000 seed по формуле Jo (qe(seed^1431193937)()<0.02), берём первые 6
const uniqueChance = env.VORONIA_BALANCE.planet.uniqueChance;
function isUniq(s) {
  let t = ((s >>> 0) ^ 1431193937) >>> 0;
  t = (t + 1831565813) | 0;
  let o = Math.imul(t ^ (t >>> 15), 1 | t);
  o = (o + Math.imul(o ^ (o >>> 7), 61 | o)) ^ o;
  return (((o ^ (o >>> 14)) >>> 0) / 4294967296) < uniqueChance;
}
const uniqueSeeds = [];
for (let s = 1; s <= 5000 && uniqueSeeds.length < 6; s++) if (isUniq(s)) uniqueSeeds.push(s);
const uniques = [];
for (const seed of uniqueSeeds) {
  const p = GAME.discoverPlanet({ seed });
  if (!p) throw new Error('discoverPlanet returned falsy for unique seed ' + seed);
  uniques.push(dump(p));
}

const out = {
  note: 'Этап 3: авто-имена (Rf), позиции Br для planet_04+, unique-ветка (Jo/VorResRoll uniqueBonus), lastVoronia idx15. Один бут, последовательные discoverPlanet.',
  uniqueChance,
  uniqueSeedsFound: uniqueSeeds,
  sequential,
  uniques,
};
const p = path.join(OUT, 'planetgen_named_v0.0.41.json');
fs.writeFileSync(p, JSON.stringify(out, null, 1));
console.log('saved', p, fs.statSync(p).size, 'B; sequential:', sequential.length, 'uniques:', uniques.length);
process.exit(0);
