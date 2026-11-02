/**
 * renderer/planetMesh.ts — чистый построитель меш-данных планеты (Этап 5, вердикт: «сфера → поли-сетка → граф соседства»).
 * Вход — GeneratedPlanet (клетки c center/poly — 1.x Nn-триангуляция; палитра explored/unexplored по типам).
 * Выход — типизированные массивы для THREE.BufferGeometry/InstancedMesh/LineSegments (renderer/scene.ts).
 * Никакого DOM/Three — тестируется в node (tests/stage5_renderer.test.ts), детерминирован.
 */
import type { GeneratedPlanet } from '../contracts/planets';

/** CSS-цвет палитры 1.x (`#rrggbb` | `hsl(h, s%, l%)`) → rgb 0..1. */
export function parseColor(css: string): [number, number, number] {
  const t = css.trim();
  if (t.startsWith('#')) {
    const h = t.slice(1);
    const v = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
    const n = parseInt(v, 16);
    if (Number.isFinite(n) && (v.length === 6 || v.length === 3)) {
      return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
    }
    return [1, 1, 1];
  }
  const m = /^hsla?\(\s*([-\d.]+)\s*(?:deg)?\s*,\s*([\d.]+)%\s*,\s*([\d.]+)%/.exec(t);
  if (m) {
    const h = ((Number(m[1]) % 360) + 360) % 360 / 360;
    const s = Math.min(1, Math.max(0, Number(m[2]) / 100));
    const l = Math.min(1, Math.max(0, Number(m[3]) / 100));
    // стандартный HSL→RGB (hue2rgb)
    if (s === 0) return [l, l, l];
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    const hue = (tt: number): number => {
      let x = tt;
      if (x < 0) x += 1;
      if (x > 1) x -= 1;
      if (x < 1 / 6) return p + (q - p) * 6 * x;
      if (x < 1 / 2) return q;
      if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
      return p;
    };
    return [hue(h + 1 / 3), hue(h), hue(h - 1 / 3)];
  }
  return [1, 1, 1]; // неизвестный формат — белый (fail-visible, как 1.x «нет цвета»)
}

export interface PlanetMeshData {
  /** Треугольники рельефных участков клеток: xyz*3n. */
  readonly positions: Float32Array;
  /** per-vertex rgb граней (explored/unexplored палитра по типу). */
  readonly colors: Float32Array;
  /** Базовые центры клеток на сфере: xyz*n. */
  readonly cellCenters: Float32Array;
  /** Центры визуальной поверхности клеток с радиальным смещением для маркеров/выделения. */
  readonly cellSurfaceCenters: Float32Array;
  /** Высота рельефа клетки относительно базовой сферы (может быть отрицательной для энергетических впадин). */
  readonly cellHeights: Float32Array;
  /** rgb центров клеток. */
  readonly cellColors: Float32Array;
  /** Идентификатор клетки для каждого центра (не предполагаем id === индекс). */
  readonly cellIds: Uint32Array;
  /** Идентификатор клетки для каждого треугольника surface mesh (faceIndex → cellId). */
  readonly faceCellIds: Uint32Array;
  /** Граф соседства (1.x _neighbors): отрезки xyz*2*m. */
  readonly edgePositions: Float32Array;
  readonly facetCount: number;
  readonly cellCount: number;
  readonly edgeCount: number;
  /** Максимальный радиус построенного рельефа (базовая сфера около 1). */
  readonly radius: number;
}

export interface MeshBuildOptions {
  /** Исследованные клетки (runtime); без опции — все клетки в explored-палитре. */
  readonly explored?: ReadonlySet<number>;
  /** Текущие уровни клеток из PlanetRuntime.cellStates; отсутствующие уровни считаются нулевыми. */
  readonly cellLevels?: ReadonlyMap<number, number>;
}

interface ReliefProfile { readonly base: number; readonly perLevel: number; readonly exponent: number; readonly style: 'dome' | 'crystal' | 'ridge' | 'basin' | 'spire' | 'lattice' | 'core'; readonly terraces: number; readonly spikes: number; }

/** Разные морфологии поверхности для типов клеток Voronia; величины — доли радиуса планеты. */
const UNKNOWN_RELIEF: ReliefProfile = { base: 0.0015, perLevel: 0, exponent: 1.2, style: 'dome', terraces: 0, spikes: 0 };

const RELIEF: Readonly<Record<number, ReliefProfile>> = Object.freeze({
  0: { base: -0.016, perLevel: -0.0010, exponent: 1.25, style: 'basin', terraces: 2, spikes: 0 },
  1: { base: 0.010, perLevel: 0.0026, exponent: 1.35, style: 'dome', terraces: 2, spikes: 0 },
  2: { base: 0.024, perLevel: 0.0052, exponent: 2.15, style: 'crystal', terraces: 3, spikes: 3 },
  3: { base: 0.016, perLevel: 0.0030, exponent: 1.05, style: 'ridge', terraces: 5, spikes: 0 },
  4: { base: 0.030, perLevel: 0.0058, exponent: 1.55, style: 'spire', terraces: 4, spikes: 5 },
  5: { base: 0.014, perLevel: 0.0024, exponent: 1.25, style: 'dome', terraces: 3, spikes: 0 },
  6: { base: 0.020, perLevel: 0.0034, exponent: 1.65, style: 'lattice', terraces: 4, spikes: 2 },
  7: { base: 0.028, perLevel: 0.0044, exponent: 1.45, style: 'core', terraces: 4, spikes: 4 },
});

function radialPoint(v: readonly number[], radius: number): [number, number, number] {
  const length = Math.hypot(v[0]!, v[1]!, v[2]!) || 1;
  const scale = radius / length;
  return [v[0]! * scale, v[1]! * scale, v[2]! * scale];
}

function reliefHeight(type: number, level: number): number {
  const profile = RELIEF[type] ?? RELIEF[3]!;
  const safeLevel = Math.max(0, Math.min(30, Number.isFinite(level) ? level : 0));
  // Рост насыщается постепенно: высокий уровень заметен, но не превращает клетку в иглу бесконечной высоты.
  const growth = Math.sqrt(safeLevel);
  return profile.base + profile.perLevel * growth * 3.2;
}

function localFrame(center: readonly number[]): { normal: [number, number, number]; tangent: [number, number, number]; bitangent: [number, number, number] } {
  const normal = radialPoint(center, 1);
  const ref: [number, number, number] = Math.abs(normal[1]) < 0.88 ? [0, 1, 0] : [1, 0, 0];
  const cross = (a: readonly number[], b: readonly number[]): [number, number, number] => [a[1]! * b[2]! - a[2]! * b[1]!, a[2]! * b[0]! - a[0]! * b[2]!, a[0]! * b[1]! - a[1]! * b[0]!];
  const tangent = radialPoint(cross(ref, normal), 1);
  const bitangent = radialPoint(cross(normal, tangent), 1);
  return { normal, tangent, bitangent };
}

function addRadialSpire(
  addTriangle: (a: readonly number[], b: readonly number[], c: readonly number[], rgb: readonly number[], cellId: number) => void,
  center: readonly number[], height: number, rgb: readonly number[], cellId: number, seed: number, scale: number,
): void {
  const frame = localFrame(center);
  const angle = seed * 2.399963229728653;
  const offset = scale * 0.24;
  const baseRadius = scale * 0.20;
  const base: [number, number, number][] = [];
  for (let i = 0; i < 3; i++) {
    const a = angle + i * Math.PI * 2 / 3;
    const tangentOffset = offset + Math.cos(a) * baseRadius;
    const bitangentOffset = Math.sin(a) * baseRadius;
    const raw = [frame.normal[0] + frame.tangent[0] * tangentOffset + frame.bitangent[0] * bitangentOffset,
      frame.normal[1] + frame.tangent[1] * tangentOffset + frame.bitangent[1] * bitangentOffset,
      frame.normal[2] + frame.tangent[2] * tangentOffset + frame.bitangent[2] * bitangentOffset];
    base.push(radialPoint(raw, 1.002 + height * 0.24));
  }
  const apex = radialPoint(frame.normal, 1.002 + height * (1.45 + (seed % 8) * 0.025));
  // Три боковые грани каждой вершины — все вершины смещаются по локальной радиальной нормали.
  for (let i = 0; i < 3; i++) addTriangle(base[i]!, base[(i + 1) % 3]!, apex, rgb, cellId);
}

function reliefPoint(
  boundary: readonly number[], center: readonly number[], t: number, height: number, profile: ReliefProfile, edgeIndex: number, edgeCount: number,
): [number, number, number] {
  const direction = radialPoint([boundary[0]! * (1 - t) + center[0]! * t, boundary[1]! * (1 - t) + center[1]! * t, boundary[2]! * (1 - t) + center[2]! * t], 1);
  let shape = Math.pow(t, profile.exponent);
  if (profile.style === 'crystal') shape = Math.pow(t, 2.1) * (0.92 + 0.08 * Math.cos(edgeIndex * Math.PI * 2 / Math.max(3, edgeCount)));
  if (profile.style === 'spire') shape = Math.pow(t, 1.45) * (1 + 0.16 * Math.sin(edgeIndex * 2.399));
  if (profile.style === 'ridge') shape = Math.pow(t, 1.05) * (0.9 + 0.1 * Math.cos(edgeIndex * Math.PI * 2 / Math.max(3, edgeCount)));
  if (profile.style === 'lattice') shape = Math.pow(t, 1.6) * (t > 0.55 ? 1.08 : 0.82);
  if (profile.style === 'core') shape = Math.pow(t, 1.4) * (1 + 0.08 * Math.cos(edgeIndex * Math.PI * 4 / Math.max(3, edgeCount)));
  if (profile.terraces > 0 && profile.style !== 'basin') {
    const steps = Math.max(2, profile.terraces + Math.floor(height * 80));
    const quantized = Math.floor(shape * steps) / steps;
    shape = quantized * 0.82 + shape * 0.18;
  }
  return [direction[0] * (1.002 + height * shape), direction[1] * (1.002 + height * shape), direction[2] * (1.002 + height * shape)];
}

/**
 * GeneratedPlanet → PlanetMeshData. Каждая клетка строится как собственный рельефный участок:
 * общая граница остаётся на базовом радиусе, внутренние кольца поднимаются/опускаются радиально.
 * Треугольники каждой клетки идут непрерывным блоком — faceIndex однозначно сопоставляется cellId.
 */
export function buildPlanetMeshData(planet: GeneratedPlanet, opts: MeshBuildOptions = {}): PlanetMeshData {
  const positions: number[] = [];
  const colors: number[] = [];
  const cellCenters: number[] = [];
  const cellSurfaceCenters: number[] = [];
  const cellHeights: number[] = [];
  const cellColors: number[] = [];
  const cellIds: number[] = [];
  const faceCellIds: number[] = [];
  const edgePositions: number[] = [];
  let facetCount = 0;
  let edgeCount = 0;
  let radius = 0;

  const addTriangle = (a: readonly number[], b: readonly number[], c: readonly number[], rgb: readonly number[], cellId: number): void => {
    positions.push(a[0]!, a[1]!, a[2]!, b[0]!, b[1]!, b[2]!, c[0]!, c[1]!, c[2]!);
    colors.push(rgb[0]!, rgb[1]!, rgb[2]!, rgb[0]!, rgb[1]!, rgb[2]!, rgb[0]!, rgb[1]!, rgb[2]!);
    faceCellIds.push(cellId);
    facetCount++;
  };

  for (const cell of planet.cells) {
    const explored = opts.explored ? opts.explored.has(cell.id) : true;
    const table = explored ? planet.palette.explored : planet.palette.unexplored;
    const rgb = parseColor(table[String(cell.type)] ?? table[String(cell.displayType)] ?? planet.palette.border);
    // Не раскрываем тип неизвестной клетки через силуэт: до исследования у неё нейтральный рельеф.
    const profile = explored ? (RELIEF[cell.type] ?? RELIEF[3]!) : UNKNOWN_RELIEF;
    const level = opts.cellLevels?.get(cell.id) ?? cell.level ?? 0;
    const height = explored ? reliefHeight(cell.type, level) : UNKNOWN_RELIEF.base;
    const poly = cell.poly;
    const raisedCenter = radialPoint(cell.center, 1.002 + height);
    cellCenters.push(cell.center[0], cell.center[1], cell.center[2]);
    cellSurfaceCenters.push(...raisedCenter);
    cellHeights.push(height);
    cellColors.push(rgb[0], rgb[1], rgb[2]);
    cellIds.push(cell.id);
    radius = Math.max(radius, Math.hypot(...raisedCenter));

    // Два промежуточных кольца создают видимый склон, плато или кристаллический пик.
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]!;
      const b = poly[(i + 1) % poly.length]!;
      const ringT = [0.22, 0.46, 0.72, 0.90] as const;
      const ringsA = ringT.map((t) => reliefPoint(a, cell.center, t, height, profile, i, poly.length));
      const ringsB = ringT.map((t) => reliefPoint(b, cell.center, t, height, profile, (i + 1) % poly.length, poly.length));
      const outerA = radialPoint(a, 1.002);
      const outerB = radialPoint(b, 1.002);
      // Четыре кольца формируют последовательность уступов/террас вместо одного гладкого склона.
      let edgeRadius = 1.002;
      let previousA = outerA;
      let previousB = outerB;
      for (let ring = 0; ring < ringsA.length; ring++) {
        const nextA = ringsA[ring]!;
        const nextB = ringsB[ring]!;
        addTriangle(previousA, previousB, nextB, rgb, cell.id);
        addTriangle(previousA, nextB, nextA, rgb, cell.id);
        edgeRadius = Math.max(edgeRadius, Math.hypot(...nextA), Math.hypot(...nextB));
        previousA = nextA;
        previousB = nextB;
      }
      addTriangle(previousA, previousB, raisedCenter, rgb, cell.id);
      // radius accounting includes the highest displaced surface point
      radius = Math.max(radius, edgeRadius);
    }

    // Уникальные надстройки появляются только после исследования клетки.
    // Кристаллические клетки получают группу острых вершин; аномалии — асимметричный шпильный кластер.
    if (explored && profile.spikes > 0) {
      const spikeCount = Math.min(profile.spikes + Math.floor(Math.max(0, level) / 4), 8);
      const clusterScale = Math.min(0.12, Math.sqrt(Math.max(0.001, Math.abs(height))) * 0.72);
      for (let spike = 0; spike < spikeCount; spike++) {
        const spikeHeight = Math.max(0.012, Math.abs(height) * (profile.style === 'spire' ? 1.25 : 0.92) + Math.floor(level / 3) * 0.003);
        addRadialSpire(addTriangle, cell.center, spikeHeight, rgb, cell.id, spike + cell.id * 0.17, clusterScale * (1 - spike * 0.045));
        radius = Math.max(radius, 1.002 + spikeHeight * (1.45 + ((spike + cell.id * 0.17) % 8) * 0.025));
      }
    }

    for (const nb of cell.neighbors) {
      if (nb <= cell.id) continue;
      const n = planet.cells[nb];
      if (!n) continue;
      edgePositions.push(cell.center[0], cell.center[1], cell.center[2], n.center[0], n.center[1], n.center[2]);
      edgeCount++;
    }
  }
  return {
    positions: new Float32Array(positions),
    colors: new Float32Array(colors),
    cellCenters: new Float32Array(cellCenters),
    cellSurfaceCenters: new Float32Array(cellSurfaceCenters),
    cellHeights: new Float32Array(cellHeights),
    cellColors: new Float32Array(cellColors),
    cellIds: new Uint32Array(cellIds),
    faceCellIds: new Uint32Array(faceCellIds),
    edgePositions: new Float32Array(edgePositions),
    facetCount,
    cellCount: planet.cells.length,
    edgeCount,
    radius,
  };
}
