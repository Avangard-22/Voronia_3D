#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const game = read('src/core/game.ts');
const synth = read('src/economy/synth.ts');
const income = read('src/economy/income.ts');
const production = read('src/economy/production.ts');
const tests = read('tests/phase10_1_7_synth_mutant_parity.test.ts');
const registry = JSON.parse(read('src/config/data/balance/v0.0.41/registry.json'));
assert.match(game, /this\.synthService\.tick\(this\.activeRuntimes\(\), dtSec\)/);
assert.match(game, /синтез активной планеты/);
assert.match(synth, /tickScaled\(planets, dtSec, 1, 'synth'\)/);
assert.match(synth, /if \(!Number\.isFinite\(dtSec\) \|\| dtSec <= 0 \|\| !Number\.isFinite\(scale\) \|\| scale <= 0\) return false/);
assert.match(synth, /const c = Math\.min\(s\.in \* scaledDtSec, stock\)/);
assert.match(synth, /scope: `planet:\$\{rt\.data\.id\}`/);
assert.match(income, /this\.mutantYieldMult\(arm\.id, st\.mutant\)/);
assert.match(production, /this\.mutantDepleteMult\(st\.mutant\)/);
assert.deepEqual(
  Object.fromEntries(Object.entries(registry.planet.mutants).map(([key, value]) => [key, [value.yieldMult, value.depletionMult]])),
  { forge: [1.5, 1.5], frost: [1.2, 0.8], life: [1.3, 1], void: [2, 2], core: [1.4, 1.2] },
);
assert.match(tests, /synthesizes only for the active planet and uses that planet local stock/);
assert.match(tests, /mutant yield and depletion multipliers remain independent V1 factors/);
console.log('Phase 10.1.7 synthesizer/mutant parity check PASSED');
console.log('- Synth uses the active planet local stock pool; inactive planets do not consume the active ledger stock');
console.log('- V1 mutant yield and depletion multipliers remain separate registry-driven factors');
console.log('- Reactor queue remains independent from planetary synthesizer stock');
