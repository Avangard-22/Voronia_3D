/* Voronia 2.0 · harness/boot.js — загрузка монолита v0.0.41 в node+vm.
 * Слои в порядке документа: flags → balance → override-v41 → offline-v24 → bundle → патч-слои.
 * Использование: const game = require('./boot.js').boot({layers:'all'|'core'})
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { makeEnv } = require('./dom_stubs.cjs');

const EX = path.join(__dirname, 'extract');

// слои в ТОЧНОМ порядке оригинального документа (inline-скрипты; src= и vor3d-* пропускаем)
const LAYERS = [
  'unnamed_152392.js',
  'unnamed_153288.js',
  'voronia-flags.js',
  'voronia-balance.js',
  'voronia-balance-override-v41.js',
  'voronia-icons.js',
  '@bundle',
  'voronia-shipyard.js',
  'voronia-features.js',
  'voronia-consistency-repair.js',
  'voronia-reset-fix.js',
  'voronia-guardian-arsenal.js',
  'voronia-reactor-upgrade.js',
  'voronia-dust-tree-patch.js',
  'voronia-ship-traffic.js',
  'voronia-galaxy-spread.js',
  'voronia-offline-balance-v24.js',
  'voronia-ux-logic-patch.js',
  'voronia-lv-finale.js',
  'voronia-guardian-trophies.js',
  'voronia-guardian-weaving.js',
  'voronia-upgrade-achievements.js',
  'unnamed_2767576.js',
  'voronia-next-step.js',
  'voronia-ambient-music-v0386.js',
  'voronia-v0390-interface-patch.js',
  'voronia-resource-hud-dedup-script-v0395.js',
  'voronia-v0396-utility-icon-visibility.js',
  'voronia-reactor-slots-v41.js',
  'voronia-hud-battle-v41.js',
];

function boot(opts = {}) {
  const layers = opts.layers === 'core'
    ? LAYERS.slice(0, LAYERS.indexOf('@bundle') + 1)
    : LAYERS;
  const env = makeEnv(opts);
  env.setTimeout = (fn, ms, ...a) => setTimeout(() => { try { fn(...a); } catch (e) { if (opts.strict) throw e; } }, Math.min(ms ?? 0, opts.maxTimerMs ?? 50));
  env.clearTimeout = clearTimeout;
  env.setInterval = (fn, ms, ...a) => setInterval(() => { try { fn(...a); } catch (e) { if (opts.strict) throw e; } }, Math.max(ms ?? 100, 100));
  env.clearInterval = clearInterval;
  env.queueMicrotask = queueMicrotask;
  env.console = opts.quiet ? { log() {}, info() {}, warn() {}, error() {}, debug() {} } : console;
  const ctx = vm.createContext(env);
  // Преамбула: управляемое время (Date.now + offset) и детерминированный Math.random
  vm.runInContext(`(function(){
    var RD = Date;
    function OFF(){ return (globalThis.__nowOffsetVal || 0); }
    class D extends RD {
      constructor(...a){ if (a.length === 0) super(RD.now() + OFF()); else super(...a); }
      static now(){ return RD.now() + OFF(); }
    }
    globalThis.Date = D;
  })();`, ctx, { filename: 'prelude-time.js' });
  if (opts.randomSeed != null) {
    vm.runInContext(`(function(seed){
      var t = seed >>> 0;
      Math.random = function(){ t |= 0; t = t + 1831565813 | 0; var o = Math.imul(t ^ t >>> 15, 1 | t); o = o + Math.imul(o ^ o >>> 7, 61 | o) ^ o; return ((o ^ o >>> 14) >>> 0) / 4294967296; };
    })(${opts.randomSeed | 0});`, ctx, { filename: 'prelude-random.js' });
  }
  const errors = [];
  // Harness-only инъекция: ленивые геттеры внутренностей бандла (window.__INT).
  // PROD-файл не меняется — патчится копия в памяти. Дисциплина 1.x: exact-substring + assert.
  const ANCHOR = 'window.__LvScanGrowth=LvScanGrowth;';
  const INT_NAMES = ['Sd','ln','Et','A1','ce','gt','Me','hr','Di','Gp','zn','Ni','x0','C1','qe','Xc','er','Ds','Ey','Vi','_y','xt','mt','fn','Ap','sr','pm','mm','br','ms','Og','Bs','Ac','Gi','fa','Ld','am','Rg','Lg','Oc','Ug','Kt','ld','Tp','Tg','Ng','al','Bg','lf','Ws','Vg','Gg','Wg','Yg','qg','jg','Zl','ed','ts','Ti','td','od','cd','s0','ao','so','p1','hcApply','r0','To','Ig','E0','c1','h0','_0','q0','gl','b0','ml','Ks','h1','Wo','nw','iw','fv','js','sealMult','Co','rw','bi','Yy','Ze','Wn','Uo','Dt','wl','Gr','di','v0','Pn','Xt','fo','Wt','At','Zr','Zn','Jr','$i','In','rt','rq','Lf','Br','On','yy','rl','ni','Js','jr','Jo','oi','Tr','Qo','Ef','Pf','$f','Eo','Ot','hn','ex','B','No','ie','ke','De','yl','g0','Xs','$n','zr','Uo','li','hl','Pn','Planet:or','CLIM:Ar','EVENTS:Qa','GEO:Nn','state:n','planets:$','RES:te','ze','Fi','Io','Xt','qr','Kn','kl','Ao','Ys','Gs','fo','vi','W0','Vn','ta','$l','se','Yf','Ac','Fa','nv','ng','Yu','Ur','Yy','Zu','ef','Po','My','Df','Za','Lr','Fn','Es','Td','Hf','dn','ov','Ls','Sy','Ho','um','fm','ro','tf','tk','at','Ve','yt','dr','Jc','Kf','es','Jc','Zc','Fr','Nr','repairRevealed','Tt','I1','pi','Gp','Di','Uo','ei','Cy','ti','Ds','el','Iy','Zl','af','po','Tt','gf','sd','ou','bf','Mz',
    // Этап 4: заряды (i0/a0/ll/Vs/Xy/cl/Qy/Jy/Zy/Jf/Hr), аномалии/синтез (tl/nr/Ry/Ly/Ty/$o/tr/Ay/fl), мутанты/истощение (tb/jy/Yk/l1/Wr/su/ft/Py)
    'i0','tl','nr','Ly','Ry','Jf','a0','ll','tb','jy','Yk','l1','Wr','Vs','Xy','cl','Qy','Jy','Zy','fl','su','Py','Hr','ft','Ty','$o','tr','Ay','$y'];
  const injection = 'window.__INT={' + INT_NAMES.map((spec) => {
    const [key, name] = spec.includes(':') ? spec.split(':') : [spec, spec];
    return `get ${key}(){return ${name}}`;
  }).join(',') + '};';
  for (const name of layers) {
    const file = name === '@bundle' ? 'bundle_main.js' : name;
    const p = path.join(EX, file);
    if (!fs.existsSync(p)) { errors.push({ layer: name, error: 'missing file' }); continue; }
    let code = fs.readFileSync(p, 'utf8');
    if (name === '@bundle') {
      const cnt = code.split(ANCHOR).length - 1;
      if (cnt !== 1) throw new Error(`harness anchor assert failed: "${ANCHOR}" occurrences = ${cnt}, expected 1`);
      code = code.replace(ANCHOR, ANCHOR + injection);
    }
    try {
      vm.runInContext(code, ctx, { filename: file, timeout: opts.layerTimeoutMs ?? 20000 });
    } catch (e) {
      errors.push({ layer: name, error: String(e && e.stack || e).split('\n').slice(0, 4).join(' | ') });
      if (opts.strict) throw e;
    }
  }
  return { env, errors };
}

function startGame(env) {
  env.document.dispatchEvent({ type: 'DOMContentLoaded' });
  env.dispatchEvent({ type: 'load' });
  const btn = env.__byId.get('start-btn');
  if (btn && btn._handlers.click) btn.click();
  env.__flushRaf(3);
  if (!env.__V || !env.__V.state || !env.__V.state.started) {
    // запасной путь: прямой boot-хук онбординга
    if (typeof env.__ccOnbStart === 'function') { try { env.__ccOnbStart(); } catch {} env.__flushRaf(3); }
  }
  return env.__V && env.__V.state && env.__V.state.started;
}

function resolveInt(env) {
  const out = { ok: {}, missing: [] };
  for (const k of Object.keys(env.__INT || {})) {
    try { const v = env.__INT[k]; if (v === undefined) out.missing.push(k); else out.ok[k] = typeof v; }
    catch (e) { out.missing.push(k + ' (' + e.message.slice(0, 30) + ')'); }
  }
  return out;
}

module.exports = { boot, startGame, resolveInt, LAYERS };
