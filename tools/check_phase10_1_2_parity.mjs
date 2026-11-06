#!/usr/bin/env node
/** Static integrity gate for the Phase 10.1.2 V1 core-loop parity lock. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const failures = [];
const assert = (ok, message) => { if (!ok) failures.push(message); };
const parityTest = read('tests/phase10_1_2_core_loop_parity.test.ts');
const report = read('docs/PHASE_10_1_2_CORE_LOOP_PARITY_LOCK.md');
const packageJson = JSON.parse(read('package.json'));
for (const token of ['gs03_scan_trail.json', 'gs04_upgrade_curve.json', 'activeDepletePerSec', 'reactivateCell', 'cooldown']) {
  assert(parityTest.includes(token), `parity regression suite missing ${token}`);
}
for (const fixture of ['fixtures/gs03_scan_trail.json', 'fixtures/gs04_upgrade_curve.json', 'fixtures/golden_save_fresh_v0.0.41.json', 'fixtures/golden_save_midgame_v0.0.41.json']) {
  assert(fs.existsSync(path.join(root, fixture)), `missing golden fixture ${fixture}`);
}
assert(['2.0.0-phase10.1.2', '2.0.0-phase10.1.3', '2.0.0-phase10.1.5', '2.0.0-phase10.1.6', '2.0.0-phase10.1.7', '2.0.0-phase10.1.8', '2.0.0-phase10.1.9', '2.0.0-phase10.1.10', '2.0.0-phase10.1.11', '2.0.0-phase10.1.12', '2.0.0-phase10.1.13'].includes(packageJson.version), 'package version is not Phase 10.1.2 or a later phase');
assert(report.includes('single planetary system'), 'scope lock missing from report');
assert(packageJson.scripts['check:phase10.1.2'] === 'node tools/check_phase10_1_2_parity.mjs', 'missing phase check script');
if (failures.length) {
  console.error(`Phase 10.1.2 parity check FAILED (${failures.length})`);
  failures.forEach((x) => console.error(` - ${x}`));
  process.exit(1);
}
console.log('Phase 10.1.2 parity integrity check PASSED');
console.log('- Golden scan and upgrade trails referenced');
console.log('- Vein extraction, cooldown and reactivation lifecycle covered');
console.log('- V1 v0.0.41 and single-system scope retained');
