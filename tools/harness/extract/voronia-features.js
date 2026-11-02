/* ===========================================================================
 * Voronia v0.0.12.0 · внешние модули
 *
 *  · пункт 3 — заморозка реестра VORONIA_BALANCE и синхронизация текстов UI
 *  · пункт 4 — «Следы друга» (ghost-профиль): экспорт/импорт чужого прогресса
 *              и полупрозрачный слой его разведанных клеток на твоей планете
 *  · пункт 5 — 5-й слой «Раскол»: параллельные вселенные (вариант A — отдельные
 *              ключи localStorage), общий пул, Древо Раскола, зёрна 🌠
 *
 * Модуль работает ТОЛЬКО через публичные window.__V.* — внутрь бандла не лезет.
 * Любая ошибка глушится try/catch: новая система не имеет права сломать игру.
 * =========================================================================== */
(function () {
  'use strict';
  var V = window.__V || {};
  var S = V.state || {};
  var L = V.legacy || {};
  var CORE = V.core || {};
  var SAVE = V.save || {};

  /* ---------------------------------------------------------------- utils */
  function bal(path, dflt) {
    try {
      var v = window.__VBALGET(path);
      return v === undefined ? dflt : v;
    } catch (e) { return dflt; }
  }
  function deepFreeze(o) {
    if (!o || typeof o !== 'object' || Object.isFrozen(o)) return o;
    Object.freeze(o);
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) deepFreeze(o[k]);
    return o;
  }
  function $(id) { return document.getElementById(id); }
  /* для страниц справки, собранных в бандле (window.esc2) */
  window.esc2 = window.esc2 || function (s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  };
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(v) { try { return window.fmtBig ? window.fmtBig(v) : String(Math.floor(v)); } catch (e) { return String(v); } }
  function toast(html, kind, ms) { try { window.showToast && window.showToast(html, kind || '', ms || 4000); } catch (e) {} }
  function num(v, d) { v = Number(v); return isFinite(v) ? v : (d || 0); }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function roman(n) {
    var t = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII', 'IX', 'X', 'XI', 'XII'];
    return t[n - 1] || ('#' + n);
  }
  function fnv(str) {
    var h = 2166136261 >>> 0;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  var B64A = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
  function b64enc(str) {
    var bytes = new TextEncoder().encode(str), out = '', i;
    for (i = 0; i < bytes.length; i += 3) {
      var b0 = bytes[i], b1 = bytes[i + 1], b2 = bytes[i + 2];
      out += B64A[b0 >> 2];
      out += B64A[((b0 & 3) << 4) | ((b1 || 0) >> 4)];
      out += b1 === undefined ? '' : B64A[((b1 & 15) << 2) | ((b2 || 0) >> 6)];
      out += b2 === undefined ? '' : B64A[b2 & 63];
    }
    return out;
  }
  function b64dec(str) {
    var bytes = [], i, buf = 0, bits = 0;
    for (i = 0; i < str.length; i++) {
      var v = B64A.indexOf(str[i]);
      if (v < 0) continue;
      buf = (buf << 6) | v; bits += 6;
      if (bits >= 8) { bits -= 8; bytes.push((buf >> bits) & 255); }
    }
    return new TextDecoder().decode(new Uint8Array(bytes));
  }
  function ext(name, dflt) {
    try {
      var e = CORE.extensions || (CORE.extensions = {});
      if (!e[name] || typeof e[name] !== 'object') e[name] = Object.assign({}, dflt || {});
      return e[name];
    } catch (err) { return Object.assign({}, dflt || {}); }
  }
  function lsGet(k) { try { return window.localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { window.localStorage.setItem(k, v); return true; } catch (e) { return false; } }
  function lsDel(k) { try { window.localStorage.removeItem(k); } catch (e) {} }
  function reqSave() { try { window.requestSave ? window.requestSave() : (SAVE.requestSave && SAVE.requestSave()); } catch (e) {} }
  /* Модалки, созданные модулем, надо регистрировать в штатном реестре бандла (Ja,
     доступен как legacy.modals): иначе Xe()/_t() их не прячут, и «Раскол» остаётся
     висеть поверх «Настроек». */
  function registerModal(m) {
    try {
      var arr = L.modals;
      if (arr && typeof arr.push === 'function' && arr.indexOf(m) < 0) arr.push(m);
    } catch (e) {}
  }
  /* штатная запись настроек (exocore_settings_v1) — опубликована бандлом в v0.0.12.0 */
  function saveSettings() { try { window.__V.saveSettings && window.__V.saveSettings(); } catch (e) {} }

  /* ------------------------------------------------- пункт 3: freeze + UI */
  try { deepFreeze(window.VORONIA_BALANCE); } catch (e) {}
  function fillBalSpans() {
    try {
      document.querySelectorAll('[data-bal]').forEach(function (el) {
        var v = bal(el.getAttribute('data-bal'), null);
        if (v != null) el.textContent = String(v).replace('.', ',');
      });
      document.querySelectorAll('[data-bal-pct]').forEach(function (el) {
        var v = bal(el.getAttribute('data-bal-pct'), null);
        if (v != null) el.textContent = String(Math.round(v * 1000) / 10);
      });
    } catch (e) {}
  }

  /* =========================================================================
   * ПУНКТ 4 · «СЛЕДЫ ДРУГА» — ghost-профиль чужой вселенной
   * ========================================================================= */
  var GHOST = (function () {
    var PREFIX = bal('ghost.codePrefix', 'VORGP1');
    function maxCells() { return num(bal('ghost.maxCellsPerPlanet', 400), 400); }
    function maxPlanets() { return num(bal('ghost.maxPlanets', 24), 24); }
    function maxMarks() { return num(bal('ghost.maxMarks', 40), 40); }
    /* тип клетки -> код отметки: 1 = аномалия, 2 = ядро грани, 3 = ячейка исследований */
    function markKind(c) { return c.type === 4 ? 1 : c.type === 7 ? 2 : c.type === 6 ? 3 : 0; }

    function ownSalt() {
      try { if (V.social && V.social.ownSalt) return String(V.social.ownSalt()); } catch (e) {}
      return String((S.gameStartSeed >>> 0).toString(36));
    }
    function guardianLevel(pl) {
      try { if (L.guardianLevelFor) return num(L.guardianLevelFor(pl), 0); } catch (e) {}
      try { return num(pl && pl.boss && pl.boss.guardianLevel, 0); } catch (e2) { return 0; }
    }
    function treeNodesOf(pl) {
      try {
        var pr = L.profileForPlanet ? L.profileForPlanet(pl) : null;
        return Object.keys((pr && pr.treeNodes) || {});
      } catch (e) { return []; }
    }
    function planetRole(pl) {
      try { return (pl && pl.role) || null; } catch (e) { return null; }
    }

    /* ---- нити плетения (уровень 3): seed-пары вместо id, чтобы совпадало
           в любой вселенной; берём из штатного window.ccEchoView ---- */
    function collectWeaves() {
      try {
        var ev = window.ccEchoView;
        if (!ev || typeof ev.weaves !== 'function') return [];
        var w = ev.weaves() || {}, P = L.PLANETS || {}, out = [], cap = num(bal('ghost.maxWeaves', 60), 60);
        for (var t in w) {
          var arr = w[t] || [], tpl = P[t];
          if (!arr.length || !tpl) continue;
          for (var i = 0; i < arr.length && out.length < cap; i++) {
            var s = arr[i];
            if (!s || !s.sourcePid) continue;
            var spl = P[s.sourcePid];
            if (!spl) continue;
            out.push([tpl.seed >>> 0, spl.seed >>> 0, String(s.nodeId || '').slice(0, 24)]);
          }
        }
        return out;
      } catch (e) { return []; }
    }

    /* ---- экспорт ---- */
    function collect() {
      var P = L.PLANETS || {}, out = [], seen = 0;
      var ids = [];
      try {
        if (S.unlockedPlanets && S.unlockedPlanets.forEach) S.unlockedPlanets.forEach(function (x) { ids.push(x); });
        else ids = Object.keys(S.unlockedPlanets || {});
      } catch (e) { ids = []; }
      for (var i = 0; i < ids.length && seen < maxPlanets(); i++) {
        var pid = ids[i], pl = P[pid];
        if (!pl) continue;
        var ex = [];
        try {
          if (pl.explored && pl.explored.forEach) pl.explored.forEach(function (c) { ex.push(num(c, 0)); });
        } catch (e2) {}
        ex.sort(function (a, b) { return a - b; });
        /* уровень 4: где друг нашёл аномалии / ядра / исследовательские ячейки */
        var an = [];
        try {
          ex.forEach(function (id) {
            if (an.length >= maxMarks()) return;
            var c = pl.cells[id];
            if (!c) return;
            var k = markKind(c);
            if (k) an.push([num(id, 0), k]);
          });
        } catch (e3) {}
        out.push({
          id: String(pid), sd: (pl.seed >>> 0), ip: num(pl.planetIndex, 0),
          ex: ex.slice(0, maxCells()), tn: treeNodesOf(pl).slice(0, 120),
          an: an, rl: planetRole(pl), gl: guardianLevel(pl),
          nm: String(pl.name || pid).slice(0, 24)
        });
        seen++;
      }
      return {
        v: 1, s: ownSalt(), ts: Date.now(), seed: (S.gameStartSeed >>> 0),
        nick: 'Исследователь ' + String((S.gameStartSeed >>> 0) % 997).padStart(3, '0'),
        planets: out,
        worlds: out.length,
        cycles: num(S.totalPrestiges, 0), meta: num(S.metaPrestiges, 0),
        essence: Math.floor(num(S.essenceTotal, 0)),
        wv: collectWeaves(),
        story: (function () { try { return L.echoStoryCount ? num(L.echoStoryCount(), 0) : 0; } catch (e) { return 0; } })(),
        weaves: (function () { try { var w = L.echoWeaveState ? L.echoWeaveState() : null; return num(w && w.totalWeaves, 0); } catch (e) { return 0; } })()
      };
    }
    function exportProfile() {
      try {
        var data = collect(), json = JSON.stringify(data);
        var body = b64enc(json), chk = fnv(PREFIX + '|' + body).toString(36).slice(0, 5).toUpperCase();
        return PREFIX + '-' + body + '-' + chk;
      } catch (e) { return ''; }
    }
    function profileSize(code) { return String(code || '').length; }

    /* ---- импорт ---- */
    function parseProfile(code) {
      try {
        var c = String(code || '').trim().replace(/\s+/g, '');
        if (!c) return { ok: false, error: 'пусто' };
        var m = c.match(/^([A-Z0-9]+)-([A-Za-z0-9_\-]+)-([A-Z0-9]{4,6})$/);
        if (!m) return { ok: false, error: 'не похоже на код профиля (ожидается ' + PREFIX + '-…)' };
        if (m[1] !== PREFIX) return { ok: false, error: 'неверный формат: ' + m[1] };
        var expect = fnv(m[1] + '|' + m[2]).toString(36).slice(0, 5).toUpperCase();
        if (expect !== m[3].toUpperCase()) return { ok: false, error: 'код повреждён (контрольная сумма не сошлась)' };
        var data = JSON.parse(b64dec(m[2]));
        if (!data || data.v !== 1 || !Array.isArray(data.planets)) return { ok: false, error: 'неизвестная версия профиля' };
        data.planets = data.planets.filter(function (p) { return p && Array.isArray(p.ex); }).slice(0, maxPlanets());
        data.planets.forEach(function (p) {
          p.ex = p.ex.map(function (x) { return num(x, 0); }).slice(0, maxCells());
          if (!Array.isArray(p.an)) p.an = [];
          p.an = p.an.filter(function (x) { return Array.isArray(x) && x.length === 2 && isFinite(x[0]) && isFinite(x[1]) && x[1] >= 1 && x[1] <= 3; })
            .slice(0, num(bal('ghost.maxMarks', 40), 40));
        });
        /* нити плетения: только тройки [seedЦели, seedИсточника, idУзла] */
        if (!Array.isArray(data.wv)) data.wv = [];
        data.wv = data.wv.filter(function (x) {
          return Array.isArray(x) && x.length === 3 && isFinite(x[0]) && isFinite(x[1]) && typeof x[2] === 'string';
        }).slice(0, num(bal('ghost.maxWeaves', 60), 60));
        return { ok: true, data: data, bytes: c.length };
      } catch (e) { return { ok: false, error: 'не удалось разобрать: ' + (e && e.message || e) }; }
    }
    function st() { return ext('friendProfile_v1', { data: null, loadedAt: 0 }); }
    function loadFriend(code) {
      var r = parseProfile(code);
      if (!r.ok) return { ok: false, msg: r.error };
      if (String(r.data.s) === ownSalt()) return { ok: false, msg: 'это твой собственный профиль — следы друга не нужны' };
      var e = st();
      e.data = r.data; e.loadedAt = Date.now();
      reqSave();
      toast('👁 <b>Следы друга загружены</b><br><span style="font-size:11px;color:#91adbb;">' +
        esc(r.data.nick || 'Исследователь') + ' · миров: ' + r.data.planets.length +
        ' · слой включён на карте планеты</span>', 'success', 7000);
      try { V.bus && V.bus.emit && V.bus.emit('ghost:loaded', { worlds: r.data.planets.length }); } catch (e2) {}
      return { ok: true, worlds: r.data.planets.length, nick: r.data.nick };
    }
    function clearFriend() {
      var e = st(); e.data = null; e.loadedAt = 0; reqSave();
      toast('👁 Следы друга убраны', '', 2600);
      return { ok: true };
    }
    function friendState() {
      var e = st(), d = e.data;
      if (!d) return { loaded: false, nick: null, worlds: 0, cells: 0, nodes: 0, at: 0 };
      var cells = 0, nodes = 0;
      d.planets.forEach(function (p) { cells += p.ex.length; nodes += (p.tn || []).length; });
      return { loaded: true, nick: d.nick, worlds: d.planets.length, cells: cells, nodes: nodes, at: e.loadedAt || 0, seed: d.seed };
    }
    function matchPlanet(pl) {
      var d = st().data;
      if (!d || !pl) return null;
      var seed = pl.seed >>> 0, i;
      for (i = 0; i < d.planets.length; i++) if ((d.planets[i].sd >>> 0) === seed) return d.planets[i];
      for (i = 0; i < d.planets.length; i++) if (d.planets[i].id === String(pl.id)) return d.planets[i];
      return null;
    }

    /* ---- слой на карте ---- */
    function overlay() {
      var e = st();
      if (!e.data || !S.started || !S.activePlanet) return 0;
      if (S.settings && S.settings.ghostLayer === false) return 0;
      var cv = document.getElementById('game');
      if (!cv) return 0;
      var ctx = cv.getContext('2d');
      if (!ctx) return 0;
      var pl = S.activePlanet, f = matchPlanet(pl);
      if (!f || !f.ex || !f.ex.length) return 0;
      var want = {}; for (var i = 0; i < f.ex.length; i++) want[f.ex[i]] = 1;
      var proj = L.project, color = bal('ghost.color', '#c084fc');
      var maxDraw = num(bal('ghost.maxDraw', 140), 140);
      var baseA = num(bal('ghost.alpha', .16), .16);
      var t = performance.now() / 900, drawn = 0;
      ctx.save();
      try { var _dprG = Math.min(window.devicePixelRatio || 1, 2); ctx.setTransform(_dprG, 0, 0, _dprG, 0, 0); } catch (e2) {}
      for (var cid = 0; cid < pl.cells.length && drawn < maxDraw; cid++) {
        var c = pl.cells[cid];
        if (!c || !want[c.id]) continue;
        if (pl.explored && pl.explored.has && pl.explored.has(c.id)) continue;   // у тебя уже есть
        if (pl.revealed && pl.revealed.has && !pl.revealed.has(c.id)) continue;  // не спойлерим неразведанное
        var polys = c._polys || (c.poly ? [c.poly] : null);
        if (!polys || !polys.length) continue;
        var painted = false;
        for (var pi = 0; pi < polys.length; pi++) {
          var poly = polys[pi];
          if (!poly || poly.length < 3) continue;
          var pts = [], ok = true;
          for (var k = 0; k < poly.length; k++) {
            var p = proj(poly[k]);
            if (!p || p.z <= 0) { ok = false; break; }
            pts.push(p);
          }
          if (!ok) continue;
          ctx.globalAlpha = clamp(baseA + .05 * Math.sin(t + cid), .05, .4);
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.moveTo(pts[0].x, pts[0].y);
          for (k = 1; k < pts.length; k++) ctx.lineTo(pts[k].x, pts[k].y);
          ctx.closePath();
          ctx.fill();
          ctx.globalAlpha = clamp(baseA * 2.4, .1, .6);
          ctx.strokeStyle = color;
          ctx.lineWidth = 1;
          ctx.stroke();
          painted = true;
        }
        if (!painted) continue;
        drawn++;
      }
      /* уровень 4: отметки на чужих аномалиях / ядрах (рисуем по центроидам) */
      var marks = 0;
      if (Array.isArray(f.an) && f.an.length && !(S.settings && S.settings.ghostMarks === false)) {
        var colors = bal('ghost.markColors', ['#ffd27a', '#ff8c8c', '#7ec9e8']);
        var rad = num(bal('ghost.markRadius', 7), 7);
        var ma = clamp(num(bal('ghost.markAlpha', .5), .5), .1, .9);
        for (var mi = 0; mi < f.an.length && marks < maxDraw; mi++) {
          var mc = pl.cells[f.an[mi][0]];
          if (!mc || !mc.center) continue;
          if (pl.revealed && pl.revealed.has && !pl.revealed.has(mc.id)) continue;   // не спойлерим
          var cp = proj(mc.center);
          if (!cp || cp.z <= 0) continue;                                            // обратная сторона
          ctx.globalAlpha = ma;
          ctx.strokeStyle = colors[clamp(num(f.an[mi][1], 1) - 1, 0, 2)] || colors[0];
          ctx.lineWidth = 1.2;
          ctx.beginPath();
          ctx.arc(cp.x, cp.y, rad, 0, Math.PI * 2);
          ctx.stroke();
          ctx.globalAlpha = clamp(ma * 1.3, .1, .95);
          ctx.beginPath();
          ctx.arc(cp.x, cp.y, 1.6, 0, Math.PI * 2);
          ctx.fillStyle = ctx.strokeStyle;
          ctx.fill();
          marks++;
        }
      }
      _marksDrawn = marks;
      _lastDrawn = drawn;                 // для тестов: сколько клеток слоя нарисовано
      _weavesDrawn = _weavesDrawn;        // (дуги считает drawFriendArcs)
      ctx.restore();
      return drawn;
    }
    var _marksDrawn = 0, _lastDrawn = 0, _weavesDrawn = 0;

    /* ---- уровень 3: дуги чужого плетения на 3D-карте галактики ---- */
    function drawFriendArcs(projected) {
      try {
        var e = st();
        if (!e.data || !Array.isArray(e.data.wv) || !e.data.wv.length) return 0;
        if (S.settings && S.settings.ghostWeaveLayer === false) return 0;
        if (!projected) return 0;
        var cv = document.getElementById('cc-map-canvas');
        if (!cv) return 0;
        var ctx = cv.getContext('2d');
        if (!ctx) return 0;
        var P = L.PLANETS || {}, map = {}, pid;
        for (pid in P) {
          var pl = P[pid];
          if (pl && S.unlockedPlanets && S.unlockedPlanets.has(pid)) map[pl.seed >>> 0] = pid;
        }
        var col = String(bal('ghost.weaveColor', '192,132,252'));
        var a0 = clamp(num(bal('ghost.weaveAlpha', .22), .22), .04, .6);
        var dash = bal('ghost.weaveDash', [3, 5]);
        var n = 0;
        ctx.save();
        try { ctx.setLineDash(Array.isArray(dash) ? dash : [3, 5]); } catch (e2) {}
        ctx.lineWidth = 1;
        for (var i = 0; i < e.data.wv.length; i++) {
          var w = e.data.wv[i];
          var pa = projected[map[w[0]]], pb = projected[map[w[1]]];
          if (!pa || !pb) continue;                       // этих миров у меня нет — не рисуем
          var mx = (pa.x + pb.x) / 2;
          var my = (pa.y + pb.y) / 2 - Math.hypot(pa.x - pb.x, pa.y - pb.y) * 0.22;  // та же геометрия, что у своих дуг
          ctx.strokeStyle = 'rgba(' + col + ',' + a0.toFixed(3) + ')';
          ctx.beginPath();
          ctx.moveTo(pa.x, pa.y);
          ctx.quadraticCurveTo(mx, my, pb.x, pb.y);
          ctx.stroke();
          n++;
        }
        ctx.restore();
        return n;
      } catch (err) { return 0; }
    }
    function weaveCount() { var d = st().data; return d && Array.isArray(d.wv) ? d.wv.length : 0; }

    /* ---- раздел в панели планеты ---- */
    function panelSectionHtml(pid) {
      try {
        if (S.planetPage !== 0) return '';
        var e = st(); if (!e.data) return '';
        var pl = (L.PLANETS || {})[pid || S.activePlanetId];
        var f = matchPlanet(pl);
        if (!f) return '';
        var mine = {};
        try { L.planetTreeNodes(pid || S.activePlanetId).forEach(function (n) { mine[n.id] = 1; }); } catch (e3) {}
        var ahead = (f.tn || []).filter(function (id) { return !mine[id]; });
        var mineExpl = 0;
        try { mineExpl = pl && pl.explored ? pl.explored.size : 0; } catch (e4) {}
        var color = bal('ghost.color', '#c084fc');
        return '' +
          '<div class="planet-panel-section" style="border-color:' + color + '55;">' +
          '<h4 style="color:' + color + ';margin:0 0 6px;">👁 Следы друга · ' + esc(e.data.nick || 'Исследователь') + '</h4>' +
          '<div class="planet-panel-row"><span>Разведано им здесь</span><b>' + f.ex.length + ' клеток</b></div>' +
          '<div class="planet-panel-row"><span>У тебя на этой грани</span><b>' + mineExpl + '</b></div>' +
          '<div class="planet-panel-row"><span>Хранитель у него</span><b>ур. ' + num(f.gl, 0) + '</b></div>' +
          '<div class="planet-panel-row"><span>Роль грани</span><b>' + esc(f.rl || '—') + '</b></div>' +
          (ahead.length ? '<div style="margin-top:6px;font-size:10px;color:#91adbb;line-height:1.4;">Узлы, которые он изучил, а ты — нет: <b style="color:' + color + '">' + ahead.slice(0, 8).join(', ') + '</b>' + (ahead.length > 8 ? ' …+' + (ahead.length - 8) : '') + '</div>' : '<div style="margin-top:6px;font-size:10px;color:#73c76b;">Ты догнал его по узлам дерева на этой грани.</div>') +
          '<div style="margin-top:6px;font-size:9px;color:#6f8390;">Слой ничего не даёт — только показывает, где искал другой Ткач.</div>' +
          '</div>';
      } catch (err) { return ''; }
    }

    /* ---- блок в модалке «Обмен» ---- */
    function GHOST_WEAVES() { try { return weaveCount(); } catch (e) { return 0; } }
    function socialSectionHtml() {
      var f = friendState();
      return '' +
        '<div class="soc-sec">' +
        '<div class="soc-head">👁 Следы друга</div>' +
        '<div class="soc-desc">Профиль-след — это компактный слепок твоей вселенной (миры, разведанные клетки, узлы дерева). Никаких ресурсов: друг видит только <i>следы</i>, а не прогресс. Загрузи чужой — и на карте планеты появится фиолетовый слой его разведки.</div>' +
        '<button class="soc-btn" id="soc-ghost-export" type="button">СКОПИРОВАТЬ СВОЙ ПРОФИЛЬ-СЛЕД' + (f.loaded ? '' : '') + '</button>' +
        '<div class="soc-stat" id="soc-ghost-size">размер: —</div>' +
        '<div class="soc-redeem-row">' +
        '<input class="soc-input" id="soc-ghost-input" type="text" placeholder="' + PREFIX + '-…" autocomplete="off" spellcheck="false">' +
        '<button class="soc-btn" id="soc-ghost-load" type="button">ЗАГРУЗИТЬ СЛЕДЫ</button>' +
        '</div>' +
        '<div class="soc-result" id="soc-ghost-result"></div>' +
        (f.loaded
          ? '<div class="soc-stat">Загружен: <b>' + esc(f.nick || '—') + '</b> · миров ' + f.worlds + ' · клеток ' + f.cells + ' · узлов ' + f.nodes + ' · нитей ' + GHOST_WEAVES() + '<br>' +
            '<button class="soc-btn small" id="soc-ghost-clear" type="button" style="margin-top:6px;">УБРАТЬ СЛЕДЫ ДРУГА</button></div>'
          : '<div class="soc-stat">Следы друга не загружены — слой на карте выключен.</div>') +
        '</div>';
    }
    function wireSocial(root) {
      try {
        root = root || document;
        var ex = root.getElementById ? root.getElementById('soc-ghost-export') : null;
        var btn = ex || document.getElementById('soc-ghost-export');
        if (btn) btn.addEventListener('click', function () {
          var code = exportProfile();
          var sz = document.getElementById('soc-ghost-size');
          if (sz) sz.textContent = 'размер: ' + (code.length / 1024).toFixed(1) + ' КБ · миров: ' + collect().planets.length;
          var okc = false;
          try { okc = !!(navigator.clipboard && navigator.clipboard.writeText); navigator.clipboard && navigator.clipboard.writeText(code).catch(function () {}); } catch (e) {}
          if (!okc) { try { var ta = document.createElement('textarea'); ta.value = code; ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); } catch (e2) {} }
          toast('👁 <b>Профиль-след скопирован</b><br><span style="font-size:11px;color:#91adbb;">' + (code.length / 1024).toFixed(1) + ' КБ — можно отправить в чат или сохранить файлом</span>', 'success', 6000);
        });
        var lb = document.getElementById('soc-ghost-load');
        if (lb) lb.addEventListener('click', function () {
          var inp = document.getElementById('soc-ghost-input'), res = document.getElementById('soc-ghost-result');
          var r = loadFriend(inp ? inp.value : '');
          if (res) { res.textContent = r.ok ? '✔ Следы загружены: ' + (r.worlds || 0) + ' миров' : '✘ ' + (r.msg || 'ошибка'); res.className = 'soc-result ' + (r.ok ? 'ok' : 'bad'); }
          if (r.ok) setTimeout(function () { try { document.getElementById('action-social') && V.social && refreshSocial(); } catch (e) {} }, 400);
        });
        var cb = document.getElementById('soc-ghost-clear');
        if (cb) cb.addEventListener('click', function () { clearFriend(); refreshSocial(); });
      } catch (e) {}
    }
    /* перерисовка модалки обмена штатным рендером игры (Hc() вызывается из
       обработчика #action-social) — свой HTML-дифф не городим */
    function refreshSocial() {
      try {
        var b = document.getElementById('action-social');
        if (b && typeof b.click === 'function') b.click();
      } catch (e) {}
    }

    /* тестовый «чужой» профиль — для проверки слоя без второго браузера */
    function makeForeignSample() {
      var d = collect();
      d.s = ownSalt() + '-friend';
      d.nick = 'Тестовый Ткач';
      d.planets = d.planets.map(function (p) {
        return Object.assign({}, p, { ex: p.ex.slice(0, 12).concat([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter(function (x) { return p.ex.indexOf(x) < 0; })), gl: num(p.gl, 0) + 1, tn: (p.tn || []).slice(0, 3).concat(['tem_growth', 'frz_arch']) });
      });
      var body = b64enc(JSON.stringify(d));
      var chk = fnv(PREFIX + '|' + body).toString(36).slice(0, 5).toUpperCase();
      return PREFIX + '-' + body + '-' + chk;
    }

    return {
      exportProfile: exportProfile, parseProfile: parseProfile, loadFriend: loadFriend,
      clearFriend: clearFriend, friendState: friendState, overlay: overlay,
      panelSectionHtml: panelSectionHtml, socialSectionHtml: socialSectionHtml, wireSocial: wireSocial,
      drawFriendArcs: drawFriendArcs, weaveCount: weaveCount, collectWeaves: collectWeaves,
      marksDrawn: function () { return _marksDrawn; }, markKind: markKind,
      lastDrawn: function () { return _lastDrawn; }, weavesDrawn: function () { return _weavesDrawn; },
      __setWeavesDrawn: function (k) { _weavesDrawn = Math.max(_weavesDrawn, num(k, 0)); },
      matchPlanet: function (pid) { return matchPlanet((L.PLANETS || {})[pid || S.activePlanetId]); },
      makeForeignSample: makeForeignSample, size: profileSize, PREFIX: PREFIX
    };
  })();
  window.__VORONIA_GHOST = GHOST;

  /* =========================================================================
   * ПУНКТ 5 · «РАСКОЛ» — параллельные вселенные (вариант A: отдельные ключи)
   * ========================================================================= */
  var SHARDS = (function () {
    var KEY = 'cosmicClickerV19';           // активная вселенная — ключ игры (не трогаем семантику)
    var SHARED = 'cosmicClickerV19_shared'; // общий слой: пул, зёрна, древо, список вселенных
    var SWAPBAK = 'cosmicClickerV19_swapbak';
    var TREE = function () { return bal('shards.tree', {}) || {}; };

    /* Летопись Раскола — записи живут в ОБЩЕМ слое (переживают перелёты между
       вселенными), иначе в новом мире журнал был бы пуст. */
    var SHARD_CHRONICLES = [
      { id: 'first_split', title: 'Первый раскол',
        text: 'Ты не разбил Воронию — она уже была расколота. Ты лишь позволил одной из её граней отделиться снова. Между швом осталось твоё имя.',
        when: function (d) { return num(d.stats.splits, 0) >= 1; } },
      { id: 'first_switch', title: 'Шаг через шов',
        text: 'Ты прошёл между мирами, не выходя из них. Раньше так ходили только Хранители — и не все возвращались.',
        when: function (d) { return num(d.stats.switches, 0) >= 1; } },
      { id: 'first_pool', title: 'Общий банк',
        text: 'Эссенция перестала быть твоей. Она потекла между гранями — и у Воронии снова появилось сердце, а не только склады.',
        when: function (d) { return num(d.stats.essenceMoved, 0) > 0; } },
      { id: 'first_dust', title: 'Мост пыли',
        text: 'Пыль чужой вселенной легла на твои ладони. Треть её осталась в шве — как плата за то, что миры больше не одиноки.',
        when: function (d) { return num(d.stats.dustMoved, 0) > 0; } },
      { id: 'first_anchor', title: 'Якорь Ткача',
        text: 'Три узла перешли через шов и прижились. Дерево одной грани узнало почерк другой — и не отвернулось.',
        when: function (d) { return num(d.stats.anchorApplied, 0) >= 1; } },
      { id: 'three_universes', title: 'Три шва',
        text: 'Три вселенные — три дыхания. Ты держишь их одновременно, как Ворония когда-то держала себя целиком.',
        when: function (d) { return d.universes.length + d.absorbed.length >= 3; } },
      { id: 'first_absorb', title: 'Поглощение',
        text: 'Ты стянул одну вселенную в другую. Не ради знания — ради того, чтобы обе продолжали дышать. Это не слияние. Это прощение.',
        when: function (d) { return d.absorbed.length >= 1; } },
      { id: 'fabric', title: 'Ткань реальности',
        text: 'Швы перестали быть ранами. Они стали нитями: все твои миры теперь тянут добычу из одного и того же полотна.',
        when: function (d) { return num(d.tree.weaveFabric, 0) > 0; } },
      { id: 'membrane', title: 'Мембрана',
        text: 'Хранители за швом бьются вполсилы — они чуют, что по ту сторону есть кто-то ещё, и не хотят ломать чужую работу.',
        when: function (d) { return num(d.tree.membrane, 0) > 0; } },
      { id: 'synth', title: 'Синтез зёрен',
        text: 'Зерно Раскола перестало быть наградой и стало материалом. Ты вырастил из него семя — и оно проросло в доход всех миров.',
        when: function (d) { return num(d.synthSeeds, 0) >= 1; } },
      { id: 'five_slots', title: 'Полное плетение',
        text: 'Пять слотов — это уже не разлом. Это ткань. То, что когда-то рассыпалось, ты собрал заново: не в одно, а в пять.',
        when: function (d) { return d.universes.length >= 5; } },
      { id: 'rich_pool', title: 'Сердце в банке',
        text: 'В общем пуле больше ста тысяч эссенции. Миры за швом больше не спорят о ресурсах — они просто берут и возвращают.',
        when: function (d) { return num(d.essencePool, 0) >= 1e5; } }
    ];

    function blank() {
      return {
        v: 1, activeId: 'u1', slots: 2, seeds: 0, essencePool: 0, dustPool: 0, shardPool: 0,
        synthSeeds: 0, tree: {}, universes: [], absorbed: [], achievements: {},
        pendingAnchor: null, pendingNewGame: null, transfers: {}, log: [], chronicle: [],
        stats: { splits: 0, switches: 0, absorptions: 0, essenceMoved: 0, dustMoved: 0, anchorApplied: 0 },
        createdAt: Date.now()
      };
    }
    function read() {
      var d = null;
      try { d = JSON.parse(lsGet(SHARED) || 'null'); } catch (e) { d = null; }
      if (!d || typeof d !== 'object' || d.v !== 1) d = blank();
      d.tree = d.tree || {}; d.universes = Array.isArray(d.universes) ? d.universes : [];
      d.absorbed = Array.isArray(d.absorbed) ? d.absorbed : []; d.achievements = d.achievements || {};
      d.stats = d.stats || blank().stats; d.transfers = d.transfers || {};
      d.chronicle = Array.isArray(d.chronicle) ? d.chronicle : [];
      d.stats.anchorApplied = num(d.stats.anchorApplied, 0);
      if (!d.universes.length) d.universes.push(mkUniverse('u1', (S.gameStartSeed >>> 0) || 1));
      if (!d.activeId) d.activeId = d.universes[0].id;
      return d;
    }
    var _inChron = false, _chronToast = true;
    /* write(), после которого НЕ показываем тост Летописи: вызывающий код
       (split/absorb/switchTo/buy/synth/deposit/withdraw) тостит сам, иначе
       получалось два тоста подряд на одно действие. */
    function writeQuiet(d) { _chronToast = false; try { return write(d); } finally { _chronToast = true; } }
    function write(d) {
      _cache = null;
      var ok = lsSet(SHARED, JSON.stringify(d));
      /* Летопись проверяется после ЛЮБОЙ записи общего слоя — иначе запись о расколе
         появлялась бы только на 20-секундном тике. Флаг защищает от рекурсии:
         checkChronicles() сам вызывает write(). */
      if (!_inChron) { _inChron = true; try { checkChronicles(d); } catch (e) {} _inChron = false; }
      return ok;
    }
    /* кэш: incomeMult()/guardianHpMult() вызываются из ce() и боя — localStorage
       каждый раз дёргать нельзя (JSON.parse на каждый пересчёт дохода) */
    var _cache = null, _cacheAt = 0;
    function readCached() {
      var t = Date.now();
      if (_cache && t - _cacheAt < num(bal('shards.cacheMs', 2000), 2000)) return _cache;
      _cache = read(); _cacheAt = t; return _cache;
    }
    function mkUniverse(id, seed) {
      return {
        id: id, label: 'Вселенная ' + roman(Number(String(id).replace('u', '')) || 1),
        seed: seed >>> 0, key: KEY + '_' + id, createdAt: Date.now(), lastPlayedAt: 0,
        worlds: 0, cycles: 0, meta: 0, essenceTotal: 0, hasSave: false, note: ''
      };
    }
    function active(d) {
      d = d || read();
      for (var i = 0; i < d.universes.length; i++) if (d.universes[i].id === d.activeId) return d.universes[i];
      return d.universes[0];
    }
    function byId(d, id) { for (var i = 0; i < d.universes.length; i++) if (d.universes[i].id === id) return d.universes[i]; return null; }
    function index(d, id) { for (var i = 0; i < d.universes.length; i++) if (d.universes[i].id === id) return i; return -1; }
    function treeCount(d, id) { return num(d.tree && d.tree[id], 0); }
    function has(d, id) { return treeCount(d, id) > 0; }
    function nodeCost(d, id) {
      var n = TREE()[id]; if (!n) return null;
      var c = num(n.cost, 0);
      if (n.repeatable) c = Math.round(c * Math.pow(num(n.costGrowth, 2), treeCount(d, id)));
      return c;
    }
    function slots(d) { return 2 + treeCount(d, 'seamSlot'); }

    /* ---- синхронизация метаданных активной вселенной ---- */
    var _lastSyncSig = '';
    function syncFromGame(force) {
      try {
        var d = read(), u = active(d);
        if (!u) return d;
        u.seed = (S.gameStartSeed >>> 0) || u.seed;
        u.worlds = (function () { try { return S.unlockedPlanets ? (S.unlockedPlanets.size || Object.keys(S.unlockedPlanets).length) : 0; } catch (e) { return 0; } })();
        u.cycles = num(S.totalPrestiges, 0); u.meta = num(S.metaPrestiges, 0);
        u.essenceTotal = Math.floor(num(S.essenceTotal, 0));
        u.lastPlayedAt = Date.now();
        u.hasSave = !!lsGet(KEY);
        if (has(d, 'sharedAch')) {
          var a = S.unlockedAchievements || {}, k;
          for (k in a) if (a[k]) d.achievements[k] = 1;
        }
        /* пишем только если что-то реально изменилось: иначе каждые 20 с
           уходил бы JSON.stringify + localStorage.setItem впустую */
        /* lastPlayedAt округлён до минуты: иначе сигнатура менялась бы каждый вызов
           и смысл «не писать впустую» терялся */
        var sig = [u.seed, u.worlds, u.cycles, u.meta, u.essenceTotal, u.hasSave ? 1 : 0,
          Object.keys(d.achievements).length, d.universes.length, Math.floor(Date.now() / 6e4)].join('|');
        if (!force && sig === _lastSyncSig) { checkChronicles(d); return d; }
        _lastSyncSig = sig;
        write(d);
        checkChronicles(d);
        return d;
      } catch (e) { return null; }
    }
    /* ---- Летопись Раскола: проверить условия и дописать записи ---- */
    function checkChronicles(d0) {
      try {
        var d = d0 || read();
        d.chronicle = d.chronicle || [];
        var have = {};
        d.chronicle.forEach(function (c) { if (c && c.id) have[c.id] = 1; });
        var added = 0;
        for (var i = 0; i < SHARD_CHRONICLES.length; i++) {
          var ch = SHARD_CHRONICLES[i];
          if (have[ch.id]) continue;
          var okc = false;
          try { okc = !!ch.when(d); } catch (e) { okc = false; }
          if (!okc) continue;
          var _au = active(d);
          d.chronicle.push({
            id: ch.id, at: Date.now(),
            u: (d.activeId || (_au && _au.id) || 'u1'),
            ul: (_au && _au.label) || 'Вселенная I',
            snap: { seeds: Math.floor(num(d.seeds, 0)), universes: d.universes.length, absorbed: d.absorbed.length, pool: Math.floor(num(d.essencePool, 0)) }
          });
          have[ch.id] = 1; added++;
          if (_chronToast) toast('📜 <b>Летопись Раскола</b><br><span style="font-size:11px;color:#cdb8e8;font-style:italic;">' + esc(ch.title) + '</span>', 'success', 7000);
        }
        if (added) {
          d.chronicle = d.chronicle.slice(-num(bal('shards.chronicleMax', 40), 40));
          write(d);
        }
        return added;
      } catch (e) { return 0; }
    }
    function chronicle() {
      var d = read();
      var got = {};
      (d.chronicle || []).forEach(function (c) { got[c.id] = c; });
      return SHARD_CHRONICLES.map(function (ch) {
        var e = got[ch.id];
        return { id: ch.id, title: ch.title, text: ch.text, unlocked: !!e, at: e ? e.at : null, snap: e ? e.snap : null, u: e ? e.u : null, ul: e ? e.ul : null };
      });
    }
    /* шапка Летописи Плетения, когда активна вкладка «Расколы» (патч K2 в бандле) */
    function chronicleHeaderHtml() {
      try {
        var d = read(), list = chronicle(), open = list.filter(function (x) { return x.unlocked; }).length;
        var lastU = null;
        (d.chronicle || []).forEach(function (c) { if (c && c.ul) lastU = c.ul; });
        return '<div style="font-size:11px;color:#cdd9e1;">Записей Летописи Раскола: <b style="color:#ffd27a;">' +
          open + '/' + list.length + '</b><br>' +
          '<span style="font-size:10px;color:#7f9aa8;">Вселенных: ' + d.universes.length + ' · зёрен 🌠 ' + fmt(d.seeds) +
          (lastU ? ' · последняя запись: ' + esc(lastU) : '') + '</span></div>';
      } catch (e) { return ''; }
    }
    function chronicleHtml() {
      try {
        var d = read(), list = chronicle(), open = list.filter(function (x) { return x.unlocked; }).length;
        var h = '<div style="font-size:11px;color:#91adbb;line-height:1.55;margin-bottom:10px;text-align:center">' +
          'Записей Летописи Раскола: <b style="color:#ffd27a">' + open + '/' + list.length + '</b><br>' +
          '<span style="font-size:10px;color:#7f9aa8">Вселенных: ' + d.universes.length + ' · зёрен 🌠 ' + fmt(d.seeds) +
          ' · пул 🌌 ' + fmt(d.essencePool) + '</span></div>';
        list.forEach(function (x, i) {
          if (!x.unlocked) {
            h += '<div style="padding:10px 12px;margin-bottom:6px;background:#0a1620;border:1px dashed #3a4a55;border-radius:10px;opacity:.55">' +
              '<div style="display:flex;align-items:baseline;gap:8px"><span style="font-size:12px;color:#7f9aa8;font-weight:800">🔒 Шов ' +
              String(i + 1).padStart(2, '0') + '</span><span style="font-size:9px;color:#566a78;margin-left:auto">событие ещё не случилось</span></div></div>';
            return;
          }
          var dt = new Date(x.at);
          h += '<div style="padding:11px 13px;margin-bottom:8px;background:linear-gradient(180deg,rgba(90,60,20,.35),rgba(35,20,10,.15));border:1px solid #ffd27a;border-radius:10px;position:relative;overflow:hidden">' +
            '<div style="position:absolute;top:0;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,#ffd27a,transparent);opacity:.6"></div>' +
            '<div style="display:flex;align-items:baseline;gap:8px;margin-bottom:5px">' +
            '<span style="font-size:9px;color:#a08b6a;font-family:monospace">FIG. ' + String(i + 1).padStart(2, '0') + '</span>' +
            '<span style="font-size:13px;font-weight:900;color:#ffe9c4;letter-spacing:.3px">' + esc(x.title) + '</span>' +
            '<span style="font-size:8px;color:#566a78;margin-left:auto;font-family:monospace">' + dt.toLocaleDateString('ru-RU') + '</span></div>' +
            '<div style="font-size:11px;color:#e8d6b8;line-height:1.55;font-style:italic">' + esc(x.text) + '</div>' +
            (x.snap ? '<div style="font-size:9px;color:#7f9aa8;margin-top:5px;font-family:monospace">' + esc(x.ul || 'Вселенная I') + ' · на тот момент: ' + x.snap.universes + ' вселенных · ' + x.snap.seeds + ' 🌠 · пул ' + fmt(x.snap.pool) + '</div>' : '') +
            '</div>';
        });
        return h;
      } catch (e) { return '<div style="font-size:11px;color:#ff9e9e">Летопись Раскола недоступна</div>'; }
    }
    function openChronicle() {
      try {
        var m = $('shard-chronicle-modal');
        if (!m) {
          m = document.createElement('div');
          m.id = 'shard-chronicle-modal';
          m.className = 'modal';
          m.style.borderColor = '#ffd27a';
          m.style.maxWidth = '520px';
          m.innerHTML = '<h3 class="modal-title" style="color:#ffd27a">📜 ЛЕТОПИСЬ РАСКОЛА</h3>' +
            '<div id="shard-chronicle-content" style="max-height:56vh;overflow-y:auto"></div>' +
            '<button class="modal-close-btn" id="shard-chronicle-close">ЗАКРЫТЬ</button>';
          document.body.appendChild(m);
          registerModal(m);
          var c = $('shard-chronicle-close');
          c && c.addEventListener('click', function () { m.style.display = 'none'; });
          m.addEventListener('click', function (ev) { if (ev.target === m) m.style.display = 'none'; });
        }
        var box = $('shard-chronicle-content');
        if (box) box.innerHTML = chronicleHtml();
        if (L.openModal) L.openModal(m); else m.style.display = 'block';
      } catch (e) { toast('Летопись недоступна: ' + (e && e.message || e), 'danger', 5000); }
    }

    /* общие достижения -> в текущую вселенную */
    function applySharedAchievements() {
      try {
        var d = read();
        if (!has(d, 'sharedAch')) return 0;
        var added = 0, k;
        S.unlockedAchievements = S.unlockedAchievements || {};
        for (k in d.achievements) if (!S.unlockedAchievements[k]) { S.unlockedAchievements[k] = 1; added++; }
        if (added) reqSave();
        return added;
      } catch (e) { return 0; }
    }

    /* ---- зёрна раскола ---- */
    function seedsFor(d) {
      var u = active(d), B = 'shards.';
      var essence = Math.max(0, num(u && u.essenceTotal, 0));
      var worlds = num(u && u.worlds, 0);
      var base = Math.sqrt(essence / num(bal('shards.seedsEssenceDivisor', 1e3), 1e3));
      var mult = (1 + num(bal('shards.seedsMetaBonus', .1), .1) * num(u && u.meta, 0)) *
                 (1 + num(bal('shards.seedsWorldBonus', .05), .05) * worlds);
      if (worlds < num(bal('shards.seedsSmallWorldLimit', 8), 8)) mult *= num(bal('shards.seedsSmallWorldFactor', .35), .35);
      return Math.max(0, Math.floor(base * mult));
    }
    function splitAvailable() {
      var d = read(), u = active(d);
      if (d.universes.length >= slots(d)) return { ok: false, reason: 'нет свободных слотов: нужно Древо Раскола → «Тонкий шов»', slots: slots(d), universes: d.universes.length };
      var worlds = num(u.worlds, 0), essence = num(u.essenceTotal, 0), meta = num(u.meta, 0);
      if (worlds < num(bal('shards.minWorldsToSplit', 3), 3)) return { ok: false, reason: 'нужно минимум ' + bal('shards.minWorldsToSplit', 3) + ' открытых мира (сейчас ' + worlds + ')' };
      var finale = false;
      try { finale = !!(L.finalFragmentOpen && L.finalFragmentOpen()); } catch (e) {}
      if (!finale && meta < num(bal('shards.minMetaToSplit', 3), 3) && essence < num(bal('shards.minEssenceToSplit', 1e5), 1e5))
        return { ok: false, reason: 'нужен финал арки, либо ' + bal('shards.minMetaToSplit', 3) + ' коллапса, либо ' + fmt(bal('shards.minEssenceToSplit', 1e5)) + ' эссенции всего' };
      var s = seedsFor(d);
      if (s <= 0) return { ok: false, reason: 'вселенная слишком мала — зёрен не будет' };
      return { ok: true, seeds: s, worlds: worlds, essence: essence, meta: meta, finale: finale };
    }

    /* ---- раскол ---- */
    function nextId(d) {
      var maxN = 1;
      d.universes.forEach(function (u) { var n = Number(String(u.id).replace('u', '')) || 1; if (n > maxN) maxN = n; });
      d.absorbed.forEach(function (u) { var n = Number(String(u.id).replace('u', '')) || 1; if (n > maxN) maxN = n; });
      return 'u' + (maxN + 1);
    }
    function split(opts) {
      try {
        opts = opts || {};
        var d = syncFromGame() || read();
        var av = splitAvailable();
        if (!av.ok && !opts.force) return { ok: false, msg: av.reason };
        SAVE.saveGame && SAVE.saveGame();
        d = read();
        var id = nextId(d);
        var seed = num(opts.seed, 0) || ((function () { try { return V.social && V.social.monthlySeed ? V.social.monthlySeed() : 0; } catch (e) { return 0; } })() || ((Date.now() ^ 0x5f3a) >>> 0));
        var u = mkUniverse(id, seed >>> 0);
        u.createdAt = Date.now(); u.hasSave = false; u.note = 'раскол ' + new Date().toLocaleDateString('ru-RU');
        d.universes.push(u);
        d.seeds = num(d.seeds, 0) + num(av.seeds, 0);
        d.stats.splits = num(d.stats.splits, 0) + 1;
        /* общий пул эссенции */
        var moved = 0;
        if (has(d, 'essencePool')) {
          moved = Math.floor(num(S.essence, 0) * num(bal('shards.splitEssenceShare', .25), .25));
          if (moved > 0) { S.essence = num(S.essence, 0) - moved; d.essencePool = num(d.essencePool, 0) + moved; d.stats.essenceMoved = num(d.stats.essenceMoved, 0) + moved; }
        }
        /* якорь Ткача: запоминаем 3 узла дерева активной планеты */
        if (has(d, 'weaverAnchor')) {
          try {
            var nodes = GHOST && (function () {
              var pl = S.activePlanet, pr = L.profileForPlanet ? L.profileForPlanet(pl) : null;
              return Object.keys((pr && pr.treeNodes) || {});
            })() || [];
            d.pendingAnchor = nodes.slice(0, 3);
          } catch (e) { d.pendingAnchor = null; }
        }
        d.log = (d.log || []).concat([{ at: Date.now(), kind: 'split', id: id, seeds: num(av.seeds, 0), essence: moved }]).slice(-40);
        d.pendingNewGame = { id: id, seed: u.seed, at: Date.now() };
        var firstShard = !d.ceremonyDone;
        if (firstShard) d.ceremonyDone = true;
        writeQuiet(d);
        if (firstShard) setTimeout(function () { try { runCeremony({ label: u.label }); } catch (e2) {} }, 900);
        SAVE.saveGame && SAVE.saveGame();
        toast('🌠 <b>Раскол совершён</b><br><span style="font-size:11px;color:#91adbb;">+' + num(av.seeds, 0) + ' зёрен · создана ' + esc(u.label) + (moved ? ' · в общий пул ушло ' + fmt(moved) + ' 🌌' : '') + '</span>', 'success', 9000);
        return { ok: true, id: id, label: u.label, seeds: num(av.seeds, 0), essenceMoved: moved, seed: u.seed };
      } catch (e) { return { ok: false, msg: 'сбой раскола: ' + (e && e.message || e) }; }
    }

    /* ---- переключение вселенных (обмен содержимым ключей + перезагрузка) ---- */
    function switchTo(id, opts) {
      try {
        opts = opts || {};
        var d = syncFromGame() || read();
        if (id === d.activeId) return { ok: false, msg: 'ты уже в этой вселенной' };
        var target = byId(d, id);
        if (!target) return { ok: false, msg: 'вселенная не найдена' };
        SAVE.saveGame && SAVE.saveGame();
        var cur = lsGet(KEY);
        if (cur) lsSet(SWAPBAK, JSON.stringify({ at: Date.now(), from: d.activeId, to: id, active: cur, target: lsGet(target.key) }));
        var old = active(d);
        /* текущая вселенная уезжает в свой ключ */
        if (cur) { if (!lsSet(old.key, cur)) return { ok: false, msg: 'не удалось сохранить текущую вселенную (localStorage переполнен?)' }; }
        else lsDel(old.key);
        old.hasSave = !!cur;
        old.lastPlayedAt = Date.now();
        /* целевая вселенная заезжает в активный ключ */
        var t = lsGet(target.key);
        if (t) { lsSet(KEY, t); lsDel(target.key); target.hasSave = true; }
        else { lsDel(KEY); target.hasSave = false; }
        d.activeId = id;
        d.stats.switches = num(d.stats.switches, 0) + 1;
        d.pendingNewGame = target.hasSave ? null : { id: id, seed: target.seed, at: Date.now() };
        d.log = (d.log || []).concat([{ at: Date.now(), kind: 'switch', id: id }]).slice(-40);
        writeQuiet(d);
        if (opts.noReload) return { ok: true, reloadRequired: true, id: id, label: target.label };
        setTimeout(function () { try { window.location.reload(); } catch (e) {} }, 120);
        return { ok: true, reloadRequired: true, id: id, label: target.label };
      } catch (e) { return { ok: false, msg: 'сбой перелёта: ' + (e && e.message || e) }; }
    }

    /* ---- новая вселенная: seed уже зарезервирован, ждём «Новой игры» ---- */
    function beginPendingNewGame() {
      try {
        var d = read();
        if (!d.pendingNewGame) return { ok: false, msg: 'нет отложенного раскола' };
        var soc = ext('socialLite_v1', { monthlyPending: 0 });
        soc.monthlyPending = num(d.pendingNewGame.seed, 0) >>> 0;
        reqSave();
        var btn = $('reset-btn');
        toast('🌱 Seed ' + (soc.monthlyPending >>> 0) + ' зарезервирован — жми «НОВАЯ ИГРА»', 'success', 9000);
        if (btn) { btn.classList.add('voronia-pulse'); }
        return { ok: true, seed: soc.monthlyPending };
      } catch (e) { return { ok: false, msg: String(e && e.message || e) }; }
    }
    function confirmNewGameStarted() {
      try {
        var d = read();
        if (d.pendingNewGame && (S.gameStartSeed >>> 0) === (num(d.pendingNewGame.seed, 0) >>> 0)) {
          d.pendingNewGame = null; write(d);
        }
      } catch (e) {}
    }

    /* ---- якорь Ткача: выдача узлов в новой вселенной ---- */
    function applyAnchor() {
      try {
        var d = read();
        if (!d.pendingAnchor || !d.pendingAnchor.length) return 0;
        var pid = S.activePlanetId, pl = (L.PLANETS || {})[pid];
        if (!pl) return 0;
        var avail = {};
        try { (L.planetTreeNodes(pid) || []).forEach(function (n) { avail[n.id] = 1; }); } catch (e) {}
        var pr = L.profileForPlanet ? L.profileForPlanet(pl) : null;
        if (!pr) return 0;
        pr.treeNodes = pr.treeNodes || {};
        var done = 0;
        d.pendingAnchor.forEach(function (id) {
          if (avail[id] && !pr.treeNodes[id]) { pr.treeNodes[id] = 1; done++; }
        });
        d.pendingAnchor = null;
        if (done) { d.stats.anchorApplied = num(d.stats.anchorApplied, 0) + done; }
        write(d);
        if (done) { try { L.recomputeIncome && L.recomputeIncome(); } catch (e2) {} reqSave(); toast('🕸 <b>Якорь Ткача</b>: перенесено узлов дерева — ' + done, 'success', 6000); checkChronicles(d); }
        return done;
      } catch (e) { return 0; }
    }

    /* ---- древо раскола ---- */
    function buy(id) {
      try {
        var n = TREE()[id];
        if (!n) return { ok: false, msg: 'нет такого узла' };
        var d = syncFromGame() || read();
        var cost = nodeCost(d, id);
        if (!n.repeatable && has(d, id)) return { ok: false, msg: 'узел уже взят' };
        if (n.requires && !n.requires.every(function (r) { return has(d, r); })) return { ok: false, msg: 'сначала нужно: ' + n.requires.join(', ') };
        if (num(d.seeds, 0) < cost) return { ok: false, msg: 'нужно ' + cost + ' 🌠 (есть ' + num(d.seeds, 0) + ')' };
        d.seeds = num(d.seeds, 0) - cost;
        d.tree[id] = treeCount(d, id) + 1;
        d.log = (d.log || []).concat([{ at: Date.now(), kind: 'tree', id: id, cost: cost }]).slice(-40);
        writeQuiet(d);
        if (id === 'sharedAch') applySharedAchievements();
        toast('🌠 <b>' + esc(n.name) + '</b> — узел Древа Раскола взят', 'success', 5200);
        return { ok: true, id: id, cost: cost, count: d.tree[id] };
      } catch (e) { return { ok: false, msg: String(e && e.message || e) }; }
    }
    function synth() {
      var d = read(), n = TREE().synthSeeds;
      if (!n) return { ok: false, msg: 'узел «Синтез зёрен» не взят' };
      if (!has(d, 'synthSeeds')) return { ok: false, msg: 'нужен узел «Синтез зёрен»' };
      var cost = num(bal('shards.synthCost', 10), 10), cap = num(bal('shards.synthCap', 10), 10);
      if (num(d.synthSeeds, 0) >= cap) return { ok: false, msg: 'предел синтеза: ' + cap };
      if (num(d.seeds, 0) < cost) return { ok: false, msg: 'нужно ' + cost + ' 🌠' };
      d.seeds -= cost; d.synthSeeds = num(d.synthSeeds, 0) + 1; writeQuiet(d);
      try { L.recomputeIncome && L.recomputeIncome(); } catch (e) {}
      return { ok: true, synthSeeds: d.synthSeeds };
    }

    /* ---- общий пул ---- */
    function cdLeft(kind) {
      var d = read(), t = num(d.transfers && d.transfers[kind], 0);
      var cd = num(bal('shards.transferCooldownMs', 864e5), 864e5);
      return Math.max(0, t + cd - Date.now());
    }
    function deposit(kind, amount) {
      try {
        var d = syncFromGame() || read();
        if (kind === 'essence' && !has(d, 'essencePool')) return { ok: false, msg: 'нужен узел «Общий пул эссенции»' };
        if (kind === 'dust' && !has(d, 'dustBridge')) return { ok: false, msg: 'нужен узел «Мост пыли»' };
        if (kind === 'shards' && !has(d, 'shardBridge')) return { ok: false, msg: 'нужен узел «Мост осколков»' };
        var a = Math.floor(num(amount, 0));
        if (a <= 0) return { ok: false, msg: 'нужно целое количество больше нуля' };
        var field = kind === 'essence' ? 'essence' : kind === 'dust' ? 'dust' : 'shards';
        var have = Math.floor(num(S[field], 0));
        if (a > have) return { ok: false, msg: 'столько нет (доступно ' + fmt(have) + ')' };
        var left = cdLeft(kind + 'Out');
        if (left > 0) return { ok: false, msg: 'перевод доступен через ' + Math.ceil(left / 36e5) + ' ч' };
        S[field] = have - a;
        var pool = kind === 'essence' ? 'essencePool' : kind === 'dust' ? 'dustPool' : 'shardPool';
        d[pool] = num(d[pool], 0) + a;
        d.transfers[kind + 'Out'] = Date.now();
        if (kind === 'essence') d.stats.essenceMoved = num(d.stats.essenceMoved, 0) + a;
        if (kind === 'dust') d.stats.dustMoved = num(d.stats.dustMoved, 0) + a;
        writeQuiet(d); try { L.recomputeIncome && L.recomputeIncome(); } catch (e) {} reqSave();
        return { ok: true, moved: a, pool: d[pool] };
      } catch (e) { return { ok: false, msg: String(e && e.message || e) }; }
    }
    function withdraw(kind, amount) {
      try {
        var d = read();
        if (kind === 'essence' && !has(d, 'essencePool')) return { ok: false, msg: 'нужен узел «Общий пул эссенции»' };
        if (kind === 'dust' && !has(d, 'dustBridge')) return { ok: false, msg: 'нужен узел «Мост пыли»' };
        if (kind === 'shards' && !has(d, 'shardBridge')) return { ok: false, msg: 'нужен узел «Мост осколков»' };
        var pool = kind === 'essence' ? 'essencePool' : kind === 'dust' ? 'dustPool' : 'shardPool';
        var a = Math.floor(num(amount, 0));
        if (a <= 0) return { ok: false, msg: 'нужно целое количество больше нуля' };
        if (a > num(d[pool], 0)) return { ok: false, msg: 'в пуле только ' + fmt(d[pool]) };
        var left = cdLeft(kind + 'In');
        if (left > 0) return { ok: false, msg: 'снятие доступно через ' + Math.ceil(left / 36e5) + ' ч' };
        var loss = kind === 'essence' ? 0 : num(bal('shards.transferLoss', .3), .3);
        var got = Math.floor(a * (1 - loss));
        d[pool] = num(d[pool], 0) - a;
        d.transfers[kind + 'In'] = Date.now();
        var field = kind === 'essence' ? 'essence' : kind === 'dust' ? 'dust' : 'shards';
        S[field] = num(S[field], 0) + got;
        if (kind === 'dust') { S.dustTotal = num(S.dustTotal, 0) + got; }
        writeQuiet(d); try { L.recomputeIncome && L.recomputeIncome(); } catch (e) {} reqSave();
        return { ok: true, got: got, lost: a - got, pool: d[pool] };
      } catch (e) { return { ok: false, msg: String(e && e.message || e) }; }
    }

    /* ---- поглощение вселенной (синтез вместо слияния миров) ---- */
    function absorb(id) {
      try {
        var d = syncFromGame() || read();
        if (!has(d, 'absorb')) return { ok: false, msg: 'нужен узел «Поглощение»' };
        var u = byId(d, id);
        if (!u) return { ok: false, msg: 'вселенная не найдена' };
        if (id === d.activeId) return { ok: false, msg: 'нельзя поглотить активную вселенную' };
        var cap = num(bal('shards.absorbCap', .5), .5), step = num(bal('shards.absorbBonus', .05), .05);
        if (d.absorbed.length * step >= cap) return { ok: false, msg: 'предел поглощений: +' + Math.round(cap * 100) + '%' };
        d.absorbed.push({ id: u.id, label: u.label, seed: u.seed, worlds: u.worlds, cycles: u.cycles, essenceTotal: u.essenceTotal, at: Date.now() });
        d.universes = d.universes.filter(function (x) { return x.id !== id; });
        lsDel(KEY + '_' + id);
        d.stats.absorptions = num(d.stats.absorptions, 0) + 1;
        writeQuiet(d); try { L.recomputeIncome && L.recomputeIncome(); } catch (e) {}
        toast('🌌 <b>' + esc(u.label) + ' поглощена</b><br><span style="font-size:11px;color:#91adbb;">+' + Math.round(step * 100) + '% к добыче навсегда · слот освобождён</span>', 'success', 8000);
        return { ok: true, absorbed: d.absorbed.length };
      } catch (e) { return { ok: false, msg: String(e && e.message || e) }; }
    }

    /* ---- L2: Хранитель знает про Раскол ----
       Контекст выбирается ДЕТЕРМИНИРОВАННО (hash от seed грани, уровня Хранителя и
       числа вселенных), поэтому реплики не «мигают» между боями: одна и та же грань
       всегда говорит о шве или всегда нет. */
    function shardAwareContext(pl, level) {
      try {
        var d = readCached();
        if (d.universes.length < 2 && num(d.stats.splits, 0) < 1) return false;
        var lines = bal('guardian.shardLines', null);
        if (!lines || !lines.sentinel || !lines.guardian || !lines.overlord) return false;
        var seed = (pl && pl.seed ? pl.seed : 0) >>> 0;
        var h = (seed ^ Math.imul(num(level, 0) + 1, 2654435761) ^ Math.imul(d.universes.length + 1, 40503)) >>> 0;
        return (h % 100) < num(bal('guardian.shardAwarePct', 35), 35);
      } catch (e) { return false; }
    }

    /* ---- множители для бандла ---- */
    function incomeMult(pid) {
      try {
        var d = readCached(), m = 1;
        if (has(d, 'weaveFabric')) m *= 1 + num(bal('shards.fabricBonus', .1), .1);
        m *= 1 + Math.min(num(bal('shards.absorbCap', .5), .5), d.absorbed.length * num(bal('shards.absorbBonus', .05), .05));
        m *= 1 + Math.min(num(bal('shards.synthCap', 10), 10) * num(bal('shards.synthBonus', .02), .02), num(d.synthSeeds, 0) * num(bal('shards.synthBonus', .02), .02));
        return m;
      } catch (e) { return 1; }
    }
    function guardianHpMult() {
      try {
        var d = readCached();
        if (!has(d, 'membrane')) return 1;
        var u = active(d), i = index(d, u.id);
        return i > 0 ? num(bal('shards.membraneMult', .5), .5) : 1;
      } catch (e) { return 1; }
    }

    /* ---- L3 · церемония «Первый Шов» (один раз, после первого раскола) ---- */
    var CEREMONY = [
      { t: 'ШОВ', x: 'Ворония раскололась однажды и навсегда — без спроса и без свидетелей. Ты сделал то же самое, но осознанно: разлом стал инструментом, а не приговором.' },
      { t: 'ИМЯ', x: 'У новой вселенной уже есть seed — тот же, что у друзей в этом месяце. Значит, миры за швом похожи не случайно: вы раскололи одну и ту же тишину.' },
      { t: 'ЗЁРНА', x: 'Зёрна 🌠 — это не награда за объём. Это память о том, сколько ты вложил: эссенция, коллапсы, открытые грани. Тратить их стоит на то, что переживёт одну вселенную.' },
      { t: 'ВЫБОР', x: 'Остаться здесь или шагнуть за шов — оба решения правильные. Ворония больше не держится за одну грань. И ты, кажется, тоже.' }
    ];
    function runCeremony(info) {
      try {
        css();
        var m = $('shard-ceremony-modal');
        if (!m) {
          m = document.createElement('div');
          m.id = 'shard-ceremony-modal';
          m.innerHTML = '<div class="sh-cer-card"><div class="sh-cer-kicker">ПЕРВЫЙ ШОВ</div>' +
            '<div class="sh-cer-step" id="sh-cer-step">1 / 4</div>' +
            '<div class="sh-cer-title" id="sh-cer-title"></div>' +
            '<div class="sh-cer-text" id="sh-cer-text"></div>' +
            '<div class="sh-cer-dots" id="sh-cer-dots"></div>' +
            '<button class="sh-btn gold sh-cer-btn" id="sh-cer-next">ДАЛЬШЕ</button></div>';
          document.body.appendChild(m);
          registerModal(m);
        }
        var step = 0;
        var ttl = $('sh-cer-title'), txt = $('sh-cer-text'), stp = $('sh-cer-step'), dots = $('sh-cer-dots'), btn = $('sh-cer-next');
        function paint() {
          var c = CEREMONY[Math.min(step, CEREMONY.length - 1)];
          if (ttl) ttl.textContent = c.t;
          if (txt) txt.textContent = c.x;
          if (stp) stp.textContent = (step + 1) + ' / ' + CEREMONY.length;
          if (dots) dots.innerHTML = CEREMONY.map(function (_, i) { return '<span class="sh-cer-dot' + (i <= step ? ' on' : '') + '"></span>'; }).join('');
          if (btn) btn.textContent = step >= CEREMONY.length - 1 ? '🌠 К ДРЕВУ РАСКОЛА' : 'ДАЛЬШЕ';
        }
        btn && (btn.onclick = function () {
          try { V.media && V.media.SFX && V.media.SFX.click && V.media.SFX.click(); } catch (e) {}
          if (step < CEREMONY.length - 1) { step++; paint(); return; }
          m.style.display = 'none';
          try { V.media && V.media.vibrate && V.media.vibrate([120, 60, 120, 60, 240]); } catch (e2) {}
          open();
        });
        paint();
        m.style.display = 'block';
        try { V.media && V.media.SFX && V.media.SFX.prestige && V.media.SFX.prestige(); } catch (e3) {}
        return { ok: true, steps: CEREMONY.length, label: info && info.label };
      } catch (e) { return { ok: false, msg: String(e && e.message || e) }; }
    }

    /* ---- L4 · экспорт/импорт общего слоя (страховка от переполнения localStorage) ---- */
    function exportShared() {
      try {
        var d = read();
        var payload = { kind: 'voronia-shards', v: 1, exportedAt: Date.now(), gameVersion: window.__VORONIA_VERSION || null, shared: d };
        var s = JSON.stringify(payload, null, 2);
        try {
          var b = new Blob([s], { type: 'application/json' });
          var a = document.createElement('a');
          a.href = URL.createObjectURL(b);
          a.download = 'voronia_shards_' + Date.now() + '.json';
          document.body.appendChild(a); a.click(); a.remove();
          setTimeout(function () { try { URL.revokeObjectURL(a.href); } catch (e) {} }, 4000);
        } catch (e) {}
        return { ok: true, bytes: s.length, universes: d.universes.length, seeds: num(d.seeds, 0) };
      } catch (e) { return { ok: false, msg: String(e && e.message || e) }; }
    }
    function importShared(text, opts) {
      opts = opts || {};
      try {
        var o = JSON.parse(String(text || ''));
        if (!o || o.kind !== 'voronia-shards' || !o.shared || o.shared.v !== 1) return { ok: false, msg: 'это не файл общего слоя Раскола' };
        var s = o.shared;
        if (!Array.isArray(s.universes) || !s.universes.length) return { ok: false, msg: 'в файле нет списка вселенных' };
        var cur = lsGet(SHARED);
        if (cur) lsSet(SWAPBAK, JSON.stringify({ at: Date.now(), kind: 'pre-import', shared: cur }));
        write(s);
        toast('🌠 <b>Общий слой восстановлен</b><br><span style="font-size:11px;color:#91adbb;">вселенных: ' + s.universes.length + ' · зёрен: ' + fmt(s.seeds) + (opts.noReload ? '' : ' — перезагружаю') + '</span>', 'success', 6000);
        if (!opts.noReload) setTimeout(function () { try { window.location.reload(); } catch (e) {} }, 900);
        return { ok: true, universes: s.universes.length };
      } catch (e) { return { ok: false, msg: 'не удалось разобрать файл: ' + (e && e.message || e) }; }
    }

    /* ---- UI ---- */
    function css() {
      if ($('voronia-shard-css')) return;
      var st = document.createElement('style');
      st.id = 'voronia-shard-css';
      st.textContent = '' +
        '#shard-modal{border-color:#ffd27a;max-width:420px}' +
        '#shard-modal .modal-title{color:#ffd27a}' +
        '.sh-sec{background:#0a1420;border:1px solid #29495b;border-radius:12px;padding:10px;margin-bottom:10px}' +
        '.sh-head{font-size:11px;text-transform:uppercase;letter-spacing:1px;color:#7ec9e8;margin-bottom:7px;font-weight:800}' +
        '.sh-row{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:4px 0;font-size:12px;border-bottom:1px solid #16242f}' +
        '.sh-row:last-child{border-bottom:none}' +
        '.sh-row .v{font-family:monospace;font-weight:700;color:#eaf8ff;text-align:right}' +
        '.sh-univ{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:7px 6px;border:1px solid #23414f;border-radius:10px;margin-bottom:6px;background:#08131c}' +
        '.sh-univ.cur{border-color:#ffd27a;background:#1a1508}' +
        '.sh-univ .t{font-size:12px;font-weight:800;color:#eaf8ff}' +
        '.sh-univ .s{font-size:10px;color:#91adbb;margin-top:2px;line-height:1.35}' +
        '.sh-btn{background:#11202e;border:1px solid #29495b;color:#eaf8ff;padding:8px 10px;border-radius:9px;font-weight:700;font-size:11px;cursor:pointer}' +
        '.sh-btn:active{transform:scale(.97)}' +
        '.sh-btn:disabled{opacity:.45;cursor:not-allowed}' +
        '.sh-btn.gold{border-color:#ffd27a;color:#ffd27a}' +
        '.sh-btn.wide{width:100%;padding:12px;font-size:13px}' +
        '.sh-tree{display:flex;flex-direction:column;gap:6px}' +
        '.sh-node{border:1px solid #2b3f52;border-radius:10px;padding:7px 8px;background:#0b1622}' +
        '.sh-node.owned{border-color:#73c76b55;background:#0c1a12}' +
        '.sh-node .n{font-size:12px;font-weight:800;color:#eaf8ff;display:flex;justify-content:space-between;gap:6px}' +
        '.sh-node .d{font-size:10px;color:#91adbb;margin:3px 0 6px;line-height:1.35}' +
        '.sh-tier{font-size:10px;letter-spacing:1.5px;color:#ffd27a;text-transform:uppercase;margin:8px 0 5px;font-weight:800}' +
        '.sh-inp{background:#0a1420;border:1px solid #29495b;color:#eaf8ff;border-radius:8px;padding:7px;width:90px;font-family:monospace}' +
        '#shard-ceremony-modal{position:fixed;inset:0;z-index:400;display:none;background:rgba(2,4,10,.86);backdrop-filter:blur(3px);align-items:center;justify-content:center}' +
        '#shard-ceremony-modal .sh-cer-card{max-width:420px;margin:0 auto;background:linear-gradient(180deg,rgba(40,28,10,.95),rgba(10,14,22,.98));border:1px solid #ffd27a;border-radius:16px;padding:22px 20px;box-shadow:0 18px 60px rgba(0,0,0,.7);text-align:center;position:relative;overflow:hidden}' +
        '#shard-ceremony-modal .sh-cer-kicker{font-size:10px;letter-spacing:5px;color:#ffd27a;opacity:.85;text-transform:uppercase;font-weight:800}' +
        '#shard-ceremony-modal .sh-cer-step{font-size:9px;color:#7f9aa8;font-family:monospace;margin-top:6px}' +
        '#shard-ceremony-modal .sh-cer-title{font-size:22px;font-weight:900;color:#ffe9c4;letter-spacing:3px;margin:10px 0 12px}' +
        '#shard-ceremony-modal .sh-cer-text{font-size:12px;line-height:1.65;color:#e8d6b8;font-style:italic;min-height:96px}' +
        '#shard-ceremony-modal .sh-cer-dots{display:flex;gap:6px;justify-content:center;margin:12px 0 14px}' +
        '#shard-ceremony-modal .sh-cer-dot{width:7px;height:7px;border-radius:50%;background:#3a3020}' +
        '#shard-ceremony-modal .sh-cer-dot.on{background:#ffd27a;box-shadow:0 0 8px rgba(255,210,122,.6)}' +
        '#shard-ceremony-modal .sh-cer-btn{width:100%;padding:12px;font-size:13px}' +
        '#vor-cine-report{position:fixed;top:14px;right:14px;z-index:380;max-width:270px;padding:11px 13px;border:1px solid #ff4d9d;border-radius:12px;background:rgba(20,8,18,.92);box-shadow:0 10px 34px rgba(0,0,0,.6);animation:vcrIn .35s ease-out}' +
        '#vor-cine-report.out{opacity:0;transform:translateY(-8px);transition:opacity .6s,transform .6s}' +
        '#vor-cine-report .vcr-t{font-size:9px;letter-spacing:2.5px;color:#ff9ecb;text-transform:uppercase;font-weight:800}' +
        '#vor-cine-report .vcr-g{font-size:19px;font-weight:900;color:#ffd7ec;margin:3px 0 4px}' +
        '#vor-cine-report .vcr-s{font-size:10px;color:#c9a8bd;line-height:1.45}' +
        '#vor-cine-report .vcr-b{font-size:10px;color:#73c76b;margin-top:5px}' +
        '@keyframes vcrIn{from{opacity:0;transform:translateY(-10px)}to{opacity:1;transform:none}}' +
        '.voronia-pulse{animation:vorPulse 1.4s ease-in-out infinite}' +
        '@keyframes vorPulse{0%,100%{box-shadow:0 0 0 0 rgba(255,210,122,.5)}50%{box-shadow:0 0 0 8px rgba(255,210,122,0)}}';
      document.head.appendChild(st);
    }
    function ensureModal() {
      css();
      var m = $('shard-modal');
      if (m) return m;
      m = document.createElement('div');
      m.id = 'shard-modal';
      m.className = 'modal';
      m.innerHTML = '<div class="modal-title">🌠 РАСКОЛ</div><div id="shard-content"></div><button class="modal-close-btn" id="shard-close">ЗАКРЫТЬ</button>';
      document.body.appendChild(m);
      registerModal(m);
      m.addEventListener('click', function (e) { if (e.target === m) close(); });
      var c = $('shard-close');
      c && c.addEventListener('click', close);
      return m;
    }
    function close() { try { var m = $('shard-modal'); if (m) m.style.display = 'none'; } catch (e) {} }
    function open() {
      try {
        var d = syncFromGame() || read();
        var m = ensureModal();
        render(d);
        if (L.openModal) L.openModal(m); else m.style.display = 'block';
      } catch (e) { toast('Раскол недоступен: ' + (e && e.message || e), 'danger', 5000); }
    }
    function treeHtml(d) {
      var t = TREE(), tiers = [[], [], [], []], k;
      for (k in t) { if (k === 'dustBridge') continue; var n = t[k]; (tiers[clamp(num(n.tier, 1) - 1, 0, 3)] || tiers[0]).push(Object.assign({ id: k }, n)); }
      var names = ['ШВЫ', 'МОСТЫ', 'ТКАНЬ', 'СИНТЕЗ'], out = '';
      for (var i = 0; i < tiers.length; i++) {
        if (!tiers[i].length) continue;
        out += '<div class="sh-tier">Тир ' + (i + 1) + ' · ' + names[i] + '</div><div class="sh-tree">';
        tiers[i].forEach(function (n) {
          var cnt = treeCount(d, n.id), cost = nodeCost(d, n.id), owned = cnt > 0 && !n.repeatable;
          var can = num(d.seeds, 0) >= cost && !(n.requires && !n.requires.every(function (r) { return has(d, r); }));
          out += '<div class="sh-node' + (owned ? ' owned' : '') + '">' +
            '<div class="n"><span>' + esc(n.name) + (n.repeatable && cnt ? ' ×' + cnt : (owned ? ' ✔' : '')) + '</span><span style="color:#ffd27a">' + cost + ' 🌠</span></div>' +
            '<div class="d">' + esc(n.desc || '') + (n.requires && n.requires.length ? '<br>нужно: ' + n.requires.map(function (r) { return esc((TREE()[r] || {}).name || r); }).join(', ') : '') + '</div>' +
            '<button class="sh-btn' + (can && !owned ? ' gold' : '') + '" data-sh-buy="' + n.id + '" ' + (owned || !can ? 'disabled' : '') + '>' + (owned ? 'ВЗЯТО' : 'КУПИТЬ') + '</button>' +
            '</div>';
        });
        out += '</div>';
      }
      return out;
    }
    function render(d) {
      var c = $('shard-content'); if (!c) return;
      var u = active(d), av = splitAvailable();
      var h = '';
      h += '<div class="sh-sec"><div class="sh-head">Текущая вселенная</div>' +
        '<div class="sh-row"><span>' + esc(u.label) + ' · seed ' + (u.seed >>> 0) + '</span><b class="v">активна</b></div>' +
        '<div class="sh-row"><span>Миры</span><b class="v">' + num(u.worlds, 0) + '</b></div>' +
        '<div class="sh-row"><span>Циклы / коллапсы</span><b class="v">' + num(u.cycles, 0) + ' / ' + num(u.meta, 0) + '</b></div>' +
        '<div class="sh-row"><span>Эссенция всего</span><b class="v">' + fmt(u.essenceTotal) + ' 🌌</b></div>' +
        '<div class="sh-row"><span>Множитель добычи Раскола</span><b class="v">×' + incomeMult(u.id).toFixed(3) + '</b></div>' +
        '</div>';
      h += '<div class="sh-sec"><div class="sh-head">Зёрна и общий пул</div>' +
        '<div class="sh-row"><span>🌠 Зёрен Раскола</span><b class="v">' + fmt(d.seeds) + '</b></div>' +
        '<div class="sh-row"><span>🌌 Общий пул эссенции</span><b class="v">' + fmt(d.essencePool) + '</b></div>' +
        '<div class="sh-row"><span>💫 Осколки в пуле</span><b class="v">' + fmt(d.shardPool) + '</b></div>' +
        '<div class="sh-row"><span>Семена синтеза</span><b class="v">' + num(d.synthSeeds, 0) + ' (+' + Math.round(num(d.synthSeeds, 0) * num(bal('shards.synthBonus', .02), .02) * 100) + '%)</b></div>' +
        poolRow(d, 'essence', 'Эссенция', has(d, 'essencePool')) +
        poolRow(d, 'shards', 'Осколки', has(d, 'shardBridge')) +
        (has(d, 'synthSeeds') ? '<button class="sh-btn wide" data-sh-synth="1" ' + (num(d.seeds, 0) < num(bal('shards.synthCost', 10), 10) ? 'disabled' : '') + '>СИНТЕЗ: ' + num(bal('shards.synthCost', 10), 10) + ' 🌠 → 1 семя (+2% добычи)</button>' : '') +
        '</div>';
      h += '<div class="sh-sec"><div class="sh-head">Вселенные (' + d.universes.length + ' / ' + slots(d) + ')</div>';
      d.universes.forEach(function (x) {
        var cur = x.id === d.activeId;
        h += '<div class="sh-univ' + (cur ? ' cur' : '') + '"><div><div class="t">' + esc(x.label) + (cur ? ' · ты здесь' : '') + '</div>' +
          '<div class="s">seed ' + (x.seed >>> 0) + ' · миров ' + num(x.worlds, 0) + ' · циклов ' + num(x.cycles, 0) + '<br>' +
          (x.hasSave || cur ? 'сейв: ' + (cur ? 'активный ключ' : esc(x.key)) : 'пустой слот — начнётся с seed ' + (x.seed >>> 0)) +
          (x.lastPlayedAt ? ' · заходил ' + new Date(x.lastPlayedAt).toLocaleDateString('ru-RU') : '') + '</div></div>' +
          '<div style="display:flex;flex-direction:column;gap:5px">' +
          (cur ? '' : '<button class="sh-btn gold" data-sh-switch="' + x.id + '">ПЕРЕЙТИ</button>') +
          (cur || !has(d, 'absorb') ? '' : '<button class="sh-btn" data-sh-absorb="' + x.id + '">ПОГЛОТИТЬ</button>') +
          '</div></div>';
      });
      h += '<button class="sh-btn wide' + (av.ok ? ' gold' : '') + '" data-sh-split="1" ' + (av.ok ? '' : 'disabled') + '>' +
        (av.ok ? 'РАСКОЛОТЬСЯ: +' + av.seeds + ' 🌠 и новая вселенная' : 'РАСКОЛ НЕДОСТУПЕН') + '</button>';
      if (!av.ok) h += '<div style="font-size:10px;color:#ff9e9e;margin-top:5px;line-height:1.4;">' + esc(av.reason) + '</div>';
      else h += '<div style="font-size:10px;color:#91adbb;margin-top:5px;line-height:1.4;">Текущая вселенная остаётся живой. Новая стартует с seed ' + (av.seed || 'свежий') + ' — тем же, что у друзей в этом месяце.' + (has(d, 'essencePool') ? ' Часть эссенции (' + Math.round(num(bal('shards.splitEssenceShare', .25), .25) * 100) + '%) уйдёт в общий пул.' : '') + '</div>';
      h += '</div>';
      h += '<div class="sh-sec"><div class="sh-head">Летопись</div>' +
        '<div style="font-size:10px;color:#91adbb;line-height:1.4;margin-bottom:6px">Записи о расколах, перелётах и поглощениях живут в общем слое — они переживают смену вселенной. ' +
        'Открыто: <b style="color:#ffd27a">' + (d.chronicle || []).length + '</b>.</div>' +
        '<button class="sh-btn wide" data-sh-chronicle="1">📜 ЛЕТОПИСЬ РАСКОЛА</button></div>';
      h += '<div class="sh-sec"><div class="sh-head">Древо Раскола</div>' + treeHtml(d) + '</div>';
      if (d.absorbed && d.absorbed.length) {
        h += '<div class="sh-sec"><div class="sh-head">Поглощённые (' + d.absorbed.length + ')</div>';
        d.absorbed.forEach(function (x) { h += '<div class="sh-row"><span>' + esc(x.label) + '</span><b class="v">' + num(x.worlds, 0) + ' миров · ' + fmt(x.essenceTotal) + ' 🌌</b></div>'; });
        h += '</div>';
      }
      h += '<div class="sh-sec"><div class="sh-head">Резервная копия</div>' +
        '<div style="font-size:10px;color:#91adbb;line-height:1.4;margin-bottom:6px">Общий слой (вселенные, зёрна, пулы, Летопись) живёт в localStorage. ' +
        'Выгрузите файл, если чистите хранилище браузера или переносите игру.</div>' +
        '<div style="display:flex;gap:6px"><button class="sh-btn" data-sh-export="1">💾 ВЫГРУЗИТЬ JSON</button>' +
        '<button class="sh-btn" data-sh-import="1">📥 ЗАГРУЗИТЬ</button></div>' +
        '<input type="file" accept="application/json,.json" id="sh-import-file" style="display:none"></div>';
      h += '<div class="sh-sec"><div class="sh-head">Журнал</div>' +
        (d.log || []).slice(-6).reverse().map(function (e2) {
          return '<div class="sh-row"><span>' + new Date(e2.at).toLocaleString('ru-RU') + '</span><b class="v">' + esc(e2.kind) + (e2.id ? ' · ' + esc(e2.id) : '') + (e2.seeds ? ' · +' + e2.seeds + '🌠' : '') + '</b></div>';
        }).join('') + '</div>';
      c.innerHTML = h;
      wire(c, d);
    }
    function poolRow(d, kind, label, enabled) {
      if (!enabled) return '<div class="sh-row"><span>' + label + '</span><b class="v" style="color:#6f8390">нужен узел древа</b></div>';
      var pool = kind === 'essence' ? d.essencePool : kind === 'dust' ? d.dustPool : d.shardPool;
      var out = '<div class="sh-row" style="display:block;padding:6px 0">' +
        '<div style="font-size:11px;color:#91adbb;margin-bottom:4px">' + label + ' · в пуле ' + fmt(pool) + (kind !== 'essence' ? ' · потеря ' + Math.round(num(bal('shards.transferLoss', .3), .3) * 100) + '%' : '') + '</div>' +
        '<div style="display:flex;gap:6px;align-items:center">' +
        '<input class="sh-inp" type="number" min="0" data-sh-amt="' + kind + '" placeholder="кол-во">' +
        '<button class="sh-btn" data-sh-dep="' + kind + '">В ПУЛ</button>' +
        '<button class="sh-btn" data-sh-wd="' + kind + '">ИЗ ПУЛА</button>' +
        '</div></div>';
      var lo = cdLeft(kind + 'Out'), li = cdLeft(kind + 'In');
      if (lo > 0) out += '<div style="font-size:9px;color:#6f8390">перевод в пул через ' + Math.ceil(lo / 36e5) + ' ч</div>';
      if (li > 0) out += '<div style="font-size:9px;color:#6f8390">снятие через ' + Math.ceil(li / 36e5) + ' ч</div>';
      return out;
    }
    function wire(root, d) {
      root.querySelectorAll('[data-sh-buy]').forEach(function (b) {
        b.addEventListener('click', function () { var r = buy(b.getAttribute('data-sh-buy')); if (!r.ok) toast('🌠 ' + esc(r.msg), 'danger', 4200); render(read()); });
      });
      root.querySelectorAll('[data-sh-switch]').forEach(function (b) {
        b.addEventListener('click', function () {
          var id = b.getAttribute('data-sh-switch'), dd = read(), u = byId(dd, id);
          if (!has(dd, 'quickSwitch')) {
            if (!window.confirm('Перейти в «' + (u ? u.label : id) + '»?\nТекущая вселенная сохранится, страница перезагрузится.')) return;
          }
          var r = switchTo(id);
          if (!r.ok) toast('🌠 ' + esc(r.msg), 'danger', 5000);
        });
      });
      root.querySelectorAll('[data-sh-absorb]').forEach(function (b) {
        b.addEventListener('click', function () {
          var id = b.getAttribute('data-sh-absorb');
          if (!window.confirm('Поглотить вселенную ' + id + '? Её сейв будет удалён навсегда, а ты получишь +5% к добыче во всех вселенных.')) return;
          var r = absorb(id); if (!r.ok) toast('🌠 ' + esc(r.msg), 'danger', 5000); else render(read());
        });
      });
      root.querySelectorAll('[data-sh-dep]').forEach(function (b) {
        b.addEventListener('click', function () {
          var k = b.getAttribute('data-sh-dep'), inp = root.querySelector('[data-sh-amt="' + k + '"]');
          var r = deposit(k, inp ? inp.value : 0);
          toast(r.ok ? '🌠 В пул: ' + fmt(r.moved) : '🌠 ' + esc(r.msg), r.ok ? 'success' : 'danger', 4200);
          if (r.ok) render(read());
        });
      });
      root.querySelectorAll('[data-sh-wd]').forEach(function (b) {
        b.addEventListener('click', function () {
          var k = b.getAttribute('data-sh-wd'), inp = root.querySelector('[data-sh-amt="' + k + '"]');
          var r = withdraw(k, inp ? inp.value : 0);
          toast(r.ok ? '🌠 Из пула: ' + fmt(r.got) + (r.lost ? ' (потеря ' + fmt(r.lost) + ')' : '') : '🌠 ' + esc(r.msg), r.ok ? 'success' : 'danger', 4200);
          if (r.ok) render(read());
        });
      });
      var ex = root.querySelector('[data-sh-export]');
      if (ex) ex.addEventListener('click', function () {
        var r = exportShared();
        toast(r.ok ? '💾 Общий слой выгружен: ' + r.universes + ' вселенных, ' + (r.bytes / 1024).toFixed(1) + ' КБ' : '💾 ' + esc(r.msg), r.ok ? 'success' : 'danger', 6000);
      });
      var im = root.querySelector('[data-sh-import]'), imf = root.querySelector('#sh-import-file');
      if (im && imf) {
        im.addEventListener('click', function () { imf.click(); });
        imf.addEventListener('change', function () {
          var fl = imf.files && imf.files[0];
          if (!fl) return;
          var rd = new FileReader();
          rd.onload = function () {
            var r = importShared(rd.result);
            if (!r.ok) toast('📥 ' + esc(r.msg), 'danger', 7000);
          };
          rd.readAsText(fl);
        });
      }
      var ch = root.querySelector('[data-sh-chronicle]');
      if (ch) ch.addEventListener('click', function () { openChronicle(); });
      var sy = root.querySelector('[data-sh-synth]');
      if (sy) sy.addEventListener('click', function () { var r = synth(); toast(r.ok ? '🌠 Семя синтеза создано' : '🌠 ' + esc(r.msg), r.ok ? 'success' : 'danger', 4200); if (r.ok) render(read()); });
      var sp = root.querySelector('[data-sh-split]');
      if (sp) sp.addEventListener('click', function () {
        var av = splitAvailable();
        if (!av.ok) { toast('🌠 ' + esc(av.reason), 'danger', 5000); return; }
        if (!window.confirm('Расколоть вселенную?\n\n+' + av.seeds + ' 🌠 зёрен\nСоздаётся новая вселенная (seed месяца).\nТекущая сохраняется и остаётся доступной.')) return;
        var r = split();
        if (!r.ok) { toast('🌠 ' + esc(r.msg), 'danger', 6000); return; }
        render(read());
        toast('🌠 ' + esc(r.label) + ' готова. Открой «Раскол» → «ПЕРЕЙТИ», чтобы начать в ней.', 'success', 12000);
      });
    }
    function badge() {
      try {
        var d = read(), b = $('shard-split-badge'), btn = $('action-shards');
        if (!btn) return;
        var av = splitAvailable();
        btn.style.display = (d.universes.length > 1 || av.ok || num(d.seeds, 0) > 0) ? '' : 'none';
        if (b) b.textContent = num(d.seeds, 0) > 0 ? fmt(d.seeds) + ' 🌠 · вселенных: ' + d.universes.length : 'вселенных: ' + d.universes.length;
      } catch (e) {}
    }

    return {
      KEY: KEY, SHARED_KEY: SHARED, read: read, write: write, state: function () {
        var d = read();
        return {
          activeId: d.activeId, slots: slots(d), seeds: num(d.seeds, 0), essencePool: num(d.essencePool, 0),
          dustPool: num(d.dustPool, 0), shardPool: num(d.shardPool, 0), synthSeeds: num(d.synthSeeds, 0),
          tree: Object.assign({}, d.tree), universes: d.universes.map(function (u) { return Object.assign({}, u); }),
          absorbed: d.absorbed.length, stats: Object.assign({}, d.stats), pendingNewGame: d.pendingNewGame,
          chronicle: (d.chronicle || []).length, ceremonyDone: !!d.ceremonyDone
        };
      },
      active: function () { var d = read(); return Object.assign({}, active(d)); },
      incomeMult: incomeMult, guardianHpMult: guardianHpMult, shardAwareContext: shardAwareContext,
      splitAvailable: splitAvailable, seedsFor: function () { return seedsFor(read()); },
      split: split, switchTo: switchTo, buy: buy, synth: synth, absorb: absorb,
      deposit: deposit, withdraw: withdraw, cdLeft: cdLeft,
      syncFromGame: syncFromGame, applySharedAchievements: applySharedAchievements, applyAnchor: applyAnchor,
      beginPendingNewGame: beginPendingNewGame, confirmNewGameStarted: confirmNewGameStarted,
      open: open, close: close, render: function () { render(read()); }, badge: badge, nodeCost: function (id) { return nodeCost(read(), id); },
      TREE: TREE,
      chronicle: chronicle, chronicleHtml: chronicleHtml, chronicleHeaderHtml: chronicleHeaderHtml, openChronicle: openChronicle,
      runCeremony: runCeremony, CEREMONY: CEREMONY.map(function (c) { return c.t; }), exportShared: exportShared, importShared: importShared,
      checkChronicles: function () { return checkChronicles(read()); }, CHRONICLES: SHARD_CHRONICLES.map(function (c) { return { id: c.id, title: c.title }; }),
      __test: {
        grantSeeds: function (v) { var d = read(); d.seeds = num(d.seeds, 0) + num(v, 0); write(d); return d.seeds; },
        buy: buy, split: function () { return split({ force: true }); },
        switchTo: function (id) { return switchTo(id, { noReload: true }); },
        setTree: function (id, c) { var d = read(); d.tree[id] = num(c, 1); write(d); return d.tree; },
        relax: function () { var d = read(); d.universes.forEach(function (u) { u.worlds = 99; u.essenceTotal = 1e7; u.meta = 9; }); write(d); return read(); },
        ceremony: function () { return runCeremony({ label: 'тест' }); },
        resetCeremony: function () { var d = read(); d.ceremonyDone = false; write(d); return true; }
      }
    };
  })();
  window.__VORONIA_SHARDS = SHARDS;

  /* =========================================================================
   * КИНЕМАТОГРАФ СБРОСОВ (престиж / метапрестиж / асценсия)
   *
   * Жалоба автора была точной: сброс выглядел как F5 — модальная церемония есть
   * только для ПЕРВОГО престижа, а на canvas не происходит ничего.
   * Здесь три фазы (коллапс → слепое пятно → прилёт). Рисунок идёт поверх кадра
   * через уже существующий хук postFrame, а сам сброс выполняет ШТАТНЫЙ обработчик
   * бандла: мы перехватываем клик в фазе capture и переоправляем его в момент
   * «слепого пятна». Поэтому ни логика престижа, ни церемония первого престижа
   * не дублируются и не ломаются, а правок в бандле — ноль.
   * ========================================================================= */
  var CIN = (function () {
    var DEF = {
      collapse: { ms: 1000, color: '#ff4d9d', label: 'ЦИКЛ СГОРЕЛ' },
      fold: { ms: 1100, color: '#c084fc', label: 'ГРАНИ СВЁРНУТЫ' },
      burn: { ms: 1200, color: '#eaf8ff', label: 'ТЫ СГОРЕЛ САМ' }
    };
    var st = { active: false, kind: null, phase: 'idle', t0: 0, skip: false, parts: [], btn: null };
    var _pass = false;

    function reduced() { try { return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) { return false; } }
    function enabled() { return !(S.settings && S.settings.cinematic === false); }
    function colors() { return bal('cinematic.colors', null) || { collapse: DEF.collapse.color, fold: DEF.fold.color, burn: DEF.burn.color }; }
    function col(kind) { return String(colors()[kind] || DEF[kind].color); }
    function dur(phase, kind) {
      if (reduced()) return phase === 'blackout' ? 180 : 220;
      if (phase === 'collapse') return num(bal('cinematic.collapseMs', DEF[kind].ms), DEF[kind].ms);
      if (phase === 'blackout') return num(bal('cinematic.blackoutMs', 320), 320);
      return num(bal('cinematic.arrivalMs', 1200), 1200);
    }
    function burst(n, color) {
      for (var i = 0; i < n; i++) {
        var a = Math.random() * Math.PI * 2, sp = 60 + Math.random() * 260;
        st.parts.push({ x: (S.W || 800) / 2, y: (S.H || 600) / 2, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 40, life: 0.6 + Math.random() * 0.7, t: 0, color: color });
      }
      if (st.parts.length > 260) st.parts.splice(0, st.parts.length - 260);
    }
    function start(kind, btn) {
      var d = DEF[kind] || DEF.collapse;
      st.active = true; st.kind = kind; st.phase = 'collapse'; st.t0 = performance.now();
      st.skip = false; st.parts = []; st.btn = btn;
      try { S.screenShake = 10; } catch (e) {}
      try { V.media && V.media.SFX && V.media.SFX.prestige && V.media.SFX.prestige(); } catch (e2) {}
      try { V.media && V.media.vibrate && V.media.vibrate([70, 40, 110]); } catch (e3) {}
      burst(reduced() ? 0 : 40, d.color);
      return { ok: true, kind: kind, phase: st.phase };
    }
    /* переход фаз; в «слепом пятне» отдаём клик штатному обработчику бандла */
    function tick() {
      if (!st.active) return;
      var el = performance.now() - st.t0, d = dur(st.phase, st.kind);
      if (st.skip) el = d;
      if (el < d) return;
      if (st.phase === 'collapse') {
        st.phase = 'blackout'; st.t0 = performance.now(); st.skip = false;
        try { S.screenShake = 16; } catch (e) {}
        burst(reduced() ? 0 : 60, col(st.kind));
      } else if (st.phase === 'blackout') {
        if (st.btn && !st.btn.disabled) { _pass = true; try { st.btn.click(); } catch (e) {} _pass = false; }
        st.phase = 'arrival'; st.t0 = performance.now(); st.skip = false;
        try { S.zoom = num(bal('cinematic.zoomFrom', .22), .22); } catch (e2) {}
        try { V.media && V.media.SFX && V.media.SFX.discovery && V.media.SFX.discovery(); } catch (e3) {}
      } else {
        st.active = false; st.phase = 'idle';
        try { S.zoom = num(bal('cinematic.zoomTo', .98), .98); } catch (e) {}
        try { S.screenShake = 0; } catch (e2) {}
        report();
      }
    }
    /* компактный отчёт для НЕ-первого престижа: для первого бандл показывает свою церемонию */
    function report() {
      try {
        var snap = S._prePrestigeSnap;
        if (!snap || snap.wasFirst) return;
        var old = document.getElementById('vor-cine-report');
        if (old && old.parentNode) old.parentNode.removeChild(old);
        var el = document.createElement('div');
        el.id = 'vor-cine-report';
        el.innerHTML = '<div class="vcr-t">' + esc((DEF[st.kind] || DEF.collapse).label) + '</div>' +
          '<div class="vcr-g">+' + fmt(snap.gain || 0) + ' ✨</div>' +
          '<div class="vcr-s">сгорело: ' + num(snap.planetsCount, 0) + ' миров · ' + num(snap.techLevels, 0) + ' ур. технологий' +
          (snap.researchKept > 0 ? ' · 🧪 ' + fmt(snap.researchKept) : '') + '</div>' +
          '<div class="vcr-b">⚡ ускоритель старта: −50% к апгрейдам первой планеты, 5 мин</div>';
        document.body.appendChild(el);
        var ms = num(bal('cinematic.reportMs', 4200), 4200);
        setTimeout(function () { try { el.classList.add('out'); } catch (e) {} }, ms);
        setTimeout(function () { try { if (el.parentNode) el.parentNode.removeChild(el); } catch (e) {} }, ms + 700);
      } catch (e) {}
    }
    function hexA(hex, a) {
      var h = String(hex).replace('#', '');
      if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
      var n = parseInt(h, 16) || 0;
      return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a.toFixed(3) + ')';
    }
    function draw(ctx, W, H, dt) {
      if (!st.active) return 0;
      var el = performance.now() - st.t0, d = Math.max(1, dur(st.phase, st.kind));
      var k = Math.min(1, el / d), color = col(st.kind);
      ctx.save();
      try { var _dprC = Math.min(window.devicePixelRatio || 1, 2); ctx.setTransform(_dprC, 0, 0, _dprC, 0, 0); } catch (e) {}
      if (st.phase === 'collapse') {
        var ease = 1 - Math.pow(1 - k, 3);
        var g = ctx.createRadialGradient(W / 2, H / 2, 0, W / 2, H / 2, Math.max(W, H) * (0.18 + ease * 0.85));
        g.addColorStop(0, 'rgba(0,0,0,0)');
        g.addColorStop(0.55, hexA(color, 0.18 + ease * 0.22));
        g.addColorStop(1, hexA(color, 0.55 + ease * 0.4));
        ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
        var cracks = Math.floor(ease * num(bal('cinematic.cracks', 24), 24));
        ctx.strokeStyle = 'rgba(255,255,255,' + (0.22 + ease * 0.4).toFixed(3) + ')';
        ctx.lineWidth = 1.6 * (1 - ease * 0.5);
        for (var i = 0; i < cracks; i++) {
          var ang = (i / 24) * Math.PI * 2 + Math.sin(i * 1.7) * 0.3;
          var len = Math.max(W, H) * (0.1 + ease * 0.75) * (0.65 + Math.sin(i * 3.1) * 0.35);
          ctx.beginPath(); ctx.moveTo(W / 2, H / 2);
          ctx.lineTo(W / 2 + Math.cos(ang) * len, H / 2 + Math.sin(ang) * len); ctx.stroke();
        }
        ctx.globalAlpha = 0.45 + 0.5 * ease;
        ctx.fillStyle = '#eaf8ff';
        ctx.font = '800 12px system-ui,sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText((DEF[st.kind] || DEF.collapse).label, W / 2, Math.max(24, H * 0.12));
      } else if (st.phase === 'blackout') {
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
        var fl = k < 0.45 ? 0 : (k - 0.45) / 0.55;
        ctx.globalAlpha = Math.max(0, 0.85 * (1 - fl));
        ctx.fillStyle = color; ctx.fillRect(0, 0, W, H);
      } else {
        var zf = num(bal('cinematic.zoomFrom', .22), .22), zt = num(bal('cinematic.zoomTo', .98), .98);
        try { S.zoom = zf + (zt - zf) * (1 - Math.pow(1 - k, 3)); } catch (e) {}
        ctx.globalAlpha = Math.max(0, 0.5 * (1 - k));
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
      }
      ctx.globalAlpha = 1;
      var drawn = st.parts.length;
      for (var p = st.parts.length - 1; p >= 0; p--) {
        var q = st.parts[p];
        q.t += dt; q.x += q.vx * dt; q.y += q.vy * dt; q.vy += 120 * dt; q.vx *= 0.985;
        if (q.t >= q.life) { st.parts.splice(p, 1); continue; }
        ctx.globalAlpha = Math.max(0, 1 - q.t / q.life) * 0.85;
        ctx.fillStyle = q.color;
        ctx.beginPath(); ctx.arc(q.x, q.y, 1.8, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
      return drawn;
    }
    /* перехват клика: capture на document срабатывает раньше обработчиков бандла */
    document.addEventListener('click', function (ev) {
      try {
        if (_pass || st.active || !enabled()) return;
        var t = ev.target;
        if (!t || !t.closest) return;
        var kind = null, btn = null;
        if (t.closest('#prestige-confirm-btn')) { kind = 'collapse'; btn = t.closest('#prestige-confirm-btn'); }
        else if (t.closest('#meta-confirm-btn')) { kind = 'fold'; btn = t.closest('#meta-confirm-btn'); }
        else if (t.closest('#asc-go') && num(S.__ascArmUntil, 0) > Date.now()) { kind = 'burn'; btn = t.closest('#asc-go'); }
        if (!kind || !btn || btn.disabled) return;
        ev.stopImmediatePropagation();
        ev.preventDefault();
        start(kind, btn);
      } catch (e) {}
    }, true);
    function skip() { if (st.active) { st.skip = true; return true; } return false; }
    document.addEventListener('pointerdown', function (ev) {
      if (!st.active) return;
      if (ev.target && ev.target.closest && ev.target.closest('#vor-cine-report')) return;
      skip(); ev.stopPropagation();
    }, true);
    document.addEventListener('keydown', function (ev) {
      if (!st.active) return;
      if (ev.key === 'Escape' || ev.key === ' ' || ev.key === 'Enter') { skip(); ev.preventDefault(); }
    }, true);

    return {
      start: start, tick: tick, draw: draw, skip: skip, report: report,
      state: function () { return { active: st.active, kind: st.kind, phase: st.phase, skip: st.skip, reduced: reduced(), enabled: enabled(), particles: st.parts.length }; },
      DEF: DEF
    };
  })();
  window.__VORONIA_CINEMATIC = CIN;


  /* =========================================================================
   * ХУКИ и инициализация
   * ========================================================================= */
  var _cineLast = 0;
  window.__VORONIA_HOOKS = {
    postFrame: function () {
      var now = performance.now(), dt = Math.min(0.05, (now - (_cineLast || now)) / 1000);
      _cineLast = now;
      try { CIN.tick(); } catch (e) {}
      try {
        if (CIN.state().active) {
          var cv = document.getElementById('game');
          var ctx = cv && cv.getContext ? cv.getContext('2d') : null;
          if (ctx) CIN.draw(ctx, S.W || window.innerWidth, S.H || window.innerHeight, dt);
          return;                    // во время кинематографа слой «следов друга» не рисуем
        }
      } catch (e2) {}
      try { GHOST.overlay(); } catch (e) {}
      try { boostChip(); } catch (e3) {}
    },
    /* уровень 3 «Следов друга»: дуги чужого плетения на 3D-карте галактики */
    postEchoArcs: function (projected) {
      try { var k = GHOST.drawFriendArcs(projected); GHOST.__setWeavesDrawn && GHOST.__setWeavesDrawn(k); return k; }
      catch (e) { return 0; }
    }
  };

  function initShardUi() {
    try {
      var b = $('action-shards');
      if (b && !b.__vorWired) {
        b.__vorWired = true;
        b.addEventListener('click', function () { try { L.closeOverlays && L.closeOverlays(); } catch (e) {} try { var o = document.querySelectorAll('.sub-menu-overlay'); o.forEach(function (x) { x.classList.remove('open'); }); } catch (e2) {} SHARDS.open(); });
      }
      var u = $('universe-btn');
      if (u && !u.__vorWired) {
        u.__vorWired = true;
        u.addEventListener('click', function () { SHARDS.open(); });
        var d = SHARDS.read();
        u.textContent = '🌌 ВСЕЛЕННЫЕ: ' + d.universes.length;
        u.style.display = d.universes.length > 1 || num(d.seeds, 0) > 0 ? '' : 'none';
      }
      SHARDS.badge();
    } catch (e) {}
  }


  /* ------------------------------------------------- блок в «Настройках» */
  function initSettingsSection() {
    try {
      var m = $('settings-modal');
      if (!m || m.__vorSec) return;
      m.__vorSec = 1;
      var sec = document.createElement('div');
      sec.className = 'wh-section';
      var ghostOn = !(S.settings && S.settings.ghostLayer === false);
      var wvOn = !(S.settings && S.settings.ghostWeaveLayer === false);
      var mkOn = !(S.settings && S.settings.ghostMarks === false);
      var cinOn = !(S.settings && S.settings.cinematic === false);
      sec.innerHTML = '' +
        '<div class=wh-section-title>🧪 Разработчик · данные · слои</div>' +
        '<div class=setting-row><span class=name>Следы друга (слой на карте)</span>' +
        '<button id=set-ghost-toggle class=setting-toggle>' + (ghostOn ? 'ВКЛ' : 'ВЫКЛ') + '</button></div>' +
        '<div class=setting-row><span class=name>Следы друга: дуги плетения</span>' +
        '<button id=set-ghostweave-toggle class=setting-toggle>' + (wvOn ? 'ВКЛ' : 'ВЫКЛ') + '</button></div>' +
        '<div class=setting-row><span class=name>Следы друга: аномалии и ядра</span>' +
        '<button id=set-ghostmarks-toggle class=setting-toggle>' + (mkOn ? 'ВКЛ' : 'ВЫКЛ') + '</button></div>' +
        '<div class=setting-row><span class=name>Кинематограф сбросов</span>' +
        '<button id=set-cinematic-toggle class=setting-toggle>' + (cinOn ? 'ВКЛ' : 'ВЫКЛ') + '</button></div>' +
        '<div class=setting-row><span class=name>Раскол · вселенные</span>' +
        '<button id=set-shard-open class=setting-toggle style="border-color:#ffd27a;color:#ffd27a">🌠 Открыть</button></div>' +
        '<div class=setting-row><span class=name>Debug-API</span>' +
        '<button id=set-debug-toggle class=setting-toggle>' + (window.__VORONIA_DEBUG ? 'ВКЛ' : 'ВЫКЛ') + '</button></div>' +
        '<div class=setting-row><span class=name>Реестр баланса</span>' +
        '<span style="font-size:10px;color:#6b7782;font-family:monospace;text-align:right">' +
        ((window.__VORONIA_BALANCE_WIRED || []).length) + ' ключей · frozen</span></div>';
      m.appendChild(sec);
      var gt = $('set-ghost-toggle');
      gt && gt.addEventListener('click', function () {
        try {
          S.settings = S.settings || {};
          var on = !(S.settings.ghostLayer === false);
          S.settings.ghostLayer = !on;
          gt.textContent = !on ? 'ВКЛ' : 'ВЫКЛ';
          saveSettings();
          reqSave();
          toast(on ? '👁 Слой «Следы друга» выключен' : '👁 Слой «Следы друга» включён', '', 3200);
        } catch (e) {}
      });
      var wt = $('set-ghostweave-toggle');
      wt && wt.addEventListener('click', function () {
        try {
          S.settings = S.settings || {};
          var on = !(S.settings.ghostWeaveLayer === false);
          S.settings.ghostWeaveLayer = !on;
          wt.textContent = !on ? 'ВКЛ' : 'ВЫКЛ';
          saveSettings();
          reqSave();
          toast(on ? '🕸 Дуги чужого плетения выключены' : '🕸 Дуги чужого плетения включены (карта галактики)', '', 3400);
        } catch (e) {}
      });
      var mt = $('set-ghostmarks-toggle');
      mt && mt.addEventListener('click', function () {
        try {
          S.settings = S.settings || {};
          var on = !(S.settings.ghostMarks === false);
          S.settings.ghostMarks = !on;
          mt.textContent = !on ? 'ВКЛ' : 'ВЫКЛ';
          saveSettings();
          reqSave();
          toast(on ? '👁 Отметки чужих аномалий выключены' : '👁 Отметки чужих аномалий включены', '', 3200);
        } catch (e) {}
      });
      var ct2 = $('set-cinematic-toggle');
      ct2 && ct2.addEventListener('click', function () {
        try {
          S.settings = S.settings || {};
          var on = !(S.settings.cinematic === false);
          S.settings.cinematic = !on;
          ct2.textContent = !on ? 'ВКЛ' : 'ВЫКЛ';
          saveSettings(); reqSave();
          toast(!on ? '🎬 Кинематограф сбросов включён' : '🎬 Кинематограф выключен — сбросы мгновенные', '', 3200);
        } catch (e) {}
      });
      var so = $('set-shard-open');
      so && so.addEventListener('click', function () { try { L.closeModals && L.closeModals(); } catch (e) {} SHARDS.open(); });
      var dt = $('set-debug-toggle');
      dt && dt.addEventListener('click', function () {
        try {
          var on = !window.__VORONIA_DEBUG;
          if (on) window.localStorage.setItem('voronia_debug', '1');
          else window.localStorage.removeItem('voronia_debug');
          toast('🧪 Режим разработчика ' + (on ? 'включён' : 'выключен') + ' — перезагружаю…', '', 2600);
          setTimeout(function () { window.location.reload(); }, 900);
        } catch (e) { toast('Не удалось переключить режим: localStorage недоступен', 'danger', 5000); }
      });
    } catch (e) {}
  }

  /* ---- вкладка «🌠 Расколы» в Летописи Плетения: кнопка добавляется в DOM,
         а переключение работает штатно (обработчик в бандле делегирован через
         closest(".story-tab")), ветку рендера добавляет патч J1 ---- */
  function initEchoStoryTab() {
    try {
      var tabs = document.getElementById('echo-story-tabs');
      if (!tabs || tabs.querySelector('[data-story-tab="shards"]')) return;
      var b = document.createElement('button');
      b.className = 'story-tab';
      b.setAttribute('data-story-tab', 'shards');
      b.setAttribute('style', 'flex:1;padding:7px;border:none;border-radius:7px;background:transparent;color:#91adbb;font-weight:900;font-size:11px;letter-spacing:.5px;cursor:pointer');
      b.textContent = '🌠 РАСКОЛЫ';
      tabs.appendChild(b);
    } catch (e) {}
  }

  /* HUD-чип «ускоритель старта»: prestigeBoostUntil работал и раньше, но не показывался */
  function boostChip() {
    try {
      var left = num(S.prestigeBoostUntil, 0) - Date.now();
      var el = document.getElementById('vor-boost-chip');
      if (left <= 0) { if (el && el.parentNode) el.parentNode.removeChild(el); return; }
      if (!el) {
        var host = document.getElementById('buffs') || document.body;
        el = document.createElement('div');
        el.id = 'vor-boost-chip';
        el.className = 'buff-badge';
        el.style.borderColor = '#ff4d9d';
        el.style.color = '#ff9ecb';
        el.style.background = 'rgba(255,77,157,.14)';
        host.appendChild(el);
      }
      var m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
      el.textContent = '⚡ Ускоритель старта ×0.5 · ' + m + ':' + String(s).padStart(2, '0');
    } catch (e) {}
  }

  function boot() {
    try { fillBalSpans(); } catch (e) {}
    try { initShardUi(); } catch (e) {}
    try { initSettingsSection(); } catch (e) {}
    try { initEchoStoryTab(); } catch (e) {}
    /* блок «Следы друга» в модалке обмена вешается штатным рендером Hc()
       (см. патч D3b) — дублирующая делегация не нужна */
    /* Отложенный раскол: seed новой вселенной резервируется ДО старта игры —
       именно в этот момент игрок видит стартовый экран и жмёт «НОВАЯ ИГРА». */
    function onBoot() {
      try {
        var d = SHARDS.read();
        if (!d.pendingNewGame) return;
        var u = null;
        d.universes.forEach(function (x) { if (x.id === d.pendingNewGame.id) u = x; });
        var seed = num(d.pendingNewGame.seed, 0) >>> 0;
        if (S.started && (S.gameStartSeed >>> 0) === seed) { SHARDS.confirmNewGameStarted(); return; }
        if (!S.started && u && u.hasSave && lsGet(SHARDS.KEY)) { SHARDS.confirmNewGameStarted(); return; }
        SHARDS.beginPendingNewGame();
      } catch (e) {}
    }
    /* после старта: общие достижения, якорь Ткача, синхронизация метаданных */
    function onStarted() {
      try {
        if (!S.started) return;
        SHARDS.syncFromGame();
        SHARDS.applySharedAchievements();
        SHARDS.applyAnchor();
        SHARDS.confirmNewGameStarted();
        initShardUi();
      } catch (e) {}
    }
    try { V.bus && V.bus.on && V.bus.on('save:loaded', onStarted); } catch (e) {}
    try { V.bus && V.bus.on && V.bus.on('game:started', onStarted); } catch (e) {}
    setTimeout(onBoot, 300);
    setTimeout(onStarted, 700);
    setTimeout(onStarted, 2600);
    setInterval(function () { try { if (S.started) { SHARDS.syncFromGame(); SHARDS.badge(); initShardUi(); } } catch (e) {} }, 20000);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 0);

  window.__VORONIA_FEATURES = { version: '0.0.13.0', ghost: GHOST, shards: SHARDS, boot: boot, bal: bal };
})();
