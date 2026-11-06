import type { CellView } from '../contracts/snapshot';

export interface GeologicalSurveySummary {
  readonly depositsScanned: number;
  readonly activeDeposits: number;
  readonly reserve: number;
  readonly capacity: number;
  readonly byStratum: Readonly<Record<'regolith' | 'crust' | 'mantle' | 'core', number>>;
  readonly byQuality: Readonly<Record<'common' | 'enriched' | 'high-grade' | 'exceptional', number>>;
}

/** Build a read-only survey from explored cells only; hidden geology never enters the summary. */
export function buildGeologicalSurvey(cells: readonly CellView[]): GeologicalSurveySummary {
  const byStratum = { regolith: 0, crust: 0, mantle: 0, core: 0 };
  const byQuality = { common: 0, enriched: 0, 'high-grade': 0, exceptional: 0 };
  let depositsScanned = 0;
  let activeDeposits = 0;
  let reserve = 0;
  let capacity = 0;

  for (const cell of cells) {
    if (!cell.geology || (cell.type !== 3 && cell.type !== 5)) continue;
    depositsScanned += 1;
    byStratum[cell.geology.stratum] += 1;
    byQuality[cell.geology.oreQuality] += 1;
    reserve += Math.max(0, cell.reserve);
    capacity += Math.max(0, cell.maxReserve);
    if (cell.reserve > 0) activeDeposits += 1;
  }

  return { depositsScanned, activeDeposits, reserve, capacity, byStratum, byQuality };
}
