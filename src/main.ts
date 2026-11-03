import { buildStarSystemExploration } from './galaxy/systemExploration';
import { buildStarSystemTopology } from './galaxy/systemTopology';
/**
 * main.ts — точка входа браузера: сборка Game (RafDriver + LocalStorage), старт, авто-сейв,
 * UI-цикл (рендер из снапшота ~4 раза/с и после команд).
 */
import { Game } from './core/game';
import { RafDriver } from './core/gameClock';
import { LocalStorageAdapter, MemoryStorage } from './persistence/storage';
import { Logger } from './core/logger';
import { renderSnapshot, bindCommands } from './ui/app';
import { bindStyles } from './ui/styles';
import { RENDERER_STATUS, buildPlanetMeshData, createPlanetViewer, createGalaxyViewer, buildGalaxyRenderData, buildGalaxySystemDetail, FpsMeter, type PlanetViewer, type GalaxyViewer } from './renderer';
import { GALAXY_STATUS } from './galaxy/status';
import { CRAFTING_STATUS } from './crafting/status';
import { LOGISTICS_STATUS } from './logistics/status';
import { COMBAT_STATUS } from './combat/status';
import { AUDIO_STATUS } from './audio/status';

const root = document.getElementById('app');
if (!root) throw new Error('#app не найден');

const logger = new Logger('info');
logger.info('boot', 'Voronia 2.0 — Stage 8.0.1 PLANET SURFACE INTERACTION', {
  balance: 'v0.0.41',
  domainsNotImplemented: [RENDERER_STATUS, GALAXY_STATUS, CRAFTING_STATUS, LOGISTICS_STATUS, COMBAT_STATUS, AUDIO_STATUS].map((d) => `${d.domain}(Этап ${d.stage})`),
});

const game = new Game({
  clockDriver: new RafDriver(),
  storage: LocalStorageAdapter.create() ?? new MemoryStorage(),
  logger,
});

// попытка загрузить сейв (v2 или legacy v39 — миграция); иначе — свежая игра уже создана в конструкторе
const loaded = game.saves.load();
if (loaded.ok) logger.info('boot', loaded.migrated ? 'загружен и мигрирован legacy-сейв v39' : 'сейв загружен');

bindStyles();

// Постоянная оболочка: HUD обновляется отдельно и никогда не удаляет WebGL-canvas.
const sceneHost = document.createElement('div');
sceneHost.className = 'scene3d';
sceneHost.id = 'game-scene';
const canvas = document.createElement('canvas');
canvas.setAttribute('aria-label', '3D-поверхность планеты; перетаскивайте для вращения');
const fps = document.createElement('div');
fps.className = 'fps';
const viewControls = document.createElement('div');
viewControls.className = 'view-controls';
viewControls.innerHTML = '<button type="button" aria-label="Приблизить планету" data-view="in">＋</button><button type="button" aria-label="Отдалить планету" data-view="out">－</button><button type="button" aria-label="Сбросить вид планеты" data-view="reset">⟳</button>';
sceneHost.append(canvas, fps, viewControls);
const galaxyHost = document.createElement('div');
galaxyHost.className = 'galaxy3d-scene';
galaxyHost.id = 'galaxy-scene';
galaxyHost.hidden = true;
const galaxyCanvas = document.createElement('canvas');
galaxyCanvas.setAttribute('aria-label', 'Трёхмерная галактика; перетаскивайте для вращения, колесо для масштаба');
const galaxyCaption = document.createElement('div');
galaxyCaption.className = 'galaxy-scene-caption';
galaxyCaption.textContent = 'GALAXY · PlanetaryGraph';
const galaxyControls = document.createElement('div');
galaxyControls.className = 'view-controls';
galaxyControls.innerHTML = '<button type="button" aria-label="Приблизить галактику" data-galaxy-view="in">＋</button><button type="button" aria-label="Отдалить галактику" data-galaxy-view="out">－</button><button type="button" aria-label="Сбросить вид галактики" data-galaxy-view="reset">⟳</button>';
const galaxyPanel = document.createElement('section');
galaxyPanel.className = 'galaxy-node-panel';
galaxyPanel.hidden = true;
galaxyHost.append(galaxyCanvas, galaxyCaption, galaxyControls, galaxyPanel);
const sceneSwitch = document.createElement('div');
sceneSwitch.className = 'scene-switch';
sceneSwitch.innerHTML = '<button type="button" data-scene="planet" class="active">Поверхность</button><button type="button" data-scene="galaxy">Галактика</button><button type="button" data-scene="system">Звёздная система</button>'; 
const hudHost = document.createElement('div');
hudHost.id = 'game-hud';
root.replaceChildren(sceneSwitch, sceneHost, galaxyHost, hudHost);
let selectedCellId: number | null = null;
const paintHud = (): void => renderSnapshot(game, hudHost, selectedCellId);

paintHud();
let planetVisualDirty = false;
let galaxyVisualDirty = true;
bindCommands(game, hudHost, () => {
  planetVisualDirty = true;
  galaxyVisualDirty = true;
  paintHud();
});
const hudTimer = window.setInterval(paintHud, 250);
game.start();

// ——— Stage 7.4: каталог подтверждённых миров и переход система → поверхность. ———
let viewer: PlanetViewer | null = null;
let galaxyViewer: GalaxyViewer | null = null;
let activeScene: 'planet' | 'galaxy' | 'system' = 'planet';
const fpsMeter = new FpsMeter();
try {
  const meshOf = (): ReturnType<typeof buildPlanetMeshData> | null => {
    const pid = game.activePlanetId();
    const planet = game.worldPlanet(pid);
    const rt = game.runtime(pid);
    return planet ? buildPlanetMeshData(planet, {
      explored: rt?.explored,
      revealed: rt ? new Set([...rt.explored, ...rt.revealed]) : undefined,
      cellLevels: new Map([...(rt?.cellStates ?? new Map())].map(([id, state]) => [id, state.level])),
    }) : null;
  };
  const galaxyData = (): ReturnType<typeof buildGalaxyRenderData> => {
    const snap = game.snapshot();
    return buildGalaxyRenderData({ nodes: snap.galaxy.nodes, edges: snap.galaxy.edges, unlockedIds: snap.unlockedPlanets, activeId: snap.activePlanetId });
  };
  let selectedGalaxyNodeId: string | null = null;
  const escapeHtml = (value: string): string => value.replace(/[&<>\"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '\"': '&quot;', "'": '&#39;' })[ch] ?? ch);
  const paintGalaxyPanel = (): void => {
    const snap = game.snapshot();
    const node = snap.galaxy.nodes.find((item) => item.id === selectedGalaxyNodeId);
    if (!node || !node.discovered) { galaxyPanel.hidden = true; galaxyPanel.innerHTML = ''; return; }
    const unlocked = snap.unlockedPlanets.includes(node.id);
    const route = snap.galaxy.routes.find((item) => item.destinationId === node.id);
    const anomaly = snap.galaxy.anomalies.find((item) => item.planetId === node.id);
    const active = node.id === snap.activePlanetId;
    const renderNode = galaxyData().nodes.find((item) => item.id === node.id);
    const systemDetail = buildGalaxySystemDetail(renderNode);
    const system = buildStarSystemExploration({ ...node, unlocked, active });
    const routeLabel = route ? `${route.hops} прыжк. · ${route.totalDistance.toFixed(1)} ед. · ${Math.ceil(route.totalEnergy).toLocaleString('ru-RU')} ⚡` : 'Нет доступного маршрута';
    const world = system?.worlds[0];
    const worldAction = active
      ? `<button type="button" class="galaxy-travel-button" data-enter-world="${escapeHtml(node.id)}">ОТКРЫТЬ ПОВЕРХНОСТЬ ПЛАНЕТЫ</button>`
      : unlocked && route
        ? `<button type="button" class="galaxy-travel-button" data-galaxy-travel="${escapeHtml(node.id)}" ${(snap.resources.energy ?? 0) < route.firstLeg.energyCost ? 'disabled' : ''}>ПЕРЕЛЁТ К ПЛАНЕТЕ · ${Math.ceil(route.firstLeg.energyCost).toLocaleString('ru-RU')} ⚡</button>`
        : '<div class="galaxy-panel-status">Мир обнаружен, но ещё не открыт. Завершите сонарное открытие.</div>';
    galaxyPanel.innerHTML = `<button class="galaxy-panel-close" type="button" aria-label="Закрыть карточку">×</button><div class="galaxy-panel-kicker">${active ? 'АКТИВНАЯ СИСТЕМА' : unlocked ? 'ОТКРЫТАЯ СИСТЕМА' : 'ОБНАРУЖЕННЫЙ СИГНАЛ'}</div><div class="galaxy-nav-actions"><button type="button" data-system-view>ОТКРЫТЬ СИСТЕМУ</button><button type="button" data-galaxy-return>К ГАЛАКТИКЕ</button></div><h3>${escapeHtml(node.name)}</h3><div class="galaxy-panel-meta">${escapeHtml(node.biome)} · ${escapeHtml(node.geometryName)}</div><div class="galaxy-system-summary"><span class="galaxy-system-star" style="--star-color:${systemDetail?.starColor ?? '#d8e8f5'}"></span><div><small>ЦЕНТРАЛЬНАЯ ЗВЕЗДА · ${escapeHtml(systemDetail?.starClass.toUpperCase() ?? 'UNKNOWN')}</small><b>${escapeHtml(systemDetail?.title ?? 'UNKNOWN')}</b><em>Каталог: ${escapeHtml(system?.catalog.star.class.toUpperCase() ?? 'UNKNOWN')} · ${system?.catalog.star.temperatureK ?? 0} K</em></div></div><div class="galaxy-panel-grid"><span>Рукав <b>${escapeHtml(node.armId)}</b></span><span>Сектор <b>${escapeHtml(node.sectorLabel)}</b></span><span>Координаты <b>${node.x.toFixed(1)}, ${node.y.toFixed(1)}, ${node.z.toFixed(1)}</b></span><span>Состояние <b>${active ? 'Здесь' : unlocked ? 'Доступна' : 'Не открыта'}</b></span></div><div class="galaxy-world-list"><small>ПОДТВЕРЖДЁННЫЕ ПЛАНЕТЫ · ${system?.confirmedWorldCount ?? 0}</small>${world ? `<div class="galaxy-world-row"><span class="galaxy-world-orbit">◎</span><span><b>${escapeHtml(world.name)}</b><em>${escapeHtml(world.biome)} · ${escapeHtml(world.geometry)}</em></span><strong>${world.active ? 'АКТИВНА' : world.unlocked ? 'ОТКРЫТА' : 'ЗАКРЫТА'}</strong></div>` : ''}<div class="galaxy-orbital-signatures"><small>НЕРАЗВЕДАННЫЕ ОРБИТЫ · ${system?.candidateCount ?? 0}</small>${(system?.candidates ?? []).map((body) => { const orbital = game.orbitalExplorationState(node.id); const activatedId = orbital.activatedBodies[body.id]; const scanned = orbital.scannedBodyIds.includes(body.id); return `<div class="galaxy-world-row galaxy-world-candidate"><span class="galaxy-world-orbit">◌</span><span><b>${scanned ? (system?.catalog.bodies.find((item) => item.id === body.id)?.bodyClass ?? 'Орбитальное тело') : body.label}</b><em>Орбита ${body.orbitIndex} · ${body.orbitRadius.toFixed(2)} а.е.</em></span>${!unlocked ? '<strong>СИСТЕМА ЗАКРЫТА</strong>' : activatedId ? `<strong>${escapeHtml(activatedId)}</strong><button type="button" class="galaxy-orbit-action" data-system-travel="${escapeHtml(activatedId)}">ПЕРЕЙТИ</button>` : scanned ? `<button type="button" class="galaxy-orbit-action" data-orbit-activate="${escapeHtml(body.id)}">АКТИВИРОВАТЬ · 2 000 ⚡ / 500 🔬</button>` : `<button type="button" class="galaxy-orbit-action" data-orbit-scan="${escapeHtml(body.id)}">ИССЛЕДОВАТЬ · 500 ⚡ / 100 🔬</button>`}</div>`; }).join('')}</div></div>${anomaly ? `<div class="galaxy-panel-anomaly">✧ ${escapeHtml(anomaly.title)} · ${anomaly.resolved ? 'исследована' : anomaly.available ? 'экспедиция доступна' : 'условия не выполнены'}</div>` : ''}<div class="galaxy-panel-route"><small>МАРШРУТ ОТ ТЕКУЩЕЙ ПЛАНЕТЫ</small><b>${routeLabel}</b>${route ? `<span>${route.path.map((id) => escapeHtml(snap.galaxy.nodes.find((item) => item.id === id)?.name ?? id)).join(' → ')}</span>` : ''}</div>${worldAction}`;
    galaxyPanel.hidden = false;
  };
  const showSystemView = (nodeId: string): void => {
    const snap = game.snapshot();
    const node = snap.galaxy.nodes.find((item) => item.id === nodeId);
    if (!node?.discovered || !galaxyViewer) return;
    selectedGalaxyNodeId = nodeId;
    const unlocked = snap.unlockedPlanets.includes(nodeId);
    const system = buildStarSystemExploration({ ...node, unlocked, active: snap.activePlanetId === nodeId });
    const orbital = game.orbitalExplorationState(nodeId);
    const topology = system ? buildStarSystemTopology(system.catalog, orbital.scannedBodyIds, orbital.activatedBodies) : null;
    galaxyViewer.setSelectedNode(nodeId);
    galaxyViewer.setSystemFocus(nodeId);
    galaxyViewer.setOrbitalTopology(topology, (planetId) => {
      const result = game.dispatch('travelWithinSystem', { hostPlanetId: nodeId, destinationId: planetId });
      if (!result.ok) { paintHud(); paintGalaxyPanel(); return; }
      planetVisualDirty = true; galaxyVisualDirty = true; paintHud();
      activeScene = 'planet'; sceneHost.hidden = false; galaxyHost.hidden = true;
      sceneSwitch.querySelectorAll('button').forEach((item) => item.classList.toggle('active', (item as HTMLButtonElement).dataset['scene'] === 'planet'));
      viewer?.resize(); startRenderLoop();
    });
    activeScene = 'system'; sceneHost.hidden = true; galaxyHost.hidden = false;
    galaxyCaption.textContent = `STAR SYSTEM · ${node.name.toUpperCase()}`;
    sceneSwitch.querySelectorAll('button').forEach((item) => item.classList.toggle('active', (item as HTMLButtonElement).dataset['scene'] === 'system'));
    galaxyViewer.resize(); paintGalaxyPanel(); startRenderLoop();
  };
  const showGalaxyView = (): void => {
    activeScene = 'galaxy'; sceneHost.hidden = true; galaxyHost.hidden = false;
    galaxyViewer?.setOrbitalTopology(null, null); galaxyViewer?.setSystemFocus(null);
    galaxyCaption.textContent = 'GALAXY · PLANETARY GRAPH';
    sceneSwitch.querySelectorAll('button').forEach((item) => item.classList.toggle('active', (item as HTMLButtonElement).dataset['scene'] === 'galaxy'));
    galaxyViewer?.resize(); startRenderLoop();
  };
  const first = meshOf();
  if (first) {
    viewer = createPlanetViewer(canvas, first);
    galaxyViewer = createGalaxyViewer(galaxyCanvas, galaxyData());
    galaxyViewer.setNodeSelectHandler((nodeId) => {
      selectedGalaxyNodeId = nodeId;
      const current = game.snapshot();
      const route = current.galaxy.routes.find((item) => item.destinationId === nodeId);
      galaxyViewer?.setSelectedNode(nodeId);
      galaxyViewer?.setSystemFocus(nodeId);
      const graphNode = current.galaxy.nodes.find((item) => item.id === nodeId);
      if (graphNode) showSystemView(nodeId);
      galaxyViewer?.setRoute(route?.path ?? []);
      paintGalaxyPanel();
    });
    galaxyPanel.addEventListener('click', (event) => {
      const target = event.target as HTMLElement;
      if (target.closest('.galaxy-panel-close')) { galaxyPanel.hidden = true; return; }
      if (target.closest('[data-system-view]')) { if (selectedGalaxyNodeId) showSystemView(selectedGalaxyNodeId); return; }
      if (target.closest('[data-galaxy-return]')) { showGalaxyView(); return; }
      const enter = target.closest<HTMLButtonElement>('[data-enter-world]');
      if (enter) {
        const pid = enter.dataset['enterWorld'] ?? '';
        if (pid !== game.activePlanetId()) return;
        activeScene = 'planet';
        sceneHost.hidden = false;
        galaxyHost.hidden = true;
        sceneSwitch.querySelectorAll('button').forEach((item) => item.classList.toggle('active', (item as HTMLButtonElement).dataset['scene'] === 'planet'));
        viewer?.resize();
        startRenderLoop();
        return;
      }
      const systemTravel = target.closest<HTMLButtonElement>('[data-system-travel]');
      if (systemTravel) {
        const hostId = selectedGalaxyNodeId ?? '';
        const destinationId = systemTravel.dataset['systemTravel'] ?? '';
        const result = game.dispatch('travelWithinSystem', { hostPlanetId: hostId, destinationId });
        if (result.ok) {
          planetVisualDirty = true; galaxyVisualDirty = true; paintHud(); paintGalaxyPanel();
          activeScene = 'planet'; sceneHost.hidden = false; galaxyHost.hidden = true;
          sceneSwitch.querySelectorAll('button').forEach((item) => item.classList.toggle('active', (item as HTMLButtonElement).dataset['scene'] === 'planet'));
          viewer?.resize(); startRenderLoop();
        } else { paintHud(); paintGalaxyPanel(); }
        return;
      }
      const scanOrbit = target.closest<HTMLButtonElement>('[data-orbit-scan]');
      if (scanOrbit) {
        const bodyId = scanOrbit.dataset['orbitScan'] ?? '';
        const result = game.dispatch('scanOrbitalBody', { hostPlanetId: selectedGalaxyNodeId ?? '', bodyId });
        if (!result.ok) { paintHud(); paintGalaxyPanel(); return; }
        paintHud(); paintGalaxyPanel();
        return;
      }
      const activateOrbit = target.closest<HTMLButtonElement>('[data-orbit-activate]');
      if (activateOrbit) {
        const bodyId = activateOrbit.dataset['orbitActivate'] ?? '';
        const result = game.dispatch('activateOrbitalBody', { hostPlanetId: selectedGalaxyNodeId ?? '', bodyId });
        if (!result.ok) { paintHud(); paintGalaxyPanel(); return; }
        galaxyVisualDirty = true;
        paintHud(); paintGalaxyPanel();
        return;
      }
      const travel = target.closest<HTMLButtonElement>('[data-galaxy-travel]');
      if (!travel || travel.disabled) return;
      const destinationId = travel.dataset['galaxyTravel'] ?? '';
      const before = game.snapshot();
      const route = before.galaxy.routes.find((item) => item.destinationId === destinationId);
      if (!route) return;
      const result = game.dispatch('travelToPlanet', { destinationId });
      if (result.ok) {
        galaxyViewer?.animateRoute(route.path);
        galaxyViewer?.setSelectedNode(destinationId);
        galaxyViewer?.setSystemFocus(destinationId);
        selectedGalaxyNodeId = destinationId;
        planetVisualDirty = true;
        galaxyVisualDirty = true;
        paintHud();
        paintGalaxyPanel();
        activeScene = 'planet';
        sceneHost.hidden = false;
        galaxyHost.hidden = true;
        sceneSwitch.querySelectorAll('button').forEach((item) => item.classList.toggle('active', (item as HTMLButtonElement).dataset['scene'] === 'planet'));
        viewer?.resize();
      } else {
        paintHud();
        paintGalaxyPanel();
      }
    });
    sceneSwitch.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-scene]');
      if (!button) return;
      const requested = button.dataset['scene'];
      if (requested === 'system') { if (selectedGalaxyNodeId) showSystemView(selectedGalaxyNodeId); else showGalaxyView(); return; }
      if (requested === 'galaxy') { showGalaxyView(); return; }
      activeScene = 'planet'; sceneHost.hidden = false; galaxyHost.hidden = true;
      sceneSwitch.querySelectorAll('button').forEach((item) => item.classList.toggle('active', item === button));
      viewer?.resize(); startRenderLoop();
    });
    galaxyControls.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-galaxy-view]');
      if (!button || !galaxyViewer) return;
      if (button.dataset['galaxyView'] === 'in') galaxyViewer.zoomBy(-1.2);
      else if (button.dataset['galaxyView'] === 'out') galaxyViewer.zoomBy(1.2);
      else galaxyViewer.resetView();
    });
    viewControls.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-view]');
      if (!button || !viewer) return;
      if (button.dataset['view'] === 'in') viewer.zoomBy(-0.25);
      else if (button.dataset['view'] === 'out') viewer.zoomBy(0.25);
      else viewer.resetView();
    });
    viewer.setCellSelectHandler((cellId) => {
      selectedCellId = cellId;
      paintHud();
    });
  }
  let shownPid = game.activePlanetId();
  let lastFpsPaint = 0;
  let rafId = 0;
  let stopped = false;
  const loop = (t: number): void => {
    if (stopped || document.hidden) { rafId = 0; return; }
    fpsMeter.sample(t);
    // Поверхность и галактическая геометрия перестраиваются только после изменения игрового snapshot.
    const pid = game.activePlanetId();
    if (viewer && activeScene === 'planet' && (planetVisualDirty || pid !== shownPid)) {
      const m = meshOf();
      if (m) viewer.setPlanet(m, '#8fd7ff');
      if (pid !== shownPid) selectedCellId = null;
      viewer.selectCell(selectedCellId);
      shownPid = pid;
      planetVisualDirty = false;
    }
    if (activeScene === 'planet') viewer?.render(t);
    else {
      if (galaxyViewer && galaxyVisualDirty) { galaxyViewer.setData(galaxyData()); if (selectedGalaxyNodeId) { const snap = game.snapshot(); const route = snap.galaxy.routes.find((item) => item.destinationId === selectedGalaxyNodeId); galaxyViewer.setSelectedNode(selectedGalaxyNodeId); galaxyViewer.setRoute(route?.path ?? []); if (activeScene === 'system') showSystemView(selectedGalaxyNodeId); else paintGalaxyPanel(); } galaxyVisualDirty = false; }
      galaxyViewer?.render(t);
    }
    if (t - lastFpsPaint > 500) {
      lastFpsPaint = t;
      const s = fpsMeter.stats();
      fps.textContent = s.frames ? `${s.fps.toFixed(0)} FPS · p95 ${s.p95FrameMs.toFixed(1)}мс` : '';
    }
    rafId = requestAnimationFrame(loop);
  };
  const startRenderLoop = (): void => {
    if (viewer && !stopped && !document.hidden && rafId === 0) rafId = requestAnimationFrame(loop);
  };
  const onVisibilityChange = (): void => {
    if (document.hidden) {
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
      fpsMeter.reset();
    } else startRenderLoop();
  };
  if (viewer) startRenderLoop();
  window.addEventListener('resize', () => { viewer?.resize(); galaxyViewer?.resize(); });
  document.addEventListener('visibilitychange', onVisibilityChange);
  window.addEventListener('pagehide', () => {
    stopped = true;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
    document.removeEventListener('visibilitychange', onVisibilityChange);
    window.clearInterval(hudTimer);
    game.stop();
    viewer?.dispose();
    galaxyViewer?.dispose();
    viewer = null;
    galaxyViewer = null;
  }, { once: true });
} catch (err) {
  viewer?.dispose();
  galaxyViewer?.dispose();
  viewer = null;
  galaxyViewer = null;
  logger.warn('boot', '3D-рендер недоступен — остаётся интерфейс игрового состояния', { err: String(err) });
  // Даже при недоступном WebGL игровые таймеры должны корректно останавливаться.
  window.addEventListener('pagehide', () => {
    window.clearInterval(hudTimer);
    game.stop();
  }, { once: true });
}

// отладочный доступ (консоль): window.__VORONIA2 = game
declare global {
  interface Window {
    __VORONIA2?: Game;
  }
}
window.__VORONIA2 = game;
