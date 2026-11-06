import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
const game = read('src/core/game.ts');
const ledger = read('src/economy/ledger.ts');
const schema = read('src/persistence/schema.ts');
const resources = read('src/contracts/resources.ts');
const notes = read('PHASE_10.1.4_NOTES.md');

assert.match(resources, /PLANET_STORAGE_RESOURCES\s*=\s*\['iron',\s*'kriogen',\s*\.\.\.EXTRA_RESOURCES\]/);
assert.match(ledger, /replaceBalances\(values:/);
assert.match(game, /private switchActivePlanet\(pid:/);
assert.match(game, /setActivePlanet\(pid:[\s\S]*?return this\.switchActivePlanet\(pid\)/);
assert.match(schema, /planetResources\?:\s*Readonly<Record/);
assert.match(game, /planetResources\[this\.activePlanetIdValue\]/);
assert.match(game, /this\.planetResources\s*=\s*new Map\(Object\.entries\(save\.planetResources/);
assert.match(game, /activeRuntimes\(\): readonly PlanetRuntime\[\][\s\S]*?return active \? \[active\] : \[\]/);
assert.match(schema, /planetResources\[activePlanetId\]\s*=\s*activeStock/);
assert.match(notes, /free switch/i);

const legacy = JSON.parse(fs.readFileSync(path.join(root, 'fixtures/golden_save_midgame_v0.0.41.json'), 'utf8'));
assert.equal(legacy.version, 39);
assert.ok(legacy.planets && legacy.activePlanetId);
console.log('Phase 10.1.4 source contracts: PASS');
