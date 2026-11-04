/**
 * contracts/snapshot.ts — GameSnapshot: сериализуемое представление для UI (рендер ТОЛЬКО из снапшота,
 * STAGE1 §4: «UI рендерит из снапшотов и не тянет доменные объекты»).
 */
import type { AnomalyType } from './cells';
import type { ChargeStatus, SynthStatus } from './anomalies';
import type { ResourceAmounts } from './resources';
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
  readonly neighbors: readonly number[];
  readonly level: number;
  readonly yield: number;
  readonly reserve: number;
  readonly maxReserve: number;
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
  readonly cells: readonly CellView[];
  readonly exploredCount: number;
  readonly totalCount: number;
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
