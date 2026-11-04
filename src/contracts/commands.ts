/**
 * contracts/commands.ts — команды и результаты (ТЗ §3.1: dispatch<C> → ActionResult<CommandResultMap[C]>).
 * Отказы — закрытый набор причин (parity-имена 1.x: state/energy/cost/max/type/cooldown + hidden/unknown-cell из GS-01/02 guards).
 */
import type { ResourceAmounts } from './resources';
import type { ChooseBranchResult, DischargeResult, UpgradeAnomalyResult } from './anomalies';
import type { GameSnapshot } from './snapshot';

export const REJECT_REASONS = ['state', 'energy', 'cost', 'max', 'type', 'cooldown', 'hidden', 'unknown-cell', 'not-implemented', 'locked', 'unknown-tech', 'unknown-recipe', 'queue-full', 'unknown-job'] as const;
export type RejectReason = (typeof REJECT_REASONS)[number];

export type ActionResult<T = void> = { readonly ok: true; readonly value: T } | { readonly ok: false; readonly reason: RejectReason; readonly detail?: string };

export function ok<T>(value: T): ActionResult<T> {
  return { ok: true, value };
}
export function fail<T = never>(reason: RejectReason, detail?: string): ActionResult<T> {
  return { ok: false, reason, ...(detail !== undefined ? { detail } : {}) };
}

export interface ScanCellResult {
  readonly pid: string;
  readonly cellId: number;
  readonly cost: number;
  readonly type: number;
  /** Дельты балансов, проведённые одной атомарной транзакцией (ADR-013). */
  readonly delta: Readonly<ResourceAmounts>;
  readonly currentCostAfter: number;
  readonly revealedAdded: readonly number[];
}

export interface UpgradeCellResult {
  readonly pid: string;
  readonly cellId: number;
  readonly level: number;
  readonly cost: Readonly<ResourceAmounts>;
  readonly researchGained: number;
}

export interface ReactivateCellResult {
  readonly pid: string;
  readonly cellId: number;
  readonly reactCount: number;
  readonly cost: number;
}

export interface WarehouseUpgradeResult {
  readonly level: number;
  readonly cost: { readonly alloy: number; readonly energy: number };
}

/** Этап 5: результат открытия мира (1.x ge.discoverPlanet @103509; аудит §discover). */
export interface DiscoverPlanetResult {
  readonly id: string;
  readonly index: number;
  readonly name: string;
  readonly biome: string;
  readonly armId: string;
  /** 🔬 floor(500×2.2^max(0,idx−2)) — начисляется ledger-транзакцией (в 1.x — прямое n.research+=). */
  readonly researchReward: number;
  readonly node: { readonly x: number; readonly y: number; readonly z: number };
}

/** Этап 5: результат переключения активной планеты (1.x ge.setActivePlanet @112270). */
export interface SetActivePlanetResult {
  readonly pid: string;
  readonly prev: string;
}

export interface TravelToPlanetResult {
  /** Точка, в которую выполнен текущий прыжок (может быть промежуточной). */
  readonly pid: string;
  readonly prev: string;
  readonly destinationId: string;
  readonly path: readonly string[];
  readonly hopsRemaining: number;
  readonly distance: number;
  readonly energyCost: number;
  /** Системы, через которые пройден перелёт без посадки (транзит, Этап 8.1 — ADR-018). */
  readonly transitNodeIds: readonly string[];
}

export interface NewGameOptions {
  readonly seed?: number;
}

export interface GrantSpec {
  readonly delta: ResourceAmounts;
  readonly reason?: string;
}

export interface CommandMap {
  newGame: NewGameOptions;
  scanCell: { readonly pid: string; readonly cellId: number };
  upgradeCell: { readonly pid: string; readonly cellId: number };
  reactivateCell: { readonly pid: string; readonly cellId: number };
  /** Этап 4: ручной разряд жилы type1/2 (1.x i0). */
  dischargeCell: { readonly pid: string; readonly cellId: number };
  /** Этап 4: выбор ветви аномалии type4 (1.x um — модалька; здесь — команда). */
  chooseAnomalyBranch: { readonly pid: string; readonly cellId: number; readonly branch: string };
  /** Этап 4: апгрейд аномалии type4 (1.x tl; на maxLevel — deep-конверсия). */
  upgradeAnomalyCell: { readonly pid: string; readonly cellId: number };
  upgradeWarehouse: Record<string, never>;
  /** Этап 5: открытие нового мира (1.x ge.discoverPlanet; seed обязателен для детерминизма, fallback Date.now() — как в 1.x). */
  discoverPlanet: {
    readonly name?: string | null;
    readonly biome?: string;
    readonly seed?: number | null;
    readonly geometry?: string | null;
    readonly frequency?: number | null;
  };
  /** Этап 6: открыть Криос-9 после трёх раундов сонарного сканирования. */
  unlockKrios: { readonly scores: readonly number[] };
  /** Stage 6.1: пересборка сигнала следующего мира за сонарный заряд и часть энергии. */
  rerollDiscovery: Record<string, never>;
  /** Stage 6.5: завершить экспедицию на очередной доступной аномалии. */
  resolveAnomaly: { readonly planetId: string };
  /** Stage 6.7: погрузить ресурс из общего баланса в грузовой трюм на текущей планете. */
  loadCargo: { readonly resource: string; readonly amount: number };
  /** Stage 6.7: выгрузить груз в локальное депо текущей планеты. */
  unloadCargo: { readonly resource: string; readonly amount: number };
  /** Stage 6.7: вернуть ресурс из локального депо в общий баланс на текущей планете. */
  withdrawDepot: { readonly resource: string; readonly amount: number };
  /** Stage 7.4: исследовать орбитальную сигнатуру открытой звёздной системы. */
  scanOrbitalBody: { readonly hostPlanetId: string; readonly bodyId: string };
  /** Stage 7.4: активировать ранее исследованное орбитальное тело как игровую планету. */
  activateOrbitalBody: { readonly hostPlanetId: string; readonly bodyId: string };
  /** Stage 7.4.2: бесплатное перемещение между активированными телами одной системы. */
  travelWithinSystem: { readonly hostPlanetId: string; readonly destinationId: string };
  /** Stage 6.6: один прыжок по кратчайшему доступному маршруту к цели. */
  travelToPlanet: { readonly destinationId: string };
  /** Совместимость старого UI/API; теперь также требует реального маршрута и оплаты. */
  setActivePlanet: { readonly pid: string };
  grant: GrantSpec;
  /** Этап 9.3 (Этап 7 ТЗ): покупка уровня технологии/исследования. */
  buyTech: { readonly id: string };
  /** Этап 9.3 (Этап 8 ТЗ): постановка крафт-задачи в очередь реактора. */
  craftEnqueue: { readonly recipeId: string; readonly runs?: number };
  /** Этап 9.3 (Этап 8 ТЗ): отмена задачи (возврат только не стартовавших run). */
  craftCancel: { readonly jobId: number };
  save: Record<string, never>;
  load: Record<string, never>;
  exportSave: Record<string, never>;
  importSave: { readonly payload: string };
}

export interface CommandResultMap {
  newGame: { readonly seed: number };
  scanCell: ScanCellResult;
  upgradeCell: UpgradeCellResult;
  reactivateCell: ReactivateCellResult;
  dischargeCell: DischargeResult;
  chooseAnomalyBranch: ChooseBranchResult;
  upgradeAnomalyCell: UpgradeAnomalyResult;
  upgradeWarehouse: WarehouseUpgradeResult;
  discoverPlanet: DiscoverPlanetResult;
  setActivePlanet: TravelToPlanetResult;
  travelToPlanet: TravelToPlanetResult;
  /** Этап 9.3: результат покупки технологии — новый уровень. */
  buyTech: { readonly techId: string; readonly level: number };
  /** Этап 9.3: результат постановки в очередь. */
  craftEnqueue: { readonly jobId: number; readonly queueLength: number };
  /** Этап 9.3: результат отмены — сколько не стартовавших run снято. */
  craftCancel: { readonly removedRuns: number };
  travelWithinSystem: { readonly pid: string; readonly prev: string; readonly hostPlanetId: string };
  scanOrbitalBody: { readonly hostPlanetId: string; readonly bodyId: string; readonly energySpent: number; readonly researchSpent: number };
  activateOrbitalBody: DiscoverPlanetResult & { readonly hostPlanetId: string; readonly bodyId: string };
  loadCargo: { readonly resource: string; readonly amount: number; readonly cargoMass: number };
  unloadCargo: { readonly planetId: string; readonly resource: string; readonly amount: number; readonly depotMass: number };
  withdrawDepot: { readonly planetId: string; readonly resource: string; readonly amount: number };
  unlockKrios: { readonly pid: 'krios'; readonly accuracy: number; readonly bonusMult: number; readonly bonusUntil: number };
  rerollDiscovery: { readonly preview: NonNullable<GameSnapshot['sonar']['nextPreview']>; readonly rerolls: number; readonly energyBurned: number; readonly chargesSpent: number };
  resolveAnomaly: { readonly planetId: string; readonly reward: ResourceAmounts };
  grant: void;
  save: { readonly sizeBytes: number };
  load: void;
  exportSave: { readonly payload: string };
  importSave: { readonly sizeBytes: number };
}

export type CommandName = keyof CommandMap;
