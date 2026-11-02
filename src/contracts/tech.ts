/**
 * contracts/tech.ts — контракт состояния технологий/исследований (владелец — progression).
 * RESOURCE_UNLOCK — parity 1.x Kt() (fixtures/resources_research_v0.0.41.json).
 */

export interface TechLevels {
  readonly costScale: number;
  readonly ironBoost: number;
  readonly maxLevel: number;
  readonly crystalBoost: number;
  readonly kriogenBoost: number;
  readonly therm: number;
  readonly hyperdrill: number;
  readonly recon: number;
}

export const FRESH_TECH: TechLevels = Object.freeze({ costScale: 0, ironBoost: 0, maxLevel: 0, crystalBoost: 0, kriogenBoost: 0, therm: 0, hyperdrill: 0, recon: 0 });

/** researchUnlock из таблицы ресурсов: key → research id | null (null/отсутствие → открыт; iron — всегда). */
export const RESOURCE_UNLOCK: Readonly<Record<string, string | null>> = Object.freeze({
  iron: null,
  kriogen: 'unlock_kriogenBoost',
  carbon: 'unlock_carbon',
  silicon: 'unlock_silicon',
  titanium: 'unlock_titanium',
  uranium: 'unlock_uranium',
  darkMatter: 'unlock_darkMatter',
  helium3: null,
  biomass: null,
  platinum: null,
});
