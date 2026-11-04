/**
 * contracts/ports.ts — порты доменов (ADR-012: домены связаны только через порты; Game — единственный сборщик/DI).
 * Конкретные реализации (EventBus, ResourceLedger, TechState, ScanPricing, Logger, Rng) живут в core/доменах
 * и удовлетворяют портам структурно.
 */
import type { GameEventMap, GameEventName, EventHandler, TransactionRecord, TxScope, Unsubscribe } from './events';

export type { Unsubscribe };
import type { LedgerResourceKey, ResourceAmounts } from './resources';
import type { PlanetRuntime } from './planets';

export interface StoragePort {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  keys(): string[];
}

export interface ClockDriver {
  start(onFrame: (nowMs: number) => void): void;
  stop(): void;
}

export interface RngPort {
  next(): number;
  nextInt(minInclusive: number, maxExclusive: number): number;
  fork(label: string): RngPort;
  state(): number;
  hydrate(state: number): void;
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface LogSink {
  write(level: LogLevel, scope: string, message: string, data?: unknown): void;
}

/** Порт логгера для доменов (реализация — core/logger). */
export interface LogPort {
  debug(scope: string, message: string, data?: unknown): void;
  info(scope: string, message: string, data?: unknown): void;
  warn(scope: string, message: string, data?: unknown): void;
  error(scope: string, message: string, data?: unknown): void;
}

/** Порт типизированной шины (реализация — core/eventBus). */
export interface EventPort {
  on<E extends GameEventName>(event: E, handler: EventHandler<E>): Unsubscribe;
  once<E extends GameEventName>(event: E, handler: EventHandler<E>): Unsubscribe;
  emit<E extends GameEventName>(event: E, payload: GameEventMap[E]): void;
}

/** Транзакция ledger (данные — в contracts, реализация — economy/ledger). */
export interface CommitRequest {
  readonly reason: string;
  readonly scope: TxScope;
  readonly delta: ResourceAmounts;
  readonly gameMs: number;
}

export type CommitResult = { readonly ok: true; readonly tx: TransactionRecord } | { readonly ok: false; readonly insufficient: readonly LedgerResourceKey[] };

/** Порт балансов (реализация — economy/ledger ResourceLedger). */
export interface LedgerPort {
  balance(key: LedgerResourceKey): number;
  snapshot(): ResourceAmounts;
  tryCommit(req: CommitRequest): CommitResult;
  journal(): readonly TransactionRecord[];
}

/** Порт прогрессии/технологий (реализация — progression/tech TechState). */
export interface TechPort {
  isUnlocked(resourceKey: string): boolean;
  hasResearch(id: string): boolean;
  /** Этап 9.3: текущий уровень технологии/исследования (0 — не куплено). */
  level(id: string): number;
  costScaleMult(): number;
  /** Этап 9.3: множитель дохода железа/кристаллов/криогена (ironBoost/crystalBoost/kriogenBoost). */
  yieldMult(kind: 'iron' | 'crystal' | 'kriogen'): number;
  /** Этап 9.3: множитель кулдауна жил (therm). */
  veinCooldownMult(): number;
  /** Этап 9.3: множитель дохода жил (hyperdrill). */
  veinYieldMult(): number;
  /** Этап 9.3: множитель цены скана (recon). */
  scanCostMult(): number;
  /** Этап 9.3: бонус к потолку уровня клетки (maxLevel). */
  cellMaxLevelBonus(): number;
}

/** Порт ценообразования скана (реализация — progression/scanPricing ScanPricing). */
export interface ScanPricingPort {
  chargeFor(rt: PlanetRuntime): number;
  scienceFor(charge: number): number;
  advanceCurrentCost(): number;
  getCurrentCost(): number;
}

/** Подписка на тики (Game injects из GameClock; домены не знают про core). */
export type TickListener = (dtMs: number, gameMs: number) => void;

/** Статус доменов вне текущего среза (ТЗ §19: NOT_IMPLEMENTED с привязкой к этапу). */
export interface DomainStatus {
  readonly domain: string;
  readonly status: 'READY' | 'PARTIAL' | 'NOT_IMPLEMENTED';
  readonly stage: number;
  readonly note?: string;
}
