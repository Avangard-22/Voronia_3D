
/* ============================================================================
 * Voronia · Улучшения Реактора (v0.0.21.0) — План 33, вопрос №4.
 *
 *  1. Кнопка «⚗ МАТЕРИЯ» скрыта из lab-modal (модалка остаётся в DOM —
 *     ссылки не ломаются, вернуть легко). Дублировала Реактор и не знала
 *     про гелий-3/биомассу/платину.
 *  2. Мастерство крафта: счётчик единиц по каждому рецепту; пороги
 *     10/50/100/500/1000 → время синтеза −5/−10/−15/−20/−30%.
 *     Своя правка к Плану 33: множитель применяется ПРЯМО в бандле
 *     (craftTimeFor), а не подкруткой endsAt в очереди — честное время сразу
 *     видно в карточке, эффект переживает перезагрузку и офлайн-синтез.
 *  3. Сводка «Доступно сейчас» над списком рецептов.
 *  4. Пороги авто-крафта по рецептам: авто-крафт срабатывает только когда
 *     сырья скопилось на N+1 партий. Своя правка к Плану 33: гейт встроен
 *     в родной тик авто-крафта в бандле (плановый отдельный тик не глушил бы
 *     родной — порог не работал бы). Здесь — только UI и хранилище.
 *
 *  Состояние: extensions craftMastery_v1 / autoCraftThreshold_v1 (схема 39 цела).
 * ========================================================================== */
(function () {
  'use strict';
  var V = window.__V || {}, S = V.state || {}, L = V.legacy || {};
  var CORE = V.core || {};

  function $(id){ return document.getElementById(id); }
  function fmt(v){ try { return window.fmtBig ? window.fmtBig(v) : String(Math.floor(v||0)); } catch(e){ return String(v); } }
  function toast(h,k,ms){ try { window.showToast && window.showToast(h,k||'',ms||4000); } catch(e){} }
  function ext(name, dflt){
    try {
      if (CORE.registerExtension) return CORE.registerExtension(name, dflt||{});
      var e = CORE.extensions || (CORE.extensions = {});
      if (!e[name] || typeof e[name] !== 'object') e[name] = JSON.parse(JSON.stringify(dflt||{}));
      return e[name];
    } catch(err){ return JSON.parse(JSON.stringify(dflt||{})); }
  }
  function reqSave(){ try { window.requestSave && window.requestSave(); } catch(e){} }

  /* ---------------------------------------------------------- 1. Скрытие «Материя» */
  function hideMatterLink(){
    try { var b = $('lab-to-matter'); if (b && b.style.display !== 'none') b.style.display = 'none'; } catch(e){}
  }

  /* ---------------------------------------------------------- 2. Мастерство крафта */
  var MASTERY_KEY = 'craftMastery_v1';
  var TIERS = [10, 50, 100, 500, 1000];
  var TIER_MULT = [1, 0.95, 0.90, 0.85, 0.80, 0.70];
  var TIER_LABEL = ['—', '−5%', '−10%', '−15%', '−20%', '−30%'];

  function masterState(){
    var s = ext(MASTERY_KEY, { counts: {} });
    if (!s.counts || typeof s.counts !== 'object') s.counts = {};
    return s;
  }
  function masterCount(key){ return masterState().counts[key]|0; }
  function masterTier(count){
    for (var i = TIERS.length - 1; i >= 0; i--) if (count >= TIERS[i]) return i + 1;
    return 0;
  }
  function bumpMastery(key, n){
    if (!key || !(n > 0)) return;
    var s = masterState();
    var old = s.counts[key]|0;
    s.counts[key] = old + n;
    var oldT = masterTier(old), newT = masterTier(s.counts[key]);
    if (newT > oldT) {
      var c = L.COMPOUNDS && L.COMPOUNDS[key];
      toast('🧪 <b>Мастерство «' + ((c && c.name) || key) + '»</b><br>' +
        '<span style="font-size:11px;color:#7ee08a;">Тир ' + newT + ' · время синтеза ' + TIER_LABEL[newT] + '</span>',
        'success', 6000);
    }
    reqSave();
  }

  /* детектор завершения: тень по craftQueue (waiting → crafting → исчез из очереди) */
  var _shadow = new Map();
  function tickMastery(){
    var q = S.craftQueue || [];
    var seen = new Set();
    for (var i = 0; i < q.length; i++) seen.add(q[i].id);
    _shadow.forEach(function(prev, id){
      if (!seen.has(id)){
        if (prev.state === 'crafting' && Date.now() >= prev.endsAt - 1500){
          bumpMastery(prev.key, prev.count);
        }
        _shadow.delete(id);
      }
    });
    for (var j = 0; j < q.length; j++){
      var job = q[j];
      var sh = _shadow.get(job.id);
      if (!sh) _shadow.set(job.id, { key: job.key, count: job.count|0, state: job.state, endsAt: job.endsAt });
      else { sh.state = job.state; sh.endsAt = job.endsAt; sh.key = job.key; sh.count = job.count|0; }
    }
  }

  /* ---------------------------------------------------------- 3. Сводка «Доступно сейчас» */
  function allRecipeKeys(){
    try { return Object.keys(L.COMPOUNDS || {}); } catch(e){ return []; }
  }
  function maxCraftable(key){
    try {
      if (!L.recipeUnlocked || !L.recipeUnlocked(key)) return 0;
      var inputs = L.recipeInputs(key);
      if (!inputs) return 0;
      var minN = Infinity;
      for (var k in inputs){
        var need = Number(inputs[k])||0;
        if (!(need > 0)) continue;
        minN = Math.min(minN, Math.floor((Number(L.craftHave(k))||0) / need));
      }
      if (!isFinite(minN)) return 0;
      return Math.max(0, minN);
    } catch(e){ return 0; }
  }

  function ensureSummary(){
    var box = $('lab-craft-summary');
    if (box) return box;
    var lm = $('lab-modal');
    if (!lm) return null;
    box = document.createElement('div');
    box.id = 'lab-craft-summary';
    box.style.cssText = 'font-size:10.5px;line-height:1.5;color:#cdd9e1;' +
      'padding:7px 10px;margin:0 0 8px;' +
      'background:#08131c;border:1px solid #274b60;border-radius:8px;' +
      'font-family:monospace;';
    var anchor = $('lab-bonus-line');
    if (anchor && anchor.parentNode) anchor.parentNode.insertBefore(box, anchor.nextSibling);
    else {
      var list = $('lab-list');
      if (list && list.parentNode) list.parentNode.insertBefore(box, list);
      else lm.appendChild(box);
    }
    return box;
  }

  function renderSummary(){
    var box = ensureSummary();
    if (!box) return;
    var lm = $('lab-modal');
    if (!lm || lm.style.display === 'none') return;
    var parts = [];
    allRecipeKeys().forEach(function(r){
      var n = maxCraftable(r);
      if (n <= 0) return;
      var c = L.COMPOUNDS && L.COMPOUNDS[r];
      parts.push({ icon: (c && c.icon) || '◆', name: (c && c.name) || r, n: n });
    });
    if (!parts.length){
      box.innerHTML = '<span style="color:#7f9aa8;">⚠ Нет рецептов, доступных сейчас — не хватает сырья</span>';
      return;
    }
    var h = '<span style="color:#7ee08a;font-weight:800;">✅ Доступно: </span>';
    h += parts.map(function(p){
      return '<span style="color:#eaf8ff;">' + p.icon + ' ' + p.name +
        ' <b style="color:#7ee08a;">×' + fmt(p.n) + '</b></span>';
    }).join(' <span style="color:#3a4a55;">·</span> ');
    box.innerHTML = h;
  }

  /* ---------------------------------------------------------- 4. Пороги авто-крафта (UI) */
  var THRESH_KEY = 'autoCraftThreshold_v1';
  /* ровно тот список, который крутит родной авто-крафт в бандле */
  var MANAGED = ['researchDataElite','researchDataBulk','researchData','steel','chip','alloy','core','relic'];

  function threshState(){
    var s = ext(THRESH_KEY, { values: {} });
    if (!s.values || typeof s.values !== 'object') s.values = {};
    return s;
  }
  function threshFor(key){ return threshState().values[key]|0; }
  function setThresh(key, n){
    if (MANAGED.indexOf(key) < 0) return;
    var s = threshState();
    s.values[key] = Math.max(0, Math.min(9999, n|0));
    reqSave();
  }

  /* ---------------------------------------------------------- UI в карточках рецептов */
  function injectCardControls(){
    var list = $('lab-list');
    if (!list) return;
    var cards = list.querySelectorAll('.lab-row');
    for (var ci = 0; ci < cards.length; ci++){
      var card = cards[ci];
      var buy = card.querySelector('.lab-craft-btn[data-craft]');
      if (!buy) continue;
      var key = buy.getAttribute('data-craft');
      if (!key) continue;

      /* --- бейдж мастерства --- */
      var title = card.querySelector('.lab-title');
      if (title){
        var badge = title.querySelector('.mastery-badge');
        var cnt = masterCount(key), tier = masterTier(cnt), lbl = TIER_LABEL[tier];
        var txt = '×' + cnt + (tier > 0 ? (' · ' + lbl) : '');
        if (!badge){
          badge = document.createElement('span');
          badge.className = 'mastery-badge';
          badge.style.cssText = 'display:inline-block;margin-left:6px;padding:1px 6px;border-radius:6px;' +
            'font-family:monospace;font-size:9.5px;font-weight:800;vertical-align:middle;';
          title.appendChild(badge);
        }
        badge.textContent = txt;
        badge.title = 'Мастерство: ' + cnt + ' ед. синтезировано' + (tier > 0 ? (' · время синтеза ' + lbl) : ' · до −5% времени: ' + TIERS[0] + ' ед.');
        badge.style.background = tier > 0 ? 'rgba(126,224,138,.12)' : 'rgba(255,255,255,.04)';
        badge.style.border = '1px solid ' + (tier > 0 ? '#7ee08a' : '#2a3d4a');
        badge.style.color = tier > 0 ? '#7ee08a' : '#566a78';
      }

      /* --- порог авто-крафта --- */
      if (MANAGED.indexOf(key) < 0) continue;
      var row = card.querySelector('.sy-threshold-row');
      var th = threshFor(key);
      if (!row){
        row = document.createElement('div');
        row.className = 'sy-threshold-row';
        row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-top:6px;' +
          'padding-top:6px;border-top:1px dashed #16242f;font-size:10px;';
        row.innerHTML =
          '<span style="color:#91adbb;">Порог авто:</span>' +
          '<button type="button" class="sy-th-b" data-th="-10" style="width:30px;height:22px;border-radius:6px;border:1px solid #29495b;background:#10222e;color:#eaf8ff;cursor:pointer;">−10</button>' +
          '<button type="button" class="sy-th-b" data-th="-1"  style="width:24px;height:22px;border-radius:6px;border:1px solid #29495b;background:#10222e;color:#eaf8ff;cursor:pointer;">−</button>' +
          '<b class="sy-th-v" style="min-width:30px;text-align:center;font-family:monospace;"></b>' +
          '<button type="button" class="sy-th-b" data-th="1"  style="width:24px;height:22px;border-radius:6px;border:1px solid #29495b;background:#10222e;color:#eaf8ff;cursor:pointer;">+</button>' +
          '<button type="button" class="sy-th-b" data-th="10" style="width:30px;height:22px;border-radius:6px;border:1px solid #29495b;background:#10222e;color:#eaf8ff;cursor:pointer;">+10</button>' +
          '<span class="sy-th-hint" style="color:#5f7785;margin-left:auto;font-style:italic;"></span>';
        row.addEventListener('click', function(ev){
          var b = ev.target.closest('[data-th]');
          if (!b) return;
          var k2 = this.getAttribute('data-th-key');
          var d = Number(b.getAttribute('data-th'))|0;
          setThresh(k2, threshFor(k2) + d);
          paintThreshRow(this, k2);
        });
        row.setAttribute('data-th-key', key);
        var craftRow = card.querySelector('.lab-craft-row');
        if (craftRow && craftRow.parentNode) craftRow.parentNode.insertBefore(row, craftRow.nextSibling);
        else { var body = card.querySelector('.lab-body'); if (body) body.appendChild(row); }
      }
      paintThreshRow(row, key);
    }
  }
  function paintThreshRow(row, key){
    if (!row) return;
    if (row.getAttribute('data-th-key') !== key) row.setAttribute('data-th-key', key);
    var th = threshFor(key);
    var v = row.querySelector('.sy-th-v'); if (v){ v.textContent = th; v.style.color = th > 0 ? '#ffda47' : '#7f9aa8'; }
    var hint = row.querySelector('.sy-th-hint');
    if (hint) hint.textContent = th > 0 ? ('авто-крафт при запасе ' + (th+1) + '+ партий') : 'без порога';
  }

  /* ---------------------------------------------------------- Boot */
  function labOpen(){
    var lm = $('lab-modal');
    return !!(lm && lm.style.display === 'block');
  }

  function boot(){
    hideMatterLink();
    /* пред-регистрация extensions: бандл читает craftMastery_v1 (время синтеза)
       и autoCraftThreshold_v1 (гейт авто-крафта) с первого же тика */
    try { masterState(); threshState(); } catch(e){}
    setInterval(function(){
      try { if (labOpen()){ hideMatterLink(); ensureSummary(); renderSummary(); injectCardControls(); } } catch(e){}
    }, 900);
    setInterval(function(){
      try { tickMastery(); } catch(e){}
    }, 900);

    window.__reactorUp = {
      mastery: function(){ return JSON.parse(JSON.stringify(masterState())); },
      masteryCount: masterCount,
      masteryTier: masterTier,
      threshold: threshFor,
      setThreshold: setThresh,
      MANAGED: MANAGED.slice(),
      available: function(){
        var out = {};
        allRecipeKeys().forEach(function(k){ if (maxCraftable(k) > 0) out[k] = maxCraftable(k); });
        return out;
      },
      tick: function(){ tickMastery(); renderSummary(); injectCardControls(); }
    };
    try { console.info('[reactor-up] v0.0.21 готов. __reactorUp.mastery() / .available() / .threshold("steel") / .setThreshold("steel",10)'); } catch(e){}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 0);
})();
