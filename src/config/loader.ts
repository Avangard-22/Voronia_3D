/**
 * config/loader.ts — загрузчик баланс-набора (ADR-011: только версионированные наборы).
 * Runtime-валидация fail-fast: собирает СПИСОК проблемных путей и бросает одним списком (STAGE1 §1).
 */
import type { BalanceConfig, BaselineConfig, RegistryView } from './types';
import registryJson from './data/balance/v0.0.41/registry.json';
import baselineJson from './data/balance/v0.0.41/baseline.json';

type Json = unknown;

function isRecord(v: Json): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

interface Problem {
  readonly path: string;
  readonly problem: string;
}

function resolve(root: Json, path: string): Json {
  let cur: Json = root;
  for (const part of path.split('.')) {
    if (!isRecord(cur) || !(part in cur)) return undefined;
    cur = cur[part];
  }
  return cur;
}

class Validator {
  readonly problems: Problem[] = [];
  constructor(private readonly root: Json) {}

  number(path: string, opts: { min?: number; integer?: boolean } = {}): number {
    const v = resolve(this.root, path);
    if (typeof v !== 'number' || !Number.isFinite(v)) {
      this.problems.push({ path, problem: `ожидалось конечное число, получено ${JSON.stringify(v)}` });
      return Number.NaN;
    }
    if (opts.min !== undefined && v < opts.min) this.problems.push({ path, problem: `значение ${v} < min ${opts.min}` });
    if (opts.integer && !Number.isInteger(v)) this.problems.push({ path, problem: `ожидалось целое, получено ${v}` });
    return v;
  }

  record(path: string): Record<string, unknown> {
    const v = resolve(this.root, path);
    if (!isRecord(v)) {
      this.problems.push({ path, problem: `ожидался объект, получено ${JSON.stringify(v)}` });
      return {};
    }
    return v;
  }

  array(path: string): unknown[] {
    const v = resolve(this.root, path);
    if (!Array.isArray(v)) {
      this.problems.push({ path, problem: `ожидался массив, получено ${JSON.stringify(v)}` });
      return [];
    }
    return v;
  }
}

/** Обязательные пути реестра для среза Этапов 1–3 (GS-12: значения сверяются тестом config). */
const REQUIRED_REGISTRY_PATHS = [
  'bus.historyCap',
  'cells.curveGrowth',
  'cells.curveGrowthCap',
  'cells.curveGrowthAfterCap',
  'cells.deepUpgradeCurve',
  'cells.researchMaxLevel',
  'cells.researchPerLevel',
  'cells.researchCellCost.energyBase',
  'cells.researchCellCost.energyGrowth',
  'core.baseYield',
  'core.reactivate.max',
  'core.reactivate.step',
  'dispatch.batchEnergy',
  'dispatch.batchIron',
  'eco.deficit.start',
  'eco.deplete.start',
  'galaxy.arms.arms',
  'galaxy.arms.b',
  'galaxy.arms.r0',
  'galaxy.arms.width',
  'galaxy.gen.armBias',
  'galaxy.gen.starterZoneR',
  'galaxy.gen.starterExclusionR',
  'galaxy.gen.outerRadius',
  'galaxy.gen.maxTries',
  'galaxy.nodeRender.MIN_DIST',
  'galaxy.nodeRender.THICK',
  'events.polarityWeights',
  'planet.uniqueChance',
  'planet.specialCellChance',
  'planet.tierThresholds',
  'planet.resourceDist.ironWeight',
  'planet.resourceDist.kriogenWeight',
  'planet.resourceDist.slots',
  'planet.lastVoronia.index',
  'planet.lastVoronia.resources',
  'roles.defs.crafter.id',
  'roles.defs.feeder.id',
  'roles.defs.scholar.id',
  'roles.costGrowthPerDuplicate',
  'events.polarityWeights.meteor_storm.polarity',
  'hygiene.autosaveMs',
  'offline.maxSeconds',
  'offline.efficiency',
  'planet.biomeMults.ferrum.mult',
  'planet.biomeMults.krios.mult',
  'warehouse.baseTons',
  'warehouse.tonsPerLevel',
  'warehouse.bonusPerLevel',
  'warehouse.energyCostBase',
  'warehouse.energyCostGrowth',
  'warehouse.alloyCostFactor',
  'warehouse.upgradeMax',
  'cells.upgradeCurve',
  'cells.hardcore.fromLevel',
  'cells.reactCooldownBaseMs',
  'cells.reactCooldownPerCntMs',
  'tech.costScaleCurve.costScale',
  'transport.config.basePerSec',
  'transport.config.inputPerOutput',
  'transport.config.offlineCapMult',
  'transport.config.maxLevel',
  'transport.config.deepMult',
  'sonar.chargeMax',
] as const;

const REQUIRED_BASELINE_PATHS = [
  'scan.baseCost',
  'scan.growthMin',
  'scan.growthMax',
  'scan.scienceFromChargeDivisor',
  'anomaly.energyInstantReward',
  'upgrade.baseCurve',
  'upgrade.maxLevel',
  'cells.researchPerType0Cell',
  'veins.cooldownBaseMs',
  'veins.cooldownStepMs',
  'veins.reactivationBaseEnergy',
  'start.activePlanetId',
  'start.ferrumRevealed',
  'research.exhaustedMult',
  'anomalyUpgrade.ironBase',
  'anomalyUpgrade.energyBase',
  'anomalyUpgrade.deepEnergy',
  'anomalyUpgrade.deepMaterial',
  'anomalyIncome.powerBase',
  'anomalyIncome.resonanceBase',
  'anomalyIncome.type0DeepCrystal',
  'synth.rareOffset',
  'surge.intervalMs',
  'surge.bonusMultType1',
  'surge.bonusMultType2',
] as const;

export class BalanceValidationError extends Error {
  constructor(readonly problems: readonly Problem[]) {
    super(`Баланс-набор невалиден (${problems.length} проблем):\n` + problems.map((p) => `  - ${p.path}: ${p.problem}`).join('\n'));
    this.name = 'BalanceValidationError';
  }
}

export function validateRegistry(raw: Json): Problem[] {
  const v = new Validator(raw);
  for (const path of REQUIRED_REGISTRY_PATHS) {
    if (resolve(raw, path) === undefined) v.problems.push({ path, problem: 'обязательный путь отсутствует' });
  }
  v.number('bus.historyCap', { min: 1, integer: true });
  v.number('warehouse.upgradeMax', { min: 1, integer: true });
  v.number('offline.maxSeconds', { min: 60 });
  v.number('core.reactivate.max', { min: 1 });
  v.number('core.reactivate.step', { min: 0 });
  if (!Array.isArray(resolve(raw, 'cells.deepUpgradeCurve'))) v.problems.push({ path: 'cells.deepUpgradeCurve', problem: 'ожидался массив' });
  return v.problems;
}

export function validateBaseline(raw: Json): Problem[] {
  const v = new Validator(raw);
  for (const path of REQUIRED_BASELINE_PATHS) {
    if (resolve(raw, path) === undefined) v.problems.push({ path, problem: 'обязательный путь отсутствует' });
  }
  v.number('scan.baseCost', { min: 1 });
  v.number('scan.growthMin', { min: 1 });
  v.number('scan.growthMax', { min: 1 });
  const curve = v.array('upgrade.baseCurve');
  if (curve.length === 0) v.problems.push({ path: 'upgrade.baseCurve', problem: 'кривая пуста' });
  return v.problems;
}

/** Сборка типизированного представления (registryView). */
export function buildRegistryView(raw: Json): RegistryView {
  const r = (raw ?? {}) as Record<string, unknown>;
  const sec = <T,>(key: string, fallback: unknown = {}): T => (r[key] ?? fallback) as T;
  return {
    bus: sec<RegistryView['bus']>('bus'),
    cells: sec<RegistryView['cells']>('cells'),
    charge: sec<RegistryView['charge']>('charge'),
    core: sec<RegistryView['core']>('core'),
    dispatch: sec<RegistryView['dispatch']>('dispatch'),
    eco: sec<RegistryView['eco']>('eco'),
    events: sec<RegistryView['events']>('events'),
    galaxy: sec<RegistryView['galaxy']>('galaxy'),
    hygiene: sec<RegistryView['hygiene']>('hygiene'),
    offline: sec<RegistryView['offline']>('offline'),
    planet: sec<RegistryView['planet']>('planet'),
    roles: sec<RegistryView['roles']>('roles'),
    save: sec<RegistryView['save']>('save'),
    transport: sec<RegistryView['transport']>('transport'),
    sonar: sec<RegistryView['sonar']>('sonar'),
    tech: sec<RegistryView['tech']>('tech'),
    warehouse: sec<RegistryView['warehouse']>('warehouse'),
    raw: r,
  };
}

export function loadBalance(): BalanceConfig {
  const problems = [...validateRegistry(registryJson), ...validateBaseline(baselineJson)];
  if (problems.length > 0) throw new BalanceValidationError(problems);
  return {
    balanceId: 'v0.0.41',
    registry: buildRegistryView(registryJson),
    baseline: baselineJson as BaselineConfig,
  };
}
