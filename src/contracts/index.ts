/** contracts/index.ts — единая точка экспорта контрактов (ADR-012: contracts не импортирует ничего из проекта). */
export * from './resources';
export * from './cells';
export * from './events';
export * from './commands';
export * from './ports';
export * from './economy';
export * from './snapshot';
export * from './planets';
export * from './tech';
export * from './galaxy';
export * from './logistics';

/** Идентификатор активного баланс-набора (ADR-011). */
export const BALANCE_ID = 'v0.0.41';

/** Версия схемы сейва 2.0 (v2: полные cellStates + warehouse + tech; читает и мигрирует v1). */
export const SAVE_FORMAT = 'voronia2.save';
export const SAVE_VERSION = 2;

/** Версия игры (2.0 линия; baseline parity — wo=0.0.41.0, schema 39). */
export const GAME_VERSION = '2.0.0-stage2';
export const BASELINE_VERSION = '0.0.41.0';
export const BASELINE_SAVE_SCHEMA = 39;

/** Лимит уровня клетки (GS-01: MAX_LEVEL=100 ↔ limits.maxCellLevel). */
export const MAX_CELL_LEVEL = 100;
