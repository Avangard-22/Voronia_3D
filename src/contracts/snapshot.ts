/**
 * contracts/snapshot.ts — GameSnapshot: сериализуемое представление для UI (рендер ТОЛЬКО из снапшота,
 * STAGE1 §4: «UI рендерит из снапшотов и не тянет доменные объекты»).
 */
import type { AnomalyType } from './cells';
import type { ChargeStatus, SynthStatus } from './anomalies';
import type { ResourceAmounts, PlanetStorageResourceKey } from './resources';
import type { TransactionRecord } from './events';
import type { GraphNode } from './galaxy';
import type { GalaxyRoute } from './galaxy';
import type { LogisticsSnapshot } from './logistics';
import type { TechSnapshot } from './tech';
import type { ReactorView } from './crafting';

/** Статистика сессии (parity-подмножество 1.x n.gameSession; полные 40 полей — по мере подключения доменов). */
export interface SessionStats {
  startTime: number;
  activeSeconds: number;
  scanned: number;
  upgraded: number;
  deepMined: number;
  anomalies: number;
  techsBought: number;
  prestiges: number;
  planetsUnlocked: number;
  travels: number;
  warehouseUpgrades: number;
  eventsTriggered: number;
  /** Этап 4 (1.x gameSession): ручные разряды, авто-выбросы, тики синтеза. */
  chargesDone: number;
  surges: number;
  synthRuns: number;
}

export function freshSession(now: number): SessionStats {
  return { startTime: now, activeSeconds: 0, scanned: 0, upgraded: 0, deepMined: 0, anomalies: 0, techsBought: 0, prestiges: 0, planetsUnlocked: 0, travels: 0, warehouseUpgrades: 0, eventsTriggered: 0, chargesDone: 0, surges: 0, synthRuns: 0 };
}

export type CellViewStatus = 'explored' | 'revealed' | 'hidden';

export interface CellView {
  readonly id: number;
  readonly type: number;
  readonly status: CellViewStatus;
  /** Геологическая награда раскрывается только после успешного сканирования. */
  readonly geologicalReward: { readonly resourceKey: string; readonly baseRate: number; readonly secondaryResourceKey?: string; readonly secondaryBaseRate?: number } | null;
  /** Геологический паспорт открытой жилы; описательные параметры без изменения формул экономики. */
  readonly geology: { readonly depth: 'surface' | 'shallow' | 'deep' | 'abyssal'; readonly depthMeters: number; readonly oreQuality: 'common' | 'enriched' | 'high-grade' | 'exceptional'; readonly qualityPct: number; readonly stratum: 'regolith' | 'crust' | 'mantle' | 'core'; readonly layerIndex: number } | null;
  readonly neighbors: readonly number[];
  readonly level: number;
  readonly yield: number;
  readonly reserve: number;
  readonly maxReserve: number;
  /** Текущая скорость истощения резерва; 0 если добыча остановлена/заблокирована. */
  readonly depletionPerSec: number;
  /** Оценка секунд до истощения; null если жила не добывается. */
  readonly reserveLifetimeSeconds: number | null;
  /** Расшифровка множителей и рекомендация по оптимизации добычи; null до сканирования/для не-жил. */
  readonly miningOperations: { readonly active: boolean; readonly totalMultiplier: number; readonly factors: readonly { readonly id: string; readonly label: string; readonly multiplier: number }[]; readonly recommendation: string } | null;
  readonly cooldownUntil: number;
  readonly reactCount: number;
  readonly anomalyType: AnomalyType | null;
  readonly mutant: string | null;
  readonly isDeep: boolean;
  /** Этап 4: кулдаун разряда (gameMs; 0 — доступен), когда-либо заряжалась. */
  readonly chargeCooldownUntil: number;
  readonly chargedEver: boolean;
}

export interface PlanetView {
  readonly id: string;
  readonly name: string;
  readonly biome: string;
  readonly planetIndex: number;
  readonly armId: string | null;
  /** V1 On/yy: local ore and rare-resource stock assigned to this planet. */
  readonly storage: Readonly<Partial<Record<PlanetStorageResourceKey, number>>>;
  readonly cells: readonly CellView[];
  readonly exploredCount: number;
  readonly totalCount: number;
  /** Stage 10.0.9: aggregate survey of scanned ore deposits only. */
  readonly miningLogistics: {
    readonly deposits: number;
    readonly active: number;
    readonly fleetAllocationPct: number;
    readonly entries: readonly { readonly cellId: number; readonly resource: 'Железо' | 'Криоген'; readonly priority: number; readonly allocationPct: number; readonly reserve: number; readonly reservePct: number; readonly depletionPerSec: number; readonly lifetimeSeconds: number | null; readonly status: 'active' | 'cooldown' | 'depleted' | 'locked'; readonly reason: string }[];
  };
  readonly geologicalSurvey: {
    readonly depositsScanned: number;
    readonly activeDeposits: number;
    readonly reserve: number;
    readonly capacity: number;
    readonly byStratum: Readonly<Record<'regolith' | 'crust' | 'mantle' | 'core', number>>;
    readonly byQuality: Readonly<Record<'common' | 'enriched' | 'high-grade' | 'exceptional', number>>;
  };
}

export interface GameSnapshot {
  readonly gameMs: number;
  readonly paused: boolean;
  readonly resources: ResourceAmounts;
  readonly perSec: {
    readonly energy: number;
    readonly iron: number;
    readonly kriogen: number;
    readonly crystals: number;
    readonly research: number;
  };
  readonly activePlanetId: string;
  readonly unlockedPlanets: readonly string[];
  readonly planets: readonly PlanetView[];
  readonly scan: { readonly currentCost: number; readonly charge: number };
  readonly logistics: LogisticsSnapshot;
  readonly warehouse: {
    readonly level: number;
    readonly maxLevel: number;
    readonly tonsPerCell: number;
    readonly bonusMult: number;
    readonly storageCapacity: number;
    readonly storedMass: number;
    readonly remainingCapacity: number;
    readonly nextCost: { readonly alloy: number; readonly energy: number } | null;
  };
  readonly session: SessionStats;
  readonly journal: readonly TransactionRecord[];
  /** Этап 4: бафф зарядов активной планеты (1.x a0) + сонар-заряды (1.x n.sonarCharges, кап sonar.chargeMax). */
  readonly charge: ChargeStatus | null;
  readonly sonarCharges: number;
  readonly sonar: { readonly available: boolean; readonly cost: number; readonly targetName: string; readonly targetBiome: string; readonly targetResources: readonly string[]; readonly bonusMult: number; readonly bonusLeftMs: number; readonly bonusAccuracy: number | null; readonly discoveryCost: number; readonly discoveryCharges: number; readonly rerollCost: number; readonly rerolls: number; readonly rerollsRemaining: number; readonly anomalyGate: { readonly unlocked: boolean; readonly discoveredWorlds: number; readonly requiredWorlds: number; readonly discoveredArms: number; readonly requiredArms: number; readonly research: number; readonly requiredResearch: number; readonly missing: readonly ('worlds' | 'arms' | 'research')[] }; readonly nextPreview: { readonly id: string; readonly index: number; readonly name: string; readonly biome: string; readonly geometry: string; readonly resources: readonly string[]; readonly seed: number; readonly signalClass: 'anomaly' | 'energy' | 'cryo' | 'resource' | 'unknown'; readonly sectorId: 'core' | 'inner' | 'mid' | 'outer'; readonly sectorLabel: string } | null };
  readonly synth: SynthStatus | null;
  /** Этап 9.3 (Этап 7 ТЗ): дерево исследований — узлы с уровнями/ценами/доступностью. */
  readonly tech: TechSnapshot;
  /** Этап 9.3 (Этап 8 ТЗ): реактор — рецепты, очередь, idle («Реактор в покое…»). */
  readonly reactor: ReactorView;
  /** Этап 5: граф галактики (1.x ge.PlanetaryGraph) — узлы c позициями/рукавами и рёбра. */
  readonly galaxy: {
    readonly nodes: readonly (GraphNode & { readonly signalClass: 'anomaly' | 'energy' | 'cryo' | 'resource' | 'unknown'; readonly mapX: number; readonly mapY: number; readonly sectorId: 'core' | 'inner' | 'mid' | 'outer'; readonly sectorLabel: string })[];
    readonly edges: readonly (readonly [string, string])[];
    readonly discoveredCount: number;
    readonly milestone: { readonly current: number; readonly next: number; readonly progress: number };
    readonly sectors: readonly { readonly id: 'core' | 'inner' | 'mid' | 'outer'; readonly label: string; readonly discovered: number }[];
    readonly discoveredArms: readonly string[];
    readonly progression: {
      readonly completed: number; readonly total: number; readonly discountPct: number;
      readonly stages: readonly { readonly id: string; readonly name: string; readonly description: string; readonly unlocked: boolean; readonly requirements: { readonly worlds: { readonly current: number; readonly required: number }; readonly arms: { readonly current: number; readonly required: number }; readonly sectors: { readonly current: number; readonly required: number }; readonly research: { readonly current: number; readonly required: number } }; readonly discoveryDiscountPct: number }[];
      readonly nextStage: { readonly id: string; readonly name: string; readonly description: string; readonly unlocked: boolean; readonly requirements: { readonly worlds: { readonly current: number; readonly required: number }; readonly arms: { readonly current: number; readonly required: number }; readonly sectors: { readonly current: number; readonly required: number }; readonly research: { readonly current: number; readonly required: number } }; readonly discoveryDiscountPct: number } | null;
    };
    readonly routes: readonly GalaxyRoute[];
    readonly routePolicy: { readonly energyPerDistance: number; readonly freightEnergyPerMassDistance: number; readonly sectorSurcharge: Readonly<Record<'core' | 'inner' | 'mid' | 'outer', number>>; readonly anomalyMultiplier: number };
    readonly anomalies: readonly { readonly id: string; readonly planetId: string; readonly planetName: string; readonly kind: 'rift' | 'echo' | 'singularity' | 'living-void'; readonly title: string; readonly tier: number; readonly discovered: boolean; readonly resolved: boolean; readonly available: boolean; readonly energyCost: number; readonly researchCost: number; readonly reward: { readonly darkMatter: number; readonly relic: number; readonly essence: number } }[];
  };
}
