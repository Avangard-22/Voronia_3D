#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const matrix = JSON.parse(read('docs/PHASE10_1_12_PARITY_MATRIX.json'));
assert.equal(matrix.phase, '10.1.12');
assert.equal(matrix.baseline.v1, 'v0.0.41.0');
assert.equal(matrix.baseline.save_schema, 39);
const counts = { PASS: 0, PARTIAL: 0, GAP: 0, BLOCKED: 0 };
const ids = new Set();
for (const item of matrix.mechanics) {
  assert.ok(item.id && !ids.has(item.id), `duplicate/missing mechanic id: ${item.id}`);
  ids.add(item.id);
  assert.ok(Object.hasOwn(counts, item.status), `${item.id}: invalid status`);
  counts[item.status]++;
  assert.ok(item.evidence.length, `${item.id}: evidence required`);
  for (const ref of item.evidence) {
    const file = ref.split('#')[0];
    assert.ok(fs.existsSync(path.join(root, file)), `${item.id}: missing evidence ${file}`);
  }
}
for (const key of Object.keys(counts)) assert.equal(matrix.summary[key], counts[key], `${key} summary mismatch`);
assert.equal(matrix.summary.total, matrix.mechanics.length);
assert.ok(counts.GAP > 0 && counts.PARTIAL > 0 && counts.BLOCKED > 0, 'audit must preserve known unresolved work');
const game = read('src/core/game.ts');
const synth = read('src/economy/synth.ts');
assert.match(game, /spcHiddenFor:\s*\(\)\s*=>\s*false/);
assert.match(synth, /roleMultFor\?\.\(rt\)\s*\?\?\s*1/);
assert.match(synth, /modsFor\?\.\(rt\)\s*\?\?\s*1/);
const report = read('docs/PHASE10_1_12_FINAL_MECHANICS_AUDIT.md');
assert.match(report, /PARTIAL \/ NOT CLOSED/);
const pkg = JSON.parse(read('package.json'));
assert.equal(pkg.scripts['check:phase10.1.12'], 'node tools/check_phase10_1_12_parity_audit.mjs');
console.log('Phase 10.1.12 evidence-led parity audit PASSED');
console.log(`- ${matrix.mechanics.length} mechanics audited: ${JSON.stringify(counts)}`);
console.log('- Known placeholders and unresolved parity gaps remain explicitly visible');
console.log('- Full V1 → V2 parity closure is NOT claimed');
