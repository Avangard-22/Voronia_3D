#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const required = [
  ['10.1.2 core loop', 'tests/phase10_1_2_core_loop_parity.test.ts', 'scan: preserves V1 price growth'],
  ['10.1.3 progression', 'tests/phase10_1_3_progression.test.ts', 'requires full Ferrum exploration'],
  ['10.1.4 planet storage', 'tests/phase10_1_4_planet_storage.test.ts', 'swaps iron/kriogen/extra resources'],
  ['10.1.5 warehouse', 'tests/phase10_1_5_warehouse_parity.test.ts', 'capacity and used mass'],
  ['10.1.6 special cells', 'tests/phase10_1_6_special_cells.test.ts', 'migrates anomaly branch'],
  ['10.1.7 synthesizer/mutants', 'tests/phase10_1_7_synth_mutant_parity.test.ts', 'synthesizes only for the active planet'],
  ['10.1.8 offline progression', 'tests/phase10_1_8_offline_progression.test.ts', 'applies capped offline reactor progress once'],
  ['10.1.9 timed effects', 'tests/phase10_1_9_timed_effects.test.ts', 'skips missed offline surges'],
  ['10.1.10 save integrity', 'tests/phase10_1_10_save_integrity.test.ts', 'does not mutate live game state when stored save is corrupt'],
];
for (const [label, file, marker] of required) {
  assert.ok(fs.existsSync(path.join(root, file)), `${label}: missing test file`);
  assert.ok(read(file).includes(marker), `${label}: expected golden assertion missing`);
}
const golden = read('docs/GOLDEN_SCENARIOS.md');
for (const id of ['GS-00','GS-01','GS-02','GS-03','GS-04','GS-05','GS-06','GS-07','GS-08','GS-09','GS-10','GS-11','GS-12','GS-13','GS-14','GS-15','GS-16','GS-17']) {
  assert.ok(golden.includes(id), `Golden scenario ${id} missing`);
}
const pkg = JSON.parse(read('package.json'));
assert.equal(pkg.scripts['check:phase10.1.11'], 'node tools/check_phase10_1_11_regression.mjs');
console.log('Phase 10.1.11 regression inventory PASSED');
console.log(`- ${required.length} phase test suites linked (10.1.2–10.1.10)`);
console.log('- Golden scenario inventory GS-00…GS-17 present');
console.log('- Runtime execution remains a separate Vitest/CI gate');
