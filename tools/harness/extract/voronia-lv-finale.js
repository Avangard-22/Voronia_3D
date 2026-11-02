
/* ============================================================================
 * Voronia · ФИНАЛ НА ПОСЛЕДНЕЙ ВОРОНИИ (v0.0.26.0) — План v25→v26, пункт C-7.
 *
 *  · «Последняя Ворония» (индекс 15) становится площадкой финальной церемонии:
 *    showFinalFragmentCeremony открывается только стоя на ней — финал получает
 *    место и цену-путешествие, а не кнопку из меню.
 *  · Новое условие финала: «Последняя Ворония найдена» (6-е условие, бандл).
 *  · Награда за церемонию, совершённую на LV: постоянное благо
 *    «✦ ПАМЯТЬ ВОРОНИИ» = +10% ко всему доходу (extension lvBoon_v1,
 *    хук дохода в бандле: Tp() * __voroniaBoonMult()).
 *
 *  Схема 39 не тронута. Откат: удалить скрипт + расширение (благо исчезнет).
 * ========================================================================== */
(function () {
  'use strict';
  var V = window.__V || {}, S = V.state || {}, L = V.legacy || {};
  var CORE = V.core || {};

  function $(id){ return document.getElementById(id); }
  function toast(h,k,ms){ try { window.showToast && window.showToast(h,k||'',ms||7000); } catch(e){} }
  function warn(h){ try { L.showWarning && L.showWarning(h); } catch(e){} }
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
  function lvPlanet(){
    try {
      var ids = Object.keys(L.PLANETS || {});
      for (var i=0;i<ids.length;i++){
        var pl = L.PLANETS[ids[i]];
        if (pl && (pl.planetIndex||0) === lvIndex() && S.unlockedPlanets && S.unlockedPlanets.has(ids[i])) return pl;
      }
    } catch(e){}
    return null;
  }
  function boon(){ return ext('lvBoon_v1', { granted: 0, mult: 1 }); }

  /* множитель дохода: читается бандлом (Tp() * __voroniaBoonMult()) */
  function boonMult(){
    var b = boon();
    return (b.granted && typeof b.mult === 'number' && b.mult > 0) ? b.mult : 1;
  }
  window.__voroniaBoonMult = boonMult;

  /* ---------------- площадка церемонии ---------------- */
  function gateCeremony(){
    try {
      var P = window.__V.panels;
      if (!P || !P.showFinalFragmentCeremony || P.showFinalFragmentCeremony.__lvWrapped) return;
      var orig = P.showFinalFragmentCeremony;
      P.showFinalFragmentCeremony = function(){
        var lv = lvPlanet();
        if (!lv){
          warn('🌑 Финальная церемония ждёт тебя на «Последней Воронии» — мир индекса ' + lvIndex() + ' ещё не найден.');
          return;
        }
        if (S.activePlanetId !== lv.id){
          warn('🌑 Церемония имени совершается только на «Последней Воронии». Перелети на неё и попробуй снова.');
          return;
        }
        return orig.apply(this, arguments);
      };
      P.showFinalFragmentCeremony.__lvWrapped = true;
    } catch(e){}
  }

  /* ---------------- выдача блага после церемонии ---------------- */
  function checkGrant(){
    try {
      var b = boon();
      if (b.granted) return;
      var opened = false;
      try { opened = !!(L.finalFragmentOpen && L.finalFragmentOpen()); } catch(e){}
      if (!opened) return;
      var lv = lvPlanet();
      if (!lv) return;
      b.granted = Date.now();
      b.mult = 1.10;
      reqSave();
      try { L.recomputeIncome && L.recomputeIncome(); } catch(e){}
      try { L.updateUI && L.updateUI(); } catch(e){}
      toast('✦ <b>ПАМЯТЬ ВОРОНИИ</b><br><span style="font-size:11px;color:#ffda47;">'+
        'Церемония имени совершена на Последней Воронии. Постоянное благо: +10% ко всему доходу, навсегда, сквозь все циклы.</span>',
        'success', 12000);
      try { V.media && V.media.SFX && V.media.SFX.prestige && V.media.SFX.prestige(); } catch(e){}
    } catch(e){}
  }

  function status(){
    var b = boon();
    return {
      lvFound: !!lvPlanet(),
      lvIndex: lvIndex(),
      onLv: !!(lvPlanet() && S.activePlanetId === lvPlanet().id),
      finalOpen: (function(){ try { return !!(L.finalFragmentOpen && L.finalFragmentOpen()); } catch(e){ return false; } })(),
      boonGranted: !!b.granted,
      boonMult: boonMult()
    };
  }

  function boot(){
    gateCeremony();
    setInterval(gateCeremony, 2000);
    setInterval(checkGrant, 1500);
    setTimeout(checkGrant, 2500);
    window.__lvFinale = { status: status, boon: boon, lvPlanet: function(){ var p = lvPlanet(); return p && p.id; }, version: '0.0.26.0' };
    try { console.info('[lv-finale] v0.0.26: церемония — на Последней Воронии; благо +10%. __lvFinale.status()'); } catch(e){}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 0);
})();
