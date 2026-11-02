
/* ============================================================================
 * Voronia · Ремонт согласованности ресурсов (v0.0.21.0) — План 33, баг №1.
 * Бандл-фикс гарантирует, что НОВЫЕ планеты рождаются с жилой под каждый
 * заявленный ресурс. Этот модуль — одноразовый ремонт СТАРЫХ сейвов:
 *  · ресурс из resourceList без жилы → конвертируем неисследованную обычную
 *    клетку в жилу (детерминированно от seed планеты);
 *  · дубли жил одного ресурса при нехватке клеток → неисследованные дубли
 *    переназначаются недостающим ресурсам;
 *  · исследованные клетки НЕ трогаются никогда (игрок уже вложился).
 * Идемпотентен: после починки следующий прогон — no-op.
 * ========================================================================== */
(function () {
  'use strict';
  var V = window.__V || {}, S = V.state || {}, L = V.legacy || {};

  function repairPlanet(pl){
    try {
      if (!pl || !pl.cells || !Array.isArray(pl.resourceList)) return 0;
      var list = pl.resourceList;
      if (!list.length) return 0;
      var isKrios = pl.biome === 'krios';
      var startId = pl.startingCellId;

      /* что уже размещено */
      function placedSet(){
        var placed = {};
        for (var i=0;i<pl.cells.length;i++){
          var c = pl.cells[i];
          if (!c) continue;
          if (c.type === 3 && c.resourceKey) placed[c.resourceKey] = (placed[c.resourceKey]||0)+1;
          if (c.type === 5) placed['kriogen'] = (placed['kriogen']||0)+1;
        }
        return placed;
      }
      var placed = placedSet();
      var missing = [];
      for (var k=0;k<list.length;k++) if (!placed[list[k]]) missing.push(list[k]);
      if (isKrios && list.indexOf('kriogen') >= 0) missing = missing.filter(function(x){ return x !== 'kriogen'; });
      if (!missing.length) return 0;

      var rnd = mulberry(((pl.seed>>>0) ^ 0x5EED17) >>> 0);
      var fixed = 0;

      /* 1) конвертация неисследованных type-0 клеток */
      var cand = [];
      for (var i2=0;i2<pl.cells.length;i2++){
        var cc = pl.cells[i2];
        if (cc && cc.type === 0 && cc.id !== startId && !pl.explored.has(cc.id) && !cc._destroyed) cand.push(cc);
      }
      while (missing.length && cand.length){
        var pick = cand.splice(Math.floor(rnd()*cand.length), 1)[0];
        var res = missing.shift();
        pick.type = 3; pick.displayType = 3; pick.yield = 0;
        pick.ironYield = res === 'kriogen' ? 0 : 0.1;
        pick.kriogenYield = res === 'kriogen' ? 0.1 : 0;
        pick.resourceKey = res;
        pick.maxReserve = 100 + Math.floor(rnd()*100);
        pick.reserve = pick.maxReserve;
        pick.cooldownUntil = 0; pick.reactCount = 0;
        fixed++;
      }

      /* 2) если обычных клеток не хватило — переназначаем неисследованные дубли жил */
      if (missing.length){
        var placed2 = placedSet();
        for (var i3=0;i3<pl.cells.length && missing.length;i3++){
          var c3 = pl.cells[i3];
          if (!c3 || c3.type !== 3 || c3.id === startId) continue;
          if (pl.explored.has(c3.id) || c3._destroyed) continue;
          var key = c3.resourceKey || 'iron';
          if ((placed2[key]|0) > 1){
            placed2[key]--;
            var res2 = missing.shift();
            c3.resourceKey = res2;
            c3.ironYield = res2 === 'kriogen' ? 0 : 0.1;
            c3.kriogenYield = res2 === 'kriogen' ? 0.1 : 0;
            placed2[res2] = (placed2[res2]|0)+1;
            fixed++;
          }
        }
      }
      return fixed;
    } catch(e){ return 0; }
  }

  function mulberry(a){
    return function(){
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function repairAll(tag){
    try {
      if (!S.started || !S.unlockedPlanets || !L.PLANETS) return 0;
      var total = 0;
      S.unlockedPlanets.forEach(function(pid){
        total += repairPlanet(L.PLANETS[pid]) || 0;
      });
      if (total > 0){
        try { L.recomputeIncome && L.recomputeIncome(); } catch(e){}
        try { L.updateUI && L.updateUI(); } catch(e){}
        try { window.requestSave && window.requestSave(); } catch(e){}
        try { console.info('[repair:'+tag+'] восстановлено жил: '+total); } catch(e){}
      }
      return total;
    } catch(e){ return 0; }
  }

  function boot(){
    try {
      V.bus && V.bus.on && V.bus.on('save:loaded', function(){ setTimeout(function(){ repairAll('save'); }, 800); });
      V.bus && V.bus.on && V.bus.on('game:started', function(){ setTimeout(function(){ repairAll('start'); }, 800); });
      /* страховка: каждая свежеоткрытая планета сразу проверяется на
         согласованность resourceList ↔ жилы (редкие гоночные пути бандла) */
      V.bus && V.bus.on && V.bus.on('planet:discovered', function(ev){
        setTimeout(function(){
          try {
            var d = (ev && (ev.detail || ev)) || {};
            var pl = d.id && L.PLANETS ? L.PLANETS[d.id] : null;
            if (pl && repairPlanet(pl)){
              try { L.recomputeIncome && L.recomputeIncome(); } catch(e){}
              try { window.requestSave && window.requestSave(); } catch(e){}
            }
          } catch(e){}
        }, 60);
      });
    } catch(e){}
    setTimeout(function(){ repairAll('boot'); }, 1500);
    setTimeout(function(){ repairAll('boot2'); }, 6000);
    window.__vorRepair = { planet: repairPlanet, all: repairAll, version: '0.0.21.0' };
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 0);
})();
