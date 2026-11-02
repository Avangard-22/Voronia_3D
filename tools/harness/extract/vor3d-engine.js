
/* ============================================================================
 * VORONIA 3D · v0.0.16 — динамическая атмосфера: оболочка привязана к вершине
 *            самой высокой раскрытой клетки и плавно растёт при прокачке —
 *            пики больше не протыкают атмосферу. (Бандл: hardcore-стоимости
 *            вкладки «Улучшения» в Исследованиях, ×10 по умолчанию — настраиваемо.)
 * ----------------------------------------------------------------------------
 * Принципы (согласно ТЗ «логику и структуру игры оставить исходной»):
 *   1. Игровая логика, состояние, сейвы, схема 39 — НЕ трогаются. Модуль работает
 *      только через публичные API: window.__V.state / .legacy / .bus и штатный
 *      хук window.__VORONIA_HOOKS.postFrame (паттерн voronia-cinematic/shipyard).
 *   2. Канвас #game остаётся живым и продолжает получать ВЕСЬ ввод: штатные
 *      pointer-обработчики бандла (drag / pinch / wheel / l0-hit-test / G0)
 *      работают без изменений. 3D-слой — чисто визуальная надстройка.
 *   3. Ортографическая камера Three.js выведена ТОЧНО под проекцию o0() бандла:
 *      t_scale = min(W,H)*0.36*zoom, центр (W/2,H/2); поворот группы планеты
 *      Ry(rotY)·Rx(rotX) повторяет rr(). Пиксель 2D-хит-теста совпадает с
 *      пикселем 3D-картинки — синтетические клики не нужны.
 *      Проверка: camZoom = minDim*zoom/(10*H) → экранный радиус планеты
 *      R*camZoom*H/2 = 7.2*minDim*zoom/20 = 0.36*minDim*zoom = t_scale. ∎
 *   4. «Навесные» элементы (рамки клеток, выделение, иконки, дуги резерва, замки,
 *      💀, волны открытия, искры, летящий текст, частицы) рисуются на отдельном
 *      2D-канвасе #vor3d-fx копиями соответствующих блоков po() — визуальный
 *      язык игры сохраняется 1-в-1.
 *   5. Дубли текста/частиц на #game (он остаётся под 3D-слоем) гасятся точечными
 *      хуками ctx.fillText / ctx.fillRect по совпадению содержимого+координат.
 *   6. Любая ошибка модуля / потеря WebGL-контекста → автооткат на 2D-рендер.
 *
 * Слои (снизу вверх):
 *   #game (z0)      — исходный канвас: фон, звёзды, аура, орбиты, метеориты,
 *                     полевые объекты, оверлеи событий (диск планеты накрыт 3D)
 *   #vor3d (z1)     — WebGL: сфера + клетки + атмосферный обод
 *   #vor3d-fx (z1)  — 2D: рамки/иконки/текст/частицы/волны поверх планеты
 *   #voronia-atmosphere (z1, позже в DOM) — штатная тонировка поверх всего
 *   #ui (z2)        — штатный HUD
 *
 * Осознанные упрощения v0.0.3 (см. MIGRATION-документ):
 *   - biomeAnim-спрайты и zoomLOD-детализация не воспроизводятся;
 *   - prominence-спрайт заряженной жилы заменён радиальным свечением;
 *   - дуговой баннер имени планеты (M1) и дуга иконок (nx) скрыты диском
 *     (их дублирует HUD: #planet-badge и #cells-val);
 *   - на время интро/аварийной посадки 3D автоматически уступает место 2D.
 * ==========================================================================*/
(async function Voronia3D () {
'use strict';

const V3D_VERSION = '0.0.38-hybrid-2.5d';
/* v0.0.9:  ocean/landform cell roles, stable type colors, elevated mountain classes, local-up charge flares.
 * v0.0.10: геологическая палитра — terrain type 0 от цвета рукава (L.sectorOf),
 *          жилы по ресурсам (RESOURCE_3D), детерминированный джиттер клетки,
 *          модуляция яркости рельефом.
 * v0.0.11: biome-tint (климат/поверхность из pl.descriptors), rim-light на
 *          кромке крышки и верхе стенок, рельеф +20%, фиксы: полотно глубоких
 *          океанских клеток не тонет под базовой сферой; раскрытие соседа
 *          переставляет стенки (rebuildPending при wallsOn).
 * v0.0.12: переход в «глубокую добычу» (isDeep, 8-й уровень) больше НЕ меняет
 *          цвет клетки — она остаётся в своей геологической градации (terrain
 *          рукава / руда ресурса / и т.д.). Отличие глубокой клетки читаются
 *          геометрией (впадина −0.0035R + стенки соседей) и фиолетовым
 *          ромбом-маркером уровня в fx-слое.
 * v0.0.13: FIX — протуберанцы заряженных жил (type 1/2) не зажигались: бандл
 *          пишет cell._chargedAt в Date.now() (эпоха мс), а chargeState()
 *          сравнивал с performance.now() → окно prominence не наступало никогда.
 *          Часы приведены к бандлу (F0). Новый стиль: вместо пятна свечения —
 *          «лучи Солнца»: 5–6 конических лучей из поверхности клетки наружу
 *          вдоль радиуса планеты, за пределы сферы; кончики и изгиб считаются
 *          в 3D и проецируются штатным o0() — у центра диска лучи складываются
 *          в корону, у лимба вылетают за силуэт. Белый горячий корень,
 *          градиент в цвет типа, бегущие искры, дрейф/мерцание; затухание
 *          за baseDur секунд (как в игре). */
const THREE_CDN   = 'https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js';
const THREE_LOCAL = './js/three.module.js';

const V = window.__V || {};
const S = V.state || {};
const L = V.legacy || {};
const BUS = V.bus;

const $id = id => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const log = (...a) => console.info('[vor3d]', ...a);
const warn = (...a) => console.warn('[vor3d]', ...a);

/* штатные цвета типов клеток из бандла (O0) — только fallback;
 * основной источник — кешированные cell._fillExplored/_fillUnexplored/_fillDeep,
 * которые сам бандл пересчитывает в Js() при смене CELL_COLOR_VER */
const O0_FALLBACK = { 0: '#2a9cca', 1: '#2dba6e', 2: '#c084fc', 4: '#ffd447', 6: '#7ec9e8', 7: '#ffcc44' };

const st = {
  mode: false,            // 3D включён пользователем
  active: false,          // 3D реально рендерит в текущем кадре (все гейты)
  threeOK: false,
  webglLost: false,
  renderer: null, scene: null, camera: null,
  yawGroup: null, pitchGroup: null,   // Ry(rotY)·Rx(rotX) — точное соответствие rr()
  baseSphere: null, atmoShell: null,
  atmoBaseR: 0, atmoTarget: 0,   /* v0.0.16: радиус геометрии шелла и целевой радиус */
  cellMesh: null, colAttr: null, posAttr: null, nrmAttr: null,
  planetRef: null,        // объект планеты, под который построена геометрия
  slotOf: null,           // Map cellId -> {topStart,topCount,wallStart,wallCount,count,d}
  sigOf: null,            // Float64Array по cellId — сигнатура цвета клетки
  heightSig: null,        // Array<string> по cellId — без коллизий сигнатуры высоты (v0.0.7)
  wallsOn: false,         // v0.0.6: строятся ли стенки для текущей планеты
  wallTotal: 0,           // v0.0.6: вершин стенок по расчёту ёмкости
  rebuildPending: false,  // v0.0.7: высота изменилась → нужна пересборка
  lastRebuildAt: 0,
  appended: new Set(),    // уже добавленные в буфер revealed-клетки
  bufPos: null, bufCol: null, bufNrm: null, cursor: 0, capacity: 0,
  flashes: new Map(),     // cellId -> performance.now()+700 (вспышка скана)
  lastSweep: 0,
  dtAvg: 1 / 60, lastFrameAt: 0,
  fpsBuf: [], degraded: 0,
  fx: null, fxc: null,
  W: 0, H: 0, dpr: 1,
  suppressText: null,     // [{text,x,y,used}] — для po() следующего кадра
  suppressRect: null,     // [{x,y,w,h,color,used}]
  suppressImg: null,      // v0.0.13: [{x,y,w,h,used}] — 2D-спрайт протуберанца
  chipEl: null, setBtnEl: null,
  stats: { suppressedText: 0, suppressedRect: 0, suppressedImg: 0, builds: 0, appends: 0, walls: 0, promDrawn: 0 },
};

/* ----------------------------------------------------------------------------
 * 1. Загрузка Three.js: inline-blob -> локальный файл -> CDN
 * --------------------------------------------------------------------------*/
async function loadThree () {
  try {
    const el = $id('vor3d-three-src');
    if (el && el.textContent && el.textContent.length > 10000) {
      const url = URL.createObjectURL(new Blob([el.textContent], { type: 'text/javascript' }));
      try {
        const m = await import(url);
        if (m && m.Scene) return m;
      } finally { setTimeout(() => URL.revokeObjectURL(url), 4000); }
    }
  } catch (e) { warn('blob-import не удался (file://?):', e && e.message); }
  try { const m = await import(THREE_LOCAL); if (m && m.Scene) return m; } catch (e) { /* нет локального файла */ }
  try { const m = await import(THREE_CDN); if (m && m.Scene) return m; } catch (e) { warn('CDN-import не удался:', e && e.message); }
  return null;
}

/* ----------------------------------------------------------------------------
 * 2. DOM: канвасы, стили, чип-переключатель, строка в настройках
 * --------------------------------------------------------------------------*/
function injectDOM () {
  if ($id('vor3d')) return;
  const css = document.createElement('style');
  css.id = 'vor3d-css';
  css.textContent = `
#vor3d,#vor3d-fx{position:fixed;inset:0;z-index:1;pointer-events:none;display:none}
body.vor3d-on #vor3d,body.vor3d-on #vor3d-fx{display:block}
#vor3d-chip{position:absolute;left:10px;top:10px;width:38px;height:38px;border-radius:12px;
  border:1px solid #29495b;background:rgba(6,16,25,.85);color:#7ea6b8;font-size:17px;line-height:1;
  display:flex;align-items:center;justify-content:center;cursor:pointer;pointer-events:auto;
  backdrop-filter:blur(6px);transition:border-color .2s,color .2s,box-shadow .2s;padding:0;font-family:inherit}
#vor3d-chip.on{border-color:var(--cy,#4ddcff);color:#bff0ff;box-shadow:0 0 12px rgba(77,220,255,.35)}
#vor3d-chip.err{border-color:#ff5e5e;color:#ff9c9c;cursor:not-allowed}
#vor3d-chip .chip-sub{position:absolute;bottom:-13px;left:50%;transform:translateX(-50%);
  font-size:8px;letter-spacing:.08em;color:#5d8296;white-space:nowrap;pointer-events:none}`;
  document.head.appendChild(css);

  const game = $id('game');
  const c3d = document.createElement('canvas'); c3d.id = 'vor3d';
  const cfx = document.createElement('canvas'); cfx.id = 'vor3d-fx';
  game.parentNode.insertBefore(cfx, game.nextSibling);
  game.parentNode.insertBefore(c3d, cfx);
  st.fx = cfx;

  /* чип быстрого переключения — ПЕРВЫМ ребёнком #ui (position:absolute),
   * чтобы любые модалки/оверлеи, идущие позже в DOM, перекрывали его штатно */
  const ui = $id('ui');
  if (ui) {
    const chip = document.createElement('button');
    chip.id = 'vor3d-chip';
    chip.type = 'button';
    chip.title = '3D-вид планеты (WebGL)';
    chip.innerHTML = '🧊<span class="chip-sub">3D</span>';
    chip.addEventListener('click', () => toggleMode());
    ui.insertBefore(chip, ui.firstChild);
    st.chipEl = chip;
  }

  /* строка в «Настройки → Графика» (после Deep space background) */
  try {
    const ds = $id('set-ds-toggle');
    const row = ds && ds.closest && ds.closest('.setting-row');
    if (row) {
      const wrap = document.createElement('div');
      wrap.className = 'setting-row';
      wrap.innerHTML = '<span class=name>3D-планета (WebGL)</span> <button id=set-vor3d-toggle class=setting-toggle>ВЫКЛ</button>';
      row.after(wrap);
      st.setBtnEl = $id('set-vor3d-toggle');
      st.setBtnEl.addEventListener('click', () => toggleMode());
    }
  } catch (e) { /* настройки не найдены — не критично */ }
}

function syncControls () {
  document.body.classList.toggle('vor3d-on', st.mode);
  if (st.chipEl) {
    st.chipEl.classList.toggle('on', st.mode);
    st.chipEl.classList.toggle('err', !st.threeOK);
    st.chipEl.title = st.threeOK
      ? (st.mode ? '3D-вид: ВКЛ — нажать для возврата к 2D' : '3D-вид (WebGL) — нажать для включения')
      : '3D недоступно: не удалось загрузить графический модуль';
  }
  if (st.setBtnEl) {
    st.setBtnEl.textContent = st.mode ? 'ВКЛ' : 'ВЫКЛ';
    st.setBtnEl.style.borderColor = st.mode ? 'var(--cy,#4ddcff)' : '';
    st.setBtnEl.style.color = st.mode ? 'var(--cy,#4ddcff)' : '';
    st.setBtnEl.disabled = !st.threeOK;
  }
}

function toast (msg) {
  try { if (L.showToast) L.showToast(msg, '', 2400); else console.info(msg); } catch (e) {}
}
function persist (on) { try { localStorage.setItem('vor3d_mode', on ? '1' : '0'); } catch (e) {} }
function persisted () { try { return localStorage.getItem('vor3d_mode'); } catch (e) { return null; } }

function toggleMode (force) {
  if (!st.threeOK && force !== false) { toast('⚠ 3D-слой недоступен'); return; }
  const on = typeof force === 'boolean' ? force : !st.mode;
  if (on === st.mode) return;
  st.mode = on;
  persist(on);
  syncControls();
  if (on) { st.planetRef = null; toast('🧊 3D-вид планеты включён'); }
  else toast('🌐 Возврат к 2D-виду');
}

/* ----------------------------------------------------------------------------
 * 3. Хуки подавления дублей на контексте #game
 * --------------------------------------------------------------------------*/
function normColor (c) {
  return typeof c === 'string' && c.length === 4 && c[0] === '#'
    ? '#' + c[1] + c[1] + c[2] + c[2] + c[3] + c[3] : c;
}

function installCtxHooks () {
  const cv = $id('game');
  if (!cv || cv.__vor3dHooked) return;
  const ctx = cv.getContext('2d');
  if (!ctx) return;
  cv.__vor3dHooked = true;

  const origFillText = ctx.fillText.bind(ctx);
  ctx.fillText = function (text, x, y, ...rest) {
    if (st.active && st.suppressText && ctx.font === 'bold 16px Arial') {
      const arr = st.suppressText;
      for (let i = 0; i < arr.length; i++) {
        const it = arr[i];
        if (!it.used && it.text === text && Math.abs(it.x - x) < 1.5 && Math.abs(it.y - y) < 1.5) { it.used = true; st.stats.suppressedText++; return; }
      }
    }
    return origFillText(text, x, y, ...rest);
  };

  /* v0.0.13: спрайт протуберанца в po() рисуется через drawImage — гасим его
   * по геометрии (позиция+размер совпадают с формулой po до пикселей), чтобы
   * старая 2D-«туча» не двоилась с новыми fx-лучами. */
  const origDrawImage = ctx.drawImage.bind(ctx);
  ctx.drawImage = function (img, dx, dy, ...rest) {
    if (st.active && st.suppressImg && rest.length >= 2) {
      const w = rest[0], h = rest[1];
      const arr = st.suppressImg;
      for (let i = 0; i < arr.length; i++) {
        const it = arr[i];
        if (!it.used && Math.abs(it.w - w) < 8 && Math.abs(it.h - h) < 8 &&
            Math.abs(it.x - dx) < 8 && Math.abs(it.y - dy) < 8) {
          it.used = true; st.stats.suppressedImg++; return;
        }
      }
    }
    return origDrawImage(img, dx, dy, ...rest);
  };

  const origFillRect = ctx.fillRect.bind(ctx);
  ctx.fillRect = function (x, y, w, h, ...rest) {
    if (st.active && st.suppressRect && ctx.globalCompositeOperation === 'lighter') {
      const arr = st.suppressRect, col = normColor(ctx.fillStyle);
      for (let i = 0; i < arr.length; i++) {
        const it = arr[i];
        if (!it.used && it.color === col && Math.abs(it.w - w) < .6 && Math.abs(it.h - h) < .6 &&
            Math.abs(it.x - x) < 3 && Math.abs(it.y - y) < 3) { it.used = true; st.stats.suppressedRect++; return; }
      }
    }
    return origFillRect(x, y, w, h, ...rest);
  };
}

/* Карты подавления строятся в postFrame ПОСЛЕ po():
 * - текст: po() рисует элемент и СРАЗУ двигает его (g.y+=dy, life-=.02), поэтому
 *   текущие значения массива = позиции/альфы, с которыми po() нарисует их в
 *   СЛЕДУЮЩЕМ кадре — ровно то, что нужно для подавления и для fx-зеркала;
 * - частицы: физика выполняется в C1 до po(), поэтому позиция следующего кадра
 *   предсказывается как x+vx*dt (в хуке допуск ±3px). */
function buildSuppressionMaps () {
  const texts = S.floatingTexts || [];
  const tArr = new Array(texts.length);
  for (let i = 0; i < texts.length; i++) tArr[i] = { text: texts[i].text, x: texts[i].x, y: texts[i].y, used: false };
  st.suppressText = tArr;

  const parts = S.particles || [];
  const dt = Math.min(.05, st.dtAvg);
  const pArr = new Array(parts.length);
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    pArr[i] = { x: p.x + p.vx * dt, y: p.y + p.vy * dt, w: p.size, h: p.size, color: normColor(p.color), used: false };
  }
  st.suppressRect = pArr;
}

/* ----------------------------------------------------------------------------
 * 4. Three.js сцена
 * --------------------------------------------------------------------------*/
let THREE = null;
const R = 7.2;        // мировой радиус планеты (выведен под o0 — см. шапку)
const LIFT = 1.006;   // клетки чуть выше базовой сферы (per mille — без z-fighting)

/* v0.0.6 · экструзия клеток по level. Все размеры — доли R, поэтому масштаб
 * одинаков на любой планете. Замерено для Феррума (R = 7.2, f = 0, 12 клеток,
 * угл. шаг 63.43°, baseR = LIFT·R = 7.2432):
 *   perLevel   level 5   level 20   % от R   % от размера плитки
 *   0.0012     0.043     0.173      2.4 %    1.8 %   ← почти плоско на глаз
 *   0.0030     0.108     0.432      6.0 %    4.6 %   ← значение по умолчанию
 *   0.0040     0.144     0.576      8.0 %    6.1 %   ← уже «город»
 * Полный стек при 0.0030: level20 = .432 · +ядро = .792 · +аномалия = .576
 *                         +исслед. = .518 · isDeep = −.058 · разрушена = 0 */
const EXTRUDE = {
  /* Высоты задаёт cellHeight() ниже (единственный источник); здесь — только
   * параметры стенок и подсветки. */
  minStep:       R * 0.0010,  /* перепад высот меньше этого — стенку не строим */
  /* Сегментов вдоль ребра poly для стенки = k (такой же, как у крышки).
   * НЕЛЬЗЯ брать меньше k: точки normalize(lerp(t=j/k)) крышки и стенки тогда
   * перестают совпадать, и между ними остаётся щель-«луночка» (хорда провисает
   * относительно дуги). Цена совпадения — всего +29 % вершин на Ферруме.
   * Если захочется сэкономить — wallKDiv: 2 даст k/2, но вернёт щель. */
  wallKDiv:      1,

  /* v0.0.19 · стенки СПЛОШНЫЕ («не прозрачные»): прежние 0.68/0.22/0.42 так
     сильно затемняли стенку, что она сливалась с тёмной подложкой и клетка
     читалась «стеклянной». Верхняя грань (крышка: градиент + rim-light) — без изменений. */
  wallShade:     1.00,        /* цвет стенки у ВЕРХА (× base) — полный цвет клетки */
  wallAO:        0.72,        /* цвет стенки у НИЗА  (× base, лёгкое AO для объёма) */
  wallFlat:      0.85,        /* плоский цвет без градиента (не изучена/разрушена) */

  wallsAboveCells: 3000,      /* если клеток больше — стенки OFF, остаётся только
                                 радиальное смещение. Скрытый мир (10242 клетки)
                                 дал бы ~307k вершин стенок ≈ 11 MB буферов. */

  /* v0.0.11 · rim-light — светлая кромка у границы клетки: плитки читаются
   * выпуклыми, соседи разделены даже там, где нет стенок.
   * rimPeak/rimWidth — положение и полуширина кольца на крышке (d: 0=центр, 1=край);
   * rimStrength — 0=выкл, 0.28=тонкое, 0.5=«стеклянные плитки»;
   * wallRimFrom/wallRimStrength — подсветка верхних (1−from)·100 % стенки. */
  rimPeak:         0.94,
  rimWidth:        0.10,
  rimStrength:     0.28,
  wallRimFrom:     0.85,
  wallRimStrength: 0.15,
}

function buildScene (canvas) {
  st.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  st.renderer.setClearColor(0x000000, 0);
  if ('outputColorSpace' in st.renderer && THREE.SRGBColorSpace) st.renderer.outputColorSpace = THREE.SRGBColorSpace;
  st.scene = new THREE.Scene();

  st.camera = new THREE.OrthographicCamera(-1, 1, 1, -1, .1, 300);
  st.camera.position.set(0, 0, 60);
  st.camera.lookAt(0, 0, 0);

  /* Свет: мягкий день слева-сверху — направление совпадает со смещением
   * центра радиального градиента клетки в po() (-0.35W, -0.4W). */
  /* r155+: свет в физических единицах (BRDF делит на π) — интенсивности
   * умножены на π, чтобы итоговая яркость клеток совпадала с 2D-оригиналом:
   * ambient ≈ .80, dir ≈ .36 → диапазон .80..1.16 (в 2D: nightSide −42%..+35% центр) */
  st.scene.add(new THREE.AmbientLight(0xffffff, .68 * Math.PI));
  const dir = new THREE.DirectionalLight(0xeaf4ff, .48 * Math.PI);
  dir.position.set(-6, 8.5, 10);
  st.scene.add(dir);

  /* Ry(rotY) снаружи, Rx(rotX) внутри: мировая матрица = Ry·Rx = rr() из бандла */
  st.yawGroup = new THREE.Group();
  st.pitchGroup = new THREE.Group();
  st.yawGroup.add(st.pitchGroup);
  st.scene.add(st.yawGroup);

  /* атмосферный обод — френель-оболочка; заменяет срез 2D-ауры по кромке диска
   * (2D-аура за пределами диска остаётся видна с #game, стык маскируется) */
  const atmoMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color('#8ddfff') }, uPower: { value: .5 } },
    vertexShader: `varying vec3 vN; varying vec3 vV;
      void main(){ vec4 mv = modelViewMatrix * vec4(position,1.0);
        vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz);
        gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uColor; uniform float uPower; varying vec3 vN; varying vec3 vV;
      void main(){ float f = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.6);
        gl_FragColor = vec4(uColor, f * uPower); }`,
    transparent: true, blending: THREE.AdditiveBlending,
    side: THREE.BackSide, depthWrite: false
  });
  st.atmoShell = new THREE.Mesh(new THREE.SphereGeometry(R * 1.075, 64, 48), atmoMat);
  st.atmoShell.renderOrder = 2;
  st.pitchGroup.add(st.atmoShell);
  st.atmoBaseR = R * 1.075;
  st.atmoTarget = R * 1.075;

  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    st.webglLost = true;
    warn('WebGL-контекст потерян — откат на 2D');
    try { toggleMode(false); } catch (e2) {}
    toast('⚠ WebGL-контекст потерян: включён 2D-режим');
  }, false);
  canvas.addEventListener('webglcontextrestored', () => { st.webglLost = false; st.planetRef = null; }, false);
}

function resize3D () {
  const W = S.W || innerWidth, H = S.H || innerHeight;
  /* Hybrid 2.5D quality policy:
   * - CSS size remains the logical viewport; WebGL uses a separate backing buffer.
   * - Never force every low-power device to DPR=1: that caused visibly soft edges.
   * - Initial DPR cap 1.75 on normal devices, 1.35 on low-power devices.
   * - Under sustained load the adaptive tier drops only to 1.35, then falls back
   *   to the native 2D renderer if performance remains poor. No blurry DPR=1 tier. */
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  if (st.W === W && st.H === H && st.dpr === dpr && st._qualityTier === (st.degraded ? 1 : 0)) return;
  st.W = W; st.H = H; st.dpr = dpr;
  const cap = S.devicePower === 'low' ? 1.35 : (st.degraded ? 1.35 : 1.75);
  const pr = Math.max(1, Math.min(dpr, cap));
  st._qualityTier = st.degraded ? 1 : 0;
  st.renderer.setPixelRatio(pr);
  st.renderer.setSize(W, H);
  st.fx.width = Math.max(1, Math.round(W * dpr));
  st.fx.height = Math.max(1, Math.round(H * dpr));
  st.fxc.setTransform(dpr, 0, 0, dpr, 0, 0);
}

/* камера ТОЧНО повторяет o0(): экранный радиус планеты = min(W,H)*0.36*zoom */
function updateCamera () {
  const W = st.W || innerWidth, H = st.H || innerHeight;
  const cam = st.camera;
  const aspect = W / H;
  cam.left = -aspect; cam.right = aspect; cam.top = 1; cam.bottom = -1;
  cam.zoom = Math.min(W, H) * (S.zoom || 1) / (10 * H);
  cam.updateProjectionMatrix();
}

/* ----------------------------------------------------------------------------
 * 5. Клетки: merged-геометрия (append-only) + вершинные цвета
 * --------------------------------------------------------------------------*/
const _base = { r: 0, g: 0, b: 0 };
const WHITE = { r: 1, g: 1, b: 1 }, BLACK = { r: 0, g: 0, b: 0 };
const LOCK_OVER = { r: 2 / 255, g: 4 / 255, b: 8 / 255 };

let _threeColor = null;
function parseColor (css, out) {
  if (!_threeColor) _threeColor = new THREE.Color();
  try { _threeColor.setStyle(css || '#2a9cca'); } catch (e) { _threeColor.set('#2a9cca'); }
  out.r = _threeColor.r; out.g = _threeColor.g; out.b = _threeColor.b;
  return out;
}
function mixInto (dst, target, t) {
  dst.r += (target.r - dst.r) * t; dst.g += (target.g - dst.g) * t; dst.b += (target.b - dst.b) * t;
  return dst;
}

function polysOf (cell) { return (cell._polys && cell._polys.length) ? cell._polys : [cell.poly]; }

/* Угловой радиус клетки (макс. угол между центром и вершинами полигонов).
 * КЛЮЧЕВОЙ МОМЕНТ: плоский fan из центра к рёбрам у крупных клеток «тонет»
 * под сферой (хорда проходит внутри), поэтому каждый fan-треугольник
 * subdivision'ится k×k и каждая точка нормализуется обратно на сферу —
 * тот же приём, что бандл использует в _geometry() для геодезических граней. */
function cellAngularRadius (cell) {
  const c = cell.center;
  const cl = Math.hypot(c[0], c[1], c[2]) || 1;
  const ux = c[0] / cl, uy = c[1] / cl, uz = c[2] / cl;
  let m = 0;
  for (const p of polysOf(cell)) {
    if (!p) continue;
    for (const q of p) {
      const ql = Math.hypot(q[0], q[1], q[2]) || 1;
      const dot = clamp((q[0] * ux + q[1] * uy + q[2] * uz) / ql, -1, 1);
      const ang = Math.acos(dot);
      if (ang > m) m = ang;
    }
  }
  return m;
}
function subdivK (cell) {
  return clamp(Math.ceil(cellAngularRadius(cell) / 0.10), 1, 8);
}
function countCellVerts (cell) {
  const k = subdivK(cell), k2 = k * k;
  let n = 0;
  for (const p of polysOf(cell)) if (p && p.length >= 3) n += p.length * k2 * 3;
  return n;
}

/* ============================ v0.0.6 · экструзия ============================
 * Высота клетки входит в ГЕОМЕТРИЮ (позиции вершин), а не только в цвет,
 * поэтому её изменение требует пересборки: стенка клетки A стоит на верху
 * соседа B, и апгрейд B меняет стенки всех его соседей.
 * --------------------------------------------------------------------------*/

/** Render-only relief: deterministic, smooth terrain bands from the existing
 * unit cell centre. Does not mutate save/game state. The low-frequency field
 * creates connected plateaus; the smaller wave adds readable block-like steps. */
function terrainRelief (cell) {
  const c = cell && cell.center;
  if (!c || c.length < 3) return 0;
  const x = c[0], y = c[1], z = c[2];
  // Два масштаба поля дают связанные островные группы, а не случайные бугорки.
  const continental = Math.sin(x * 4.4 + z * 2.1) * Math.cos(y * 4.0 - x * 1.6);
  const shelf = Math.sin((x - z) * 8.2 + y * 2.7) * 0.22;
  // v0.0.11: контраст рельефа +20 % — стенки на type-0 читаются, а не «морщины»
  return R * (0.010 + continental * 0.012 + shelf * 0.004);
}

/**
 * Визуальная геоморфология клетки — только рендер, без изменения игрового состояния.
 * type 0: вода/энергетическая поверхность, низко;
 * type 3/5: ресурсные острова и материки, растут от level;
 * type 1/2/4: богатые/редкие/аномальные горы, высота не зависит от level;
 * type 6/7: исследовательский шпиль и ядро.
 */
function cellHeight (cell) {
  if (!cell) return 0;
  if (L.isCellDestroyed && L.isCellDestroyed(cell)) return -R * 0.002;
  const E = EXTRUDE;
  const lv = Math.max(0, Number(cell.level) || 0);
  const t = Number(cell.type) || 0;
  let h = terrainRelief(cell);
  if (cell.isDeep) h -= R * 0.0035;

  // Морская поверхность — визуальная база. Её небольшие перепады сохраняют ощущение океана.
  if (t === 0) h -= R * 0.010;
  // Материки/острова: уступчатый рост, уровни 1–8 не теряются, после 8 не меняется палитра.
  else if (t === 3 || t === 5) h += R * (0.018 + Math.min(lv, 40) * 0.0042 + Math.floor(Math.min(lv, 40) / 4) * 0.0018);
  // Богатые/редкие жилы — устойчивые горные массивы, не «тонут» из-за отсутствия апгрейдов.
  else if (t === 1) h += R * 0.050;
  else if (t === 2) h += R * 0.068;
  // Аномалия — отдельный монументальный горный шпиль.
  else if (t === 4) h += R * 0.082;
  else if (t === 6) h += R * (0.026 + Math.min(lv, 20) * 0.0015);
  else if (t === 7) h += R * 0.105;
  // Небольшая общая поправка уровня только для развиваемых водных/ресурсных клеток.
  if (t === 0) h += Math.min(lv, 40) * R * 0.0008;
  /* v0.0.11 FIX: нижний предел −0.009R (вместо −0.025R). Иначе глубокая
   * океанская клетка (isDeep type 0) на отрицательном рельефе уходила полотном
   * под базовую сферу (0.995R) и становилась невидимой:
   * LIFT(1.006) − 0.009 = 0.997R > 0.995R — пол всегда над сферой. */
  return clamp(h, -R * 0.009, R * 0.19);
}

/** Всё, от чего зависит cellHeight(). Изменилось → пересборка, а не перекраска. */
function cellHeightSig (cell) {
  if (!cell) return '';
  // Не складываем флаги с level через магические смещения: при больших уровнях
  // старый числовой код мог совпасть с комбинацией destroyed/isDeep/type.
  const level = Number.isFinite(Number(cell.level)) ? Number(cell.level) : 0;
  const type = Number.isFinite(Number(cell.type)) ? Number(cell.type) : 0;
  const destroyed = !!(L.isCellDestroyed && L.isCellDestroyed(cell));
  return `${type}|${level}|${cell.isDeep ? 1 : 0}|${destroyed ? 1 : 0}`;
}

/* v0.0.16 · динамическая атмосфера: целевой радиус шелла = вершина самой
 * высокой РАСКРЫТОЙ клетки + запас. Пол — R*1.075 (облик «плоских» миров
 * не меняется). Пересчитывается на постройке/дозаписи клеток; масштаб шелла
 * плавно доводится в frame() (~350 мс). Вершина — из cellHeight(), того же
 * источника, что строит геометрию: пики НИКОГДА не протыкают оболочку. */
const ATMO_MIN = R * 1.075;
const ATMO_MARGIN = R * 0.035;
function updateAtmoTarget (pl) {
  let maxH = 0;
  if (pl && pl.revealed && pl.cells) {
    for (const id of pl.revealed) {
      const cell = pl.cells[id];
      if (!cell) continue;
      const h = cellHeight(cell);
      if (h > maxH) maxH = h;
    }
  }
  st.atmoTarget = Math.max(ATMO_MIN, R * LIFT + maxH + ATMO_MARGIN);
}

/** Сосед «за» ребром полигона (максимум dot(центр соседа, середина ребра)).
 *  ВАЛИДИРОВАНО на реальной геодезии: 0 промахов на 5100 рёбрах (f = 0…4).
 *  Отдельная карта poly[i] → faceIdx не нужна. */
function neighborAcross (cell, pl, p0, p1) {
  let mx = p0[0] + p1[0], my = p0[1] + p1[1], mz = p0[2] + p1[2];
  const ml = Math.hypot(mx, my, mz) || 1;
  mx /= ml; my /= ml; mz /= ml;
  let best = -1, bestDot = -2;
  const nb = cell.neighbors;
  for (let i = 0; i < nb.length; i++) {
    const nid = nb[i];
    if (!(nid >= 0) || nid >= pl.cells.length) continue;
    const nc = pl.cells[nid].center;
    const d = nc[0] * mx + nc[1] * my + nc[2] * mz;   // center уже единичный
    if (d > bestDot) { bestDot = d; best = nid; }
  }
  return best;
}

/* Кэш расчёта стенок клетки: заполняется в countWallVerts, читается в
 * appendRevealed — чтобы не искать соседей по второму разу. */
const _wallScratch = [];

/** Число сегментов стенки вдоль ребра poly. По умолчанию = k крышки, чтобы
 *  точки стенки в точности совпадали с точками d = 1 у walkFan (стык без щели). */
function wallSubdiv (cell) {
  const div = EXTRUDE.wallKDiv > 1 ? EXTRUDE.wallKDiv : 1;
  return Math.max(1, Math.floor(subdivK(cell) / div));
}

/** Вершин стенок клетки.
 *  Стенка строится ТОЛЬКО там, где мы выше соседа, и идёт от baseR + h_соседа
 *  до baseR + h_своей. Тянуть её до baseR нельзя: cell.poly перекрывает
 *  соседа на 18…29 % радиуса, и нижняя часть легла бы внутри его плитки. */
function countWallVerts (cell, pl) {
  _wallScratch.length = 0;
  if (!st.wallsOn) return 0;
  const h = cellHeight(cell);
  if (h < EXTRUDE.minStep) return 0;              // плоские и впадины — без стенок
  const wk = wallSubdiv(cell);
  let n = 0;
  for (const poly of polysOf(cell)) {
    if (!poly || poly.length < 3) continue;
    for (let i = 0; i < poly.length; i++) {
      const p0 = poly[i], p1 = poly[(i + 1) % poly.length];
      const nid = neighborAcross(cell, pl, p0, p1);
      if (nid < 0) continue;
      const nh = pl.revealed.has(nid) ? cellHeight(pl.cells[nid]) : 0;
      if (h - nh < EXTRUDE.minStep) continue;     // сосед не ниже → стенки нет
      _wallScratch.push(p0, p1, nh);
      n += wk * 6;                                // wk квадов × 2 треуг. × 3 верш.
    }
  }
  return n;
}
/* ==========================================================================*/
/* обход треугольников subdivided fan'а: колбэк получает вершину (единичный
 * вектор) и d∈[0,1] — нормированное расстояние от центра клетки (для градиента).
 * Порядок обхода ОБЯЗАН совпадать в appendCell и paintCell. */
function walkFan (ctr, a, b, k, cb) {
  // pts[i][j] = normalize(ctr*(1-u-v) + a*u + b*v), u=j/k, v=i/k
  const rows = [];
  for (let i = 0; i <= k; i++) {
    const row = [];
    const v = i / k;
    for (let j = 0; j <= k - i; j++) {
      const u = j / k, w = 1 - u - v;
      const x = ctr[0] * w + a[0] * u + b[0] * v;
      const y = ctr[1] * w + a[1] * u + b[1] * v;
      const z = ctr[2] * w + a[2] * u + b[2] * v;
      const l = Math.hypot(x, y, z) || 1;
      row.push([x / l, y / l, z / l, u + v]);
    }
    rows.push(row);
  }
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k - i; j++) {
      cb(rows[i][j], rows[i][j + 1], rows[i + 1][j]);
      if (j < k - i - 1) cb(rows[i][j + 1], rows[i + 1][j + 1], rows[i + 1][j]);
    }
  }
}

/* «скан по карману» — по штатному индикатору HUD: класс .low на #chip-energy
 * ставит сам бандл в he() каждые ~80мс по результату ln(); извне ln() недоступна,
 * а этот бит — её точное отражение (n.energy < ln()). */
let _chipEnergy = null;
function isAffordable () {
  if (!_chipEnergy) _chipEnergy = $id('chip-energy');
  return !(_chipEnergy && _chipEnergy.classList.contains('low'));
}

/* базовый цвет заливки клетки — повторяет ветки po():
 * разрушена / истощена / изучена (в т.ч. глубокая, залочена) / не изучена */
/* ==================== v0.0.10/v0.0.11 · ГЕОЛОГИЧЕСКАЯ ПАЛИТРА ==============
 * Принципы:
 *  1. Простые клетки (type 0) наследуют ЦВЕТ РУКАВА галактики (L.sectorOf) —
 *     планета в Гефесте тёплая/бронзовая, в Крио — ледяная, в Жизни — зелёная,
 *     в Бездне — лиловая, в Ядре — золотая. Каждая планета автоматически своя.
 *  2. Особые клетки — собственные насыщенные цвета: читаются поверх terrain-фона.
 *  3. Жилы (type 3/5) — по ресурсу (RESOURCE_3D).
 *  4. Внутри типа — детерминированный джиттер (по cell.center, без сейва) и
 *     модуляция рельефом: возвышенности светлее, впадины темнее.
 *  5. v0.0.11 · biome-tint: климат и поверхность из pl.descriptors смешиваются
 *     с базой рукава — Forge+Scorched ≠ Forge+Temperate.
 * ============================================================================*/
const ARM_TERRAIN_MIX = 0.55;   /* доля тёмной базы bg1 в terrain-цвете */

const RESOURCE_3D = {
  iron:      '#b0784e',   /* тёплый ржавый — отличим от бронзы terrain Феррума */
  kriogen:   '#4ddcff',
  carbon:    '#4a4a50',
  silicon:   '#8a7a9a',
  titanium:  '#a8b8c8',
  uranium:   '#5ef260',
  darkMatter:'#7a4fc0',
};

/* Атмосферы климата/поверхности (id — точно из бандла, таблица Ar):
 * не заменяют цвет рукава, а смешиваются с ним. */
const CLIMATE_BASE = {
  frozen:      '#9fd8ff',   /* холодный голубой */
  scorched:    '#5a2010',   /* обожжённый тёмно-красный */
  toxic:       '#2d4a1a',   /* болотный */
  radioactive: '#5a4a10',   /* жёлто-оливковый */
  /* temperate — не тонируется */
};
const SURFACE_BASE = {
  oceanic:  '#1a4a6a',
  desert:   '#8a6a3a',
  metallic: '#3a4a5a',
  crystal:  '#5a3a7a',
  /* rocky — не тонируется */
};
const CLIMATE_BLEND = 0.40;   /* доля климата в итоговом terrain-цвете */
const SURFACE_BLEND = 0.28;   /* доля поверхности */
const SAT_BOOST     = 1.12;   /* возврат насыщенности после смешивания (1 = без) */

const _rA = { r: 0, g: 0, b: 0 }, _rB = { r: 0, g: 0, b: 0 };
function _hexToRgb01 (hex, out) {
  let h = String(hex || '').replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  const n = parseInt(h, 16);
  if (!Number.isFinite(n)) { out.r = .15; out.g = .35; out.b = .55; return out; }
  out.r = ((n >> 16) & 255) / 255;
  out.g = ((n >> 8) & 255) / 255;
  out.b = (n & 255) / 255;
  return out;
}
function _rgb01ToHex (c) {
  const r = clamp(Math.round(c.r * 255), 0, 255);
  const g = clamp(Math.round(c.g * 255), 0, 255);
  const b = clamp(Math.round(c.b * 255), 0, 255);
  return '#' + ((r << 16) | (g << 8) | b).toString(16).padStart(6, '0');
}

/* Terrain-цвет type 0. Кэш по объекту планеты (WeakMap): пересборка планеты
 * автоматически инвалидирует запись. */
const _terrainCache = new WeakMap();
function terrainColorHex (pl) {
  if (!pl) return '#2a5a7a';
  if (_terrainCache.has(pl)) return _terrainCache.get(pl);

  let result;
  if (pl.biome === 'krios') {
    result = '#2a6a8a';                         /* Криос — всегда лёд */
  } else {
    /* 1) база: цвет рукава × тёмный фон планеты */
    const sector = L.sectorOf ? L.sectorOf(pl.id) : null;
    const armHex = (sector && sector.color) || '#2a9cca';
    const bg1Hex = (pl.palette && pl.palette.bg1) || '#0b1219';
    _hexToRgb01(armHex, _rA);
    _hexToRgb01(bg1Hex, _rB);
    const m = ARM_TERRAIN_MIX;
    let r = _rA.r * (1 - m) + _rB.r * m;
    let g = _rA.g * (1 - m) + _rB.g * m;
    let b = _rA.b * (1 - m) + _rB.b * m;

    /* 2) biome-tint: климат и поверхность (только процедурные миры) */
    if (pl.biome !== 'ferrum') {
      const cli  = pl.descriptors && pl.descriptors.climate && pl.descriptors.climate.id;
      const surf = pl.descriptors && pl.descriptors.surface && pl.descriptors.surface.id;
      const cb = CLIMATE_BASE[cli];
      if (cb) {
        _hexToRgb01(cb, _rA);
        r = r * (1 - CLIMATE_BLEND) + _rA.r * CLIMATE_BLEND;
        g = g * (1 - CLIMATE_BLEND) + _rA.g * CLIMATE_BLEND;
        b = b * (1 - CLIMATE_BLEND) + _rA.b * CLIMATE_BLEND;
      }
      const sb = SURFACE_BASE[surf];
      if (sb) {
        _hexToRgb01(sb, _rA);
        r = r * (1 - SURFACE_BLEND) + _rA.r * SURFACE_BLEND;
        g = g * (1 - SURFACE_BLEND) + _rA.g * SURFACE_BLEND;
        b = b * (1 - SURFACE_BLEND) + _rA.b * SURFACE_BLEND;
      }
      /* смешивание вымывает насыщенность — возвращаем 12 % */
      const lum = (r + g + b) / 3;
      r = clamp(lum + (r - lum) * SAT_BOOST, 0, 1);
      g = clamp(lum + (g - lum) * SAT_BOOST, 0, 1);
      b = clamp(lum + (b - lum) * SAT_BOOST, 0, 1);
    }

    /* 3) Феррум — расплавленный металл: тёплый бронзовый сдвиг */
    if (pl.biome === 'ferrum') { r *= 1.10; g *= 1.00; b *= 0.82; }

    result = _rgb01ToHex({ r: clamp(r, 0, 1), g: clamp(g, 0, 1), b: clamp(b, 0, 1) });
  }
  _terrainCache.set(pl, result);
  return result;
}

/* Детерминированный джиттер клетки: −1…+1, стабилен между сессиями
 * (зависит только от cell.center — ничего не пишем в состояние игры). */
function cellTintJitter (cell) {
  const c = cell && cell.center;
  if (!c || c.length < 3) return 0;
  const x = c[0], y = c[1], z = c[2];
  const h1 = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  const h2 = Math.sin(x * 269.5 + y * 183.3 + z * 246.1) * 28001.8384;
  return (h1 - Math.floor(h1)) + (h2 - Math.floor(h2)) - 1;
}

/* Джиттер + модуляция рельефом. Канальные множители разные (r+, g+, b−) —
 * сдвиг идёт в оттенок (тёплый/холодный), а не только в яркость. */
function jitterHex (hex, cell) {
  let h = String(hex || '').replace('#', '');
  if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
  if (h.length !== 6) return hex;
  const n = parseInt(h, 16);
  if (!Number.isFinite(n)) return hex;
  const j = cellTintJitter(cell);
  const relief = clamp(cellHeight(cell) / (R * 0.19), -1, 1);
  const k = 1 + relief * 0.09;
  const r = clamp(Math.round(((n >> 16) & 255) * k * (1 + j * 0.09)), 0, 255);
  const g = clamp(Math.round(((n >> 8) & 255) * k * (1 + j * 0.02)), 0, 255);
  const b = clamp(Math.round((n & 255) * k * (1 - j * 0.07)), 0, 255);
  return `rgb(${r},${g},${b})`;
}

/* Семантический цвет изученной клетки: тип/ресурс + джиттер + рельеф. */
function geoCSS (cell, pl) {
  /* v0.0.12: isDeep на цвет больше не влияет — глубокая клетка остаётся в
   * своей геологической градации (было: фиксированный фиолетовый «разлом»
   * #55416f). Визуальные маркеры глубины — геометрия (впадина) и ромб в fx. */
  const t = cell.type;
  let base;
  if (t === 0)            base = terrainColorHex(pl);
  else if (t === 1)       base = '#2fd47a';   /* богатая энергия — зелёный */
  else if (t === 2)       base = '#d67eff';   /* редкая энергия — фиолетовый */
  else if (t === 4)       base = '#ffd447';   /* аномалия — золото */
  else if (t === 6)       base = '#7ec9e8';   /* исследования — голубой */
  else if (t === 7)       base = '#ffcc44';   /* ядро грани — тёплое золото */
  else if (t === 3 || t === 5) {
    const key = t === 5 ? 'kriogen' : (cell.resourceKey || 'iron');
    base = RESOURCE_3D[key]
        || (L.RESOURCES && L.RESOURCES[key] && L.RESOURCES[key].color)
        || '#b0784e';
  } else {
    base = O0_FALLBACK[t] || '#2a9cca';
  }
  return jitterHex(base, cell);
}

function cellBaseCSS (cell, pl, explored, affordable) {
  const ferrum = pl.biome === 'ferrum';
  if (explored) {
    if (L.isCellDestroyed && L.isCellDestroyed(cell)) return '#1a1010';
    if ((cell.type === 3 || cell.type === 5) && cell.reserve <= 0) return ferrum ? '#3a2820' : '#15202c';
    /* v0.0.10: цвет = геология (тип/ресурс/рукав) + джиттер + рельеф.
     * Уровень палитру НЕ меняет — прогресс читается геометрией (cellHeight). */
    return geoCSS(cell, pl);
  }
  if (!affordable) return ferrum ? '#1c1108' : '#0e1a26';
  return cell._fillUnexplored ||
    (pl.palette && pl.palette.unexplored && (pl.palette.unexplored[cell.displayType] || pl.palette.unexplored[0])) || '#28576d';
}

/* Сигнатура цвета (float64, без коллизий). Всё, от чего зависит заливка:
 * explored / destroyed(Kn) / depleted / locked(!gt) / isDeep / type /
 * affordability / _colorVer (бандл сам bump'ает его при пересчёте _fill*). */
function cellSig (cell, pl, explored, affordable) {
  let s = explored ? 1 : 0;
  if (L.isCellDestroyed && L.isCellDestroyed(cell)) s += 2;
  if ((cell.type === 3 || cell.type === 5) && cell.reserve <= 0) s += 4;
  if ((cell.type === 3 || cell.type === 5) && L.isCellActive && !L.isCellActive(cell)) s += 8;
  if (cell.isDeep) s += 16;
  s += (cell.type & 15) * 32;
  if (affordable) s += 512;
  s += (cell._colorVer || 0) * 4096;
  return s;
}

/* запись цвета клетки в merged-буфер. Градиент повторяет createRadialGradient
 * из po(): stop 0 = +35% белого, stop 0.5 = базовый цвет, stop 1 = −45%.
 * d для каждой вершины сохранено в слоте при добавлении клетки. */
const _bright = { r: 0, g: 0, b: 0 }, _dark = { r: 0, g: 0, b: 0 };
function paintCell (cell, pl, explored, affordable) {
  const slot = st.slotOf && st.slotOf.get(cell.id);
  if (!slot) return;
  parseColor(cellBaseCSS(cell, pl, explored, affordable), _base);

  const locked = explored && (cell.type === 3 || cell.type === 5) && L.isCellActive && !L.isCellActive(cell);
  if (locked) mixInto(_base, LOCK_OVER, .62);

  const destroyed = L.isCellDestroyed && L.isCellDestroyed(cell);
  const gradient = explored && !destroyed;
  if (gradient) {
    _bright.r = _base.r; _bright.g = _base.g; _bright.b = _base.b; mixInto(_bright, WHITE, .35);
    _dark.r = _base.r; _dark.g = _base.g; _dark.b = _base.b; mixInto(_dark, BLACK, .45);
  }

  const now = performance.now();
  const flashUntil = st.flashes.get(cell.id) || 0;
  const flash = flashUntil > now ? (flashUntil - now) / 700 : 0;

  const col = st.bufCol, dArr = slot.d;
  const end = slot.topStart + slot.topCount;              // v0.0.6: только крышка
  /* v0.0.11 · rim-light: тонкое светлое кольцо у кромки крышки (d ≈ rimPeak).
   * Плитка читается выпуклой; соседи разделены даже без стенок. */
  const E0 = EXTRUDE;
  const useRim = gradient && E0.rimStrength > 0;
  const rp = E0.rimPeak, rw = E0.rimWidth, rs = E0.rimStrength;
  for (let t = slot.topStart; t < end; t++) {
    let r, g, b;
    const dd = gradient ? dArr[t - slot.topStart] : 0;
    if (!gradient) { r = _base.r; g = _base.g; b = _base.b; }
    else if (dd < .5) {
      const u = dd * 2;
      r = _bright.r + (_base.r - _bright.r) * u;
      g = _bright.g + (_base.g - _bright.g) * u;
      b = _bright.b + (_base.b - _bright.b) * u;
    } else {
      const u = (dd - .5) * 2;
      r = _base.r + (_dark.r - _base.r) * u;
      g = _base.g + (_dark.g - _base.g) * u;
      b = _base.b + (_dark.b - _base.b) * u;
    }
    if (useRim) {
      const rim = 1 - Math.abs(dd - rp) / rw;
      if (rim > 0) {
        const kk = rim * rs;
        r += (1 - r) * kk; g += (1 - g) * kk; b += (1 - b) * kk;
      }
    }
    if (flash > 0) { r += (1 - r) * .5 * flash; g += (1 - g) * .5 * flash; b += (1 - b) * .5 * flash; }
    col[t * 3] = r; col[t * 3 + 1] = g; col[t * 3 + 2] = b;
  }

  /* v0.0.6 · стенки. Отдельная ветка ОБЯЗАТЕЛЬНА: d у стенки означает высоту
   * на стене (0 = низ, 1 = верх), а не расстояние от центра клетки, поэтому
   * общий градиентный цикл покрасил бы её наоборот — низ светлее верха. */
  if (slot.wallCount > 0) {
    const E = EXTRUDE;
    const kTop = gradient ? E.wallShade : E.wallFlat;
    const kBot = gradient ? E.wallAO    : E.wallFlat;
    const wEnd = slot.wallStart + slot.wallCount;
    /* v0.0.11 · «кромка лезвия»: верхние (1−wallRimFrom)·100 % стенки светлее —
     * граница крышка/стенка читается чёткой линией. */
    const wrf = E0.wallRimFrom, wrs = E0.wallRimStrength;
    const useWallRim = gradient && wrs > 0;
    for (let t = slot.wallStart; t < wEnd; t++) {
      const u = dArr[t - slot.topStart];
      const kk = kBot + (kTop - kBot) * u;
      let r = _base.r * kk, g = _base.g * kk, b = _base.b * kk;
      if (useWallRim && u > wrf) {
        const wRim = ((u - wrf) / (1 - wrf)) * wrs;
        r += (1 - r) * wRim; g += (1 - g) * wRim; b += (1 - b) * wRim;
      }
      if (flash > 0) { r += (1 - r) * .5 * flash; g += (1 - g) * .5 * flash; b += (1 - b) * .5 * flash; }
      col[t * 3] = r; col[t * 3 + 1] = g; col[t * 3 + 2] = b;
    }
  }

  markColorRange(slot.topStart, slot.count);              // один диапазон на клетку
}
function markColorRange (start, count) {
  const attr = st.colAttr;
  if (!attr) return;
  if (attr.addUpdateRange) attr.addUpdateRange(start * 3, count * 3);
  attr.needsUpdate = true;
}

/* Полное построение под планету: предаллокация под ВСЕ клетки; далее revealed
 * добавляются append-only (скан не вызывает пересборки — только дозапись). */
function buildPlanet (pl) {
  if (st.cellMesh) {
    st.pitchGroup.remove(st.cellMesh);
    st.cellMesh.geometry.dispose();
    st.cellMesh.material.dispose();
    st.cellMesh = null;
  }
  st.slotOf = new Map();
  st.appended = new Set();
  st.flashes.clear();
  st.planetRef = pl;

  /* v0.0.9: стенки включаются только на планетах, где на них хватает бюджета */
  st.wallsOn = pl.cells.length <= EXTRUDE.wallsAboveCells;
  st.rebuildPending = false;

  let total = 0, walls = 0;
  for (const cell of pl.cells) {
    total += countCellVerts(cell);
    walls += countWallVerts(cell, pl);
  }
  st.wallTotal = walls;
  total = Math.max(total + walls, 64);
  st.capacity = total; st.cursor = 0;

  const pos = new Float32Array(total * 3);
  const col = new Float32Array(total * 3);
  const nrm = new Float32Array(total * 3);
  st.bufPos = pos; st.bufCol = col; st.bufNrm = nrm;

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.setDrawRange(0, 0);
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 0, 0), R * 1.2);

  const mat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  st.cellMesh = new THREE.Mesh(geo, mat);
  st.cellMesh.frustumCulled = false;
  st.pitchGroup.add(st.cellMesh);
  st.posAttr = geo.getAttribute('position');
  st.colAttr = geo.getAttribute('color');
  st.nrmAttr = geo.getAttribute('normal');

  st.sigOf = new Float64Array(pl.cells.length).fill(-999);
  st.heightSig = new Array(pl.cells.length).fill(null); // v0.0.7: составная сигнатура без арифметических коллизий

  /* базовая сфера (тёмная подложка + цвет ночной стороны) и обод по палитре */
  const pal = pl.palette || {};
  if (st.baseSphere) { st.pitchGroup.remove(st.baseSphere); st.baseSphere.geometry.dispose(); st.baseSphere.material.dispose(); }
  st.baseSphere = new THREE.Mesh(
    new THREE.SphereGeometry(R * .995, 96, 64),
    new THREE.MeshLambertMaterial({ color: new THREE.Color(pal.bg1 || '#0b1219') })
  );
  st.baseSphere.renderOrder = -1;
  st.pitchGroup.add(st.baseSphere);
  try { st.atmoShell.material.uniforms.uColor.value.setStyle(pal.border || '#8ddfff'); } catch (e) {}

  appendRevealed(pl, true);
  updateAtmoTarget(pl);
  st.atmoShell.scale.setScalar(st.atmoTarget / st.atmoBaseR);  // смена планеты — снап без анимации
  st.stats.builds++;
  log('планета построена:', pl.id, '| клеток:', pl.cells.length, '| раскрыто:', pl.revealed.size,
      '| вершин:', total, '| из них стенок:', st.wallTotal, st.wallsOn ? '' : '(стенки OFF: бюджет)');
}

/* дозапись новых revealed-клеток в хвост буфера — O(новых клеток).
 * Каждая клетка — сферический многоугольник: fan из центра subdivided k×k
 * (k — по угловому размеру клетки), все точки нормализованы на сферу,
 * поэтому крупные клетки не «тонут» под поверхностью. */
function appendRevealed (pl, initial) {
  const pos = st.bufPos, nrm = st.bufNrm;
  const rad = R * LIFT;
  let added = 0;
  const v0 = st.cursor;

  for (const id of pl.revealed) {
    if (st.appended.has(id)) continue;
    const cell = pl.cells[id];
    if (!cell) continue;
    const topV  = countCellVerts(cell);
    const wallV = countWallVerts(cell, pl);      // заодно заполняет _wallScratch
    if (!topV || st.cursor + topV + wallV > st.capacity) continue;
    const start = st.cursor;
    const k = subdivK(cell);
    const dList = new Float32Array(topV + wallV);
    let vi = start, di = 0;
    let cx = cell.center[0], cy = cell.center[1], cz = cell.center[2];
    const clen = Math.hypot(cx, cy, cz) || 1;
    const ctr = [cx / clen, cy / clen, cz / clen];

    /* -------- TOP FACE: как в v0.0.3, но на радиусе rad + h -------- */
    const h    = cellHeight(cell);
    const topR = rad + h;                         // для впадин < rad — это ок
    for (const p of polysOf(cell)) {
      if (!p || p.length < 3) continue;
      for (let i = 0; i < p.length; i++) {
        const a0 = p[i], b0 = p[(i + 1) % p.length];
        const al = Math.hypot(a0[0], a0[1], a0[2]) || 1;
        const bl = Math.hypot(b0[0], b0[1], b0[2]) || 1;
        const aU = [a0[0] / al, a0[1] / al, a0[2] / al];
        const bU = [b0[0] / bl, b0[1] / bl, b0[2] / bl];
        walkFan(ctr, aU, bU, k, (P0, P1, P2) => {
          const tri = [P0, P1, P2];
          for (let t = 0; t < 3; t++) {
            const P = tri[t];
            pos[vi * 3] = P[0] * topR; pos[vi * 3 + 1] = P[1] * topR; pos[vi * 3 + 2] = P[2] * topR;
            nrm[vi * 3] = P[0]; nrm[vi * 3 + 1] = P[1]; nrm[vi * 3 + 2] = P[2];
            dList[di++] = P[3];
            vi++;
          }
        });
      }
    }
    const topCount = vi - start;

    /* -------- WALLS (v0.0.6) --------
     * Квад на сегмент: (BL,BR,TR) + (BL,TR,TL). Этот порядок даёт CCW при
     * взгляде снаружи для нормали n = cross(edge, radial), развёрнутой прочь
     * от центра клетки. Material DoubleSide, поэтому намотка важна не для
     * видимости, а для gl_FrontFacing: если геометрическая нормаль разойдётся
     * со stored-нормалью, three инвертирует её и стенка станет тёмной.
     * Точки BL/BR = normalize(lerp(p0,p1,j/wk)) — ТОЧНО те же точки, что
     * даёт walkFan на гипотенузе (d = 1), поэтому стык с крышкой без щели. */
    const wallStart = vi;
    if (wallV > 0) {
      const wk = wallSubdiv(cell);
      const S = _wallScratch;
      for (let e = 0; e < S.length; e += 3) {
        const p0 = S[e], p1 = S[e + 1], nh = S[e + 2];
        const rB = rad + nh;                      // FIX: низ = верх соседа, не baseR
        const rT = topR;

        const al = Math.hypot(p0[0], p0[1], p0[2]) || 1;
        const bl = Math.hypot(p1[0], p1[1], p1[2]) || 1;
        const ax = p0[0] / al, ay = p0[1] / al, az = p0[2] / al;
        const bx = p1[0] / bl, by = p1[1] / bl, bz = p1[2] / bl;

        /* нормаль: cross(edge, radial) + разворот ПРОЧЬ от центра клетки.
         * Критерий self-referential — не зависит от направления sortPoly.
         * Сверен с критерием «разворот к соседу»: 0 расхождений на 5100 рёбрах. */
        let mx = ax + bx, my = ay + by, mz = az + bz;
        const ml = Math.hypot(mx, my, mz) || 1;
        mx /= ml; my /= ml; mz /= ml;
        const ex = bx - ax, ey = by - ay, ez = bz - az;
        let nx = ey * mz - ez * my;
        let ny = ez * mx - ex * mz;
        let nz = ex * my - ey * mx;
        const nl = Math.hypot(nx, ny, nz) || 1;
        nx /= nl; ny /= nl; nz /= nl;
        if (nx * ctr[0] + ny * ctr[1] + nz * ctr[2] > 0) { nx = -nx; ny = -ny; nz = -nz; }

        for (let j = 0; j < wk; j++) {
          const t0 = j / wk, t1 = (j + 1) / wk;
          let ux = ax + ex * t0, uy = ay + ey * t0, uz = az + ez * t0;
          let ul = Math.hypot(ux, uy, uz) || 1;
          ux /= ul; uy /= ul; uz /= ul;
          let vx = ax + ex * t1, vy = ay + ey * t1, vz = az + ez * t1;
          const vl = Math.hypot(vx, vy, vz) || 1;
          vx /= vl; vy /= vl; vz /= vl;

          /* BL,BR,TR | BL,TR,TL ; d: 0 = низ стенки, 1 = верх */
          const q = [
            ux * rB, uy * rB, uz * rB, 0,
            vx * rB, vy * rB, vz * rB, 0,
            vx * rT, vy * rT, vz * rT, 1,
            ux * rB, uy * rB, uz * rB, 0,
            vx * rT, vy * rT, vz * rT, 1,
            ux * rT, uy * rT, uz * rT, 1,
          ];
          for (let t = 0; t < 6; t++) {
            const o = vi * 3, s4 = t * 4;
            pos[o] = q[s4]; pos[o + 1] = q[s4 + 1]; pos[o + 2] = q[s4 + 2];
            nrm[o] = nx;    nrm[o + 1] = ny;        nrm[o + 2] = nz;
            dList[di++] = q[s4 + 3];
            vi++;
          }
        }
      }
    }

    st.slotOf.set(id, {
      topStart: start, topCount,
      wallStart, wallCount: vi - wallStart,
      count: vi - start,
      d: dList.subarray(0, di),
    });
    st.appended.add(id);
    st.cursor = vi;
    added++;
  }

  if (added) {
    updateAtmoTarget(pl);   /* v0.0.16: новая клетка может оказаться выше текущей вершины */
    st.stats.appends++;
    st.cellMesh.geometry.setDrawRange(0, st.cursor);
    const nFloats = (st.cursor - v0) * 3;
    if (st.posAttr.addUpdateRange) {
      st.posAttr.addUpdateRange(v0 * 3, nFloats);
      st.nrmAttr.addUpdateRange(v0 * 3, nFloats);
    }
    st.posAttr.needsUpdate = true;
    st.nrmAttr.needsUpdate = true;
  }

  /* покраска: при первичной сборке — все; иначе только с изменившейся сигнатурой */
  const affordable = isAffordable();
  for (const id of pl.revealed) {
    const cell = pl.cells[id];
    if (!cell || !st.slotOf.has(id)) continue;
    const explored = pl.explored.has(id);
    const sig = cellSig(cell, pl, explored, affordable);
    if (!initial && st.sigOf[id] === sig) continue;
    st.sigOf[id] = sig;
    paintCell(cell, pl, explored, affordable);
  }
}

/* свип (400мс): истощение/разрушение/восстановление/локи/порог цены скана —
 * всё, что меняется без событий шины */
function sweepColors (pl) {
  /* v0.0.7: высота — это геометрия. Изменилась (level / isDeep / type /
   * разрушение) → цветовой свип не поможет, запрашиваем пересборку.
   * Собирается в frame() с троттлингом, чтобы авто-апгрейд не фризил. */
  if (st.heightSig) {
    let heightDirty = false;
    for (const id of pl.revealed) {
      const cell = pl.cells[id];
      if (!cell) continue;
      const hs = cellHeightSig(cell);
      if (st.heightSig[id] !== hs) { st.heightSig[id] = hs; heightDirty = true; }
    }
    if (heightDirty) { st.rebuildPending = true; return; }
  }

  const affordable = isAffordable();
  for (const id of pl.revealed) {
    const cell = pl.cells[id];
    if (!cell) continue;
    const explored = pl.explored.has(id);
    const sig = cellSig(cell, pl, explored, affordable);
    if (st.sigOf[id] === sig) continue;
    st.sigOf[id] = sig;
    if (st.slotOf.has(id)) paintCell(cell, pl, explored, affordable);
  }
  return added;
}

/* вспышки скана (700мс) — покадровая перерисовка затронутых клеток */
function tickFlashes (pl) {
  if (!st.flashes.size) return;
  const now = performance.now();
  const aff = isAffordable();
  const expired = [];
  for (const entry of st.flashes) if (entry[1] <= now) expired.push(entry[0]);
  for (const id of expired) st.flashes.delete(id);
  const repaint = id => {
    const cell = pl.cells[id];
    if (cell && st.slotOf.has(id)) paintCell(cell, pl, pl.explored.has(id), aff);
  };
  for (const id of st.flashes.keys()) repaint(id);
  for (const id of expired) repaint(id);
}

/* ===================== v0.0.13 · ПРОТУБЕРАНЦЫ-«ЛУЧИ СОЛНЦА» =================
 * Заряженная жила (type 1/2, окно prominence после разряда) выбрасывает из
 * поверхности конические лучи НАРУЖУ вдоль радиуса планеты — за пределы сферы.
 * Все ключевые точки (корень, середина-изгиб, кончик) считаются в 3D на
 * единичной сфере и проецируются штатным o0(): поэтому у центра диска лучи
 * корректно складываются в «корону» (foreshortening), а у лимба — вылетают
 * за силуэт планеты. Стиль: белый горячий корень → градиент в цвет типа →
 * прозрачный кончик; бегущие искры; дрейф угла, мерцание длины и изгиба;
 * общая яркость затухает вместе с cs.fade (baseDur секунд, как в игре).
 * Тип 1 (богатая) — 5 широких мягких язычков; тип 2 (редкая) — 6 тонких
 * быстрых лучей (кристальная стилистика).
 * ============================================================================*/
function drawProminence (a, m, cs, zoom, nowP, proj) {
  const c = m.center;
  const cl = Math.hypot(c[0], c[1], c[2]) || 1;
  const cx = c[0] / cl, cy = c[1] / cl, cz = c[2] / cl;

  /* тангенциальный базис в точке клетки */
  let ux = 0, uy = 1, uz = 0;
  if (Math.abs(cy) > 0.95) { ux = 1; uy = 0; uz = 0; }
  let t1x = uy * cz - uz * cy, t1y = uz * cx - ux * cz, t1z = ux * cy - uy * cx;
  const l1 = Math.hypot(t1x, t1y, t1z) || 1;
  t1x /= l1; t1y /= l1; t1z /= l1;
  const t2x = cy * t1z - cz * t1y, t2y = cz * t1x - cx * t1z, t2z = cx * t1y - cy * t1x;

  const rare = m.type === 2;
  const cc = rare ? '192,132,252' : '45,186,110';
  const BEAMS = rare ? 6 : 5;
  const A = Math.min(1, cs.fade * 1.4) * (.72 + .28 * Math.sin(nowP / (rare ? 170 : 220) + m.id));
  if (!(A > 0.02)) return 0;

  const base = proj([cx * 1.012, cy * 1.012, cz * 1.012]);
  if (!(base.z > 0)) return 0;

  const w0 = Math.max(2.6, (rare ? 5.8 : 8.4) * Math.min(zoom, 2)) * (0.55 + 0.45 * cs.fade);
  let drawn = 0;
  a.save();
  a.globalCompositeOperation = 'lighter';

  for (let i = 0; i < BEAMS; i++) {
    const seed = m.id * 1.37 + i * 2.399;                 /* стабильная фаза на луч */
    const ph = nowP / (rare ? 2600 : 3400) + seed;        /* медленный дрейф вокруг клетки */
    const spread = 0.30 + 0.20 * Math.sin(nowP / 430 + seed * 1.7);
    /* v0.0.13: длина 0.35…1.05 R (кончики на 1.35…2.05 R от центра планеты).
     * Экранное смещение радиального кончика = offset_клетки·(1+len) — поэтому:
     *  - у лимба (offset≈R) лучи далеко вылетают за силуэт — «лучи Солнца»;
     *  - у центра диска (offset→0) лучи смотрят на наблюдателя и складываются
     *    в корону — корректный foreshortening, проекция o0 делает всё сама. */
    const len = (0.70 + 0.35 * Math.sin(nowP / (rare ? 240 : 310) + seed * 2.9))
              * (0.45 + 0.55 * cs.fade);                  /* затухание с зарядом */
    /* направление луча: радиус + тангенциальный разнос */
    const tcos = Math.cos(ph) * spread, tsin = Math.sin(ph) * spread;
    let dx = cx + t1x * tcos + t2x * tsin;
    let dy = cy + t1y * tcos + t2y * tsin;
    let dz = cz + t1z * tcos + t2z * tsin;
    const dl = Math.hypot(dx, dy, dz) || 1;
    dx /= dl; dy /= dl; dz /= dl;
    /* изгиб (curl) в середине — лёгкая «магнитная» дуга */
    const curl = 0.10 * Math.sin(nowP / 260 + seed * 3.1);
    const midR = 1 + len * 0.55;
    const M = proj([dx * midR + t1x * curl * 0.5, dy * midR + t1y * curl * 0.5, dz * midR + t1z * curl * 0.5]);
    const T = proj([dx * (1 + len), dy * (1 + len), dz * (1 + len)]);
    if (!(M.z > 0) || !(T.z > 0)) continue;               /* за горизонтом — не рисуем */

    const sx = T.x - base.x, sy = T.y - base.y;
    const sl = Math.hypot(sx, sy) || 1;
    const nx = -sy / sl, ny = sx / sl;                    /* нормаль луча на экране */

    const al = A * (0.88 - 0.22 * (i % 2));
    const grad = a.createLinearGradient(base.x, base.y, T.x, T.y);
    grad.addColorStop(0,    `rgba(255,255,255,${(0.92 * al).toFixed(3)})`);
    grad.addColorStop(0.18, `rgba(${cc},${(0.78 * al).toFixed(3)})`);
    grad.addColorStop(0.55, `rgba(${cc},${(0.34 * al).toFixed(3)})`);
    grad.addColorStop(1,    `rgba(${cc},0)`);
    a.fillStyle = grad;
    /* конус: две квадратичные кромки от основания (ширина w0) к кончику (0) */
    a.beginPath();
    a.moveTo(base.x + nx * w0 * 0.5, base.y + ny * w0 * 0.5);
    a.quadraticCurveTo(M.x + nx * w0 * 0.28, M.y + ny * w0 * 0.28, T.x, T.y);
    a.quadraticCurveTo(M.x - nx * w0 * 0.28, M.y - ny * w0 * 0.28, base.x - nx * w0 * 0.5, base.y - ny * w0 * 0.5);
    a.closePath();
    a.fill();

    /* бегущая искра вдоль луча (точка квадратичной Безье) */
    const sp = ((nowP / (rare ? 620 : 760)) + i * 0.37 + seed * 0.11) % 1;
    const is = 1 - sp;
    const ppx = is * is * base.x + 2 * is * sp * M.x + sp * sp * T.x;
    const ppy = is * is * base.y + 2 * is * sp * M.y + sp * sp * T.y;
    a.fillStyle = `rgba(255,255,255,${((1 - sp) * al * 0.9).toFixed(3)})`;
    a.beginPath();
    a.arc(ppx, ppy, Math.max(1, (rare ? 1.3 : 1.8) * Math.min(zoom, 2)), 0, Math.PI * 2);
    a.fill();
    drawn++;
  }

  /* горячее ядро у поверхности — корень протуберанца */
  const Jr = Math.max(10, (rare ? 13 : 16) * Math.min(zoom, 2)) * (0.6 + 0.4 * cs.fade);
  const gr2 = a.createRadialGradient(base.x, base.y, 0, base.x, base.y, Jr);
  gr2.addColorStop(0,    `rgba(255,255,255,${(0.95 * A).toFixed(3)})`);
  gr2.addColorStop(0.35, `rgba(${cc},${(0.60 * A).toFixed(3)})`);
  gr2.addColorStop(1,    `rgba(${cc},0)`);
  a.fillStyle = gr2;
  a.beginPath(); a.arc(base.x, base.y, Jr, 0, Math.PI * 2); a.fill();
  a.restore();
  return drawn;
}

/* ----------------------------------------------------------------------------
 * 6. FX-канвас: портированные блоки po()
 * --------------------------------------------------------------------------*/
function fxFrame (pl) {
  const a = st.fxc;
  const W = st.W, H = st.H;
  a.setTransform(st.dpr, 0, 0, st.dpr, 0, 0);
  a.clearRect(0, 0, W, H);
  if (!pl) return;

  const proj = L.project;                        // o0 из бандла — та же проекция, что у 3D
  const zoom = S.zoom || 1;
  const tier = zoom < .75 ? 0 : zoom < 1.15 ? 1 : 2;   // «o» из po()
  const pal = pl.palette || { border: '#8ddfff' };
  const ferrum = pl.biome === 'ferrum';
  const now = performance.now();
  const dnow = Date.now();   /* v0.0.13: часы бандла для chargeState (эпоха мс) */
  const affordable = isAffordable();
  const RES = L.RESOURCES || {};
  const CHG = L.CHARGE_CONFIG || {};
  let promTotal = 0;         /* v0.0.13: сколько лучей протуберанцев нарисовано */
  const promRects = [];      /* v0.0.13:.rect'ы 2D-спрайтов для подавления */
  const MAXL = S.MAX_LEVEL || 20;
  const selId = S.selectedCellId;
  const discR = Math.min(W, H) * .36 * zoom;
  const cxS = W / 2, cyS = H / 2;

  /* встряска экрана — как в po() (общая амплитуда, собственный случайный вектор) */
  let shx = 0, shy = 0;
  if (S.screenShake > 0) { shx = (Math.random() - .5) * S.screenShake; shy = (Math.random() - .5) * S.screenShake; }
  a.save();
  a.translate(shx, shy);

  /* --- 6.1 Рамки и внутриклеточные элементы (порядок и стиль — копия po) --- */
  for (const id of pl.revealed) {
    const m = pl.cells[id];
    if (!m) continue;
    const c0 = proj(m.center);
    if (!(c0.z > 0)) continue;                            // задняя сторона
    const g = c0.x, b = c0.y;
    if (g < -200 || g > W + 200 || b < -200 || b > H + 200) continue;

    const polysP = polysOf(m);
    const polys = new Array(polysP.length);
    for (let pi = 0; pi < polysP.length; pi++) {
      const P = polysP[pi], arr = new Array(P.length);
      for (let u = 0; u < P.length; u++) { const q = proj(P[u]); arr[u] = { x: q.x, y: q.y }; }
      polys[pi] = arr;
    }
    const _ = polys[0];
    if (!_) continue;

    const A = pl.explored.has(id);
    const O = A && L.isCellDestroyed && L.isCellDestroyed(m);
    const T = A && (m.type === 3 || m.type === 5) && m.reserve <= 0;

    const pathPoly = () => {
      a.beginPath();
      for (const P of polys) for (let u = 0; u < P.length; u++) {
        const p = P[u];
        u === 0 ? a.moveTo(p.x, p.y) : a.lineTo(p.x, p.y);
      }
      a.closePath();
    };
    let _N = null;
    const centroid = () => {
      if (_N) return _N;
      let X = 0, Y = 0;
      for (const p of _) { X += p.x; Y += p.y; }
      _N = { x: X / _.length, y: Y / _.length };
      return _N;
    };

    if (A) {
      if (O) {
        /* разрушенная: трещины + красный пульс-контур + 💀 (дальше po() делает continue) */
        if (tier >= 1) {
          const N = centroid();
          a.save();
          a.globalAlpha = .7; a.strokeStyle = '#5a1c1c'; a.lineWidth = 1.4;
          a.beginPath();
          a.moveTo(_[0].x, _[0].y);
          a.lineTo(_[Math.floor(_.length / 2)].x, _[Math.floor(_.length / 2)].y);
          if (_.length >= 4) {
            a.moveTo(_[Math.floor(_.length / 4)].x, _[Math.floor(_.length / 4)].y);
            a.lineTo(_[Math.floor(_.length * 3 / 4)].x, _[Math.floor(_.length * 3 / 4)].y);
          }
          a.stroke();
          const U = .4 + .3 * Math.sin(now / 500);
          a.globalAlpha = 1;
          a.strokeStyle = `rgba(255,94,94,${U.toFixed(3)})`; a.lineWidth = 2.2; a.stroke();
          a.fillStyle = '#ffb0b0';
          a.font = `${Math.max(12, 14 * zoom)}px Arial`;
          a.textAlign = 'center'; a.textBaseline = 'middle';
          a.fillText('💀', N.x, N.y);
          a.restore();
        }
        continue;
      }

      if (T) {
        /* истощённая жила: красный пульс-контур */
        if (tier >= 1) {
          const I = .35 + .45 * (.5 + .5 * Math.sin(now / 180));
          pathPoly();
          a.strokeStyle = `rgba(255,94,94,${I})`;
          a.lineWidth = Math.max(1.5, 2 * zoom);
          a.stroke();
        }
      } else if (tier >= 1 && (m.type === 1 || m.type === 2 || m.type === 7)) {
        /* зарядные клетки: prominence-свечение / дуга кулдауна / пульс готовности */
        const N = centroid();
        const J = Math.max(4, Math.hypot(_[0].x - N.x, _[0].y - N.y));
        if (m.type === 7) {
          const ue = .5 + .5 * Math.sin(now / 700), Pe = now / 1200 % (Math.PI * 2);
          a.save(); a.globalCompositeOperation = 'lighter';
          pathPoly();
          a.strokeStyle = 'rgba(255,204,68,' + (.45 + ue * .4).toFixed(3) + ')';
          a.lineWidth = Math.max(2, 3 * zoom); a.stroke();
          a.beginPath(); a.arc(N.x, N.y, J * (.55 + ue * .12), Pe, Pe + Math.PI * 1.4);
          a.strokeStyle = 'rgba(255,240,150,.85)'; a.lineWidth = Math.max(1.5, 2 * zoom); a.stroke();
          a.restore();
        } else {
          const cs = chargeState(m, CHG, dnow);
          if (cs.state === 'prominence') {
            /* v0.0.13 · «лучи Солнца»: конические лучи из поверхности клетки
               наружу вдоль радиуса, за пределы сферы (см. drawProminence). */
            promTotal += drawProminence(a, m, cs, zoom, now, proj);
            /* геометрия 2D-спрайта из po() — для подавления дубля на #game
               (строится на СЛЕДУЮЩИЙ кадр; формулы 1-в-1 как в бандле) */
            if (m.type !== 7) {
              const Dt = Math.max(12, J * 1.9 * Math.min(zoom, 2));
              const Je = Dt * 2, wt = Dt * 2;
              promRects.push({ x: N.x - Je / 2, y: N.y - wt * .78 + J * .25, w: Je, h: wt, used: false });
            }
          } else if (cs.state === 'cooldown') {
            const cfg = CHG[m.type] || {};
            const Ue = Math.max(0, Math.min(1, 1 - cs.leftCD / ((cfg.cd || 60) * 1e3)));
            a.save();
            a.beginPath(); a.arc(N.x, N.y, J * .82, 0, Math.PI * 2);
            a.strokeStyle = 'rgba(0,0,0,.5)'; a.lineWidth = Math.max(1.5, 2 * zoom); a.stroke();
            a.beginPath(); a.arc(N.x, N.y, J * .82, -Math.PI / 2, -Math.PI / 2 + Ue * Math.PI * 2);
            a.strokeStyle = '#ffda47'; a.lineWidth = Math.max(1.5, 2 * zoom); a.stroke();
            a.restore();
          } else {
            const Pe = .26 + .2 * Math.sin(now / 600 + m.id);
            a.save(); a.globalCompositeOperation = 'lighter';
            pathPoly();
            a.strokeStyle = m.type === 2 ? `rgba(192,132,252,${Pe.toFixed(3)})` : `rgba(45,186,110,${Pe.toFixed(3)})`;
            a.lineWidth = Math.max(1.5, 2 * zoom); a.stroke();
            a.restore();
          }
        }
      }

      /* уровень >= 10: золотой пульс-контур */
      if (m.level >= 10 && !m.isDeep) {
        const K = .25 + .15 * Math.sin(now / 700 + m.id);
        a.save(); a.globalCompositeOperation = 'lighter';
        pathPoly();
        a.strokeStyle = `rgba(255,218,71,${K})`; a.lineWidth = 3; a.stroke();
        a.restore();
      }

      /* рамка клетки (цвета/толщины — копия po) */
      if (tier >= 1) {
        let K = pal.border || '#8ddfff', ne = 1;
        if (m.type === 4) { K = '#00ffff'; ne = 2 * Math.min(zoom, 2); }
        else if (m.type === 3) { const J = m.resourceKey || 'iron'; K = (((RES[J] && RES[J].color) || '#8a6448') + 'aa'); ne = 1.4 * Math.min(zoom, 1.8); }
        else if (m.type === 5) { K = '#4ddcffaa'; ne = 1.4 * Math.min(zoom, 1.8); }
        else if (m.type === 1) { K = '#2dba6ecc'; ne = 1.2; }
        else if (m.type === 2) { K = '#c084fcaa'; ne = 1.2; }
        else if (m.type === 6) { K = '#7ec9e8cc'; ne = 1.6 * Math.min(zoom, 1.8); }
        pathPoly();
        a.strokeStyle = K; a.lineWidth = ne; a.stroke();
      }

      /* аномалия (тип 4): пульс-контур + глиф подтипа (power/resonance/synth) */
      if (m.type === 4 && tier >= 1) {
        const I = .35 + .25 * Math.sin(now / 450);
        const sub = anomalySub(m);
        const U = sub === 'power' ? '77,220,255' : sub === 'resonance' ? '192,132,252' : '255,212,71';
        a.save(); a.globalCompositeOperation = 'lighter';
        pathPoly();
        a.strokeStyle = `rgba(${U},${I})`; a.lineWidth = 2.2 * Math.min(zoom, 2); a.stroke();
        if (sub === 'power') {
          const W2 = now / 300;
          for (let j = 0; j < 3; j++) {
            const K = (W2 + j * 2.1) % (Math.PI * 2);
            const ne = g + Math.cos(K) * 14 * zoom, J = b + Math.sin(K) * 14 * zoom;
            a.fillStyle = 'rgba(200,245,255,0.85)';
            a.fillRect(ne - 1, J - 1, 2, 2);
          }
        } else if (sub === 'resonance') {
          const W2 = (4 + I * 2) * zoom;
          a.fillStyle = `rgba(192,132,252,${.6 + I * .3})`;
          a.beginPath(); a.moveTo(g, b - W2); a.lineTo(g + W2, b); a.lineTo(g, b + W2); a.lineTo(g - W2, b);
          a.closePath(); a.fill();
        } else {
          const W2 = 3 * zoom;
          a.fillStyle = `rgba(255,235,150,${.5 + I * .4})`;
          a.fillRect(g - W2, b - .5, W2 * 2, 1);
          a.fillRect(g - .5, b - W2, 1, W2 * 2);
        }
        a.restore();
      }

      /* исследовательская (тип 6): пульс-контур + 🔬 */
      if (m.type === 6 && tier >= 1) {
        const I = .4 + .25 * Math.sin(now / 600);
        a.save(); a.globalCompositeOperation = 'lighter';
        pathPoly();
        a.strokeStyle = `rgba(126,201,232,${I.toFixed(3)})`; a.lineWidth = 1.8 * Math.min(zoom, 2); a.stroke();
        a.globalCompositeOperation = 'source-over';
        a.font = `${Math.max(11, 13 * zoom)}px Arial`;
        a.textAlign = 'center'; a.textBaseline = 'middle';
        a.fillText('🔬', g, b);
        a.restore();
      }

      /* точка уровня (deep — фиолетовый ромб с ореолом, max — оранжевая) */
      if (m.level > 0 && tier >= 1) {
        if (m.isDeep) {
          const I = Math.max(2, 4 * zoom);
          a.beginPath(); a.arc(g, b, I * 2.2, 0, Math.PI * 2);
          a.fillStyle = 'rgba(192,132,252,0.25)'; a.fill();
          a.beginPath(); a.moveTo(g, b - I * 1.5); a.lineTo(g + I, b); a.lineTo(g, b + I * 1.5); a.lineTo(g - I, b);
          a.closePath(); a.fillStyle = '#c084fc'; a.fill();
        } else {
          const I = Math.max(1, (1.5 + m.level * .4) * zoom);
          a.beginPath(); a.arc(g, b, I, 0, Math.PI * 2);
          a.fillStyle = m.level >= MAXL ? '#ff8c00' : '#ffda47'; a.fill();
        }
      }

      /* жилы (3/5): иконка ресурса в кружке */
      if ((m.type === 3 || m.type === 5) && tier >= 1) {
        const key = m.type === 5 ? 'kriogen' : (m.resourceKey || 'iron');
        const res = RES[key] || RES.iron || { color: '#8a6448', icon: '⛏' };
        const U = Math.max(9, 11 * zoom);
        a.save();
        a.fillStyle = 'rgba(0,0,0,.55)';
        a.beginPath(); a.arc(g, b, U + 2, 0, Math.PI * 2); a.fill();
        a.strokeStyle = res.color; a.lineWidth = 1.5;
        a.beginPath(); a.arc(g, b, U + 1, 0, Math.PI * 2); a.stroke();
        a.font = `${Math.max(11, 13 * zoom)}px Arial`;
        a.textAlign = 'center'; a.textBaseline = 'middle';
        a.fillStyle = res.color;
        if (!(window.VoroniaIcons && window.VoroniaIcons.draw(a, key, g, b, Math.max(13, 15 * zoom)))) a.fillText(res.ch || '⛏', g, b);
        a.restore();
      }

      /* дуга резерва */
      if ((m.type === 3 || m.type === 5) && m.maxReserve > 0 && L.isCellActive(m) && tier >= 1) {
        const I = Math.max(0, Math.min(1, m.reserve / m.maxReserve));
        const N = centroid();
        let Wm = 0;
        for (const p of _) Wm = Math.max(Wm, Math.hypot(p.x - N.x, p.y - N.y));
        const j = Wm * .45;
        a.save();
        a.strokeStyle = 'rgba(0,0,0,.55)'; a.lineWidth = 2.5;
        a.beginPath(); a.arc(N.x, N.y, j, 0, Math.PI * 2); a.stroke();
        const K = m.reserve <= 0 ? '#5a5a5a' : I > .5 ? '#5cf2b0' : I > .2 ? '#ffda47' : '#ff5e5e';
        a.strokeStyle = K; a.lineWidth = 2;
        a.beginPath(); a.arc(N.x, N.y, j, -Math.PI / 2, -Math.PI / 2 + I * Math.PI * 2); a.stroke();
        a.restore();
      }

      /* счётчик реактиваций ↻N */
      if ((m.type === 3 || m.type === 5) && m.reserve <= 0 && L.isCellActive(m) && (m.reactCount || 0) > 0 && tier >= 1) {
        const I = Math.max(9, 10 * zoom), N = m.reactCount || 0;
        a.save();
        a.fillStyle = 'rgba(0,0,0,.62)';
        a.beginPath(); a.arc(g, b, I, 0, Math.PI * 2); a.fill();
        if (N >= 8) {
          const U = .5 + Math.sin(now / 380) * .4;
          a.strokeStyle = N >= 15 ? `rgba(255,94,94,${U})` : `rgba(255,218,71,${U})`;
          a.lineWidth = 1.6;
          a.beginPath(); a.arc(g, b, I + 2, 0, Math.PI * 2); a.stroke();
        }
        a.font = `bold ${Math.max(9, 10 * zoom)}px Arial`;
        a.textAlign = 'center'; a.textBaseline = 'middle';
        a.fillStyle = N >= 15 ? '#ff5e5e' : N >= 8 ? '#ffda47' : '#9fc4d4';
        a.fillText('↻' + N, g, b + .5);
        a.restore();
      }

      /* заблокированная жила (нет исследования): замок */
      if ((m.type === 3 || m.type === 5) && !L.isCellActive(m) && tier >= 1) {
        const I = Math.max(9, 10 * zoom);
        a.save();
        a.strokeStyle = '#ff5e5e'; a.fillStyle = '#ff5e5e';
        a.lineWidth = Math.max(1.6, 1.8 * zoom);
        a.beginPath(); a.rect(g - I * .55, b - I * .05, I * 1.1, I * .9); a.stroke();
        a.beginPath(); a.arc(g, b - I * .05, I * .42, Math.PI, 0); a.stroke();
        a.beginPath(); a.arc(g, b + I * .38, Math.max(1.3, 1.6 * zoom), 0, Math.PI * 2); a.fill();
        a.restore();
      }

      /* смешанный кластер (уникальные планеты): внутренняя паутинка + белый пульс */
      if (m._mixedCluster && tier >= 1) {
        if (m._oldIds && m._oldIds.length > 1 && pl._oldCentroids) {
          const pts = m._oldIds.map(x => pl._oldCentroids[x]).filter(Boolean);
          if (pts.length > 1) {
            const scr = pts.map(p => { const q = proj(p); return q.z > 0 ? { x: q.x, y: q.y } : null; });
            a.save();
            a.globalAlpha = .35; a.strokeStyle = 'rgba(0,0,0,0.55)'; a.lineWidth = .8;
            a.beginPath();
            for (let u = 0; u < scr.length; u++) for (let w = u + 1; w < scr.length; w++) {
              const A2 = scr[u], B2 = scr[w];
              if (!A2 || !B2) continue;
              const dot = pts[u][0] * pts[w][0] + pts[u][1] * pts[w][1] + pts[u][2] * pts[w][2];
              if (Math.acos(Math.max(-1, Math.min(1, dot))) > .5) continue;
              a.moveTo(A2.x, A2.y); a.lineTo(B2.x, B2.y);
            }
            a.stroke();
            a.restore();
          }
        }
        a.save();
        a.strokeStyle = `rgba(255,255,255,${(.22 + .1 * Math.sin(now / 900 + m.id)).toFixed(3)})`;
        a.lineWidth = Math.max(1.4, 1.8 * zoom);
        pathPoly(); a.stroke();
        a.restore();
      }

      /* выделение: тройной золотой пульс + точки на вершинах (только изученная, как в po) */
      if (A && m.id === selId && tier >= 1) {
        const N2 = .55 + .35 * Math.sin(now / 240);
        a.save(); a.globalCompositeOperation = 'lighter';
        pathPoly();
        a.strokeStyle = `rgba(255,220,80,${(N2 * .32).toFixed(3)})`; a.lineWidth = Math.max(4, 5.5 * zoom); a.stroke();
        a.strokeStyle = `rgba(255,240,150,${N2.toFixed(3)})`; a.lineWidth = Math.max(2.2, 2.8 * zoom); a.stroke();
        a.strokeStyle = `rgba(255,255,255,${(N2 * .7).toFixed(3)})`; a.lineWidth = 1; a.stroke();
        for (const W2 of [_[0], _[Math.floor(_.length / 2)]]) {
          if (!W2) continue;
          a.fillStyle = `rgba(255,240,150,${N2.toFixed(3)})`;
          a.beginPath(); a.arc(W2.x, W2.y, Math.max(2.5, 3 * zoom), 0, Math.PI * 2); a.fill();
        }
        a.restore();
      }

      /* пульс жилы (настройка veinPulse) */
      if ((m.type === 3 || m.type === 5) && m.reserve > 0 && L.isCellActive(m) && S.settings && S.settings.veinPulse) {
        const I2 = now / 2600 % 1, N3 = m.id % 12 / 12, U2 = (I2 - N3 + 1) % 1;
        if (U2 < .2) {
          const Wj = U2 / .2, j = Math.sin(Wj * Math.PI);
          const N = centroid();
          const J = Math.max(8, Math.hypot(_[0].x - N.x, _[0].y - N.y));
          a.save();
          a.globalCompositeOperation = 'lighter'; a.globalAlpha = .35 * j;
          const ue = a.createRadialGradient(N.x, N.y, 0, N.x, N.y, J * 1.1);
          ue.addColorStop(0, 'rgba(255,240,180,0.85)'); ue.addColorStop(1, 'rgba(255,200,80,0)');
          a.fillStyle = ue;
          pathPoly(); a.fill();
          a.restore();
        }
      }

      /* specialBreath: ауры типа 7/6/4 */
      if (S.settings && S.settings.specialBreath && !T && !O) {
        const N = centroid();
        const U = Math.max(6, Math.hypot(_[0].x - N.x, _[0].y - N.y));
        if (m.type === 7) {
          const W2 = now / 5e3 % 1;
          a.save(); a.globalCompositeOperation = 'lighter';
          for (let j = 0; j < 3; j++) {
            const K = (W2 + j / 3) % 1;
            a.strokeStyle = `rgba(255,218,71,${((1 - K) * .35).toFixed(3)})`;
            a.lineWidth = 1.8 * (1 - K);
            a.beginPath(); a.arc(N.x, N.y, U * (.3 + K * 1.5), 0, Math.PI * 2); a.stroke();
          }
          a.restore();
        } else if (m.type === 6) {
          const W2 = .5 + .5 * Math.sin(now / 700 + m.id);
          a.save(); a.globalCompositeOperation = 'lighter';
          a.strokeStyle = `rgba(126,201,232,${(.35 + .35 * W2).toFixed(3)})`; a.lineWidth = 1.5;
          a.beginPath(); a.arc(N.x, N.y, U * (.8 + W2 * .3), 0, Math.PI * 2); a.stroke();
          a.restore();
        } else if (m.type === 4) {
          const sub = anomalySub(m);
          const j = sub === 'power' ? '77,220,255' : sub === 'resonance' ? '192,132,252' : '255,212,71';
          const K = .5 + .5 * Math.sin(now / 400);
          a.save(); a.globalCompositeOperation = 'lighter';
          const ne = a.createRadialGradient(N.x, N.y, 0, N.x, N.y, U * 1.4);
          ne.addColorStop(0, `rgba(${j},${(.3 * K).toFixed(3)})`); ne.addColorStop(1, `rgba(${j},0)`);
          a.fillStyle = ne;
          a.beginPath(); a.arc(N.x, N.y, U * 1.4, 0, Math.PI * 2); a.fill();
          a.restore();
        }
      }
    } else {
      /* не изучена */
      if (tier >= 1) {
        pathPoly();
        if (affordable) {
          const U = .55 + Math.sin(now / 320) * .35;
          a.strokeStyle = `rgba(255,213,74,${U})`; a.lineWidth = 2.2; a.stroke();
          a.strokeStyle = `rgba(255,248,210,${U * .65})`; a.lineWidth = .8; a.stroke();
        } else {
          a.strokeStyle = ferrum ? '#5a3a24' : '#2a4a60'; a.lineWidth = 1; a.stroke();
        }
      }
    }
  }

  /* --- 6.2 Волна открытия: клип по диску (снаружи видна копия с #game — без дублей) --- */
  const dw = S.discoveryWave;
  if (dw && dw.active) {
    const E = (now - dw.t0) / 1e3 / dw.duration;
    if (E >= 0 && E < 1) {
      a.save();
      a.beginPath(); a.arc(cxS, cyS, discR, 0, Math.PI * 2); a.clip();
      a.globalCompositeOperation = 'lighter';
      const fade = 1 - E, Rr = discR * (.1 + E * 1.55);
      const A2 = Math.max(0, Rr - discR * .14), T2 = Math.max(0, Rr - discR * .3);
      a.strokeStyle = rgba(dw.color, .65 * fade); a.lineWidth = 2.5;
      a.beginPath(); a.arc(cxS, cyS, Rr, 0, Math.PI * 2); a.stroke();
      a.strokeStyle = rgba(dw.color, .22 * fade); a.lineWidth = 12;
      a.beginPath(); a.arc(cxS, cyS, A2, 0, Math.PI * 2); a.stroke();
      a.strokeStyle = rgba(dw.color, .1 * fade); a.lineWidth = 22;
      a.beginPath(); a.arc(cxS, cyS, T2, 0, Math.PI * 2); a.stroke();
      for (const O2 of (dw.sparks || [])) {
        const Vq = Math.max(0, Math.min(1, (E - O2.offset) / (1 - O2.offset)));
        if (Vq <= 0) continue;
        const q = discR * (.1 + Vq * 1.55 * O2.speed);
        const I = cxS + Math.cos(O2.angle) * q, N = cyS + Math.sin(O2.angle) * q;
        const U = O2.alpha * fade * (1 - Vq * .55);
        a.fillStyle = rgba(dw.color, U);
        a.beginPath(); a.arc(I, N, O2.size * Math.max(.6, zoom), 0, Math.PI * 2); a.fill();
        a.fillStyle = rgba('#ffffff', U * .5);
        a.beginPath(); a.arc(I, N, O2.size * Math.max(.6, zoom) * .45, 0, Math.PI * 2); a.fill();
      }
      a.restore();
    }
  }

  /* --- 6.3 Планетарные искры (b1) — клип по диску --- */
  const sparks = S.planetSparks;
  if (sparks && sparks.length) {
    a.save();
    a.beginPath(); a.arc(cxS, cyS, discR, 0, Math.PI * 2); a.clip();
    a.globalCompositeOperation = 'lighter';
    for (let s = sparks.length - 1; s >= 0; s--) {
      const c = sparks[s];
      const l = (now - c.startAt) / c.duration;
      if (l < 0 || l > 1) continue;
      const u = c.kind === 'out' ? l : 1 - l;
      const f = c.kind === 'out' ? cyS : cyS - discR * 1.7;
      const h = c.kind === 'out' ? cyS - discR * 1.7 : cyS;
      const mY = f + (h - f) * u;
      const bX = cxS + Math.sin(u * Math.PI * 2) * 22;
      const w = Math.min(1, l * 4), E = Math.min(1, (1 - l) * 3), al = w * E;
      if (al <= 0) continue;
      const Rg = a.createRadialGradient(bX, mY, 0, bX, mY, 26);
      Rg.addColorStop(0, `rgba(255,255,255,${(.9 * al).toFixed(3)})`);
      Rg.addColorStop(.35, rgba(c.color, .65 * al));
      Rg.addColorStop(1, 'rgba(0,0,0,0)');
      a.fillStyle = Rg;
      a.beginPath(); a.arc(bX, mY, 26, 0, Math.PI * 2); a.fill();
      a.fillStyle = `rgba(255,255,255,${al.toFixed(3)})`;
      a.beginPath(); a.arc(bX, mY, 4.5, 0, Math.PI * 2); a.fill();
    }
    a.restore();
  }

  /* --- 6.4 Летящий текст: зеркало 1-в-1 (копии на #game подавлены хуком) ---
   * postFrame выполняется ПОСЛЕ po(), который уже сдвинул элементы
   * (g.y+=dy, life-=.02) — текущие значения и есть то, что po() нарисует
   * в следующем кадре; fx рисует их же, на один шаг впереди. */
  const texts = S.floatingTexts || [];
  if (texts.length) {
    a.font = 'bold 16px Arial';
    a.textAlign = 'center';
    a.textBaseline = 'alphabetic';
    for (let i = 0; i < texts.length; i++) {
      const g = texts[i];
      a.globalAlpha = Math.max(0, Math.min(1, g.life));
      a.fillStyle = g.color;
      a.fillText(g.text, g.x, g.y);
    }
    a.globalAlpha = 1;
  }

  /* --- 6.5 Частицы: зеркало 1-в-1 (копии на #game подавлены хуком) --- */
  const parts = S.particles || [];
  if (parts.length) {
    a.save();
    a.globalCompositeOperation = 'lighter';
    for (let i = 0; i < parts.length; i++) {
      const m = parts[i];
      a.globalAlpha = Math.max(0, m.life) * .9;
      a.fillStyle = m.color;
      a.fillRect(m.x, m.y, m.size, m.size);
    }
    a.restore();
    a.globalAlpha = 1;
  }

  st.stats.promDrawn = promTotal;   /* v0.0.13: для тестов/отладки */
  st.suppressImg = promRects.length ? promRects : null;
  a.restore(); // shake
}

/* Зеркало F0() из бандла. ВАЖНО: _chargedAt/_chargeCooldown живут в домене
 * Date.now() (эпоха мс) — i0() в бандле ставит их от r=Date.now().
 * v0.0.13 FIX: раньше сюда передавали performance.now() → t<0 → prominence
 * не наступал никогда. Теперь вызывающий передаёт dnow=Date.now(). */
function chargeState (cell, CHG, dnow) {
  const cfg = CHG[cell.type];
  const t = dnow - (cell._chargedAt || 0);
  const dur = ((cfg && cfg.baseDur) || 20) * 1e3;
  if (cell._chargedAt > 0 && t >= 0 && t < dur) return { state: 'prominence', fade: Math.max(0, 1 - t / dur) };
  const cd = (cell._chargeCooldown || 0) - dnow;
  return cd > 0 ? { state: 'cooldown', leftCD: cd } : { state: 'ready' };
}
function anomalySub (cell) {
  const t = cell.anomalyType;
  return (t === 'power' || t === 'resonance') ? t : 'synth';
}
/* css-цвет (#hex/rgb()/hsl()) -> rgba() для 2D-контекста (через THREE.Color:
 * setStyle кладёт линейные компоненты, toSrgb возвращает sRGB 0..255) */
const _rgbaColor = { setStyle: null };
function rgba (css, alpha) {
  try {
    if (!_rgbaColor.setStyle) _rgbaColor.c = new THREE.Color();
    _rgbaColor.c.setStyle(css || '#8ddfff');
    const c = _rgbaColor.c;
    const r = Math.round(clamp(toSrgb(c.r), 0, 1) * 255);
    const g = Math.round(clamp(toSrgb(c.g), 0, 1) * 255);
    const b = Math.round(clamp(toSrgb(c.b), 0, 1) * 255);
    return `rgba(${r},${g},${b},${clamp(alpha, 0, 1)})`;
  } catch (e) { return `rgba(141,223,255,${clamp(alpha, 0, 1)})`; }
}
function toSrgb (x) { return x <= .0031308 ? x * 12.92 : 1.055 * Math.pow(x, 1 / 2.4) - .055; }

/* ----------------------------------------------------------------------------
 * 7. Кадровый цикл (цепляется к штатному __VORONIA_HOOKS.postFrame)
 * --------------------------------------------------------------------------*/
function gated () {
  if (!st.mode || !st.threeOK || st.webglLost) return false;
  if (!S.started || !S.activePlanet) return false;
  if (S.gameIntro) return false;                                 // интро новой игры — играем штатное 2D
  if (S.crashLanding && S.crashLanding.active) return false;     // аварийная посадка — штатная 2D-сцена
  if (document.hidden) return false;
  return true;
}

function frame (now) {
  const dt = st.lastFrameAt ? Math.min(.05, (now - st.lastFrameAt) / 1e3) : 1 / 60;
  st.lastFrameAt = now;
  st.dtAvg = st.dtAvg * .9 + dt * .1;

  const on = gated();
  st.active = on;
  if (!on) {
    st.suppressText = null; st.suppressRect = null; st.suppressImg = null;
    if (st.renderer) st.renderer.domElement.style.visibility = 'hidden';
    if (st.fx) st.fx.style.visibility = 'hidden';
    return;
  }
  /* слои показываются только вместе с активным режимом; наружу не пишем,
   * если значение уже нужное (иначе не отследить принудительное скрытие) */
  if (st.renderer.domElement.style.visibility === 'hidden') st.renderer.domElement.style.visibility = '';
  if (st.fx.style.visibility === 'hidden') st.fx.style.visibility = '';

  const pl = S.activePlanet;
  if (!pl || !pl.cells || !pl.revealed) return;
  resize3D();
  updateCamera();   // зум меняется колесом/щипком/анимацией посадки — каждый кадр

  /* смена планеты (перелёт/сейв/престиж) или откат revealed — полная пересборка */
  if (pl !== st.planetRef || !st.cellMesh) buildPlanet(pl);
  else if (pl.revealed.size < st.appended.size) buildPlanet(pl);
  else if (pl.revealed.size > st.appended.size) {
    appendRevealed(pl, false);
    /* v0.0.11 FIX: низ стенки клетки стоит на верху соседа. Пока сосед не
     * раскрыт, мы считали его высоту = 0 и тянули стенку до базового радиуса.
     * После скана соседа эти стенки устарели (уходят под его плитку / оставляют
     * щель). Высота — это геометрия, поэтому просим пересборку (троттлинг
     * 300 мс в frame()). Только когда стенки включены: на крупных планетах
     * (wallsAboveCells) их нет, и пересборка не нужна. */
    if (st.wallsOn) st.rebuildPending = true;
  }

  /* v0.0.7: отложенная пересборка после изменения высот (троттлинг 300 мс) */
  if (st.rebuildPending && now - st.lastRebuildAt > 300) {
    st.rebuildPending = false;
    st.lastRebuildAt = now;
    buildPlanet(pl);
    return;                       // геометрия пересобрана — рендерим в следующем кадре
  }

  if (st.flashes.size) tickFlashes(pl);
  if (now - st.lastSweep > 400) { st.lastSweep = now; sweepColors(pl); }

  /* вращение/смещение — из штатного состояния (единственный источник истины) */
  st.yawGroup.rotation.y = S.rotY || 0;
  st.pitchGroup.rotation.x = S.rotX || 0;
  if (S.screenShake > 0) {
    const shx = (Math.random() - .5) * S.screenShake, shy = (Math.random() - .5) * S.screenShake;
    const tScale = Math.min(st.W, st.H) * .36 * (S.zoom || 1);
    st.yawGroup.position.set(shx / tScale * R, -shy / tScale * R, 0);
  } else if (st.yawGroup.position.x !== 0 || st.yawGroup.position.y !== 0) {
    st.yawGroup.position.set(0, 0, 0);
  }

  /* атмосферный обод: пульсация в такт 2D-ауре (t/2600) + плавный рост к цели */
  st.atmoShell.material.uniforms.uPower.value = .42 + .14 * (.5 + .5 * Math.sin(now / 2600));
  {
    const target = st.atmoTarget / st.atmoBaseR;
    const cur = st.atmoShell.scale.x;
    if (Math.abs(target - cur) > 1e-4) st.atmoShell.scale.setScalar(cur + (target - cur) * Math.min(1, dt * 3));
    else if (cur !== target) st.atmoShell.scale.setScalar(target);
  }

  st.renderer.render(st.scene, st.camera);

  try { fxFrame(pl); } catch (e) { if (!fxFrame.__e) { fxFrame.__e = 1; warn('fx:', e); } }

  buildSuppressionMaps();

  /* Adaptive quality for the hybrid 2.5D renderer:
   * one tier change after a sustained slow window; never downsample to DPR 1
   * solely to hide a performance issue. If even the reduced tier is too slow,
   * switch to the original native 2D game renderer instead of stuttering. */
  st.fpsBuf.push(dt);
  if (st.fpsBuf.length >= 180) {
    const avg = st.fpsBuf.reduce((x, y) => x + y, 0) / st.fpsBuf.length;
    st.fpsBuf.length = 0;
    if (avg > 1 / 34 && !window.__vor3d.noDegrade) {
      if (!st.degraded) {
        st.degraded = 1; st.W = 0;
        warn('нагрузка повышена — включён облегчённый гибридный слой (DPR до 1.35)');
      } else if (avg > 1 / 26) {
        toast('⚠ Высокая нагрузка — возврат к исходному 2D для плавности');
        toggleMode(false);
      }
    }
  }
}

function installPostFrameHook () {
  const H = window.__VORONIA_HOOKS = window.__VORONIA_HOOKS || {};
  const orig = H.postFrame;
  H.postFrame = function () {
    try { if (orig) orig(); } catch (e) {}
    try { frame(performance.now()); } catch (e) {
      frame.__errs = (frame.__errs || 0) + 1;
      if (frame.__errs < 4) warn('ошибка кадра:', e);
      if (frame.__errs === 30) { warn('слишком много ошибок — откат на 2D'); try { toggleMode(false); } catch (e2) {} }
    }
  };
}

/* ----------------------------------------------------------------------------
 * 8. События шины: мгновенная реакция на действия игрока
 * --------------------------------------------------------------------------*/
function installBus () {
  if (!BUS || !BUS.on) return;
  BUS.on('cell:scanned', ev => {
    try {
      const pl = S.activePlanet;
      if (!pl || (ev && ev.pid && ev.pid !== pl.id)) return;
      if (ev && typeof ev.cellId === 'number') st.flashes.set(ev.cellId, performance.now() + 700);
      if (pl.revealed && pl.revealed.size > st.appended.size) {
        appendRevealed(pl, false);
        /* v0.0.11: низ стенок соседних клеток стоял на h=0 (сосед был не раскрыт)
           — запрашиваем подгонку (троттлинг 300 мс в frame()) */
        if (st.wallsOn) st.rebuildPending = true;
      }
      st.lastSweep = 0;
    } catch (e) {}
  });
  BUS.on('cell:upgraded', ev => {
    try {
      const pl = S.activePlanet;
      if (!pl || !ev || (ev.pid && ev.pid !== pl.id)) return;
      const cid = typeof ev.cellId === 'number' ? ev.cellId : ev.id;
      const cell = pl.cells[cid];
      if (!cell) return;

      /* v0.0.7: level входит в cellHeight, а высота — в геометрию своей клетки
       * И в низ стенок всех соседей. Поэтому при реальном изменении высоты
       * нужна пересборка, а не перекраска. */
      const hs = cellHeightSig(cell);
      if (st.heightSig && st.heightSig[cid] !== hs) {
        st.heightSig[cid] = hs;
        st.rebuildPending = true;
        return;
      }
      if (st.slotOf && st.slotOf.has(cid)) {
        st.sigOf[cid] = -999;   // свип пересчитает сигнатуру
        paintCell(cell, pl, pl.explored.has(cid), isAffordable());
      }
    } catch (e) {}
  });
  BUS.on('cell:discharged', () => { st.lastSweep = 0; });
  BUS.on('save:loaded', () => { st.planetRef = null; });
  BUS.on('planet:discovered', () => { st.lastSweep = 0; });
}

/* ----------------------------------------------------------------------------
 * 9. Отладочный API
 * --------------------------------------------------------------------------*/
window.__vor3d = {
  version: V3D_VERSION,
  noDegrade: false,       // true — отключить авто-деградацию (тесты/отладка)
  get mode () { return st.mode; },
  get active () { return st.active; },
  get threeOK () { return st.threeOK; },
  toggle: () => toggleMode(),
  on: () => toggleMode(true),
  off: () => toggleMode(false),
  rebuild: () => { st.planetRef = null; },
  /* v0.0.11: палитра наружу — для тестов и ручной настройки.
   * __vor3d.geoColors() -> {terrain, byType, resources, blend} */
  geoColors: () => ({
    terrain: st.planetRef ? terrainColorHex(st.planetRef) : null,
    biome: st.planetRef && st.planetRef.biome,
    climate: st.planetRef && st.planetRef.descriptors && st.planetRef.descriptors.climate && st.planetRef.descriptors.climate.id,
    surface: st.planetRef && st.planetRef.descriptors && st.planetRef.descriptors.surface && st.planetRef.descriptors.surface.id,
    arm: (() => { try { const s2 = L.sectorOf && st.planetRef ? L.sectorOf(st.planetRef.id) : null; return s2 && s2.color; } catch (e) { return null; } })(),
    resources: RESOURCE_3D, climateBase: CLIMATE_BASE, surfaceBase: SURFACE_BASE,
    blend: { ARM_TERRAIN_MIX, CLIMATE_BLEND, SURFACE_BLEND, SAT_BOOST },
    rim: { peak: EXTRUDE.rimPeak, width: EXTRUDE.rimWidth, strength: EXTRUDE.rimStrength,
           wallFrom: EXTRUDE.wallRimFrom, wallStrength: EXTRUDE.wallRimStrength },
  }),
  cellColor: (id) => {
    const pl = st.planetRef;
    if (!pl) return null;
    const cell = pl.cells[id];
    if (!cell) return null;
    return { base: cellBaseCSS(cell, pl, pl.explored.has(id), isAffordable()),
             jitter: +cellTintJitter(cell).toFixed(3),
             height: +cellHeight(cell).toFixed(4), type: cell.type,
             resourceKey: cell.resourceKey || null, isDeep: !!cell.isDeep };
  },
  debug: () => ({ st, scene: st.scene, camera: st.camera, renderer: st.renderer, cellMesh: st.cellMesh }),
  info: () => ({
    mode: st.mode, active: st.active, three: st.threeOK, webglLost: st.webglLost,
    planet: st.planetRef && st.planetRef.id,
    cells: st.planetRef && st.planetRef.cells.length,
    revealed: st.appended.size, verts: st.cursor, capacity: st.capacity,
    wallsOn: st.wallsOn, wallVerts: st.wallTotal,
    wallDrawn: (() => { let n = 0; if (st.slotOf) st.slotOf.forEach(s => n += s.wallCount); return n; })(),
    rebuildPending: st.rebuildPending,
    hRange: (() => {
      const pl = st.planetRef;
      if (!pl) return null;
      let lo = Infinity, hi = -Infinity;
      for (const c of pl.cells) { const h = cellHeight(c); if (h < lo) lo = h; if (h > hi) hi = h; }
      return lo === Infinity ? null : [+lo.toFixed(3), +hi.toFixed(3)];
    })(),
    zoomCam: st.camera && +st.camera.zoom.toFixed(4),
    atmo: st.atmoShell ? { base: +st.atmoBaseR.toFixed(3), target: +st.atmoTarget.toFixed(3), scale: +st.atmoShell.scale.x.toFixed(4) } : null,
    dtAvg: +st.dtAvg.toFixed(4), degraded: st.degraded, stats: st.stats,
  }),
};

/* ----------------------------------------------------------------------------
 * 10. Старт
 * --------------------------------------------------------------------------*/
async function boot () {
  injectDOM();
  st.fxc = st.fx.getContext('2d');
  installCtxHooks();
  installPostFrameHook();
  installBus();

  THREE = await loadThree();
  if (!THREE) {
    warn('Three.js не загружен — 3D-слой отключён, игра работает в штатном 2D');
    st.threeOK = false;
    syncControls();
    return;
  }
  try {
    buildScene($id('vor3d'));
    st.threeOK = true;
  } catch (e) {
    warn('WebGL недоступен:', e && e.message);
    st.threeOK = false;
    syncControls();
    return;
  }

  /* режим по умолчанию: сохранённый выбор > (не low-end → вкл) */
  const saved = persisted();
  const on = saved === null ? S.devicePower !== 'low' : saved === '1';
  toggleMode(on);
  log('v' + V3D_VERSION + ' готов' + (on ? ', 3D включён' : ', 2D по умолчанию'));
}

try { await boot(); } catch (e) { warn('boot failed:', e); }

})();

