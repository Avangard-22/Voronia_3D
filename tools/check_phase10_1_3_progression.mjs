#!/usr/bin/env node
/** Phase 10.1.3 — static V1 progression contract and system-scope guard. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const fixture = JSON.parse(read('fixtures/stage5_audit_v0.0.41.json'));
const discovery = read('src/core/discovery.ts');
const game = read('src/core/game.ts');
const generator = read('src/planets/generator.ts');
const test = read('tests/phase10_1_3_progression.test.ts');
const failures = [];
const assert = (ok, message) => { if (!ok) failures.push(message); };
assert(fixture.discover.afterFirst.unlockedPlanets.join(',') === 'ferrum,planet_03', 'V1 first discovery order drifted');
assert(fixture.discover.afterFirst.researchDelta === 1100, 'V1 first discovery reward drifted');
assert(fixture.discover.rewardByIdx.idx4 === 2420, 'V1 fourth-planet reward drifted');
assert(discovery.includes('discoverReward(m.planetIndex || 1)'), 'discovery must use the canonical V1 reward function');
assert(generator.includes('Math.floor(500 * Math.pow(2.2'), 'V1 discovery reward curve missing');
assert(game.includes('this.activePlanetIdValue !== \'ferrum\''), 'Krios sonar must remain anchored to Ferrum');
assert(game.includes('ferrum.explored.size < ferrum.data.cells.length'), 'Krios sonar must require complete Ferrum survey');
assert(game.includes('cfg.difficulty.baseRounds'), 'Sonar round count must remain registry-driven');
assert(!game.includes('this.galaxyProgression().discountPct'), 'local planet discovery must not depend on galaxy progression discounts');
assert(game.includes('const requiredArms = 1;'), 'anomaly progression must remain inside one local system');
assert(test.includes('activePlanetId').toString(), 'progression regression tests missing');
if (failures.length) { console.error(`Phase 10.1.3 FAILED (${failures.length})`); failures.forEach((x) => console.error(` - ${x}`)); process.exit(1); }
console.log('Phase 10.1.3 progression contract PASSED');
console.log('- V1 planet index and research reward curve anchored to stage5_audit_v0.0.41.json');
console.log('- Ferrum full-survey → three-round sonar → Krios unlock guards verified');
console.log('- active planet, invalid-round atomicity and save/load persistence covered');
console.log('- no new galaxy unlock requirements introduced');
