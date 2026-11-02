/**
 * planets/catalog.ts — каталог планет среза v0.0.41.
 * ferrum — реальные данные (fixtures/planet_ferrum_v0.0.41.json); krios — сгенерирован
 * production-генератором (seed 13045769, f3, icosahedron, idx 2 — 1.x oi()), паритет с
 * fixtures/planet_krios_full.json подтверждён тестом (TV-11 закрыт, Этап 3).
 */
import type { CellType, GeometryId, PlanetData } from '../contracts/cells';
import type { ArmModifiers } from '../contracts/economy';
import type { BalanceConfig } from '../config/types';
import type { GeneratedPlanet } from '../contracts/planets';
import { loadBalance } from '../config/loader';
import { loadPlanetData, validatePlanetData, PlanetDataError_ } from './data';
import { buildPlanet, type GeneratorCtx } from './generator';
import ferrumJson from './data/planet_ferrum_v0.0.41.json';

export interface PlanetCatalog {
  readonly planets: ReadonlyMap<string, PlanetData>;
  get(id: string): PlanetData | undefined;
}

/** arms-таблица baseline (core/inter/forge/frost/life/void) → ArmModifiers (1.x Po). */
export function armsFromBalance(balance: BalanceConfig): Readonly<Record<string, ArmModifiers>> {
  return balance.baseline.galaxy.arms;
}

export function defaultGeneratorCtx(balance: BalanceConfig): GeneratorCtx {
  return { balance, arms: armsFromBalance(balance) };
}

/** 1.x oi(): параметры стартовых планет (seed/f/geometry — дословно из бандла). */
export const STARTER_PLANET_SPECS = Object.freeze({
  ferrum: Object.freeze({ id: 'ferrum', name: 'Феррум', seed: 15929600, f: 1, geometry: 'icosahedron', biome: 'ferrum', planetIndex: 1 } as const),
  krios: Object.freeze({ id: 'krios', name: 'Криос-9', seed: 13045769, f: 3, geometry: 'icosahedron', biome: 'krios', planetIndex: 2 } as const),
});

/** GeneratedPlanet → PlanetData (статический срез для каталога/валидации). */
export function toPlanetData(planet: GeneratedPlanet): PlanetData {
  return {
    id: planet.id,
    name: planet.name,
    seed: planet.seed,
    biome: planet.biome,
    geometry: planet.geometry as GeometryId,
    frequency: planet.f,
    planetIndex: planet.planetIndex,
    armId: planet.armId,
    role: planet.role,
    isUnique: planet.isUnique,
    descriptors: planet.descriptors,
    perks: planet.perks,
    resourceList: [...planet.resourceList],
    cells: planet.cells.map((c) => ({
      id: c.id,
      type: c.type as CellType,
      neighbors: [...c.neighbors],
      resourceKey: c.resourceKey,
      reserve: c.reserve,
    })),
    startingCellId: planet.startingCellId,
  };
}

export function buildCatalog(balance: BalanceConfig = loadBalance()): PlanetCatalog {
  const ferrum = loadPlanetData(ferrumJson);
  const planets = new Map<string, PlanetData>([[ferrum.id, ferrum]]);
  // krios — генератор 1:1 (oi(): конструктор без initStart/ni/Yf — armId остаётся null, explored/revealed пусты)
  const ctx = defaultGeneratorCtx(balance);
  const kriosGen = buildPlanet({ ...STARTER_PLANET_SPECS.krios }, ctx);
  const kriosData = toPlanetData(kriosGen);
  const v = validatePlanetData(kriosData);
  if (!v.ok) throw new PlanetDataError_(v.problems);
  planets.set(kriosData.id, kriosData);
  return {
    planets,
    get: (id) => planets.get(id),
  };
}
