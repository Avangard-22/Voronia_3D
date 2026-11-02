
/* ============================================================================
 * v0.0.34 · VORONIA ICONS — авторский набор иконок ресурсов (не эмодзи).
 * Единый источник арта — игровая библиотека VORONIA_ICONS ($r): те же самые
 * SVG-глифы, что рисует панель «Материя»/исследования, теперь используются
 * ВЕЗДЕ: таблицы RESOURCES/COMPOUNDS (icon = инлайновый <img>), канвас
 * (draw() через кэш растеров: ячейки планет, карта галактики, транспорт),
 * статические чипы HUD ([data-vic]).
 * char() — эмодзи-фолбэк для всплывающего текста на канвасе и на случай,
 * если модуль не загрузился. Никакой runtime-подмены DOM: только исходные
 * рендереры.
 * ========================================================================== */
(function(){'use strict';
var ART={
iron:(e,t)=>`<svg class="voronia-glyph" viewBox="0 0 64 64" width="${e}" height="${e}" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 44 A 22 22 0 1 1 50 44" fill="none" stroke="${t}" stroke-width="3" stroke-linecap="round"/>
        <path d="M32 18 L44 25 L44 39 L32 46 L20 39 L20 25 Z" fill="${t}" fill-opacity="0.22" stroke="${t}" stroke-width="2.4"/>
        <path d="M26 32 L38 32" stroke="${t}" stroke-width="2.4" stroke-linecap="round"/>
        <circle cx="32" cy="32" r="2.2" fill="${t}"/></svg>`,
kriogen:(e,t)=>`<svg class="voronia-glyph" viewBox="0 0 64 64" width="${e}" height="${e}" xmlns="http://www.w3.org/2000/svg">
        <rect x="24" y="8" width="16" height="48" rx="8" fill="${t}" fill-opacity="0.15" stroke="${t}" stroke-width="2.4"/>
        <rect x="29" y="17" width="6" height="30" rx="3" fill="none" stroke="${t}" stroke-width="1.6" opacity="0.8"/>
        <path d="M32 8 L32 17 M32 47 L32 56" stroke="${t}" stroke-width="2" stroke-linecap="round"/>
        <circle cx="32" cy="32" r="3" fill="${t}"/></svg>`,
carbon:(e,t)=>`<svg class="voronia-glyph" viewBox="0 0 64 64" width="${e}" height="${e}" xmlns="http://www.w3.org/2000/svg">
        <path d="M30 20 L19 33 M34 20 L45 31 M21 37 L30 46 M43 35 L34 46" stroke="${t}" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M32 8 L38 14 L32 20 L26 14 Z" fill="${t}" fill-opacity="0.25" stroke="${t}" stroke-width="2"/>
        <path d="M18 28 L24 34 L18 40 L12 34 Z" fill="${t}" fill-opacity="0.25" stroke="${t}" stroke-width="2"/>
        <path d="M46 26 L52 32 L46 38 L40 32 Z" fill="${t}" fill-opacity="0.25" stroke="${t}" stroke-width="2"/>
        <path d="M32 44 L38 50 L32 56 L26 50 Z" fill="${t}" fill-opacity="0.25" stroke="${t}" stroke-width="2"/></svg>`,
silicon:(e,t)=>`<svg class="voronia-glyph" viewBox="0 0 64 64" width="${e}" height="${e}" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 20 L48 20 L54 32 L48 44 L16 44 L10 32 Z" fill="${t}" fill-opacity="0.12" stroke="${t}" stroke-width="2.4"/>
        <path d="M22 38 L42 24" stroke="${t}" stroke-width="2.2" stroke-linecap="round"/>
        <rect x="28" y="28" width="10" height="8" fill="${t}" fill-opacity="0.3" stroke="${t}" stroke-width="1.6"/>
        <circle cx="54" cy="32" r="2.5" fill="${t}"/></svg>`,
titanium:(e,t)=>`<svg class="voronia-glyph" viewBox="0 0 64 64" width="${e}" height="${e}" xmlns="http://www.w3.org/2000/svg">
        <path d="M32 6 L44 12 L44 40 L32 58 L20 40 L20 12 Z" fill="${t}" fill-opacity="0.15" stroke="${t}" stroke-width="2.6"/>
        <path d="M32 14 L39 18 L39 38 L32 48 L25 38 L25 18 Z" fill="none" stroke="${t}" stroke-width="1.8"/>
        <path d="M32 14 L32 48 M28 30 L36 30" stroke="${t}" stroke-width="2" stroke-linecap="round"/></svg>`,
uranium:(e,t)=>`<svg class="voronia-glyph" viewBox="0 0 64 64" width="${e}" height="${e}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="6" fill="${t}" fill-opacity="0.35" stroke="${t}" stroke-width="2.2"/>
        <path d="M27.8 8.4 A24 24 0 0 1 54.6 23.8" fill="none" stroke="${t}" stroke-width="3" stroke-linecap="round"/>
        <path d="M54.6 40.2 A24 24 0 0 1 27.8 55.6" fill="none" stroke="${t}" stroke-width="3" stroke-linecap="round"/>
        <path d="M13.6 47.4 A24 24 0 0 1 13.6 16.6" fill="none" stroke="${t}" stroke-width="3" stroke-linecap="round"/></svg>`,
helium3:(e,t)=>`<svg class="voronia-glyph" viewBox="0 0 64 64" width="${e}" height="${e}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="20" fill="none" stroke="${t}" stroke-width="1.4" stroke-dasharray="4 6" opacity="0.6"/>
        <circle cx="32" cy="12" r="5" fill="${t}" fill-opacity="0.35" stroke="${t}" stroke-width="2"/>
        <circle cx="15" cy="42" r="5" fill="${t}" fill-opacity="0.35" stroke="${t}" stroke-width="2"/>
        <circle cx="49" cy="42" r="5" fill="${t}" fill-opacity="0.35" stroke="${t}" stroke-width="2"/></svg>`,
biomass:(e,t)=>`<svg class="voronia-glyph" viewBox="0 0 64 64" width="${e}" height="${e}" xmlns="http://www.w3.org/2000/svg">
        <path d="M26 22 C34 26 36 22 40 18 M42 21 C40 30 40 34 39 37 M32 44 C28 44 24 44 22 44 M19 26 C18 32 18 36 18 40" fill="none" stroke="${t}" stroke-width="1.8" stroke-linecap="round"/>
        <circle cx="20" cy="20" r="6" fill="${t}" fill-opacity="0.22" stroke="${t}" stroke-width="2"/>
        <circle cx="44" cy="16" r="5" fill="${t}" fill-opacity="0.22" stroke="${t}" stroke-width="2"/>
        <circle cx="38" cy="42" r="6" fill="${t}" fill-opacity="0.22" stroke="${t}" stroke-width="2"/>
        <circle cx="18" cy="44" r="4" fill="${t}" fill-opacity="0.22" stroke="${t}" stroke-width="2"/></svg>`,
platinum:(e,t)=>`<svg class="voronia-glyph" viewBox="0 0 64 64" width="${e}" height="${e}" xmlns="http://www.w3.org/2000/svg">
        <path d="M32 10 A22 22 0 1 1 13 43" fill="none" stroke="${t}" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M47 32 A15 15 0 1 1 32 17" fill="none" stroke="${t}" stroke-width="2.2" stroke-linecap="round"/>
        <path d="M32 40 A8 8 0 1 1 24 32" fill="none" stroke="${t}" stroke-width="1.8" stroke-linecap="round"/>
        <circle cx="32" cy="32" r="2.5" fill="${t}"/></svg>`,
darkMatter:(e,t)=>`<svg class="voronia-glyph" viewBox="0 0 64 64" width="${e}" height="${e}" xmlns="http://www.w3.org/2000/svg">
        <path d="M22 14 L30 18 L22 24 L14 18 Z" fill="${t}" fill-opacity="0.18" stroke="${t}" stroke-width="2"/>
        <path d="M46 16 L54 20 L46 26 L38 20 Z" fill="${t}" fill-opacity="0.18" stroke="${t}" stroke-width="2"/>
        <path d="M32 42 L40 46 L32 52 L24 46 Z" fill="${t}" fill-opacity="0.18" stroke="${t}" stroke-width="2"/>
        <path d="M28 20 L40 20 M48 24 L36 42 M28 44 L20 24" stroke="${t}" stroke-width="1" stroke-dasharray="2 4" opacity="0.45"/>
        <path d="M10 34 A26 26 0 0 0 54 34" fill="none" stroke="${t}" stroke-width="1.2" opacity="0.3"/></svg>`,
steel:(e,t)=>`<svg class="voronia-glyph" viewBox="0 0 64 64" width="${e}" height="${e}" xmlns="http://www.w3.org/2000/svg">
        <path d="M22 12 L42 12 L48 24 L42 36 L22 36 L16 24 Z" fill="${t}" fill-opacity="0.22" stroke="${t}" stroke-width="2.4" stroke-linejoin="round"/>
        <circle cx="32" cy="24" r="6" fill="none" stroke="${t}" stroke-width="1.8"/>
        <rect x="28" y="36" width="8" height="18" fill="none" stroke="${t}" stroke-width="2"/>
        <path d="M28 41 L36 41 M28 46 L36 46 M28 51 L36 51" stroke="${t}" stroke-width="1.2" stroke-linecap="round"/></svg>`,
chip:(e,t)=>`<svg class="voronia-glyph" viewBox="0 0 64 64" width="${e}" height="${e}" xmlns="http://www.w3.org/2000/svg">
        <rect x="14" y="14" width="36" height="36" rx="3" fill="${t}" fill-opacity="0.14" stroke="${t}" stroke-width="2.4"/>
        <rect x="24" y="24" width="16" height="16" fill="${t}" fill-opacity="0.30" stroke="${t}" stroke-width="1.6"/>
        <path d="M20 8 L20 14 M32 8 L32 14 M44 8 L44 14" stroke="${t}" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M20 50 L20 56 M32 50 L32 56 M44 50 L44 56" stroke="${t}" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M8 20 L14 20 M8 32 L14 32 M8 44 L14 44" stroke="${t}" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M50 20 L56 20 M50 32 L56 32 M50 44 L56 44" stroke="${t}" stroke-width="1.8" stroke-linecap="round"/>
        <circle cx="32" cy="32" r="2.2" fill="${t}"/></svg>`,
alloy:(e,t)=>`<svg class="voronia-glyph" viewBox="0 0 64 64" width="${e}" height="${e}" xmlns="http://www.w3.org/2000/svg">
        <path d="M32 6 L37 11 L43 9 L46 15 L52 17 L52 24 L56 28 L52 33 L56 38 L52 45 L46 47 L43 53 L37 51 L32 56 L27 51 L21 53 L18 47 L12 45 L12 38 L8 33 L12 28 L12 21 L18 19 L21 13 L27 15 Z" fill="${t}" fill-opacity="0.14" stroke="${t}" stroke-width="2.2" stroke-linejoin="round"/>
        <circle cx="32" cy="32" r="10" fill="none" stroke="${t}" stroke-width="1.8"/>
        <circle cx="32" cy="32" r="4" fill="${t}" fill-opacity="0.45" stroke="${t}" stroke-width="1.4"/></svg>`,
core:(e,t)=>`<svg class="voronia-glyph" viewBox="0 0 64 64" width="${e}" height="${e}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="22" fill="none" stroke="${t}" stroke-width="2.4"/>
        <path d="M32 14 L46 22 L46 42 L32 50 L18 42 L18 22 Z" fill="${t}" fill-opacity="0.15" stroke="${t}" stroke-width="1.8" stroke-linejoin="round"/>
        <circle cx="32" cy="32" r="5" fill="${t}" fill-opacity="0.55" stroke="${t}" stroke-width="1.6"/>
        <path d="M32 27 L32 18 M36 34 L44 39 M28 34 L20 39" stroke="${t}" stroke-width="1.4" stroke-linecap="round"/></svg>`,
relic:(e,t)=>`<svg class="voronia-glyph" viewBox="0 0 64 64" width="${e}" height="${e}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="30" r="16" fill="${t}" fill-opacity="0.12" stroke="${t}" stroke-width="2.4"/>
        <path d="M32 14 L32 46 M16 30 L48 30 M20 19 L44 41 M44 19 L20 41" stroke="${t}" stroke-width="1" opacity="0.55"/>
        <path d="M24 46 L40 46 M21 51 L43 51" stroke="${t}" stroke-width="2" stroke-linecap="round"/>
        <circle cx="32" cy="30" r="3" fill="${t}"/>
        <circle cx="38" cy="24" r="1.4" fill="${t}" opacity="0.75"/></svg>`,
researchData:(e,t)=>`<svg class="voronia-glyph" viewBox="0 0 64 64" width="${e}" height="${e}" xmlns="http://www.w3.org/2000/svg">
        <path d="M10 52 L54 52 M10 52 L10 12" stroke="${t}" stroke-width="2.2" stroke-linecap="round" fill="none"/>
        <rect x="14" y="36" width="7" height="16" fill="${t}" fill-opacity="0.25" stroke="${t}" stroke-width="1.6"/>
        <rect x="25" y="26" width="7" height="26" fill="${t}" fill-opacity="0.25" stroke="${t}" stroke-width="1.6"/>
        <rect x="36" y="16" width="7" height="36" fill="${t}" fill-opacity="0.25" stroke="${t}" stroke-width="1.6"/>
        <rect x="47" y="30" width="7" height="22" fill="${t}" fill-opacity="0.25" stroke="${t}" stroke-width="1.6"/></svg>`,
researchDataBulk:(e,t)=>`<svg class="voronia-glyph" viewBox="0 0 64 64" width="${e}" height="${e}" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 24 L32 18 L50 24 L50 48 L32 54 L14 48 Z" fill="${t}" fill-opacity="0.16" stroke="${t}" stroke-width="2.2" stroke-linejoin="round"/>
        <path d="M14 24 L32 30 L50 24" fill="none" stroke="${t}" stroke-width="1.8" stroke-linejoin="round"/>
        <path d="M32 30 L32 54" stroke="${t}" stroke-width="1.4" opacity="0.75"/>
        <path d="M22 21 L22 51 M42 21 L42 51" stroke="${t}" stroke-width="1.4" opacity="0.55"/></svg>`,
researchDataElite:(e,t)=>`<svg class="voronia-glyph" viewBox="0 0 64 64" width="${e}" height="${e}" xmlns="http://www.w3.org/2000/svg">
        <path d="M32 10 Q34 28 50 32 Q34 36 32 54 Q30 36 14 32 Q30 28 32 10 Z" fill="${t}" fill-opacity="0.28" stroke="${t}" stroke-width="2" stroke-linejoin="round"/>
        <path d="M46 46 L58 58" stroke="${t}" stroke-width="2.6" stroke-linecap="round"/>
        <path d="M42 42 L50 50" stroke="${t}" stroke-width="1.4" stroke-linecap="round" opacity="0.7"/>
        <circle cx="32" cy="32" r="2.6" fill="${t}"/>
        <circle cx="52" cy="16" r="1.6" fill="${t}" opacity="0.8"/></svg>`,
energy:(e,t)=>`<svg class="voronia-glyph" viewBox="0 0 64 64" width="${e}" height="${e}" xmlns="http://www.w3.org/2000/svg">
        <path d="M34 6 L14 34 L28 34 L24 58 L46 30 L32 30 Z" fill="${t}" fill-opacity="0.30" stroke="${t}" stroke-width="2.4" stroke-linejoin="round"/></svg>`,
crystals:(e,t)=>`<svg class="voronia-glyph" viewBox="0 0 64 64" width="${e}" height="${e}" xmlns="http://www.w3.org/2000/svg">
        <path d="M14 24 L24 12 L40 12 L50 24 L32 54 Z" fill="${t}" fill-opacity="0.22" stroke="${t}" stroke-width="2.4" stroke-linejoin="round"/>
        <path d="M14 24 L50 24" stroke="${t}" stroke-width="1.4" opacity="0.7"/>
        <path d="M24 12 L32 24 M40 12 L32 24 M32 24 L32 54" stroke="${t}" stroke-width="1.2" opacity="0.6"/>
        <path d="M24 12 L14 24 M40 12 L50 24" stroke="${t}" stroke-width="1.2" opacity="0.6"/>
        <circle cx="36" cy="19" r="1.8" fill="${t}" opacity="0.9"/></svg>`,
research:(e,t)=>`<svg class="voronia-glyph" viewBox="0 0 64 64" width="${e}" height="${e}" xmlns="http://www.w3.org/2000/svg">
        <path d="M22 8 L22 44 A10 10 0 0 0 42 44 L42 8" fill="none" stroke="${t}" stroke-width="2.4" stroke-linecap="round"/>
        <path d="M22 32 Q32 36 42 32 L42 44 A10 10 0 0 1 22 44 Z" fill="${t}" fill-opacity="0.30"/>
        <path d="M18 8 L46 8" stroke="${t}" stroke-width="2.4" stroke-linecap="round"/>
        <circle cx="28" cy="40" r="1.6" fill="${t}" opacity="0.8"/>
        <circle cx="35" cy="37" r="1" fill="${t}" opacity="0.7"/>
        <circle cx="31" cy="34" r="1.2" fill="${t}" opacity="0.6"/></svg>`,
dust:(e,t)=>`<svg class="voronia-glyph" viewBox="0 0 64 64" width="${e}" height="${e}" xmlns="http://www.w3.org/2000/svg">
        <path d="M32 8 Q34 30 56 32 Q34 34 32 56 Q30 34 8 32 Q30 30 32 8 Z" fill="${t}" fill-opacity="0.35" stroke="${t}" stroke-width="1.8" stroke-linejoin="round"/>
        <circle cx="48" cy="14" r="2" fill="${t}" opacity="0.75"/>
        <circle cx="14" cy="48" r="1.4" fill="${t}" opacity="0.55"/></svg>`,
essence:(e,t)=>`<svg class="voronia-glyph" viewBox="0 0 64 64" width="${e}" height="${e}" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="22" fill="none" stroke="${t}" stroke-width="1.2" opacity="0.35"/>
        <path d="M32 32 Q20 22 12 32 Q20 42 32 32 Q44 22 52 32 Q44 42 32 32" fill="none" stroke="${t}" stroke-width="2.4" stroke-linecap="round"/>
        <circle cx="32" cy="32" r="4" fill="${t}" fill-opacity="0.4" stroke="${t}" stroke-width="1.6"/>
        <circle cx="32" cy="32" r="1.6" fill="${t}"/>
        <circle cx="10" cy="18" r="1" fill="${t}" opacity="0.6"/>
        <circle cx="54" cy="46" r="1.2" fill="${t}" opacity="0.7"/>
        <circle cx="50" cy="12" r="0.8" fill="${t}" opacity="0.5"/></svg>`,
shards:(e,t)=>`<svg class="voronia-glyph" viewBox="0 0 64 64" width="${e}" height="${e}" xmlns="http://www.w3.org/2000/svg">
        <path d="M26 12 Q28 26 42 28 Q28 30 26 44 Q24 30 10 28 Q24 26 26 12 Z" fill="${t}" fill-opacity="0.30" stroke="${t}" stroke-width="1.8"/>
        <path d="M46 36 Q47 43 54 44 Q47 45 46 52 Q45 45 38 44 Q45 43 46 36 Z" fill="${t}" fill-opacity="0.22" stroke="${t}" stroke-width="1.4"/>
        <circle cx="52" cy="18" r="2" fill="${t}" opacity="0.8"/></svg>`
};
var COL={iron:"#d1d8dd",kriogen:"#4ddcff",carbon:"#8a8a8a",silicon:"#7a8a9a",titanium:"#a0b0c0",uranium:"#5ef260",darkMatter:"#a06bff",helium3:"#c0e8ff",biomass:"#5cf2b0",platinum:"#e0e0ff",steel:"#c0c8d0",chip:"#8fe0ff",alloy:"#d0d8e0",core:"#a0f0a8",relic:"#e0c8ff",researchData:"#4ddcff",researchDataBulk:"#7ee0ff",researchDataElite:"#ffda47",energy:"#4ddcff",crystals:"#c084fc",research:"#4ddcff",dust:"#ff4d9d",essence:"#c084fc",shards:"#c084fc"};
var EMOJI={iron:"⛏",kriogen:"❄",carbon:"🪨",silicon:"📡",titanium:"⚙️",uranium:"☢️",darkMatter:"🌑",helium3:"🌫️",biomass:"🧬",platinum:"💍",steel:"🔩",chip:"💠",alloy:"⛓️",core:"⚛️",relic:"🔮",researchData:"📊",researchDataBulk:"📦",researchDataElite:"🌠",energy:"⚡",crystals:"💎",research:"🧪",dust:"✨",essence:"🌌",shards:"💫"};
var uriC={},imgC={};
function svgStr(k,color){var f=ART[k];if(!f)return"";try{return f(64,color||COL[k]||"#eaf8ff")}catch(e){return""}}
function uri(k){if(uriC[k]===undefined){var s=svgStr(k);uriC[k]=s?"data:image/svg+xml;charset=utf-8,"+encodeURIComponent(s):""}return uriC[k]}
function html(k){var u=uri(k);return u?'<img class="vric" src="'+u+'" alt="" draggable="false">':(EMOJI[k]||"◆")}
function char(k){return EMOJI[k]||"◆"}
function img(k,px){var key=k+"|"+px;if(key in imgC){var r=imgC[key];return r&&r.ready?r.img:null}var u=uri(k);if(!u){imgC[key]=null;return null}var rec={img:null,ready:false};try{var im=new Image();im.onload=function(){rec.ready=true};im.onerror=function(){delete imgC[key]};im.src=u;rec.img=im;imgC[key]=rec}catch(e){imgC[key]=null}return null}
function draw(ctx,k,cx,cy,px){try{var dpr=Math.min(2,window.devicePixelRatio||1);var pxr=Math.max(8,Math.round((Number(px)||14)*dpr));var im=img(k,pxr);if(!im)return false;ctx.drawImage(im,cx-px/2,cy-px/2,px,px);return true}catch(e){return false}}
function initStatic(){try{var els=document.querySelectorAll("[data-vic]");for(var i=0;i<els.length;i++){var el=els[i],k=el.getAttribute("data-vic"),u=uri(k);if(u)el.innerHTML='<img class="vric" src="'+u+'" alt="" draggable="false">'}}catch(e){}}
if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",initStatic,{once:true});else setTimeout(initStatic,0);
window.VoroniaIcons={html:html,char:char,draw:draw,uri:uri,svgStr:svgStr,colors:COL,emoji:EMOJI,refresh:initStatic,artKeys:function(){return Object.keys(ART)}};
})();
