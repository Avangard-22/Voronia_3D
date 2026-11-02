
/* ============================================================================
 * Voronia v0.0.41 · БОЙ НА ИГРОВОМ ПОЛЕ (пункт 3).
 * Информация о боях (Хранители/Стражи) убрана из вкладки «Планета».
 * Вход в бой теперь на поле:
 *  1. постоянная кнопка ⚔ в planet-strip — появляется, когда бой доступен
 *     (штатный guardianNextForm); клик → window.__guardianWeaving.enter(pid);
 *  2. чип Стражи (#hud-watch-chip) кликабелен: бой или подсказка статуса.
 * Ошибки глушатся: если API недоступно — ничего не показываем.
 * ========================================================================== */
(function(){
'use strict';
function S(){return (window.__V&&window.__V.state)||{}}
function L(){return (window.__V&&window.__V.legacy)||{}}
function toast(h,k,ms){try{window.showToast&&window.showToast(h,k||'',ms||4000)}catch(e){}}
function enter(pid){
  var gw=window.__guardianWeaving;
  if(gw&&typeof gw.enter==='function'){try{gw.enter(pid);return true}catch(e){}}
  return false;
}
function readyForm(pid){
  try{var f=L().guardianNextForm;return f&&pid?f(pid):null}catch(e){return null}
}
function tick(){
  try{
    var strip=document.getElementById('planet-strip');if(!strip)return;
    var s=S(),pid=s.activePlanetId;
    var b=document.getElementById('hud-guardian-btn');
    var form=pid?readyForm(pid):null;
    if(form){
      if(!b){
        b=document.createElement('span');
        b.id='hud-guardian-btn';
        b.setAttribute('role','button');
        b.setAttribute('tabindex','0');
        b.style.cssText='cursor:pointer;color:#ff8c8c;font-weight:900;font-size:10px;letter-spacing:.4px;padding:2px 7px;border:1px solid rgba(255,94,94,.45);border-radius:8px;background:rgba(255,94,94,.08);white-space:nowrap;';
        strip.appendChild(b);
      }
      var label='⚔ '+((form&&form.name)||'БОЙ');
      if(b.textContent!==label)b.textContent=label;
    }else if(b){ b.remove(); }
  }catch(e){}
}
document.addEventListener('click',function(e){
  var t=e.target;
  if(!t||!t.closest)return;
  var b=t.closest('#hud-guardian-btn');
  var chip=b?null:t.closest('#hud-watch-chip');
  if(!b&&!chip)return;
  var s=S(),pid=s.activePlanetId;
  if(!pid){toast('Сначала выберите планету','warning',3000);return}
  var form=readyForm(pid);
  if(form){ if(!enter(pid)) toast('⚔ Бой сейчас недоступен','warning',3500); return }
  if(chip){
    var l=L(),pl=l.GAME&&l.GAME.PLANETS&&l.GAME.PLANETS[pid];
    var full=!!(pl&&pl.explored&&pl.cells&&pl.explored.size>=pl.cells.length);
    toast(full?'⚔ Хранитель восстанавливает силы — бой будет доступен скоро':'⚔ Хранитель пробудится, когда планета изучена на 100%','warning',4500);
  }
},true);
try{
  var st=document.createElement('style');
  st.textContent='#hud-watch-chip{cursor:pointer;text-decoration:underline dotted rgba(255,255,255,.35);}';
  (document.head||document.documentElement).appendChild(st);
}catch(e){}
setInterval(tick,1000);
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',tick);
tick();
try{console.info('[Voronia] hud battle v0.0.41 ready')}catch(e){}
})();
