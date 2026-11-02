/**
 * planets/data.ts — загрузка и валидация данных планеты (STAGE1 §1: уникальность id, симметрия соседства,
 * без self-loop, старт существует; битые данные отклоняются с кодами planet.*).
 */
import type { CellNode, PlanetData } from '../contracts/cells';

export const PLANET_DATA_ERRORS = ['planet.duplicate-cell-id', 'planet.self-loop', 'planet.asymmetric-neighbor', 'planet.unknown-neighbor', 'planet.no-start', 'planet.empty', 'planet.bad-index'] as const;
export type PlanetDataError = (typeof PLANET_DATA_ERRORS)[number];

export interface PlanetDataValidation {
  readonly ok: boolean;
  readonly problems: readonly { readonly code: PlanetDataError; readonly detail: string }[];
}

export function validatePlanetData(data: PlanetData): PlanetDataValidation {
  const problems: { code: PlanetDataError; detail: string }[] = [];
  if (data.cells.length === 0) problems.push({ code: 'planet.empty', detail: data.id });
  const ids = new Set<number>();
  for (const c of data.cells) {
    if (ids.has(c.id)) problems.push({ code: 'planet.duplicate-cell-id', detail: `${data.id}#${c.id}` });
    ids.add(c.id);
    if (c.id < 0 || c.id >= data.cells.length) problems.push({ code: 'planet.bad-index', detail: `${data.id}#${c.id}` });
    if (c.neighbors.includes(c.id)) problems.push({ code: 'planet.self-loop', detail: `${data.id}#${c.id}` });
    for (const nb of c.neighbors) {
      const other = data.cells[nb];
      if (!other) {
        problems.push({ code: 'planet.unknown-neighbor', detail: `${data.id}#${c.id}→${nb}` });
        continue;
      }
      if (!other.neighbors.includes(c.id)) problems.push({ code: 'planet.asymmetric-neighbor', detail: `${data.id}#${c.id}↔${nb}` });
    }
  }
  if (!ids.has(data.startingCellId)) problems.push({ code: 'planet.no-start', detail: `${data.id} start=${data.startingCellId}` });
  return { ok: problems.length === 0, problems };
}

export class PlanetDataError_ extends Error {
  constructor(readonly problems: readonly { code: string; detail: string }[]) {
    super('Данные планеты невалидны: ' + problems.map((p) => `${p.code} (${p.detail})`).join('; '));
    this.name = 'PlanetDataInvalid';
  }
}

/** Загрузка с fail-fast валидацией графа. */
export function loadPlanetData(raw: unknown): PlanetData {
  const data = normalizePlanetData(raw);
  const v = validatePlanetData(data);
  if (!v.ok) throw new PlanetDataError_(v.problems);
  return data;
}

type Json = Record<string, unknown>;

function num(v: unknown, fallback = 0): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function str(v: unknown, fallback = ''): string {
  return typeof v === 'string' ? v : fallback;
}

function normalizePlanetData(raw: unknown): PlanetData {
  if (typeof raw !== 'object' || raw === null) throw new PlanetDataError_([{ code: 'planet.empty', detail: 'не объект' }]);
  const r = raw as Json;
  const cellsRaw = Array.isArray(r['cells']) ? (r['cells'] as Json[]) : [];
  const cells: CellNode[] = cellsRaw.map((c, i) => ({
    id: num(c['id'], i),
    type: num(c['type'], 0) as CellNode['type'],
    neighbors: (Array.isArray(c['neighbors']) ? c['neighbors'] : []).map((x) => num(x, -1)).filter((x) => x >= 0),
    ...(typeof c['resourceKey'] === 'string' ? { resourceKey: c['resourceKey'] } : {}),
    ...(typeof c['reserve'] === 'number' ? { reserve: c['reserve'] } : {}),
  }));
  const descriptors = (r['descriptors'] ?? null) as PlanetData['descriptors'];
  const perksRaw = (r['perks'] ?? {}) as Json;
  return {
    id: str(r['id']),
    name: str(r['name']),
    seed: num(r['seed'], 0) >>> 0,
    biome: str(r['biome'], 'unknown'),
    geometry: (r['geometry'] ?? 'icosahedron') as PlanetData['geometry'],
    frequency: num(r['f'] ?? r['frequency'], 1),
    planetIndex: num(r['planetIndex'], 1),
    armId: str(r['armId']) || null,
    role: str(r['role']) || null,
    isUnique: Boolean(r['isUnique']),
    descriptors,
    perks: {
      depletionMult: num(perksRaw['depletionMult'], 1),
      scanCostMult: num(perksRaw['scanCostMult'], 1),
      upgradeCostMult: num(perksRaw['upgradeCostMult'], 1),
      energyBonus: num(perksRaw['energyBonus'], 1),
      ironBonus: num(perksRaw['ironBonus'], 1),
      kriogenBonus: num(perksRaw['kriogenBonus'], 1),
      meteorRate: num(perksRaw['meteorRate'], 1),
      rareChance: num(perksRaw['rareChance'], 1),
      anomalyChance: num(perksRaw['anomalyChance'], 1),
    },
    resourceList: Array.isArray(r['resourceList']) ? (r['resourceList'] as string[]) : [],
    cells,
    startingCellId: num(r['startingCellId'], 0),
  };
}
