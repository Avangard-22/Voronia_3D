/**
 * persistence/index.ts — экспорт домена.
 */
export { SaveManager, type SaveSource, type SaveManagerDeps, type LoadResult } from './saveManager';
export { SAVE_VERSION, LEGACY_SAVE_VERSION, migrateLegacyV39, validateSaveV2, freshSaveV2, freshSession, type SaveGameV2, type SessionStats, type SerializedCellState, type SerializedPlanetState } from './schema';
export { SAVE_KEY, LEGACY_SAVE_KEY, MemoryStorage, LocalStorageAdapter } from './storage';
