/** economy/index.ts — экспорт домена экономики. */
export { ResourceLedger, JOURNAL_CAP, type CommitRequest, type CommitResult } from './ledger';
export { IncomeService, energyYieldBase, type IncomeContext, type IncomeDetail, type IncomeHook } from './income';
export { ProductionService, veinLevelDepleteMult, planetIndexDepleteMult, type ProductionDeps } from './production';
export { CellUpgradeService, curveEntry, levelProfile, researchCellCost, levelReward, type UpgradeDeps } from './upgrades';
export { WarehouseService, type WarehouseDeps } from './warehouse';
export { EconomyTicker, type TickerDeps } from './ticker';
export { chain, compoundFactor, warehouseFactor, CORE_ARM, INTER_ARM, type ArmModifiers, type ModifierSources, type NamedChain } from './modifiers';
