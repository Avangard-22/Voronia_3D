
(function(){
 'use strict';
 if(window.__voroniaResourceHudDedup0395)return;window.__voroniaResourceHudDedup0395=true;
 const $=id=>document.getElementById(id);
 const fmt=n=>{n=Number(n)||0;if(typeof window.__VORONIA_FORMAT_NUMBER==='function')return window.__VORONIA_FORMAT_NUMBER(n);if(n>=1e9)return(n/1e9).toFixed(n>=1e10?0:2).replace('.',',')+'млрд';if(n>=1e6)return(n/1e6).toFixed(n>=1e7?0:2).replace('.',',')+'м';if(n>=1e3)return(n/1e3).toFixed(n>=1e4?0:2).replace('.',',')+'к';return Math.floor(n).toLocaleString('ru-RU')};
 const state=()=>window.__V&&window.__V.state;
 const resources=()=>{try{return window.__V.legacy.RESOURCES||{}}catch(_){return {}}};
 const getPlanet=st=>st&&(st.activePlanet||(st.activePlanetId&&window.__V.legacy.PLANETS&&window.__V.legacy.PLANETS[st.activePlanetId]));
 function getKeys(p){let keys=[];try{keys=typeof window.__vorPlanetResources==='function'?window.__vorPlanetResources(p):((p&&p.resourceList)||[])}catch(_){keys=(p&&p.resourceList)||[]}const R=resources();return [...new Set((keys||[]).filter(k=>typeof k==='string'&&R[k]&&!R[k].hidden&&!R[k].legacy))]}
 function amount(st,k){return Number((k==='iron'||k==='kriogen'?st[k]:(st.extraResources||{})[k]))||0}
 function income(st,k){const i=(st.planetIncome||{})[st.activePlanetId]||{};return Number((k==='iron'||k==='kriogen'?i[k]:(i.extra||{})[k]))||0}
 function chip(k,m){const w=$('res-chips');if(!w)return null;let c=[...w.querySelectorAll('.planet-resource-chip')].find(x=>x.dataset.planetResource===k);if(!c){c=document.createElement('div');c.className='res-chip planet-resource-chip';c.dataset.planetResource=k;c.innerHTML='<span class="chip-ico"></span><div class="chip-body"><span class="chip-val"></span><span class="chip-rate">—</span></div>';const e=$('chip-energy');if(e)e.insertAdjacentElement('afterend',c);else w.appendChild(c)}const ico=c.querySelector('.chip-ico');if(ico&&c.dataset.icon!==String(m.icon||'')){ico.innerHTML=m.icon||m.ch||'◆';c.dataset.icon=String(m.icon||'')}c.title=m.name||k;c.style.borderColor=(m.color||'#7ec9e8')+'66';if(ico)ico.style.color=m.color||'#7ec9e8';return c}
 let sig='';function sync(){const st=state(),w=$('res-chips');if(!st||!w)return;const p=getPlanet(st);if(!p)return;const R=resources(),keys=getKeys(p),s=String(st.activePlanetId||p.id||p.name)+'|'+keys.join(',');
 // v0.0.39.9: нативный рендерер legacy-чипов отключён в бандле — периодический !important-форсинг больше не нужен.
 if(s!==sig){w.querySelectorAll('.planet-resource-chip').forEach(e=>e.remove());keys.forEach(k=>chip(k,R[k]||{}));sig=s}
 keys.forEach(k=>{const c=chip(k,R[k]||{});if(!c)return;c.style.removeProperty('display');const v=c.querySelector('.chip-val'),r=c.querySelector('.chip-rate');if(v)v.textContent=fmt(amount(st,k));const n=income(st,k);if(r){r.textContent=n>0?'+'+fmt(n)+'/с':'—';r.style.color=n>0?'var(--gr)':'#71818e'}c.setAttribute('aria-label',(R[k].name||k)+': '+fmt(amount(st,k)))})}
 function hideLegacyOnce(){try{['chip-iron','chip-kriogen','chip-essence','chip-rare','chip-rare2'].forEach(id=>{const e=$(id);if(e)e.style.display='none'});const w0=$('res-chips');if(w0)w0.querySelectorAll('.res-chip:not(#chip-energy):not(.planet-resource-chip)').forEach(e=>{e.style.display='none'})}catch(_){}}
 function start(){hideLegacyOnce();sync();setInterval(sync,700)}if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start,{once:true});else start();
})();
