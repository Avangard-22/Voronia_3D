/** core/index.ts — экспорт ядра. */
export { EventBus, type EventBusOptions } from './eventBus';
export { GameClock, RafDriver, ManualDriver, type GameClockSnapshot, type TickListener } from './gameClock';
export { Logger } from './logger';
export { Rng } from './rng';
export { Game, DEFAULT_START_SEED_XOR, type GameOptions } from './game';
