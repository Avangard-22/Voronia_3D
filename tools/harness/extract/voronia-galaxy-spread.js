
/* ============================================================================
 * Voronia · Разлёт галактики (v0.0.21.1)
 *
 *  С v0.0.21.1 новые планеты спавнятся во всём диске (outerRadius 30→95,
 *  MIN_DIST 4→9, эксклюзия от старта 9→24), а рукава отрисовываются до кромки
 *  диска планет. Старые сейвы хранят прежние координаты в графе — для них
 *  здесь опциональная пересборка:
 *
 *    __galaxySpread.rescatter()   — пересчитать позиции ВСЕХ не-стартовых
 *                                   планет по новым правилам (спросит подтвер-
 *                                   ждение; сначала сделайте экспорт сейва!).
 *                                   Побочный эффект: armId планет пересчиты-
 *                                   вается от новой позиции, поэтому профиль
 *                                   Хранителя (ключ климат:поверхность:рукав:
 *                                   роль) может «переехать» на новый — уровни
 *                                   стражи обнулятся у переехальных планет.
 *                                   Ресурсы перероллятся с сохранением добычи
 *                                   жил (паттерн штатной миграции v4).
 *    __galaxySpread.stats()       — радиусы/дистанции текущей галактики.
 *
 *  Плюс церемония: тост и подсветка при открытии «Последней Воронии».
 * ========================================================================== */
(function () {
  'use strict';
  var V = window.__V || {}, S = V.state || {}, L = V.legacy || {};
  var CORE = V.core || {};

  function toast(h,k,ms){ try { window.showToast && window.showToast(h,k||'',ms||6000); } catch(e){} }
  function reqSave(){ try { window.requestSave && window.requestSave(); } catch(e){} }
  function ext(name, dflt){
    try {
      if (CORE.registerExtension) return CORE.registerExtension(name, dflt||{});
      var e = CORE.extensions || (CORE.extensions = {});
      if (!e[name] || typeof e[name] !== 'object') e[name] = JSON.parse(JSON.stringify(dflt||{}));
      return e[name];
    } catch(err){ return JSON.parse(JSON.stringify(dflt||{})); }
  }
  function lvIndex(){
    try {
      var b = window.VORONIA_BALANCE;
      return (b && b.planet && b.planet.lastVoronia && b.planet.lastVoronia.index) || 15;
    } catch(e){ return 15; }
  }

  /* ---------------- статистика разлёта ---------------- */
  function stats(){
    var g = L.GAME && L.GAME.PlanetaryGraph;
    if (!g) return null;
    var radii = [], pts = [];
    try {
      S.unlockedPlanets.forEach(function(pid){
        var nd = g.nodes[pid]; if (!nd) return;
        var r = Math.hypot(nd.x||0, nd.z||0);
        radii.push({ id: pid, r: Math.round(r*10)/10 });
        pts.push({ id: pid, x: nd.x||0, z: nd.z||0 });
      });
    } catch(e){}
    var minPair = Infinity;
    for (var i=0;i<pts.length;i++) for (var j=i+1;j<pts.length;j++){
      minPair = Math.min(minPair, Math.hypot(pts[i].x-pts[j].x, pts[i].z-pts[j].z));
    }
    var gen = (window.VORONIA_BALANCE && window.VORONIA_BALANCE.galaxy && window.VORONIA_BALANCE.galaxy.gen) || {};
    return {
      outerRadius: gen.outerRadius, minDist: (window.VORONIA_BALANCE.galaxy.nodeRender||{}).MIN_DIST,
      planets: radii.sort(function(a,b){ return a.r-b.r; }),
      maxR: radii.length ? radii[radii.length-1].r : 0,
      minPair: isFinite(minPair) ? Math.round(minPair*10)/10 : 0
    };
  }

  /* ---------------- пересборка позиций (opt-in) ---------------- */
  function rescatter(force){
    if (!force && !window.confirm(
      'Пересобрать разлёт галактики по правилам v0.0.21.1?\n\n' +
      'Планеты получат новые позиции и рукава; профили Хранителя привязаны к рукаву — ' +
      'у «переехавших» планет уровень стражи может сброситься.\n' +
      'Рекомендуется сначала сделать экспорт сейва в настройках.')) return 0;
    var g = L.GAME && L.GAME.PlanetaryGraph;
    if (!g || !L.galaxyPlace) return 0;
    var order = [];
    try {
      order = Object.keys(L.PLANETS).filter(function(pid){
        return pid !== 'ferrum' && pid !== 'krios' && S.unlockedPlanets.has(pid) && g.nodes[pid];
      }).sort(function(a,b){
        return (L.planetIndexFromId(a)||99) - (L.planetIndexFromId(b)||99);
      });
    } catch(e){ return 0; }
    var accum = {};
    ['ferrum','krios'].forEach(function(pid){ if (g.nodes[pid]) accum[pid] = g.nodes[pid]; });
    var moved = 0;
    order.forEach(function(pid){
      var pl = L.PLANETS[pid], nd = g.nodes[pid];
      if (!pl || !nd) return;
      var pos = L.galaxyPlace((pl.seed||0)>>>0, accum);
      if (!pos) return;
      nd.x = pos.x; nd.y = pos.y; nd.z = pos.z;
      nd.armId = L.armIdForPos(nd);
      pl.armId = nd.armId;
      /* переролл ресурсов с сохранением добычи жил (как штатная миграция v4) */
      try {
        var iy = {}, ky = {};
        (pl.cells||[]).forEach(function(c){ if (c){ iy[c.id] = c.ironYield; ky[c.id] = c.kriogenYield; } });
        pl._assignResources(false);
        (pl.cells||[]).forEach(function(c){ if (c){ c.ironYield = iy[c.id]; c.kriogenYield = ky[c.id]; } });
        if (window.__vorRepair) window.__vorRepair.planet(pl);
      } catch(e){}
      accum[pid] = nd;
      moved++;
    });
    if (moved){
      var st = ext('galaxySpread_v1', { rescatteredAt: 0 });
      st.rescatteredAt = Date.now();
      reqSave();
      try { if (window.ccPlanetMap && window.ccPlanetMap.draw) window.ccPlanetMap.draw(); } catch(e){}
      try { if (window.drawGalaxy2D) window.drawGalaxy2D(); } catch(e){}
      toast('🌌 <b>Галактика пересобрана</b><br><span style="font-size:11px;">Планеты разлетелись по диску (макс. радиус ' +
        (stats() ? stats().maxR : '?') + '). Откройте карту галактики.</span>','success',8000);
    }
    return moved;
  }

  /* ---------------- церемония «Последней Воронии» ---------------- */
  function watchDiscovery(){
    try {
      V.bus && V.bus.on && V.bus.on('planet:discovered', function(ev){
        try {
          var d = (ev && (ev.detail || ev)) || {};
          if ((d.index|0) === lvIndex()){
            setTimeout(function(){
              toast('✦ <b>Последняя Ворония</b><br><span style="font-size:11px;color:#e0c8ff;">'+
                'Финальный осколок родного мира: открытие стоило гроши, а внутри — все семь ресурсов галактики. '+
                'Рукав Бездны принимает тебя домой.</span>','success',12000);
              try { V.media && V.media.SFX && V.media.SFX.prestige && V.media.SFX.prestige(); } catch(e){}
              try { V.media && V.media.vibrate && V.media.vibrate([60,40,60,40,120]); } catch(e){}
            }, 600);
          }
        } catch(e){}
      });
    } catch(e){}
  }

  function boot(){
    watchDiscovery();
    window.__galaxySpread = {
      stats: stats,
      rescatter: rescatter,
      lvIndex: lvIndex,
      version: '0.0.21.1'
    };
    try { console.info('[galaxy-spread] v0.0.21.1: __galaxySpread.stats() / .rescatter() — пересборка разлёта для старых сейвов'); } catch(e){}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 0);
})();
