
/* ============================================================================
 * Voronia · ВЕРФЬ (v0.0.20.0) — отдельная модалка апгрейдов флота.
 * - Лимиты: грузоподъёмность 6->10 (трюм 200 -> 204 800 т),
 *   скорость 5->10 (×1 -> ×27), флот 4->6 (1 -> 7 кораблей).
 *   Лимиты живут в BAL.transport.fleetMaxLevels, тиры скорости — в
 *   BAL.transport.speedTiers (11 записей). Кривые цен не изменены.
 * - Секция «Верфь · апгрейды» в модалке Транспорта заменяется компактной
 *   плашкой со сводкой и кнопкой «⚓ ВЕРФЬ»; вся прокачка — в новом окне
 *   с прогресс-барами, SVG-иконками и превью «сейчас -> дальше».
 * - Покупка ТОЛЬКО через штатный __V.panels.buyFleetUpgrade (единый источник
 *   истины: списание, уровень, сейв, шина, updateUI — всё родное).
 * - Работает через публичные API window.__V.{legacy,panels,bus}, внутрь бандла
 *   не лезет. Любая ошибка глушится: игра продолжается со штатной панелью.
 * ============================================================================ */
(function(){
"use strict";
var W=window;
function V(){return W.__V||{}}
function L(){return V().legacy||{}}
function PN(){return V().panels||{}}
function S(){return V().state||{}}
function $(id){return document.getElementById(id)}
function dbg(){if(W.__VORONIA_DEBUG&&W.console)console.log.apply(console,arguments)}
function esc(x){return String(x==null?"":x).replace(/[&<>"']/g,function(c){return({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[c]})}
function fmt(v){try{var f=L().fmtBig;return f?f(v):String(Math.round(Number(v)||0))}catch(e){return String(v)}}
function warn(t){try{L().showWarning&&L().showWarning(t)}catch(e){}}
function sfx(n){try{var m=V().media;m&&m.SFX&&typeof m.SFX[n]==="function"&&m.SFX[n]()}catch(e){}}
function vib(ms){try{var m=V().media;m&&m.vibrate&&m.vibrate(ms)}catch(e){}}

/* ---------------- данные (всё из штатных источников) ---------------- */
function UPG(){return L().FLEET_UPG||{}}
function maxOf(k){var u=UPG()[k];return u?u.max:0}
function costOf(k,l){var u=UPG()[k];if(!u)return{energy:0,iron:0};try{return u.cost(l)||{}}catch(e){return{}}}
function lvl(k){var f=S().fleet||{};return Math.max(0,Number(f[k])||0)}
function eff(){var l=L();return{cap:l.fleetCap?l.fleetCap():0,spd:l.fleetSpeed?l.fleetSpeed():1,ships:l.fleetShips?l.fleetShips():1}}
/* превью следующего уровня: временно выставляем уровень и зовём родные функции */
function effAt(k,lv){
  var s=S();if(!s.fleet)return eff();
  var old=s.fleet[k];s.fleet[k]=lv;
  try{return eff()}finally{s.fleet[k]=old}
}
function ironStock(){try{var l=L(),s=S();return l.planetGet?l.planetGet(s.activePlanetId,"iron")||0:0}catch(e){return 0}}
function totalOf(res){try{var l=L(),f=l.totalOf;if(typeof f==="function")return Number(f(res))||0}catch(e){}
  var s=S();if(res==="energy")return Number(s.energy)||0;if(res==="crystals")return Number(s.crystals)||0;if(res==="shards")return Number(s.shards)||0;
  return Number((s.compoundResources&&s.compoundResources[res])||0)}
function canAfford(k){var c=costOf(k,lvl(k));
  for(var r in c){var v=Number(c[r])||0;if(v>0&&totalOf(r)<v)return false}
  return true}
function mul100(x){return Math.round((Number(x)||0)*100)/100}
function costLine(c){var I={energy:"⚡",iron:"⛏",kriogen:"❄",crystals:"💎",steel:"🔩",chip:"💠",alloy:"⛓",core:"⚛",relic:"🔮",titanium:"⚙",uranium:"☢",darkMatter:"🌑",silicon:"📡",carbon:"🪨"};
  var p=[];for(var r in c){var v=Number(c[r])||0;if(v>0)p.push(fmt(v)+" "+(I[r]||r))}return p.join(" + ")}

/* ---------------- SVG-иконки ---------------- */
function iconCap(l){
  var boxes=Math.min(6,1+Math.floor(l/2)),out="",bw=40/boxes,i;
  for(i=0;i<boxes;i++)out+='<rect x="'+(8+i*bw).toFixed(1)+'" y="7" width="'+Math.max(2,bw-2).toFixed(1)+'" height="9" rx="1" fill="#4ddcff" fill-opacity="0.35" stroke="#4ddcff" stroke-width="0.8"/>';
  return '<svg viewBox="0 0 56 30" width="56" height="30">'+out+'<path d="M4 19 L52 19 L47 26 L9 26 Z" fill="#4ddcff" fill-opacity="0.4" stroke="#4ddcff" stroke-width="1.5"/></svg>'
}
function iconSpd(l){
  var fl=1+Math.min(5,Math.round(l*0.6)),out="",i;
  for(i=0;i<fl;i++){
    out+='<ellipse class="sy-flame" cx="'+(13-i*2.4).toFixed(1)+'" cy="15" rx="'+(3+Math.min(3,l*0.3)).toFixed(1)+'" ry="2.6" fill="#ffb45a" fill-opacity="'+(0.85-i*0.12).toFixed(2)+'" style="animation-delay:'+(i*90)+'ms"/>'
  }
  return '<svg viewBox="0 0 56 30" width="56" height="30">'+out+'<path d="M22 9 L46 9 L52 15 L46 21 L22 21 Z" fill="#c084fc" fill-opacity="0.3" stroke="#c084fc" stroke-width="1.5"/><rect x="28" y="13" width="10" height="4" fill="#c084fc" fill-opacity="0.55"/></svg>'
}
function iconShips(l){
  var n=Math.min(7,1+l),out="",i;
  for(i=0;i<n;i++){
    var x=1+i*7.6;
    out+='<path d="M'+x.toFixed(1)+' 10 L'+(x+4.6).toFixed(1)+' 10 L'+(x+6.4).toFixed(1)+' 15 L'+(x+4.6).toFixed(1)+' 20 L'+x.toFixed(1)+' 20 Z" fill="#ffda47" fill-opacity="'+(0.4+0.08*i).toFixed(2)+'" stroke="#ffda47" stroke-width="0.9"/>'
  }
  return '<svg viewBox="0 0 56 30" width="56" height="30">'+out+'</svg>'
}

/* ---------------- разметка ---------------- */
function bar(l,max){
  var h='<div class="sy-bar">',i,show=Math.min(max,25);
  for(i=0;i<show;i++)h+='<span class="sy-seg'+(i<l?" on":i===l?" next":"")+'"></span>';
  if(max>show)h+='<span class="sy-seg" style="flex:0 0 auto;width:auto;padding:0 3px;font-size:8px;color:#91adbb;">+'+(max-show)+'</span>';
  return h+"</div>"
}
function deltaPct(a,b){if(!(a>0)||!(b>0))return"";var p=Math.round((b/a-1)*100);return p>0?" +"+p+"%":""}
function card(k){
  var u=UPG()[k];if(!u)return"";
  var l=lvl(k),max=u.max||0,isMax=l>=max;
  var now=eff(),nxt=isMax?null:effAt(k,l+1);
  var unit={cap:function(v){return fmt(v.cap)+" т"},spd:function(v){return "×"+mul100(v.spd)},ships:function(v){return v.ships+" шт"}}[k];
  var effLine=unit(now);
  if(!isMax)effLine+=' <span class="sy-arrow">→</span> <span class="sy-next">'+unit(nxt)+'</span><span class="sy-delta">'+deltaPct(now[k],nxt[k])+"</span>";
  var c=isMax?null:costOf(k,l);
  var btn=isMax?'<button class="sy-buy" disabled>✓ МАКСИМАЛЬНЫЙ УРОВЕНЬ</button>'
    :'<button class="sy-buy" data-syk="'+k+'"'+(canAfford(k)?"":" disabled")+'>⬆ '+costLine(c)+'</button>';
  var icon=k==="cap"?iconCap(l):k==="spd"?iconSpd(l):iconShips(l);
  var sub={cap:"Трюм корабля · ×2/ур. до 10, далее ×1.35",spd:"Время рейсов · тиры, после 10-го +15%/ур.",ships:"Одновременные рейсы · +1 корабль за уровень"}[k];
  return '<div class="sy-card sy-'+k+'"><div class="sy-head"><div class="sy-icon">'+icon+"</div>"+
    '<div class="sy-title"><div class="sy-name">'+esc(u.title)+'</div><div class="sy-sub">'+sub+"</div></div>"+
    '<div class="sy-level">'+l+" / "+max+"</div></div>"+bar(l,max)+
    '<div class="sy-effect">'+effLine+"</div>"+btn+"</div>"
}
function contentHtml(){
  var e=eff(),s=S();
  return '<div class="sy-summary">'+
    '<div class="sy-stat"><span>Трюм</span><b>'+fmt(e.cap)+" т</b></div>"+
    '<div class="sy-stat"><span>Скорость</span><b>×'+mul100(e.spd)+"</b></div>"+
    '<div class="sy-stat"><span>Корабли</span><b>'+e.ships+"</b></div>"+
    '<div class="sy-stat sy-wide"><span>Суммарный трюм флота</span><b>'+fmt(e.cap*e.ships)+" т/рейс</b></div>"+
    '<div class="sy-stat sy-wide sy-res"><span>⚡ '+fmt(s.energy||0)+'</span><span>⛏ '+fmt(ironStock())+" (склад активной)</span></div>"+
    "</div>"+card("cap")+card("spd")+card("ships")+
    '<div class="sy-hint">Оплата: ⚡ — глобальная энергия, ⛏ — железо со склада активной планеты. Покупка сразу сохраняет игру. Лимиты уровней настраиваются в BAL.transport.fleetMaxLevels.</div>'
}

/* ---------------- модалка ---------------- */
function modal(){
  var m=$("shipyard-modal");
  if(m)return m;
  m=document.createElement("div");
  m.id="shipyard-modal";m.className="modal";
  m.innerHTML='<h3 class="modal-title sy-mtitle">🚀 Верфь</h3>'+
    '<div id="sy-content" class="sy-content"></div>'+
    '<div class="sy-footer"><button class="sy-totr" id="sy-totr">🚚 К перевозкам</button>'+
    '<button class="modal-close-btn sy-closebtn" id="sy-close">Закрыть</button></div>';
  document.body.appendChild(m);
  try{var arr=L().modals;if(arr&&arr.indexOf&&arr.indexOf(m)<0)arr.push(m)}catch(e){}
  $("sy-close").addEventListener("click",close);
  $("sy-totr").addEventListener("click",toTransport);
  m.addEventListener("click",function(ev){
    if(ev.target===m){close();return}
    var b=ev.target&&ev.target.closest?ev.target.closest("[data-syk]"):null;
    if(b&&!b.disabled)buy(b.getAttribute("data-syk"))
  });
  return m
}
function isOpen(){var m=$("shipyard-modal");return !!m&&m.style.display==="block"}
function render(){try{var box=$("sy-content");if(box)box.innerHTML=contentHtml()}catch(e){dbg("[shipyard] render:",e)}}
function open(){
  try{
    var m=modal();render();
    var om=L().openModal;
    if(om)om(m);else m.style.display="block";
    sfx("click")
  }catch(e){dbg("[shipyard] open:",e)}
}
function close(){try{var cm=L().closeModals;if(cm)cm();else{var m=$("shipyard-modal");if(m)m.style.display="none"}}catch(e){}}
function toTransport(){
  try{
    var l=L(),tm=l.transportModal;
    if(tm&&l.openModal){l.openModal(tm);var rt=PN().renderTransport;if(rt)rt()}
  }catch(e){dbg("[shipyard] toTransport:",e)}
}
function buy(k){
  var fn=PN().buyFleetUpgrade,ok=false;
  if(!fn){warn("Верфь: покупка недоступна");return}
  try{ok=fn(k)}catch(e){dbg("[shipyard] buy:",e)}
  if(ok){sfx("upgrade");vib(15)}
  render();syncCompact()
}

/* ---------------- компактная плашка в Транспорте ---------------- */
function syncCompact(){
  try{
    var box=$("tr-upg");if(!box)return;
    var cur=box.innerHTML||"";
    /* перехватываем только отрисованную штатную панель (или свою прошлую плашку);
       в пустую ветку («нужно 2 планеты») не лезем */
    if(cur.indexOf("tr-upg-h")<0&&cur.indexOf("sy-compact")<0)return;
    var e=eff();
    box.innerHTML='<div class="wh-section-title">Верфь · флот</div>'+
      '<div class="sy-compact"><span class="sy-compact-stats">🛸 '+e.ships+" кораблей · трюм "+fmt(e.cap)+" т · ×"+mul100(e.spd)+"</span>"+
      '<button id="sy-open-btn" class="sy-open">⚓ ВЕРФЬ →</button></div>';
    var b=$("sy-open-btn");
    if(b)b.addEventListener("click",open)
  }catch(e){dbg("[shipyard] syncCompact:",e)}
}
W.__vorShipyardSync=syncCompact;

/* ---------------- CSS ---------------- */
function css(){
  if($("shipyard-css"))return;
  var st=document.createElement("style");st.id="shipyard-css";
  st.textContent=[
  "#shipyard-modal{border-color:#4ddcff;max-width:540px;width:92%}",
  ".sy-mtitle{color:#7ee0ff;margin:0 0 12px}",
  ".sy-content{max-height:62vh;overflow-y:auto;padding-right:2px}",
  ".sy-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:12px}",
  ".sy-stat{background:#08131c;border:1px solid #29495b;border-radius:9px;padding:7px 9px;display:flex;flex-direction:column;gap:2px;min-width:0}",
  ".sy-stat span{font-size:9px;color:#91adbb;text-transform:uppercase;letter-spacing:.8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
  ".sy-stat b{font-size:13px;color:#eaf8ff;font-family:monospace}",
  ".sy-wide{grid-column:1/-1}",
  ".sy-res{flex-direction:row;justify-content:space-between}",
  ".sy-res span{color:#cfe8f2;text-transform:none;letter-spacing:0;font-size:10px}",
  ".sy-card{background:#08131c;border:1px solid #29495b;border-radius:12px;padding:11px 12px;margin-bottom:10px}",
  ".sy-card.sy-cap{border-color:rgba(77,220,255,.45)}",
  ".sy-card.sy-spd{border-color:rgba(192,132,252,.45)}",
  ".sy-card.sy-ships{border-color:rgba(255,218,71,.45)}",
  ".sy-head{display:flex;align-items:center;gap:10px;margin-bottom:8px}",
  ".sy-icon{flex:0 0 auto;display:flex;align-items:center;justify-content:center;min-width:56px}",
  ".sy-title{flex:1;min-width:0}",
  ".sy-name{font-size:13px;font-weight:800;color:#eaf8ff;margin-bottom:2px}",
  ".sy-sub{font-size:10px;color:#91adbb;line-height:1.35}",
  ".sy-level{font-family:monospace;font-size:12px;color:#7ec9e8;font-weight:800;flex-shrink:0}",
  ".sy-bar{display:flex;gap:3px;margin-bottom:8px}",
  ".sy-seg{flex:1;height:6px;border-radius:2px;background:#16242f}",
  ".sy-seg.on{background:linear-gradient(90deg,#4ddcff,#7ee08a)}",
  ".sy-seg.next{background:#3a5060;box-shadow:0 0 6px rgba(77,220,255,.4)}",
  ".sy-card.sy-spd .sy-seg.on{background:linear-gradient(90deg,#c084fc,#7ee0ff)}",
  ".sy-card.sy-spd .sy-seg.next{background:#3a2f60;box-shadow:0 0 6px rgba(192,132,252,.5)}",
  ".sy-card.sy-ships .sy-seg.on{background:linear-gradient(90deg,#ffda47,#ffb347)}",
  ".sy-card.sy-ships .sy-seg.next{background:#604a20;box-shadow:0 0 6px rgba(255,218,71,.5)}",
  ".sy-effect{font-family:monospace;font-size:13px;color:#eaf8ff;font-weight:700;margin-bottom:8px}",
  ".sy-arrow{color:#566a78}",
  ".sy-next{color:#7ee08a}",
  ".sy-delta{color:#91adbb;font-size:10px;font-weight:400}",
  ".sy-buy{width:100%;padding:10px;border-radius:9px;border:1px solid #4ddcff;background:#0a2233;color:#bfeeff;font-weight:800;font-size:12px;cursor:pointer}",
  ".sy-buy:active:not(:disabled){transform:scale(.98)}",
  ".sy-buy:disabled{opacity:.45;border-color:#333;background:#141414;color:#888;cursor:not-allowed}",
  ".sy-hint{margin-top:4px;padding:8px 10px;border-left:3px solid #4ddcff;background:rgba(77,220,255,.05);border-radius:6px;font-size:10px;color:#cfe8f2;line-height:1.45}",
  ".sy-footer{display:flex;gap:8px;margin-top:12px}",
  ".sy-totr{flex:1;padding:12px;border-radius:10px;border:1px solid #7ee08a;background:#0c1f14;color:#aef0bd;font-weight:800;font-size:12px;cursor:pointer}",
  ".sy-totr:active{transform:scale(.98)}",
  ".sy-closebtn{flex:1;margin-top:0}",
  ".sy-compact{display:flex;align-items:center;justify-content:space-between;gap:10px;background:#08131c;border:1px solid #29495b;border-radius:10px;padding:9px 11px}",
  ".sy-compact-stats{font-family:monospace;font-size:11px;color:#cfe8f2}",
  ".sy-open{padding:8px 14px;border-radius:8px;border:1px solid #4ddcff;background:#0a2233;color:#bfeeff;font-weight:800;font-size:11px;cursor:pointer;white-space:nowrap}",
  ".sy-open:active{transform:scale(.97)}",
  ".sy-flame{animation:syFlicker .9s ease-in-out infinite alternate}",
  "@keyframes syFlicker{from{opacity:.6}to{opacity:1}}",
  "@media (max-width:430px){.sy-summary{grid-template-columns:repeat(2,1fr)}.sy-wide{grid-column:1/-1}}"
  ].join("");
  document.head.appendChild(st)
}

/* ---------------- инициализация ---------------- */
function boot(){
  try{
    css();
    modal();
    var bus=V().bus;
    if(bus&&bus.on)bus.on("transport:changed",function(){try{if(isOpen())render();syncCompact()}catch(e){}});
    setInterval(function(){try{if(isOpen())render()}catch(e){}},1000);
    V().shipyard={open:open,close:close,render:render,sync:syncCompact,toTransport:toTransport,version:"0.0.20.0",
      _t:{cost:costOf,eff:eff,effAt:effAt,canAfford:canAfford,buy:buy,maxOf:maxOf,lvl:lvl}};
    dbg("[shipyard] инициализирована, лимиты cap/spd/ships:",maxOf("cap"),maxOf("spd"),maxOf("ships"))
  }catch(e){dbg("[shipyard] boot:",e)}
}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",boot);
else setTimeout(boot,0);
})();

