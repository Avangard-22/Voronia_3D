#!/usr/bin/env node
/**
 * tools/check_size.mjs — гейт single-file сборки: dist-single/index.html ≤ 6 МБ (ТЗ/ADR-002 Q3).
 */
import { statSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const FILE = resolve(ROOT, 'dist-single/index.html');
const LIMIT = 6 * 1024 * 1024;

if (!existsSync(FILE)) {
  console.error('check_size: dist-single/index.html не найден — сначала npm run build:single');
  process.exit(1);
}
const size = statSync(FILE).size;
const mb = (size / 1024 / 1024).toFixed(2);
if (size > LIMIT) {
  console.error(`check_size: FAIL ${mb} МБ > 6 МБ`);
  process.exit(1);
}
console.log(`check_size: OK ${mb} МБ ≤ 6 МБ`);
