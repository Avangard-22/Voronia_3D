#!/usr/bin/env node
/** Phase 10.1.1 — integrity checks for the V1.0.41 golden runtime baseline. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (name) => JSON.parse(fs.readFileSync(path.join(root, 'fixtures', name), 'utf8'));
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };

for (const [name, expected] of [
  ['golden_save_fresh_v0.0.41.json', { energy: 0.504, research: 0.000504, currentCost: 10, warehouseLevel: 0, explored: 1, revealed: 6 }],
  ['golden_save_midgame_v0.0.41.json', { energy: 12345, iron: 999664, research: 678, currentCost: 33, warehouseLevel: 3, explored: 12, revealed: 12 }],
]) {
  const save = read(name);
  assert(save.version === 39, `${name}: expected legacy save version 39`);
  assert(save.gameVersion === '0.0.41.0', `${name}: expected gameVersion 0.0.41.0`);
  assert(save.activePlanetId === 'ferrum', `${name}: expected active planet ferrum`);
  assert(Array.isArray(save.unlockedPlanets) && save.unlockedPlanets.includes('ferrum'), `${name}: ferrum must remain unlocked`);
  for (const [key, value] of Object.entries(expected)) {
    if (key === 'explored' || key === 'revealed') {
      const actual = save.planets?.ferrum?.[key];
      assert(Array.isArray(actual) && actual.length === value, `${name}: ferrum.${key} expected ${value}, got ${Array.isArray(actual) ? actual.length : 'invalid'}`);
    } else {
      assert(save[key] === value, `${name}: ${key} expected ${value}, got ${save[key]}`);
    }
  }
  assert(save.planets?.krios?.seed === 13045769, `${name}: Krios seed drifted`);
  assert(save.planets?.ferrum?.seed === 15929600, `${name}: Ferrum seed drifted`);
}

const scenarios = read('gs01_fresh_state.json');
assert(scenarios && typeof scenarios === 'object', 'GS-01 fresh-state fixture must be readable');
const parity = JSON.parse(fs.readFileSync(path.join(root, 'docs', 'STAGE10_0_1_PARITY_MATRIX.json'), 'utf8'));
assert(parity.targetBaseline === 'V1 v0.0.41.0', 'parity matrix target baseline drifted');
assert(Array.isArray(parity.systems) && parity.systems.length >= 20, 'parity matrix unexpectedly incomplete');

if (failures.length) {
  console.error(`Phase 10.1.1 baseline check FAILED (${failures.length})`);
  for (const failure of failures) console.error(` - ${failure}`);
  process.exit(1);
}
console.log('Phase 10.1.1 baseline check PASSED');
console.log('- V1 v0.0.41.0 fresh and mid-game golden saves: valid');
console.log('- Ferrum/Krios seeds, exploration state, economy and progression anchors: stable');
console.log(`- V1/V2 parity matrix: ${parity.systems.length} systems tracked`);
