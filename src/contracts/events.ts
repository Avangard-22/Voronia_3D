/**
 * contracts/events.ts — типизированная шина событий (ADR-013; имена шины — parity 1.x: `cell:scanned`, `cell:upgraded`).
 */
import type { AnomalyType } from './cells';
import type { ResourceAmounts } from './resources';

export type TxScope = 'global' | `planet:${string}`;

export interface TransactionRecord {
  readonly id: number;
  readonly reason: string;
  readonly scope: TxScope;
  readonly delta: Readonly<ResourceAmounts>;
  readonly gameMs: number;
}

export interface GameEventMap {
  'cell:scanned': {
    readonly pid: string;
    readonly cellId: number;
    readonly type: number;
    readonly cost: number;
    readonly anomalyType?: AnomalyType | null;
  };
  'cell:upgraded': { readonly pid: string; readonly cellId: number; readonly level: number; readonly type: number; readonly deepUnlocked?: boolean };
  'cell:reactivated': { readonly pid: string; readonly cellId: number; readonly reactCount: number; readonly cost: number };
  'cell:depleted': { readonly pid: string; readonly cellId: number; readonly cooldownUntil: number };
  /** 1.x i0(): ручной разряд жилы type1/2 (заряды — Этап 4). */
  'cell:discharged': { readonly pid: string; readonly cellId: number; readonly type: number; readonly science: number; readonly buffPct: number };
  /** 1.x v0.0.39.0 surge-планировщик: автоматический энергетический выброс. */
  'cell:surge': { readonly pid: string; readonly cellId: number; readonly type: number; readonly duration: number; readonly pct: number };
  'cell:branchChosen': { readonly pid: string; readonly cellId: number; readonly branch: AnomalyType };
  'cell:anomalyUpgraded': { readonly pid: string; readonly cellId: number; readonly level: number; readonly deepConverted: boolean };
  'synth:produced': { readonly pid: string; readonly product: string; readonly amount: number; readonly inputConsumed: number };
  'tx:committed': { readonly tx: TransactionRecord };
  'tx:rejected': { readonly reason: string; readonly scope: TxScope; readonly delta: Readonly<ResourceAmounts> };
  'planet:discovered': { readonly id: string; readonly index: number; readonly name: string };
  /** Этап 5: переключение активной планеты (1.x ge.setActivePlanet — без bus-события; 2.0-инфраструктурное). */
  'planet:activated': { readonly pid: string; readonly prev: string };
  'warehouse:upgraded': { readonly level: number };
  'game:saved': { readonly saveVersion: number; readonly at: number };
  'game:loaded': { readonly saveVersion: number };
  'game:tick': { readonly dtMs: number; readonly gameMs: number };
}

export type GameEventName = keyof GameEventMap;

export type EventPayload<E extends GameEventName> = GameEventMap[E];

export type EventHandler<E extends GameEventName> = (payload: EventPayload<E>) => void;

export type Unsubscribe = () => void;

/** История шины (кольцевая; cap — registry bus.historyCap=50, GS-12). */
export interface BusHistoryEntry {
  readonly type: GameEventName;
  readonly at: number;
  readonly detail: unknown;
}
