
/* Voronia v0.0.24 — Premium legacy cleanup + lightweight atmosphere.
   Автоматизация не предоставляется бесплатно или по временному пробному режиму.
   Фактическая выдача лицензии должна подтверждаться Telegram-ботом/сервером. */
(function(){
  'use strict';
  var AUTO_IDS = ['auto_scan','auto_upgrade','auto_transport','auto_react','auto_anomaly','auto_deep','auto_react_batch','autoscan_batch','eso_craft_speed'];
  /* UI hiding alone is insufficient: retire legacy Dust Tree flags unless the
     matching Premium entitlement is active in the current save. This remains
     a client-side guard, not a secure payment/licensing boundary. */
  var AUTO_LICENSE = {
    auto_scan:'autoScanUntil', autoscan_batch:'autoScanUntil', auto_anomaly:'autoScanUntil',
    auto_upgrade:'autoUpgradeUntil', auto_deep:'autoUpgradeUntil',
    auto_react:'autoUpgradeUntil', auto_react_batch:'autoUpgradeUntil',
    auto_transport:'autoTransportUntil', eso_craft_speed:'autoCraftUntil'
  };
  function $(id){ return document.getElementById(id); }
  function retireLegacyAutomation(){
    try {
      var V=window.__V||{}, S=V.state||{}, C=V.core||{}, ext=C.extensions||{};
      var changed=false, old=ext.autoTrial_v1;
      if(old){ try{delete ext.autoTrial_v1;}catch(e){ext.autoTrial_v1=null;} changed=true; }
      if(S.dustPerks && typeof S.dustPerks==='object'){
        Object.keys(AUTO_LICENSE).forEach(function(id){
          var until=Number(S.premium && S.premium[AUTO_LICENSE[id]])||0;
          if(until<=Date.now() && S.dustPerks[id]){ S.dustPerks[id]=0; changed=true; }
        });
      }
      var autoCraft=$('lab-autocraft');
      if(autoCraft) autoCraft.style.display=(Number(S.premium&&S.premium.autoCraftUntil)>Date.now())?'':'none';
      if(changed){ if(window.requestSave) window.requestSave(); else if(V.save&&V.save.requestSave) V.save.requestSave(); }
    }catch(e){}
  }
  function filterDust(){
    var box=$('dust-list'); if(!box) return;
    box.querySelectorAll('.tech-item').forEach(function(card){
      var btn=card.querySelector('[data-id]');
      if(btn && AUTO_IDS.indexOf(btn.getAttribute('data-id'))!==-1) card.remove();
    });
    var old=$('dust-trial-block'); if(old) old.remove();
  }
  /* v0.0.40.2 · КОНТУР ТЕЛЕГРАМ-БОТА. Имя бота — единственное место:
     VORONIA_BALANCE.premium.botUsername. Пока пусто — кнопок покупки нет. */
  function botUsername(){
    try{ var B=window.VORONIA_BALANCE||{}; return String((B.premium&&B.premium.botUsername)||'').replace(/^@/,'').trim(); }catch(e){ return ''; }
  }
  function openBotLink(start){
    try{
      var b=botUsername(); if(!b) return false;
      var l='https://t.me/'+b+'?start='+encodeURIComponent(start||'premium');
      if(window.Telegram&&window.Telegram.WebApp&&typeof window.Telegram.WebApp.openTelegramLink==='function') window.Telegram.WebApp.openTelegramLink(l);
      else window.open(l,'_blank');
      return true;
    }catch(e){ return false; }
  }
  window.__VORONIA_OPEN_BOT=openBotLink;
  try{ Object.defineProperty(window,'__VORONIA_BOT_READY',{get:function(){ return !!botUsername(); }}); }catch(e){ window.__VORONIA_BOT_READY=!!botUsername(); }
  /* Авто-активация: бот присылает ссылку игра#EXO-...-...-... или deep-link в WebApp. */
  var autoCodeTries=0;
  function tryAutoCode(){
    if(autoCodeTries++>24) return;
    var code='';
    try{
      var h=(location.hash||'').replace(/^#/,'').trim().toUpperCase();
      if(/^EXO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(h)) code=h;
    }catch(e){}
    if(!code){
      try{
        var w=window.Telegram&&window.Telegram.WebApp;
        var sp=w&&w.initDataUnsafe&&w.initDataUnsafe.start_param;
        if(sp){ sp=String(sp).trim().toUpperCase(); if(/^EXO-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(sp)) code=sp; }
      }catch(e){}
    }
    if(!code) return;
    var inp=$('premium-code-input');
    if(!inp){ setTimeout(tryAutoCode,700); return; }
    inp.value=code;
    try{ if(window.history&&history.replaceState) history.replaceState(null,'',location.pathname+location.search); }catch(e){}
    var btn=$('premium-activate-btn');
    if(btn) btn.click(); else setTimeout(tryAutoCode,700);
  }
  function cleanPremium(){
    var old=$('premium-trial-block'); if(old) old.remove();
    var box=$('premium-packs'); if(!box || $('premium-auto-note')) return;
    var note=document.createElement('div'); note.id='premium-auto-note';
    note.style.cssText='padding:12px;margin:0 0 12px;border:1px solid #c084fc;border-radius:10px;background:rgba(192,132,252,.07);line-height:1.5;';
    var bu=botUsername();
    note.innerHTML='<div style="font-size:12px;font-weight:900;letter-spacing:.7px;color:#d8b4fe;margin-bottom:5px;">✦ PREMIUM · ЛИЦЕНЗИЯ</div>'+
      '<div style="font-size:11px;color:#cdd9e1;">Автоматизация доступна только по Premium-коду: автоматическое сканирование, улучшение клеток, логистика и режимы Реактора.</div>'+
      (bu
        ? '<button id=premium-bot-btn type=button style="margin-top:9px;width:100%;padding:10px 12px;border-radius:9px;border:1px solid #c084fc;background:rgba(192,132,252,.12);color:#e9d5ff;font-size:12px;font-weight:800;letter-spacing:.6px;cursor:pointer;">🛒 КУПИТЬ КОД В TELEGRAM</button>'+
          '<div style="font-size:10px;color:#91adbb;margin-top:6px;">Бот пришлёт код в личные сообщения — вставьте его в поле активации ниже.</div>'
        : '<div style="font-size:10px;color:#91adbb;margin-top:6px;">Покупка и активация кодов — через Telegram-бот.</div>');
    box.insertBefore(note,box.firstChild);
    var bb=$('premium-bot-btn'); if(bb) bb.addEventListener('click',function(){ openBotLink('premium'); });
  }
  function cleanLegacyTrial(){
    try{
      var V=window.__V||{}, C=V.core||{}, ex=C.extensions||{};
      var st=ex.autoTrial_v1;
      if(st && typeof st==='object'){
        st.until=0; st.snapshot=null;
        if(window.requestSave) window.requestSave();
      }
    }catch(e){}
  }
  function tick(){ try{retireLegacyAutomation();}catch(e){} try{filterDust();}catch(e){} try{cleanPremium();}catch(e){} }
  function boot(){ cleanLegacyTrial(); tick(); setInterval(tick,2500); try{ tryAutoCode(); }catch(e){} }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot); else setTimeout(boot,0);
  window.__dustPatch={version:'0.0.23',filter:filterDust,retireLegacyAutomation:retireLegacyAutomation};
})();
