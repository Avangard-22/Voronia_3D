
/* ============================================================================
 * Voronia · АРСЕНАЛ ХРАНИТЕЛЕЙ (v0.0.21.0) — План 33, вопрос №3.
 *
 *  · Прокачка урона в бою: 3 оружия × 20 уровней, +15% за уровень (на 20 = ×4).
 *    Хук через Proxy на legacy.BOSS_PHASES[].mult — бой и карточки фаз читают
 *    тот же объект, реген/блок/фазы не затронуты.
 *  · Штраф за проигрыш — прогрессивный по уровню Хранителя:
 *      1–4  — только штатное игры (5 мин кулдаун);
 *      5–7  — −15% локального запаса;
 *      8–11 — −25% запаса + снятие Печати;
 *      12+  — −40% запаса + −5% глобальных кристаллов.
 *  · Штраф за уклонение: планета 100% исследована, Хранитель ни разу не побеждён,
 *    «Бой» не нажат 3 часа → «гнев» (−10% запаса, однократно до победы).
 *    Пропуски окна Стражи: 2-й → −10% и снятие Печати, 3-й → −25%, 4-й+ → −40%.
 *
 *  Адаптация к v0.0.20+ (свои правки к Плану 33):
 *   1. В V20 проигрыш боя идёт через km("lose") → boss.canReviveAt (+5 мин);
 *      ix() с fails++ в бандле не вызывается. Детектор проигрыша — по скачку
 *      canReviveAt (~5 мин = бой; ~1 ч = схлопывание планеты, не штрафуем).
 *   2. Ext-хранилище — через штатный core.registerExtension (схема 39 цела).
 *   3. Баланс: первый уровень «Резонанса» — 10 реликтов вместо 100 (100 T5-реликтов
 *      недостижимы даже в глубоком мете; кривая ×1.35/ур. сохранена).
 *   4. После списания локальных ресурсов активной планеты — syncActiveToStorage().
 * ========================================================================== */
(function () {
  'use strict';
  var V = window.__V || {}, S = V.state || {}, L = V.legacy || {};
  var CORE = V.core || {};
  function $(id){ return document.getElementById(id); }
  function esc(s){ return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];}); }
  function fmt(v){ try { return window.fmtBig ? window.fmtBig(v) : String(Math.floor(v||0)); } catch(e){ return String(v); } }
  function toast(h,k,ms){ try { window.showToast && window.showToast(h,k||'',ms||5000); } catch(e){} }
  function ext(name, dflt){
    try {
      if (CORE.registerExtension) return CORE.registerExtension(name, dflt||{});
      var e = CORE.extensions || (CORE.extensions = {});
      if (!e[name] || typeof e[name] !== 'object') e[name] = JSON.parse(JSON.stringify(dflt||{}));
      return e[name];
    } catch(err){ return dflt||{}; }
  }
  function reqSave(){ try { window.requestSave ? window.requestSave() : (V.save && V.save.requestSave && V.save.requestSave()); } catch(e){} }

  /* ============================================================
   * 1. АРСЕНАЛ — состояние, цены, уровни
   * ============================================================ */
  var MAX_LEVEL = 20;
  var DMG_PER_LEVEL = 0.15;      // +15% за уровень
  var WEAPONS = ['iron','kriogen','energy'];
  var WEAPON_META = {
    iron:     { name: 'КИНЕТИКА',  icon: '⛏', color: '#d1d8dd', lore: 'Массивные буры, заряженные инерцией. Ломают Щит.' },
    kriogen:  { name: 'КРИОТЕХ',   icon: '❄', color: '#4ddcff', lore: 'Заморозка на молекулярном уровне. Разрывает Броню.' },
    energy:   { name: 'РЕЗОНАНС',  icon: '⚡', color: '#ffda47', lore: 'Прямая передача ядру. Гасит Ядро.' }
  };

  function arsenal(){
    var a = ext('guardianArsenal_v1', { iron: 0, kriogen: 0, energy: 0 });
    for (var i=0;i<WEAPONS.length;i++) if (typeof a[WEAPONS[i]] !== 'number') a[WEAPONS[i]] = 0;
    return a;
  }
  function arsenalMult(weapon){
    var a = arsenal(), lv = Math.max(0, Math.min(MAX_LEVEL, (a[weapon]|0)));
    return 1 + lv * DMG_PER_LEVEL;
  }
  function arsenalLevel(weapon){
    var a = arsenal(); return Math.max(0, Math.min(MAX_LEVEL, (a[weapon]|0)));
  }

  function costFor(weapon, level){
    var L2 = Math.max(0, level|0);
    var mE = Math.pow(1.85, L2);
    var mR = Math.pow(1.80, L2);
    var mC = Math.pow(1.35, L2);
    if (weapon === 'iron'){
      return {
        energy: Math.round(8e6 * mE),
        iron: Math.round(10e6 * mE),
        carbon: Math.round(500e3 * mR),
        steel: Math.round(10e3 * mC),
        alloy: Math.round(3e3 * mC)
      };
    }
    if (weapon === 'kriogen'){
      return {
        energy: Math.round(8e6 * mE),
        kriogen: Math.round(10e6 * mE),
        silicon: Math.round(500e3 * mR),
        chip: Math.round(10e3 * mC),
        alloy: Math.round(3e3 * mC)
      };
    }
    return {
      energy: Math.round(12e6 * mE),
      iron: Math.round(5e6 * mE),
      kriogen: Math.round(5e6 * mE),
      uranium: Math.round(250e3 * mR),
      core: Math.round(5e3 * mC),
      relic: Math.max(1, Math.round(10 * mC))
    };
  }

  function compoundKeys(){ return { steel:1, chip:1, alloy:1, core:1, relic:1 }; }
  function localKeys(){ return { iron:1, kriogen:1, carbon:1, silicon:1, titanium:1, uranium:1, darkMatter:1 }; }

  function stockOf(k){
    if (k === 'energy') return Number(S.energy)||0;
    if (compoundKeys()[k]) return Number((S.compoundResources||{})[k])||0;
    if (localKeys()[k]){ try { return Number(L.planetGet(S.activePlanetId,k))||0; } catch(e){ return 0; } }
    return 0;
  }
  /* v0.0.27: трофейный пул Хранителей доступен Арсеналу наряду со складами */
  function trophyOf(k){ try { return (window.__trophies && window.__trophies.pool()[k]) || 0; } catch(e){ return 0; } }
  function haveOf(k){ return stockOf(k) + trophyOf(k); }
  function canAfford(weapon, level){
    var c = costFor(weapon, level);
    for (var k in c){ if (haveOf(k) < c[k]) return false; }
    return true;
  }
  function missingList(weapon, level){
    var c = costFor(weapon, level), out = [];
    for (var k in c){
      var have = haveOf(k);
      if (have < c[k]){
        var nm = (L.RESOURCES && L.RESOURCES[k] && L.RESOURCES[k].name) ||
                 (L.COMPOUNDS && L.COMPOUNDS[k] && L.COMPOUNDS[k].name) || k;
        out.push(nm+' '+fmt(c[k]-have));
      }
    }
    return out;
  }
  function spend(weapon, level){
    var c = costFor(weapon, level), pid = S.activePlanetId;
    if (!canAfford(weapon, level)) return false;
    var touchedActive = false;
    /* v0.0.27: трофеи списываются первыми, складами доплачивается остаток */
    var rest = {};
    for (var k0 in c){ rest[k0] = window.__trophies ? window.__trophies.spend(k0, c[k0]) : c[k0]; }
    for (var k in rest){
      var pay = rest[k];
      if (pay <= 0) continue;
      if (k === 'energy'){ S.energy = (Number(S.energy)||0) - pay; }
      else if (compoundKeys()[k]){ S.compoundResources[k] = (Number(S.compoundResources[k])||0) - pay; }
      else if (localKeys()[k]){ L.planetAdd(pid, k, -pay); touchedActive = true; }
    }
    if (touchedActive){ try { L.syncActiveToStorage && L.syncActiveToStorage(); } catch(e){} }
    return true;
  }

  function buy(weapon){
    if (WEAPONS.indexOf(weapon) < 0) return;
    var a = arsenal(), lv = a[weapon]|0;
    if (lv >= MAX_LEVEL){ toast('Максимум арсенала', '', 2500); return; }
    if (!canAfford(weapon, lv)){
      var miss = missingList(weapon, lv).slice(0,3).join(' · ');
      toast('🔒 <b>Не хватает для уровня '+WEAPON_META[weapon].name+'</b><br><span style="font-size:11px;">'+esc(miss)+'</span>','danger',5500);
      return;
    }
    if (!spend(weapon, lv)) return;
    a[weapon] = lv + 1;
    try { V.media && V.media.SFX && V.media.SFX.upgrade && V.media.SFX.upgrade(); } catch(e){}
    try { V.media && V.media.vibrate && V.media.vibrate([20,10,20]); } catch(e){}
    toast('⚙ <b>'+WEAPON_META[weapon].name+'</b> · ур. '+a[weapon]+'<br><span style="font-size:11px;color:#7ee08a;">Урон ×'+(1+a[weapon]*DMG_PER_LEVEL).toFixed(2)+'</span>','success',4500);
    renderArsenal();
    try { L.recomputeIncome && L.recomputeIncome(); } catch(e){}
    try { L.updateUI && L.updateUI(); } catch(e){}
    reqSave();
  }

  /* ============================================================
   * 2. Прокси на BOSS_PHASES[].mult
   * ============================================================ */
  function installProxy(){
    try {
      var phases = L.BOSS_PHASES;
      if (!phases || !phases.length) return false;
      for (var i=0;i<phases.length;i++){
        var p = phases[i];
        if (!p || !p.mult || p.__arsenalProxied) continue;
        (function(phase){
          var orig = phase.mult;
          var proxy = new Proxy(orig, {
            get: function(target, key){
              var base = target[key];
              if (base == null) return base;
              if (WEAPONS.indexOf(key) < 0) return base;
              var lvl = arsenalLevel(key);
              if (lvl === 0) return base;
              return base * (1 + lvl * DMG_PER_LEVEL);
            }
          });
          try { phase.mult = proxy; phase.__arsenalProxied = true; } catch(e){}
        })(p);
      }
      return true;
    } catch (e) { try { console.warn('[arsenal] proxy:', e); } catch(_){} return false; }
  }

  /* ============================================================
   * 3. Модалка арсенала
   * ============================================================ */
  function ensureModal(){
    var m = $('arsenal-modal'); if (m) return m;
    m = document.createElement('div');
    m.id = 'arsenal-modal'; m.className = 'modal';
    m.style.borderColor = '#4ddcff'; m.style.maxWidth = '520px';
    m.innerHTML =
      '<h3 class="modal-title" style="color:#4ddcff">⚙ АРСЕНАЛ ХРАНИТЕЛЕЙ</h3>'+
      '<div style="font-size:11px;color:#91adbb;line-height:1.5;margin-bottom:10px;text-align:center;color:#91adbb;">'+
        'Три оружия, по 20 уровней. Каждый уровень даёт <b style="color:#7ee08a;">+15% урона</b> этим оружием в бою.<br>'+
        'Руда и редкие — со склада <b>активной планеты</b>, сплавы — глобальные. Энергия — глобальная.'+
      '</div>'+
      '<div id="arsenal-content" style="max-height:56vh;overflow-y:auto"></div>'+
      '<button class="modal-close-btn" id="arsenal-close">ЗАКРЫТЬ</button>';
    document.body.appendChild(m);
    try { var arr = L.modals; if (arr && typeof arr.push === 'function' && arr.indexOf(m) < 0) arr.push(m); } catch(e){}
    $('arsenal-close').addEventListener('click', function(){ m.style.display = 'none'; });
    m.addEventListener('click', function(ev){ if (ev.target === m) m.style.display = 'none'; });
    return m;
  }

  function bar(level, max){
    var h = '<div class="ar-bar">';
    for (var i=0;i<max;i++) h += '<span class="ar-seg'+(i<level?' on':(i===level?' next':''))+'"></span>';
    return h + '</div>';
  }

  function costRow(weapon, level){
    var c = costFor(weapon, level);
    var meta = L.RESOURCES || {};
    var cmeta = L.COMPOUNDS || {};
    var out = [];
    if (c.energy) out.push('⚡ '+fmt(c.energy));
    ['iron','kriogen','carbon','silicon','titanium','uranium','darkMatter'].forEach(function(k){
      if (c[k]) out.push((meta[k] ? meta[k].icon : '◆')+' '+fmt(c[k]));
    });
    ['steel','chip','alloy','core','relic'].forEach(function(k){
      if (c[k]) out.push((cmeta[k] ? cmeta[k].icon : '◆')+' '+fmt(c[k]));
    });
    return out.join(' + ');
  }

  function renderArsenal(){
    var box = $('arsenal-content'); if (!box) return;
    var html = '';
    html += '<div class="ar-summary">';
    WEAPONS.forEach(function(w){
      var m = arsenalMult(w);
      var mm = WEAPON_META[w];
      html += '<div class="ar-stat"><span style="color:'+mm.color+'">'+mm.icon+' '+mm.name+'</span><b>×'+m.toFixed(2)+'</b></div>';
    });
    html += '</div>';
    /* v0.0.27: плашка трофейного пула */
    var tp = (window.__trophies && window.__trophies.pool()) || {};
    var tKeys = ['energy','iron','kriogen','carbon','silicon','titanium','uranium','darkMatter','steel','chip','alloy','core','relic'];
    var tParts = [];
    var rmeta = L.RESOURCES || {}, cmeta2 = L.COMPOUNDS || {};
    tKeys.forEach(function(k){
      var v = Number(tp[k])||0;
      if (v <= 0) return;
      var icon = k === 'energy' ? ((window.VoroniaIcons && window.VoroniaIcons.html('energy')) || '⚡') : (rmeta[k] && rmeta[k].icon) || (cmeta2[k] && cmeta2[k].icon) || '◆';
      tParts.push('<span style="color:#eaf8ff;">' + icon + ' <b style="color:#ffda47;font-family:monospace;">' + fmt(v) + '</b></span>');
    });
    html += '<div class="ar-trophy" style="background:#0d1420;border:1px dashed #5a4a28;border-radius:10px;padding:7px 10px;margin-bottom:10px;font-size:10.5px;line-height:1.7;color:#91adbb;">' +
      '<span style="color:#ffda47;font-weight:900;letter-spacing:.6px;">⚑ ТРОФЕИ ХРАНИТЕЛЕЙ</span> · побед: <b style="font-family:monospace;color:#eaf8ff;">' + ((window.__trophies && window.__trophies.wins()) || 0) + '</b> · тратятся Арсеналом первыми<br>' +
      (tParts.length ? tParts.join(' · ') : '<span style="color:#566a78;">Пусто: победи Хранителя — и бой заплатит за прокачку урона.</span>') +
      '</div>';
    WEAPONS.forEach(function(w){
      var mm = WEAPON_META[w];
      var lv = arsenalLevel(w);
      var maxed = lv >= MAX_LEVEL;
      var mult = arsenalMult(w);
      var next = Math.min(MAX_LEVEL, lv+1);
      var multNext = 1 + next * DMG_PER_LEVEL;
      var can = !maxed && canAfford(w, lv);
      var btn = maxed
        ? '<button class="ar-buy" disabled>✓ МАКСИМУМ</button>'
        : '<button class="ar-buy" data-ar-buy="'+w+'" '+(can?'':'disabled')+'>⬆ УР. '+(lv+1)+' · '+esc(costRow(w, lv))+'</button>';
      var miss = (!maxed && !can) ? '<div class="ar-miss">Не хватает: '+esc(missingList(w,lv).slice(0,4).join(' · '))+'</div>' : '';
      html += '<div class="ar-card" style="border-color:'+mm.color+'55">'+
        '<div class="ar-head">'+
          '<div class="ar-ico" style="color:'+mm.color+'">'+mm.icon+'</div>'+
          '<div class="ar-title"><div class="ar-name" style="color:'+mm.color+'">'+esc(mm.name)+'</div>'+
          '<div class="ar-lore">'+esc(mm.lore)+'</div></div>'+
          '<div class="ar-lv">'+lv+' / '+MAX_LEVEL+'</div>'+
        '</div>'+ bar(lv, MAX_LEVEL) +
        '<div class="ar-dmg"><span class="ar-cur">×'+mult.toFixed(2)+'</span>'+
          (maxed ? '' : '<span class="ar-arrow">→</span><span class="ar-next">×'+multNext.toFixed(2)+'</span>')+
        '</div>'+ btn + miss +
      '</div>';
    });
    box.innerHTML = html;
    var btns = box.querySelectorAll('[data-ar-buy]');
    for (var i=0;i<btns.length;i++){
      (function(b){
        b.addEventListener('click', function(){ buy(b.getAttribute('data-ar-buy')); });
      })(btns[i]);
    }
  }

  function openArsenal(){
    var m = ensureModal(); renderArsenal();
    try { L.openModal ? L.openModal(m) : (m.style.display = 'block'); } catch(e){ m.style.display = 'block'; }
    try { V.media && V.media.SFX && V.media.SFX.click && V.media.SFX.click(); } catch(e){}
  }

  /* ============================================================
   * 4. Кнопка в boss-modal
   * ============================================================ */
  function installButtonInActivityPanel(){
    if (!window.__VOR_ARSENAL_UI) return; /* (v17) вкладка «Арсенал» скрыта: бой заменён «Распуткой» */
    try {
      /* v0.0.25: арсенал доступен ДО боя из «Активности» (merge из v24-audit),
         кнопка в боевой модалке оставлена — прокачка возможна и между фазами. */
      var modal = $('activity-modal');
      var tabs = $('act-tab-bar');
      if (!modal || !tabs) return;
      var b = $('activity-arsenal-btn');
      if (!b) {
        b = document.createElement('button');
        b.id = 'activity-arsenal-btn';
        b.type = 'button';
        b.className = 'menu-action-btn';
        b.style.cssText = 'width:100%;margin:0 0 10px;border-color:#4ddcff;color:#4ddcff;font-weight:900;';
        b.innerHTML = '⚙ АРСЕНАЛ · ПОДГОТОВИТЬ ОРУЖИЕ К БОЮ <span class="sub-text" id="activity-arsenal-badge" style="color:#91adbb;">— / — / —</span>';
        tabs.insertAdjacentElement('afterend', b);
        b.addEventListener('click', openArsenal);
      }
      updateButtonBadge();
    } catch (e) {}
  }

  function installButtonInBossModal(){
    if (!window.__VOR_ARSENAL_UI) return; /* (v17) */
    try {
      var flee = $('boss-flee');
      if (!flee) return;
      var wrap = flee.parentNode;
      if (!wrap || $('arsenal-open-btn')) return;
      var b = document.createElement('button');
      b.id = 'arsenal-open-btn';
      b.className = 'menu-action-btn';
      b.type = 'button';
      b.style.cssText = 'width:100%;margin-top:10px;border-color:#4ddcff;color:#4ddcff;font-weight:900;';
      b.innerHTML = '⚙ АРСЕНАЛ · УСИЛИТЬ ОРУЖИЕ <span class="sub-text" id="arsenal-badge" style="color:#91adbb;">— / — / —</span>';
      wrap.insertBefore(b, flee);
      b.addEventListener('click', openArsenal);
      updateButtonBadge();
    } catch (e) {}
  }

  function updateButtonBadge(){
    var txt = WEAPONS.map(function(w){ return '×'+arsenalMult(w).toFixed(2); }).join(' / ');
    var el = $('arsenal-badge'); if (el) el.textContent = txt;
    var el2 = $('activity-arsenal-badge'); if (el2) el2.textContent = txt;
  }

  /* ============================================================
   * 5. Штрафы — движок.
   * V20-адаптация: проигрыш боя ловится событием guardian:lost (эмитится
   * из km("lose") патчем бандла) — мгновенно и без поллинг-пропусков.
   * Пропуски окна Стражи и «гнев первого боя» — тиком раз в минуту.
   * ============================================================ */
  var anger = ext('guardianAnger_v1', { firstReady: {}, angered: {}, lastMissed: {} });
  ['firstReady','angered','lastMissed'].forEach(function(k){
    if (!anger[k] || typeof anger[k] !== 'object') anger[k] = {};
  });

  function ctProfile(pl){ try { return L.guardianProfileFor(pl); } catch(e){ return null; } }

  var RES_KEYS_LOCAL = ['iron','kriogen','carbon','silicon','titanium','uranium','darkMatter'];

  function drainLocal(pl, pct){
    var lost = {};
    var pid = pl && pl.id;
    if (!pid) return lost;
    for (var i=0;i<RES_KEYS_LOCAL.length;i++){
      var k = RES_KEYS_LOCAL[i];
      var have = 0;
      try { have = Number(L.planetGet(pid, k))||0; } catch(e){}
      if (have <= 0) continue;
      var delta = Math.floor(have * pct);
      if (delta <= 0) continue;
      try { L.planetAdd(pid, k, -delta); lost[k] = delta; } catch(e){}
    }
    if (pid === S.activePlanetId){ try { L.syncActiveToStorage && L.syncActiveToStorage(); } catch(e){} }
    return lost;
  }
  function lostSummary(lost){
    var parts = [];
    for (var k in lost){
      if (!isFinite(lost[k])) continue;
      var m = (L.RESOURCES && L.RESOURCES[k]) || (L.COMPOUNDS && L.COMPOUNDS[k]);
      parts.push((m&&m.icon||'◆')+' '+fmt(lost[k]));
    }
    return parts.join(' · ');
  }

  function applyLosePenalty(pl, level){
    if (level < 5) return;                       // 1–4 — только штатное игры (5 мин кулдаун)
    var pct = level < 8 ? 0.15 : level < 12 ? 0.25 : 0.40;
    var lost = drainLocal(pl, pct);
    var extra = [];
    if (level >= 8){
      var s = ctProfile(pl);
      if (s && s.seal && s.seal.until > Date.now()){
        s.seal = null;
        extra.push('Печать снята');
      }
    }
    if (level >= 12){
      var take = Math.floor((Number(S.crystals)||0) * 0.05);
      if (take > 0){ S.crystals = Math.max(0,(Number(S.crystals)||0)-take); extra.push('💎 −'+fmt(take)); }
    }
    try { L.recomputeIncome && L.recomputeIncome(); } catch(e){}
    reqSave();
    var plName = (pl && (pl.name || pl.id)) || '?';
    toast('💀 <b>Хранитель взял своё на «'+esc(plName)+'»</b><br>'+
          '<span style="font-size:11px;color:#ff9e9e;">−'+Math.round(pct*100)+'% запаса: '+
          (lostSummary(lost) || '—')+
          (extra.length?(' · '+extra.join(' · ')):'')+'</span>','danger',8000);
  }

  function applyMissPenalty(pl, missedCount){
    // 1-й пропуск — это уже Сон, наложенный игрой. Начинаем со 2-го.
    if (missedCount < 2) return;
    var pct = missedCount === 2 ? 0.10 : missedCount === 3 ? 0.25 : 0.40;
    var lost = drainLocal(pl, pct);
    var extra = [];
    if (missedCount === 2){
      var s = ctProfile(pl);
      if (s && s.seal && s.seal.until > Date.now()){
        s.seal = null;
        extra.push('Печать снята');
      }
    }
    try { L.recomputeIncome && L.recomputeIncome(); } catch(e){}
    reqSave();
    var plName = (pl && (pl.name || pl.id)) || '?';
    toast('💤 <b>Хранитель ждал, но не дождался</b><br>'+
          '<span style="font-size:11px;color:#ff9e9e;">«'+esc(plName)+'»: −'+Math.round(pct*100)+'% запаса: '+
          (lostSummary(lost) || '—')+
          (extra.length?(' · '+extra.join(' · ')):'')+'</span>','danger',8000);
  }

  function applyFirstAnger(pl){
    var lost = drainLocal(pl, 0.10);
    try { L.recomputeIncome && L.recomputeIncome(); } catch(e){}
    reqSave();
    var plName = (pl && (pl.name || pl.id)) || '?';
    toast('⚠ <b>Хранитель злится</b><br>'+
          '<span style="font-size:11px;color:#ffb454;">«'+esc(plName)+'»: 3 часа без боя. −10% запаса: '+
          (lostSummary(lost) || '—')+'<br>Штраф не повторяется, но Хранитель будет помнить.</span>','warn',9000);
  }

  /* ---- тик штрафов ---- */
  var ANGER_MS = 3 * 3600 * 1000;

  function onLost(ev){
    try {
      var d = (ev && (ev.detail || ev)) || {};
      var pid = d.pid; if (!pid) return;
      var pl = L.PLANETS && L.PLANETS[pid]; if (!pl) return;
      var s = ctProfile(pl);
      var gl = (d.level|0) || (s ? (s.guardianLevel|0) : 0);
      applyLosePenalty(pl, gl);
    } catch(e){}
  }
  function onWon(ev){
    try {
      var d = (ev && (ev.detail || ev)) || {};
      var pid = d.pid; if (!pid) return;
      delete anger.firstReady[pid];
      delete anger.angered[pid];
      anger.lastMissed[pid] = 0;
      reqSave();
    } catch(e){}
  }

  function tickPunishments(){
    if (!S.started || !S.unlockedPlanets) return;
    var now = Date.now();
    var changed = false;
    try {
      S.unlockedPlanets.forEach(function(pid){
        var pl = L.PLANETS && L.PLANETS[pid]; if (!pl) return;
        var s = ctProfile(pl); if (!s) return;
        var gl = (s.guardianLevel|0);

        /* --- пропуски окна Стражи: missedCount --- */
        var mc = (s.missedCount|0);
        var lastM = (anger.lastMissed[pid]|0);
        if (mc > lastM){
          try { applyMissPenalty(pl, mc); } catch(e){}
        }
        if (mc !== lastM){ anger.lastMissed[pid] = mc; changed = true; }

        /* --- «гнев» первого боя --- */
        var ready = pl.explored && pl.cells && pl.explored.size >= pl.cells.length;
        if (ready && gl === 0){
          if (!anger.firstReady[pid]){
            anger.firstReady[pid] = now; changed = true;
          } else if (!anger.angered[pid] && (now - anger.firstReady[pid]) > ANGER_MS){
            anger.angered[pid] = now; changed = true;
            try { applyFirstAnger(pl); } catch(e){}
          }
        } else {
          if (anger.firstReady[pid]) { delete anger.firstReady[pid]; changed = true; }
          if (gl > 0 && anger.angered[pid]) { delete anger.angered[pid]; changed = true; }
        }
      });
    } catch (e) { try { console.warn('[arsenal anger]', e); } catch(_){} }
    if (changed) reqSave();
  }

  /* ============================================================
   * 5b. v0.0.26 (C-8): калькулятор достижимости уровней
   * ============================================================ */
  function project(assumptions){
    assumptions = assumptions || {};
    var cycles = Math.max(1, Number(assumptions.cycles)||10);
    var per = assumptions.perCycle || {};
    var stock = {};
    ['energy','iron','kriogen','carbon','silicon','titanium','uranium','darkMatter'].forEach(function(k){
      stock[k] = k === 'energy' ? (Number(S.energy)||0) : (function(){ try { return Number(L.planetGet(S.activePlanetId,k))||0; } catch(e){ return 0; } })();
    });
    ['steel','chip','alloy','core','relic'].forEach(function(k){
      stock[k] = Number((S.compoundResources||{})[k])||0;
    });
    var budget = {};
    for (var k2 in stock) budget[k2] = stock[k2] + (Number(per[k2])||0) * cycles;
    var out = { cycles: cycles, perCycle: per, weapons: {}, costToMax: {} };
    WEAPONS.forEach(function(w){
      var lv = arsenalLevel(w), cum = {};
      while (lv < MAX_LEVEL){
        var c = costFor(w, lv), ok = true;
        for (var k3 in c){ if ((budget[k3]||0) < c[k3]) { ok = false; break; } }
        if (!ok) break;
        for (var k4 in c) budget[k4] -= c[k4];
        for (var k5 in c) cum[k5] = (cum[k5]||0) + c[k5];
        lv++;
      }
      out.weapons[w] = { from: arsenalLevel(w), reachable: lv, spend: cum };
      var tot = {}, l2 = arsenalLevel(w);
      while (l2 < MAX_LEVEL){ var c2 = costFor(w, l2); for (var k6 in c2) tot[k6] = (tot[k6]||0)+c2[k6]; l2++; }
      out.costToMax[w] = tot;
    });
    return out;
  }

  /* ============================================================
   * 6. CSS
   * ============================================================ */
  function css(){
    if ($('arsenal-css')) return;
    var st = document.createElement('style'); st.id = 'arsenal-css';
    st.textContent =
      '#arsenal-modal{padding:16px}'+
      '#arsenal-modal .modal-title{margin-bottom:6px;font-size:14px}'+
      '.ar-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px}'+
      '.ar-summary .ar-stat{background:#08131c;border:1px solid #29495b;border-radius:9px;padding:6px 8px;display:flex;flex-direction:column;gap:2px;font-size:10px}'+
      '.ar-summary .ar-stat span{color:#91adbb;text-transform:uppercase;letter-spacing:.6px;font-weight:800}'+
      '.ar-summary .ar-stat b{font-family:monospace;color:#eaf8ff;font-size:12px}'+
      '.ar-card{background:#08131c;border:1px solid #29495b;border-radius:12px;padding:11px 12px;margin-bottom:10px}'+
      '.ar-head{display:flex;align-items:center;gap:10px;margin-bottom:8px}'+
      '.ar-ico{font-size:22px;flex-shrink:0;width:32px;text-align:center;filter:drop-shadow(0 0 5px currentColor)}'+
      '.ar-title{flex:1;min-width:0}'+
      '.ar-name{font-size:12px;font-weight:900;letter-spacing:.6px}'+
      '.ar-lore{font-size:10px;color:#91adbb;line-height:1.35;margin-top:2px}'+
      '.ar-lv{font-family:monospace;font-size:12px;color:#7ec9e8;font-weight:800;flex-shrink:0}'+
      '.ar-bar{display:flex;gap:2px;margin-bottom:8px}'+
      '.ar-seg{flex:1;height:5px;border-radius:2px;background:#16242f}'+
      '.ar-seg.on{background:linear-gradient(90deg,#4ddcff,#7ee08a)}'+
      '.ar-seg.next{background:#3a5060;box-shadow:0 0 6px rgba(77,220,255,.5)}'+
      '.ar-dmg{display:flex;align-items:baseline;gap:8px;font-family:monospace;font-size:13px;margin-bottom:8px}'+
      '.ar-cur{color:#eaf8ff;font-weight:800}'+
      '.ar-arrow{color:#566a78}'+
      '.ar-next{color:#7ee08a;font-weight:800}'+
      '.ar-buy{width:100%;padding:10px;border-radius:9px;border:1px solid #4ddcff;background:#0a2233;color:#bfeeff;font-weight:800;font-size:11px;cursor:pointer;font-family:inherit;line-height:1.4;word-break:break-word}'+
      '.ar-buy:active:not(:disabled){transform:scale(.98)}'+
      '.ar-buy:disabled{opacity:.45;border-color:#333;background:#141414;color:#888;cursor:not-allowed}'+
      '.ar-miss{margin-top:6px;font-size:10px;color:#ff9e9e;font-family:monospace;line-height:1.4}'+
      '@media (max-width:420px){.ar-summary{grid-template-columns:1fr}.ar-ico{font-size:18px;width:26px}}';
    document.head.appendChild(st);
  }

  /* ============================================================
   * 7. Boot
   * ============================================================ */
  function boot(){
    css();
    installProxy();
    ensureModal();
    installButtonInBossModal();
    installButtonInActivityPanel();

    /* Кнопка арсенала может перерисоваться при каждом открытии боевой модалки */
    setInterval(function(){
      installButtonInBossModal();
      installButtonInActivityPanel();
      updateButtonBadge();
    }, 1200);

    /* Движок штрафов — раз в минуту */
    setInterval(function(){
      try { tickPunishments(); } catch(e){ try { console.warn('[arsenal tick]', e); } catch(_){} }
    }, 60e3);

    /* События боя из бандла (v0.0.21): мгновенный штраф за проигрыш,
       сброс «гнева» на победе */
    try {
      if (V.bus && V.bus.on){
        V.bus.on('guardian:lost', onLost);
        V.bus.on('guardian:won', onWon);
      }
    } catch(e){}

    /* Первый прогон — с задержкой, чтобы мир загрузился */
    setTimeout(function(){ try { tickPunishments(); } catch(e){} }, 5000);

    window.__arsenal = {
      state: function(){ return JSON.parse(JSON.stringify(arsenal())); },
      mult: arsenalMult,
      level: arsenalLevel,
      cost: costFor,
      buy: buy,
      canAfford: canAfford,
      missing: missingList,
      open: openArsenal,
      angerState: function(){ return JSON.parse(JSON.stringify(anger)); },
      resetAnger: function(pid){ if (pid){ delete anger.firstReady[pid]; delete anger.angered[pid]; delete anger.lastMissed[pid]; } else { anger.firstReady={}; anger.angered={}; anger.lastMissed={}; } reqSave(); },
      project: project,
      tick: tickPunishments,
      MAX_LEVEL: MAX_LEVEL,
      DMG_PER_LEVEL: DMG_PER_LEVEL
    };

    try { console.info('[arsenal] v0.0.21 готов. __arsenal.state() / .buy("iron") / .open() / .tick()'); } catch(e){}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 0);
})();
