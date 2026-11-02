#!/usr/bin/env node
/**
 * tools/check_arch.mjs — архитектурные ворота (ADR-012, ТЗ §8):
 *  R1. Слои: contracts(0) ← config(1) ← domains(2) ← core(3) ← ui(4). Импорт — только вниз/в свой слой.
 *  R2. Домены НЕ импортируют друг друга (связь — через contracts; сборка — только в core/game).
 *  R3. ui импортирует только core/contracts/config (+себя) — домены и persistence для ui закрыты (фасад).
 *  R4. main.ts — composition root: ему разрешено всё.
 *  R5. Циклические импорты в src запрещены.
 *  R6. src не импортирует fixtures/tools/tests и не ходит за пределы src.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, relative, dirname, resolve as resolvePath } from 'node:path';

const ROOT = resolvePath(import.meta.dirname, '..');
const SRC = join(ROOT, 'src');

const DOMAINS = new Set(['economy', 'planets', 'progression', 'persistence', 'renderer', 'audio', 'galaxy', 'logistics', 'combat', 'crafting']);
const LAYER = { contracts: 0, config: 1, core: 3, ui: 4 };
const domainLayer = 2;

function layerOf(mod) {
  if (mod === 'main') return 4;
  if (DOMAINS.has(mod)) return domainLayer;
  return LAYER[mod] ?? -1;
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (p.endsWith('.ts') || p.endsWith('.json')) out.push(p);
  }
  return out;
}

function moduleOf(file) {
  const rel = relative(SRC, file);
  const parts = rel.split('/');
  if (parts.length === 1) return parts[0].replace(/\.ts$/, '');
  return parts[0];
}

const IMPORT_RE = /(?:^|\n)\s*(?:import|export)\s+(?:[^'"]*?\sfrom\s+)?['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

const files = walk(SRC);
const ids = new Map();
for (const f of files) ids.set(f, moduleOf(f));

const violations = [];
const edges = new Map(); // file → [file]

function resolveImport(fromFile, spec) {
  if (!spec.startsWith('.')) return null; // npm-пакет
  const base = resolvePath(dirname(fromFile), spec);
  const candidates = [base.endsWith('.json') ? base : null, base + '.ts', join(base, 'index.ts')];
  for (const c of candidates) {
    if (c && files.includes(c)) return c;
  }
  return { unresolved: base };
}

for (const file of files) {
  const src = readFileSync(file, 'utf8');
  const rel = relative(ROOT, file);
  const myMod = ids.get(file);
  const myLayer = layerOf(myMod);
  const fileEdges = [];
  for (const m of src.matchAll(IMPORT_RE)) {
    const spec = m[1] ?? m[2];
    if (!spec) continue;
    if (!spec.startsWith('.')) {
      // allowlist внешних: vitest/node:* в тестах, @types-пакеты, three — только домен renderer (Этап 5, 3D-прототип)
      const threeOk = spec === 'three' && myMod === 'renderer';
      if (!/^(vitest|node:)/.test(spec) && !spec.startsWith('@') && !threeOk) violations.push(`${rel}: внешний импорт вне allowlist: ${spec}`);
      continue;
    }
    const target = resolveImport(file, spec);
    if (!target) {
      violations.push(`${rel}: неразрешимый импорт ${spec}`);
      continue;
    }
    if (target && typeof target === 'object' && target.unresolved) {
      violations.push(`${rel}: неразрешимый импорт ${spec}`);
      continue;
    }
    fileEdges.push(target);
    const tMod = ids.get(target);
    const tLayer = layerOf(tMod);
    // R6: выход за src невозможен (resolveImport ищет только в списке files), но проверим fixtures/tools
    const tRel = relative(ROOT, target);
    if (tRel.startsWith('fixtures') || tRel.startsWith('tools') || tRel.startsWith('tests')) {
      violations.push(`${rel}: импорт из ${tRel} (R6: src не зависит от fixtures/tools/tests)`);
    }
    if (target.endsWith('.json')) continue; // данные — не модуль слоя
    if (myMod === 'main') continue; // R4
    // R1: слои
    if (tLayer > myLayer) violations.push(`${rel} → ${tRel}: R1 слой ${myMod}(${myLayer}) импортирует ${tMod}(${tLayer})`);
    // R2: домен → другой домен
    if (DOMAINS.has(myMod) && DOMAINS.has(tMod) && myMod !== tMod) {
      violations.push(`${rel} → ${tRel}: R2 домен «${myMod}» импортирует домен «${tMod}» (разрешено только через contracts)`);
    }
    // R3: ui → домены/persistence
    if (myMod === 'ui' && (DOMAINS.has(tMod))) {
      violations.push(`${rel} → ${tRel}: R3 ui импортирует домен «${tMod}» (только core/contracts/config)`);
    }
    // config не должен зависеть от доменов (уточнение R1 для config)
    if (myMod === 'config' && tLayer >= domainLayer) {
      violations.push(`${rel} → ${tRel}: config импортирует ${tMod}`);
    }
  }
  edges.set(file, fileEdges);
}

// R5: циклы (DFS по файлам)
const state = new Map();
const stack = [];
let cycleFound = null;
function dfs(node) {
  if (cycleFound) return;
  state.set(node, 1);
  stack.push(node);
  for (const next of edges.get(node) ?? []) {
    const st = state.get(next) ?? 0;
    if (st === 1) {
      const i = stack.indexOf(next);
      cycleFound = stack.slice(i >= 0 ? i : 0).map((f) => relative(ROOT, f)).concat(relative(ROOT, next));
      return;
    }
    if (st === 0) dfs(next);
    if (cycleFound) return;
  }
  stack.pop();
  state.set(node, 2);
}
for (const f of files) if ((state.get(f) ?? 0) === 0) dfs(f);

if (cycleFound) violations.push(`R5 цикл импортов: ${cycleFound.join(' → ')}`);

if (violations.length > 0) {
  console.error(`check_arch: ${violations.length} нарушений`);
  for (const v of violations) console.error('  - ' + v);
  process.exit(1);
}
console.log(`check_arch: OK (${files.length} файлов, слои/циклы/границы доменов чисты)`);
