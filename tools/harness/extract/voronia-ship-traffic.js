
/* ============================================================================
 * Voronia · СУДОХОДСТВО (v0.0.21.0) — визуализация перевозок.
 * Следующий слой после Верфи: кораблики реально летят по маршруту.
 *
 *  · 3D-карта галактики (СЕКТОР ВЕГА): каждый груз в пути — корабль, идущий
 *    по своей маршрутной линии (включая промежуточные пересадки). Маршрут —
 *    бегущий пунктир от кромки планеты до кромки; двигатель светит цветом
 *    груза; у борта — ⏱ ETA и тоннаж; отлёт — кольцо, прибытие — вспышка.
 *  · 2D-карта сектора (СЕКТОР ВОРОНИЯ): тот же слой поверх обычной карты.
 *  · Кнопка 🚢 на обеих картах — вкл/выкл слой (localStorage, сейв не тронут).
 *
 *  Только чтение: state.deliveries + проекции карты. В gameplay не лезет.
 *  Отрисовка — внутри кадра галактики (хук postEchoArcs): после эхо-дуг,
 *  до дисков планет; маршруты подрезаны до кромки планет, поэтому корабль
 *  виден от отлёта до прибытия. На 2D-карте — поверх всего (обёртка drawGalaxy2D).
 *  Все ошибки глушатся — игра продолжается без слоя.
 * ========================================================================== */
(function () {
  'use strict';
  var V = window.__V || {}, S = V.state || {}, L = V.legacy || {};

  /* ---------------- настройки (localStorage, не сейв) ---------------- */
  var LS_KEY = 'vor_shipviz_v21';
  var CFG = { ships: true };
  try {
    var raw = localStorage.getItem(LS_KEY);
    if (raw) { var p = JSON.parse(raw); if (p && typeof p === 'object') CFG = p; }
  } catch (e) {}
  function saveCfg(){ try { localStorage.setItem(LS_KEY, JSON.stringify(CFG)); } catch(e){} }
  /* v0.0.26 (A-3): при prefers-reduced-motion гасим покачивание, мерцание и бегущий пунктир */
  var _rm = null;
  function RM(){
    if (_rm === null){
      try { _rm = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch(e){ _rm = false; }
      try {
        var mq = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
        if (mq && mq.addEventListener) mq.addEventListener('change', function(){ _rm = null; });
      } catch(e){}
    }
    return _rm;
  }

  function $(id){ return document.getElementById(id); }
  function fmt(v){ try { return window.fmtBig ? window.fmtBig(v) : String(Math.round(v||0)); } catch(e){ return String(Math.round(v||0)); } }
  function deliveries(){ try { return (S && S.deliveries) || []; } catch(e){ return []; } }
  function hexa(hex, a){
    var h = String(hex||'#7ee08a').replace('#','');
    if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
    var n = parseInt(h,16); if (!isFinite(n)) n = 0x7ee08a;
    return 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+','+(Math.max(0,Math.min(1,a))).toFixed(3)+')';
  }

  /* ---------------- данные рейса ---------------- */
  function cargoColor(d){
    var best = null, bestAmt = -1;
    var c = d.cargo || {};
    for (var k in c){
      var amt = Number(c[k])||0;
      if (amt > bestAmt){
        var meta = L.RESOURCES && L.RESOURCES[k];
        if (meta && meta.color){ best = meta.color; bestAmt = amt; }
      }
    }
    return best || '#7ee08a';
  }
  function routePids(d){
    var r = Array.isArray(d.route) && d.route.length >= 2 ? d.route.slice()
          : [d.fromPlanetId, d.toPlanetId];
    return r.filter(Boolean);
  }
  function progress(d, now){
    var dur = Math.max(1, (Number(d.eta)||0) - (Number(d.sentAt)||0));
    return Math.max(0, Math.min(1, (now - (Number(d.sentAt)||now)) / dur));
  }
  function etaText(d, now){
    var s = Math.max(0, Math.ceil(((Number(d.eta)||0) - now)/1000));
    if (s >= 60) return Math.floor(s/60)+'м '+('0'+(s%60)).slice(-2)+'с';
    return s+'с';
  }
  function phaseOf(id){
    var h = 0, s = String(id||'');
    for (var i=0;i<s.length;i++) h = (h*31 + s.charCodeAt(i)) >>> 0;
    return (h % 6283) / 1000;
  }

  /* ---------------- геометрия полилинии ---------------- */
  function polyLens(pts){
    var lens = [], total = 0;
    for (var i=0;i<pts.length-1;i++){
      var l = Math.hypot(pts[i+1].x-pts[i].x, pts[i+1].y-pts[i].y);
      lens.push(l); total += l;
    }
    return { lens: lens, total: total };
  }
  function pointAt(pts, geo, dist){
    var d = Math.max(0, Math.min(geo.total, dist));
    for (var i=0;i<geo.lens.length;i++){
      if (d <= geo.lens[i] || i === geo.lens.length-1){
        var t = geo.lens[i] > 0 ? Math.min(1, d/geo.lens[i]) : 0;
        return {
          x: pts[i].x + (pts[i+1].x-pts[i].x)*t,
          y: pts[i].y + (pts[i+1].y-pts[i].y)*t,
          dx: (pts[i+1].x-pts[i].x) || 1e-6,
          dy: (pts[i+1].y-pts[i].y) || 0
        };
      }
      d -= geo.lens[i];
    }
    var last = pts[pts.length-1];
    return { x:last.x, y:last.y, dx:1, dy:0 };
  }
  /* подрезать концы маршрута до кромки планет (a — старт, b — финиш) */
  function subPoly(pts, geo, a, b){
    var out = [pointAt(pts, geo, a)];
    var cum = 0;
    for (var i=0;i<geo.lens.length;i++){
      if (cum + geo.lens[i] > a + 1 && cum + geo.lens[i] < b - 1) out.push({ x: pts[i+1].x, y: pts[i+1].y });
      cum += geo.lens[i];
    }
    out.push(pointAt(pts, geo, b));
    return out;
  }

  /* ---------------- отрисовка одного рейса ---------------- */
  function drawRun(ctx, pts, d, opts){
    if (!pts || pts.length < 2) return;
    var now = opts.now, perf = opts.perf;
    var prog = progress(d, now);
    var geoFull = polyLens(pts);
    if (!(geoFull.total > 4)) return;
    var col = cargoColor(d);
    var ph = phaseOf(d.id);
    var A = Math.max(0.25, Math.min(1, opts.alpha));
    var size = Math.max(4, opts.size);

    /* подрезка до кромок планет */
    var rimA = Math.min(opts.rimA || 10, geoFull.total*0.32);
    var rimB = Math.min(opts.rimB || 10, geoFull.total*0.32);
    var pts2 = subPoly(pts, geoFull, rimA, geoFull.total - rimB);
    var geo = polyLens(pts2);
    if (!(geo.total > 3)){ pts2 = pts; geo = geoFull; }

    var pos = pointAt(pts2, geo, prog * geo.total);
    var ang = Math.atan2(pos.dy, pos.dx);
    var nx = -Math.sin(ang), ny = Math.cos(ang);
    var bob = RM() ? 0 : Math.sin(perf/380 + ph*6.28) * Math.min(2.2, size*0.28);
    var px = pos.x + nx*bob, py = pos.y + ny*bob;

    ctx.save();

    /* --- маршрутная линия: бегущий пунктир --- */
    ctx.globalAlpha = A;
    ctx.beginPath();
    ctx.moveTo(pts2[0].x, pts2[0].y);
    for (var i=1;i<pts2.length;i++) ctx.lineTo(pts2[i].x, pts2[i].y);
    ctx.setLineDash([5, 9]);
    ctx.lineDashOffset = RM() ? 0 : -perf/26;
    ctx.strokeStyle = hexa(col, 0.38*A);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.setLineDash([]);

    /* --- промежуточные пересадки --- */
    for (var w=1; w<pts.length-1; w++){
      ctx.beginPath();
      ctx.moveTo(pts[w].x, pts[w].y-3); ctx.lineTo(pts[w].x+3, pts[w].y);
      ctx.lineTo(pts[w].x, pts[w].y+3); ctx.lineTo(pts[w].x-3, pts[w].y);
      ctx.closePath();
      ctx.fillStyle = hexa(col, 0.55*A);
      ctx.fill();
    }

    /* --- кильватерный след --- */
    var tailFrac = Math.min(0.22, 46/Math.max(1,geo.total));
    var tailFrom = Math.max(0, prog - tailFrac);
    if (prog > 0.001){
      ctx.globalCompositeOperation = 'lighter';
      var steps = 10;
      for (var s2=0; s2<steps; s2++){
        var t0 = tailFrom + (prog - tailFrom) * (s2/steps);
        var t1 = tailFrom + (prog - tailFrom) * ((s2+1)/steps);
        if (t1 <= t0) continue;
        var q0 = pointAt(pts2, geo, t0*geo.total), q1 = pointAt(pts2, geo, t1*geo.total);
        var fade = (s2+1)/steps;
        ctx.beginPath();
        ctx.moveTo(q0.x, q0.y); ctx.lineTo(q1.x, q1.y);
        ctx.strokeStyle = hexa(col, 0.2*A*fade);
        ctx.lineWidth = Math.max(1, size*0.5*fade);
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
    }

    /* --- кольцо отлёта у кромки источника --- */
    if (prog < 0.10){
      var rp = (0.10 - prog)/0.10;
      var rr = size*0.8 + (1-rp)*size*3.4;
      ctx.beginPath();
      ctx.arc(pts2[0].x, pts2[0].y, rr, 0, Math.PI*2);
      ctx.strokeStyle = hexa(col, 0.6*rp*A);
      ctx.lineWidth = 1.6;
      ctx.stroke();
    }
    /* --- пульс прибытия у кромки цели --- */
    if (prog > 0.90){
      var ap = (prog - 0.90)/0.10;
      var pr = RM() ? 0.5 : 0.5 + 0.5*Math.sin(perf/120);
      var lp = pts2[pts2.length-1];
      ctx.beginPath();
      ctx.arc(lp.x, lp.y, size*1.2 + ap*size*2.4 + pr*2, 0, Math.PI*2);
      ctx.strokeStyle = hexa('#7ee08a', (0.22 + 0.4*ap)*A);
      ctx.lineWidth = 1.4;
      ctx.stroke();
    }

    /* --- корпус корабля --- */
    ctx.translate(px, py);
    ctx.rotate(ang);
    var eg = ctx.createRadialGradient(-size*0.7, 0, 0, -size*0.7, 0, size*1.5);
    var flick = RM() ? 1 : 0.75 + 0.25*Math.sin(perf/70 + ph*10);
    eg.addColorStop(0, hexa(col, 0.85*A*flick));
    eg.addColorStop(0.4, hexa(col, 0.28*A*flick));
    eg.addColorStop(1, hexa(col, 0));
    ctx.fillStyle = eg;
    ctx.beginPath();
    ctx.arc(-size*0.7, 0, size*1.5, 0, Math.PI*2);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(size*1.15, 0);
    ctx.lineTo(-size*0.55, size*0.52);
    ctx.lineTo(-size*0.28, 0);
    ctx.lineTo(-size*0.55, -size*0.52);
    ctx.closePath();
    var hg = ctx.createLinearGradient(-size, 0, size, 0);
    hg.addColorStop(0, 'rgba(160,190,210,'+(0.9*A)+')');
    hg.addColorStop(1, 'rgba(240,250,255,'+(0.95*A)+')');
    ctx.fillStyle = hg;
    ctx.fill();
    ctx.strokeStyle = hexa(col, 0.9*A);
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(size*0.32, 0, Math.max(1, size*0.18), 0, Math.PI*2);
    ctx.fillStyle = 'rgba(120,225,255,'+(0.95*A)+')';
    ctx.fill();
    ctx.restore();

    /* --- подпись у борта --- */
    if (opts.labels){
      var mass = Number(d.mass)||0;
      var txt = '⏱ ' + etaText(d, now) + (mass > 0 ? ' · ' + fmt(mass) + ' т' : '');
      ctx.save();
      ctx.globalAlpha = A;
      ctx.font = '600 9.5px system-ui,sans-serif';
      ctx.textAlign = 'center';
      var tw = ctx.measureText(txt).width;
      ctx.fillStyle = 'rgba(3,9,20,.72)';
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(px-tw/2-4, py+size*0.9, tw+8, 13, 4);
      else ctx.rect(px-tw/2-4, py+size*0.9, tw+8, 13);
      ctx.fill();
      ctx.fillStyle = hexa(col, 0.95);
      ctx.fillText(txt, px, py+size*0.9+9.5);
      ctx.restore();
    }
    return { x: px, y: py };
  }

  /* ---------------- вспышки прибытия ---------------- */
  var bursts = [];
  var tracked = {};
  var lastIds = {};

  function spawnBurst(x, y, col, view){
    bursts.push({ x:x, y:y, at: performance.now(), col: col||'#7ee08a', view: view||'3d' });
    if (bursts.length > 24) bursts.shift();
  }
  function drawBursts(ctx, perf, alpha, view){
    for (var i=bursts.length-1;i>=0;i--){
      var b = bursts[i];
      var t = (perf - b.at)/850;
      if (t >= 1){ bursts.splice(i,1); continue; }
      if (view && b.view !== view) continue;
      var A = (1-t)*(alpha||1);
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.beginPath();
      ctx.arc(b.x, b.y, 6 + t*30, 0, Math.PI*2);
      ctx.strokeStyle = hexa(b.col, 0.7*A); ctx.lineWidth = 2.2*(1-t)+0.4; ctx.stroke();
      ctx.beginPath();
      ctx.arc(b.x, b.y, 2 + t*16, 0, Math.PI*2);
      ctx.strokeStyle = hexa('#ffffff', 0.5*A); ctx.lineWidth = 1.2; ctx.stroke();
      for (var s=0;s<6;s++){
        var a2 = s*Math.PI/3 + (RM() ? 0 : t*1.7);
        var r2 = 8 + t*26;
        ctx.beginPath();
        ctx.arc(b.x + Math.cos(a2)*r2, b.y + Math.sin(a2)*r2, 1.6*(1-t)+0.4, 0, Math.PI*2);
        ctx.fillStyle = hexa(b.col, 0.8*A);
        ctx.fill();
      }
      ctx.restore();
    }
  }
  function detectArrivals(){
    var ds = deliveries(), now = {};
    for (var i=0;i<ds.length;i++) now[ds[i].id] = 1;
    for (var id in lastIds){
      if (!now[id]){
        var tp = tracked[id];
        if (tp) spawnBurst(tp.x, tp.y, tp.col, tp.view);
        delete tracked[id];
      }
    }
    lastIds = now;
  }

  /* ================= 3D-карта галактики (cc-map) ================= */

  function drawShips3D(projected){
    if (!CFG.ships || !projected) return;
    var cv = $('cc-map-canvas'); if (!cv) return;
    var ctx = cv.getContext('2d'); if (!ctx) return;
    var ds = deliveries();
    var now = Date.now(), perf = performance.now();
    var zoom = 1;
    try { zoom = (window.ccPlanetMapState && window.ccPlanetMapState.zoom) || 1; } catch(e){}
    var zoomC = Math.max(0.65, Math.min(1.5, zoom));
    detectArrivals();
    var drawn = [];
    for (var i=0;i<ds.length;i++){
      var d = ds[i];
      var pids = routePids(d);
      var pts = [], pfs = [], depths = [];
      for (var j=0;j<pids.length;j++){
        var pr = projected[pids[j]];
        if (!pr) continue;
        pts.push({ x: pr.x, y: pr.y });
        pfs.push(Number(pr.pf)||1);
        depths.push(Number(pr.depth)||0);
      }
      if (pts.length < 2) continue;
      var prog = progress(d, now);
      var segI = Math.min(pfs.length-1, Math.floor(prog*(pfs.length-1)));
      var pf = ((pfs[segI]+pfs[Math.min(pfs.length-1,segI+1)])/2) || 1;
      var dep = ((depths[segI]+depths[Math.min(depths.length-1,segI+1)])/2) || 0;
      var mass = Number(d.mass)||0;
      var size = (5.0 + Math.min(3.4, mass/1000)) * Math.max(0.8, Math.min(1.7, pf*zoomC));
      var alpha = Math.max(0.4, Math.min(1, 1 - dep/70));
      /* кромки планет: радиус диска как в родном рендере + ореол */
      var rim = function(pfv){ return Math.max(6, 13*pfv*zoomC) + 7; };
      drawRun(ctx, pts, d, {
        size: size, alpha: alpha, labels: zoom > 0.8, now: now, perf: perf,
        rimA: rim(pfs[0]), rimB: rim(pfs[pfs.length-1])
      });
      drawn.push({ id: d.id, prog: Math.round(prog*100)/100 });
      tracked[d.id] = { x: pts[pts.length-1].x, y: pts[pts.length-1].y, col: cargoColor(d), view: '3d' };
    }
    if (bursts.length) drawBursts(ctx, perf, 1, '3d');
    if (window.__shipViz) window.__shipViz._last3D = { at: perf, ships: drawn, bursts: bursts.length };
  }

  /* ================= 2D-карта сектора (map2d) ================= */
  function drawShips2D(){
    if (!CFG.ships) return;
    var M2 = window.__V && window.__V.map2d;
    if (!M2 || !M2.view || !M2.project) return;
    var cv = $('map2d-canvas'); if (!cv) return;
    var ctx = cv.getContext('2d'); if (!ctx) return;
    var g = window.GAME && window.GAME.PlanetaryGraph; if (!g || !g.nodes) return;
    var ds = deliveries();
    var now = Date.now(), perf = performance.now();
    var scale = Number(M2.view.scale)||1;
    var drawn = [];
    for (var i=0;i<ds.length;i++){
      var d = ds[i];
      var pids = routePids(d), pts = [], rims = [];
      for (var j=0;j<pids.length;j++){
        var nd = g.nodes[pids[j]];
        if (!nd) continue;
        pts.push(M2.project(nd.x||0, nd.z||0, cv));
        var pl = window.GAME.PLANETS[pids[j]];
        var idx = (pl && pl.planetIndex) || 1;
        var rr = (pids[j] === S.activePlanetId) ? 11 : Math.max(5, 4+Math.sqrt(idx)*0.9);
        rims.push(rr + 6);
      }
      if (pts.length < 2) continue;
      var size = (4.8 + Math.min(3, (Number(d.mass)||0)/1200)) * Math.max(0.8, Math.min(1.8, scale));
      drawRun(ctx, pts, d, {
        size: size, alpha: 0.95, labels: scale > 0.75, now: now, perf: perf,
        rimA: rims[0], rimB: rims[rims.length-1]
      });
      drawn.push({ id: d.id });
      tracked[d.id] = { x: pts[pts.length-1].x, y: pts[pts.length-1].y, col: cargoColor(d), view: '2d' };
    }
    if (bursts.length) drawBursts(ctx, perf, 0.95, '2d');
    if (window.__shipViz) window.__shipViz._last2D = { at: perf, ships: drawn };
  }

  /* ================= движок перерисовки ================= */
  var last2d = 0, last3d = 0;
  function map2dOpen(){
    var m = $('map2d-modal');
    return !!(m && m.style.display === 'block');
  }
  function ccMapOpen(){
    var m = $('cc-map-modal');
    return !!(m && m.classList && m.classList.contains('open'));
  }
  function frameTick(){
    try {
      var nowMs = performance.now();
      var live = true;
      try { live = !!(S.settings && S.settings.liveGalaxy !== false); } catch(e){}
      var busy = deliveries().length > 0 || bursts.length > 0;
      /* 3D: если родной rAF-цикл галактики выключен настройкой — крутим сами */
      if (ccMapOpen() && busy && !live && nowMs - last3d > 55){
        last3d = nowMs;
        try { window.ccPlanetMap && window.ccPlanetMap.draw && window.ccPlanetMap.draw(); } catch(e){}
      }
      /* 2D: своего цикла нет вовсе — redraw + корабли поверх */
      if (map2dOpen() && busy && nowMs - last2d > 45){
        last2d = nowMs;
        try { window.drawGalaxy2D && window.drawGalaxy2D(); } catch(e){}
      }
    } catch(e){}
  }

  /* ================= кнопки-переключатели ================= */
  function makeToggle(host, css, title){
    if (!host) return null;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'shipviz-toggle';
    b.setAttribute('aria-label', 'Слой кораблей');
    b.style.cssText = css;
    host.appendChild(b);
    function paint(){
      b.textContent = '🚢';
      b.style.opacity = CFG.ships ? '1' : '0.4';
      b.style.filter = CFG.ships ? 'none' : 'grayscale(1)';
      b.title = title + (CFG.ships ? 'вкл' : 'выкл');
    }
    b.addEventListener('click', function(ev){
      ev.preventDefault(); ev.stopPropagation();
      CFG.ships = !CFG.ships; saveCfg(); paint();
      try { if (map2dOpen()) window.drawGalaxy2D && window.drawGalaxy2D(); } catch(e){}
      try { if (ccMapOpen()) window.ccPlanetMap && window.ccPlanetMap.draw && window.ccPlanetMap.draw(); } catch(e){}
    });
    paint();
    return b;
  }
  function installToggles(){
    if (!$('shipviz-t3d')){
      var panel = $('cc-map-panel');
      var b3 = makeToggle(panel,
        'position:absolute;top:15px;right:65px;z-index:5;width:40px;height:40px;border:0;border-radius:20px;'+
        'background:rgba(9,24,38,.85);box-shadow:inset 0 0 0 1px rgba(90,205,255,.25);color:#bfe9ff;'+
        'font-size:17px;cursor:pointer;pointer-events:auto;', 'Корабли по маршрутам: ');
      if (b3) b3.id = 'shipviz-t3d';
    }
    if (!$('shipviz-t2d')){
      var modal2 = $('map2d-modal');
      var b2 = makeToggle(modal2,
        'position:absolute;top:10px;right:118px;z-index:3;padding:6px 10px;border-radius:16px;'+
        'background:rgba(6,16,25,.92);border:1px solid #2f6a86;color:#9fdcef;font-size:11px;font-weight:700;cursor:pointer;',
        'Корабли по маршрутам: ');
      if (b2) b2.id = 'shipviz-t2d';
    }
  }

  /* ================= hookup ================= */
  function hook(){
    var H = window.__VORONIA_HOOKS = window.__VORONIA_HOOKS || {};
    /* слой кораблей — внутри кадра галактики: после эхо-дуг, до дисков планет.
       Подрезка маршрутов до кромки планет (rimA/rimB) гарантирует, что корабль
       виден на всём пути отлёта/прибытия, а не «под» планетой. */
    var origArcs = H.postEchoArcs;
    H.postEchoArcs = function(projected){
      var r;
      try { r = origArcs && origArcs(projected); } catch(e){}
      try { drawShips3D(projected); } catch(e){}
      return r;
    };
    var origFrame = H.postFrame;
    H.postFrame = function(){
      try { origFrame && origFrame(); } catch(e){}
      frameTick();
    };

    /* 2D: оборачиваем штатную отрисовку — корабли поверх карты */
    if (typeof window.drawGalaxy2D === 'function' && !window.drawGalaxy2D.__shipWrapped){
      var origDraw = window.drawGalaxy2D;
      var wrapped = function(){
        var r = origDraw.apply(this, arguments);
        try { detectArrivals(); drawShips2D(); } catch(e){}
        return r;
      };
      wrapped.__shipWrapped = true;
      window.drawGalaxy2D = wrapped;
    }

    try {
      V.bus && V.bus.on && V.bus.on('transport:changed', function(){
        try { detectArrivals(); } catch(e){}
      });
    } catch(e){}
  }

  function boot(){
    try { hook(); } catch(e){}
    installToggles();
    setInterval(function(){ try { installToggles(); } catch(e){} }, 2500);
    setInterval(function(){ try { detectArrivals(); } catch(e){} }, 1500);

    window.__shipViz = {
      cfg: CFG,
      toggle: function(){ CFG.ships = !CFG.ships; saveCfg(); try{ if (ccMapOpen()) window.ccPlanetMap.draw(); if (map2dOpen()) window.drawGalaxy2D(); }catch(e){} return CFG.ships; },
      draw3D: drawShips3D,
      draw2D: drawShips2D,
      burst: function(x,y,col){ spawnBurst(x,y,col,'3d'); },
      _last3D: null, _last2D: null,
      version: '0.0.21.0'
    };
    try { console.info('[ship-traffic] v0.0.21 готов. Открой карту галактики — корабли в пути. __shipViz.toggle()'); } catch(e){}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 0);
})();
