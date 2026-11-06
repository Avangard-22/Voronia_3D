import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
const root = process.cwd();
const required = [
  'src/economy/synth.ts',
  'tests/phase10_1_13_gap_closure.test.ts',
  'fixtures/golden_save_fresh_v0.0.41.json',
  'fixtures/golden_save_midgame_v0.0.41.json',
  'docs/PHASE10_1_13_REPORT.md',
];
const missing = required.filter((p) => !existsSync(join(root, p)));
if (missing.length) { console.error('FAIL missing:', missing.join(', ')); process.exit(1); }
const synth = readFileSync(join(root, 'src/economy/synth.ts'), 'utf8');
const tests = readFileSync(join(root, 'tests/phase10_1_13_gap_closure.test.ts'), 'utf8');
const checks = [
  ['dedicated Ay offline method', /tickOffline\(/.test(synth)],
  ['offlineCapMult applied in synth service', /offlineCapMult/.test(synth)],
  ['fresh and midgame golden replay cases', /golden_save_fresh_v0\.0\.41\.json/.test(tests) && /golden_save_midgame_v0\.0\.41\.json/.test(tests)],
  ['legacy load and v2 rewrite asserted', /LEGACY_SAVE_KEY/.test(tests) && /SAVE_KEY/.test(tests)],
];
for (const [name, ok] of checks) console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
if (checks.some(([, ok]) => !ok)) process.exit(1);
console.log('PASS Phase 10.1.13 structural gate');
