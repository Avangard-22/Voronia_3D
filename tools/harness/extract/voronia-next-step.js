
/* Неlinearный ориентир: одна текущая цель, вычисленная по реальному состоянию сейва.
   Не запрещает ничего — отвечает на вопрос «что делать дальше?». */
(()=>{'use strict';
if(window.__vorNextStep)return;
const $=id=>document.getElementById(id);
const S=()=>(window.__V||{}).state||{}, L=()=>(window.__V||{}).legacy||{}, BUS=()=>(window.__V||{}).bus;
function fmt(x){try{return window.fmtBig?window.fmtBig(x):String(Math.floor(x||0))}catch(e){return String(Math.floor(x||0))}}
function vi(k,ch){try{if(window.VoroniaIcons)return window.VoroniaIcons.html(k)}catch(e){}return ch||''}
function kriosCost(){try{return (window.VORONIA_BALANCE.sonar||{}).hintEnergy||1500}catch(e){return 1500}}
function eps(){return Number(S().energyPerSec)||0}
function pl(){try{return L().PLANETS||{}}catch(e){return{}}}
function unlocked(){const u=S().unlockedPlanets;return u&&typeof u.has==='function'?u:new Set(['ferrum'])}
function exploredNew(p){if(!p||!p.explored)return 0;let c=0;try{p.explored.forEach(id=>{if(id!==p.startingCellId&&p.cells[id])c++})}catch(e){}return c}
function hasUpgraded(p){if(!p||!p.explored)return false;let r=false;try{p.explored.forEach(id=>{const c=p.cells[id];if(c&&(c.level|0)>0&&(c.type===0||c.type===3||c.type===5))r=true})}catch(e){}return r}
function hasVein(){for(const pid of unlocked()){const p=pl()[pid];if(!p||!p.explored)continue;let f=false;try{p.explored.forEach(id=>{const c=p.cells[id];if(c&&(c.type===3||c.type===5))f=true})}catch(e){}if(f)return true}return false}
function researched(id){try{return !!(S().researchPerks&&S().researchPerks[id])}catch(e){return false}}
function compounds(){return S().compoundResources||{}}
function bestLevel(){let mx=0;for(const pid of unlocked()){const p=pl()[pid];if(!p||!p.explored)continue;try{p.explored.forEach(id=>{const c=p.cells[id];if(c)mx=Math.max(mx,c.level|0)})}catch(e){}}return mx}
function tabClick(t){try{const b=document.querySelector('.nav-tab[data-target="'+t+'"]');b&&b.click&&b.click()}catch(e){}}
function modalOpen(){try{return (L().modals||[]).some(m=>m&&m.style&&m.style.display==='block')}catch(e){return false}}
const GOALS=[
 ()=>{const f=pl().ferrum;if(f&&exploredNew(f)===0)return{title:'Просканируй первую клетку',need:'Тапни жёлтую клетку у центра → «СКАНИРОВАТЬ» в панели снизу',reward:'Клетка станет источником энергии '+vi('energy','⚡'),act:null};return null},
 ()=>{const f=pl().ferrum;if(f&&exploredNew(f)>0&&!hasUpgraded(f))return{title:'Улучши клетку',need:'Выбери открытую клетку → «УЛУЧШИТЬ» (цена видна в панели)',reward:'+1 '+vi('energy','⚡')+'/с навсегда — доход растёт',act:null};return null},
 ()=>{if(unlocked().has('krios'))return null;const cost=kriosCost(),e=Number(S().energy)||0;return{title:'Открой Криос-9',need:'Не хватает '+fmt(Math.max(0,cost-e))+' '+vi('energy','⚡')+' из '+fmt(cost)+' (доход '+fmt(eps())+' '+vi('energy','⚡')+'/с)',progress:Math.min(1,e/cost),reward:'Вторая планета: криоген '+vi('kriogen','❄')+', новые жилы и ресурсы',act:{label:'К планете',fn:()=>tabClick('planet')}}},
 ()=>{if(unlocked().size<2)return null;const f=pl().ferrum;if(f&&f.explored&&f.explored.size<f.cells.length&&exploredNew(f)<3&&!Object.keys(S().researchPerks||{}).length)return{title:'Сканируй ещё клетки',need:'Каждый скан: новая клетка, наука '+vi('research','🧪')+' и шанс найти жилу',reward:'Наука открывает исследования',act:null};return null},
 ()=>{if(unlocked().size<2||Object.keys(S().researchPerks||{}).length>0)return null;return{title:'Первое исследование',need:'У тебя '+fmt(Number(S().research)||0)+' '+vi('research','🧪')+' — вкладка «Наука» → «Исследования»',reward:'Множители добычи, новые ресурсы, рецепты',act:{label:'К науке',fn:()=>tabClick('science')}}},
 ()=>{if(unlocked().size<2||hasVein())return null;return{title:'Найди жилу',need:'Сканируй клетки: жилы дают железо '+vi('iron','⛏')+' и криоген '+vi('kriogen','❄'),reward:'Ресурсы для исследований и Реактора',act:{label:'К планете',fn:()=>tabClick('planet')}}},
 ()=>{if(unlocked().size<2)return null;
    if(researched('recipe_steel')){if((Number(compounds().steel)||0)>0)return null;
      return{title:'Реактор: первая сталь',need:'«Наука» → Реактор: собери сталь (железо + углерод + '+vi('energy','⚡')+')',reward:'Пассивный бонус + сталь — компонент апгрейдов с 24 уровня',act:{label:'К Реактору',fn:()=>tabClick('science')}}}
    if(Object.keys(S().researchPerks||{}).length>0)return{title:'Открой «Рецепт: Сталь»',need:'Исследуй в «Наука» → Реактор откроется',reward:'Реактор: бонусы и компоненты апгрейдов',act:{label:'К науке',fn:()=>tabClick('science')}};
    return null},
 ()=>{const bl=bestLevel();if(bl>=10&&bl<16)return{title:'Готовься к 16 уровню',need:'С 16 уровня апгрейды дополнительно требуют науку '+vi('research','🧪')+' и продукцию Реактора (сталь — с 24)',reward:'Запаси '+vi('research','🧪')+' и сталь заранее',act:null};return null},
 ()=>{if(unlocked().size<2)return null;if((Number(S().crystals)||0)>=10&&(S().totalPrestiges||0)===0)return{title:'Доступен престиж',need:'Накоплено '+fmt(S().crystals)+' '+vi('crystals','💎')+' (нужно 10+): «Мета» → Престиж',reward:'Сброс цикла → '+vi('essence','🌌')+' эссенция и постоянные бонусы Древа Эссенции',act:{label:'К мете',fn:()=>tabClick('meta')}};return null},
 ()=>({title:'Развивай ядро',need:'Лучшая клетка: уровень '+bestLevel()+'/100 · доход '+fmt(eps())+' '+vi('energy','⚡')+'/с',progress:Math.min(1,bestLevel()/100),reward:'Вехи: 16 — наука и Реактор в цене, 24 — сталь, 34 — чипы',act:null})
];
function current(){for(const g of GOALS){try{const r=g();if(r)return r}catch(e){}}return null}
let css=document.createElement('style');css.id='nx-styles';css.textContent=
'#nx-help-icon{position:fixed;right:max(12px,env(safe-area-inset-right,0px));top:calc(env(safe-area-inset-top,0px) + 52px);bottom:auto;z-index:12000;width:46px;height:46px;display:none;align-items:center;justify-content:center;border:1px solid rgba(77,220,255,.8);border-radius:50%;background:rgba(3,15,27,.88);color:#eaf8ff;font:900 23px/1 system-ui,sans-serif;box-shadow:0 0 10px rgba(77,220,255,.48),inset 0 0 8px rgba(77,220,255,.12);animation:nxHintPulse 1.8s ease-in-out infinite;touch-action:manipulation;pointer-events:auto;padding:0}'+
'#nx-help-icon.visible{display:flex}#nx-help-icon:focus-visible{outline:2px solid #fff;outline-offset:3px}'+
'@keyframes nxHintPulse{0%,100%{box-shadow:0 0 5px rgba(77,220,255,.28);filter:brightness(.92)}50%{box-shadow:0 0 17px rgba(77,220,255,.85),0 0 28px rgba(77,220,255,.32);filter:brightness(1.22)}}'+
'#nx-panel{position:fixed;right:max(12px,env(safe-area-inset-right,0px));top:calc(env(safe-area-inset-top,0px) + 104px);bottom:auto;left:auto;width:min(300px,calc(100vw - 24px));z-index:12001;background:rgba(4,12,22,.96);border:1px solid rgba(77,220,255,.42);border-radius:12px;padding:9px 11px 10px;font:11px/1.45 system-ui,sans-serif;color:#c9d6df;box-shadow:0 6px 24px rgba(0,0,0,.5);display:none;pointer-events:auto}'+
'#nx-panel.on{display:block}#nx-head{display:flex;align-items:center;gap:6px;font-weight:800;letter-spacing:.06em;font-size:9.5px;color:#7ee0ff;text-transform:uppercase}'+
'#nx-title{font-weight:800;font-size:12px;color:#eaf8ff;margin-top:3px}#nx-need{color:#9fb8c8;margin-top:2px}#nx-reward{color:#7ee08a;margin-top:2px;font-size:10.5px}'+
'#nx-bar{height:4px;background:#16242f;border-radius:2px;margin:5px 0 1px;overflow:hidden;display:none}#nx-bar i{display:block;height:100%;background:linear-gradient(90deg,#4ddcff,#7ee08a);border-radius:2px;width:0%}'+
'#nx-action{margin-top:6px;width:100%;padding:7px 10px;border:1px solid #4ddcff;border-radius:9px;background:#0a2233;color:#bfeeff;font:800 11px system-ui,sans-serif;cursor:pointer;display:none}'+
'#nx-close{margin-left:auto;background:none;border:0;color:#7595aa;font:16px system-ui,sans-serif;cursor:pointer;padding:0 3px}'+
'@media(prefers-reduced-motion:reduce){#nx-help-icon{animation:none}}';
(document.head||document.documentElement).appendChild(css);
const hintBtn=document.createElement('button');hintBtn.id='nx-help-icon';hintBtn.type='button';hintBtn.textContent='⁉️';hintBtn.setAttribute('aria-label','Следующий шаг');hintBtn.title='Следующий шаг';
(document.body||document.documentElement).appendChild(hintBtn);
let panel=document.createElement('div');panel.id='nx-panel';
panel.innerHTML='<div id="nx-head"><span>Следующий шаг</span><button id="nx-close" type="button" aria-label="Закрыть подсказку">×</button></div><div id="nx-body"><div id="nx-title"></div><div id="nx-need"></div><div id="nx-bar"><i></i></div><div id="nx-reward"></div><button id="nx-action" type="button"></button></div>';
(document.body||document.documentElement).appendChild(panel);
function closeHint(){panel.classList.remove('on')}
hintBtn.addEventListener('click',()=>{if(panel.classList.contains('on')){closeHint();return;}try{lastSig='';render();}catch(e){}panel.classList.add('on');});
$('nx-close').addEventListener('click',closeHint);
document.addEventListener('pointerdown',ev=>{if(panel.classList.contains('on')&&!panel.contains(ev.target)&&ev.target!==hintBtn&&!hintBtn.contains(ev.target))closeHint()});
document.addEventListener('keydown',ev=>{if(ev.key==='Escape')closeHint()});
let curAct=null;const ab=$('nx-action');ab&&ab.addEventListener('click',()=>{try{curAct&&curAct();closeHint()}catch(e){}});
let lastSig='';
function render(){
 const s=S();let show=false;
 try{show=!!(s.started&&!s.gameIntro&&!s.onbActive&&!s.offlineModalVisible
  &&!($('onb-overlay')&&$('onb-overlay').classList.contains('on')))}catch(e){}
 if(!show){hintBtn.classList.remove('visible');closeHint();return}
 const g=current();if(!g){hintBtn.classList.remove('visible');closeHint();return}
 hintBtn.classList.add('visible');
 const sig=g.title+'|'+g.need+'|'+(g.progress||0);
 if(sig!==lastSig){lastSig=sig;
  const t=$('nx-title'),nd=$('nx-need'),rw=$('nx-reward'),bar=$('nx-bar');
  if(t)t.textContent=g.title;if(nd)nd.innerHTML=g.need;if(rw)rw.innerHTML=g.reward?('→ '+g.reward):'';
  if(bar){if(g.progress!=null){bar.style.display='block';const i=bar.firstChild;i&&(i.style.width=Math.round(g.progress*100)+'%')}else bar.style.display='none'}
  curAct=g.act&&g.act.fn||null;if(ab){if(g.act){ab.style.display='block';ab.textContent=g.act.label}else ab.style.display='none'}
 }
}
setInterval(()=>{try{render()}catch(e){}},1000);
try{const b=BUS();if(b&&b.on)['cell:scanned','cell:upgraded','planet:discovered','transport:changed','quest:changed'].forEach(ev=>b.on(ev,()=>setTimeout(render,150)))}catch(e){}
/* ---- отклик первых действий ---- */
let lastEps=0,lastFb=0,fbCount=0;
setInterval(()=>{try{lastEps=eps()}catch(e){}},1000);
function toast(h,t,ms){try{window.showToast&&window.showToast(h,t||'',ms||3500)}catch(e){}}
try{const b=BUS();if(b&&b.on){
 b.on('cell:upgraded',ev=>{try{
  const now=Date.now();if(now-lastFb<2600)return;
  const gs=S().gameSession;if(gs&&gs.upgraded>60)return;
  lastFb=now;const cur=eps(),dl=Math.max(0,cur-lastEps);lastEps=cur;
  let tail='';if(!unlocked().has('krios')){const c=kriosCost();tail=' · до Криос-9: '+Math.min(100,Math.round((Number(S().energy)||0)/c*100))+'%'}
  toast('⬆ <b>Клетка ур. '+(ev&&ev.level!=null?ev.level:'?')+'</b>'+(dl>0?' · доход +'+fmt(dl)+' '+vi('energy','⚡')+'/с (всего '+fmt(cur)+')':' · доход '+fmt(cur)+' '+vi('energy','⚡')+'/с')+tail);
 }catch(e){}});
 b.on('cell:scanned',()=>{try{if(fbCount++>10)return;const f=pl()[S().activePlanetId];if(!f||!f.cells||!f.cells.length)return;toast('🔍 <b>Клетка открыта</b> · исследовано '+Math.round(f.explored.size/f.cells.length*100)+'% планеты','',2800)}catch(e){}});
 b.on('planet:discovered',ev=>{try{
  let list=[];try{const pid=(ev&&ev.pid)||'';const p=pl()[pid];const rr=window.__vorPlanetResources?(p?window.__vorPlanetResources(p):[]):((p&&p.resourceList)||[]);const RES=L().RESOURCES||{};list=(rr||[]).map(k=>((RES[k]&&RES[k].icon)||'')+(RES[k]&&RES[k].name||k))}catch(e){}
  toast('🪐 <b>Новый мир!</b>'+(list.length?'<br>Ресурсы: '+list.join(' · '):'')+'<br><span style="font-size:11px;color:#91adbb;">Карта галактики обновлена — сонар ищет следующий мир.</span>','success',7000);
 }catch(e){}});
}}catch(e){}
window.__vorNextStep={current,render,panel:()=>panel,goalsCount:GOALS.length};
try{console.info('[next-step] compact ⁉️ hint icon installed')}catch(e){}
})();
