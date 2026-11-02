
/* ============================================================================
 * Voronia · ТРОФЕИ ХРАНИТЕЛЕЙ (v0.0.27.0) — закрытие REVIEW V1/V2 аудита баланса.
 *
 * Идея: боевая петля кормит прокачку урона. За каждую победу над Хранителем
 * начисляется трофейный набор в ОТДЕЛЬНЫЙ пул (extension guardianTrophies_v1),
 * который Арсенал списывает ПЕРВЫМ, прежде чем трогать склады и сплавы.
 * Цены Арсенала не меняются (хардкор-запрос «10M+» сохранён) — меняется
 * появление ресурса: победы дают весомые куски стоимости уровней.
 *
 * Формула трофея (tier = уровень Хранителя после победы, 1..20;
 * mult = 1 + 0.15·min(12, max(0, planetIndex−3))):
 *   ⚡ energy       1.5M · (1+0.5·tier) · mult
 *   ⛏ iron         300k · (1+0.5·tier) · mult
 *   ❄ kriogen      300k · (1+0.5·tier) · mult
 *   редкие (доступные миру)  60k · (1+0.4·tier) · mult  — каждая
 *   🔩 steel / 💠 chip / ⛓ alloy   6k · (1+0.35·tier) · mult — каждый
 *   ⚛ core   600 · (1+0.35·tier) · mult ·  🔮 relic  60 · (1+0.35·tier) · mult
 *
 * Пул трофейный: в общую экономику не протекает (апгрейды клеток/склад его
 * не видят), инфляции нет. Сквозь престижи и мету сохраняется (это память
 * о победах), сбрасывается только Сбросом Вселенной/Асцензией вместе с сейвом
 * расширения — осознанно: трофеи «войны», а не цикла.
 * ========================================================================== */
(function () {
  'use strict';
  var V = window.__V || {}, S = V.state || {}, L = V.legacy || {};
  var CORE = V.core || {};

  function toast(h,k,ms){ try { window.showToast && window.showToast(h,k||'',ms||6000); } catch(e){} }
  function fmt(v){ try { return window.fmtBig ? window.fmtBig(v) : String(Math.round(v||0)); } catch(e){ return String(Math.round(v||0)); } }
  function reqSave(){ try { window.requestSave && window.requestSave(); } catch(e){} }
  function ext(name, dflt){
    try {
      if (CORE.registerExtension) return CORE.registerExtension(name, dflt||{});
      var e = CORE.extensions || (CORE.extensions = {});
      if (!e[name] || typeof e[name] !== 'object') e[name] = JSON.parse(JSON.stringify(dflt||{}));
      return e[name];
    } catch(err){ return JSON.parse(JSON.stringify(dflt||{})); }
  }

  var KEYS = ['energy','iron','kriogen','carbon','silicon','titanium','uranium','darkMatter','steel','chip','alloy','core','relic'];
  function state(){
    var s = ext('guardianTrophies_v1', { pool: {}, wins: 0 });
    if (!s.pool || typeof s.pool !== 'object') s.pool = {};
    if (typeof s.wins !== 'number') s.wins = 0;
    return s;
  }
  function pool(){ return state().pool; }

  function bundleFor(level, pidx){
    var tier = Math.max(0, Math.min(20, level|0));
    var mult = 1 + 0.15 * Math.max(0, Math.min(12, (pidx|0) - 3));
    var b = {};
    b.energy  = Math.round(1.5e6 * (1 + 0.5*tier) * mult);
    b.iron    = Math.round(3e5  * (1 + 0.5*tier) * mult);
    b.kriogen = Math.round(3e5  * (1 + 0.5*tier) * mult);
    var rare = Math.round(6e4 * (1 + 0.4*tier) * mult);
    var comp = Math.round(6e3 * (1 + 0.35*tier) * mult);
    try {
      var R = L.RESOURCES || {};
      for (var k in R){
        var r = R[k];
        if (r && r.rare > 0 && r.minPlanetIndex && r.minPlanetIndex <= (pidx|0)) b[k] = rare;
      }
    } catch(e){}
    b.steel = comp; b.chip = comp; b.alloy = comp;
    b.core  = Math.round(600 * (1 + 0.35*tier) * mult);
    b.relic = Math.round(60  * (1 + 0.35*tier) * mult);
    return b;
  }

  /* списание: трофеи первыми; возвращает остаток, который надо взять со складов */
  function spend(key, amount){
    var need = Math.max(0, Number(amount)||0);
    if (need <= 0) return 0;
    var p = pool();
    var take = Math.min(p[key]||0, need);
    if (take > 0){ p[key] = (p[key]||0) - take; }
    return need - take;
  }
  function covers(cost){
    var p = pool(), out = {};
    for (var k in cost){
      out[k] = Math.min(p[k]||0, cost[k]||0);
    }
    return out;
  }

  function onWon(ev){
    try {
      var d = (ev && (ev.detail || ev)) || {};
      var pid = d.pid; if (!pid) return;
      var pl = L.PLANETS && L.PLANETS[pid]; if (!pl) return;
      var level = (d.level|0) || 0;
      var pidx = (pl.planetIndex|0) || 1;
      var b = bundleFor(level, pidx);
      var p = pool();
      for (var k in b) p[k] = (p[k]||0) + b[k];
      var s = state();
      s.wins = (s.wins|0) + 1;
      reqSave();
      var R = L.RESOURCES || {}, C = L.COMPOUNDS || {};
      var parts = [];
      ['energy','iron','kriogen'].forEach(function(k){
        var icon = k === 'energy' ? ((window.VoroniaIcons && window.VoroniaIcons.html('energy')) || '⚡') : (R[k] && R[k].icon) || '◆';
        parts.push(icon + ' ' + fmt(b[k]));
      });
      parts.push('🔩💠⛓ ' + fmt(b.steel) + ' each');
      toast('⚑ <b>Трофей Хранителя · «' + (pl.name||pid) + '» ур.' + level + '</b><br>' +
        '<span style="font-size:11px;color:#9fdcef;">В копилку Арсенала: ' + parts.join(' · ') +
        (b.carbon ? ' · редкие ' + fmt(b.carbon) + ' each' : '') + '</span>', 'success', 6500);
      try { V.media && V.media.SFX && V.media.SFX.prestige && V.media.SFX.prestige(); } catch(e){}
    } catch(e){}
  }

  function resetPool(){
    var s = state();
    s.pool = {}; s.wins = 0;
    reqSave();
  }

  function boot(){
    try { V.bus && V.bus.on && V.bus.on('guardian:won', onWon); } catch(e){}
    /* трофеи — память войны: не стираются престижем, но мета-сбросы (Асценсия)
       очищают extensions вместе с сейвом — это ожидаемо */
    window.__trophies = {
      pool: pool,
      spend: spend,
      covers: covers,
      bundleFor: bundleFor,
      wins: function(){ return state().wins|0; },
      reset: resetPool,
      version: '0.0.27.0'
    };
    try { console.info('[trophies] v0.0.27: победы кормят Арсенал. __trophies.pool() / .wins() / .bundleFor(lvl,pidx)'); } catch(e){}
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 0);
})();
