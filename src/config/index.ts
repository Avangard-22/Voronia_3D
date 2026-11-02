/** config/index.ts — экспорт домена конфигурации. */
export { loadBalance, validateRegistry, validateBaseline, buildRegistryView, BalanceValidationError } from './loader';
export type { BalanceConfig, BaselineConfig, RegistryView, RegistryCellsSection, RegistryTechSection, RegistryWarehouseSection, RegistryPlanetSection, RegistryEcoSection, RegistryCoreSection, RegistryGalaxySection, RegistryBusSection, RegistryHygieneSection, RegistryOfflineSection, RegistrySaveSection, RegistryChargeSection, UpgradeCurveEntry } from './types';
