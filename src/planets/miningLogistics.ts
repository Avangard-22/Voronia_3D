import type { CellView } from '../contracts/snapshot';

export interface MiningLogisticsEntry {
  readonly cellId: number;
  readonly resource: 'Железо' | 'Криоген';
  readonly priority: number;
  readonly allocationPct: number;
  readonly reserve: number;
  readonly reservePct: number;
  readonly depletionPerSec: number;
  readonly lifetimeSeconds: number | null;
  readonly status: 'active' | 'cooldown' | 'depleted' | 'locked';
  readonly reason: string;
}

export interface MiningLogisticsPlan {
  readonly deposits: number;
  readonly active: number;
  readonly fleetAllocationPct: number;
  readonly entries: readonly MiningLogisticsEntry[];
}

const QUALITY_WEIGHT = { common: 1, enriched: 1.15, 'high-grade': 1.3, exceptional: 1.5 } as const;
const STRATUM_WEIGHT = { regolith: 1, crust: 1.05, mantle: 1.12, core: 1.2 } as const;

/** Read-only planning view. It never assigns real units or changes V1 production/economy. */
export function buildMiningLogistics(cells: readonly CellView[], gameMs = 0): MiningLogisticsPlan {
  const entries = cells.filter((c) => c.geology && (c.type === 3 || c.type === 5)).map((c) => {
    const reservePct = c.maxReserve > 0 ? Math.max(0, Math.min(100, c.reserve / c.maxReserve * 100)) : 0;
    const status: MiningLogisticsEntry['status'] = c.reserve <= 0 ? 'depleted' : c.cooldownUntil > gameMs ? 'cooldown' : c.miningOperations?.active === false ? 'locked' : c.depletionPerSec > 0 ? 'active' : 'locked';
    const quality = QUALITY_WEIGHT[c.geology!.oreQuality];
    const depth = STRATUM_WEIGHT[c.geology!.stratum];
    const reserveFactor = 0.35 + reservePct / 100 * 0.65;
    const priority = Math.round(quality * depth * reserveFactor * 100);
    const reason = status !== 'active'
      ? status === 'depleted' ? 'Запас исчерпан' : status === 'cooldown' ? 'Ожидание восстановления' : 'Добыча заблокирована'
      : c.geology!.oreQuality === 'exceptional' || c.geology!.oreQuality === 'high-grade' ? 'Высокое качество руды' : reservePct < 25 ? 'Низкий остаток — контролировать' : 'Стабильный добывающий участок';
    return { cellId: c.id, resource: c.type === 5 ? 'Криоген' as const : 'Железо' as const, priority, reserve: c.reserve, reservePct, depletionPerSec: c.depletionPerSec, lifetimeSeconds: c.reserveLifetimeSeconds, status, reason, weight: status === 'active' ? priority : 0 };
  });
  const totalWeight = entries.reduce((sum, entry) => sum + entry.weight, 0);
  const ranked = entries.map(({ weight, ...entry }) => ({ ...entry, allocationPct: totalWeight > 0 ? Math.round(weight / totalWeight * 1000) / 10 : 0 }));
  const activeRows = ranked.filter((entry) => entry.status === 'active');
  if (activeRows.length > 0) {
    const allocated = activeRows.slice(0, -1).reduce((sum, entry) => sum + entry.allocationPct, 0);
    const last = activeRows[activeRows.length - 1]!;
    const index = ranked.findIndex((entry) => entry.cellId === last.cellId);
    ranked[index] = { ...last, allocationPct: Math.max(0, Math.round((100 - allocated) * 10) / 10) };
  }
  ranked.sort((a, b) => b.priority - a.priority || a.cellId - b.cellId);
  return { deposits: ranked.length, active: ranked.filter((entry) => entry.status === 'active').length, fleetAllocationPct: ranked.some((entry) => entry.status === 'active') ? 100 : 0, entries: ranked };
}
