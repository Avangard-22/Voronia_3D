import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const app = fs.readFileSync(path.join(root, 'src/ui/app.ts'), 'utf8');
const keys = [...app.matchAll(/'((?:cell_)?[A-Za-z][A-Za-z0-9_-]*)'/g)].map((m) => m[1]);
const required = new Set([
  'energy','iron','kriogen','crystals','research','dust','essence','shards','carbon','silicon','titanium','uranium','helium3','biomass','platinum','darkMatter','steel','chip','alloy','core','relic',
  'cell_energy','cell_battery','cell_crystal','cell_mine','cell_anomaly','cell_ice','cell_research','cell_core','anomaly_synth','anomaly_power','anomaly_resonance',
]);
const missing = [...required].filter((key) => !fs.existsSync(path.join(root, 'public/assets/legacy-icons', `${key}.svg`)));
const assets = fs.readdirSync(path.join(root, 'public/assets/legacy-icons')).filter((f) => f.endsWith('.svg'));
const malformed = assets.filter((file) => {
  const svg = fs.readFileSync(path.join(root, 'public/assets/legacy-icons', file), 'utf8');
  return !svg.startsWith('<svg ') || !svg.includes('</svg>') || !svg.includes('viewBox="0 0 64 64"');
});
if (missing.length || malformed.length) {
  console.error(JSON.stringify({ missing, malformed }, null, 2));
  process.exit(1);
}
console.log(`PASS: ${required.size} mapped SVG assets present; ${assets.length} SVG files validated.`);
