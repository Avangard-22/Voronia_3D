
/* v0.0.23: one shared cooldown UI for the legacy guardian panel and the weaving combat. */
(function(){
  const KEY='voronia_guardian_fight_cooldowns_v2';
  function cooldownUntil(pid){
    try { const m=JSON.parse(localStorage.getItem(KEY)||'{}'); return Math.max(0,Number(m && m[pid])||0); }
    catch(_){ return 0; }
  }
  function waitText(ms){ const mins=Math.max(0,Math.ceil(ms/60000)); return Math.floor(mins/60)+' ч '+String(mins%60).padStart(2,'0')+' мин'; }
  function wrap(){
    const panels=window.__V && window.__V.panels;
    if(!panels || typeof panels.renderGuardianPanel!=='function' || panels.renderGuardianPanel.__cooldownWrapped) return false;
    const original=panels.renderGuardianPanel;
    function wrapped(planet){
      let html=String(original.apply(this,arguments));
      const pid=planet && planet.id, until=pid?cooldownUntil(pid):0, remaining=until-Date.now();
      if(!pid || remaining<=0 || !html) return html;
      html=html.replace(/<button\b[^>]*id=["']panel-guardian-fight["'][\s\S]*?<\/button>/gi,'');
      html=html.replace(/<div style="font-size:11px;color:[^"]*;margin-bottom:6px;">[\s\S]*?<\/div>/gi,function(block){
        return /Первый бой на грани|Окно Стражи открыто|ПОБЕДИТЬ — СНЯТЬ СОН|Хранитель спит|Сон планеты|Хранитель восстанавливается|пробудится через|ЖДАТЬ СТРАЖУ/i.test(block) ? '' : block;
      });
      const banner='<div data-guardian-cooldown="1" style="font-size:11px;color:#ffda47;margin:7px 0;padding:8px 10px;background:rgba(255,218,71,.07);border:1px solid rgba(255,218,71,.25);border-radius:8px;">⏳ <b>Хранитель восстанавливает силы</b><br>Следующий бой через '+waitText(remaining)+'.</div>';
      return html.replace(/(<button[^>]*id=["']panel-guardian-fight["'][\s\S]*?<\/button>)/gi,'') + banner;
    }
    wrapped.__cooldownWrapped=true; panels.renderGuardianPanel=wrapped; return true;
  }
  function refresh(){
    try { const legacy=window.__V && window.__V.legacy; if(legacy && typeof legacy.updateUI==='function') legacy.updateUI(); } catch(_){}
    try { const panels=window.__V && window.__V.panels; if(panels && typeof panels.renderPlanetPanel==='function') panels.renderPlanetPanel(); } catch(_){}
  }
  let tries=0; const timer=setInterval(()=>{ tries++; if(wrap()||tries>120) clearInterval(timer); },250);
  const ticker=setInterval(()=>{
    wrap();
    const pid=window.__V && window.__V.state && window.__V.state.activePlanetId;
    if(pid){ const until=cooldownUntil(pid); if(until>Date.now() || document.querySelector('[data-guardian-cooldown="1"]')) refresh(); }
  },15000);
  setTimeout(()=>clearInterval(ticker),24*3600*1000);
  setTimeout(refresh,500);
})();
