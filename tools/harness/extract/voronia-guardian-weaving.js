
/* ============================================================================
 * Voronia · РАСПУТКА (Guardian Weaving)
 * Phase 5-6+: имя из реплики · ритуал призыва · ограничение · поражение по энергии
 * v0.6.0 · ОБЪЕДИЕНИЕ веток: v0.4.2 (кулдаун/энергия/разрушения из v0.0.23) + v0.5.0 (управление сферой)
 *   — тяга по фону одним пальцем/мышью = свободное вращение (rotX+rotY, с инерцией),
 *   — щипок двумя пальцами = масштаб + вращение средней точкой, колесо мыши = масштаб,
 *   — двойной тап по фону или кнопка ⟲ = сброс вида, стрелки/±/0 — клавиатура,
 *   — авторотация на паузе, пока игрок управляет камерой вручную.
 * v0.4.0
 * ==========================================================================*/
(function () {
'use strict';

const V = window.__V || {};
const S = V.state || {};
const L = V.legacy || {};
const BUS = V.bus;
const CORE = V.core || {};

const $id = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const now = () => performance.now();

function ext(name, dflt) {
  try {
    if (CORE.registerExtension) return CORE.registerExtension(name, dflt || {});
    const e = CORE.extensions = CORE.extensions || {};
    if (!e[name] || typeof e[name] !== 'object') e[name] = JSON.parse(JSON.stringify(dflt || {}));
    return e[name];
  } catch (err) { return dflt || {}; }
}
function save() { try { window.requestSave?.(); } catch (e) {} }
function toast(html, kind, ms) { try { L.showToast?.(html, kind || '', ms || 4000); } catch (e) {} }
function warn(msg) { try { console.warn('[gw]', msg); } catch (e) {} try { L.showWarning?.(msg); } catch (e) { console.warn('[gw]', msg); } }
function log(...a) { try { console.info('[gw]', ...a); } catch (e) {} }

/* ---------------------------------------------------------------- tuning */
const TUNE = {
  baseStrands: 6, strandsPerLevel: 2, baseHp: 5, hpPerLevel: 1,
  maxExtraStrands: 8,

  tightenIntervalMs: 4000, tightenHpBase: 8, tightenHpPerLevel: 1,
  tightenFreshDurationMs: 5000, tightenPenaltyOne: 0.75, tightenPenaltyTwo: 0.50,

  pullIntervalMs: 8000, pullReservePct: 0.05, pullEnergyPerAnchor: 200,

  sweepIntervalMs: 15000, sweepDurationMs: 1500,
  sweepReflectDamage: 30, sweepAwakenDurationMs: 5000, sweepAwakenBonus: 5,
  sweepHitReservePct: 0.10, sweepHitEnergyPerAnchor: 200,
  sweepHitDeadDurationMs: 3000, sweepHitAnchors: 2,

  timeLimitMs: 90000,
  strokeCostBase: 100, strokeCostMax: 1500,

  allyDps: 3,
  allyCooldownMs: 12 * 3600 * 1000,
  winsForAlly: 3,
  allySummonAnimMs: 500,      /* NEW v0.4: длительность ритуала */

  energyDryTimeoutMs: 5000,   /* legacy; поражение теперь при исчерпании боевого резерва */
  energyDryWarnAtMs: 1500,
  energyDryForecastSec: 20,
  fightCooldownMinMs: 6 * 3600 * 1000,
  fightCooldownMaxMs: 12 * 3600 * 1000,
  fightEnergyBasePerSec: 100,
  fightEnergyStepPerThreeWins: 20,   /* v0.6.1: было 5; считается по ПОБЕДАМ (winsByPlanet) */
  cellRestoreDelayMs: 30 * 60 * 1000,
  cellRestoreResearchPerCell: 250,
  cellRestoreCrystalsPerCell: 25,
};

/* v0.0.23 · Единый кулдаун для обеих боевых систем; награды печатей распределены по сложности Хранителя. Предыдущий баланс печатей: ресурсные +30%, универсальная +12%, истощение −20%, скидка рудокопа 15%; срок печатей — 4 часа, меньше минимального кулдауна 6 часов. */
/* --------------------------------------------------------- view (v0.5) */
const VIEW = {
  zoomMin: 0.5, zoomMax: 3.5,        /* те же пределы, что у планетарного движка */
  sensYaw: 0.005, sensPitch: 0.004,  /* та же чувствительность, что у драга планеты */
  rotXLimit: Math.PI * 0.47,         /* тот же кламп вертикали */
  idleResumeMs: 2500,                /* пауза авторотации после ручного управления */
  spinDecay: 0.93, spinMin: 0.0006,  /* инерция вращения */
  wheelStep: 1.1,
  dblTapMs: 300, dblTapDist: 40,
};
function clampZoom(z) { return clamp(z, VIEW.zoomMin, VIEW.zoomMax); }
function clampRotX() { S.rotX = clamp(S.rotX || 0, -VIEW.rotXLimit, VIEW.rotXLimit); }
function pauseIdle(ms) { F.view.idleUntil = now() + (ms || VIEW.idleResumeMs); }
function bumpZoom(f) {
  if (!S.started) return;
  S.zoom = clampZoom((S.zoom || 1) * f);
  F.view.spinX = 0; F.view.spinY = 0;
  pauseIdle(1200);
}
function nudgeRot(d) {
  if (!S.started) return;
  S.rotY += d;
  F.view.spinX = 0; F.view.spinY = 0;
  pauseIdle(1600);
}
function viewPop(msg) {
  const el = document.createElement('div');
  el.className = 'gw-combo-pop';
  el.style.left = '50%'; el.style.top = '18%';
  el.style.color = '#7ec9e8'; el.style.fontSize = '13px';
  el.style.textShadow = '0 0 10px #4ddcff';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1000);
}
function resetView() {
  if (!S.started) return;
  S.rotX = F.view.rotX0; S.rotY = F.view.rotY0; S.zoom = F.view.zoom0;
  F.view.spinX = 0; F.view.spinY = 0;
  pauseIdle(1200);
  viewPop('⌖ вид сброшен');
}

/* ---------------------------------------------------------------- state */
const KEY = 'guardianWeaving_v1';
function state() {
  const s = ext(KEY, {
    active: null, history: [], seals: [],
    planetStreak: {}, allies: {}, allyCooldown: {},
    fightCooldownUntil: {}, destroyedCells: {}, fightCountByPlanet: {}, winsByPlanet: {},
  });
  if (!Array.isArray(s.history)) s.history = [];
  if (!Array.isArray(s.seals)) s.seals = [];
  if (!s.planetStreak || typeof s.planetStreak !== 'object') s.planetStreak = {};
  if (!s.allies || typeof s.allies !== 'object') s.allies = {};
  if (!s.allyCooldown || typeof s.allyCooldown !== 'object') s.allyCooldown = {};
  if (!s.fightCooldownUntil || typeof s.fightCooldownUntil !== 'object') s.fightCooldownUntil = {};
  if (!s.destroyedCells || typeof s.destroyedCells !== 'object') s.destroyedCells = {};
  if (!s.fightCountByPlanet || typeof s.fightCountByPlanet !== 'object') s.fightCountByPlanet = {};
  if (!s.winsByPlanet || typeof s.winsByPlanet !== 'object') s.winsByPlanet = {};
  if (s.history.length > 50) s.history = s.history.slice(-50);
  if (s.seals.length > 100) s.seals = s.seals.slice(-100);
  return s;
}

/* ---------------------------------------------------------------- fight */
const F = {
  active: false, finished: false,
  planet: null, planetId: null, level: 1,
  anchors: [],
  tangle: { strands: [], maxHp: 0, hp: 0 },
  arena: { startedAt: 0, timeLimit: TUNE.timeLimitMs },
  attacks: { nextTighten: 0, nextPull: 0, nextSweep: 0 },
  sweep: null,
  awakenedAnchors: new Map(),
  deadAnchors: new Map(),
  pullFloats: [],
  maxStrands: 0, strandsSpawned: 0,
  player: { strokesMade: 0, damageDealt: 0, sweepsDeflected: 0, maxCombo: 1, energySpent: 0 },
  styleStats: {
    sweepsMissed: 0, strokesMissed: 0, maxStrandsBrokenInStroke: 0,
    energyLost: 0, reserveLost: 0,
  },
  ally: null,
  allyAutoReflect: false,
  allyAutoReflectPending: false,
  allyTickAccum: 0,
  allySummonAnim: null,       /* NEW v0.4 */
  energyDryMs: 0,
  lastEnergyDryWarnAt: 0,
  energyAtStart: 0, energyDrainAccum: 0, energyDrainRate: 5, energyLastHudAt: 0,     /* NEW v0.4 */
  stroke: { active: false, startX: 0, startY: 0, curX: 0, curY: 0, startCell: null, path: [] },
  view: {
    mode: null, lastX: 0, lastY: 0, lastT: 0,
    pinchDist0: 0, pinchZoom0: 1, pinchMidX: 0, pinchMidY: 0,
    spinX: 0, spinY: 0, idleUntil: 0,
    zoom0: 1, rotX0: -0.08, rotY0: 0,
    lastTapAt: 0, lastTapX: 0, lastTapY: 0,
  },
  _zoomChipSig: null,
  trails: [], bursts: [],
  canvas: null, ctx: null, hud: null,
  lastFrameAt: 0, pointerMap: new Map(), cost: 0,
  _allyBtnSig: null, _lastAllyHud: 0,
};

/* ---------------------------------------------------------------- rng */
function seededRng(seed) {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6D2B79F5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------------------------------------------------------- NEW v0.4: имя из реплики */
const _BAD_TAIL = new Set(['что','как','где','когда','если','чтобы','ли','либо','то','же','ведь']);
const _BAD_HEAD = new Set(['о','о,','да','да,','нет','нет,','а','а,','и','и,','эх','эх,']);
function allyNameFromLine(plName, formName, line) {
  if (!line) return `${formName} ${plName}`;
  const first = String(line).split(/[.!?]/)[0].trim();
  if (!first) return `${formName} ${plName}`;
  let words = first.split(/\s+/).filter(Boolean);
  while (words.length > 1 && _BAD_HEAD.has(words[0].toLowerCase())) words.shift();
  if (!words.length) return `${formName} ${plName}`;
  /* обрезаем до 4 слов */
  if (words.length > 4) words = words.slice(0, 4);
  /* обрезаем служебные хвосты */
  while (words.length > 2 && _BAD_TAIL.has(words[words.length - 1].toLowerCase().replace(/[^а-яё]/g, ''))) {
    words.pop();
  }
  if (words.length < 2) return `${formName} ${plName}`;
  let name = words.join(' ').replace(/[,;:—–-]+$/, '').trim();
  if (!name) return `${formName} ${plName}`;
  if (name.length > 32) {
    while (name.length > 32 && name.includes(' ')) name = name.slice(0, name.lastIndexOf(' '));
    name = name.replace(/[,;:—–-]+$/, '').trim();
  }
  if (!name) return `${formName} ${plName}`;
  name = name.charAt(0).toUpperCase() + name.slice(1);
  return `${formName} — «${name}»`;
}

/* ---------------------------------------------------------------- anchors */
function pickAnchors(pl, level) {
  const target = level <= 3 ? 3 : level <= 7 ? 4 : 5;
  const rng = seededRng((pl.seed >>> 0) ^ (level * 2654435761));
  const candidates = [];
  for (const cid of pl.explored) {
    const cell = pl.cells[cid];
    if (!cell || cell._destroyed) continue;
    let score = 1;
    if (cell.type === 4) score = 10;
    else if (cell.type === 7) score = 8;
    else if (cell.type === 2) score = 6;
    else if (cell.type === 3 || cell.type === 5) score = 5;
    else if (cell.type === 1) score = 4;
    else if (cell.type === 6) score = 3;
    candidates.push({ id: cid, score });
  }
  if (candidates.length < target) return null;
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  candidates.sort((a, b) => b.score - a.score);
  function tryPick(exclDepth) {
    const badSet = new Set();
    function markBad(cid, depth) {
      const visited = new Set([cid]);
      let frontier = [cid];
      badSet.add(cid);
      for (let d = 0; d < depth; d++) {
        const next = [];
        for (const node of frontier) {
          const cell = pl.cells[node];
          if (!cell || !cell.neighbors) continue;
          for (const nb of cell.neighbors) {
            if (!visited.has(nb) && nb >= 0 && nb < pl.cells.length) {
              visited.add(nb); next.push(nb); badSet.add(nb);
            }
          }
        }
        frontier = next;
      }
    }
    const picked = [];
    for (const cand of candidates) {
      if (picked.length >= target) break;
      if (badSet.has(cand.id)) continue;
      picked.push(cand.id);
      if (exclDepth > 0) markBad(cand.id, exclDepth);
    }
    return picked;
  }
  /* v0.4.1-fix: на малых планетах (Феррум=12 клеток) BFS-2 съедает всех —
     прогрессирующее ослабление 2 → 1 → 0 */
  for (const depth of [2, 1, 0]) {
    const picked = tryPick(depth);
    if (picked.length >= 3) return picked;
  }
  return null;
}

function buildTangle(pl, anchors, level) {
  const strandCount = TUNE.baseStrands + Math.floor(level * TUNE.strandsPerLevel);
  const baseHp = TUNE.baseHp + level * TUNE.hpPerLevel;
  const rng = seededRng((pl.seed >>> 0) ^ (level * 987654321) ^ 0xBEEF);
  const strands = [];
  let maxHp = 0;
  for (let i = 0; i < strandCount; i++) {
    const aIdx = Math.floor(rng() * anchors.length);
    let bIdx = Math.floor(rng() * anchors.length);
    let guard = 0;
    while (bIdx === aIdx && anchors.length > 1 && guard++ < 10) bIdx = Math.floor(rng() * anchors.length);
    const hp = baseHp * (0.7 + rng() * 0.6);
    strands.push({
      a: anchors[aIdx], b: anchors[bIdx], hp, maxHp: hp, broken: false,
      curve: 0.7 + rng() * 0.6, phase: rng() * Math.PI * 2,
      fresh: false, freshUntil: 0,
    });
    maxHp += hp;
  }
  return { strands, maxHp, hp: maxHp };
}

/* ---------------------------------------------------------------- dom */
function setupDom() {
  if (!$id('gw-css')) {
    const css = document.createElement('style');
    css.id = 'gw-css';
    css.textContent = `
#gw-canvas{position:fixed;inset:0;z-index:1;pointer-events:none;display:none}
#gw-canvas.active{pointer-events:auto;touch-action:none;cursor:crosshair;display:block}
#gw-canvas.active.grabbing{cursor:grabbing}
#gw-hud{position:fixed;left:50%;transform:translateX(-50%);bottom:120px;z-index:45;
  background:rgba(6,16,25,.94);border:1px solid #7a4fc0;border-radius:14px;
  padding:8px 14px;display:none;align-items:center;gap:10px;
  box-shadow:0 0 24px rgba(122,79,192,.4),inset 0 0 12px rgba(122,79,192,.15);
  backdrop-filter:blur(8px);font-family:inherit;pointer-events:auto;
  max-width:96vw;flex-wrap:wrap;justify-content:center}
#gw-hud.on{display:flex}
#gw-hud.dry{border-color:var(--rd,#ff5e5e);box-shadow:0 0 24px rgba(255,94,94,.45),inset 0 0 12px rgba(255,94,94,.18);animation:gwDryPulse 1.1s ease-in-out infinite}
@keyframes gwDryPulse{0%,100%{box-shadow:0 0 20px rgba(255,94,94,.35),inset 0 0 10px rgba(255,94,94,.15)}50%{box-shadow:0 0 36px rgba(255,94,94,.7),inset 0 0 18px rgba(255,94,94,.25)}}
.gw-hpbar{display:flex;align-items:center;gap:8px;font-size:11px;color:#d8b4fe;
  font-weight:700;letter-spacing:.5px;white-space:nowrap}
.gw-hpbar .bar{width:140px;height:10px;background:#1a0d2e;border:1px solid #3c1e5c;
  border-radius:5px;overflow:hidden}
.gw-hpbar .bar>i{display:block;height:100%;width:100%;
  background:linear-gradient(90deg,#c084fc,#ff4d9d);
  transition:width .3s ease,background .3s ease}
.gw-hpbar .val{font-family:monospace;font-size:11px;min-width:48px;text-align:right}
.gw-energy-chip{font-family:monospace;font-size:10.5px;padding:3px 8px;border-radius:8px;
  border:1px solid rgba(77,220,255,.35);color:#7ec9e8;background:rgba(77,220,255,.06);
  white-space:nowrap}
.gw-energy-chip.low{border-color:var(--rd,#ff5e5e);color:#ff8c8c;background:rgba(255,94,94,.08)}
.gw-btn{border:1px solid #29495b;background:#11202e;color:#cdd9e1;border-radius:8px;
  padding:6px 12px;font-size:12px;font-weight:700;cursor:pointer;
  transition:transform .15s,border-color .2s;font-family:inherit}
.gw-btn:active{transform:scale(.94)}
.gw-btn.danger{border-color:#ff5e5e;color:#ff8c8c;background:rgba(255,94,94,.08)}
.gw-btn.rot{min-width:38px;font-size:15px;line-height:1;padding:6px 8px}
.gw-btn.ally{border-color:#7ee08a;color:#b8ffdf;background:rgba(126,224,138,.08);
  box-shadow:0 0 10px rgba(126,224,138,.25)}
.gw-btn.ally.active{border-color:#ffda47;color:#ffda47;background:rgba(255,218,71,.08);
  box-shadow:0 0 10px rgba(255,218,71,.35)}
.gw-btn.ally:disabled{opacity:.5;cursor:not-allowed}
.gw-btn.ally.summoning{border-color:#c084fc;color:#e0c8ff;background:rgba(192,132,252,.12);
  animation:gwSummonPulse 0.9s ease-in-out infinite}
@keyframes gwSummonPulse{0%,100%{box-shadow:0 0 10px rgba(192,132,252,.35)}50%{box-shadow:0 0 22px rgba(192,132,252,.75)}}
.gw-timers{display:flex;gap:10px;font-size:10px;color:#91adbb;font-family:monospace;
  width:100%;text-align:center;justify-content:center;flex-wrap:wrap}
.gw-timers b{color:#d8b4fe;font-family:inherit}
.gw-timers .warn{color:#ff8c8c;animation:gwWarnPulse 1s ease-in-out infinite}
@keyframes gwWarnPulse{0%,100%{opacity:1}50%{opacity:.55}}
.gw-hint{width:100%;text-align:center;font-size:10px;color:#7f9aa8;
  margin-top:2px;letter-spacing:.3px;line-height:1.35}
.gw-combo-pop{position:fixed;z-index:46;pointer-events:none;
  font-family:'JetBrains Mono',monospace;font-weight:900;
  transform:translate(-50%,0);animation:gwComboPop 1.2s ease-out forwards}
@keyframes gwComboPop{0%{transform:translate(-50%,0) scale(.5);opacity:1}
  40%{transform:translate(-50%,-20px) scale(1.15);opacity:1}
  100%{transform:translate(-50%,-50px) scale(1);opacity:0}}
@media (max-width:650px){
  #gw-hud{bottom:92px;padding:6px 10px;gap:6px;border-radius:12px}
  .gw-hpbar{font-size:10px}.gw-hpbar .bar{width:100px;height:9px}
  .gw-hpbar .val{font-size:10px;min-width:42px}
  .gw-energy-chip{font-size:9.5px;padding:2px 6px}
  .gw-btn{padding:5px 9px;font-size:11px}.gw-btn.rot{min-width:34px;padding:5px 6px;font-size:14px}
  .gw-timers{font-size:9px;gap:6px}.gw-hint{font-size:9px}
}`;
    document.head.appendChild(css);
  }
  const cv = document.createElement('canvas');
  cv.id = 'gw-canvas';
  document.body.appendChild(cv);
  F.canvas = cv;
  F.ctx = cv.getContext('2d');

  const hud = document.createElement('div');
  hud.id = 'gw-hud';
  hud.innerHTML = `
    <div class="gw-hpbar">
      <span>⚔ ПУТАНИЦА</span>
      <div class="bar"><i id="gw-hp-fill"></i></div>
      <span class="val" id="gw-hp-val">0/0</span>
    </div>
    <span class="gw-energy-chip" id="gw-energy-chip">⚡ <span id="gw-energy-val">0</span>/<span id="gw-cost-val">0</span></span>
    <button class="gw-btn rot" id="gw-rot-l" title="Повернуть влево">↺</button>
    <button class="gw-btn rot" id="gw-rot-r" title="Повернуть вправо">↪</button>
    <button class="gw-btn rot" id="gw-zoom-out" title="Отдалить">−</button>
    <button class="gw-btn rot" id="gw-zoom-in" title="Приблизить">＋</button>
    <button class="gw-btn rot" id="gw-view-reset" title="Сбросить вид (или двойной тап по фону)">⟲</button>
    <button class="gw-btn ally" id="gw-ally-btn" style="display:none;">🤝 Призвать</button>
    <button class="gw-btn danger" id="gw-retreat">Отступить</button>
    <div class="gw-timers" id="gw-timers">
      <span>⏱ <b id="gw-timer-val">90</b>с</span>
      <span>🕸 <b id="gw-tighten-val">—</b></span>
      <span>💨 <b id="gw-pull-val">—</b></span>
      <span>🌊 <b id="gw-sweep-val">—</b></span>
      <span>⌖ <b id="gw-zoom-val">1,00</b>×</span>
    </div>
    <div class="gw-hint" id="gw-hint">Веди пальцем от клетки к клетке — стежок распутывает · тяни фон — вращение сферы · щипок/колесо — масштаб · стрелки/±/0 — клавиатура · двойной тап по фону — сброс вида</div>`;
  document.body.appendChild(hud);
  F.hud = hud;

  cv.addEventListener('pointerdown', onPointerDown);
  cv.addEventListener('pointermove', onPointerMove);
  cv.addEventListener('pointerup', onPointerUp);
  cv.addEventListener('pointercancel', onPointerUp);

  $id('gw-rot-l').addEventListener('click', () => nudgeRot(-0.26));
  $id('gw-rot-r').addEventListener('click', () => nudgeRot(0.26));
  $id('gw-zoom-in').addEventListener('click', () => bumpZoom(VIEW.wheelStep));
  $id('gw-zoom-out').addEventListener('click', () => bumpZoom(1 / VIEW.wheelStep));
  $id('gw-view-reset').addEventListener('click', () => resetView());
  $id('gw-retreat').addEventListener('click', () => exitFight('retreat'));
  $id('gw-ally-btn').addEventListener('click', () => summonAlly());
  cv.addEventListener('wheel', (e) => {
    if (!F.active) return;
    e.preventDefault();
    bumpZoom(e.deltaY < 0 ? VIEW.wheelStep : 1 / VIEW.wheelStep);
  }, { passive: false });

  window.addEventListener('resize', resizeCanvas);
  resizeCanvas();
}

function resizeCanvas() {
  if (!F.canvas) return;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth, h = window.innerHeight;
  F.canvas.width = Math.round(w * dpr);
  F.canvas.height = Math.round(h * dpr);
  F.canvas.style.width = w + 'px';
  F.canvas.style.height = h + 'px';
  F.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
function showDom() {
  if (F.canvas) { F.canvas.classList.add('active'); F.canvas.style.display = ''; }
  if (F.hud) F.hud.classList.add('on');
  const g = $id('game'); if (g) g.style.pointerEvents = 'none';
}
function hideDom() {
  if (F.canvas) { F.canvas.classList.remove('active'); F.canvas.style.display = 'none'; }
  if (F.hud) { F.hud.classList.remove('on'); F.hud.classList.remove('dry'); }
  const g = $id('game'); if (g) g.style.pointerEvents = '';
}

/* ---------------------------------------------------------------- pointer */
function onPointerDown(e) {
  if (!F.active) return;
  F.pointerMap.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (F.pointerMap.size >= 2) {
    /* v0.5: второй палец — пинч (масштаб + вращение средней точкой) */
    cancelStroke();
    const pts = Array.from(F.pointerMap.values());
    F.view.mode = 'pinch';
    F.view.pinchDist0 = Math.max(8, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y));
    F.view.pinchZoom0 = S.zoom || 1;
    F.view.pinchMidX = (pts[0].x + pts[1].x) / 2;
    F.view.pinchMidY = (pts[0].y + pts[1].y) / 2;
    F.view.spinX = 0; F.view.spinY = 0;
    if (F.canvas) F.canvas.classList.remove('grabbing');
    pauseIdle();
    return;
  }
  const startCell = cellAtScreen(e.clientX, e.clientY);
  if (!startCell) {
    /* v0.5: тяга по фону — вращение сферы; двойной тап — сброс вида */
    const t0 = now();
    if (F.view.lastTapAt > 0 && t0 - F.view.lastTapAt < VIEW.dblTapMs &&
        Math.hypot(e.clientX - F.view.lastTapX, e.clientY - F.view.lastTapY) < VIEW.dblTapDist) {
      F.view.lastTapAt = 0;
      resetView();
      return;
    }
    F.view.lastTapAt = t0; F.view.lastTapX = e.clientX; F.view.lastTapY = e.clientY;
    F.view.mode = 'rotate';
    F.view.lastX = e.clientX; F.view.lastY = e.clientY; F.view.lastT = t0;
    F.view.spinX = 0; F.view.spinY = 0;
    if (F.canvas) F.canvas.classList.add('grabbing');
    try { F.canvas.setPointerCapture(e.pointerId); } catch (_) {}
    return;
  }
  F.view.mode = null;
  F.stroke.active = true;
  F.stroke.startX = e.clientX; F.stroke.startY = e.clientY;
  F.stroke.curX = e.clientX; F.stroke.curY = e.clientY;
  F.stroke.path = [{ x: e.clientX, y: e.clientY }];
  F.stroke.startCell = startCell;
  try { F.canvas.setPointerCapture(e.pointerId); } catch (_) {}
}
function onPointerMove(e) {
  if (!F.active) return;
  const prev = F.pointerMap.get(e.pointerId);
  if (!prev) return;
  F.pointerMap.set(e.pointerId, { x: e.clientX, y: e.clientY });
  if (F.pointerMap.size >= 2) {
    if (!S.started) return;
    const pts = Array.from(F.pointerMap.values());
    const dist = Math.max(8, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y));
    const midX = (pts[0].x + pts[1].x) / 2, midY = (pts[0].y + pts[1].y) / 2;
    if (F.view.mode !== 'pinch') {
      cancelStroke();
      F.view.mode = 'pinch';
      F.view.pinchDist0 = dist; F.view.pinchZoom0 = S.zoom || 1;
      F.view.pinchMidX = midX; F.view.pinchMidY = midY;
      if (F.canvas) F.canvas.classList.remove('grabbing');
      pauseIdle();
      return;
    }
    const z = S.zoom || 1;
    if (F.view.pinchDist0 > 0) S.zoom = clampZoom(F.view.pinchZoom0 * (dist / F.view.pinchDist0));
    S.rotY += (midX - F.view.pinchMidX) * VIEW.sensYaw / z;
    S.rotX += (midY - F.view.pinchMidY) * VIEW.sensPitch / z;
    clampRotX();
    F.view.pinchMidX = midX; F.view.pinchMidY = midY;
    F.view.spinX = 0; F.view.spinY = 0;
    pauseIdle();
    return;
  }
  if (F.view.mode === 'rotate') {
    if (!S.started) return;
    const t0 = now();
    const frames = Math.max(0.5, (t0 - F.view.lastT) / 16.67);
    const z = S.zoom || 1;
    const dYaw = (e.clientX - F.view.lastX) * VIEW.sensYaw / z;
    const dPitch = (e.clientY - F.view.lastY) * VIEW.sensPitch / z;
    S.rotY += dYaw; S.rotX += dPitch; clampRotX();
    F.view.spinY = dYaw / frames; F.view.spinX = dPitch / frames;
    F.view.lastX = e.clientX; F.view.lastY = e.clientY; F.view.lastT = t0;
    pauseIdle();
    return;
  }
  if (F.stroke.active) {
    F.stroke.curX = e.clientX; F.stroke.curY = e.clientY;
    F.stroke.path.push({ x: e.clientX, y: e.clientY });
    if (F.stroke.path.length > 80) F.stroke.path.shift();
  }
}
function onPointerUp(e) {
  if (!F.active) return;
  F.pointerMap.delete(e.pointerId);
  try { F.canvas.releasePointerCapture(e.pointerId); } catch (_) {}
  if (F.pointerMap.size === 1 && F.view.mode === 'pinch') {
    /* v0.5: остался один палец — продолжаем вращение им */
    const pt = Array.from(F.pointerMap.values())[0];
    F.view.mode = 'rotate';
    F.view.lastX = pt.x; F.view.lastY = pt.y; F.view.lastT = now();
    F.view.pinchDist0 = 0;
    return;
  }
  if (F.pointerMap.size > 0) return;
  if (F.view.mode === 'rotate' || F.view.mode === 'pinch') {
    F.view.mode = null;
    if (F.canvas) F.canvas.classList.remove('grabbing');
    pauseIdle();          /* инерция докрутится в frame(), затем авторотация */
    return;
  }
  if (!F.stroke.active) return;
  const s = F.stroke;
  s.active = false;
  const endX = e.clientX, endY = e.clientY;
  const startX = s.startX, startY = s.startY;
  const dist = Math.hypot(endX - startX, endY - startY);
  if (dist < 24) { s.path = []; return; }
  const startCell = cellAtScreen(startX, startY);
  const endCell = cellAtScreen(endX, endY);
  const pathCopy = s.path.slice();
  s.path = [];
  if (!startCell || !endCell || startCell === endCell) {
    flashInvalid(endX, endY, 'нет клеток'); return;
  }
  applyStroke(startX, startY, endX, endY, pathCopy);
}
function cancelStroke() {
  if (!F.stroke.active) return;
  F.stroke.active = false; F.stroke.path = [];
}
function cellAtScreen(x, y) {
  const pl = F.planet;
  if (!pl || !L.project || !pl.revealed) return null;
  let best = null, bestDist = Infinity;
  for (const cid of pl.revealed) {
    const cell = pl.cells[cid];
    if (!cell || cell._destroyed) continue;
    const p = L.project(cell.center);
    if (!(p.z > 0.01)) continue;
    const dx = p.x - x, dy = p.y - y, d = dx * dx + dy * dy;
    if (d < bestDist) { bestDist = d; best = cell; }
  }
  if (!best) return null;
  const maxR = 60 * (S.zoom || 1);
  return bestDist > maxR * maxR ? null : best;
}

/* ---------------------------------------------------------------- geometry */
function pointNearSegment(px, py, ax, ay, bx, by, threshold) {
  const dx = bx - ax, dy = by - ay, len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx, cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy) <= threshold;
}
function segmentsIntersect(x1, y1, x2, y2, x3, y3, x4, y4) {
  const d = (x2 - x1) * (y4 - y3) - (y2 - y1) * (x4 - x3);
  if (Math.abs(d) < 1e-9) return false;
  const t = ((x3 - x1) * (y4 - y3) - (y3 - y1) * (x4 - x3)) / d;
  const u = ((x3 - x1) * (y2 - y1) - (y3 - y1) * (x2 - x1)) / d;
  return t >= 0 && t <= 1 && u >= 0 && u <= 1;
}
function segmentCrossesCircle(x1, y1, x2, y2, cx, cy, r) {
  const dx = x2 - x1, dy = y2 - y1, len2 = dx * dx + dy * dy;
  let t = len2 > 0 ? ((cx - x1) * dx + (cy - y1) * dy) / len2 : 0;
  t = Math.max(0, Math.min(1, t));
  const px = x1 + t * dx, py = y1 + t * dy;
  const minDist = Math.hypot(px - cx, py - cy);
  const d1 = Math.hypot(x1 - cx, y1 - cy);
  const d2 = Math.hypot(x2 - cx, y2 - cy);
  return minDist <= r && Math.max(d1, d2) >= r;
}

/* ---------------------------------------------------------------- attacks */
function fireTighten(t) {
  if (!F.active || F.tangle.hp <= 0) return;
  if (F.tangle.strands.length >= F.maxStrands) return;
  const rng = Math.random;
  const aIdx = Math.floor(rng() * F.anchors.length);
  let bIdx = Math.floor(rng() * F.anchors.length);
  let guard = 0;
  while (bIdx === aIdx && F.anchors.length > 1 && guard++ < 10) bIdx = Math.floor(rng() * F.anchors.length);
  const hp = (TUNE.tightenHpBase + F.level * TUNE.tightenHpPerLevel) * (0.7 + rng() * 0.5);
  F.tangle.strands.push({
    a: F.anchors[aIdx], b: F.anchors[bIdx], hp, maxHp: hp, broken: false,
    curve: 0.7 + rng() * 0.6, phase: rng() * Math.PI * 2,
    fresh: true, freshUntil: t + TUNE.tightenFreshDurationMs,
  });
  F.tangle.maxHp += hp;
  F.tangle.hp += hp;
  F.strandsSpawned++;
}

function firePull(t) {
  if (!F.active || !F.planet) return;
  const pl = F.planet;
  let drained = 0;
  for (const aid of F.anchors) {
    const cell = pl.cells[aid];
    if (!cell || cell._destroyed) continue;
    const isVein = cell.type === 3 || cell.type === 5;
    if (isVein && cell.maxReserve > 0) {
      const drain = Math.max(1, Math.floor(cell.reserve * TUNE.pullReservePct));
      if (drain > 0) {
        cell.reserve = Math.max(0, cell.reserve - drain);
        F.styleStats.reserveLost += drain;
        F.pullFloats.push({ aid, text: `−${drain}`, color: '#ff8c8c', t0: t, duration: 1200 });
        drained++;
      }
    } else {
      const e = TUNE.pullEnergyPerAnchor;
      const before = S.energy || 0;
      if (before >= e) {
        S.energy = before - e;
        F.styleStats.energyLost += e;
        F.pullFloats.push({ aid, text: `−${e}⚡`, color: '#ffda47', t0: t, duration: 1200 });
        drained++;
      }
    }
  }
  if (drained) {
    try { L.updateUI?.(); } catch (e) {}
    try { L.recomputeIncome?.(); } catch (e) {}
  }
}

function fireSweep(t) {
  if (!F.active || F.sweep) return;
  const cx = window.innerWidth / 2;
  const cy = window.innerHeight / 2;
  const discR = Math.min(window.innerWidth, window.innerHeight) * 0.36 * (S.zoom || 1);
  F.sweep = { startedAt: t, duration: TUNE.sweepDurationMs, reflected: false, cx, cy, maxR: discR * 1.05 };
  if (F.allyAutoReflect) {
    F.allyAutoReflect = false;
    F.allyAutoReflectPending = true;
  }
}

function reflectSweep() {
  if (!F.sweep || F.sweep.reflected) return;
  F.sweep.reflected = true;
  F.player.sweepsDeflected++;
  const dmg = TUNE.sweepReflectDamage;
  let remaining = dmg;
  for (const s of F.tangle.strands) {
    if (remaining <= 0) break;
    if (s.broken) continue;
    const d = Math.min(s.hp, remaining);
    s.hp -= d;
    remaining -= d;
    if (s.hp <= 0) { s.hp = 0; s.broken = true; }
  }
  let totalHp = 0;
  for (const s of F.tangle.strands) totalHp += s.hp;
  F.tangle.hp = totalHp;
  const until = now() + TUNE.sweepAwakenDurationMs;
  for (const aid of F.anchors) {
    F.deadAnchors.delete(aid);
    F.awakenedAnchors.set(aid, until);
  }
  F.bursts.push({ x: F.sweep.cx, y: F.sweep.cy, t0: now(), duration: 1200, color: '#ffda47', big: true });
  showStrokeResult(F.sweep.cx, F.sweep.cy - 40, dmg, 1, 0, 0);
  toast('⚡ <b>Волна отражена!</b><br><span style="font-size:11px;">+' + dmg + ' урона · все якоря пробуждены на ' + Math.round(TUNE.sweepAwakenDurationMs / 1000) + 'с</span>', 'success', 3000);
  try { L.updateUI?.(); } catch (e) {}
  save();
  if (F.tangle.hp <= 0) setTimeout(() => exitFight('win'), 350);
}

function resolveSweepHit() {
  if (!F.active || !F.planet) return;
  F.styleStats.sweepsMissed++;
  const pl = F.planet;
  const cands = F.anchors.filter(aid => { const c = pl.cells[aid]; return c && !c._destroyed; });
  const count = Math.min(TUNE.sweepHitAnchors, cands.length);
  const picked = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.floor(Math.random() * cands.length);
    picked.push(cands.splice(idx, 1)[0]);
  }
  const until = now() + TUNE.sweepHitDeadDurationMs;
  let hitAny = false;
  for (const aid of picked) {
    const cell = pl.cells[aid];
    if (!cell) continue;
    const isVein = cell.type === 3 || cell.type === 5;
    if (isVein && cell.maxReserve > 0) {
      const drain = Math.max(1, Math.floor(cell.reserve * TUNE.sweepHitReservePct));
      cell.reserve = Math.max(0, cell.reserve - drain);
      F.styleStats.reserveLost += drain;
      hitAny = true;
    } else {
      const e = TUNE.sweepHitEnergyPerAnchor;
      const before = S.energy || 0;
      if (before > 0) {
        S.energy = Math.max(0, before - e);
        F.styleStats.energyLost += Math.min(before, e);
        hitAny = true;
      }
    }
    F.deadAnchors.set(aid, until);
    F.pullFloats.push({ aid, text: '💀', color: '#ff5e5e', t0: now(), duration: 1400 });
  }
  if (hitAny) {
    toast('🌀 <b>Волна ударила</b><br><span style="font-size:11px;">' + picked.length + ' якоря повреждены и мертвы на ' + Math.round(TUNE.sweepHitDeadDurationMs / 1000) + 'с</span>', 'warn', 3500);
    try { L.updateUI?.(); } catch (e) {}
    try { L.recomputeIncome?.(); } catch (e) {}
  }
}

function applyAllyDamage() {
  if (!F.active || !F.ally) return;
  if (F.tangle.hp <= 0) return;
  let remaining = TUNE.allyDps;
  for (const s of F.tangle.strands) {
    if (s.broken) continue;
    const d = Math.min(s.hp, remaining);
    s.hp -= d;
    remaining -= d;
    if (s.hp <= 0) { s.hp = 0; s.broken = true; }
    if (remaining <= 0) break;
  }
  let totalHp = 0;
  for (const s of F.tangle.strands) totalHp += s.hp;
  F.tangle.hp = totalHp;
  if (F.anchors.length && F.planet) {
    const rnd = Math.floor(Math.random() * F.anchors.length);
    const aid = F.anchors[rnd];
    const cell = F.planet.cells[aid];
    if (cell) {
      const p = L.project?.(cell.center);
      if (p && p.z > 0) {
        F.bursts.push({ x: p.x, y: p.y, t0: now(), duration: 400, color: '#7ee08a' });
      }
    }
  }
  if (F.tangle.hp <= 0) setTimeout(() => exitFight('win'), 350);
}

function tickAttacks(t, dt) {
  if (!F.active) return;

  for (const [aid, until] of F.awakenedAnchors) if (until <= t) F.awakenedAnchors.delete(aid);
  for (const [aid, until] of F.deadAnchors) if (until <= t) F.deadAnchors.delete(aid);
  for (const s of F.tangle.strands) if (s.fresh && s.freshUntil <= t) s.fresh = false;
  for (let i = F.pullFloats.length - 1; i >= 0; i--) {
    if (t - F.pullFloats[i].t0 >= F.pullFloats[i].duration) F.pullFloats.splice(i, 1);
  }

  /* ритуал призыва (v0.4) */
  if (F.allySummonAnim) {
    const age = t - F.allySummonAnim.t0;
    if (age >= F.allySummonAnim.duration) {
      const pending = F.allySummonAnim.pendingAlly;
      F.allySummonAnim = null;
      F.ally = pending;
      F.allyAutoReflect = true;
      F.allyAutoReflectPending = false;
      F.allyTickAccum = 0;
      F._allyBtnSig = null;
      toast(`🤝 <b>${pending.name} пришёл на помощь!</b><br><span style="font-size:11px;">+${TUNE.allyDps} урона/сек · автоотражение следующей волны</span>`, 'success', 4500);
      log('summoned ally:', pending.planetId, '→', F.planetId);
    }
  }

  /* союзник: +N урона/сек */
  if (F.ally) {
    F.allyTickAccum += dt;
    while (F.allyTickAccum >= 1) {
      F.allyTickAccum -= 1;
      applyAllyDamage();
    }
  }

  /* волна */
  if (F.sweep) {
    if (F.allyAutoReflectPending && (t - F.sweep.startedAt) >= 300) {
      F.allyAutoReflectPending = false;
      const name = F.ally?.name || 'Союзник';
      reflectSweep();
      toast(`🤝 <b>${name} отразил волну!</b>`, 'success', 3000);
    }
    const age = (t - F.sweep.startedAt) / F.sweep.duration;
    if (age >= 1) {
      if (!F.sweep.reflected) resolveSweepHit();
      F.sweep = null;
    }
  }

  /* === v0.4: поражение по энергии === */
  const cost = F.cost;
  const energy = S.energy || 0;
  const regen = S.energyPerSec || 0;
  const dry = (energy < cost) && (regen * TUNE.energyDryForecastSec < cost);
  if (dry) {
    F.energyDryMs += dt * 1000;
    if (F.energyDryMs >= TUNE.energyDryWarnAtMs && t - F.lastEnergyDryWarnAt > 3000) {
      F.lastEnergyDryWarnAt = t;
      toast('⚠ <b>Боевой запас иссякает</b><br><span style="font-size:11px;">На стежок не хватает: бой идёт только из запаса, взятого с собой — иначе Хранитель высушит планету</span>', 'warn', 3500);
    }
    if (F.energyDryMs >= TUNE.energyDryTimeoutMs) {
      exitFight('energy-dry');
      return;
    }
  } else {
    F.energyDryMs = 0;
  }
  if (F.hud) F.hud.classList.toggle('dry', F.energyDryMs > 0);

  if (t >= F.attacks.nextTighten) { fireTighten(t); F.attacks.nextTighten = t + TUNE.tightenIntervalMs; }
  if (t >= F.attacks.nextPull) { firePull(t); F.attacks.nextPull = t + TUNE.pullIntervalMs; }
  if (!F.sweep && t >= F.attacks.nextSweep) { fireSweep(t); F.attacks.nextSweep = t + TUNE.sweepIntervalMs; }
}

/* ---------------------------------------------------------------- stroke */
function applyStroke(sx, sy, ex, ey, path) {
  const pl = F.planet;
  if (!pl) return;
  const cost = F.cost;
  const nowT = now();

  if (F.sweep && !F.sweep.reflected) {
    const age = (nowT - F.sweep.startedAt) / F.sweep.duration;
    if (age >= 0 && age < 1) {
      const r = age * F.sweep.maxR;
      if (segmentCrossesCircle(sx, sy, ex, ey, F.sweep.cx, F.sweep.cy, r)) {
        reflectSweep();
        F.trails.push({ path: path.slice(), t0: nowT, duration: 900 });
        return;
      }
    }
  }

  const anchorsHit = [];
  for (const aid of F.anchors) {
    if (F.deadAnchors.has(aid)) continue;
    const cell = pl.cells[aid];
    if (!cell) continue;
    const p = L.project(cell.center);
    if (!(p.z > 0)) continue;
    if (pointNearSegment(p.x, p.y, sx, sy, ex, ey, 26)) anchorsHit.push(aid);
  }
  const anchorsCount = anchorsHit.length;
  const comboMult = anchorsCount >= 4 ? 2.5 : anchorsCount === 3 ? 2.0 : anchorsCount === 2 ? 1.5 : 1.0;
  const awakenedHit = anchorsHit.filter(aid => F.awakenedAnchors.has(aid));
  const awakenedBonus = awakenedHit.length * TUNE.sweepAwakenBonus;

  const strandsHit = [];
  let freshCount = 0;
  for (const strand of F.tangle.strands) {
    if (strand.broken) continue;
    const A = pl.cells[strand.a], B = pl.cells[strand.b];
    if (!A || !B) continue;
    const pA = L.project(A.center), pB = L.project(B.center);
    if (!(pA.z > 0) || !(pB.z > 0)) continue;
    if (segmentsIntersect(sx, sy, ex, ey, pA.x, pA.y, pB.x, pB.y)) {
      strandsHit.push(strand);
      if (strand.fresh) freshCount++;
    }
  }
  const strandsCount = strandsHit.length;
  if (!strandsCount) {
    flashInvalid(ex, ey, 'нить прошла мимо');
    F.styleStats.strokesMissed++;
    return;
  }

  const freshPenalty = freshCount >= 2 ? TUNE.tightenPenaltyTwo : freshCount === 1 ? TUNE.tightenPenaltyOne : 1.0;

  if ((S.energy || 0) < cost) { flashInvalid(ex, ey, `нужно ${cost} ⚡`); return; }
  S.energy -= cost;

  const perStrand = 10 * comboMult * freshPenalty;
  let totalDealt = 0, broke = 0;
  for (const strand of strandsHit) {
    strand.hp -= perStrand;
    totalDealt += perStrand;
    if (strand.fresh || strand.hp <= 0) {
      strand.hp = 0;
      if (!strand.broken) {
        strand.broken = true;
        broke++;
        if (strand.fresh) {
          const A = pl.cells[strand.a], B = pl.cells[strand.b];
          if (A && B) {
            const pA = L.project(A.center), pB = L.project(B.center);
            F.bursts.push({
              x: (pA.x + pB.x) / 2, y: (pA.y + pB.y) / 2,
              t0: nowT, duration: 600, color: '#ff5e9d',
            });
          }
        }
      }
    }
  }
  if (awakenedBonus > 0) {
    for (const strand of strandsHit) {
      if (!strand.broken) {
        strand.hp -= awakenedBonus;
        totalDealt += awakenedBonus;
        if (strand.hp <= 0) { strand.hp = 0; if (!strand.broken) { strand.broken = true; broke++; } }
        break;
      }
    }
  }

  let totalHp = 0;
  for (const s of F.tangle.strands) totalHp += s.hp;
  F.tangle.hp = totalHp;

  F.player.strokesMade++;
  F.player.damageDealt += totalDealt;
  F.player.maxCombo = Math.max(F.player.maxCombo, comboMult);
  F.player.energySpent += cost;
  if (broke > F.styleStats.maxStrandsBrokenInStroke) F.styleStats.maxStrandsBrokenInStroke = broke;

  F.trails.push({ path: path.slice(), t0: nowT, duration: 900 });
  if (broke > 0) {
    for (let i = 0; i < Math.min(broke, 4); i++) {
      F.bursts.push({
        x: ex + (Math.random() - .5) * 40, y: ey + (Math.random() - .5) * 40,
        t0: nowT, duration: 700,
      });
    }
  }
  showStrokeResult(ex, ey, totalDealt, comboMult, broke, anchorsCount);

  try { L.recomputeIncome?.(); } catch (e) {}
  try { L.updateUI?.(); } catch (e) {}
  save();

  if (F.tangle.hp <= 0) setTimeout(() => exitFight('win'), 350);
}

/* ---------------------------------------------------------------- fx */
function flashInvalid(x, y, msg) {
  const el = document.createElement('div');
  el.className = 'gw-combo-pop';
  el.style.left = x + 'px'; el.style.top = y + 'px';
  el.style.color = '#ff8c8c'; el.style.fontSize = '12px';
  el.style.textShadow = '0 0 8px #ff5e5e';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1200);
}
function showStrokeResult(x, y, dmg, mult, broke, anchorsCount) {
  const el = document.createElement('div');
  el.className = 'gw-combo-pop';
  el.style.left = x + 'px'; el.style.top = y + 'px';
  el.style.color = broke > 0 ? '#7ee08a' : '#d8b4fe';
  el.style.fontSize = (14 + mult * 2) + 'px';
  el.style.textShadow = `0 0 10px ${broke > 0 ? '#73c76b' : '#c084fc'}`;
  el.textContent = `−${Math.round(dmg)}` + (mult > 1 ? ` ×${mult}` : '') + (broke > 0 ? ` 💥${broke}` : '');
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 1200);
  if (mult > 1.4) {
    const big = document.createElement('div');
    big.className = 'gw-combo-pop';
    big.style.left = '50%'; big.style.top = '40%';
    big.style.color = mult >= 2.5 ? '#ffda47' : '#c084fc';
    big.style.fontSize = '30px';
    big.style.textShadow = `0 0 24px ${mult >= 2.5 ? '#ffda47' : '#c084fc'}`;
    big.textContent = `УЗЕЛ ×${mult}`;
    if (anchorsCount > 0) big.textContent += ` · якорей ${anchorsCount}`;
    document.body.appendChild(big);
    setTimeout(() => big.remove(), 1200);
  }
}

/* ---------------------------------------------------------------- style → seal */
function classifyStyle() {
  const p = F.player;
  const s = F.styleStats;
  const duration = now() - F.arena.startedAt;

  if (s.maxStrandsBrokenInStroke >= 3 && duration < 60000) {
    return { id: 'all_seal', tag: 'мастер', icon: '⚡', summary: `3+ нити одним стежком за ${Math.round(duration/1000)}с` };
  }
  if (p.sweepsDeflected >= 2 && s.energyLost < 500) {
    return { id: 'all_seal', tag: 'мастер-отражатель', icon: '✦', summary: `${p.sweepsDeflected} отражений, ${s.energyLost}⚡ потеряно` };
  }
  if (p.sweepsDeflected >= 1 && p.maxCombo >= 2.0) {
    return { id: 'scan_seal', tag: 'точность', icon: '🎯', summary: `комбо ×${p.maxCombo.toFixed(1)}, ${p.sweepsDeflected} отражение` };
  }
  if (duration < 45000) {
    return { id: 'iron_seal', tag: 'скорость', icon: '⚡', summary: `${Math.round(duration/1000)}с` };
  }
  if (s.energyLost === 0 && duration < 75000) {
    return { id: 'energy_seal', tag: 'чистота', icon: '✨', summary: '0 энергии потеряно' };
  }
  if (s.energyLost > 1500) {
    return { id: 'kriogen_seal', tag: 'утешение', icon: '❄', summary: `${s.energyLost}⚡ потеряно` };
  }
  if (duration >= 60000) {
    return { id: 'depletion_seal', tag: 'терпение', icon: '⏳', summary: `${Math.round(duration/1000)}с` };
  }
  return { id: 'depletion_seal', tag: 'стабильность', icon: '🛡', summary: 'стандартный бой' };
}

function pickSealForVictory(pl) {
  const style = classifyStyle();
  if (L.Hd) {
    try {
      if (L.Hd(pl, style.id)) return style;
    } catch (e) {}
    const seals = (window.VORONIA_BALANCE?.boss?.seals) || [];
    const applicable = seals.filter(s => { try { return L.Hd(pl, s.id); } catch (e) { return true; } });
    if (applicable.length) {
      const fallback = applicable[Math.floor(Math.random() * applicable.length)];
      return { id: fallback.id, tag: 'fallback', icon: '◆', summary: 'стиль не применим к планете' };
    }
    return { id: 'depletion_seal', tag: 'fallback', icon: '🛡', summary: '' };
  }
  return style;
}

/* ---------------------------------------------------------------- allies */
function getAvailableAllies(excludePid) {
  const s = state();
  const r = [];
  for (const pid in s.allies) {
    if (pid === excludePid) continue;
    const a = s.allies[pid];
    if (!a || !a.available) continue;
    r.push({ planetId: pid, ...a });
  }
  return r;
}

/* Клик по кнопке призыва (v0.4) */
function summonAlly() {
  if (!F.active) return;
  if (F.ally || F.allySummonAnim) return;

  const s = state();
  const available = getAvailableAllies(F.planetId);

  if (!available.length) {
    /* v0.4: конкретная причина, а не «нет доступных» */
    const allMine = Object.keys(s.allies).filter(pid => pid !== F.planetId);
    if (allMine.length === 0) {
      toast('🤝 <b>Союзников пока нет</b><br><span style="font-size:11px;color:#91adbb;">Победи Хранителя 3 раза подряд на одной планете — и он станет союзником</span>', '', 4200);
    } else {
      toast('🤝 <b>Все союзники заняты</b><br><span style="font-size:11px;color:#91adbb;">На кулдауне (12ч после призыва) или это планета-родоначальник союзника</span>', 'warn', 4200);
    }
    return;
  }

  const ally = available[0];
  s.allies[ally.planetId].available = false;
  s.allies[ally.planetId].cooldownUntil = Date.now() + TUNE.allyCooldownMs;
  save();

  /* v0.4: имя из реплики Хранителя этой планеты */
  let allyDisplayName = ally.name || `Страж ${L.PLANETS?.[ally.planetId]?.name || ally.planetId}`;
  try {
    if (L.pickGuardianLine && L.PLANETS?.[ally.planetId]) {
      const line = L.pickGuardianLine(L.PLANETS[ally.planetId], ally.formId || 'sentinel', 'repeatWin');
      if (line) {
        const plName = L.PLANETS[ally.planetId]?.name || ally.planetId;
        const formName = ally.formId === 'overlord' ? 'Владыка' : ally.formId === 'guardian' ? 'Хранитель' : 'Страж';
        allyDisplayName = allyNameFromLine(plName, formName, line);
      }
    }
  } catch (e) { /* fallback на ally.name */ }
  s.allies[ally.planetId].displayName = allyDisplayName;
  save();

  /* v0.4: запускаем анимацию, ally устанавливаем на завершении */
  F.allySummonAnim = {
    t0: now(),
    duration: TUNE.allySummonAnimMs,
    pendingAlly: {
      planetId: ally.planetId,
      name: allyDisplayName,
      formId: ally.formId || 'sentinel',
      level: ally.level || 1,
    },
  };
  F._allyBtnSig = null;
  log('summoning ally (anim):', ally.planetId, '→', F.planetId, 'as', allyDisplayName);
}

function updateAlliesHud() {
  const btn = $id('gw-ally-btn');
  if (!btn) return;

  if (F.allySummonAnim) {
    if (F._allyBtnSig !== 'summoning') {
      F._allyBtnSig = 'summoning';
      btn.style.display = '';
      btn.disabled = true;
      btn.className = 'gw-btn ally summoning';
      btn.textContent = '🤝 Призыв...';
      btn.title = 'Союзник уже в пути';
    }
    return;
  }

  if (F.ally) {
    if (F._allyBtnSig !== `active:${F.ally.planetId}`) {
      F._allyBtnSig = `active:${F.ally.planetId}`;
      btn.style.display = '';
      btn.disabled = true;
      btn.className = 'gw-btn ally active';
      btn.textContent = `🤝 ${F.ally.name}`;
      btn.title = 'Союзник в бою';
    }
    return;
  }

  const av = getAvailableAllies(F.planetId);
  const sig = av.length ? `ready:${av.length}:${av.map(a => a.planetId).join(',')}` : 'none';
  if (F._allyBtnSig === sig) return;
  F._allyBtnSig = sig;

  if (!av.length) {
    /* v0.4: показать кнопку, если есть союзники, но недоступны — с tooltip */
    const s = state();
    const total = Object.keys(s.allies).filter(pid => pid !== F.planetId).length;
    if (total > 0) {
      btn.style.display = '';
      btn.disabled = false;
      btn.className = 'gw-btn ally';
      btn.textContent = '🤝 Призвать';
      btn.title = `Союзников всего ${total}, но все на кулдауне или с этой же планеты`;
    } else {
      btn.style.display = 'none';
    }
    return;
  }
  btn.style.display = '';
  btn.disabled = false;
  btn.className = 'gw-btn ally';
  btn.textContent = `🤝 Призвать (${av.length})`;
  btn.title = av.map(a => a.displayName || a.name || a.planetId).join(' · ');
}

/* ---------------------------------------------------------------- fight cooldown + cell recovery */
const COOLDOWN_STORAGE_KEY = 'voronia_guardian_fight_cooldowns_v2';
function readCooldownMap() {
  try { const v = JSON.parse(localStorage.getItem(COOLDOWN_STORAGE_KEY) || '{}'); return v && typeof v === 'object' ? v : {}; }
  catch (e) { return {}; }
}
function getFightCooldownUntil(planetId) {
  const map = readCooldownMap();
  return Math.max(Number(state().fightCooldownUntil[planetId]) || 0, Number(map[planetId]) || 0);
}
function setFightCooldown(planetId, until) {
  const s = state();
  s.fightCooldownUntil[planetId] = until;
  const map = readCooldownMap(); map[planetId] = until;
  try { localStorage.setItem(COOLDOWN_STORAGE_KEY, JSON.stringify(map)); } catch (e) {}
  save();
}
function randomFightCooldownMs() {
  return TUNE.fightCooldownMinMs + Math.random() * (TUNE.fightCooldownMaxMs - TUNE.fightCooldownMinMs);
}
function formatWait(ms) {
  const sec = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60);
  return h + ' ч ' + String(m).padStart(2, '0') + ' мин';
}
function restoreDueCells(planetId, force) {
  const s = state(), record = s.destroyedCells[planetId];
  if (!record || !Array.isArray(record.ids) || !record.ids.length) return 0;
  /* v0.6-фикс: проверка срока — в v0.0.23 её не было, и 30-секундный интервал
     чинил все ячейки сразу, обнуляя штраф и смысл платного восстановления. */
  if (!force && (Number(record.restoreAt) || 0) > Date.now()) return 0;
  const pl = L.PLANETS?.[planetId];
  if (!pl) return 0;
  const ids = record.ids.slice();
  let restored = 0;
  for (const id of ids) {
    const cell = pl.cells?.[id]; if (!cell || !cell._destroyed) continue;
    /* v0.6-фикс: общедвижковая конвенция (Iv/ac/UX-патч) — уровень и доходность
       возвращаются из снапшота, а не сбрасываются в 1 (иначе yield оставался
       старым при level=1 → рассинхрон экономики и эксплойт дешёвых апгрейдов). */
    if (cell._destroyedSnapshot) { Object.assign(cell, cell._destroyedSnapshot); delete cell._destroyedSnapshot; }
    cell._destroyed = false;
    cell._restoreAt = 0;
    cell._restoreCost = null;
    pl.explored?.add(id); pl.revealed?.add(id);
    restored++;
  }
  delete s.destroyedCells[planetId]; save();
  try { L.recomputeIncome?.(); L.updateUI?.(); V.panels?.renderPlanetPanel?.(); } catch (e) {}
  return restored;
}
function destroyOpenCells(planetId) {
  const pl = L.PLANETS?.[planetId]; if (!pl || !pl.explored) return { count: 0, percent: 0 };
  const s = state();
  /* Do not destroy the start cell: the player must retain a viable foothold. */
  const opened = [...pl.explored].filter(id => id !== pl.startingCellId && pl.cells?.[id] && !pl.cells[id]._destroyed);
  if (!opened.length) return { count: 0, percent: 0 };
  const percent = 1 + Math.random() * 24;
  const count = Math.min(opened.length, Math.max(1, Math.ceil(opened.length * percent / 100)));
  for (let i = opened.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [opened[i], opened[j]] = [opened[j], opened[i]]; }
  const ids = opened.slice(0, count);
  for (const id of ids) {
    const cell = pl.cells[id];
    /* v0.6-фикс: снапшот вместо level=1; ячейка остаётся в explored/revealed —
       так работают сериализация (_destroyedSnapshot переживает сейв), метка 💀
       на сфере и штатное движковое восстановление за ⚡+💎 (ac/Kw/cx). */
    cell._destroyedSnapshot = { level: cell.level, isDeep: cell.isDeep, reserve: cell.reserve,
      maxReserve: cell.maxReserve, ironYield: cell.ironYield, kriogenYield: cell.kriogenYield,
      resourceKey: cell.resourceKey };
    cell._destroyed = true;
    cell._restoreAt = Date.now() + TUNE.cellRestoreDelayMs;
    cell._restoreCost = (L.computeRestoreCost ? L.computeRestoreCost(cell) : { energy: 0, crystals: 0 });
  }
  s.destroyedCells[planetId] = { ids, restoreAt: Date.now() + TUNE.cellRestoreDelayMs, percent, destroyedAt: Date.now() };
  save();
  try { L.recomputeIncome?.(); L.updateUI?.(); V.panels?.renderPlanetPanel?.(); } catch (e) {}
  setTimeout(() => { try { const r = restoreDueCells(planetId); if (r) toast(`🧬 <b>Восстановление завершено</b><br>На планете восстановлено ячеек: ${r}.`, 'success', 6000); } catch (e) {} }, TUNE.cellRestoreDelayMs + 500);
  return { count, percent };
}
function restoreCellsForCost(planetId) {
  const s = state(), record = s.destroyedCells[planetId];
  const pl = L.PLANETS?.[planetId];
  /* v0.6-фикс: считаем только реально разрушенные ячейки — движок мог починить их сам (за ⚡+💎) */
  const liveIds = record && Array.isArray(record.ids)
    ? record.ids.filter(id => pl && pl.cells && pl.cells[id] && pl.cells[id]._destroyed) : [];
  if (!liveIds.length) {
    if (record) { delete s.destroyedCells[planetId]; save(); }
    toast('На этой планете нет уничтоженных ячеек.', '', 3000);
    return false;
  }
  const remaining = Math.max(0, (record.restoreAt || 0) - Date.now());
  if (!remaining) { restoreDueCells(planetId); return true; }
  const count = liveIds.length;
  const researchCost = TUNE.cellRestoreResearchPerCell;
  const crystalCost = TUNE.cellRestoreCrystalsPerCell;
  if ((Number(S.research) || 0) < researchCost || (Number(S.crystals) || 0) < crystalCost) {
    toast(`🧬 <b>Недостаточно ресурсов для восстановления</b><br>Нужно: ${researchCost} 🧪 исследования и ${crystalCost} 💎 кристаллов.`, 'warn', 6000);
    return false;
  }
  if (!window.confirm(`Восстановить ${count} ячеек сейчас?\nСтоимость: ${researchCost} 🧪 исследования + ${crystalCost} 💎 кристаллов.`)) return false;
  S.research -= researchCost; S.crystals -= crystalCost;
  const restored = restoreDueCells(planetId, true);
  save();
  try { L.updateUI?.(); } catch (e) {}
  toast(`🧬 <b>Ячейки восстановлены</b><br>${restored} ячеек · −${researchCost} 🧪 · −${crystalCost} 💎`, 'success', 6000);
  return true;
}
window.__V.guardianCellRecovery = {
  restoreNow: restoreCellsForCost,
  status(planetId) { const r = state().destroyedCells[planetId]; return r ? { count: r.ids?.length || 0, restoreAt: r.restoreAt, remainingMs: Math.max(0, (r.restoreAt || 0) - Date.now()), researchCost: TUNE.cellRestoreResearchPerCell, crystalCost: TUNE.cellRestoreCrystalsPerCell } : null; }
};
/* Catch up recovery after the game has been closed or suspended. */
setInterval(() => { try { for (const pid of Object.keys(state().destroyedCells)) restoreDueCells(pid); } catch (e) {} }, 30000);

/* ---------------------------------------------------------------- enter/exit */
function enterFight(planetId) {
  const stored = state();
  if (F.active) return;
  const cooldownUntil = getFightCooldownUntil(planetId);
  if (cooldownUntil > Date.now()) { warn(`Повторный бой доступен через ${formatWait(cooldownUntil - Date.now())}`); toast(`⏳ <b>Хранитель восстанавливает силы</b><br>Следующий бой доступен через ${formatWait(cooldownUntil - Date.now())}.`, 'warn', 5000); return; }
  restoreDueCells(planetId);
  /* v0.6-фикс: гейт по реально разрушенным ячейкам (запись могла устареть, если движок починил их сам) */
  const plG = L.PLANETS?.[planetId];
  const recG = stored.destroyedCells[planetId];
  const liveG = recG && Array.isArray(recG.ids)
    ? recG.ids.filter(id => plG && plG.cells && plG.cells[id] && plG.cells[id]._destroyed).length : 0;
  if (recG && !liveG) { delete stored.destroyedCells[planetId]; save(); }
  if (liveG > 0) {
    const left = Math.max(0, (recG.restoreAt || 0) - Date.now());
    toast(`🧬 <b>Часть ячеек уничтожена</b><br>Автовосстановление через ${formatWait(left)}.<br><button class="gw-btn" style="margin-top:7px" onclick="window.__V.guardianCellRecovery.restoreNow('${String(planetId).replace(/'/g, '')}')">Восстановить за 🧪 + 💎</button>`, 'warn', 9000);
    return;
  }
  /* v0.6: порог входа по энергии — бой оплачивается только из запаса, взятого с собой;
     с нулём игрок мгновенно терял бы бой и ячейки. Нужно ≥ 20 с дренажа + 3 стежка. */
  const gateCost = Math.min(TUNE.strokeCostBase * ((plG && plG.planetIndex) || 1), TUNE.strokeCostMax);
  const winsGate = Number(stored.winsByPlanet[planetId]) || 0;
  const drainGate = TUNE.fightEnergyBasePerSec + Math.floor(winsGate / 3) * TUNE.fightEnergyStepPerThreeWins;
  const minEntry = drainGate * 20 + gateCost * 3;
  if ((Number(S.energy) || 0) < minEntry) {
    toast(`⚡ <b>Недостаточно энергии для боя</b><br><span style="font-size:11px;">Бой идёт только из запаса, взятого с собой: нужно ≥ ${Math.round(minEntry).toLocaleString('ru-RU')} ⚡ (дренаж ${drainGate}/с + стежки по ${gateCost} ⚡). Накопите энергию — Хранитель подождёт.</span>`, 'warn', 8000);
    return;
  }
  if (F.active) return;
  const pl = L.PLANETS?.[planetId];
  if (!pl) { warn('Планета не найдена'); return; }
  if (!pl.explored || pl.explored.size < pl.cells.length) { warn('Сначала исследуй планету на 100%'); return; }
  const profile = L.guardianProfileFor?.(pl);
  if (!profile) { warn('Профиль грани не найден'); return; }
  const nextForm = L.guardianNextForm?.(pl);
  if (!nextForm) { warn('Хранитель сейчас недоступен'); return; }

  const level = (profile.guardianLevel || 0) + 1;
  const anchors = pickAnchors(pl, level);
  if (!anchors) { warn('Не хватает якорей — планета слишком повреждена'); return; }
  const tangle = buildTangle(pl, anchors, level);

  const t0 = now();
  F.active = true; F.finished = false;
  F.planet = pl; F.planetId = planetId; F.level = level;
  F.anchors = anchors;
  F.tangle = tangle;
  F.arena = { startedAt: t0, timeLimit: TUNE.timeLimitMs };
  F.attacks = {
    nextTighten: t0 + TUNE.tightenIntervalMs,
    nextPull: t0 + TUNE.pullIntervalMs,
    nextSweep: t0 + TUNE.sweepIntervalMs,
  };
  F.sweep = null;
  F.awakenedAnchors.clear();
  F.deadAnchors.clear();
  F.pullFloats.length = 0;
  F.maxStrands = tangle.strands.length + TUNE.maxExtraStrands;
  F.strandsSpawned = 0;
  F.player = { strokesMade: 0, damageDealt: 0, sweepsDeflected: 0, maxCombo: 1, energySpent: 0 };
  F.styleStats = { sweepsMissed: 0, strokesMissed: 0, maxStrandsBrokenInStroke: 0, energyLost: 0, reserveLost: 0 };
  F.ally = null;
  F.allyAutoReflect = false;
  F.allyAutoReflectPending = false;
  F.allyTickAccum = 0;
  F.allySummonAnim = null;
  F.energyDryMs = 0;
  F.lastEnergyDryWarnAt = 0;
  F.energyAtStart = Math.max(0, Number(S.energy) || 0);
  F.energyDrainAccum = 0;
  const fightNo = (Number(state().fightCountByPlanet[planetId]) || 0) + 1;
  state().fightCountByPlanet[planetId] = fightNo;
  /* v0.6.1: +20 ⚡/с за каждую 3-ю ПОБЕДУ на планете (раньше +5 за каждый 3-й бой независимо от исхода) */
  const winsCnt = Number(state().winsByPlanet[planetId]) || 0;
  F.energyDrainRate = TUNE.fightEnergyBasePerSec + Math.floor(winsCnt / 3) * TUNE.fightEnergyStepPerThreeWins;
  F.energyLastHudAt = 0;
  F.stroke.active = false;
  F.trails.length = 0; F.bursts.length = 0;
  F.pointerMap.clear();
  F.cost = Math.min(TUNE.strokeCostBase * (pl.planetIndex || 1), TUNE.strokeCostMax);
  F._allyBtnSig = null;

  if (S.started) { S.zoom = Math.min(3.5, (S.zoom || 1) * 1.08); S.selectedCellId = null; }
  /* v0.5: базовый вид для сброса (двойной тап / ⟲) */
  F.view.zoom0 = S.zoom || 1;
  F.view.rotX0 = typeof S.rotX === 'number' ? S.rotX : -0.08;
  F.view.rotY0 = S.rotY || 0;
  F.view.mode = null; F.view.spinX = 0; F.view.spinY = 0;
  F.view.idleUntil = 0; F.view.pinchDist0 = 0;
  F.view.lastTapAt = 0; F._zoomChipSig = null;

  state().active = { planetId, level, startedAt: Date.now(), anchors: anchors.slice(), tangleMaxHp: tangle.maxHp, energyAtStart: F.energyAtStart, energyDrainRate: F.energyDrainRate, fightNo };
  save();
  setupDom(); showDom(); updateAlliesHud();

  toast(`⚔ <b>Распутка · ур.${level}</b><br><span style="font-size:11px;color:#91adbb;">Якорей: ${anchors.length} · Нитей: ${tangle.strands.length} · HP: ${Math.round(tangle.maxHp)} · Стежок: ${F.cost} ⚡ · Дренаж: ${F.energyDrainRate}/с</span>`, 'success', 5500);
  try { L.closeModals?.(); } catch (e) {}
}

function exitFight(reason) {
  if (!F.active || F.finished) return;
  F.finished = true;
  const pl = F.planet;
  const pid = F.planetId;
  const duration = now() - F.arena.startedAt;
  const s = state();

  if (reason === 'win') {
    const tier = F.level <= 3 ? 'sentinel' : F.level <= 7 ? 'guardian' : 'overlord';
    const sealDefs = (window.VORONIA_BALANCE?.boss?.seals) || [];
    const tierSealIds = tier === 'sentinel'
      ? ['energy_seal','iron_seal','kriogen_seal']
      : tier === 'guardian'
        ? ['depletion_seal','scan_seal','energy_seal','iron_seal','kriogen_seal']
        : ['all_seal','depletion_seal','scan_seal'];
    const tierPool = sealDefs.filter(x => tierSealIds.includes(x.id) && (!L.Hd || L.Hd(pl, x.id)));
    const style = tierPool.length
      ? (() => { const chosen = tierPool[Math.floor(Math.random() * tierPool.length)]; return { id: chosen.id, tag: tier === 'sentinel' ? 'награда Стража' : tier === 'guardian' ? 'награда Хранителя' : 'редкая награда Владыки', icon: chosen.icon || '◆', summary: `Сложность: ${tier === 'sentinel' ? 'I · Страж' : tier === 'guardian' ? 'II · Хранитель' : 'III · Владыка'}` }; })()
      : pickSealForVictory(pl);
    try {
      const profile = L.guardianProfileFor?.(pl);
      if (profile) {
        profile.guardianLevel = (profile.guardianLevel || 0) + 1;
        profile.missedCount = 0;
        profile.seal = { id: style.id, until: Date.now() + ((window.VORONIA_BALANCE && window.VORONIA_BALANCE.boss && window.VORONIA_BALANCE.boss.sealDurationMs) || 4 * 3600 * 1000), level: profile.guardianLevel };
      }
      const boss = L.ensureBossState?.(pl);
      if (boss) { boss.defeated = true; boss.hp = 0; boss.reward = style.id; }
    } catch (e) { console.warn('[gw] seal apply failed:', e); }

    const prevStreak = s.planetStreak[pid] || 0;
    const newStreak = prevStreak + 1;
    s.planetStreak[pid] = newStreak;
    s.winsByPlanet[pid] = (Number(s.winsByPlanet[pid]) || 0) + 1;   /* v0.6.1: счётчик побед для дренажа */
    let newAlly = null;
    if (newStreak >= TUNE.winsForAlly) {
      s.planetStreak[pid] = 0;
      const profile = L.guardianProfileFor?.(pl);
      const lvl = (profile?.guardianLevel || 1);
      const formId = lvl <= 3 ? 'sentinel' : lvl <= 7 ? 'guardian' : 'overlord';
      const formName = formId === 'sentinel' ? 'Страж' : formId === 'guardian' ? 'Хранитель' : 'Владыка';
      const plName = pl.name || pid;
      /* v0.4: имя из реплики Хранителя при создании */
      let displayName = `${formName} ${plName}`;
      try {
        if (L.pickGuardianLine) {
          const line = L.pickGuardianLine(pl, formId, 'repeatWin');
          if (line) displayName = allyNameFromLine(plName, formName, line);
        }
      } catch (e) {}
      s.allies[pid] = {
        available: true, since: Date.now(), level: lvl,
        formId, name: `${formName} ${plName}`,
        displayName,
      };
      newAlly = s.allies[pid];
    }

    s.history.push({
      at: Date.now(), planetId: pid, level: F.level, won: true,
      durationMs: Math.round(duration), strokes: F.player.strokesMade,
      damage: Math.round(F.player.damageDealt), maxCombo: F.player.maxCombo,
      sweepsDeflected: F.player.sweepsDeflected, sweepsMissed: F.styleStats.sweepsMissed,
      strokesMissed: F.styleStats.strokesMissed,
      maxBrokenInStroke: F.styleStats.maxStrandsBrokenInStroke,
      energyLost: F.styleStats.energyLost, reserveLost: F.styleStats.reserveLost,
      allyUsed: !!F.ally, allyName: F.ally?.name || null,
      strandsSpawned: F.strandsSpawned,
      seal: style.id, sealTag: style.tag, sealSummary: style.summary,
    });
    s.seals.push({ id: style.id, tag: style.tag, at: Date.now(), planetId: pid, level: F.level });
    s.active = null;
    save();

    try { L.recomputeIncome?.(); } catch (e) {}
    try { L.updateUI?.(); } catch (e) {}
    try { V.panels?.renderPlanetPanel?.(); } catch (e) {}

    const sealDef = L.sealDefById?.(style.id);
    toast(`⚔ <b>Хранитель распутан</b><br><span style="color:${style.tag === 'мастер' || style.tag === 'мастер-отражатель' ? '#ffda47' : '#c084fc'};font-weight:900;">${style.icon} «${sealDef?.name || style.id}»</span> — ${sealDef?.desc || ''}<br><span style="font-size:10px;color:#91adbb;">Стиль: <b>${style.tag}</b> · ${style.summary}<br>Ур.${F.level} · ${Math.round(duration/1000)}с · ${F.player.strokesMade} стежков · комбо ×${F.player.maxCombo.toFixed(1)}${F.player.sweepsDeflected ? ` · отражений ${F.player.sweepsDeflected}` : ''}${F.ally ? ` · ${F.ally.name}` : ''}</span>`, 'success', 9500);

    if (newAlly) {
      setTimeout(() => {
        toast(`🤝 <b>${newAlly.displayName || newAlly.name}</b> стал союзником!<br><span style="font-size:11px;">Теперь может быть призван в бой на другой планете (${TUNE.winsForAlly} победы подряд)</span>`, 'success', 8000);
      }, 1800);
    } else if (newStreak > 1) {
      setTimeout(() => {
        toast(`🤝 Серия побед: ${newStreak}/${TUNE.winsForAlly}<br><span style="font-size:10px;color:#91adbb;">${TUNE.winsForAlly - newStreak} до союзника</span>`, '', 4000);
      }, 1800);
    }

    try { BUS?.emit?.('guardian:won', { pid, level: F.level, seal: style.id, tag: style.tag }); } catch (e) {}
  } else if (reason === 'retreat') {
    s.planetStreak[pid] = 0;
    s.active = null;
    save();
    toast('🏳 Ты отступил. Серия побед сброшена. Хранитель остался ждать.', '', 4000);
  } else if (reason === 'timeout') {
    if (pl?.boss) pl.boss.canReviveAt = Date.now() + 5 * 60 * 1000;
    s.planetStreak[pid] = 0;
    s.history.push({
      at: Date.now(), planetId: pid, level: F.level, won: false,
      durationMs: Math.round(duration), strokes: F.player.strokesMade,
      damage: Math.round(F.player.damageDealt), sweepsDeflected: F.player.sweepsDeflected,
      reason: 'timeout',
    });
    s.active = null;
    save();
    toast('⏳ <b>Время вышло.</b><br>Хранитель ушёл вглубь. Возвращайся через 5 минут. Серия сброшена.', 'warn', 6000);
    try { BUS?.emit?.('guardian:lost', { pid, level: F.level }); } catch (e) {}
  } else if (reason === 'energy-dry') {
    /* v0.4: поражение по энергии */
    if (pl?.boss) pl.boss.canReviveAt = Date.now() + 5 * 60 * 1000;
    s.planetStreak[pid] = 0;
    s.history.push({
      at: Date.now(), planetId: pid, level: F.level, won: false,
      durationMs: Math.round(duration), strokes: F.player.strokesMade,
      damage: Math.round(F.player.damageDealt), sweepsDeflected: F.player.sweepsDeflected,
      reason: 'energy-dry',
    });
    s.active = null;
    const damage = destroyOpenCells(pid);
    save();
    toast(`⚡ <b>Энергия исчерпана — поражение</b><br><span style="font-size:11px;">Хранитель разрушил ${damage.count} открытых ячеек (${Math.round(damage.percent)}%). Автовосстановление через 30 минут либо вручную за ${TUNE.cellRestoreResearchPerCell} 🧪 + ${TUNE.cellRestoreCrystalsPerCell} 💎. Серия сброшена.</span>`, 'danger', 9000);
    try { BUS?.emit?.('guardian:lost', { pid, level: F.level, reason: 'energy-dry' }); } catch (e) {}
  }

  if (pid && ['win','retreat','timeout','energy-dry'].includes(reason)) {
    const cooldownMs = randomFightCooldownMs();
    setFightCooldown(pid, Date.now() + cooldownMs);
    if (reason === 'win') toast(`⏳ Следующий бой на этой планете будет доступен через ${formatWait(cooldownMs)}.`, '', 5000);
  }
  F.active = false; F.planet = null; F.planetId = null;
  F.sweep = null;
  F.awakenedAnchors.clear(); F.deadAnchors.clear(); F.pullFloats.length = 0;
  F.ally = null; F.allyAutoReflect = false; F.allyAutoReflectPending = false; F.allyTickAccum = 0;
  F.allySummonAnim = null;
  F.energyDryMs = 0; F.lastEnergyDryWarnAt = 0;
  F.stroke.active = false; F.pointerMap.clear();
  F.view.mode = null; F.view.spinX = 0; F.view.spinY = 0; F.view.pinchDist0 = 0;
  if (F.canvas) F.canvas.classList.remove('grabbing');
  F.trails.length = 0; F.bursts.length = 0;
  F._allyBtnSig = null;
  hideDom();
  if (F.ctx) F.ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  setTimeout(() => { F.finished = false; }, 500);
}

/* ---------------------------------------------------------------- frame */
function frame(t) {
  if (!F.active) return;
  const dt = F.lastFrameAt ? Math.min(.1, (t - F.lastFrameAt) / 1000) : 1 / 60;
  F.lastFrameAt = t;

  const pl = F.planet;
  if (!pl) return;

  /* v0.5: инерция ручного вращения, затем — авторотация после паузы */
  const vw = F.view;
  if (!vw.mode && (Math.abs(vw.spinX) + Math.abs(vw.spinY) > VIEW.spinMin)) {
    if (S.started) {
      S.rotY += vw.spinY; S.rotX += vw.spinX; clampRotX();
      vw.spinY *= VIEW.spinDecay; vw.spinX *= VIEW.spinDecay;
    }
  } else if (S.started && !F.stroke.active && !vw.mode && now() > vw.idleUntil) {
    S.rotY += dt * 0.05;
  }

  const elapsed = t - F.arena.startedAt;
  const remaining = F.arena.timeLimit - elapsed;
  if (remaining <= 0) { exitFight('timeout'); return; }

  /* Combat is paid only from the energy held at entry; passive income during the fight cannot refill this pool. */
  F.energyDrainAccum += dt;
  const spentByActions = Math.max(0, Number(F.player.energySpent) || 0);
  const timeCost = F.energyDrainAccum * F.energyDrainRate;
  const poolLeft = Math.max(0, F.energyAtStart - spentByActions - timeCost);
  S.energy = Math.min(Math.max(0, Number(S.energy) || 0), poolLeft);
  if (t - F.energyLastHudAt > 450) { F.energyLastHudAt = t; try { L.updateUI?.(); } catch (e) {} }
  if (poolLeft <= 0) { S.energy = 0; exitFight('energy-dry'); return; }

  tickAttacks(t, dt);
  updateHud(remaining);
  if (t - F._lastAllyHud > 500) { F._lastAllyHud = t; updateAlliesHud(); }
  renderAll(t);
}

function updateHud(remainingMs) {
  if (!F.hud) return;
  const pct = F.tangle.maxHp > 0 ? Math.max(0, F.tangle.hp / F.tangle.maxHp) : 0;
  const fill = $id('gw-hp-fill'), val = $id('gw-hp-val');
  if (fill) {
    fill.style.width = (pct * 100).toFixed(1) + '%';
    fill.style.background = pct > .5 ? 'linear-gradient(90deg,#c084fc,#ff4d9d)'
      : pct > .2 ? 'linear-gradient(90deg,#ff4d9d,#ffda47)'
      : 'linear-gradient(90deg,#ff5e5e,#ff8c8c)';
  }
  if (val) val.textContent = `${Math.max(0, Math.round(F.tangle.hp))}/${Math.round(F.tangle.maxHp)}`;

  const tv = $id('gw-timer-val');
  if (tv) tv.textContent = Math.max(0, Math.ceil(remainingMs / 1000));

  /* энергия (v0.4) */
  const ev = $id('gw-energy-val'), cv = $id('gw-cost-val'), ec = $id('gw-energy-chip');
  if (ev) ev.textContent = Math.floor(S.energy || 0).toLocaleString('ru-RU');
  if (cv) cv.textContent = F.cost;
  if (ec) ec.classList.toggle('low', F.energyDryMs > 0);

  /* v0.5: индикатор масштаба */
  const zs = (S.zoom || 1).toFixed(2).replace('.', ',');
  if (zs !== F._zoomChipSig) {
    F._zoomChipSig = zs;
    const zv = $id('gw-zoom-val');
    if (zv) zv.textContent = zs;
  }

  const t = now();
  function fmt(ms) {
    if (ms <= 0) return '—';
    const s = ms / 1000;
    return s < 10 ? s.toFixed(1) + 'с' : Math.ceil(s) + 'с';
  }
  const tgEl = $id('gw-tighten-val'); if (tgEl) tgEl.textContent = fmt(F.attacks.nextTighten - t);
  const plEl = $id('gw-pull-val'); if (plEl) plEl.textContent = fmt(F.attacks.nextPull - t);
  const swEl = $id('gw-sweep-val');
  if (swEl) {
    if (F.sweep) swEl.textContent = F.sweep.reflected ? '✓' : 'АКТИВНА';
    else swEl.textContent = fmt(F.attacks.nextSweep - t);
    swEl.classList.toggle('warn', !!F.sweep && !F.sweep.reflected);
  }
}

function renderAll(t) {
  const ctx = F.ctx;
  if (!ctx) return;
  ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);
  const pl = F.planet;
  if (!pl) return;
  const proj = L.project;
  if (!proj) return;

  for (let i = F.trails.length - 1; i >= 0; i--) {
    const tr = F.trails[i];
    const age = (t - tr.t0) / tr.duration;
    if (age >= 1) { F.trails.splice(i, 1); continue; }
    drawPath(ctx, tr.path, `rgba(255,220,100,${((1 - age) * 0.7).toFixed(3)})`, 2);
  }

  /* путаница */
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const strand of F.tangle.strands) {
    if (strand.broken) continue;
    const A = pl.cells[strand.a], B = pl.cells[strand.b];
    if (!A || !B) continue;
    const pA = proj(A.center), pB = proj(B.center);
    const dim = (pA.z > 0 && pB.z > 0) ? 1 : 0.22;
    const mx = (pA.x + pB.x) / 2, my = (pA.y + pB.y) / 2;
    const dx = pB.x - pA.x, dy = pB.y - pA.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const ca = (strand.curve || 1) * len * 0.08;
    const cpx = mx + nx * ca, cpy = my + ny * ca;
    const pulseRate = strand.fresh ? 200 : 380;
    const pulse = 0.55 + 0.45 * Math.sin(t / pulseRate + strand.phase);
    const hpPct = strand.hp / strand.maxHp;
    const alpha = (0.32 + 0.55 * hpPct) * dim;
    let r, g, b;
    if (strand.fresh) { r = 255; g = 90; b = 140; }
    else {
      r = Math.round(110 + 90 * hpPct);
      g = Math.round(70 + 50 * hpPct);
      b = Math.round(190 + 40 * hpPct);
    }
    ctx.beginPath(); ctx.moveTo(pA.x, pA.y);
    ctx.quadraticCurveTo(cpx, cpy, pB.x, pB.y);
    ctx.strokeStyle = `rgba(${r},${g},${b},${(alpha * 0.28 * pulse).toFixed(3)})`;
    ctx.lineWidth = strand.fresh ? 12 : 9;
    ctx.lineCap = 'round';
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pA.x, pA.y);
    ctx.quadraticCurveTo(cpx, cpy, pB.x, pB.y);
    ctx.strokeStyle = `rgba(${r},${g},${b},${(alpha * pulse).toFixed(3)})`;
    ctx.lineWidth = strand.fresh ? 3 : 2.4;
    ctx.stroke();
    ctx.beginPath(); ctx.moveTo(pA.x, pA.y);
    ctx.quadraticCurveTo(cpx, cpy, pB.x, pB.y);
    ctx.strokeStyle = `rgba(230,190,255,${(alpha * 0.45 * pulse).toFixed(3)})`;
    ctx.lineWidth = 1;
    ctx.stroke();
  }
  ctx.restore();

  /* якоря */
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const aid of F.anchors) {
    const cell = pl.cells[aid];
    if (!cell) continue;
    const p = proj(cell.center);
    if (!(p.z > 0)) continue;
    const isAwakened = F.awakenedAnchors.has(aid);
    const isDead = F.deadAnchors.has(aid);
    const pulseRate = isAwakened ? 250 : 500;
    const pulse = 0.5 + 0.5 * Math.sin(t / pulseRate + aid * 1.3);
    let r, g, b, ringR, coreR, coreA;
    if (isDead) { r = 90; g = 40; b = 40; ringR = 18; coreR = 3; coreA = .25; }
    else if (isAwakened) { r = 255; g = 240; b = 130; ringR = 26 + pulse * 5; coreR = 6 + pulse * 3; coreA = .75 + pulse * .25; }
    else { r = 255; g = 200; b = 80; ringR = 24 + pulse * 4; coreR = 5 + pulse * 2; coreA = .55 + .45 * pulse; }

    const gr = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, isAwakened ? 48 : 38);
    gr.addColorStop(0, `rgba(${r},${g},${b},${(0.2 * pulse * (isDead ? .4 : 1)).toFixed(3)})`);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(p.x, p.y, isAwakened ? 48 : 38, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = `rgba(${r},${g},${b},${(isDead ? .3 : .7 * pulse).toFixed(3)})`;
    ctx.lineWidth = isAwakened ? 2.6 : 2.2;
    ctx.beginPath(); ctx.arc(p.x, p.y, ringR, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = isDead ? 'rgba(30,10,15,0.75)' : 'rgba(18,8,30,0.72)';
    ctx.beginPath(); ctx.arc(p.x, p.y, 15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = `rgba(${r},${g},${b},${coreA.toFixed(3)})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, coreR, 0, Math.PI * 2); ctx.fill();

    if (isDead) {
      ctx.fillStyle = 'rgba(255,94,94,0.9)';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('✕', p.x, p.y);
    } else if (isAwakened) {
      ctx.fillStyle = 'rgba(255,255,200,0.95)';
      ctx.font = 'bold 14px Arial';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('✦', p.x, p.y - 28);
    }

    if (F.ally && !isDead) {
      const allyPulse = 0.5 + 0.5 * Math.sin(t / 350 + aid);
      ctx.fillStyle = `rgba(126,224,138,${(0.5 + allyPulse * 0.4).toFixed(3)})`;
      ctx.font = 'bold 11px Arial';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🤝', p.x + 30, p.y - 20 - allyPulse * 4);
    }
  }
  ctx.restore();

  /* волна */
  if (F.sweep) {
    const age = (t - F.sweep.startedAt) / F.sweep.duration;
    if (age >= 0 && age < 1) {
      const r = age * F.sweep.maxR;
      const col = F.sweep.reflected ? '255,218,71' : '255,77,157';
      ctx.save();
      ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath(); ctx.arc(F.sweep.cx, F.sweep.cy, r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(40,10,60,${(0.28 * (1 - age * 0.5)).toFixed(3)})`;
      ctx.fill();
      ctx.restore();
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath(); ctx.arc(F.sweep.cx, F.sweep.cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${col},0.95)`; ctx.lineWidth = 4; ctx.stroke();
      ctx.beginPath(); ctx.arc(F.sweep.cx, F.sweep.cy, r, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(${col},0.35)`; ctx.lineWidth = 14; ctx.stroke();
      ctx.restore();
    }
  }

  /* ритуал призыва (v0.4) */
  if (F.allySummonAnim) {
    const age = (t - F.allySummonAnim.t0) / F.allySummonAnim.duration;
    if (age >= 0 && age < 1) {
      const cX = window.innerWidth / 2, cY = window.innerHeight / 2;
      const alpha = 1 - age;
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 3; i++) {
        const a2 = Math.max(0, age - i * 0.12) / (1 - i * 0.12);
        if (a2 <= 0) continue;
        const rr = a2 * (Math.min(window.innerWidth, window.innerHeight) * 0.5);
        ctx.beginPath(); ctx.arc(cX, cY, rr, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(126,224,138,${((1 - a2) * 0.7 * alpha).toFixed(3)})`;
        ctx.lineWidth = 3;
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  for (let i = F.bursts.length - 1; i >= 0; i--) {
    const b = F.bursts[i];
    const age = (t - b.t0) / b.duration;
    if (age >= 1) { F.bursts.splice(i, 1); continue; }
    const rad = 6 + age * (b.big ? 80 : 42);
    const a = (1 - age) * 0.85;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.beginPath(); ctx.arc(b.x, b.y, rad, 0, Math.PI * 2);
    const c = b.color === '#ffda47' ? '255,218,71' : b.color === '#ff5e9d' ? '255,94,157' : b.color === '#7ee08a' ? '126,224,138' : '192,132,252';
    ctx.strokeStyle = `rgba(${c},${a.toFixed(3)})`;
    ctx.lineWidth = (b.big ? 4 : 2.5) * (1 - age) + .4;
    ctx.stroke();
    ctx.restore();
  }

  for (const f of F.pullFloats) {
    const cell = pl.cells[f.aid];
    if (!cell) continue;
    const p = proj(cell.center);
    if (!(p.z > 0)) continue;
    const age = (t - f.t0) / f.duration;
    ctx.save();
    ctx.globalAlpha = 1 - age;
    ctx.globalCompositeOperation = 'lighter';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, p.x, p.y - 32 - age * 24);
    ctx.restore();
  }

  if (F.stroke.active && F.stroke.path.length > 1) {
    drawPath(ctx, F.stroke.path, 'rgba(255,220,100,0.9)', 3);
    const head = F.stroke.path[F.stroke.path.length - 1];
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const gr = ctx.createRadialGradient(head.x, head.y, 0, head.x, head.y, 22);
    gr.addColorStop(0, 'rgba(255,255,220,0.95)');
    gr.addColorStop(0.6, 'rgba(255,200,80,0.4)');
    gr.addColorStop(1, 'rgba(255,200,80,0)');
    ctx.fillStyle = gr;
    ctx.beginPath(); ctx.arc(head.x, head.y, 22, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

function drawPath(ctx, path, color, width) {
  if (!path || path.length < 2) return;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = color; ctx.lineWidth = width;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  for (let i = 0; i < path.length; i++) {
    if (i === 0) ctx.moveTo(path[i].x, path[i].y); else ctx.lineTo(path[i].x, path[i].y);
  }
  ctx.stroke();
  ctx.restore();
}

/* ---------------------------------------------------------------- hooks */
function installHooks() {
  const H = window.__VORONIA_HOOKS = window.__VORONIA_HOOKS || {};
  const prev = H.postFrame;
  H.postFrame = function () {
    try { if (prev) prev(); } catch (e) {}
    try { frame(now()); } catch (e) {
      if (!frame.__err) { frame.__err = 1; console.warn('[gw] frame error:', e); }
    }
  };
}

function installIntercept() {
  document.addEventListener('click', (e) => {
    const btn = e.target && e.target.closest && e.target.closest('#panel-guardian-fight');
    if (!btn) return;
    e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
    const pid = S.activePlanetId;
    if (pid) enterFight(pid);
  }, true);
  document.addEventListener('keydown', (e) => {
    if (!F.active) return;
    if (e.key === 'Escape') { e.preventDefault(); exitFight('retreat'); return; }
    /* v0.5: клавиатура — стрелки вращают сферу, +/− масштаб, 0 — сброс вида */
    if (e.key === 'ArrowLeft')  { e.preventDefault(); e.stopPropagation(); nudgeRot(-0.18); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); e.stopPropagation(); nudgeRot(0.18); }
    else if (e.key === 'ArrowUp')    { e.preventDefault(); e.stopPropagation(); if (S.started) { S.rotX -= 0.12; clampRotX(); F.view.spinX = 0; F.view.spinY = 0; pauseIdle(1600); } }
    else if (e.key === 'ArrowDown')  { e.preventDefault(); e.stopPropagation(); if (S.started) { S.rotX += 0.12; clampRotX(); F.view.spinX = 0; F.view.spinY = 0; pauseIdle(1600); } }
    else if (e.key === '+' || e.key === '=') { e.preventDefault(); e.stopPropagation(); bumpZoom(VIEW.wheelStep); }
    else if (e.key === '-' || e.key === '_') { e.preventDefault(); e.stopPropagation(); bumpZoom(1 / VIEW.wheelStep); }
    else if (e.key === '0')          { e.preventDefault(); e.stopPropagation(); resetView(); }
  }, true);
}

function cleanupStale() {
  const s = state();
  if (s.active) { s.active = null; save(); }
}

/* ---------------------------------------------------------------- boot */
function boot() {
  state(); cleanupStale();
  installHooks(); installIntercept();
  window.__guardianWeaving = {
    version: '0.6.1',
    enter: enterFight,
    exit: exitFight,
    resetView: () => resetView(),
    view: () => ({ rotX: S.rotX, rotY: S.rotY, zoom: S.zoom, mode: F.view.mode }),
    state: () => JSON.parse(JSON.stringify(state())),
    tune: TUNE,
    fight: () => F.active ? {
      level: F.level, planetId: F.planetId, anchors: F.anchors.slice(),
      tangle: { hp: F.tangle.hp, maxHp: F.tangle.maxHp, strandCount: F.tangle.strands.length,
        strands: F.tangle.strands.map(s => ({ a: s.a, b: s.b, hp: s.hp, maxHp: s.maxHp, broken: s.broken, fresh: s.fresh })) },
      sweep: F.sweep ? { age: (now() - F.sweep.startedAt) / F.sweep.duration, reflected: F.sweep.reflected } : null,
      awakened: Array.from(F.awakenedAnchors.keys()),
      dead: Array.from(F.deadAnchors.keys()),
      ally: F.ally ? { ...F.ally } : null,
      allySummonAnim: F.allySummonAnim ? { age: now() - F.allySummonAnim.t0 } : null,
      allyAutoReflect: F.allyAutoReflect,
      styleStats: { ...F.styleStats },
      energyDryMs: F.energyDryMs,
      nextAttack: {
        tighten: Math.max(0, F.attacks.nextTighten - now()),
        pull: Math.max(0, F.attacks.nextPull - now()),
        sweep: Math.max(0, F.attacks.nextSweep - now()),
      },
      player: { ...F.player }, elapsed: now() - F.arena.startedAt, cost: F.cost, drainRate: F.energyDrainRate,
    } : null,
    reset: () => {
      if (F.active) exitFight('retreat');
      const s = state();
      s.active = null; s.history = []; s.seals = [];
      s.planetStreak = {}; s.allies = {};
      try { window.requestSave?.(); } catch (e) {}
    },
    damage: (amount) => {
      if (!F.active) return false;
      let rem = Math.max(0, Number(amount) || 0);
      for (const s of F.tangle.strands) { if (rem <= 0) break; if (s.broken) continue; const d = Math.min(s.hp, rem); s.hp -= d; rem -= d; if (s.hp <= 0) s.broken = true; }
      let hp = 0; for (const s of F.tangle.strands) hp += s.hp;
      F.tangle.hp = hp;
      if (hp <= 0) setTimeout(() => exitFight('win'), 350);
      return true;
    },
    grantEnergy: (n) => { if (!S.started) return; S.energy = Math.max(0, (S.energy || 0) + (Number(n) || 0)); try { L.updateUI?.(); } catch (e) {} },
    drainEnergy: (n) => { if (!S.started) return; S.energy = Math.max(0, (S.energy || 0) - (Number(n) || 0)); try { L.updateUI?.(); } catch (e) {} },
    attack: (type) => {
      if (!F.active) return false;
      const t = now();
      if (type === 'tighten') { fireTighten(t); return true; }
      if (type === 'pull') { firePull(t); return true; }
      if (type === 'sweep') { fireSweep(t); return true; }
      return false;
    },
    classifyStyle: () => F.active ? classifyStyle() : null,
    allies: () => JSON.parse(JSON.stringify(state().allies)),
    streak: () => JSON.parse(JSON.stringify(state().planetStreak)),
    availableAllies: (excludePid) => getAvailableAllies(excludePid || S.activePlanetId),
    summon: () => summonAlly(),
    grantAlly: (pid, lvl) => {
      const s = state();
      const pl = L.PLANETS?.[pid];
      const profile = pl ? L.guardianProfileFor?.(pl) : null;
      const level = lvl || (profile?.guardianLevel || 1);
      const formId = level <= 3 ? 'sentinel' : level <= 7 ? 'guardian' : 'overlord';
      const formName = formId === 'sentinel' ? 'Страж' : formId === 'guardian' ? 'Хранитель' : 'Владыка';
      let displayName = `${formName} ${pl?.name || pid}`;
      try {
        if (L.pickGuardianLine && pl) {
          const line = L.pickGuardianLine(pl, formId, 'repeatWin');
          if (line) displayName = allyNameFromLine(pl?.name || pid, formName, line);
        }
      } catch (e) {}
      s.allies[pid] = {
        available: true, since: Date.now(), level, formId,
        name: `${formName} ${pl?.name || pid}`, displayName,
      };
      save();
      return s.allies[pid];
    },
    resetAllyCooldowns: () => {
      const s = state();
      for (const pid in s.allies) {
        if (s.allies[pid]) s.allies[pid].available = true;
      }
      save();
      return true;
    },
    testAllyName: (pid) => {
      const pl = L.PLANETS?.[pid];
      if (!pl) return null;
      const formId = 'guardian';
      const line = L.pickGuardianLine?.(pl, formId, 'repeatWin');
      return { line, name: allyNameFromLine(pl.name || pid, 'Хранитель', line) };
    },
    diagnostics: () => ({
      active: F.active, planetId: F.planetId, level: F.level,
      anchors: F.anchors.length, strands: F.tangle.strands.length,
      freshStrands: F.tangle.strands.filter(s => s.fresh).length,
      brokenStrands: F.tangle.strands.filter(s => s.broken).length,
      hp: F.tangle.hp, maxHp: F.tangle.maxHp, cost: F.cost, drainRate: F.energyDrainRate,
      energyNow: S.energy,
      energyDryMs: Math.round(F.energyDryMs),
      ally: F.ally?.name || null,
      allySummoning: !!F.allySummonAnim,
      streak: state().planetStreak[F.planetId] || 0,
      availableAllies: getAvailableAllies(F.planetId).length,
      styleStats: { ...F.styleStats },
    }),
  };
  log('v0.6.0 готов · сфера: тяга фона = вращение (с инерцией), щипок/колесо = масштаб, двойной тап/⟲ = сброс');
  log('  союзник:  __guardianWeaving.grantAlly("ferrum") · .testAllyName("ferrum")');
  log('  энергия:  __guardianWeaving.drainEnergy(5000) — имитирует проигрыш по энергии');
  log('  ритуал:   призыв теперь анимирован ~500мс (см. F.allySummonAnim)');
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else setTimeout(boot, 0);

})();
