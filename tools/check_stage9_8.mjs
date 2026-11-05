import { readFileSync } from 'node:fs';
import { strict as assert } from 'node:assert';
const app = readFileSync('src/ui/app.ts', 'utf8');
const css = readFileSync('src/ui/styles.ts', 'utf8');
const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
const lock = JSON.parse(readFileSync('package-lock.json', 'utf8'));
for (const tab of ['planet', 'galaxy', 'science', 'meta']) {
  assert(app.includes(`id="nav-tab-${tab}"`), `missing tab ${tab}`);
  assert(app.includes('section.id = `nav-panel-${key}`'), `missing panel ${tab}`);
}
assert(app.includes("event.key === 'ArrowRight'"));
assert(app.includes("document.addEventListener('fullscreenchange'"));
assert(css.includes('.legacy-bottom-nav button.active::before'));
assert(css.includes('@media(prefers-reduced-motion:reduce)'));
assert.equal(pkg.version, '2.0.0-stage9.8.0');
assert.equal(lock.version, pkg.version);
assert.equal(lock.packages[''].version, pkg.version);
console.log('Stage 9.8 UI parity checks: PASS');
