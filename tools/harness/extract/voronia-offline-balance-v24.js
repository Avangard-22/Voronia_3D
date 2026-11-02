
/* Voronia v0.0.24 — one authoritative offline-income cap.
   Time cap and payout efficiency are deliberately separate systems. */
(function(){
  'use strict';
  var BASE = 3 * 3600, HARD_CAP = 12 * 3600;
  function state(){ return window.__V && window.__V.state || {}; }
  function dust(id){
    try { if (window.__V && window.__V.economy && typeof window.__V.economy.hasPerk === 'function') return !!window.__V.economy.hasPerk(id); } catch(e){}
    var s=state(); return !!(s.dustPerks && s.dustPerks[id]);
  }
  function research(id){
    try { if (window.__V && window.__V.evcombo && typeof window.__V.evcombo.hasResearch === 'function') return !!window.__V.evcombo.hasResearch(id); } catch(e){}
    var s=state(), p=s.researchPerks;
    return Array.isArray(p) ? p.indexOf(id)>=0 : !!(p && p[id]);
  }
  function metaLevel(){ var s=state(); return Math.max(0, Math.min(10, Number(s.metaPerks && s.metaPerks.sleep)||0)); }
  function cap(){
    var dustMult = dust('offline3') ? 2 : (dust('offline2') ? 1.5 : (dust('offline1') ? 1.25 : 1));
    var researchMult = research('boost_offline2') ? 1.5 : (research('boost_offline1') ? 1.25 : 1);
    var metaMult = 1 + metaLevel() * 0.05;
    return Math.min(HARD_CAP, Math.max(BASE, Math.round(BASE * dustMult * researchMult * metaMult)));
  }
  window.__voroniaOfflineV24 = {version:'0.0.24', baseSeconds:BASE, hardCapSeconds:HARD_CAP, cap:cap, details:function(){
    return {baseSeconds:BASE, capSeconds:cap(), hardCapSeconds:HARD_CAP,
      dustMultiplier:dust('offline3')?2:(dust('offline2')?1.5:(dust('offline1')?1.25:1)),
      researchMultiplier:research('boost_offline2')?1.5:(research('boost_offline1')?1.25:1),
      metaLevel:metaLevel(), metaMultiplier:1+metaLevel()*.05};
  }};
  /* Keep balance configuration and visible tree descriptions aligned. */
  try { if (window.VORONIA_BALANCE && window.VORONIA_BALANCE.offline) window.VORONIA_BALANCE.offline.maxSeconds=HARD_CAP; } catch(e){}
  try { if (window.__V && window.__V.state && window.__V.state.offlinePendingSeconds>cap()) window.__V.state.offlinePendingSeconds=cap(); } catch(e){}
  try { console.info('[Voronia] offline balance v0.0.24 ready', cap()); } catch(e){}
})();
