
/* ============================================================================
 * Voronia v0.0.41 · ПОКУПКА СЛОТОВ СИНТЕЗА РЕАКТОРА (пункт 6a).
 * До +5 слотов сверх всех прежних источников. Цена — «овергигантская»:
 * энергия + железо/криоген + кристаллы + сплавы (сталь/чипы/сплав/ядро/
 * реликт) + редкие (титан/уран/тёмная материя). Все числа — в реестре:
 * VORONIA_BALANCE.craft.slotPurchase {max, costs[5]}.
 * Покупка живёт в extension reactorSlots_v1 (переживает сейв и престижи);
 * qn() бандла учитывает её через LABS(). Кнопка рендерится в шапке Реактора
 * (cv() бандла зовёт window.__VOR_LAB_SLOTS.badge()), клик — делегированием.
 * Списание: штатный spendGlobal (железо/редкие — со складов всех планет).
 * ========================================================================== */
(function(){
'use strict';
var ICONS={energy:'⚡',iron:'⛏',kriogen:'❄',crystals:'💎',steel:'🔩',chip:'💠',alloy:'⛓',core:'⚛',relic:'🔮',titanium:'⚙',uranium:'☢',darkMatter:'🌑',silicon:'📡',carbon:'🪨',research:'🧪'};
function L(){return (window.__V&&window.__V.legacy)||{}}
function cfg(){return (window.VORONIA_BALANCE&&window.VORONIA_BALANCE.craft&&window.VORONIA_BALANCE.craft.slotPurchase)||{max:5,costs:[]}}
function ext(){
  try{
    var C=(window.__V&&window.__V.core)||{};
    if(C.registerExtension)return C.registerExtension('reactorSlots_v1',{bought:0});
    C.extensions=C.extensions||{};
    if(!C.extensions.reactorSlots_v1||typeof C.extensions.reactorSlots_v1!=='object')C.extensions.reactorSlots_v1={bought:0};
    return C.extensions.reactorSlots_v1;
  }catch(e){return {bought:0}}
}
function fmt(v){try{return L().fmtBig?L().fmtBig(v):String(Math.round(Number(v)||0))}catch(e){return String(v)}}
function toast(h,k,ms){try{window.showToast&&window.showToast(h,k||'',ms||4000)}catch(e){}}
function total(k){try{var f=L().totalOf;if(typeof f==='function')return Number(f(k))||0}catch(e){}return 0}
function costText(c){var p=[];for(var k in c){var v=Number(c[k])||0;if(v>0)p.push(fmt(v)+' '+(ICONS[k]||k))}return p.join(' · ')}
function canAfford(c){for(var k in c){var v=Number(c[k])||0;if(v>0&&total(k)<v)return false}return true}
var API={
  bought:function(){return Math.min(Number(cfg().max)||0,Number(ext().bought)||0)},
  badge:function(){
    try{
      var cf=cfg(),b=API.bought();
      if(b>=(Number(cf.max)||0))return ' <span style="font-size:9px;color:#7ee08a;font-weight:800;" title="Куплено слотов: '+b+'/'+cf.max+'">✦ СЛОТЫ MAX</span>';
      var c=(cf.costs||[])[b];if(!c)return '';
      var ok=canAfford(c);
      return ' <button id="lab-slot-buy" type="button" title="Купить слот №'+(b+1)+': '+costText(c)+'" style="margin-left:6px;padding:2px 7px;font-size:9px;font-weight:800;border-radius:7px;cursor:pointer;vertical-align:middle;border:1px solid '+(ok?'#2e7d4f':'#3a4a55')+';color:'+(ok?'#7ee08a':'#7f9aa8')+';background:'+(ok?'rgba(126,224,138,.08)':'rgba(255,255,255,.03)')+';">⚗ +1 СЛОТ</button>';
    }catch(e){return ''}
  },
  buy:function(){
    var cf=cfg(),b=API.bought();
    if(b>=(Number(cf.max)||0)){toast('⚗ Слоты Реактора уже максимальны','warning',3000);return}
    var c=(cf.costs||[])[b];
    if(!c){toast('Цена слота не определена','warning',3500);return}
    if(!canAfford(c)){toast('⚗ Недостаточно ресурсов для слота №'+(b+1)+':<br><span style="font-size:10px;color:#91adbb;">'+costText(c)+'</span>','warning',5500);return}
    var l=L(),sp=l.spendAny||l.spendGlobal;
    for(var k in c){var v=Number(c[k])||0;if(v>0&&!(sp&&sp(k,v))){toast('Списание прервано: '+(ICONS[k]||k),'warning',3500);return}}
    ext().bought=b+1;
    try{window.requestSave&&window.requestSave()}catch(e){}
    try{l.updateUI&&l.updateUI()}catch(e){}
    toast('⚗ <b>Слот синтеза куплен</b><br><span style="font-size:11px;color:#7ee08a;">Слотов Реактора куплено: '+ext().bought+'/'+cf.max+'</span>','success',5000);
  }
};
window.__VOR_LAB_SLOTS=API;
document.addEventListener('click',function(e){
  var b=e.target&&e.target.closest&&e.target.closest('#lab-slot-buy');
  if(!b)return;
  e.preventDefault();e.stopPropagation();
  API.buy();
});
try{console.info('[Voronia] reactor slots v0.0.41 ready')}catch(e){}
})();
