/**
 * ui/app.ts — минимальный HUD среза Этапов 2–6: ресурсы/скорости, клетки активной планеты, склад, журнал транзакций.
 * Правило STAGE1 §4: UI рендерит ИЗ СНАПШОТА и шлёт КОМАНДЫ через Game.dispatch — никаких прямых мутаций доменов.
 */
import type { Game } from '../core/game';
import type { GameSnapshot, CellView } from '../contracts/snapshot';
import { RESOURCE_META, cargoWeight, type LedgerResourceKey } from '../contracts/resources';
import { CELL_TYPE_NAMES, ANOMALY_META, type CellType } from '../contracts/cells';


let persistenceNotice = '';
const SIGNAL_META = { anomaly: ['✧', 'Аномальный'], energy: ['ϟ', 'Энергетический'], cryo: ['❄', 'Криогенный'], resource: ['◆', 'Ресурсный'], unknown: ['◌', 'Неизвестный'] } as const;

const CELL_ICONS: Record<number, string> = { 0: '⚡', 1: '🔋', 2: '💠', 3: '⛏', 4: '🌌', 5: '❄', 6: '🔬', 7: '⚛️' };

function fmt(v: number, digits = 1): string {
  if (!Number.isFinite(v)) return '∞';
  if (Math.abs(v) >= 1e9) return (v / 1e9).toFixed(2) + 'B';
  if (Math.abs(v) >= 1e6) return (v / 1e6).toFixed(2) + 'M';
  if (Math.abs(v) >= 1e3) return (v / 1e3).toFixed(1) + 'K';
  return v.toFixed(digits);
}

function resLine(key: keyof typeof RESOURCE_META, amount: number, perSec?: number): string {
  const m = RESOURCE_META[key];
  const rate = perSec !== undefined && perSec > 0 ? ` <span class="rate">+${fmt(perSec, 3)}/с</span>` : '';
  return `<div class="res"><span class="ic">${m.icon}</span> <b>${fmt(amount)}</b>${rate}</div>`;
}

/** Этап 9.3 (Этап 8 ТЗ): русские имена рецептов реактора (parity v1). */
const RECIPE_NAMES: Readonly<Record<string, string>> = Object.freeze({
  steel: 'Сталь', chip: 'Чип', alloy: 'Сплав', core: 'Ядро', relic: 'Реликт предтеч',
  researchData: 'Блок данных', researchDataBulk: 'Блок данных · серия', researchDataElite: 'Блок данных · элита',
  helium3: 'Гелий-3', biomass: 'Биомасса', platinum: 'Платина',
});

/** Этап 9.3: компактная строка «иконка+количество» для ResourceAmounts (цены/входы/выходы). */
function amountsLine(amounts: Readonly<Record<string, number>>): string {
  const parts = Object.entries(amounts).filter(([, v]) => Number.isFinite(v) && (v ?? 0) !== 0);
  if (parts.length === 0) return '—';
  return parts.map(([k, v]) => {
    const m = RESOURCE_META[k as keyof typeof RESOURCE_META];
    return `${m?.icon ?? '•'}${fmt(v ?? 0, 0)}`;
  }).join(' ');
}

function cellCard(game: Game, pid: string, c: CellView, charge: number): string {
  const icon = CELL_ICONS[c.type] ?? '·';
  const typeName = CELL_TYPE_NAMES[c.type as CellType] ?? '?';
  if (c.status === 'hidden') return `<div class="cell hidden" data-cell="${c.id}">❔</div>`;
  if (c.status === 'revealed') {
    return `<div class="cell revealed" data-cell="${c.id}"><span class="ic">${icon}</span><button data-act="scan" data-pid="${pid}" data-cell="${c.id}">Скан ${charge}⚡</button></div>`;
  }
  const parts: string[] = [`<div class="cell explored t${c.type}" data-cell="${c.id}">`, `<span class="ic">${icon}</span> <b>Ур. ${c.level}</b> <small>${typeName}</small>`];
  if (c.type === 3 || c.type === 5) {
    const cooling = c.cooldownUntil > game.clock.gameMsNow;
    parts.push(`<div class="vein">резерв ${fmt(c.reserve, 1)}/${fmt(c.maxReserve, 1)}${c.mutant ? ' 🧬' + c.mutant : ''}${c.isDeep ? ' 🕳' : ''}</div>`);
    if (cooling) parts.push(`<div class="cool">⏳ ${Math.ceil((c.cooldownUntil - game.clock.gameMsNow) / 1000)}с</div>`);
    else parts.push(`<button data-act="reactivate" data-pid="${pid}" data-cell="${c.id}">↻ Реактивация</button>`);
  }
  // Этап 4: разряд жил type1/2 (1.x i0) — кулдаун 45/90с из CellView.chargeCooldownUntil
  if (c.type === 1 || c.type === 2) {
    const cooling = c.chargeCooldownUntil > game.clock.gameMsNow;
    if (cooling) parts.push(`<div class="cool">⏳ ${Math.ceil((c.chargeCooldownUntil - game.clock.gameMsNow) / 1000)}с</div>`);
    else parts.push(`<button data-act="discharge" data-pid="${pid}" data-cell="${c.id}">⚡ Разряд</button>`);
  }
  // Этап 4: аномалия type4 — выбор ветви (1.x um) + апгрейд/deep-конверсия (1.x tl)
  if (c.type === 4) {
    if (c.anomalyType) {
      const m = ANOMALY_META[c.anomalyType];
      parts.push(`<div class="anom" style="color:${m.color}">${m.icon} ${m.name}${c.isDeep ? ' 🕳 deep' : ''}</div>`);
      parts.push(`<button data-act="anomaly" data-pid="${pid}" data-cell="${c.id}">▲ Аномалия</button>`);
    } else {
      parts.push('<div class="anom">Ветвь: ' + (['synth', 'power', 'resonance'] as const).map((b) => `<button data-act="branch" data-branch="${b}" data-pid="${pid}" data-cell="${c.id}">${ANOMALY_META[b].icon} ${ANOMALY_META[b].name}</button>`).join(' ') + '</div>');
    }
  }
  if (c.type !== 4) parts.push(`<button data-act="upgrade" data-pid="${pid}" data-cell="${c.id}">▲ Апгрейд</button>`);
  parts.push('</div>');
  return parts.join('');
}

export function renderSnapshot(game: Game, root: HTMLElement): void {
  const s: GameSnapshot = game.snapshot();
  const active = s.planets.find((p) => p.id === s.activePlanetId) ?? s.planets[0];
  const wh = s.warehouse;
  const logistics = s.logistics;
  const logisticsRows = (Object.keys(RESOURCE_META) as LedgerResourceKey[]).filter((key) => Number.isFinite(cargoWeight(key))).map((key) => {
    const globalAmount = s.resources[key] ?? 0;
    const cargoAmount = logistics.cargo[key] ?? 0;
    const depotAmount = logistics.depot[key] ?? 0;
    const specialized = logistics.specializedResources.includes(key);
    if (globalAmount <= 0 && cargoAmount <= 0 && depotAmount <= 0 && !specialized) return '';
    const meta = RESOURCE_META[key];
    return `<div class="logistics-row"><b>${meta.icon} ${meta.name}${specialized ? ' ★' : ''}</b><small>Запас ${fmt(globalAmount, 2)} · трюм ${fmt(cargoAmount, 2)} · депо ${fmt(depotAmount, 2)}</small><div><button data-act="load-cargo" data-resource="${key}" ${globalAmount <= 0 || logistics.cargoMass >= logistics.cargoCapacity ? 'disabled' : ''}>Погрузить</button><button data-act="unload-cargo" data-resource="${key}" ${cargoAmount <= 0 ? 'disabled' : ''}>Выгрузить</button><button data-act="withdraw-depot" data-resource="${key}" ${depotAmount <= 0 ? 'disabled' : ''}>Забрать</button></div></div>`;
  }).join('');
  const journal = s.journal
    .slice(-8)
    .reverse()
    .map((tx) => `<div class="tx"><b>#${tx.id}</b> ${tx.reason}: ${Object.entries(tx.delta).map(([k, v]) => `${(v ?? 0) > 0 ? '+' : ''}${fmt(v ?? 0, 2)}${RESOURCE_META[k as keyof typeof RESOURCE_META]?.icon ?? k}`).join(' ')}</div>`)
    .join('');

  // Этап 9.3 (Этап 7/8 ТЗ): дерево технологий и реактор — рендер только из снапшота,
  // команды — только через dispatch (STAGE1 §4); никаких карточек снизу, всё в колонке HUD.
  const techNameById = new Map(s.tech.nodes.map((n) => [n.id, n.name] as const));
  const techRows = s.tech.nodes.map((n) => {
    const affordable = Object.entries(n.cost).every(([k, v]) => (s.resources[k as keyof typeof s.resources] ?? 0) >= (v ?? 0));
    const maxed = n.maxLevel > 0 && n.level >= n.maxLevel;
    const state = maxed
      ? '<span class="tech-state">✓ максимум</span>'
      : !n.available
        ? `<span class="tech-state">🔒 требуется: ${n.prereq.map((p) => techNameById.get(p) ?? p).join(', ') || '—'}</span>`
        : `<button data-act="buy-tech" data-id="${n.id}" ${affordable ? '' : 'disabled'}>${n.level > 0 ? '⬆' : '🔬'} ${amountsLine(n.cost)}</button>`;
    const lvl = n.kind === 'level' ? `ур. ${n.level}${n.maxLevel > 0 ? `/${n.maxLevel}` : ''}` : n.bought ? 'изучено' : '';
    return `<div class="tech-row${n.bought ? ' bought' : ''}"><b>${n.name}${lvl ? ` <small>${lvl}</small>` : ''}</b><small>${n.desc}</small>${state}</div>`;
  }).join('');
  const recipeRows = s.reactor.recipes.map((rc) => {
    const name = RECIPE_NAMES[rc.id] ?? rc.id;
    const gate = rc.gate ? (techNameById.get(rc.gate) ?? rc.gate) : null;
    const act = rc.unlocked
      ? `<span class="craft-btns"><button data-act="craft-enqueue" data-recipe="${rc.id}">+1</button><button data-act="craft-enqueue" data-recipe="${rc.id}" data-runs="10">+10</button></span>`
      : `<span class="tech-state">🔒 ${gate ?? ''}</span>`;
    return `<div class="tech-row"><b>${name}</b><small>Вход: ${amountsLine(rc.inputs)} · ${rc.timeSec} с</small><small>Выход: ${amountsLine(rc.output)}</small>${act}</div>`;
  }).join('');
  const queueRows = s.reactor.queue.map((j) => `<div class="tech-row craft-job ${j.state}"><b>${RECIPE_NAMES[j.recipeId] ?? j.recipeId} · ${j.done}/${j.runs}</b><div class="craft-bar"><i style="width:${Math.min(100, Math.max(0, j.progressPct)).toFixed(1)}%"></i></div><small>${j.state === 'deficit' ? '⚠ Дефицит ресурсов — run ждёт оплату' : j.state === 'running' ? (j.etaSec !== null ? `⏳ ~${j.etaSec} с до готовности` : '⏳ идёт реакция') : 'в очереди'}</small><button data-act="craft-cancel" data-job="${j.id}" title="Отменить задачу">✕</button></div>`).join('');

  root.innerHTML = `
  <div class="hud">
    <div class="col">
      <h1>⚡ Voronia 2.0 <small>Stage 9.3 · ${active ? active.name : ''}</small></h1>
      ${resLine('energy', s.resources.energy ?? 0, s.perSec.energy)}
      ${resLine('iron', s.resources.iron ?? 0, s.perSec.iron)}
      ${resLine('kriogen', s.resources.kriogen ?? 0, s.perSec.kriogen)}
      ${resLine('crystals', s.resources.crystals ?? 0, s.perSec.crystals)}
      ${resLine('research', s.resources.research ?? 0, s.perSec.research)}
      ${resLine('steel', s.resources.steel ?? 0)}
      ${resLine('alloy', s.resources.alloy ?? 0)}
    </div>
    <div class="col">
      <h2>🔍 Скан</h2>
      <div>Цена: <b>${s.scan.charge}⚡</b> (база ${s.scan.currentCost})</div>
      <div>Исследовано: ${active ? `${active.exploredCount}/${active.totalCount}` : '—'}</div>
      <h2>🔋 Заряды <small>(сонар ${s.sonarCharges})</small></h2>
      <div>${s.charge ? `бафф +${(s.charge.pct * 100).toFixed(1)}% ⚡ · ${Math.ceil(s.charge.leftSec)}с${s.charge.sciPct > 0 ? ` · 🔬 +${(s.charge.sciPct * 100).toFixed(0)}%` : ''}` : 'нет активного баффа'}</div>
      <h2>🌌 Синтез</h2>
      <div>${s.synth === null ? '—' : s.synth.locked ? '🔒 требуется исследование продукта/входа' : s.synth.anomalies === 0 ? 'нет synth-аномалий' : `${s.synth.product}: +${fmt(s.synth.out, 3)}/с · −${fmt(s.synth.in, 3)}/с ${s.synth.input} · аномалий ${s.synth.anomalies}`}</div>
      <h2>📡 Сонарная станция</h2>
      <div class="sonar-preview"><b>${s.sonar.targetName}</b> · биом: ${s.sonar.targetBiome}<br><small>Обнаруженные сигнатуры: ${s.sonar.targetResources.join(' · ') || 'неизвестны'}</small></div>
      ${s.unlockedPlanets.includes('krios') ? `<div class="sonar-state">Криос-9 открыт. ${s.sonar.bonusLeftMs > 0 ? `Бонус добычи ×${s.sonar.bonusMult.toFixed(2)} · точность ${s.sonar.bonusAccuracy}% · осталось ${Math.ceil(s.sonar.bonusLeftMs / 3600000)} ч.` : 'Активного сонарного бонуса нет.'}</div>` : `<div class="sonar-state">${s.sonar.available ? `Готово к запуску · стоимость ${s.sonar.cost}⚡` : `Требуется полностью исследовать Феррум и накопить ${s.sonar.cost}⚡. Сонар работает с Феррума.`}</div><button data-act="sonar" ${s.sonar.available ? '' : 'disabled'}>📡 Запустить глубокое сканирование</button>`}
      ${s.sonar.nextPreview ? `<div class="sonar-preview"><b>Следующий сигнал · ${SIGNAL_META[s.sonar.nextPreview.signalClass][0]} ${SIGNAL_META[s.sonar.nextPreview.signalClass][1]}</b><br>${s.sonar.nextPreview.name} · ${s.sonar.nextPreview.biome} · ${s.sonar.nextPreview.geometry}<br><small>Сектор: ${s.sonar.nextPreview.sectorLabel}</small><br><small>Ресурсы: ${s.sonar.nextPreview.resources.join(' · ') || 'не обнаружены'}</small></div>${s.unlockedPlanets.includes('krios') ? `<div class="sonar-state">Открытие: ${s.sonar.discoveryCost.toLocaleString('ru-RU')} ⚡ + ${s.sonar.discoveryCharges} заряд(а) · Пересборка: ${s.sonar.rerollCost.toLocaleString('ru-RU')} ⚡ + 1 заряд · Осталось пересборок: ${s.sonar.rerollsRemaining}</div><button data-act="reroll" ${s.sonarCharges < 1 || (s.resources.energy ?? 0) < s.sonar.rerollCost || s.sonar.rerollsRemaining <= 0 ? 'disabled' : ''}>🔄 Пересобрать сигнал</button><button data-act="discover" ${s.sonarCharges < s.sonar.discoveryCharges || (s.resources.energy ?? 0) < s.sonar.discoveryCost || (s.sonar.nextPreview.signalClass === 'anomaly' && !s.sonar.anomalyGate.unlocked) ? 'disabled' : ''}>🔭 Открыть мир</button>${s.sonar.nextPreview.signalClass === 'anomaly' && !s.sonar.anomalyGate.unlocked ? `<div class="sonar-state">Аномальный барьер: миры ${s.sonar.anomalyGate.discoveredWorlds}/${s.sonar.anomalyGate.requiredWorlds}, рукава ${s.sonar.anomalyGate.discoveredArms}/${s.sonar.anomalyGate.requiredArms}, исследования ${s.sonar.anomalyGate.research}/${s.sonar.anomalyGate.requiredResearch}.</div>` : ''}` : `<button data-act="discover">🔭 Открыть этот мир</button>`}` : '<div class="sonar-state">Следующие миры станут доступны после открытия Криос-9.</div>'}
      <h2>🌌 Карта галактики <small>· обнаружено ${s.galaxy.discoveredCount}</small></h2>
      <div class="galaxy-progress"><span>Галактический рубеж: ${s.galaxy.milestone.current || '—'} / ${s.galaxy.milestone.next}</span><div class="galaxy-progress-track"><i style="width:${(s.galaxy.milestone.progress * 100).toFixed(1)}%"></i></div></div>
      <div class="galaxy-map" role="img" aria-label="Карта обнаруженных планет галактики">
        <svg viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet">
          <defs><radialGradient id="galaxyGlow"><stop stop-color="#48d8ff" stop-opacity=".25"/><stop offset="1" stop-color="#48d8ff" stop-opacity="0"/></radialGradient></defs>
          <circle cx="500" cy="500" r="460" fill="url(#galaxyGlow)"/>
          ${s.galaxy.edges.map(([a,b]) => { const p1 = s.galaxy.nodes.find((n) => n.id === a), p2 = s.galaxy.nodes.find((n) => n.id === b); return p1?.discovered && p2?.discovered ? `<line x1="${p1.mapX}" y1="${p1.mapY}" x2="${p2.mapX}" y2="${p2.mapY}"/>` : ''; }).join('') + s.galaxy.nodes.map((nd) => { const active = nd.id === s.activePlanetId; return `<g><circle class="${nd.discovered ? 'known' : 'hidden'}${active ? ' active' : ''}" cx="${nd.mapX}" cy="${nd.mapY}" r="${active ? 22 : 15}"/><text x="${nd.mapX}" y="${nd.mapY - 30}" text-anchor="middle">${nd.discovered ? nd.name : '???'}</text></g>`; }).join('')}
        </svg>
      </div>
      <div class="galaxy-legend"><span>● Обнаружена</span><span>◌ Скрыта</span><span>◎ Активная</span></div>
      <div class="sonar-state">Маршрут строится по открытым рёбрам графа. Каждый прыжок оплачивается отдельно: 150⚡ за единицу расстояния + надбавка сектора; аномальные переходы дороже на 25%. Промежуточные планеты обязательны.</div>
      <div class="galaxy-sectors">${s.galaxy.sectors.map((sector) => `<span>${sector.label}: <b>${sector.discovered}</b></span>`).join('')} · Рукавов: <b>${s.galaxy.discoveredArms.length}</b></div>
      <h3>🧭 Экспедиционная прогрессия · ${s.galaxy.progression.completed}/${s.galaxy.progression.total}</h3>
      <div class="galaxy-progression">${s.galaxy.progression.stages.map((stage) => `<div class="progression-stage${stage.unlocked ? ' complete' : ''}"><b>${stage.unlocked ? '✓' : '○'} ${stage.name}</b><small>${stage.description}</small><small>Миры ${stage.requirements.worlds.current}/${stage.requirements.worlds.required} · рукава ${stage.requirements.arms.current}/${stage.requirements.arms.required} · сектора ${stage.requirements.sectors.current}/${stage.requirements.sectors.required} · исследования ${fmt(stage.requirements.research.current, 0)}/${fmt(stage.requirements.research.required, 0)}</small><small>Скидка на открытие миров: ${stage.discoveryDiscountPct}% ${stage.unlocked ? '· получена' : '· заблокирована'}</small></div>`).join('')}</div>
      <div class="sonar-state">Текущая лицензия снижает стоимость будущих открытий на ${s.galaxy.progression.discountPct}%.</div>
      <div class="galaxy">
        ${s.galaxy.nodes.map((nd) => {
          const unlocked = s.unlockedPlanets.includes(nd.id);
          const activeMark = nd.id === s.activePlanetId ? ' ●' : '';
          const cls = SIGNAL_META[nd.signalClass];
          const route = s.galaxy.routes.find((item) => item.destinationId === nd.id);
          const nextHop = route ? s.galaxy.nodes.find((node) => node.id === route.nextHop)?.name ?? route.nextHop : '';
          const routeNames = route?.path.map((id) => s.galaxy.nodes.find((node) => node.id === id)?.name ?? id).join(' → ') ?? '';
          const btn = unlocked && route ? ` <button data-act="travel" data-pid="${nd.id}" ${(s.resources.energy ?? 0) < route.firstLeg.energyCost ? 'disabled' : ''}>Маршрут · ${route.hops} прыжк. · ${fmt(route.firstLeg.energyCost, 0)}⚡</button><small>Следующий узел: ${nextHop} · ${fmt(route.totalDistance, 1)} ед. · весь маршрут ${fmt(route.totalEnergy, 0)}⚡</small><small>${routeNames}</small>` : '';
          return `<div class="gnode${nd.discovered ? '' : ' undiscovered'}"><b>${nd.discovered ? nd.name : 'Неизвестный объект'}${activeMark}</b> <small>${cls[0]} ${cls[1]} · ${nd.armId} · ${nd.sectorLabel}${unlocked ? '' : ' 🔒'}</small>${btn}</div>`;
        }).join('')}
      </div>
      <h2>✧ Аномальные экспедиции</h2>
      <div class="anomaly-expeditions">${s.galaxy.anomalies.length ? s.galaxy.anomalies.map((site) => `<div class="progression-stage${site.resolved ? ' complete' : ''}"><b>${site.resolved ? '✓' : site.available ? '✧' : '🔒'} ${site.title} · ${site.planetName}</b><small>Уровень угрозы ${site.tier} · ${site.resolved ? 'экспедиция завершена' : site.available ? 'сигнал подтверждён' : 'ожидает предыдущую экспедицию'}</small><small>Цена: ${fmt(site.energyCost, 0)}⚡ + ${fmt(site.researchCost, 0)}🔬</small><small>Награда: ${site.reward.darkMatter} тёмной материи · ${site.reward.relic} реликтов · ${site.reward.essence} эссенции</small>${site.available && site.planetId === s.activePlanetId ? `<button data-act="anomaly-expedition" data-pid="${site.planetId}" ${((s.resources.energy ?? 0) < site.energyCost || (s.resources.research ?? 0) < site.researchCost) ? 'disabled' : ''}>Начать экспедицию</button>` : ''}</div>`).join('') : '<div class="sonar-state">Аномальные системы ещё не обнаружены. Ищите сигнатуры ✧.</div>'}</div>
      <h2>📜 Журнал экспедиции</h2>
      <div class="galaxy-history">${s.galaxy.nodes.filter((n) => n.discovered).sort((a,b) => (a.id === 'ferrum' ? -1 : a.id === 'krios' ? 0 : Number(a.id.replace('planet_','')) - Number(b.id.replace('planet_','')))).map((n) => { const m = SIGNAL_META[n.signalClass]; return `<div><b>${m[0]} ${n.name}</b><small>${n.biome} · ${n.geometryName} · рукав ${n.armId}</small></div>`; }).join('')}</div>
      <h2>🚚 Межпланетная логистика</h2>
      <div class="sonar-state">Трюм: ${fmt(logistics.cargoMass, 2)}/${fmt(logistics.cargoCapacity, 2)} т · Депо ${active?.name ?? '—'}: ${fmt(logistics.depotMass, 2)}/${fmt(logistics.depotCapacity, 2)} т</div>
      <label class="logistics-amount">Количество <input id="logistics-amount" type="number" min="0.001" step="0.1" value="1" /></label>
      <div class="logistics-rows">${logisticsRows || '<div class="sonar-state">Нет ресурсов для перевозки. Сначала накопите транспортируемые материалы.</div>'}</div>
      <small>★ Специализация планеты: соответствующий ресурс занимает на 25% меньше места в локальном депо. Груз увеличивает стоимость перелёта.</small>
      <h2>🏭 Склад · ур. ${wh.level}/${wh.maxLevel}</h2>
      <div>Тонн/клетка: ${wh.tonsPerCell} · бонус ×${wh.bonusMult.toFixed(2)}</div>
      ${wh.nextCost ? `<button data-act="warehouse">⬆ Склад: ${wh.nextCost.alloy}⛓ + ${fmt(wh.nextCost.energy, 0)}⚡</button>` : '<div>Максимум</div>'}
      <h2>🔬 Технологии</h2>
      <div class="tech-list">${techRows || '<div class="sonar-state">Исследований пока нет.</div>'}</div>
      <h2>🏭 Реактор · слоты ${s.reactor.slots}</h2>
      ${s.reactor.idle ? '<div class="sonar-state">Реактор в покое…</div>' : `<div class="tech-list">${queueRows}</div>`}
      <div class="tech-list">${recipeRows}</div>
      <h2>💾</h2>
      <div class="saverow">
        <button data-act="save">Сохранить</button>
        <button data-act="load">Загрузить</button>
        <button data-act="export">Экспорт ↓</button>
        <button data-act="import">Импорт ↑</button>
        <input id="save-import-file" type="file" accept=".json,application/json" hidden />
      </div>
      <div class="save-status" role="status" aria-live="polite">${persistenceNotice}</div>
      <div class="session">сканов ${s.session.scanned} · апгрейдов ${s.session.upgraded} · deep ${s.session.deepMined}</div>
    </div>
  </div>
  <div class="journal"><h3>Журнал транзакций</h3>${journal || '<div class="tx">пусто</div>'}</div>`;
}

/**
 * Этап 9.2: плавающий док выбранной клетки поверх 3D-сцены (паритет с v1:
 * клетку ткнули на планете — рядом появились её действия). Без выбора показывает
 * подсказку. Рендерится в отдельный контейнер внутри sceneHost, поэтому не
 * участвует в потоке HUD и не превращается в «карточки внизу».
 */
export function renderCellDock(game: Game, root: HTMLElement, selectedCellId: number | null): void {
  const s: GameSnapshot = game.snapshot();
  const active = s.planets.find((p) => p.id === s.activePlanetId) ?? s.planets[0];
  if (!active) { root.innerHTML = ''; return; }
  const cell = active.cells.find((c) => c.id === selectedCellId) ?? null;
  root.innerHTML = cell
    ? `<div class="cell-dock"><div class="cell-dock-head"><span>КЛЕТКА ${cell.id} · ${active.name}</span><button type="button" data-act="dock-close" aria-label="Снять выделение с клетки">×</button></div>${cellCard(game, active.id, cell, s.scan.charge)}</div>`
    : '<div class="scene-hint">Коснитесь клетки на поверхности планеты: скан и апгрейд работают прямо на планете, как в версии 1</div>';
}

/** Интерактивная сонарная мини-игра: три сигнала, точность зависит от остановки маркера. */
function runSonarMinigame(game: Game, onComplete: () => void): void {
  const cfg = game.balance.registry.sonar;
  const rounds = cfg.difficulty.baseRounds;
  let round = 0;
  const scores: number[] = [];
  let startedAt = performance.now();
  let raf = 0;
  const overlay = document.createElement('div');
  overlay.className = 'sonar-overlay';
  overlay.innerHTML = `<section class="sonar-dialog"><h2>📡 ГЛУБОКОЕ СКАНИРОВАНИЕ</h2><p>Остановите сигнал как можно ближе к центру. Три последовательных импульса определят качество сканирования.</p><div class="sonar-round" aria-live="polite">СИГНАЛ 1 / ${rounds}</div><div class="sonar-track"><div class="sonar-center"></div><div class="sonar-cursor"></div></div><div class="sonar-readout">— %</div><button type="button" class="sonar-stop">СТОП</button><div class="sonar-help">Можно нажать кнопку или клавишу Пробел.</div></section>`;
  document.body.appendChild(overlay);
  const cursor = overlay.querySelector<HTMLElement>('.sonar-cursor')!;
  const roundLabel = overlay.querySelector<HTMLElement>('.sonar-round')!;
  const readout = overlay.querySelector<HTMLElement>('.sonar-readout')!;
  const stop = overlay.querySelector<HTMLButtonElement>('.sonar-stop')!;
  let position = 0;
  const periodFor = (idx: number): number => Math.max(cfg.difficulty.minPeriod, cfg.difficulty.basePeriod - cfg.difficulty.periodStep * idx);
  const animate = (now: number): void => {
    const period = periodFor(round);
    const phase = ((now - startedAt) / (period * 1000)) % 1;
    position = phase < 0.5 ? -1 + phase * 4 : 3 - phase * 4;
    cursor.style.left = `${50 + position * 44}%`;
    raf = requestAnimationFrame(animate);
  };
  const cleanup = (): void => { cancelAnimationFrame(raf); window.removeEventListener('keydown', keyHandler); overlay.remove(); };
  const finish = (): void => {
    cleanup();
    const result = game.dispatch('unlockKrios', { scores });
    if (result.ok) {
      const v = result.value;
      persistenceNotice = v.bonusMult > 1 ? `Криос-9 открыт · точность ${v.accuracy}% · бонус ×${v.bonusMult.toFixed(2)} на 24 часа` : `Криос-9 открыт · точность ${v.accuracy}% · бонус не получен`;
    } else persistenceNotice = `Сонар не завершён: ${result.detail ?? result.reason}`;
    onComplete();
  };
  const stopRound = (): void => {
    const score = Math.max(0, Math.min(1, 1 - Math.abs(position) * 1.4));
    scores.push(score);
    readout.textContent = `${Math.round(score * 100)}%`;
    readout.style.color = score >= .9 ? '#5cf2b0' : score >= .7 ? '#ffda47' : score >= .5 ? '#ffb454' : '#ff5e5e';
    cancelAnimationFrame(raf);
    if (round + 1 < rounds) {
      round += 1;
      stop.textContent = 'СЛЕДУЮЩИЙ СИГНАЛ';
      stop.onclick = () => { startedAt = performance.now(); roundLabel.textContent = `СИГНАЛ ${round + 1} / ${rounds}`; readout.textContent = '— %'; stop.textContent = 'СТОП'; stop.onclick = stopRound; raf = requestAnimationFrame(animate); };
    } else {
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
      roundLabel.textContent = `СРЕДНЯЯ ТОЧНОСТЬ: ${Math.round(avg * 100)}%`;
      stop.textContent = 'ОТКРЫТЬ КРИОС-9';
      stop.onclick = finish;
    }
  };
  const keyHandler = (event: KeyboardEvent): void => { if (event.code === 'Space' && document.body.contains(overlay)) { event.preventDefault(); stop.click(); } };
  stop.onclick = stopRound;
  window.addEventListener('keydown', keyHandler);
  raf = requestAnimationFrame(animate);
}

/** Делегирование кликов → команды Game (единственная точка входа UI). */
export function bindCommands(game: Game, root: HTMLElement, onCommand?: () => void, onCloseDock?: () => void): () => void {
  const handler = (ev: Event): void => {
    const target = ev.target as HTMLElement | null;
    if (!target) return;
    const btn = target.closest<HTMLButtonElement>('button[data-act]');
    if (!btn) return;
    const act = btn.dataset['act'];
    const pid = btn.dataset['pid'] ?? game.activePlanetId();
    const cellId = Number(btn.dataset['cell'] ?? -1);
    switch (act) {
      case 'scan':
        game.dispatch('scanCell', { pid, cellId });
        break;
      case 'upgrade':
        game.dispatch('upgradeCell', { pid, cellId });
        break;
      case 'reactivate':
        game.dispatch('reactivateCell', { pid, cellId });
        break;
      case 'discharge':
        game.dispatch('dischargeCell', { pid, cellId });
        break;
      case 'anomaly':
        game.dispatch('upgradeAnomalyCell', { pid, cellId });
        break;
      case 'branch': {
        const br = btn.dataset['branch'];
        if (br === 'power' || br === 'resonance' || br === 'synth') game.dispatch('chooseAnomalyBranch', { pid, cellId, branch: br });
        break;
      }
      case 'warehouse':
        game.dispatch('upgradeWarehouse', {});
        break;
      case 'sonar':
        runSonarMinigame(game, () => { onCommand?.(); });
        return;
      case 'discover':
        game.dispatch('discoverPlanet', { seed: game.nextDiscoveryPreview()?.seed });
        break;
      case 'reroll':
        game.dispatch('rerollDiscovery', {});
        break;
      case 'anomaly-expedition':
        game.dispatch('resolveAnomaly', { planetId: btn.dataset['pid'] ?? '' });
        break;
      case 'load-cargo': {
        const amount = Number(root.querySelector<HTMLInputElement>('#logistics-amount')?.value ?? 0);
        const result = game.dispatch('loadCargo', { resource: btn.dataset['resource'] ?? '', amount });
        persistenceNotice = result.ok ? `Погружено ${result.value.amount} ${result.value.resource} · трюм ${result.value.cargoMass.toFixed(2)} т` : `Погрузка отклонена: ${result.detail ?? result.reason}`;
        break;
      }
      case 'unload-cargo': {
        const amount = Number(root.querySelector<HTMLInputElement>('#logistics-amount')?.value ?? 0);
        const result = game.dispatch('unloadCargo', { resource: btn.dataset['resource'] ?? '', amount });
        persistenceNotice = result.ok ? `Выгружено ${result.value.amount} ${result.value.resource} в депо ${result.value.planetId}` : `Выгрузка отклонена: ${result.detail ?? result.reason}`;
        break;
      }
      case 'withdraw-depot': {
        const amount = Number(root.querySelector<HTMLInputElement>('#logistics-amount')?.value ?? 0);
        const result = game.dispatch('withdrawDepot', { resource: btn.dataset['resource'] ?? '', amount });
        persistenceNotice = result.ok ? `Из депо возвращено ${result.value.amount} ${result.value.resource} в общий запас` : `Операция отклонена: ${result.detail ?? result.reason}`;
        break;
      }
      case 'travel':
        game.dispatch('travelToPlanet', { destinationId: pid });
        break;
      case 'switch':
        game.dispatch('setActivePlanet', { pid });
        break;
      case 'buy-tech':
        // Этап 9.3 (Этап 7 ТЗ): покупка уровня технологии.
        game.dispatch('buyTech', { id: btn.dataset['id'] ?? '' });
        break;
      case 'craft-enqueue':
        // Этап 9.3 (Этап 8 ТЗ): постановка run-ов в очередь реактора.
        game.dispatch('craftEnqueue', { recipeId: btn.dataset['recipe'] ?? '', runs: Number(btn.dataset['runs'] ?? 1) });
        break;
      case 'craft-cancel':
        game.dispatch('craftCancel', { jobId: Number(btn.dataset['job'] ?? 0) });
        break;
      case 'dock-close':
        onCloseDock?.();
        return;
      case 'save': {
        const res = game.dispatch('save', {});
        persistenceNotice = res.ok ? `Сохранено · ${res.value.sizeBytes.toLocaleString('ru-RU')} байт` : 'Ошибка сохранения';
        break;
      }
      case 'load': {
        const res = game.dispatch('load', {});
        persistenceNotice = res.ok ? 'Сохранение загружено' : `Не удалось загрузить: ${res.reason}`;
        break;
      }
      case 'export': {
        const res = game.dispatch('exportSave', {});
        if (res.ok) {
          const blob = new Blob([res.value.payload], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a'); a.href = url; a.download = 'voronia2-save.json'; a.click();
          URL.revokeObjectURL(url);
          persistenceNotice = 'Файл сохранения экспортирован';
        } else persistenceNotice = 'Ошибка экспорта';
        break;
      }
      case 'import': {
        root.querySelector<HTMLInputElement>('#save-import-file')?.click();
        return;
      }
      default:
        break;
    }
    onCommand?.();
  };
  const importInput = (ev: Event): void => {
    const input = ev.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    void file.text().then((payload) => {
      const result = game.dispatch('importSave', { payload });
      persistenceNotice = result.ok ? `Импортировано · ${result.value.sizeBytes.toLocaleString('ru-RU')} байт` : 'Импорт отклонён: файл повреждён или имеет неподдерживаемую структуру';
      input.value = '';
      onCommand?.();
    }).catch(() => { persistenceNotice = 'Не удалось прочитать файл'; input.value = ''; onCommand?.(); });
  };
  root.addEventListener('click', handler);
  root.addEventListener('change', importInput);
  return () => { root.removeEventListener('click', handler); root.removeEventListener('change', importInput); };
}
