/**
 * contracts/crafting.ts — контрактные типы реактора/крафта (Этап 9.3, Этап 8 ТЗ).
 *
 * Доменные типы живут в контрактах (прецедент SynthStatus): snapshot/UI зависят
 * только от contracts, а crafting/reactor.ts реализует и реэкспортирует их.
 */
import type { ResourceAmounts } from './resources';

/** Рецепт в UI-представлении: входы/время/выход + гейт исследованиями. */
export interface ReactorRecipeView {
  readonly id: string;
  readonly inputs: ResourceAmounts;
  readonly timeSec: number;
  readonly output: ResourceAmounts;
  readonly gate: string | null;
  readonly unlocked: boolean;
}

/** Задача очереди в UI-представлении (ТЗ §6: явное состояние — running/deficit/queued). */
export interface ReactorJobView {
  readonly id: number;
  readonly recipeId: string;
  readonly runs: number;
  readonly done: number;
  readonly progressPct: number;
  readonly etaSec: number | null;
  readonly state: 'running' | 'deficit' | 'queued';
}

/** Полный срез реактора для снапшота (ТЗ §6: «Реактор в покое…» — idle). */
export interface ReactorView {
  readonly slots: number;
  readonly idle: boolean;
  readonly queue: readonly ReactorJobView[];
  readonly recipes: readonly ReactorRecipeView[];
}

/** Персистентная форма задачи (SaveGameV2.reactor — ТЗ §6: очередь/прогресс сохраняются). */
export interface ReactorJobSave {
  readonly id?: number;
  readonly recipeId?: string;
  readonly runs?: number;
  readonly done?: number;
  readonly progressMs?: number;
  readonly paidForCurrent?: boolean;
  readonly deficit?: boolean;
}

/** Персистентная форма реактора. */
export interface ReactorSave {
  readonly jobs?: readonly ReactorJobSave[];
  readonly nextJobId?: number;
}
