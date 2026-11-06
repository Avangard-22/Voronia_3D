import type { GeneratedCell, GeneratedPlanet } from '../contracts/planets';

export type ContinentalClass = 0 | 1 | 2 | 3;
// 0 water, 1 island, 2 archipelago, 3 continent
export interface ContinentalTopology {
  readonly regionIds: Uint32Array;
  readonly classes: Uint8Array;
  /** 0..1: strongest at the coast, fades inland over three cell steps. */
  readonly coastalInfluence: Float32Array;
  /** 0..1: transition strength between unlike neighboring surface classes. */
  readonly biomeTransition: Float32Array;
  readonly landRegionCount: number;
  readonly waterRegionCount: number;
  readonly continentCount: number;
  readonly islandCount: number;
}

const isLand = (cell: GeneratedCell): boolean => cell.type !== 0;

/**
 * Reconstructs contiguous landmasses from the V1 cell-neighbour graph.
 * It is a visual/topological layer only: cell IDs, resources and save data are untouched.
 */
export function buildContinentalTopology(planet: Pick<GeneratedPlanet, 'cells'>): ContinentalTopology {
  const cells = planet.cells;
  const indexById = new Map<number, number>();
  cells.forEach((cell, index) => indexById.set(cell.id, index));
  const regionIds = new Uint32Array(cells.length);
  const classes = new Uint8Array(cells.length);
  const coastalInfluence = new Float32Array(cells.length);
  const biomeTransition = new Float32Array(cells.length);
  let nextRegion = 1;
  let landRegionCount = 0;
  let waterRegionCount = 0;
  let continentCount = 0;
  let islandCount = 0;

  for (let start = 0; start < cells.length; start++) {
    if (regionIds[start] !== 0) continue;
    const land = isLand(cells[start]!);
    const queue = [start];
    regionIds[start] = nextRegion;
    let head = 0;
    while (head < queue.length) {
      const current = queue[head++]!;
      for (const neighborId of cells[current]!.neighbors) {
        const neighbor = indexById.get(neighborId);
        if (neighbor === undefined || regionIds[neighbor] !== 0 || isLand(cells[neighbor]!) !== land) continue;
        regionIds[neighbor] = nextRegion;
        queue.push(neighbor);
      }
    }
    if (land) {
      landRegionCount++;
      const kind: ContinentalClass = queue.length >= 12 ? 3 : queue.length >= 4 ? 2 : 1;
      for (const index of queue) classes[index] = kind;
      if (kind === 3) continentCount++;
      else islandCount++;
    } else waterRegionCount++;
    nextRegion++;
  }

  // Coast cells are seeded from land cells touching water; influence propagates inward.
  const distance = new Int16Array(cells.length).fill(-1);
  const coastQueue: number[] = [];
  for (let i = 0; i < cells.length; i++) {
    if (!isLand(cells[i]!)) continue;
    const touchesWater = cells[i]!.neighbors.some((id) => {
      const neighbor = indexById.get(id);
      return neighbor !== undefined && !isLand(cells[neighbor]!);
    });
    if (touchesWater) { distance[i] = 0; coastQueue.push(i); }
  }
  let head = 0;
  while (head < coastQueue.length) {
    const current = coastQueue[head++]!;
    const nextDistance = distance[current]! + 1;
    if (nextDistance > 3) continue;
    for (const id of cells[current]!.neighbors) {
      const neighbor = indexById.get(id);
      if (neighbor === undefined || !isLand(cells[neighbor]!) || distance[neighbor] !== -1) continue;
      distance[neighbor] = nextDistance;
      coastQueue.push(neighbor);
    }
  }

  for (let i = 0; i < cells.length; i++) {
    const cell = cells[i]!;
    const neighbors = cell.neighbors.map((id) => indexById.get(id)).filter((v): v is number => v !== undefined);
    const unlike = neighbors.filter((n) => isLand(cells[n]!) !== isLand(cell)).length;
    biomeTransition[i] = neighbors.length ? unlike / neighbors.length : 0;
    if (isLand(cell) && distance[i]! >= 0) coastalInfluence[i] = Math.max(0, 1 - distance[i]! / 4);
    else if (!isLand(cell) && unlike > 0) coastalInfluence[i] = Math.min(1, unlike / Math.max(1, neighbors.length));
  }

  return { regionIds, classes, coastalInfluence, biomeTransition, landRegionCount, waterRegionCount, continentCount, islandCount };
}

/** Biome-aware shore tint: warm mineral shallows on land, lighter water at the boundary. */
export function continentalShoreTint(biome: string, land: boolean): readonly [number, number, number] {
  const palettes: Record<string, { land: [number, number, number]; water: [number, number, number] }> = {
    ferrum: { land: [0.72, 0.52, 0.31], water: [0.22, 0.56, 0.68] },
    krios: { land: [0.54, 0.72, 0.82], water: [0.24, 0.62, 0.78] },
    frozen: { land: [0.68, 0.82, 0.88], water: [0.28, 0.66, 0.82] },
    scorched: { land: [0.78, 0.42, 0.25], water: [0.46, 0.34, 0.30] },
    toxic: { land: [0.56, 0.72, 0.34], water: [0.28, 0.62, 0.48] },
    radioactive: { land: [0.68, 0.72, 0.30], water: [0.28, 0.64, 0.58] },
    oceanic: { land: [0.48, 0.72, 0.58], water: [0.18, 0.58, 0.78] },
    desert: { land: [0.84, 0.66, 0.38], water: [0.34, 0.56, 0.64] },
    crystal: { land: [0.68, 0.54, 0.86], water: [0.24, 0.62, 0.82] },
    metallic: { land: [0.62, 0.68, 0.72], water: [0.26, 0.54, 0.66] },
  };
  const fallback: { land: [number, number, number]; water: [number, number, number] } = { land: [0.64, 0.66, 0.60], water: [0.24, 0.58, 0.72] };
  const palette = palettes[biome] ?? fallback;
  return land ? palette.land : palette.water;
}
