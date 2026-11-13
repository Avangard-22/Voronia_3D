import type { Game } from '../core/game';
import { RESOURCE_META, type LedgerResourceKey } from '../contracts/resources';

export type GameModalKind = 'save'|'settings'|'about'|'reactor'|'storage'|'sonar'|'galaxy'|'tech'|'research'|'stats'|'help'|'offline';
type Handle = { close: () => void; refresh: () => void };
type Context = { game: Game; kind: GameModalKind; onChange?: () => void; startSonar?: () => void };
let active: Handle | null = null;
let storagePage = 0;
let recipeId = '';
let quantity = 1;

const NAMES: Readonly<Record<string,string>> = {
  steel:'Сталь', chip:'Чип', alloy:'Сплав', core:'Ядро', relic:'Реликт предтеч',
  researchData:'Блок данных', researchDataBulk:'Блок данных · серия',
  researchDataElite:'Блок данных · элита', helium3:'Гелий-3', biomass:'Биомасса', platinum:'Платина',
};
const esc = (v: unknown): string => String(v ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] ?? c));
const fmt = (v: number, digits=1): string => Number.isFinite(v) ? new Intl.NumberFormat('ru-RU',{notation:Math.abs(v)>=100000?'compact':'standard',maximumFractionDigits:digits}).format(v) : '—';
const label = (key: string): string => { const m=RESOURCE_META[key as LedgerResourceKey]; return m ? `${m.icon} ${m.name}` : key; };

function ensureStyles(): void {
  if (document.getElementById('voronia-stage-c-css')) return;
  const style=document.createElement('style'); style.id='voronia-stage-c-css';
  style.textContent=`
  .legacy-nav-panel>:not(.modal-launcher-grid){display:none!important}
  .modal-launcher-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:9px;padding:8px 2px 12px}
  .modal-launcher{display:flex;min-height:76px;flex-direction:column;justify-content:center;gap:5px;padding:12px;text-align:left;border:1px solid rgba(77,220,255,.28);border-radius:13px;background:linear-gradient(145deg,rgba(12,35,50,.96),rgba(5,15,25,.96));color:#dff7ff;cursor:pointer}
  .modal-launcher b{font-size:12px;letter-spacing:.05em}.modal-launcher small{font-size:10px;line-height:1.35;color:#86aebe}
  .vmodal-overlay{position:fixed;z-index:10000;inset:0;display:flex;align-items:center;justify-content:center;padding:20px;background:rgba(0,4,10,.78);backdrop-filter:blur(9px)}
  .vmodal{display:flex;flex-direction:column;width:min(760px,calc(100vw - 32px));max-height:min(88dvh,900px);overflow:hidden;border:1px solid rgba(77,220,255,.48);border-top:2px solid #4ddcff;border-radius:19px;background:linear-gradient(160deg,#0a1b29,#06111b 62%,#080d18);box-shadow:0 28px 100px rgba(0,0,0,.66);color:#dcecf4}
  .vmodal-head{display:flex;align-items:center;gap:12px;padding:14px 17px;border-bottom:1px solid rgba(115,171,195,.18)}
  .vmodal-mark{display:grid;place-items:center;width:38px;height:38px;border:1px solid rgba(77,220,255,.4);border-radius:11px;color:#71e5ff;font-size:20px}
  .vmodal-heading{min-width:0;flex:1}.vmodal-heading small{display:block;color:#70a5b9;font:700 9px ui-monospace,monospace;letter-spacing:.17em}.vmodal-heading h2{margin:3px 0 0;color:#e9faff;font-size:16px;letter-spacing:.08em}
  .vmodal-close{width:36px;height:36px;border:1px solid rgba(140,177,194,.2);border-radius:10px;background:rgba(255,255,255,.035);color:#a9c4d1;font-size:22px;cursor:pointer}
  .vmodal-body{min-height:100px;overflow:auto;overscroll-behavior:contain;padding:16px 18px 20px;scrollbar-width:thin;scrollbar-color:#28566a transparent}
  .vmodal-foot{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px 18px;border-top:1px solid rgba(115,171,195,.16);color:#557d8e;font:700 9px ui-monospace,monospace;letter-spacing:.12em}
  .vmodal button{cursor:pointer}.vmodal button:focus-visible,.modal-launcher:focus-visible{outline:2px solid #72e5ff;outline-offset:3px}
  .vmodal-foot button,.vm-button{min-height:36px;padding:8px 13px;border:1px solid rgba(77,220,255,.36);border-radius:9px;background:rgba(77,220,255,.08);color:#bcefff;font-weight:800}
  .vm-button.primary{border-color:rgba(77,220,255,.75);background:linear-gradient(135deg,rgba(28,111,140,.55),rgba(8,40,60,.9));color:#effcff}
  .vm-button:disabled{opacity:.38;cursor:not-allowed}.vm-lead{margin:0 0 14px;color:#9db9c7;line-height:1.5;font-size:12px}
  .vm-muted,.vm-empty{color:#7595a5;font-size:11px}.vm-empty{padding:12px;border:1px dashed rgba(100,150,170,.2);border-radius:10px}
  .vm-section{margin:13px 0;padding:12px;border:1px solid rgba(91,139,161,.22);border-radius:13px;background:rgba(7,22,33,.62)}
  .vm-section h3{margin:0 0 10px;color:#a9eaff;font-size:11px;letter-spacing:.1em}
  .vm-row{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:8px 0;border-bottom:1px solid rgba(120,160,180,.1)}.vm-row:last-child{border:0}
  .vm-resource-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:8px}
  .vm-resource{display:grid;grid-template-columns:1fr auto;gap:3px 8px;padding:9px;border:1px solid rgba(92,139,160,.2);border-radius:10px;background:rgba(14,34,48,.62)}
  .vm-resource span{color:#a9c7d4;font-size:10px}.vm-resource b{color:#e8faff;font:700 13px ui-monospace,monospace}.vm-resource small{grid-column:1/-1;color:#69cda4;font-size:9px}
  .vm-costs{display:flex;flex-wrap:wrap;gap:7px;margin:8px 0}.vm-cost{display:flex;flex-direction:column;gap:2px;min-width:95px;padding:7px 9px;border:1px solid rgba(92,190,142,.36);border-radius:9px;background:rgba(30,95,66,.12);color:#8ee0b3;font-size:10px}
  .vm-cost.is-short{border-color:rgba(255,104,104,.42);background:rgba(120,35,42,.12);color:#ff9b9b}.vm-cost small{color:#7898a8;font:9px ui-monospace,monospace}
  .vm-recipe-nav{display:grid;grid-template-columns:42px minmax(0,1fr) 42px;align-items:center;gap:10px;margin-bottom:13px}
  .vm-recipe-nav button{height:40px;border:1px solid rgba(77,220,255,.38);border-radius:10px;background:rgba(77,220,255,.07);color:#c9f4ff;font-size:22px}
  .vm-recipe-title{text-align:center}.vm-recipe-title small{display:block;color:#7ea6b8;font:700 9px ui-monospace,monospace;letter-spacing:.13em}.vm-recipe-title b{display:block;margin-top:3px;color:#f0fbff;font-size:17px}
  .vm-recipe-card{padding:14px;border:1px solid rgba(77,220,255,.25);border-radius:15px;background:radial-gradient(circle at 50% 0%,rgba(47,149,183,.14),transparent 60%),rgba(4,17,27,.7)}
  .vm-quantity{display:flex;justify-content:center;gap:8px;margin:13px 0}.vm-quantity button{min-width:52px;height:34px;border:1px solid rgba(103,151,172,.3);border-radius:9px;background:rgba(255,255,255,.025);color:#9bb8c7;font-weight:800}
  .vm-quantity button.active{border-color:#4ddcff;background:rgba(77,220,255,.12);color:#dffaff}
  .vm-synthesis{display:flex;width:100%;min-height:145px;flex-direction:column;align-items:center;justify-content:center;gap:7px;margin-top:8px;border:1px solid rgba(77,220,255,.66);border-radius:16px;background:radial-gradient(circle at 50% 40%,rgba(67,205,244,.24),rgba(13,54,73,.35) 48%,rgba(4,16,26,.96) 78%);box-shadow:0 0 32px rgba(77,220,255,.12);color:#edfbff}
  .vm-synthesis .icon{font-size:36px;text-shadow:0 0 20px #4ddcff}.vm-synthesis b{font-size:13px;letter-spacing:.12em}.vm-synthesis small{color:#8eb6c6;font-size:10px}
  .vm-gate,.vm-note{margin:9px 0;padding:10px;border:1px solid rgba(255,190,92,.25);border-radius:9px;background:rgba(120,76,24,.1);color:#d8bf9b;font-size:10px;line-height:1.5}
  .vm-queue{display:grid;gap:8px}.vm-job{padding:10px;border:1px solid rgba(90,139,161,.2);border-radius:10px;background:rgba(10,28,40,.7)}
  .vm-job-head,.vm-job-foot{display:flex;justify-content:space-between;align-items:center;gap:10px}.vm-job-head b{font-size:11px}.vm-job-head small,.vm-job-foot{color:#7d9eac;font-size:9px}
  .vm-progress{height:5px;margin:8px 0;border-radius:9px;background:#122a39;overflow:hidden}.vm-progress i{display:block;height:100%;background:linear-gradient(90deg,#37b9df,#8ce6ff)}
  .vm-job-foot button{border:0;background:transparent;color:#ff9b9b;font-size:17px}
  .vm-pager{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px}.vm-pager strong{color:#a8dff0;font:700 10px ui-monospace,monospace}
  .vm-tech-grid,.vm-stat-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:8px}
  .vm-tech,.vm-stat{padding:11px;border:1px solid rgba(77,220,255,.2);border-radius:10px;background:rgba(10,31,45,.62)}
  .vm-tech h4{margin:0 0 5px;color:#e0c5ff;font-size:11px}.vm-tech p{margin:0 0 8px;color:#91a8b8;font-size:10px;line-height:1.4}
  .vm-tech small,.vm-stat small{display:block;color:#7899a9;font-size:9px}.vm-stat b{display:block;margin-top:5px;color:#dff8ff;font:700 16px ui-monospace,monospace}
  .vm-tabs{display:flex;flex-wrap:wrap;gap:6px;margin:8px 0}.vm-tabs button{min-height:32px;padding:6px 10px;border:1px solid rgba(93,147,169,.28);border-radius:8px;background:rgba(255,255,255,.025);color:#93b4c3;font-size:10px}
  .vm-tabs button.active{border-color:#4ddcff;background:rgba(77,220,255,.1);color:#dcf8ff}
  .vm-form-row{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:12px 0;color:#b4cbd5;font-size:11px}
  .vm-form-row select{min-height:35px;padding:6px 9px;border:1px solid rgba(77,220,255,.3);border-radius:8px;background:#0b2030;color:#e5f8ff}
  @media(max-width:680px){.modal-launcher-grid{gap:7px}.modal-launcher{min-height:70px;padding:10px}.vmodal-overlay{align-items:flex-end;padding:0;background:rgba(0,4,10,.72)}.vmodal{width:100%;max-height:92dvh;border-radius:19px 19px 0 0;border-bottom:0;padding-bottom:env(safe-area-inset-bottom)}.vmodal-head{padding:12px 14px}.vmodal-body{padding:13px 14px 18px}.vmodal-foot{padding:9px 14px}.vm-recipe-nav{grid-template-columns:38px minmax(0,1fr) 38px;gap:7px}}
  @media(prefers-reduced-motion:reduce){.vmodal-overlay,.vmodal{animation:none!important;transition:none!important}}
  `;
  document.head.appendChild(style);
}
if (typeof document !== 'undefined') ensureStyles();

function amounts(amountMap: object, balanceMap: object): string {
  const amounts = amountMap as Record<string, number | undefined>;
  const balances = balanceMap as Record<string, number | undefined>;
  const rows=Object.entries(amounts).filter(([,v])=>Number.isFinite(v)&&Number(v)>0);
  if(!rows.length) return '<span class="vm-muted">Бесплатно</span>';
  return `<div class="vm-costs">${rows.map(([key,value])=>{
    const have=balances[key]??0, ok=have>=Number(value);
    return `<span class="vm-cost ${ok?'':'is-short'}">${esc(label(key))} <b>${fmt(Number(value),0)}</b><small>${fmt(have,0)} / ${fmt(Number(value),0)}</small></span>`;
  }).join('')}</div>`;
}
function canPay(costMap: object, balanceMap: object): boolean {
  const cost = costMap as Record<string, number | undefined>;
  const balances = balanceMap as Record<string, number | undefined>;
  return Object.entries(cost).every(([key,value])=>(balances[key]??0)>=(value??0));
}
function resourceGrid(valueMap: object, rateMap?: object): string {
  const values = valueMap as Record<string, number | undefined>;
  const rates = rateMap as Record<string, number | undefined> | undefined;
  const entries=Object.entries(values).filter(([,v])=>Number.isFinite(v)&&v!==0);
  if(!entries.length) return '<div class="vm-empty">Нет данных.</div>';
  return `<div class="vm-resource-grid">${entries.map(([key,value])=>`<div class="vm-resource"><span>${esc(label(key))}</span><b>${fmt(Number(value),2)}</b>${(rates?.[key]??0)>0?`<small>+${fmt(rates![key]!,3)}/с</small>`:''}</div>`).join('')}</div>`;
}

function reactorView(game: Game): string {
  const s=game.snapshot(), recipes=s.reactor.recipes;
  if(!recipes.length) return '<div class="vm-empty">Рецепты не загружены.</div>';
  let index=recipes.findIndex(r=>r.id===recipeId); if(index<0) index=0;
  const rc=recipes[index]!; recipeId=rc.id;
  const gate=rc.gate?s.tech.nodes.find(n=>n.id===rc.gate)?.name??rc.gate:'';
  const jobs=s.reactor.queue.slice(0,5).map(j=>`<article class="vm-job">
    <div class="vm-job-head"><b>${esc(NAMES[j.recipeId]??j.recipeId)} · ${j.done}/${j.runs}</b><small>#${j.id} · ${j.state==='deficit'?'ДЕФИЦИТ':j.state==='running'?'РЕАКЦИЯ':'ОЧЕРЕДЬ'}</small></div>
    <div class="vm-progress"><i style="width:${Math.max(0,Math.min(100,j.progressPct)).toFixed(1)}%"></i></div>
    <div class="vm-job-foot"><span>${j.state==='deficit'?'Ожидание ресурсов':j.state==='running'?`Осталось ~${j.etaSec??'—'} с`:'Ожидает слот'}</span><button data-modal-action="cancel-job" data-job-id="${j.id}" aria-label="Отменить задачу">×</button></div></article>`).join('')||'<div class="vm-empty">Очередь пуста.</div>';
  const slotCost=s.reactor.nextSlotCost??{};
  const atMax=s.reactor.purchasedSlots>=s.reactor.maxPurchases;
  return `<p class="vm-lead">Single-recipe focus: геометрия окна остаётся неизменной при переключении рецепта.</p>
    <div class="vm-recipe-nav"><button data-modal-action="recipe-prev" aria-label="Предыдущий рецепт">‹</button><div class="vm-recipe-title"><small>РЕЦЕПТ ${index+1} / ${recipes.length}</small><b>${esc(NAMES[rc.id]??rc.id)}</b></div><button data-modal-action="recipe-next" aria-label="Следующий рецепт">›</button></div>
    <section class="vm-recipe-card"><div class="vm-row"><span>ВХОДЫ</span><b>${rc.timeSec} с / цикл</b></div>${amounts(rc.inputs,s.resources)}
      <div class="vm-row"><span>ВЫХОД</span><b>${esc(Object.entries(rc.output).map(([k,v])=>`${label(k)} ×${fmt(Number(v),0)}`).join(' · '))}</b></div>
      ${!rc.unlocked?`<div class="vm-gate">🔒 Требуется исследование: <b>${esc(gate)}</b></div>`:''}
      ${rc.unlocked&&!canPay(rc.inputs,s.resources)?'<div class="vm-note">Ресурсов пока недостаточно. Задачу можно поставить в очередь — она будет ждать оплаты в состоянии «Дефицит».</div>':''}
      <div class="vm-quantity">${[1,10,25].map(n=>`<button class="${quantity===n?'active':''}" data-modal-action="quantity" data-quantity="${n}" aria-pressed="${quantity===n}">×${n}</button>`).join('')}</div>
      <button class="vm-synthesis" data-modal-action="enqueue" data-recipe-id="${esc(rc.id)}" ${!rc.unlocked||s.reactor.queue.length>=50?'disabled':''}><span class="icon">⚗</span><b>СИНТЕЗИРОВАТЬ ×${quantity}</b><small>${!rc.unlocked?'Сначала откройте рецепт':s.reactor.queue.length>=50?'Очередь заполнена':'Добавить циклы в очередь'}</small></button>
    </section>
    <section class="vm-section"><div class="vm-row"><h3>ОЧЕРЕДЬ</h3><b>${s.reactor.queue.length} / 50</b></div><div class="vm-row"><span>Рабочие слоты</span><b>${s.reactor.slots}</b></div><div class="vm-queue">${jobs}</div></section>
    <section class="vm-section"><div class="vm-row"><h3>ПОКУПКА СЛОТА</h3><b>${s.reactor.purchasedSlots}/${s.reactor.maxPurchases}</b></div>${atMax||!Object.keys(slotCost).length?'<div class="vm-note">Все дополнительные слоты приобретены.</div>':`${amounts(slotCost,s.resources)}<button class="vm-button primary" data-modal-action="buy-slot" ${canPay(slotCost,s.resources)?'':'disabled'}>⚗ КУПИТЬ +1 СЛОТ</button>`}<p class="vm-muted">До пяти дополнительных слотов сверх базового. Покупка сохраняется в сейве.</p></section>`;
}

function storageView(game: Game): string {
  const s=game.snapshot(), active=s.planets.find(p=>p.id===s.activePlanetId);
  const names=['ГЛОБАЛЬНОЕ','ПЛАНЕТА','ГРУЗ И ДЕПО','ПРОИЗВОДСТВО','ВМЕСТИМОСТЬ','РОЛИ'];
  let body='';
  if(storagePage===0) body=`<p class="vm-lead">Глобальные балансы империи.</p>${resourceGrid(s.resources,s.perSec)}`;
  if(storagePage===1) body=`<p class="vm-lead">Локальные запасы: <b>${esc(active?.name??'—')}</b>.</p>${resourceGrid(active?.storage??{})}`;
  if(storagePage===2) body=`<div class="vm-section"><h3>ТРЮМ · ${fmt(s.logistics.cargoMass,1)} / ${fmt(s.logistics.cargoCapacity,1)}</h3>${resourceGrid(s.logistics.cargo)}</div><div class="vm-section"><h3>ДЕПО · ${fmt(s.logistics.depotMass,1)} / ${fmt(s.logistics.depotCapacity,1)}</h3>${resourceGrid(s.logistics.depot)}</div>`;
  if(storagePage===3) body=`<p class="vm-lead">Текущая скорость производства.</p>${resourceGrid(s.perSec)}`;
  if(storagePage===4) body=`<div class="vm-stat-grid"><div class="vm-stat"><small>УРОВЕНЬ</small><b>${s.warehouse.level}/${s.warehouse.maxLevel}</b></div><div class="vm-stat"><small>ЗАПАС</small><b>${fmt(s.warehouse.storedMass,1)} т</b></div><div class="vm-stat"><small>ВМЕСТИМОСТЬ</small><b>${fmt(s.warehouse.storageCapacity,1)} т</b></div><div class="vm-stat"><small>СВОБОДНО</small><b>${fmt(s.warehouse.remainingCapacity,1)} т</b></div></div><div class="vm-section"><div class="vm-row"><span>Бонус добычи</span><b>×${s.warehouse.bonusMult.toFixed(2)}</b></div>${s.warehouse.nextCost?`${amounts({alloy:s.warehouse.nextCost.alloy,energy:s.warehouse.nextCost.energy},s.resources)}<button class="vm-button primary" data-modal-action="warehouse-upgrade">УЛУЧШИТЬ СКЛАД</button>`:'<div class="vm-note">Максимальный уровень.</div>'}</div>`;
  if(storagePage===5) body='<div class="vm-note">Назначение ролей планет предусмотрено спецификацией V1, но соответствующий домен V2 пока не реализован. Фиктивные переключатели не отображаются.</div>';
  return `<div class="vm-pager"><button class="vm-button" data-modal-action="storage-prev" ${storagePage===0?'disabled':''}>‹</button><strong>${storagePage+1}/6 · ${names[storagePage]}</strong><button class="vm-button" data-modal-action="storage-next" ${storagePage===5?'disabled':''}>›</button></div><div class="vm-tabs">${names.map((n,i)=>`<button class="${i===storagePage?'active':''}" data-modal-action="storage-page" data-page="${i}">${i+1}</button>`).join('')}</div>${body}`;
}

function sonarView(game: Game): string {
  const s=game.snapshot(), q=s.sonar, p=q.nextPreview;
  return `<p class="vm-lead">Сонар раскрывает новые планеты. Все расходы проходят через игровой домен.</p>
    <div class="vm-stat-grid"><div class="vm-stat"><small>ЗАРЯДЫ</small><b>${s.sonarCharges}</b></div><div class="vm-stat"><small>СТОИМОСТЬ СТАРТА</small><b>${fmt(q.cost,0)} ⚡</b></div><div class="vm-stat"><small>ОТКРЫТО МИРОВ</small><b>${s.galaxy.discoveredCount}</b></div></div>
    <div class="vm-section"><h3>ТЕКУЩАЯ СИГНАТУРА</h3><div class="vm-row"><span>Цель</span><b>${esc(q.targetName)}</b></div><div class="vm-row"><span>Биом</span><b>${esc(q.targetBiome)}</b></div><div class="vm-row"><span>Ресурсы</span><b>${esc(q.targetResources.join(' · ')||'не определены')}</b></div><div class="vm-note">${q.bonusLeftMs>0?`Бонус ×${q.bonusMult.toFixed(2)} · точность ${q.bonusAccuracy??'—'}% · осталось ${fmt(q.bonusLeftMs/3600000,1)} ч.`:'Активного бонуса нет.'}</div></div>
    ${p?`<div class="vm-section"><h3>ПРЕДПРОСМОТР</h3><div class="vm-row"><span>Объект</span><b>${esc(p.name)}</b></div><div class="vm-row"><span>Геометрия</span><b>${esc(p.geometry)}</b></div><div class="vm-row"><span>Биом / сектор</span><b>${esc(p.biome)} · ${esc(p.sectorLabel)}</b></div><div class="vm-row"><span>Ресурсы</span><b>${esc(p.resources.join(' · ')||'не обнаружены')}</b></div><div class="vm-note">Открытие: ${fmt(q.discoveryCost,0)} ⚡ + ${q.discoveryCharges} заряд(а). Пересборка: ${fmt(q.rerollCost,0)} ⚡ + 1 заряд. Осталось: ${q.rerollsRemaining}.</div>${q.anomalyGate.unlocked?'':`<div class="vm-gate">Аномальный барьер: миры ${q.anomalyGate.discoveredWorlds}/${q.anomalyGate.requiredWorlds}, рукава ${q.anomalyGate.discoveredArms}/${q.anomalyGate.requiredArms}, исследования ${fmt(q.anomalyGate.research,0)}/${fmt(q.anomalyGate.requiredResearch,0)}.</div>`}<div class="vm-tabs"><button data-modal-action="reroll" ${s.sonarCharges<1||(s.resources.energy??0)<q.rerollCost||q.rerollsRemaining<=0?'disabled':''}>↻ ПЕРЕСОБРАТЬ</button><button class="active" data-modal-action="discover" ${s.sonarCharges<q.discoveryCharges||(s.resources.energy??0)<q.discoveryCost||(p.signalClass==='anomaly'&&!q.anomalyGate.unlocked)?'disabled':''}>ОТКРЫТЬ МИР</button></div></div>`:'<div class="vm-note">Предпросмотр следующего мира пока недоступен.</div>'}
    ${q.available?'<button class="vm-button primary" data-modal-action="sonar-minigame">⌁ ЗАПУСТИТЬ ГЛУБОКОЕ СКАНИРОВАНИЕ</button>':'<div class="vm-muted">Условия запуска сонарного сканирования пока не выполнены.</div>'}`;
}

function galaxyView(game: Game): string {
  const s=game.snapshot();
  const nodes=s.galaxy.nodes.filter(n=>n.discovered);
  return `<p class="vm-lead">Отображаются только обнаруженные системы. Скрытые планеты не раскрываются до получения сигнала.</p><div class="vm-stat-grid"><div class="vm-stat"><small>ОБНАРУЖЕНО</small><b>${s.galaxy.discoveredCount}</b></div><div class="vm-stat"><small>РУКАВОВ</small><b>${s.galaxy.discoveredArms.length}</b></div><div class="vm-stat"><small>ПРОГРЕСС</small><b>${s.galaxy.progression.completed}/${s.galaxy.progression.total}</b></div></div><div class="vm-section"><h3>ОТКРЫТЫЕ СИСТЕМЫ</h3><div class="vm-queue">${nodes.map(n=>{const route=s.galaxy.routes.find(r=>r.destinationId===n.id);const unlocked=s.unlockedPlanets.includes(n.id);return `<article class="vm-job"><div class="vm-job-head"><b>${esc(n.name)}${n.id===s.activePlanetId?' · АКТИВНА':''}</b><small>${esc(n.armId??'—')} · ${esc(n.sectorLabel)}</small></div><div class="vm-job-foot"><span>${esc(n.biome)} · ${unlocked?'открыта':'обнаружена'}</span>${unlocked&&n.id!==s.activePlanetId&&route?`<button class="vm-button" data-modal-action="travel" data-destination="${esc(n.id)}">ПЕРЕЛЁТ · ${route.hops} · ${fmt(route.firstLeg.energyCost,0)}⚡</button>`:''}</div></article>`;}).join('')||'<div class="vm-empty">Нет обнаруженных систем.</div>'}</div></div><div class="vm-section"><h3>ГАЛАКТИЧЕСКИЙ РУБЕЖ</h3><div class="vm-row"><span>Следующий этап</span><b>${esc(s.galaxy.progression.nextStage?.name??'Завершено')}</b></div><div class="vm-progress"><i style="width:${Math.max(0,Math.min(100,s.galaxy.milestone.progress*100)).toFixed(1)}%"></i></div><p class="vm-muted">Скидка на открытия: ${s.galaxy.progression.discountPct}%.</p></div>`;
}

function techView(game: Game, researchOnly=false): string {
  const s=game.snapshot(), nodes=researchOnly?s.tech.nodes.filter(n=>(n.cost.research??0)>0||n.id.includes('recipe')||n.id.startsWith('unlock_')):s.tech.nodes;
  const names=new Map(s.tech.nodes.map(n=>[n.id,n.name]));
  return `<p class="vm-lead">${researchOnly?'Научные данные и доступные исследования.':'Технологическое древо progression-домена.'}</p><div class="vm-stat-grid"><div class="vm-stat"><small>ДАННЫЕ</small><b>${fmt(s.resources.research??0,0)}</b></div><div class="vm-stat"><small>ПРИРОСТ</small><b>+${fmt(s.perSec.research,3)}/с</b></div><div class="vm-stat"><small>УЗЛЫ</small><b>${nodes.length}</b></div></div><div class="vm-tech-grid">${nodes.map(n=>{const max=n.kind==='level'&&n.maxLevel>0&&n.level>=n.maxLevel;const can=n.available&&!max&&canPay(n.cost,s.resources);const state=max?'МАКСИМУМ':n.bought?'ИЗУЧЕНО':!n.available?`🔒 ${n.prereq.map(id=>names.get(id)??id).join(', ')}`:can?'ДОСТУПНО':'НЕДОСТАТОЧНО РЕСУРСОВ';return `<article class="vm-tech"><h4>${esc(n.name)}</h4><p>${esc(n.desc)}</p><small>${n.kind==='level'?`УРОВЕНЬ ${n.level}/${n.maxLevel||'∞'}`:state}</small>${n.prereq.length?`<small>ТРЕБУЕТСЯ: ${esc(n.prereq.map(id=>names.get(id)??id).join(', '))}</small>`:''}${amounts(n.cost,s.resources)}<button class="vm-button ${can?'primary':''}" data-modal-action="buy-tech" data-tech-id="${esc(n.id)}" ${can?'':'disabled'}>${n.kind==='level'?'УЛУЧШИТЬ':'ИССЛЕДОВАТЬ'}</button></article>`;}).join('')||'<div class="vm-empty">Нет узлов для отображения.</div>'}</div>`;
}

function content(c: Context): string {
  const s=c.game.snapshot();
  switch(c.kind){
    case 'reactor': return reactorView(c.game);
    case 'storage': return storageView(c.game);
    case 'sonar': return sonarView(c.game);
    case 'galaxy': return galaxyView(c.game);
    case 'tech': return techView(c.game);
    case 'research': return techView(c.game,true);
    case 'stats': {
      const rows:[string,string][]=[['Время сессии',`${fmt(s.session.activeSeconds/60,1)} мин`],['Сканировано',String(s.session.scanned)],['Улучшено',String(s.session.upgraded)],['Глубинная добыча',String(s.session.deepMined)],['Аномалии',String(s.session.anomalies)],['Технологии',String(s.session.techsBought)],['Открыто миров',String(s.session.planetsUnlocked)],['Перелёты',String(s.session.travels)],['Улучшения склада',String(s.session.warehouseUpgrades)],['События',String(s.session.eventsTriggered)],['Разряды',String(s.session.chargesDone)],['Синтезы',String(s.session.synthRuns)]];
      return `<p class="vm-lead">Фактические счётчики текущей сессии из GameSnapshot.</p><div class="vm-stat-grid">${rows.map(([k,v])=>`<div class="vm-stat"><small>${esc(k)}</small><b>${esc(v)}</b></div>`).join('')}</div>`;
    }
    case 'help': return '<p class="vm-lead">Краткая справка по управлению Воронией.</p><div class="vm-section"><h3>ПОВЕРХНОСТЬ</h3><div class="vm-row"><span>Первый тап по клетке</span><b>Выделение</b></div><div class="vm-row"><span>Повторный тап</span><b>Действия</b></div><div class="vm-row"><span>Перетаскивание</span><b>Вращение</b></div><div class="vm-row"><span>Колесо / щипок</span><b>Масштаб</b></div></div><div class="vm-section"><h3>ЭКСПЕДИЦИЯ</h3><div class="vm-row"><span>Сонар</span><b>Открытие миров</b></div><div class="vm-row"><span>Галактика</span><b>Маршруты и перелёты</b></div><div class="vm-row"><span>Наука</span><b>Технологии и реактор</b></div></div>';
    case 'offline': return `<p class="vm-lead">Отдельный отчёт V1 с деталями начислений, капами и истощёнными жилами пока не подключён к GameSnapshot.</p><div class="vm-note">Не показываем вымышленные начисления. Для полноценного отчёта требуется отдельный контракт офлайн-результата.</div><div class="vm-stat-grid"><div class="vm-stat"><small>ВРЕМЯ СЕССИИ</small><b>${fmt(s.session.activeSeconds/60,1)} мин</b></div><div class="vm-stat"><small>ОБЪЁМ РЕСУРСОВ</small><b>${fmt(Object.values(s.resources).reduce<number>((a,v)=>a+(v??0),0),0)}</b></div></div>`;
    case 'save': return '<p class="vm-lead">Локальное сохранение экспедиции.</p><div class="vm-tabs"><button class="active" data-modal-action="save">СОХРАНИТЬ</button><button data-modal-action="load">ЗАГРУЗИТЬ</button><button data-modal-action="export">ЭКСПОРТ JSON</button><button data-modal-action="import">ИМПОРТ JSON</button></div><input id="vm-import-file" type="file" accept=".json,application/json" hidden><div class="vm-note" data-modal-status>Сохранение хранится локально в браузере.</div>';
    case 'settings': return '<p class="vm-lead">Настройки интерфейса устройства.</p><label class="vm-form-row"><span>Масштаб</span><select id="vm-scale"><option value="0.9">Компактный</option><option value="1">Стандартный</option><option value="1.1">Крупный</option></select></label><label class="vm-form-row"><span>Уменьшить анимацию</span><input id="vm-motion" type="checkbox"></label>';
    case 'about': return `<div class="vm-recipe-title"><small>VORONIA · 3D CELLULAR UNIVERSE</small><b>ГРАНИ ЗАБЫТОГО МИРА</b></div><div class="vm-stat-grid"><div class="vm-stat"><small>ВЕРСИЯ</small><b>2.0 · STAGE C</b></div><div class="vm-stat"><small>ДВИЖОК</small><b>THREE.JS</b></div><div class="vm-stat"><small>МИР</small><b>${esc(s.planets.find(p=>p.id===s.activePlanetId)?.name??'—')}</b></div></div>`;
    default: return '<div class="vm-empty">Окно не поддерживается.</div>';
  }
}

function openShell(c: Context): Handle {
  ensureStyles(); active?.close();
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  const titles:Record<GameModalKind,string>={save:'СОХРАНЕНИЯ',settings:'НАСТРОЙКИ',about:'О ПРОЕКТЕ',reactor:'РЕАКТОР v39',storage:'СКЛАД И ДОБЫЧА',sonar:'СОНАРНАЯ СТАНЦИЯ',galaxy:'КАРТА ГАЛАКТИКИ',tech:'ТЕХНОЛОГИЧЕСКОЕ ДРЕВО',research:'ИССЛЕДОВАНИЯ',stats:'СТАТИСТИКА',help:'СПРАВКА',offline:'ОФЛАЙН-ОТЧЁТ'};
  const marks:Record<GameModalKind,string>={save:'▣',settings:'⚙',about:'◈',reactor:'⚗',storage:'▤',sonar:'⌁',galaxy:'✧',tech:'⌬',research:'🔬',stats:'▥',help:'?',offline:'◷'};
  const overlay=document.createElement('div'); overlay.className='vmodal-overlay'; overlay.setAttribute('role','presentation');
  overlay.innerHTML=`<section class="vmodal" role="dialog" aria-modal="true" aria-labelledby="vmodal-title" tabindex="-1"><header class="vmodal-head"><span class="vmodal-mark">${marks[c.kind]}</span><div class="vmodal-heading"><small>VORONIA · СИСТЕМНОЕ ОКНО</small><h2 id="vmodal-title">${titles[c.kind]}</h2></div><button class="vmodal-close" data-modal-action="close" aria-label="Закрыть">×</button></header><div class="vmodal-body" data-modal-body></div><footer class="vmodal-foot"><span>VORONOI CELLULAR UNIVERSE</span><button data-modal-action="close">ЗАКРЫТЬ</button></footer></section>`;
  document.body.appendChild(overlay);
  const dialog=overlay.querySelector<HTMLElement>('[role="dialog"]')!, body=overlay.querySelector<HTMLElement>('[data-modal-body]')!;
  const oldOverflow=document.body.style.overflow, oldPadding=document.body.style.paddingRight;
  const bar=Math.max(0,window.innerWidth-document.documentElement.clientWidth);
  document.body.style.overflow='hidden'; if(bar) document.body.style.paddingRight=`${bar}px`;
  let closed=false, publicHandle:Handle;
  const render=(focus?:string)=>{body.innerHTML=content(c);if(c.kind==='settings'){const scale=body.querySelector<HTMLSelectElement>('#vm-scale'),motion=body.querySelector<HTMLInputElement>('#vm-motion');if(scale)scale.value=localStorage.getItem('voronia.uiScale')??'1';if(motion)motion.checked=localStorage.getItem('voronia.reducedMotion')==='true';}if(focus)body.querySelector<HTMLElement>(`[data-focus-key="${focus}"]`)?.focus();};
  const close=()=>{if(closed)return;closed=true;overlay.removeEventListener('click',click);overlay.removeEventListener('change',change);document.removeEventListener('keydown',key);document.body.style.overflow=oldOverflow;document.body.style.paddingRight=oldPadding;if(active===publicHandle)active=null;previous?.focus();};
  const notify=(message:string)=>{c.onChange?.();render();const n=body.querySelector<HTMLElement>('[data-modal-status]');if(n)n.textContent=message;};
  const key=(e:KeyboardEvent)=>{if(e.key==='Escape'){e.preventDefault();close();return;}if(e.key!=='Tab')return;const list=Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])')).filter(x=>!x.hidden);if(!list.length){e.preventDefault();dialog.focus();return;}const first=list[0]!,last=list[list.length-1]!;if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}};
  const click=(e:MouseEvent)=>{const t=e.target instanceof HTMLElement?e.target:null;if(!t)return;if(t===overlay){close();return;}const b=t.closest<HTMLButtonElement>('[data-modal-action]');if(!b)return;const a=b.dataset['modalAction'];if(a==='close'){close();return;}
    if(a==='recipe-prev'||a==='recipe-next'){const rs=c.game.snapshot().reactor.recipes,idx=Math.max(0,rs.findIndex(r=>r.id===recipeId));recipeId=rs[(idx+(a==='recipe-next'?1:rs.length-1))%rs.length]?.id??'';render();return;}
    if(a==='quantity'){const n=Number(b.dataset['quantity']);if(n===1||n===10||n===25)quantity=n;render();return;}
    if(a==='enqueue'){const r=c.game.dispatch('craftEnqueue',{recipeId:b.dataset['recipeId']??recipeId,runs:quantity});notify(r.ok?`В очередь добавлено ${quantity} циклов.`:`Отказ: ${r.reason} ${r.detail??''}`);return;}
    if(a==='cancel-job'){const r=c.game.dispatch('craftCancel',{jobId:Number(b.dataset['jobId']??0)});notify(r.ok?`Задача отменена. Возвращено циклов: ${r.value.removedRuns}.`:`Отмена: ${r.reason}`);return;}
    if(a==='buy-slot'){const r=c.game.dispatch('craftBuySlot',{});notify(r.ok?`Слот куплен. Всего слотов: ${r.value.slots}.`:`Слот не куплен: ${r.reason} ${r.detail??''}`);return;}
    if(a==='storage-prev'||a==='storage-next'||a==='storage-page'){const n=a==='storage-prev'?storagePage-1:a==='storage-next'?storagePage+1:Number(b.dataset['page']);storagePage=Math.max(0,Math.min(5,Number.isFinite(n)?n:0));render();return;}
    if(a==='warehouse-upgrade'){const r=c.game.dispatch('upgradeWarehouse',{});notify(r.ok?`Склад улучшен до уровня ${r.value.level}.`:`Отказ: ${r.reason} ${r.detail??''}`);return;}
    if(a==='reroll'){const r=c.game.dispatch('rerollDiscovery',{});notify(r.ok?'Сигнатура пересобрана.':`Отказ: ${r.reason} ${r.detail??''}`);return;}
    if(a==='discover'){const p=c.game.snapshot().sonar.nextPreview;const r=c.game.dispatch('discoverPlanet',{seed:p?.seed});notify(r.ok?`Открыт мир: ${r.value.name}.`:`Отказ: ${r.reason} ${r.detail??''}`);return;}
    if(a==='sonar-minigame'){close();c.startSonar?.();return;}
    if(a==='travel'){const r=c.game.dispatch('travelToPlanet',{destinationId:b.dataset['destination']??''});notify(r.ok?`Перелёт начат: ${r.value.pid}.`:`Отказ: ${r.reason} ${r.detail??''}`);return;}
    if(a==='buy-tech'){const r=c.game.dispatch('buyTech',{id:b.dataset['techId']??''});notify(r.ok?'Исследование завершено.':`Отказ: ${r.reason} ${r.detail??''}`);return;}
    if(a==='save'){const r=c.game.dispatch('save',{});notify(r.ok?`Сохранено · ${fmt(r.value.sizeBytes,0)} байт.`:'Ошибка сохранения.');return;}
    if(a==='load'){const r=c.game.dispatch('load',{});notify(r.ok?'Сохранение загружено.':`Загрузка: ${r.reason} ${r.detail??''}`);return;}
    if(a==='export'){const r=c.game.dispatch('exportSave',{});if(r.ok){const url=URL.createObjectURL(new Blob([r.value.payload],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='voronia2-save.json';link.click();URL.revokeObjectURL(url);}notify(r.ok?'Файл экспорта подготовлен.':'Ошибка экспорта.');return;}
    if(a==='import'){body.querySelector<HTMLInputElement>('#vm-import-file')?.click();return;}
  };
  const change=(e:Event)=>{const t=e.target;if(!(t instanceof HTMLElement))return;if(t.id==='vm-import-file'&&t instanceof HTMLInputElement){const f=t.files?.[0];if(!f)return;void f.text().then(payload=>{const r=c.game.dispatch('importSave',{payload});notify(r.ok?`Импортировано · ${fmt(r.value.sizeBytes,0)} байт.`:'Импорт отклонён.');t.value='';}).catch(()=>notify('Не удалось прочитать файл.'));}
    if(t.id==='vm-scale'&&t instanceof HTMLSelectElement){document.documentElement.style.setProperty('--voronia-ui-scale',t.value);localStorage.setItem('voronia.uiScale',t.value);}
    if(t.id==='vm-motion'&&t instanceof HTMLInputElement){document.documentElement.classList.toggle('voronia-reduced-motion',t.checked);localStorage.setItem('voronia.reducedMotion',String(t.checked));}
  };
  const refresh=()=>render();
  publicHandle={close,refresh};active=publicHandle;render();document.addEventListener('keydown',key);overlay.addEventListener('click',click);overlay.addEventListener('change',change);
  requestAnimationFrame(()=>overlay.querySelector<HTMLElement>('[data-modal-action="close"]')?.focus());
  return publicHandle;
}

export function openGameModal(game:Game,kind:GameModalKind,onChange?:()=>void,startSonar?:()=>void):void {
  if(kind==='reactor')recipeId=game.snapshot().reactor.recipes[0]?.id??'';
  if(kind==='storage')storagePage=0;
  openShell({game,kind,onChange,startSonar});
}
