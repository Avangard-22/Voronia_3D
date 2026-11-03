/**
 * core/game.ts — Game-фасад: ЕДИНСТВЕННЫЙ сборщик DI (ADR-012) и диспетчер команд.
 * Домены не знают друг о друге — связи только через порты/контракты и этот фасад.
 * Срез Этапа 2: ferrum + скан/апгрейд/реактивация/склад/тик/сейв (GS-01..GS-05, TV-1..TV-8).
 */
import type { BalanceConfig } from '../config/types';
import { loadBalance } from '../config/loader';
import type { ActionResult } from '../contracts/commands';
import { fail, ok } from '../contracts/commands';
import type { CommandMap, CommandName, CommandResultMap, DiscoverPlanetResult } from '../contracts/commands';
import type { ClockDriver, StoragePort } from '../contracts/ports';
import type { GameSnapshot, PlanetView, CellView, SessionStats } from '../contracts/snapshot';
import { freshSession } from '../contracts/snapshot';
import type { LedgerResourceKey } from '../contracts/resources';
import { LEDGER_RESOURCES } from '../contracts/resources';
import { EventBus } from './eventBus';
import { GameClock, ManualDriver } from './gameClock';
import { Logger } from './logger';
import type { LogSink } from '../contracts/ports';
import { Rng } from './rng';
import { ResourceLedger } from '../economy/ledger';
import { IncomeService, type IncomeContext } from '../economy/income';
import { ProductionService } from '../economy/production';
import { CellUpgradeService, AnomalyUpgradeService } from '../economy/upgrades';
import { ChargeService } from '../economy/charge';
import { SynthService } from '../economy/synth';
import { WarehouseService } from '../economy/warehouse';
import { EconomyTicker } from '../economy/ticker';
import type { ArmModifiers } from '../contracts/economy';
import { buildCatalog, defaultGeneratorCtx, toPlanetData, type PlanetCatalog } from '../planets/catalog';
import type { GeneratedPlanet, PlanetRuntime } from '../contracts/planets';
import type { PlanetaryGraph } from '../contracts/galaxy';
import { applyStartState, createPlanetRuntime } from '../planets/runtime';
import { ExplorationService } from '../planets/exploration';
import { AnomalyService, fmFor } from '../planets/anomalies';
import { countDiscoverablePlanets, createStarterWorld, discoverPlanet as runDiscovery, type DiscoveryWorld } from './discovery';
import { anomalyGateStatus, classifySignal, galaxyMilestone, galaxyProgressionStatus, galaxySector, layoutGalaxy } from '../galaxy/exploration';
import { buildAnomalySites } from '../galaxy/anomalies';
import { buildStarSystemCatalog } from '../galaxy/starSystems';
import { buildRouteOptions, findGalaxyRoute, ROUTE_POLICY } from '../galaxy/routes';
import { validateGalaxyIntegrity, type GalaxyIntegrityReport } from '../galaxy/validation';
import { LogisticsService, type LogisticsPlanetContext } from '../logistics/service';
import { ScanPricing } from '../progression/scanPricing';
import { TechState } from '../progression/tech';
import { MemoryStorage, SaveManager, type SaveSource } from '../persistence';
import { freshSaveV2, validateSaveV2, type DiscoverySpec, type SaveGameV2, type SerializedCellState } from '../persistence/schema';

export interface GameOptions {
  readonly balance?: BalanceConfig;
  readonly catalog?: PlanetCatalog;
  readonly storage?: StoragePort;
  readonly clockDriver?: ClockDriver;
  readonly rngSeed?: number;
  readonly logger?: Logger;
  readonly logSinks?: readonly LogSink[];
  readonly autosave?: boolean;
}

export const DEFAULT_START_SEED_XOR = 305419896; // 0x12345678 — parity 1.x gameStartSeed = (Date.now()^305419896)>>>0

export class Game implements SaveSource {
  readonly balance: BalanceConfig;
  readonly catalog: PlanetCatalog;
  readonly bus: EventBus;
  readonly clock: GameClock;
  readonly logger: Logger;
  rng: Rng;
  readonly ledger: ResourceLedger;
  readonly tech: TechState;
  readonly pricing: ScanPricing;
  readonly income: IncomeService;
  readonly production: ProductionService;
  readonly upgrades: CellUpgradeService;
  readonly anomalyUpgrades: AnomalyUpgradeService;
  readonly charge: ChargeService;
  readonly synthService: SynthService;
  readonly anomalies: AnomalyService;
  readonly warehouse: WarehouseService;
  readonly logistics: LogisticsService;
  readonly exploration: ExplorationService;
  readonly ticker: EconomyTicker;
  readonly saves: SaveManager;

  private runtimes = new Map<string, PlanetRuntime>();
  private activePlanetIdValue = 'ferrum';
  private unlocked: string[] = ['ferrum'];
  private gameStartSeedValue = 0;
  private sessionValue: SessionStats = freshSession(0);
  private sessionStartReal = Date.now();
  private sonarChargesValue = 0;
  private sonarRerollsValue = 0;
  private resolvedAnomalyIds = new Set<string>();
  private sonarBonusValue: { planetId: string; mult: number; until: number; accuracy: number } | null = null;
  /** Этап 5: мир (1.x $ + ge.PlanetaryGraph) — стартовые ferrum/krios + открытые миры. */
  private world: DiscoveryWorld;
  /** Спеки открытых миров (детерминированный реплей при загрузке — ADR-017). */
  private discoverySpecs: DiscoverySpec[] = [];
  private orbitalExploration = new Map<string, { scannedBodyIds: Set<string>; activatedBodies: Map<string, string> }>();
  private nextPreviewCache: { key: string; value: NonNullable<GameSnapshot['sonar']['nextPreview']> } | null = null;

  constructor(opts: GameOptions = {}) {
    this.balance = opts.balance ?? loadBalance();
    this.catalog = opts.catalog ?? buildCatalog();
    this.logger = opts.logger ?? new Logger();
    for (const sink of opts.logSinks ?? []) this.logger.addSink(sink);
    this.bus = new EventBus({ historyCap: this.balance.registry.bus.historyCap, logger: this.logger });
    this.clock = new GameClock(opts.clockDriver ?? new ManualDriver());
    this.rng = new Rng(opts.rngSeed ?? DEFAULT_START_SEED_XOR);
    this.world = createStarterWorld(defaultGeneratorCtx(this.balance));

    this.ledger = new ResourceLedger(this.bus);
    this.tech = new TechState(this.balance.registry.tech);
    this.pricing = new ScanPricing(this.balance, this.tech, (rt) => this.armFor(rt));
    this.income = new IncomeService(this.balance);
    this.production = new ProductionService({
      balance: this.balance,
      ledger: this.ledger,
      bus: this.bus,
      tech: this.tech,
      armFor: (rt) => this.armFor(rt),
      gameMs: () => this.clock.gameMsNow,
      sleepFor: (rt) => fmFor(rt),
    });
    this.upgrades = new CellUpgradeService({
      balance: this.balance,
      ledger: this.ledger,
      bus: this.bus,
      tech: this.tech,
      gameMs: () => this.clock.gameMsNow,
    });
    this.anomalyUpgrades = new AnomalyUpgradeService({
      balance: this.balance,
      ledger: this.ledger,
      bus: this.bus,
      tech: this.tech,
      gameMs: () => this.clock.gameMsNow,
    });
    this.charge = new ChargeService({
      balance: this.balance,
      ledger: this.ledger,
      bus: this.bus,
      gameMs: () => this.clock.gameMsNow,
      addSonarCharge: () => this.addSonarCharge(),
    });
    this.anomalies = new AnomalyService({ bus: this.bus });
    this.synthService = new SynthService({
      balance: this.balance,
      ledger: this.ledger,
      bus: this.bus,
      tech: this.tech,
      armFor: (rt) => this.armFor(rt),
      gameMs: () => this.clock.gameMsNow,
    });
    this.warehouse = new WarehouseService({
      balance: this.balance,
      ledger: this.ledger,
      bus: this.bus,
      gameMs: () => this.clock.gameMsNow,
      sessionBump: () => this.bumpSession('warehouseUpgrades'),
    });
    this.logistics = new LogisticsService(this.ledger, () => this.clock.gameMsNow, () => this.warehouse.getLevel());
    this.exploration = new ExplorationService({
      ledger: this.ledger,
      bus: this.bus,
      rng: this.rng,
      pricing: this.pricing,
      tech: this.tech,
      balance: this.balance,
      gameMs: () => this.clock.gameMsNow,
    });
    this.ticker = new EconomyTicker({
      subscribe: (l) => this.clock.onTick(l),
      bus: this.bus,
      ledger: this.ledger,
      income: this.income,
      production: this.production,
      planets: () => this.activeRuntimes(),
      incomeContext: () => this.incomeContext(),
      steps: [
        // 1.x v0.0.39.0: surge-планировщик — только активная планета (setInterval 2000 → гранулярность тика)
        (_dtSec, gameMs) => {
          const rt = this.activeRuntime();
          if (rt) this.charge.surgeTick(rt, this.rng.fork(`surge:${gameMs}`));
        },
        // 1.x Ty(dt): синтез по открытым планетам
        (dtSec) => {
          this.synthService.tick(this.activeRuntimes(), dtSec);
        },
      ],
    });
    this.saves = new SaveManager(
      { storage: opts.storage ?? new MemoryStorage(), bus: this.bus, logger: this.logger, autosaveMs: this.balance.registry.hygiene.autosaveMs },
      this,
    );

    // счётчики сессии из событий шины (единая точка — домены не знают про сессию)
    this.bus.on('cell:scanned', () => this.bumpSession('scanned'));
    this.bus.on('cell:scanned', (p) => {
      if (p.type === 4) this.bumpSession('anomalies');
    });
    this.bus.on('cell:upgraded', (p) => {
      this.bumpSession('upgraded');
      if (p.deepUnlocked) this.bumpSession('deepMined');
    });
    this.bus.on('cell:discharged', () => this.bumpSession('chargesDone'));
    this.bus.on('cell:surge', () => this.bumpSession('surges'));
    this.bus.on('synth:produced', () => this.bumpSession('synthRuns'));
    this.bus.on('cell:anomalyUpgraded', (p) => {
      if (p.deepConverted) this.bumpSession('deepMined');
    });
    this.bus.on('game:tick', (p) => {
      this.sessionValue.activeSeconds += p.dtMs / 1000;
    });

    this.newGame({ seed: opts.rngSeed });
  }

  // ——— публичное API ———

  start(): void {
    this.clock.start();
    this.ticker.start();
    this.saves.startAutosave();
  }

  stop(): void {
    this.saves.stopAutosave();
    this.ticker.stop();
    this.clock.stop();
  }

  /** Ручной шаг (тесты/ManualDriver): продвинуть часы и экономику на dtMs. */
  advance(dtMs: number): void {
    const next = this.clock.gameMsNow + dtMs;
    this.clock.hydrate({ gameMs: next, paused: false, speed: this.clock.speed(), stalledRealMs: this.clock.stalledRealMs });
    this.ticker.tick(dtMs, next);
  }

  activePlanetId(): string {
    return this.activePlanetIdValue;
  }

  runtime(pid: string): PlanetRuntime | undefined {
    return this.runtimes.get(pid);
  }

  activeRuntime(): PlanetRuntime | undefined {
    return this.runtimes.get(this.activePlanetIdValue);
  }

  activeRuntimes(): readonly PlanetRuntime[] {
    return this.unlocked.map((id) => this.runtimes.get(id)).filter((r): r is PlanetRuntime => r !== undefined);
  }

  session(): Readonly<SessionStats> {
    return this.sessionValue;
  }

  /** Этап 5: сгенерированная планета мира (renderer/discovery); ferrum/krios — из стартового мира. */
  worldPlanet(pid: string): GeneratedPlanet | undefined {
    return this.world.planets[pid];
  }

  /** Этап 5: граф галактики (1.x ge.PlanetaryGraph). */
  galaxyGraph(): PlanetaryGraph {
    return this.world.graph;
  }

  gameStartSeed(): number {
    return this.gameStartSeedValue;
  }

  // ——— команды (диспетчер) ———

  dispatch<C extends CommandName>(cmd: C, payload: CommandMap[C]): ActionResult<CommandResultMap[C]> {
    // граница диспетчера: конкретные ветки типизированы своими ActionResult, здесь — один casts
    const ret = <T,>(r: ActionResult<T>): ActionResult<CommandResultMap[C]> => r as unknown as ActionResult<CommandResultMap[C]>;
    switch (cmd) {
      case 'newGame': {
        const p = payload as CommandMap['newGame'];
        return ret(ok(this.newGame(p)));
      }
      case 'scanCell': {
        const p = payload as CommandMap['scanCell'];
        const rt = this.runtimes.get(p.pid);
        if (!rt) return ret(fail('unknown-cell', `planet ${p.pid}`));
        return this.exploration.scanCell(rt, p.cellId) as ActionResult<CommandResultMap[C]>;
      }
      case 'upgradeCell': {
        const p = payload as CommandMap['upgradeCell'];
        const rt = this.runtimes.get(p.pid);
        if (!rt) return ret(fail('unknown-cell', `planet ${p.pid}`));
        return this.upgrades.upgradeCell(rt, p.cellId) as ActionResult<CommandResultMap[C]>;
      }
      case 'reactivateCell': {
        const p = payload as CommandMap['reactivateCell'];
        const rt = this.runtimes.get(p.pid);
        if (!rt) return ret(fail('unknown-cell', `planet ${p.pid}`));
        return this.production.reactivate(rt, p.cellId) as ActionResult<CommandResultMap[C]>;
      }
      case 'dischargeCell': {
        const p = payload as CommandMap['dischargeCell'];
        const rt = this.runtimes.get(p.pid);
        if (!rt) return ret(fail('unknown-cell', `planet ${p.pid}`));
        return this.charge.discharge(rt, p.cellId) as ActionResult<CommandResultMap[C]>;
      }
      case 'chooseAnomalyBranch': {
        const p = payload as CommandMap['chooseAnomalyBranch'];
        const rt = this.runtimes.get(p.pid);
        if (!rt) return ret(fail('unknown-cell', `planet ${p.pid}`));
        return this.anomalies.chooseBranch(rt, p.cellId, p.branch) as ActionResult<CommandResultMap[C]>;
      }
      case 'upgradeAnomalyCell': {
        const p = payload as CommandMap['upgradeAnomalyCell'];
        const rt = this.runtimes.get(p.pid);
        if (!rt) return ret(fail('unknown-cell', `planet ${p.pid}`));
        return this.anomalyUpgrades.upgrade(rt, p.cellId) as ActionResult<CommandResultMap[C]>;
      }
      case 'upgradeWarehouse':
        return this.warehouse.upgrade() as ActionResult<CommandResultMap[C]>;
      case 'discoverPlanet': {
        const p = payload as CommandMap['discoverPlanet'];
        return ret(this.discoverWorld(p));
      }
      case 'unlockKrios': {
        const p = payload as CommandMap['unlockKrios'];
        return ret(this.unlockKrios(p.scores));
      }
      case 'rerollDiscovery':
        return ret(this.rerollDiscovery());
      case 'resolveAnomaly': {
        const p = payload as CommandMap['resolveAnomaly'];
        return ret(this.resolveAnomaly(p.planetId));
      }
      case 'loadCargo': {
        const p = payload as CommandMap['loadCargo'];
        return ret(this.logistics.load(p.resource, p.amount));
      }
      case 'unloadCargo': {
        const p = payload as CommandMap['unloadCargo'];
        return ret(this.logistics.unload(this.activePlanetIdValue, p.resource, p.amount, this.logisticsContext(this.activePlanetIdValue)));
      }
      case 'withdrawDepot': {
        const p = payload as CommandMap['withdrawDepot'];
        return ret(this.logistics.withdraw(this.activePlanetIdValue, p.resource, p.amount));
      }
      case 'scanOrbitalBody': {
        const p = payload as CommandMap['scanOrbitalBody'];
        return ret(this.scanOrbitalBody(p.hostPlanetId, p.bodyId));
      }
      case 'activateOrbitalBody': {
        const p = payload as CommandMap['activateOrbitalBody'];
        return ret(this.activateOrbitalBody(p.hostPlanetId, p.bodyId));
      }
      case 'travelWithinSystem': {
        const p = payload as CommandMap['travelWithinSystem'];
        return ret(this.travelWithinSystem(p.hostPlanetId, p.destinationId));
      }
      case 'travelToPlanet': {
        const p = payload as CommandMap['travelToPlanet'];
        return ret(this.travelToPlanet(p.destinationId));
      }
      case 'setActivePlanet': {
        const p = payload as CommandMap['setActivePlanet'];
        return ret(this.travelToPlanet(p.pid));
      }
      case 'grant': {
        const p = payload as CommandMap['grant'];
        const res = this.ledger.tryCommit({ reason: p.reason ?? 'grant', scope: 'global', delta: p.delta, gameMs: this.clock.gameMsNow });
        if (!res.ok) return ret(fail('cost', res.insufficient.join(',')));
        return ret(ok(undefined));
      }
      case 'save':
        return ret(ok(this.saves.save()));
      case 'load': {
        const res = this.saves.load();
        if (!res.ok) return ret(fail('state', res.reason));
        return ret(ok(undefined));
      }
      case 'exportSave':
        return ret(ok({ payload: this.saves.exportString() }));
      case 'importSave': {
        const p = payload as CommandMap['importSave'];
        const res = this.saves.importString(p.payload);
        if (!res) return ret(fail('state', 'import parse failed'));
        return ret(ok(res));
      }
      default:
        return ret(fail('not-implemented', String(cmd)));
    }
  }

  newGame(opts: { seed?: number } = {}): { seed: number } {
    const seed = opts.seed ?? ((Date.now() ^ DEFAULT_START_SEED_XOR) >>> 0);
    this.gameStartSeedValue = seed >>> 0;
    this.rng = new Rng(seed);
    this.exploration.setRng(this.rng);
    this.ledger.hydrate({ balances: {}, nextId: 1 });
    this.tech.hydrate(undefined);
    this.pricing.setCurrentCost(this.balance.baseline.scan.baseCost);
    this.warehouse.setLevel(0);
    this.logistics.reset();
    this.clock.hydrate({ gameMs: 0, paused: false, speed: 1, stalledRealMs: 0 });
    this.sessionStartReal = Date.now();
    this.sessionValue = freshSession(this.sessionStartReal);
    this.sonarChargesValue = 0;
    this.sonarRerollsValue = 0;
    this.resolvedAnomalyIds.clear();
    this.sonarBonusValue = null;
    this.charge.reset();
    this.runtimes.clear();
    this.world = createStarterWorld(defaultGeneratorCtx(this.balance));
    this.discoverySpecs = [];
    this.orbitalExploration.clear();
    this.nextPreviewCache = null;
    this.unlocked = [...this.balance.baseline.start.unlockedPlanets];
    this.activePlanetIdValue = this.balance.baseline.start.activePlanetId;
    for (const pid of this.unlocked) {
      const data = this.catalog.get(pid);
      if (!data) continue;
      const rt = createPlanetRuntime(data);
      applyStartState(rt);
      this.runtimes.set(pid, rt);
    }
    return { seed: this.gameStartSeedValue };
  }

  /**
   * 1.x ge.discoverPlanet @103509 (аудит stage5 §discover): построение → Yf (узел/рукав/рёбра) →
   * initStart → ni → unlock → награда floor(500×2.2^max(0,idx−2))🔬 → bus planet:discovered.
   * Автосмена активной планеты НЕ происходит (аудит afterFirst.activePlanetId='ferrum').
   * 2.0-отклонения (ADR-017): награда через ledger (1.x — прямое n.research+=);Js/jr-рендер — домен renderer.
   */
  private discoverWorld(input: CommandMap['discoverPlanet']): ActionResult<DiscoverPlanetResult> {
    const usesSonarEconomy = this.unlocked.includes('krios');
    const economy = usesSonarEconomy ? this.nextDiscoveryEconomy() : null;
    if (economy && this.sonarChargesValue < economy.charges) return fail('cost', `Для открытия мира нужно ${economy.charges} сонарных зарядов`);
    if (economy && this.ledger.balance('energy') < economy.energy) return fail('energy', `Для открытия мира требуется ${economy.energy} энергии`);
    const preview = usesSonarEconomy ? this.nextDiscoveryPreview() : null;
    if (preview?.signalClass === 'anomaly' && !this.anomalyGate().unlocked) {
      return fail('state', 'Аномальная сигнатура заблокирована: требуется исследовать 3 мира в 2 галактических рукавах и накопить 1500 исследований');
    }
    // После включения экономики сонара источник seed всегда серверный preview: UI/клиент не может подменить мир.
    const discoveryInput = preview ? { ...input, seed: preview.seed } : input;
    const r = runDiscovery(discoveryInput, this.world, defaultGeneratorCtx(this.balance));
    if (economy) {
      const tx = this.ledger.tryCommit({ reason: `sonar:discover:${r.planet.id}`, scope: 'global', delta: { energy: -economy.energy }, gameMs: this.clock.gameMsNow });
      if (!tx.ok) return fail('energy', `Для открытия мира требуется ${economy.energy} энергии`);
      this.sonarChargesValue -= economy.charges;
    }
    this.sonarRerollsValue = 0;
    this.nextPreviewCache = null;
    const planet = r.planet;
    this.discoverySpecs.push({
      id: planet.id,
      name: planet.name,
      seed: planet.seed >>> 0,
      f: planet.f,
      geometry: planet.geometry,
      biome: planet.biome,
      planetIndex: planet.planetIndex || this.discoverySpecs.length + 3,
    });
    this.unlocked.push(planet.id);
    const rtNew = createPlanetRuntime(toPlanetData(planet));
    applyStartState(rtNew); // 1.x m.initStart(): explored=[starting], revealed=соседи, yield стартовой клетки
    this.runtimes.set(planet.id, rtNew);
    const commit = this.ledger.tryCommit({ reason: `discover:${planet.id}`, scope: 'global', delta: { research: r.researchReward }, gameMs: this.clock.gameMsNow });
    if (!commit.ok) this.logger.warn('game', `награда открытия не зачислена: ${commit.insufficient.join(',')}`);
    this.bumpSession('planetsUnlocked');
    this.bus.emit('planet:discovered', { id: planet.id, index: planet.planetIndex || 0, name: planet.name });
    return ok({
      id: planet.id,
      index: planet.planetIndex || 0,
      name: planet.name,
      biome: planet.biome,
      armId: planet.armId ?? r.node.armId,
      researchReward: r.researchReward,
      node: { x: r.node.x, y: r.node.y, z: r.node.z },
    });
  }

  /** Stage 6.5: аномальная экспедиция — однократная атомарная транзакция с уникальными наградами. */
  private resolveAnomaly(planetId: string): ActionResult<CommandResultMap['resolveAnomaly']> {
    const sites = buildAnomalySites(Object.values(this.world.graph.nodes), this.resolvedAnomalyIds);
    const site = sites.find((candidate) => candidate.planetId === planetId);
    if (!site) return fail('state', 'Аномальная система не обнаружена');
    if (site.resolved) return fail('state', 'Экспедиция в этой системе уже завершена');
    if (!site.available) return fail('state', 'Сначала завершите предыдущую аномальную экспедицию');
    if (this.activePlanetIdValue !== planetId) return fail('state', `Для экспедиции необходимо находиться на планете ${site.planetName}`);
    const reward = { darkMatter: site.reward.darkMatter, relic: site.reward.relic, essence: site.reward.essence };
    const tx = this.ledger.tryCommit({
      reason: `anomaly:resolved:${planetId}`,
      scope: 'global',
      delta: { energy: -site.energyCost, research: -site.researchCost, ...reward },
      gameMs: this.clock.gameMsNow,
    });
    if (!tx.ok) return fail('cost', `Недостаточно ресурсов: требуется ${site.energyCost} энергии и ${site.researchCost} исследований`);
    this.resolvedAnomalyIds.add(planetId);
    this.sessionValue.eventsTriggered += 1;
    return ok({ planetId, reward });
  }

  /**
   * 1.x ge.setActivePlanet @112270 (аудит stage5 §setActive): guard «существует И открыта» → иначе false;
   * selectedCellId/planetPage/rotX/rotY — состояние UI/рендерера (Этап 12); своп storage On()/yy()
   * (iron/kriogen/extraResources per-planet) — Этап 9 вместе c пер-планетными стоками (TV-25, ADR-017).
   */
  /** Stage 6.6: маршрут выполняется по одному ребру; цель может находиться за несколькими промежуточными узлами. */
  /** Stage 7.4: платное раскрытие одной орбитальной сигнатуры. */
  private scanOrbitalBody(hostPlanetId: string, bodyId: string): ActionResult<CommandResultMap['scanOrbitalBody']> {
    const host = this.world.graph.nodes[hostPlanetId];
    if (!host?.discovered || !this.unlocked.includes(hostPlanetId)) return fail('hidden', 'Звёздная система ещё не доступна для исследования');
    const catalog = buildStarSystemCatalog(host);
    const body = catalog?.bodies.find((item) => item.id === bodyId);
    if (!body || body.orbitIndex === 0) return fail('unknown-cell', 'Орбитальное тело не найдено');
    const state = this.orbitalExploration.get(hostPlanetId) ?? { scannedBodyIds: new Set<string>(), activatedBodies: new Map<string, string>() };
    if (state.scannedBodyIds.has(bodyId)) return fail('state', 'Эта орбита уже исследована');
    const energyCost = 500;
    const researchCost = 100;
    if (this.ledger.balance('energy') < energyCost || this.ledger.balance('research') < researchCost) return fail('cost', `Требуется ${energyCost} энергии и ${researchCost} исследований`);
    const tx = this.ledger.tryCommit({ reason: `orbital:scan:${bodyId}`, scope: 'global', delta: { energy: -energyCost, research: -researchCost }, gameMs: this.clock.gameMsNow });
    if (!tx.ok) return fail('cost', 'Недостаточно ресурсов для исследования орбиты');
    state.scannedBodyIds.add(bodyId);
    this.orbitalExploration.set(hostPlanetId, state);
    return ok({ hostPlanetId, bodyId, energySpent: energyCost, researchSpent: researchCost });
  }

  /** Stage 7.4: создаёт полноценный runtime через существующий генератор планет и ADR-017 replay. */
  private activateOrbitalBody(hostPlanetId: string, bodyId: string): ActionResult<CommandResultMap['activateOrbitalBody']> {
    const host = this.world.graph.nodes[hostPlanetId];
    if (!host?.discovered || !this.unlocked.includes(hostPlanetId)) return fail('hidden', 'Система недоступна');
    const catalog = buildStarSystemCatalog(host);
    const body = catalog?.bodies.find((item) => item.id === bodyId);
    if (!body || body.orbitIndex === 0) return fail('unknown-cell', 'Орбитальное тело не найдено');
    const state = this.orbitalExploration.get(hostPlanetId);
    if (!state?.scannedBodyIds.has(bodyId)) return fail('state', 'Сначала исследуйте орбитальную сигнатуру');
    const existing = state.activatedBodies.get(bodyId);
    if (existing) return fail('state', `Тело уже активировано как ${existing}`);
    const energyCost = 2000;
    const researchCost = 500;
    if (this.ledger.balance('energy') < energyCost || this.ledger.balance('research') < researchCost) return fail('cost', `Требуется ${energyCost} энергии и ${researchCost} исследований`);
    const biomeByClass: Record<string, string> = { terrestrial: 'unknown', ice: 'krios', 'gas-giant': 'helium', dwarf: 'rocky', 'asteroid-belt': 'rocky' };
    const seed = ((catalog!.seed ^ Math.imul(body.orbitIndex + 1, 0x45d9f3b) ^ 0x7a31c9) >>> 0) || 1;
    const generated = runDiscovery({ name: `${host.name} · Орбита ${body.orbitIndex}`, biome: biomeByClass[body.bodyClass] ?? 'unknown', seed, geometry: host.geometry }, this.world, defaultGeneratorCtx(this.balance));
    const tx = this.ledger.tryCommit({ reason: `orbital:activate:${bodyId}`, scope: 'global', delta: { energy: -energyCost, research: -researchCost }, gameMs: this.clock.gameMsNow });
    if (!tx.ok) return fail('cost', 'Не удалось списать ресурсы для активации планеты');
    const planet = generated.planet;
    this.discoverySpecs.push({ id: planet.id, name: planet.name, seed: planet.seed >>> 0, f: planet.f, geometry: planet.geometry, biome: planet.biome, planetIndex: planet.planetIndex || this.discoverySpecs.length + 3 });
    this.unlocked.push(planet.id);
    const runtime = createPlanetRuntime(toPlanetData(planet));
    applyStartState(runtime);
    this.runtimes.set(planet.id, runtime);
    state.activatedBodies.set(bodyId, planet.id);
    this.orbitalExploration.set(hostPlanetId, state);
    this.ledger.tryCommit({ reason: `orbital:activation-reward:${planet.id}`, scope: 'global', delta: { research: generated.researchReward }, gameMs: this.clock.gameMsNow });
    this.bumpSession('planetsUnlocked');
    this.bus.emit('planet:discovered', { id: planet.id, index: planet.planetIndex || 0, name: planet.name });
    return ok({ hostPlanetId, bodyId, id: planet.id, index: planet.planetIndex || 0, name: planet.name, biome: planet.biome, armId: planet.armId ?? generated.node.armId, researchReward: generated.researchReward, node: { x: generated.node.x, y: generated.node.y, z: generated.node.z } });
  }

  orbitalExplorationState(hostPlanetId: string): { readonly scannedBodyIds: readonly string[]; readonly activatedBodies: Readonly<Record<string, string>> } {
    const state = this.orbitalExploration.get(hostPlanetId);
    return { scannedBodyIds: [...(state?.scannedBodyIds ?? [])], activatedBodies: Object.fromEntries(state?.activatedBodies ?? []) };
  }

  /** Stage 7.4.2: навигация между телами одной системы без межзвёздного расхода энергии. */
  private travelWithinSystem(hostPlanetId: string, destinationId: string): ActionResult<CommandResultMap['travelWithinSystem']> {
    const host = this.world.graph.nodes[hostPlanetId];
    if (!host?.discovered || !this.unlocked.includes(hostPlanetId)) return fail('hidden', 'Звёздная система недоступна');
    if (!this.runtimes.has(destinationId) || !this.unlocked.includes(destinationId)) return fail('state', 'Планета не активирована');
    const state = this.orbitalExploration.get(hostPlanetId);
    const catalog = buildStarSystemCatalog(host);
    const belongsToSystem = [...(state?.activatedBodies.entries() ?? [])].some(([bodyId, planetId]) =>
      planetId === destinationId && catalog?.bodies.some((body) => body.id === bodyId && body.orbitIndex > 0) === true,
    );
    if (!belongsToSystem && destinationId !== hostPlanetId) return fail('state', 'Планета не принадлежит этой звёздной системе');
    const prev = this.activePlanetIdValue;
    if (prev === destinationId) return fail('state', 'Эта планета уже активна');
    this.activePlanetIdValue = destinationId;
    this.bus.emit('planet:activated', { pid: destinationId, prev });
    return ok({ pid: destinationId, prev, hostPlanetId });
  }

  travelToPlanet(destinationId: string): ActionResult<CommandResultMap['travelToPlanet']> {
    const prev = this.activePlanetIdValue;
    if (destinationId === prev) return fail('state', 'Вы уже находитесь в этой системе');
    if (!this.runtimes.has(destinationId) || !this.unlocked.includes(destinationId)) return fail('state', `планета ${destinationId} неизвестна или не открыта`);
    const route = findGalaxyRoute(this.world.graph, this.unlocked, prev, destinationId, this.logistics.cargoMass());
    if (!route) return fail('state', 'Маршрут отсутствует: между открытыми системами нет непрерывной цепочки переходов');
    const leg = route.firstLeg;
    if (this.ledger.balance('energy') < leg.energyCost) return fail('energy', `Для перехода к ${this.world.graph.nodes[leg.to]?.name ?? leg.to} требуется ${leg.energyCost} энергии`);
    const tx = this.ledger.tryCommit({
      reason: `travel:${leg.from}->${leg.to}`,
      scope: 'global',
      delta: { energy: -leg.energyCost },
      gameMs: this.clock.gameMsNow,
    });
    if (!tx.ok) return fail('energy', `Для перехода требуется ${leg.energyCost} энергии`);
    this.activePlanetIdValue = leg.to;
    this.sessionValue.travels += 1;
    this.bus.emit('planet:activated', { pid: leg.to, prev });
    return ok({
      pid: leg.to,
      prev,
      destinationId,
      path: route.path,
      hopsRemaining: Math.max(0, route.hops - 1),
      distance: leg.distance,
      energyCost: leg.energyCost,
    });
  }

  /** Совместимость API: старое переключение теперь тоже проходит через маршрутную экономику. */
  setActivePlanet(pid: string): ActionResult<CommandResultMap['setActivePlanet']> {
    return this.travelToPlanet(pid);
  }

  // ——— модификаторные источники (единственная точка сборки контекста) ———

  armFor(rt: PlanetRuntime): ArmModifiers | null {
    const arms = this.balance.baseline.galaxy.arms;
    const armId = rt.data.armId ?? (rt.data.planetIndex <= 1 ? 'core' : 'inter');
    const a = arms[armId];
    if (!a) return null;
    return { id: a.id, name: a.name, energy: a.energy, iron: a.iron, kriogen: a.kriogen, rare: a.rare, deplete: a.deplete, scan: a.scan, event: a.event, focus: a.focus };
  }

  biomeMultFor(rt: PlanetRuntime): number {
    const reg = this.balance.registry.planet.biomeMults[rt.data.biome];
    if (reg) return reg.mult;
    return this.balance.baseline.galaxy.biomeMults[rt.data.biome] ?? 1;
  }

  incomeContext(): IncomeContext {
    const snap = this.ledger.snapshot();
    return {
      compounds: { steel: snap.steel ?? 0, chip: snap.chip ?? 0, alloy: snap.alloy ?? 0, core: snap.core ?? 0, relic: snap.relic ?? 0 },
      warehouseLevel: this.warehouse.getLevel(),
      tech: this.tech,
      armFor: (rt) => this.armFor(rt),
      biomeMultFor: (rt) => this.biomeMultFor(rt),
      deepMult: 2, // 1.x Ws()
      gameMs: this.clock.gameMsNow,
      // Этап 4: per-планетные хуки — зарядный бафф (s0), научный буст (C в ng).
      // ВАЖНО: fm() (0.7 от power-аномалий) в 1.x входит ТОЛЬКО в цепь истощения жил (tb @264622)
      // и UI-тултип — в ce() её нет (аудит §branches: power_L0 = 14+4 ровно). Сон → production.sleepFor.
      planetHooksFor: (rt) => ({
        chargeEnergy: this.charge.multFor(rt.data.id),
        chargeScience: this.charge.scienceBoostFor(rt.data.id),
        scanBonus: this.sonarBonusValue && this.sonarBonusValue.planetId === rt.data.id && this.sonarBonusValue.until > Date.now() ? this.sonarBonusValue.mult : 1,
      }),
      spcHiddenFor: () => false, // 1.x ao(pid,'spc_hidden') — tech-профили, Этап 7
    };
  }

  /** Stage 6: реальное открытие Криос-9 через трёхраундовый сонар. Пороговые значения и награды — registry.sonar. */
  private unlockKrios(scores: readonly number[]): ActionResult<CommandResultMap['unlockKrios']> {
    if (this.unlocked.includes('krios')) return fail('state', 'Криос-9 уже открыт');
    if (this.activePlanetIdValue !== 'ferrum') return fail('state', 'Сонарная антенна доступна только на Ферруме');
    const ferrum = this.runtimes.get('ferrum');
    if (!ferrum || ferrum.explored.size < ferrum.data.cells.length) return fail('state', 'Сначала исследуйте все клетки Феррума');
    const cfg = this.balance.registry.sonar;
    if (!Array.isArray(scores) || scores.length !== cfg.difficulty.baseRounds || scores.some((v) => !Number.isFinite(v) || v < 0 || v > 1)) {
      return fail('state', `Сонар требует ${cfg.difficulty.baseRounds} корректных сигналов`);
    }
    const planet = this.world.planets['krios'];
    if (!planet) return fail('state', 'Генератор не подготовил Криос-9');
    const cost = cfg.hintEnergy;
    const tx = this.ledger.tryCommit({ reason: 'sonar:unlock-krios', scope: 'global', delta: { energy: -cost }, gameMs: this.clock.gameMsNow });
    if (!tx.ok) return fail('energy', `Требуется ${cost} энергии`);
    const accuracy = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length * 100);
    let mult = 1;
    if (accuracy >= 90) mult = cfg.rewardPerfect;
    else if (accuracy >= 70) mult = cfg.rewardGood;
    else if (accuracy >= 50) mult = cfg.rewardOk;
    if (mult > 1) mult = Number((mult * (1 + cfg.rewardIdxBonus * 0)).toFixed(3));
    this.unlocked.push('krios');
    const runtime = createPlanetRuntime(toPlanetData(planet));
    applyStartState(runtime);
    this.runtimes.set('krios', runtime);
    const node = this.world.graph.nodes['krios'];
    if (node) this.world.graph.nodes['krios'] = { ...node, discovered: true };
    const until = mult > 1 ? Date.now() + cfg.rewardHours * 60 * 60 * 1000 : 0;
    this.sonarBonusValue = mult > 1 ? { planetId: 'krios', mult, until, accuracy } : null;
    this.bumpSession('planetsUnlocked');
    this.bus.emit('planet:discovered', { id: 'krios', index: 2, name: planet.name });
    return ok({ pid: 'krios', accuracy, bonusMult: mult, bonusUntil: until });
  }

  /** Стоимость следующего открытия растёт с индексом планеты; все списания идут через ledger. */
  private nextDiscoveryEconomy(): { index: number; energy: number; charges: number; rerollEnergy: number } {
    const hiddenIndex = this.balance.registry.planet.hiddenWorldIndex;
    const index = countDiscoverablePlanets(this.world.planets, hiddenIndex) + 1;
    const tier = Math.max(1, index - 2);
    const baseEnergy = Math.ceil(this.balance.registry.sonar.hintEnergy * Math.pow(tier, 1.35));
    const energy = Math.max(1, Math.ceil(baseEnergy * (1 - this.galaxyProgression().discountPct / 100)));
    const charges = Math.min(this.balance.registry.sonar.chargeMax, 1 + Math.floor((tier - 1) / 4));
    return { index, energy, charges, rerollEnergy: Math.ceil(energy * this.balance.registry.sonar.rerollBurnPct) };
  }

  /** Пересборка меняет только ещё не открытый preview; уже открытые планеты неизменны. */
  private rerollDiscovery(): ActionResult<CommandResultMap['rerollDiscovery']> {
    if (!this.unlocked.includes('krios')) return fail('state', 'Сначала откройте Криос-9');
    const cfg = this.balance.registry.sonar;
    if (this.sonarRerollsValue >= cfg.rerollMax) return fail('max', 'Достигнут предел пересборок сонарной сигнатуры');
    if (this.sonarChargesValue < 1) return fail('cost', 'Для пересборки нужен 1 сонарный заряд');
    const economy = this.nextDiscoveryEconomy();
    const burn = economy.rerollEnergy;
    const tx = this.ledger.tryCommit({ reason: `sonar:reroll:${this.sonarRerollsValue + 1}`, scope: 'global', delta: { energy: -burn }, gameMs: this.clock.gameMsNow });
    if (!tx.ok) return fail('energy', `Для пересборки требуется ${burn} энергии`);
    this.sonarChargesValue -= 1;
    this.sonarRerollsValue += 1;
    this.nextPreviewCache = null;
    const preview = this.nextDiscoveryPreview();
    if (!preview) return fail('state', 'Не удалось сформировать новую сигнатуру');
    return ok({ preview, rerolls: this.sonarRerollsValue, energyBurned: burn, chargesSpent: 1 });
  }

  /** Детерминированный preview следующего мира. Генерируется тем же pipeline, но на изолированной копии графа. */
  nextDiscoveryPreview(): NonNullable<GameSnapshot['sonar']['nextPreview']> | null {
    if (!this.unlocked.includes('krios')) return null;
    const hiddenIndex = this.balance.registry.planet.hiddenWorldIndex;
    const index = countDiscoverablePlanets(this.world.planets, hiddenIndex) + 1;
    const seed = ((this.gameStartSeedValue ^ Math.imul(index, 2654435769) ^ Math.imul(this.sonarRerollsValue, 2246822519)) >>> 0) || 1;
    const key = `${index}:${seed}:${this.sonarRerollsValue}:${Object.keys(this.world.planets).length}:${this.world.graph.edges.length}`;
    if (this.nextPreviewCache?.key === key) return this.nextPreviewCache.value;
    const previewWorld: DiscoveryWorld = {
      graph: { version: this.world.graph.version, nodes: { ...this.world.graph.nodes }, edges: this.world.graph.edges.map((edge) => [edge[0], edge[1]]) },
      planets: { ...this.world.planets },
    };
    const generatedResult = runDiscovery({ seed }, previewWorld, defaultGeneratorCtx(this.balance));
    const generated = generatedResult.planet;
    const sector = galaxySector(generatedResult.node);
    const value = { id: generated.id, index: generated.planetIndex, name: generated.name, biome: generated.biome, geometry: generated.geometryName, resources: [...generated.resourceList], seed, signalClass: classifySignal({ biome: generated.biome, geometry: generated.geometryName, resources: generated.resourceList }), sectorId: sector.id, sectorLabel: sector.label };
    this.nextPreviewCache = { key, value };
    return value;
  }

  private galaxyProgression(): ReturnType<typeof galaxyProgressionStatus> {
    const discovered = Object.values(this.world.graph.nodes).filter((node) => node.discovered);
    return galaxyProgressionStatus({
      discoveredWorlds: discovered.length,
      discoveredArms: new Set(discovered.map((node) => node.armId).filter(Boolean)).size,
      discoveredSectors: new Set(discovered.map((node) => galaxySector(node).id)).size,
      research: this.ledger.balance('research'),
    });
  }

  private anomalyGate(): ReturnType<typeof anomalyGateStatus> {
    const discovered = Object.values(this.world.graph.nodes).filter((node) => node.discovered);
    return anomalyGateStatus({
      discoveredWorlds: discovered.length,
      discoveredArms: new Set(discovered.map((node) => node.armId).filter(Boolean)).size,
      research: this.ledger.balance('research'),
    });
  }

  sonarStatus(): GameSnapshot['sonar'] {
    const target = this.world.planets['krios'];
    const bonus = this.sonarBonusValue && this.sonarBonusValue.until > Date.now() ? this.sonarBonusValue : null;
    return {
      available: !this.unlocked.includes('krios') && this.activePlanetIdValue === 'ferrum' && (this.runtimes.get('ferrum')?.explored.size ?? 0) >= (this.runtimes.get('ferrum')?.data.cells.length ?? 1) && this.ledger.balance('energy') >= this.balance.registry.sonar.hintEnergy,
      cost: this.balance.registry.sonar.hintEnergy,
      targetName: target?.name ?? 'Криос-9',
      targetBiome: target?.biome ?? 'krios',
      targetResources: [...(target?.resourceList ?? ['kriogen'])],
      bonusMult: bonus?.mult ?? 1,
      bonusLeftMs: bonus ? bonus.until - Date.now() : 0,
      bonusAccuracy: bonus?.accuracy ?? null,
      discoveryCost: this.unlocked.includes('krios') ? this.nextDiscoveryEconomy().energy : 0,
      discoveryCharges: this.unlocked.includes('krios') ? this.nextDiscoveryEconomy().charges : 0,
      rerollCost: this.unlocked.includes('krios') ? this.nextDiscoveryEconomy().rerollEnergy : 0,
      rerolls: this.sonarRerollsValue,
      rerollsRemaining: Math.max(0, this.balance.registry.sonar.rerollMax - this.sonarRerollsValue),
      anomalyGate: this.anomalyGate(),
      nextPreview: this.nextDiscoveryPreview(),
    };
  }

  /** 1.x Jf(1): сонар-заряд (cap registry sonar.chargeMax); полная механика сонара — TV-27. */
  addSonarCharge(): boolean {
    const cap = this.balance.registry.sonar.chargeMax;
    if (this.sonarChargesValue >= cap) return false;
    this.sonarChargesValue += 1;
    return true;
  }

  sonarCharges(): number {
    return this.sonarChargesValue;
  }

  // ——— снапшот для UI ———

  snapshot(): GameSnapshot {
    const { snapshot: inc } = this.income.computeIncome(this.activeRuntimes(), this.incomeContext());
    const planets: PlanetView[] = [];
    for (const rt of this.activeRuntimes()) {
      const cells: CellView[] = rt.data.cells.map((node) => {
        const st = rt.cellStates.get(node.id);
        const status = rt.explored.has(node.id) ? 'explored' : rt.revealed.has(node.id) ? 'revealed' : 'hidden';
        return {
          id: node.id,
          type: node.type,
          status,
          neighbors: node.neighbors,
          level: st?.level ?? 0,
          yield: st?.yield ?? 0,
          reserve: st?.reserve ?? 0,
          maxReserve: st?.maxReserve ?? 0,
          cooldownUntil: st?.cooldownUntil ?? 0,
          reactCount: st?.reactCount ?? 0,
          anomalyType: st?.anomalyType ?? null,
          mutant: st?.mutant ?? null,
          isDeep: st?.isDeep ?? false,
          chargeCooldownUntil: st?.chargeCooldownUntil ?? 0,
          chargedEver: st?.chargedEver ?? false,
        };
      });
      planets.push({
        id: rt.data.id,
        name: rt.data.name,
        biome: rt.data.biome,
        planetIndex: rt.data.planetIndex,
        armId: rt.data.armId,
        cells,
        exploredCount: rt.explored.size,
        totalCount: rt.data.cells.length,
      });
    }
    const active = this.activeRuntime();
    const graphNodes = Object.values(this.world.graph.nodes);
    const graphPoints = new Map(layoutGalaxy(graphNodes).map((point) => [point.id, point]));
    const discoveredCount = graphNodes.filter((node) => node.discovered).length;
    const resources: Record<string, number> = {};
    for (const k of LEDGER_RESOURCES) resources[k] = this.ledger.balance(k);
    return {
      gameMs: this.clock.gameMsNow,
      paused: this.clock.paused(),
      resources: resources,
      perSec: { energy: inc.energyPerSec, iron: inc.ironPerSec, kriogen: inc.kriogenPerSec, crystals: inc.crystalsPerSec, research: inc.researchPerSec },
      activePlanetId: this.activePlanetIdValue,
      unlockedPlanets: [...this.unlocked],
      planets,
      scan: { currentCost: this.pricing.getCurrentCost(), charge: active ? this.pricing.chargeFor(active) : this.pricing.getCurrentCost() },
      logistics: this.logistics.snapshot(this.activePlanetIdValue, this.logisticsContext(this.activePlanetIdValue)),
      warehouse: {
        level: this.warehouse.getLevel(),
        maxLevel: this.warehouse.maxLevel(),
        tonsPerCell: this.warehouse.tonsPerCell(),
        bonusMult: this.warehouse.bonusMult(),
        nextCost: this.warehouse.nextCost(),
      },
      session: { ...this.sessionValue },
      journal: this.ledger.journal().slice(-20),
      charge: this.charge.status(this.activePlanetIdValue),
      sonarCharges: this.sonarChargesValue,
      sonar: this.sonarStatus(),
      synth: active ? this.synthService.status(active) : null,
      galaxy: {
        nodes: graphNodes.map((node) => {
          const point = graphPoints.get(node.id)!;
          const sector = galaxySector(node);
          return { ...node, signalClass: classifySignal({ biome: node.biome, geometry: node.geometryName, frequency: node.frequency }), mapX: point.x, mapY: point.y, sectorId: sector.id, sectorLabel: sector.label };
        }),
        edges: this.world.graph.edges.map((e) => [e[0], e[1]] as const),
        discoveredCount,
        milestone: galaxyMilestone(discoveredCount),
        sectors: (['core', 'inner', 'mid', 'outer'] as const).map((id) => { const labels = { core: 'Ядро', inner: 'Внутренний сектор', mid: 'Средний сектор', outer: 'Внешний рубеж' }; return { id, label: labels[id], discovered: graphNodes.filter((node) => node.discovered && galaxySector(node).id === id).length }; }),
        discoveredArms: [...new Set(graphNodes.filter((node) => node.discovered).map((node) => node.armId).filter(Boolean))],
        progression: this.galaxyProgression(),
        routes: buildRouteOptions(this.world.graph, this.unlocked, this.activePlanetIdValue, this.logistics.cargoMass()),
        routePolicy: ROUTE_POLICY,
        anomalies: buildAnomalySites(graphNodes, this.resolvedAnomalyIds),
      },
    };
  }

  /** Stage 6.8: проверка согласованности runtime, графа, маршрутов, логистики и сериализуемого сейва. */
  validateIntegrity(): GalaxyIntegrityReport {
    const snapshot = this.snapshot();
    const logistics = this.logistics.serialize();
    const report = validateGalaxyIntegrity({
      graph: this.world.graph,
      unlockedPlanetIds: this.unlocked,
      activePlanetId: this.activePlanetIdValue,
      runtimePlanetIds: [...this.runtimes.keys()],
      routes: snapshot.galaxy.routes,
      cargo: logistics.cargo,
      depots: logistics.depots,
    });
    const saveValidation = validateSaveV2(this.collectState());
    const issues = [...report.issues, ...saveValidation.problems.map((message) => ({ code: 'invalid-save-state', severity: 'error' as const, message }))];
    return { ...report, ok: !issues.some((issue) => issue.severity === 'error'), issues };
  }

  // ——— SaveSource ———

  collectState(): SaveGameV2 {
    const planets: Record<string, SaveGameV2['planets'][string]> = {};
    for (const [pid, rt] of this.runtimes) {
      const cellStates: SerializedCellState[] = [];
      for (const [id, st] of rt.cellStates) {
        // сериализуем только изменённые клетки (как 1.x: cellStates только для explored/значимых)
        if (rt.explored.has(id) || st.level > 0 || st.reserve > 0 || st.reactCount > 0 || st.mutant || st.anomalyType || st.chargedEver || st.surgeNextAt !== undefined) {
          cellStates.push({ id, ...st });
        }
      }
      planets[pid] = { explored: [...rt.explored], revealed: [...rt.revealed], cellStates };
    }
    const balances: Record<string, number> = {};
    for (const k of LEDGER_RESOURCES) balances[k] = this.ledger.balance(k);
    const ser = this.ledger.serialize();
    return {
      version: 2,
      savedAt: Date.now(),
      gameStartSeed: this.gameStartSeedValue,
      rngState: this.rng.state(),
      gameMs: this.clock.gameMsNow,
      ledger: { balances, nextId: ser.nextId },
      activePlanetId: this.activePlanetIdValue,
      unlockedPlanets: [...this.unlocked],
      planets,
      pricing: { currentCost: this.pricing.getCurrentCost() },
      tech: (() => { const t = this.tech.serialize(); return { levels: t.tech, research: t.research }; })(),
      warehouseLevel: this.warehouse.getLevel(),
      logistics: this.logistics.serialize(),
      session: { ...this.sessionValue },
      sonarCharges: this.sonarChargesValue,
      sonarRerolls: this.sonarRerollsValue,
      resolvedAnomalyIds: [...this.resolvedAnomalyIds],
      ...(this.sonarBonusValue ? { sonarBonus: { ...this.sonarBonusValue } } : {}),
      discoveredSpecs: this.discoverySpecs.map((s) => ({ ...s })),
      orbitalExploration: Object.fromEntries([...this.orbitalExploration].map(([id, state]) => [id, { scannedBodyIds: [...state.scannedBodyIds], activatedBodies: Object.fromEntries(state.activatedBodies) }])),
    };
  }

  applyState(save: SaveGameV2): void {
    this.gameStartSeedValue = save.gameStartSeed >>> 0;
    this.rng = new Rng(save.gameStartSeed >>> 0);
    this.rng.hydrate(save.rngState || (save.gameStartSeed >>> 0));
    this.exploration.setRng(this.rng);
    this.ledger.hydrate({ balances: save.ledger.balances, nextId: save.ledger.nextId });
    this.tech.hydrate({ tech: save.tech?.levels, research: save.tech?.research });
    this.pricing.setCurrentCost(save.pricing?.currentCost ?? this.balance.baseline.scan.baseCost);
    this.warehouse.setLevel(save.warehouseLevel ?? 0);
    this.logistics.hydrate(save.logistics);
    this.sonarChargesValue = Math.max(0, Math.min(this.balance.registry.sonar.chargeMax, save.sonarCharges ?? 0));
    this.sonarRerollsValue = Math.max(0, Math.min(this.balance.registry.sonar.rerollMax, save.sonarRerolls ?? 0));
    this.resolvedAnomalyIds = new Set((save.resolvedAnomalyIds ?? []).filter((id) => typeof id === 'string'));
    const savedBonus = save.sonarBonus;
    this.sonarBonusValue = savedBonus && savedBonus.until > Date.now() ? { ...savedBonus } : null;
    this.charge.reset(); // баффы зарядов не персистятся (короткоживущие; 1.x — runtime-состояние)
    this.clock.hydrate({ gameMs: save.gameMs ?? 0, paused: false, speed: 1, stalledRealMs: 0 });
    this.sessionValue = { ...freshSession(Date.now()), ...(save.session ?? {}) };
    this.activePlanetIdValue = save.activePlanetId;
    this.unlocked = [...save.unlockedPlanets];
    // Этап 5: открытые миры — детерминированный реплей спеков (тот же порядок → те же id/позиции/рукава/рёбра; ADR-017)
    this.discoverySpecs = (save.discoveredSpecs ?? []).map((s) => ({ ...s }));
    this.orbitalExploration = new Map(Object.entries(save.orbitalExploration ?? {}).map(([id, state]) => [id, { scannedBodyIds: new Set(state.scannedBodyIds), activatedBodies: new Map(Object.entries(state.activatedBodies)) }]));
    this.world = createStarterWorld(defaultGeneratorCtx(this.balance));
    this.nextPreviewCache = null;
    for (const spec of this.discoverySpecs) {
      runDiscovery({ name: spec.name, biome: spec.biome, seed: spec.seed, geometry: spec.geometry, frequency: spec.f }, this.world, defaultGeneratorCtx(this.balance));
    }
    if (this.unlocked.includes('krios') && this.world.graph.nodes['krios']) this.world.graph.nodes['krios'] = { ...this.world.graph.nodes['krios']!, discovered: true };
    this.runtimes.clear();
    for (const pid of this.unlocked) {
      const generated = this.world.planets[pid];
      const data = this.catalog.get(pid) ?? (generated ? toPlanetData(generated) : undefined);
      if (!data) {
        this.logger.warn('game', `планета ${pid} неизвестна каталогу — пропущена при загрузке`);
        continue;
      }
      const rt = createPlanetRuntime(data);
      const sp = save.planets?.[pid];
      if (sp) {
        for (const id of sp.explored) rt.explored.add(id);
        for (const id of sp.revealed) rt.revealed.add(id);
        for (const cs of sp.cellStates) {
          const st = rt.cellStates.get(cs.id);
          if (st) Object.assign(st, cs);
        }
      } else {
        applyStartState(rt);
      }
      this.runtimes.set(pid, rt);
    }
  }

  private logisticsContext(planetId: string): LogisticsPlanetContext {
    const rt = this.runtimes.get(planetId);
    const specializedResources = [...new Set((rt?.data.cells ?? []).map((cell) => cell.resourceKey).filter((key): key is string => typeof key === 'string' && key.length > 0))];
    return { exploredCells: rt?.explored.size ?? 0, tonsPerCell: this.warehouse.tonsPerCell(), specializedResources };
  }

  private bumpSession(key: 'scanned' | 'upgraded' | 'deepMined' | 'anomalies' | 'warehouseUpgrades' | 'chargesDone' | 'surges' | 'synthRuns' | 'planetsUnlocked'): void {
    this.sessionValue[key] += 1;
  }

  /** Для тестов: свежий сейв-эталоном (freshSaveV2). */
  static freshSave(seed: number): SaveGameV2 {
    return freshSaveV2(seed, Date.now());
  }
}

export type { LedgerResourceKey };
