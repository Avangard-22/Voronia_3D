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
import { RENDERER_STATUS, buildPlanetMeshData, createPlanetViewer, createGalaxyViewer, buildGalaxyRenderData, FpsMeter, type PlanetViewer, type GalaxyViewer } from './renderer';
import { GALAXY_STATUS } from './galaxy/status';
import { CRAFTING_STATUS } from './crafting/status';
import { LOGISTICS_STATUS } from './logistics/status';
import { COMBAT_STATUS } from './combat/status';
import { AUDIO_STATUS } from './audio/status';

const root = document.getElementById('app');
if (!root) throw new Error('#app не найден');

const logger = new Logger('info');
logger.info('boot', 'Voronia 2.0 — Stage 7.0 GALAXY 3D RENDERER', {
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
galaxyHost.append(galaxyCanvas, galaxyCaption, galaxyControls);
const sceneSwitch = document.createElement('div');
sceneSwitch.className = 'scene-switch';
sceneSwitch.innerHTML = '<button type="button" data-scene="planet" class="active">Планета</button><button type="button" data-scene="galaxy">Галактика 3D</button>';
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

// ——— Stage 7.0: переключаемые 3D-сцены планеты и галактики. ———
let viewer: PlanetViewer | null = null;
let galaxyViewer: GalaxyViewer | null = null;
let activeScene: 'planet' | 'galaxy' = 'planet';
const fpsMeter = new FpsMeter();
try {
  const meshOf = (): ReturnType<typeof buildPlanetMeshData> | null => {
    const pid = game.activePlanetId();
    const planet = game.worldPlanet(pid);
    const rt = game.runtime(pid);
    return planet ? buildPlanetMeshData(planet, {
      explored: rt?.explored,
      cellLevels: new Map([...(rt?.cellStates ?? new Map())].map(([id, state]) => [id, state.level])),
    }) : null;
  };
  const galaxyData = (): ReturnType<typeof buildGalaxyRenderData> => {
    const snap = game.snapshot();
    return buildGalaxyRenderData({ nodes: snap.galaxy.nodes, edges: snap.galaxy.edges, unlockedIds: snap.unlockedPlanets, activeId: snap.activePlanetId });
  };
  const first = meshOf();
  if (first) {
    viewer = createPlanetViewer(canvas, first);
    galaxyViewer = createGalaxyViewer(galaxyCanvas, galaxyData());
    galaxyViewer.setNodeSelectHandler((nodeId) => {
      const current = game.snapshot();
      if (current.unlockedPlanets.includes(nodeId) && nodeId !== current.activePlanetId) {
        game.dispatch('travelToPlanet', { destinationId: nodeId });
        planetVisualDirty = true;
        galaxyVisualDirty = true;
        paintHud();
      }
    });
    sceneSwitch.addEventListener('click', (event) => {
      const button = (event.target as HTMLElement).closest<HTMLButtonElement>('button[data-scene]');
      if (!button) return;
      activeScene = button.dataset['scene'] === 'galaxy' ? 'galaxy' : 'planet';
      sceneHost.hidden = activeScene !== 'planet';
      galaxyHost.hidden = activeScene !== 'galaxy';
      sceneSwitch.querySelectorAll('button').forEach((item) => item.classList.toggle('active', item === button));
      if (activeScene === 'galaxy') galaxyViewer?.resize(); else viewer?.resize();
      startRenderLoop();
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
      if (galaxyViewer && galaxyVisualDirty) { galaxyViewer.setData(galaxyData()); galaxyVisualDirty = false; }
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
