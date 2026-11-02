
/* ============================================================================
 * Voronia · Сброс Вселенной и Асценсия — чеклисты и внятные блокировки (v0.0.21.0)
 * План 33, вопрос №2: «кнопки не работают — вообще ничего не происходит».
 * Причина: условия ритуалов не выполнены, а игра молчит (микро-предупреждение
 * 9px вверху экрана или просто disabled-кнопка без объяснений).
 *
 * Модуль добавляет:
 *  · Постоянный чеклист в модалках «Сброс Вселенной» и «Асценсия» (тик 1 с).
 *  · Корректный disabled-стейт по ПОЛНОМУ набору условий.
 *  · Тост с перечислением недостающего, если клик всё же прошёл.
 *  · Подсказка про «arm → confirm» (4 с) для «СЖЕЧЬ СЕБЯ».
 *  · Debug-хелперы __vorFix.forceMeta() / .forceAsc().
 *
 * Условия сверены с бандлом v0.0.21: yr()/dm() (метапрестиж) и yi()/O1()
 * (асценсия). Правка к Плану 33: эссенции для награды нужно ≥100 (как в yr()),
 * а не ≥500, как было в черновике модуля.
 * ========================================================================== */
(function () {
  'use strict';
  var V = window.__V || {}, S = V.state || {}, L = V.legacy || {};
  function $(id){ return document.getElementById(id); }
  function fmt(n){
    n = Number(n) || 0;
    if (n >= 1e12) return (n/1e12).toFixed(1).replace('.',',')+'T';
    if (n >= 1e9) return (n/1e9).toFixed(1).replace('.',',')+'B';
    if (n >= 1e6) return (n/1e6).toFixed(1).replace('.',',')+'M';
    if (n >= 1e3) return (n/1e3).toFixed(1).replace('.',',')+'K';
    return String(Math.floor(n));
  }
  function toast(h,k,ms){ try { window.showToast && window.showToast(h,k||'',ms||5000); } catch(e){} }
  function visible(el){ return !!el && (el.style.display === 'block' || (el.offsetParent !== null && getComputedStyle(el).display !== 'none')); }

  /* ---------- условия meta-prestige (Сброс Вселенной): yr() + dm() ---------- */
  function metaGain(){
    var totalPrest = S.totalPrestiges|0, essTotal = Math.floor(S.essenceTotal||0);
    if (totalPrest < 3 || essTotal < 100) return 0;
    var e = Math.floor(Math.pow(essTotal/500, 0.65)) * 100;
    if ((S.metaPrestiges|0) === 0) e = Math.floor(e * 1.1);
    return Math.max(0, e);
  }
  function metaStatus(){
    var totalPrest = S.totalPrestiges|0;
    var prestSince = S.prestigesSinceMeta|0;
    var essTotal   = Math.floor(S.essenceTotal||0);
    var dust       = Math.floor(S.essence||0);
    var word       = !!S.metaWordOk;
    return { gain: metaGain(), checks: [
      { ok: totalPrest >= 3,  label: 'Престижей всего',        have: totalPrest, need: 3 },
      { ok: essTotal >= 100,  label: 'Эссенции всего 🌌',      have: essTotal,   need: 100 },
      { ok: prestSince >= 3,  label: 'Престижей подряд',       have: prestSince, need: 3 },
      { ok: dust >= 100,      label: 'Свободной эссенции 🌌',  have: dust,       need: 100 },
      { ok: word,             label: 'Слово «СВЕРНУТЬ»',       have: word?1:0,   need: 1, text: word?'принято':'—' }
    ]};
  }

  /* ---------- условия ascension (Сжечь себя): yi() ---------- */
  function exploredCells(){
    var cells = 0;
    try { S.unlockedPlanets.forEach(function(p){ var pl = L.PLANETS && L.PLANETS[p]; if (pl && pl.explored) cells += pl.explored.size; }); } catch(e){}
    return cells;
  }
  function ascStatus(){
    var meta = S.metaPrestiges|0, ess = Math.floor(S.essenceTotal||0), cells = exploredCells();
    return { checks: [
      { ok: meta >= 3,   label: 'Мета-циклов',        have: meta,  need: 3 },
      { ok: ess >= 5e5,  label: 'Эссенции всего 🌌',  have: ess,   need: 5e5 },
      { ok: cells >= 30, label: 'Клеток исследовано', have: cells, need: 30 }
    ]};
  }

  function allOk(checks){ for (var i=0;i<checks.length;i++) if (!checks[i].ok) return false; return true; }
  function listHtml(checks){
    return checks.map(function(c){
      var col = c.ok ? '#7ee08a' : '#ff8c8c';
      var ico = c.ok ? '✅' : '❌';
      var val = c.text || (fmt(c.have) + ' / ' + fmt(c.need));
      return '<div style="display:flex;justify-content:space-between;gap:8px;padding:3px 0;font-size:11px;color:'+col+';">'+
        '<span>'+ico+' '+c.label+'</span><b style="font-family:monospace;">'+val+'</b></div>';
    }).join('');
  }

  function ensureBox(modal, id, title, color){
    var box = $(id);
    if (box) return box;
    if (!modal) return null;
    box = document.createElement('div');
    box.id = id;
    box.style.cssText = 'background:#0a0614;border:1px solid #3c1e5c;border-radius:10px;padding:9px 11px;margin:10px 0;';
    var t = modal.querySelector('.modal-title');
    if (t && t.parentNode) t.parentNode.insertBefore(box, t.nextSibling); else modal.insertBefore(box, modal.firstChild);
    return box;
  }

  function renderMetaCheck(){
    var modal = $('meta-prestige-modal'); if (!visible(modal)) return;
    var box = ensureBox(modal, 'vor-meta-check');
    if (!box) return;
    var st = metaStatus(), ready = allOk(st.checks);
    box.innerHTML =
      '<div style="font-size:10px;color:#c084fc;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:800;">РИТУАЛ КОЛЛАПСА · ЧЕКЛИСТ</div>'+
      listHtml(st.checks)+
      '<div style="margin-top:7px;padding-top:6px;border-top:1px dashed #3c1e5c;font-size:11px;color:'+(ready?'#7ee08a':'#7f9aa8')+';">'+
      (ready ? '⚡ Готово! Награда: +'+fmt(st.gain)+' 💫' : '🔒 Не хватает условий выше — кнопка разблокируется автоматически') +
      '</div>';
  }

  function renderAscCheck(){
    var modal = $('ascension-modal'); if (!visible(modal)) return;
    var box = ensureBox(modal, 'vor-asc-check');
    if (!box) return;
    var st = ascStatus(), ready = allOk(st.checks);
    box.innerHTML =
      '<div style="font-size:10px;color:#eaf8ff;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;font-weight:800;">СЖЕЧЬ СЕБЯ · ЧЕКЛИСТ</div>'+
      listHtml(st.checks)+
      '<div style="margin-top:7px;padding-top:6px;border-top:1px dashed #3c1e5c;font-size:11px;color:'+(ready?'#7ee08a':'#7f9aa8')+';">'+
      (ready ? '⚡ Готово! Первый клик взводит ритуал, второй (в течение 4 с) — подтверждает' : '🔒 Не хватает условий выше') +
      '</div>';
  }

  function updateButtons(){
    var mb = $('meta-confirm-btn');
    if (mb) {
      var m = allOk(metaStatus().checks);
      if (!!mb.disabled !== !m) { mb.disabled = !m; }
      mb.style.opacity = m ? '1' : '0.5';
      mb.title = m ? '' : 'Условия не выполнены — см. чеклист выше';
    }
    var ab = $('asc-go');
    if (ab) {
      var a = allOk(ascStatus().checks);
      ab.style.opacity = a ? '1' : '0.5';
      ab.title = a ? '' : 'Условия не выполнены — см. чеклист';
      /* родной B1() уже дизейблит asc-go по yi(); не ломаем его состояние,
         лишь подсвечиваем и объясняем */
    }
  }

  function tick(){ renderMetaCheck(); renderAscCheck(); updateButtons(); }

  /* ---------- диагностика / тестовые форс-функции ---------- */
  function forceMeta(){
    S.totalPrestiges = Math.max(S.totalPrestiges|0, 3);
    S.prestigesSinceMeta = Math.max(S.prestigesSinceMeta|0, 3);
    S.essenceTotal = Math.max(S.essenceTotal||0, 1000);
    S.essence = Math.max(S.essence||0, 1000);
    S.dust = Math.max(S.dust||0, 200);
    S.metaWordOk = true;
    var inp = $('meta-word-input');
    if (inp) { inp.value = 'СВЕРНУТЬ'; inp.dispatchEvent(new Event('input',{bubbles:true})); }
    toast('🧪 <b>Тест: условия метапрестижа заполнены.</b> Жми «СБРОСИТЬ ВСЕЛЕННУЮ».','success',5000);
    tick();
    try { window.requestSave && window.requestSave(); } catch(e){}
  }
  function forceAsc(){
    S.metaPrestiges = Math.max(S.metaPrestiges|0, 3);
    S.essenceTotal  = Math.max(S.essenceTotal||0, 1e6);
    S.essence       = Math.max(S.essence||0, 1e6);
    var need = 30;
    try {
      S.unlockedPlanets.forEach(function(p){
        if (need <= 0) return;
        var pl = L.PLANETS && L.PLANETS[p]; if (!pl || !pl.cells) return;
        for (var i=0;i<pl.cells.length && need>0;i++){
          var c = pl.cells[i];
          if (c && !pl.explored.has(c.id)) { pl.explored.add(c.id); need--; }
        }
      });
    } catch(e){}
    toast('🧪 <b>Тест: условия асценсии заполнены.</b> Открой «✨ Асценсия» и жми «СЖЕЧЬ СЕБЯ» дважды.','success',6000);
    try { L.recomputeIncome && L.recomputeIncome(); } catch(e){}
    try { L.updateUI && L.updateUI(); } catch(e){}
    try { L.renderAscensionModal && L.renderAscensionModal(); } catch(e){}
    tick();
    try { window.requestSave && window.requestSave(); } catch(e){}
  }

  function missLines(st){
    return st.checks.filter(function(c){ return !c.ok; }).map(function(c){
      return c.text ? c.label+' — не выполнено' : c.label+' '+fmt(c.have)+'/'+fmt(c.need);
    });
  }

  function boot(){
    tick();
    setInterval(tick, 1000);
    document.addEventListener('click', function(ev){
      var t = ev.target; if (!t || !t.closest) return;
      if (t.closest('#action-meta-prestige')) setTimeout(renderMetaCheck, 60);
      if (t.closest('#asc-open'))             setTimeout(renderAscCheck, 60);
    }, true);

    /* Капчур-фаза: явный тост, если клик прошёл при невыполненных условиях,
       и подсказка про двойное подтверждение «СЖЕЧЬ СЕБЯ». */
    document.addEventListener('click', function(ev){
      var t = ev.target; if (!t || !t.closest) return;
      if (t.closest('#meta-confirm-btn')) {
        var st = metaStatus();
        if (!allOk(st.checks)) {
          toast('🔒 <b>Сброс Вселенной заблокирован</b><br><span style="font-size:11px;">'+missLines(st).join('<br>')+'</span>','danger',6500);
        }
      }
      if (t.closest('#asc-go')) {
        var a = ascStatus();
        if (!allOk(a.checks)) {
          toast('🔒 <b>Асценсия заблокирована</b><br><span style="font-size:11px;">'+missLines(a).join('<br>')+'</span>','danger',6500);
        } else if (!(Date.now() < (S.__ascArmUntil||0))) {
          toast('⚠ <b>Ритуал взведён.</b><br><span style="font-size:11px;">Нажми «СЖЕЧЬ СЕБЯ» ещё раз в течение 4 секунд — это защита от случайного тапа.</span>','warn',4200);
        }
      }
    }, true);

    window.__vorFix = {
      meta: metaStatus, asc: ascStatus, gain: metaGain, cells: exploredCells,
      forceMeta: forceMeta, forceAsc: forceAsc, render: tick
    };
    try { console.info('[vor] v0.0.21 диагностика сбросов: __vorFix.meta() / .asc() / .forceMeta() / .forceAsc()'); } catch(e){}
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else setTimeout(boot, 0);
})();
