/**
 * planets/runtime.ts — runtime-состояние планет: explored/revealed (порядок вставки значим, GS-02) + cellStates.
 * Резервы жил и уровни — доменное состояние клетки, НЕ ledger (ADR-013).
 */
import type { CellState, PlanetData } from '../contracts/cells';
import { emptyCellState } from '../contracts/cells';
import type { PlanetRuntime } from '../contracts/planets';

export type { PlanetRuntime };

export function createPlanetRuntime(data: PlanetData, startExplored: readonly number[] = [], startRevealed: readonly number[] = []): PlanetRuntime {
  const cellStates = new Map<number, CellState>();
  for (const c of data.cells) {
    const st = emptyCellState();
    // жилы: стартовый резерв из данных (fixtures: ferrum cell1=126, cell10=191)
    if (c.type === 3 || c.type === 5) {
      st.maxReserve = c.reserve ?? 0;
      st.reserve = c.reserve ?? 0;
    }
    cellStates.set(c.id, st);
  }
  const rt: PlanetRuntime = { data, explored: new Set(startExplored), revealed: new Set(startRevealed), cellStates, origin: {} };
  return rt;
}

/** Стартовое состояние 1.x (initStart): explored=[start], revealed=[start, ...соседи в порядке списка] (GS-02). */
export function applyStartState(rt: PlanetRuntime): void {
  const start = rt.data.startingCellId;
  rt.explored.clear();
  rt.revealed.clear();
  rt.explored.add(start);
  rt.revealed.add(start);
  const cell = rt.data.cells[start];
  if (cell) for (const nb of cell.neighbors) rt.revealed.add(nb);
  // стартовая клетка активируется как после скана (1.x initStart → explored[0] с базовым yield)
  const st = rt.cellStates.get(start);
  if (st && rt.data.cells[start]?.type === 0) st.yield = 1;
}

export function isExplored(rt: PlanetRuntime, cellId: number): boolean {
  return rt.explored.has(cellId);
}

export function isRevealed(rt: PlanetRuntime, cellId: number): boolean {
  return rt.revealed.has(cellId);
}

export function cellState(rt: PlanetRuntime, cellId: number): CellState | undefined {
  return rt.cellStates.get(cellId);
}
