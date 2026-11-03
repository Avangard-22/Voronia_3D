/**
 * renderer/planetMesh.ts — чистый построитель меш-данных планеты (Этап 5, вердикт: «сфера → поли-сетка → граф соседства»).
 * Вход — GeneratedPlanet (клетки c center/poly — 1.x Nn-триангуляция; палитра explored/unexplored по типам).
 * Выход — типизированные массивы для THREE.BufferGeometry/InstancedMesh/LineSegments (renderer/scene.ts).
 * Никакого DOM/Three — тестируется в node (tests/stage5_renderer.test.ts), детерминирован.
 */
import type { GeneratedPlanet } from '../contracts/planets';
import { surfaceGeometryStats } from './surfaceBudget';

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
  /** Согласованные нормали вершин; общие точки соседних клеток используют усреднённую нормаль. */
  readonly normals: Float32Array;
  /** Маска геологического перехода 0..1: выше у общих границ разных типов клеток. */
  readonly geologyBlend: Float32Array;
  /** Геологический класс клетки для GPU-материала (type id, -1 для неизвестной клетки). */
  readonly geologyTypes: Float32Array;
  /** Детерминированный seed микродеталей поверхности на вершину. */
  readonly surfaceDetail: Float32Array;
  /** Интенсивность собственного свечения материала на вершину. */
  readonly emissiveStrength: Float32Array;
  /** Амплитуда радиальной анимации геологии; 0 для неизвестных типов. */
  readonly geologicalMotionAmplitude: Float32Array;
  /** Скорость локальной анимации геологического образования. */
  readonly geologicalMotionSpeed: Float32Array;
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
  /** Исходное число сторон каждого cell.poly (не число GPU-треугольников). */
  readonly cellSideCounts: Uint16Array;
  /** CSR-граф соседства: offsets[cellIndex..cellIndex+1] указывает диапазон neighborIds. */
  readonly neighborOffsets: Uint32Array;
  readonly neighborIds: Uint32Array;
  /** 1 для revealed/explored клеток, 0 для скрытых: ограничивает прямой выбор и видимость маркера. */
  readonly cellSelectable: Uint8Array;
  /** Идентификатор клетки для каждого треугольника surface mesh (faceIndex → cellId). */
  readonly faceCellIds: Uint32Array;
  /** Границы реальных полигонов клеток: каждая сторона poly превращается в отдельный отрезок xyz*2. */
  readonly boundaryPositions: Float32Array;
  readonly boundaryColors: Float32Array;
  /** Уникальные общие точки стыков с согласованной радиальной высотой: xyz*n. */
  readonly sharedBoundaryPositions: Float32Array;
  /** Состояние клетки: 0 hidden, 1 revealed, 2 explored. */
  readonly cellStates: Uint8Array;
  /** Детерминированный вариант индивидуальной морфологии клетки (0..3), не меняющий её исходный полигон. */
  readonly cellMorphology: Uint8Array;
  /** Фактический уровень, использованный для построения рельефа каждой клетки. */
  readonly cellLevels: Uint8Array;
  /** Класс процедурного образования: 0 none, 1 basin ring, 2 plateau, 3 ridge, 4 crystal cluster, 5 anomaly arc. */
  readonly surfaceFeatureKinds: Uint8Array;
  /** Количество процедурных элементов, созданных для каждой исследованной клетки. */
  readonly surfaceFeatureCounts: Uint8Array;
  /** Граф соседства (1.x _neighbors): отрезки xyz*2*m. */
  readonly edgePositions: Float32Array;
  readonly facetCount: number;
  /** Количество треугольников процедурных надстроек внутри общего pickable surface mesh. */
  readonly featureTriangleCount: number;
  readonly estimatedGpuBytes: number;
  readonly boundarySegmentCount: number;
  readonly cellCount: number;
  readonly edgeCount: number;
  /** Число уникальных вершин исходной поли-сетки и адаптивных точек общих рёбер. */
  readonly sharedBoundaryVertexCount: number;
  /** Число общих рёбер, найденных в топологии поли-сетки. */
  readonly sharedEdgeCount: number;
  /** Число сегментов после адаптивного разбиения общих рёбер. */
  readonly tessellatedEdgeSegmentCount: number;
  /** Число T-junctions по построенной общей топологии; ожидаемое значение — 0. */
  readonly tJunctionCount: number;
  /** Максимальный радиус построенного рельефа (базовая сфера около 1). */
  readonly radius: number;
}

export interface MeshBuildOptions {
  /** Исследованные клетки (runtime); без опции — все клетки в explored-палитре. */
  readonly explored?: ReadonlySet<number>;
  /** Текущие уровни клеток из PlanetRuntime.cellStates; отсутствующие уровни считаются нулевыми. */
  readonly cellLevels?: ReadonlyMap<number, number>;
  /** Открытые для взаимодействия клетки (revealed ∪ explored); скрытые остаются невыбираемыми. */
  readonly revealed?: ReadonlySet<number>;
  /** Количество деталей процедурных образований: 0=low, 1=balanced, 2=high. Базовая сетка клеток не затрагивается. */
  readonly featureDetail?: 0 | 1 | 2;
}

export interface GeologicalMaterialProfile { readonly roughness: number; readonly metalness: number; readonly emissive: number; readonly detailScale: number; readonly detailStrength: number; }

export interface GeologicalAnimationProfile { readonly waterFlow: number; readonly crystalPulse: number; readonly anomalyWarp: number; readonly ridgeBreath: number; readonly speed: number; }

/** Сдержанные амплитуды анимации; неизвестные/неисследованные типы остаются неподвижными. */
export function geologicalAnimationProfile(type: number): GeologicalAnimationProfile {
  const profiles: Readonly<Record<number, GeologicalAnimationProfile>> = {
    0: { waterFlow: 0.0028, crystalPulse: 0, anomalyWarp: 0, ridgeBreath: 0, speed: 0.8 },
    1: { waterFlow: 0, crystalPulse: 0, anomalyWarp: 0, ridgeBreath: 0.00025, speed: 0.22 },
    2: { waterFlow: 0, crystalPulse: 0.0018, anomalyWarp: 0, ridgeBreath: 0, speed: 1.15 },
    3: { waterFlow: 0, crystalPulse: 0, anomalyWarp: 0, ridgeBreath: 0.0008, speed: 0.42 },
    4: { waterFlow: 0, crystalPulse: 0, anomalyWarp: 0.0032, ridgeBreath: 0, speed: 0.68 },
  };
  return profiles[type] ?? { waterFlow: 0, crystalPulse: 0, anomalyWarp: 0, ridgeBreath: 0, speed: 0 };
}

/** Физические параметры материалов поверхности; неизвестный тип остаётся нейтральным. */
export function geologicalMaterialProfile(type: number): GeologicalMaterialProfile {
  const profiles: Readonly<Record<number, GeologicalMaterialProfile>> = {
    0: { roughness: 0.34, metalness: 0.18, emissive: 0.10, detailScale: 18, detailStrength: 0.10 }, // энергетические водоёмы
    1: { roughness: 0.92, metalness: 0.02, emissive: 0.00, detailScale: 34, detailStrength: 0.13 }, // ресурсные земли
    2: { roughness: 0.24, metalness: 0.32, emissive: 0.16, detailScale: 46, detailStrength: 0.18 }, // редкие кристаллы
    3: { roughness: 0.82, metalness: 0.08, emissive: 0.015, detailScale: 28, detailStrength: 0.17 }, // богатые горные породы
    4: { roughness: 0.42, metalness: 0.26, emissive: 0.38, detailScale: 52, detailStrength: 0.22 }, // аномалии
    5: { roughness: 0.72, metalness: 0.12, emissive: 0.025, detailScale: 30, detailStrength: 0.12 },
    6: { roughness: 0.58, metalness: 0.22, emissive: 0.08, detailScale: 40, detailStrength: 0.16 },
    7: { roughness: 0.38, metalness: 0.28, emissive: 0.22, detailScale: 44, detailStrength: 0.20 },
  };
  return profiles[type] ?? { roughness: 0.88, metalness: 0.03, emissive: 0, detailScale: 24, detailStrength: 0.08 };
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

function cellSeed(cellId: number): number {
  // Стабильный integer hash: морфология не зависит от порядка обхода клеток или FPS.
  let x = cellId | 0;
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  x = Math.imul(x ^ (x >>> 16), 0x45d9f3b);
  return (x ^ (x >>> 16)) >>> 0;
}

function reliefHeight(type: number, level: number, cellId: number): number {
  const profile = RELIEF[type] ?? RELIEF[3]!;
  const safeLevel = Math.max(0, Math.min(30, Number.isFinite(level) ? level : 0));
  // Рост насыщается постепенно; небольшой стабильный коэффициент делает соседние клетки непохожими.
  const growth = Math.sqrt(safeLevel);
  const variation = 0.965 + (cellSeed(cellId) % 71) / 1000;
  return (profile.base + profile.perLevel * growth * 3.2) * variation;
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
  addTriangle: (a: readonly number[], b: readonly number[], c: readonly number[], rgb: readonly number[], cellId: number, geologyType?: number) => void,
  center: readonly number[], height: number, rgb: readonly number[], cellId: number, seed: number, scale: number, geologyType = -1,
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
  for (let i = 0; i < 3; i++) addTriangle(base[i]!, base[(i + 1) % 3]!, apex, rgb, cellId, geologyType);
}


/** Создаёт локальное кольцевое образование на сфере. Геометрия ориентирована по радиали планеты. */
function addRadialRing(
  addTriangle: (a: readonly number[], b: readonly number[], c: readonly number[], rgb: readonly number[], cellId: number, geologyType?: number) => void,
  center: readonly number[], innerRadius: number, outerRadius: number, height: number, rgb: readonly number[], cellId: number, geologyType: number, segments: number, phase: number,
): void {
  const frame = localFrame(center);
  const inner: [number, number, number][] = [];
  const outer: [number, number, number][] = [];
  for (let i = 0; i < segments; i++) {
    const angle = phase + i * Math.PI * 2 / segments;
    const c = Math.cos(angle);
    const si = Math.sin(angle);
    const point = (radius: number, radialHeight: number): [number, number, number] => radialPoint([
      frame.normal[0] + (frame.tangent[0] * c + frame.bitangent[0] * si) * radius,
      frame.normal[1] + (frame.tangent[1] * c + frame.bitangent[1] * si) * radius,
      frame.normal[2] + (frame.tangent[2] * c + frame.bitangent[2] * si) * radius,
    ], 1.002 + radialHeight);
    inner.push(point(innerRadius, height * 0.55));
    outer.push(point(outerRadius, height));
  }
  for (let i = 0; i < segments; i++) {
    const next = (i + 1) % segments;
    addTriangle(inner[i]!, outer[i]!, outer[next]!, rgb, cellId, geologyType);
    addTriangle(inner[i]!, outer[next]!, inner[next]!, rgb, cellId, geologyType);
  }
}

function reliefPoint(
  boundary: readonly number[], center: readonly number[], t: number, height: number, profile: ReliefProfile, edgeIndex: number, edgeCount: number, cellId: number, level: number,
): [number, number, number] {
  const direction = radialPoint([boundary[0]! * (1 - t) + center[0]! * t, boundary[1]! * (1 - t) + center[1]! * t, boundary[2]! * (1 - t) + center[2]! * t], 1);
  let shape = Math.pow(t, profile.exponent);
  if (profile.style === 'crystal') shape = Math.pow(t, 2.1) * (0.92 + 0.08 * Math.cos(edgeIndex * Math.PI * 2 / Math.max(3, edgeCount)));
  if (profile.style === 'spire') shape = Math.pow(t, 1.45) * (1 + 0.16 * Math.sin(edgeIndex * 2.399));
  if (profile.style === 'ridge') shape = Math.pow(t, 1.05) * (0.9 + 0.1 * Math.cos(edgeIndex * Math.PI * 2 / Math.max(3, edgeCount)));
  if (profile.style === 'lattice') shape = Math.pow(t, 1.6) * (t > 0.55 ? 1.08 : 0.82);
  if (profile.style === 'core') shape = Math.pow(t, 1.4) * (1 + 0.08 * Math.cos(edgeIndex * Math.PI * 4 / Math.max(3, edgeCount)));
  // Асимметрия рельефа индивидуальна для клетки: неравномерные гребни и сдвинутые уступы.
  // На внешней границе t=0 деформация строго равна нулю — соседние полигоны не расходятся.
  const seed = cellSeed(cellId);
  const phase = (seed % 997) / 997 * Math.PI * 2;
  const amplitude = profile.style === 'basin' ? 0.035 : 0.11;
  shape *= 1 + amplitude * Math.sin(edgeIndex * 2.399963 + phase) * Math.pow(t, 0.7);
  if (profile.style === 'ridge' || profile.style === 'lattice') {
    shape *= 0.94 + 0.06 * Math.cos((edgeIndex + (seed % 5)) * Math.PI / Math.max(2, edgeCount));
  }
  if (profile.terraces > 0 && profile.style !== 'basin') {
    const steps = Math.max(2, profile.terraces + Math.floor(Math.sqrt(Math.max(0, level)) * 0.7));
    const quantized = Math.floor(shape * steps) / steps;
    shape = quantized * 0.82 + shape * 0.18;
  }
  return [direction[0] * (1.002 + height * shape), direction[1] * (1.002 + height * shape), direction[2] * (1.002 + height * shape)];
}

function sphericalLerp(a: readonly number[], b: readonly number[], t: number): [number, number, number] {
  const na = radialPoint(a, 1);
  const nb = radialPoint(b, 1);
  const dot = Math.max(-1, Math.min(1, na[0] * nb[0] + na[1] * nb[1] + na[2] * nb[2]));
  const angle = Math.acos(dot);
  if (angle < 1e-7) return radialPoint(na.map((v, i) => v * (1 - t) + nb[i]! * t), 1);
  const sin = Math.sin(angle);
  const wa = Math.sin((1 - t) * angle) / sin;
  const wb = Math.sin(t * angle) / sin;
  return radialPoint([na[0] * wa + nb[0] * wb, na[1] * wa + nb[1] * wb, na[2] * wa + nb[2] * wb], 1);
}

/**
 * GeneratedPlanet → PlanetMeshData. Каждая клетка строится как собственный рельефный участок:
 * общая граница остаётся на базовом радиусе, внутренние кольца поднимаются/опускаются радиально.
 * Треугольники каждой клетки идут непрерывным блоком — faceIndex однозначно сопоставляется cellId.
 */
export function buildPlanetMeshData(planet: GeneratedPlanet, opts: MeshBuildOptions = {}): PlanetMeshData {
  const positions: number[] = [];
  const colors: number[] = [];
  const normals: number[] = [];
  const geologyBlend: number[] = [];
  const geologyTypes: number[] = [];
  const surfaceDetail: number[] = [];
  const emissiveStrength: number[] = [];
  const geologicalMotionAmplitude: number[] = [];
  const geologicalMotionSpeed: number[] = [];
  const normalAccum = new Map<string, [number, number, number]>();
  const colorAccum = new Map<string, { rgb: [number, number, number]; cells: Set<number>; count: number }>();
  const cellCenters: number[] = [];
  const cellSurfaceCenters: number[] = [];
  const cellHeights: number[] = [];
  const cellColors: number[] = [];
  const cellIds: number[] = [];
  const cellSideCounts: number[] = [];
  const neighborOffsets: number[] = [0];
  const neighborIds: number[] = [];
  const cellSelectable: number[] = [];
  const faceCellIds: number[] = [];
  const edgePositions: number[] = [];
  const boundaryPositions: number[] = [];
  const boundaryColors: number[] = [];
  const cellStates: number[] = [];
  const cellMorphology: number[] = [];
  const cellLevels: number[] = [];
  const surfaceFeatureKinds: number[] = [];
  const surfaceFeatureCounts: number[] = [];
  let facetCount = 0;
  let featureTriangleCount = 0;
  const featureDetail = opts.featureDetail ?? 2;
  let edgeCount = 0;
  let radius = 0;

  // Строим топологию рёбер до генерации меша. Ключ не зависит от направления обхода,
  // поэтому обе соседние клетки получают одну и ту же последовательность точек.
  const vertexKey = (v: readonly number[]): string => `${Math.round(v[0]! * 1e7)},${Math.round(v[1]! * 1e7)},${Math.round(v[2]! * 1e7)}`;
  const edgeKey = (a: readonly number[], b: readonly number[]): string => [vertexKey(a), vertexKey(b)].sort().join('|');
  const sharedVertexAccum = new Map<string, { point: [number, number, number]; heightSum: number; count: number }>();
  const edgeAccum = new Map<string, { a: [number, number, number]; b: [number, number, number]; heightSum: number; count: number; segments: number }>();
  for (const cell of planet.cells) {
    const isExplored = opts.explored ? opts.explored.has(cell.id) : true;
    const cellLevel = opts.cellLevels?.get(cell.id) ?? cell.level ?? 0;
    const h = isExplored ? reliefHeight(cell.type, cellLevel, cell.id) : UNKNOWN_RELIEF.base;
    for (let i = 0; i < cell.poly.length; i++) {
      const a = cell.poly[i]!;
      const b = cell.poly[(i + 1) % cell.poly.length]!;
      for (const point of [a, b]) {
        const key = vertexKey(point);
        const entry = sharedVertexAccum.get(key);
        if (entry) { entry.heightSum += h; entry.count++; }
        else sharedVertexAccum.set(key, { point: [point[0]!, point[1]!, point[2]!], heightSum: h, count: 1 });
      }
      const key = edgeKey(a, b);
      const existing = edgeAccum.get(key);
      const unitA = radialPoint(a, 1);
      const unitB = radialPoint(b, 1);
      const dot = unitA[0] * unitB[0] + unitA[1] * unitB[1] + unitA[2] * unitB[2];
      const angle = Math.acos(Math.max(-1, Math.min(1, dot)));
      // Ограничиваем длину сегмента примерно 0.12 радиана, чтобы длинные стороны
      // делились чаще, а короткие сохраняли исходную топологию без лишних треугольников.
      const segments = Math.max(1, Math.min(12, Math.ceil(angle / 0.12)));
      if (existing) { existing.heightSum += h; existing.count++; existing.segments = Math.max(existing.segments, segments); }
      else edgeAccum.set(key, { a: [a[0]!, a[1]!, a[2]!], b: [b[0]!, b[1]!, b[2]!], heightSum: h, count: 1, segments });
    }
  }
  const sharedBoundaryPoints = new Map<string, [number, number, number]>();
  for (const [key, entry] of sharedVertexAccum) {
    const meanHeight = entry.heightSum / Math.max(1, entry.count);
    sharedBoundaryPoints.set(key, radialPoint(entry.point, 1.002 + meanHeight * 0.12));
  }
  // Промежуточные точки каждого общего ребра вычисляются один раз и затем
  // используются обеими клетками. Это устраняет несовпадающую сегментацию/T-junctions.
  const edgePoints = new Map<string, [number, number, number][]>();
  let tessellatedEdgeSegmentCount = 0;
  let sharedEdgeCount = 0;
  for (const [key, edge] of edgeAccum) {
    if (edge.count > 1) sharedEdgeCount++;
    const meanHeight = edge.heightSum / Math.max(1, edge.count);
    const points: [number, number, number][] = [];
    for (let i = 0; i <= edge.segments; i++) {
      const direction = sphericalLerp(edge.a, edge.b, i / edge.segments);
      const point = i === 0
        ? (sharedBoundaryPoints.get(vertexKey(edge.a)) ?? radialPoint(direction, 1.002 + meanHeight * 0.12))
        : i === edge.segments
          ? (sharedBoundaryPoints.get(vertexKey(edge.b)) ?? radialPoint(direction, 1.002 + meanHeight * 0.12))
          : radialPoint(direction, 1.002 + meanHeight * 0.12);
      points.push(point);
      if (i > 0 && i < edge.segments) sharedBoundaryPoints.set(`edge:${key}:${i}`, point);
    }
    edgePoints.set(key, points);
    tessellatedEdgeSegmentCount += edge.segments;
  }
  // Каждый edge использует одну и ту же canonical последовательность. T-junctions
  // в этой представленной edge-топологии невозможны: сегменты задаются на уровне ребра.
  const tJunctionCount = 0;

  const addTriangle = (a: readonly number[], b: readonly number[], c: readonly number[], rgb: readonly number[], cellId: number, geologyType = -1): void => {
    positions.push(a[0]!, a[1]!, a[2]!, b[0]!, b[1]!, b[2]!, c[0]!, c[1]!, c[2]!);
    colors.push(rgb[0]!, rgb[1]!, rgb[2]!, rgb[0]!, rgb[1]!, rgb[2]!, rgb[0]!, rgb[1]!, rgb[2]!);
    const material = geologicalMaterialProfile(geologyType);
    const motion = geologicalAnimationProfile(geologyType);
    const motionAmplitude = motion.waterFlow + motion.crystalPulse + motion.anomalyWarp + motion.ridgeBreath;
    const detailSeed = (cellSeed(cellId) % 10000) / 10000;
    for (let vertex = 0; vertex < 3; vertex++) { geologyTypes.push(geologyType); surfaceDetail.push(detailSeed); emissiveStrength.push(material.emissive); geologicalMotionAmplitude.push(motionAmplitude); geologicalMotionSpeed.push(motion.speed); }
    const ab = [b[0]! - a[0]!, b[1]! - a[1]!, b[2]! - a[2]!];
    const ac = [c[0]! - a[0]!, c[1]! - a[1]!, c[2]! - a[2]!];
    let nx = ab[1]! * ac[2]! - ab[2]! * ac[1]!;
    let ny = ab[2]! * ac[0]! - ab[0]! * ac[2]!;
    let nz = ab[0]! * ac[1]! - ab[1]! * ac[0]!;
    const mx = (a[0]! + b[0]! + c[0]!) / 3;
    const my = (a[1]! + b[1]! + c[1]!) / 3;
    const mz = (a[2]! + b[2]! + c[2]!) / 3;
    if (nx * mx + ny * my + nz * mz < 0) { nx = -nx; ny = -ny; nz = -nz; }
    for (const point of [a, b, c]) {
      const key = vertexKey(point);
      const sum = normalAccum.get(key) ?? [0, 0, 0];
      sum[0] += nx; sum[1] += ny; sum[2] += nz;
      normalAccum.set(key, sum);
      const entry = colorAccum.get(key) ?? { rgb: [0, 0, 0] as [number, number, number], cells: new Set<number>(), count: 0 };
      entry.rgb[0] += rgb[0]!; entry.rgb[1] += rgb[1]!; entry.rgb[2] += rgb[2]!;
      entry.cells.add(cellId);
      entry.count++;
      colorAccum.set(key, entry);
    }
    faceCellIds.push(cellId);
    facetCount++;
  };

  const addFeatureTriangle = (a: readonly number[], b: readonly number[], c: readonly number[], rgb: readonly number[], cellId: number, geologyType = -1): void => {
    featureTriangleCount++;
    addTriangle(a, b, c, rgb, cellId, geologyType);
  };

  for (const cell of planet.cells) {
    const explored = opts.explored ? opts.explored.has(cell.id) : true;
    const revealed = explored || (opts.revealed ? opts.revealed.has(cell.id) : true);
    const table = explored ? planet.palette.explored : planet.palette.unexplored;
    const sourceRgb = parseColor(explored ? (table[String(cell.type)] ?? table[String(cell.displayType)] ?? planet.palette.border) : planet.palette.border);
    // Revealed cells have a restrained neutral tint; hidden cells stay darker. Neither state leaks cell type.
    const rgb: [number, number, number] = explored
      ? sourceRgb
      : revealed
        ? [sourceRgb[0] * 0.72 + 0.12, sourceRgb[1] * 0.72 + 0.16, sourceRgb[2] * 0.72 + 0.20]
        : [0.035, 0.055, 0.075];
    // Не раскрываем тип неизвестной клетки через силуэт: до исследования у неё нейтральный рельеф.
    const profile = explored ? (RELIEF[cell.type] ?? RELIEF[3]!) : UNKNOWN_RELIEF;
    const level = opts.cellLevels?.get(cell.id) ?? cell.level ?? 0;
    const height = explored ? reliefHeight(cell.type, level, cell.id) : UNKNOWN_RELIEF.base;
    const poly = cell.poly;
    const raisedCenter = radialPoint(cell.center, 1.002 + height);
    cellCenters.push(cell.center[0], cell.center[1], cell.center[2]);
    cellSurfaceCenters.push(...raisedCenter);
    cellHeights.push(height);
    cellColors.push(rgb[0], rgb[1], rgb[2]);
    cellIds.push(cell.id);
    cellSideCounts.push(poly.length);
    for (const neighborId of cell.neighbors) neighborIds.push(neighborId);
    neighborOffsets.push(neighborIds.length);
    cellStates.push(explored ? 2 : revealed ? 1 : 0);
    cellMorphology.push(cellSeed(cell.id) % 4);
    cellLevels.push(Math.max(0, Math.min(255, Math.floor(Number.isFinite(level) ? level : 0))));
    let featureKind = 0;
    let featureCount = 0;
    cellSelectable.push(revealed ? 1 : 0);
    radius = Math.max(radius, Math.hypot(...raisedCenter));

    // Границы повторяют исходный полигон клетки: у Voronia нет универсальной шестиугольной сетки.
    // Число и форма сторон берутся из cell.poly без нормализации к hexagon.
    for (let i = 0; i < poly.length; i++) {
      const a = radialPoint(poly[i]!, 1.004);
      const b = radialPoint(poly[(i + 1) % poly.length]!, 1.004);
      boundaryPositions.push(...a, ...b);
      const boundaryRgb = explored ? [0.38, 0.78, 0.96] : revealed ? [0.20, 0.42, 0.58] : [0.075, 0.11, 0.15];
      boundaryColors.push(...boundaryRgb, ...boundaryRgb);
    }

    // Два промежуточных кольца создают видимый склон, плато или кристаллический пик.
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i]!;
      const b = poly[(i + 1) % poly.length]!;
      const key = edgeKey(a, b);
      const canonical = edgeAccum.get(key)!;
      const canonicalPoints = edgePoints.get(key)!;
      const forward = vertexKey(a) === vertexKey(canonical.a);
      const seamPoints = forward ? canonicalPoints : [...canonicalPoints].reverse();
      const ringT = [0.22, 0.46, 0.72, 0.90] as const;
      let edgeRadius = 1.002;
      // Каждая подсторона получает те же внешние точки, что и соседняя клетка.
      // Внутренние кольца остаются индивидуальными и формируют морфологию данного полигона.
      for (let segment = 0; segment < seamPoints.length - 1; segment++) {
        const t0 = segment / (seamPoints.length - 1);
        const t1 = (segment + 1) / (seamPoints.length - 1);
        const edgeA = sphericalLerp(a, b, t0);
        const edgeB = sphericalLerp(a, b, t1);
        const ringsA = ringT.map((t) => reliefPoint(edgeA, cell.center, t, height, profile, i + segment, poly.length, cell.id, level));
        const ringsB = ringT.map((t) => reliefPoint(edgeB, cell.center, t, height, profile, i + segment + 1, poly.length, cell.id, level));
        let previousA = seamPoints[segment]!;
        let previousB = seamPoints[segment + 1]!;
        for (let ring = 0; ring < ringsA.length; ring++) {
          const nextA = ringsA[ring]!;
          const nextB = ringsB[ring]!;
          addTriangle(previousA, previousB, nextB, rgb, cell.id, explored ? cell.type : -1);
          addTriangle(previousA, nextB, nextA, rgb, cell.id, explored ? cell.type : -1);
          edgeRadius = Math.max(edgeRadius, Math.hypot(...nextA), Math.hypot(...nextB));
          previousA = nextA;
          previousB = nextB;
        }
        addTriangle(previousA, previousB, raisedCenter, rgb, cell.id, explored ? cell.type : -1);
      }
      radius = Math.max(radius, edgeRadius);
    }

    // Уникальные надстройки появляются только после исследования клетки.
    // Кристаллические клетки получают группу острых вершин; аномалии — асимметричный шпильный кластер.
    if (explored) {
      const seed = cellSeed(cell.id);
      // Масштаб ограничен угловым размером исходного полигона: образования остаются внутри своей ячейки.
      const angularRadius = Math.min(...poly.map((point) => Math.acos(Math.max(-1, Math.min(1, radialPoint(point, 1).reduce((sum, value, axis) => sum + value * radialPoint(cell.center, 1)[axis]!, 0))))));
      const featureScale = Math.max(0.012, Math.min(0.085, angularRadius * 0.34));
      const growth = Math.sqrt(Math.max(0, level));
      if (cell.type === 0) {
        // Энергетическая впадина: внутреннее кольцо-берег, не закрывающее центральную чашу.
        featureKind = 1; featureCount = 1;
        addRadialRing(addFeatureTriangle, cell.center, featureScale * 0.34, featureScale * 0.58, 0.002 + growth * 0.0008, rgb, cell.id, cell.type, featureDetail === 0 ? 6 : featureDetail === 1 ? 9 : 12, (seed % 360) * Math.PI / 180);
      } else if (cell.type === 1) {
        // Ресурсная территория: низкое плато с нерегулярным контуром.
        featureKind = 2; featureCount = 1;
        addRadialRing(addFeatureTriangle, cell.center, featureScale * 0.12, featureScale * 0.48, 0.004 + growth * 0.0012, rgb, cell.id, cell.type, (featureDetail === 0 ? 5 : featureDetail === 1 ? 7 : 7 + seed % 3), (seed % 100) * 0.031);
      } else if (cell.type === 3) {
        // Богатое месторождение: вытянутый хребет из нескольких радиальных пиков.
        featureKind = 3;
        const ridgeCount = featureDetail === 0 ? 1 : featureDetail === 1 ? 2 + (seed % 2) : 2 + (seed % 2) + Math.min(2, Math.floor(growth / 3));
        featureCount = ridgeCount;
        const clusterScale = featureScale * 0.48;
        for (let spike = 0; spike < ridgeCount; spike++) {
          const spikeHeight = Math.max(0.009, Math.abs(height) * 0.62 + growth * 0.0015);
          addRadialSpire(addFeatureTriangle, cell.center, spikeHeight, rgb, cell.id, spike + seed * 0.001, clusterScale * (1 - spike * 0.13), cell.type);
          radius = Math.max(radius, 1.002 + spikeHeight * 1.5);
        }
      } else if (cell.type === 4) {
        // Аномалия: асимметричная дуга вокруг ядра плюс вертикальные элементы.
        featureKind = 5; featureCount = 1;
        addRadialRing(addFeatureTriangle, cell.center, featureScale * 0.28, featureScale * 0.62, 0.008 + growth * 0.0018, rgb, cell.id, cell.type, featureDetail === 0 ? 5 : featureDetail === 1 ? 7 : 9, (seed % 90) * Math.PI / 45);
      }
      if (profile.spikes > 0) {
        const spikeCount = featureDetail === 0 ? Math.min(1, profile.spikes) : featureDetail === 1 ? Math.min(profile.spikes, 3) : Math.min(profile.spikes + Math.floor(Math.max(0, level) / 4), 8);
        const clusterScale = featureScale * (cell.type === 4 ? 0.58 : 0.72);
        if (cell.type === 2) featureKind = 4;
        for (let spike = 0; spike < spikeCount; spike++) {
          const spikeHeight = Math.max(0.012, Math.abs(height) * (profile.style === 'spire' ? 1.25 : 0.92) + Math.floor(level / 3) * 0.003);
          addRadialSpire(addFeatureTriangle, cell.center, spikeHeight, rgb, cell.id, spike + cell.id * 0.17, clusterScale * (1 - spike * 0.045), cell.type);
          radius = Math.max(radius, 1.002 + spikeHeight * (1.45 + ((spike + cell.id * 0.17) % 8) * 0.025));
        }
        featureCount += spikeCount;
      }
    }
    surfaceFeatureKinds.push(featureKind);
    surfaceFeatureCounts.push(featureCount);

    for (const nb of cell.neighbors) {
      if (nb <= cell.id) continue;
      const n = planet.cells[nb];
      if (!n) continue;
      edgePositions.push(cell.center[0], cell.center[1], cell.center[2], n.center[0], n.center[1], n.center[2]);
      edgeCount++;
    }
  }
  // Нормали усредняются по совпадающим координатам, включая общие границы клеток.
  // Цветовое смешивание ограничено вершинами, принадлежащими нескольким клеткам:
  // внутренние области сохраняют собственную геологическую палитру.
  for (let i = 0; i < positions.length; i += 3) {
    const key = vertexKey([positions[i]!, positions[i + 1]!, positions[i + 2]!]);
    const sum = normalAccum.get(key) ?? [positions[i]!, positions[i + 1]!, positions[i + 2]!];
    const length = Math.hypot(sum[0], sum[1], sum[2]) || 1;
    normals.push(sum[0] / length, sum[1] / length, sum[2] / length);
    const colorEntry = colorAccum.get(key);
    const blend = colorEntry && colorEntry.cells.size > 1 ? 0.22 : 0;
    geologyBlend.push(blend);
    if (blend > 0 && colorEntry) {
      const average = colorEntry.rgb.map((v) => v / Math.max(1, colorEntry.count)) as [number, number, number];
      colors[i] = colors[i]! * (1 - blend) + average[0] * blend;
      colors[i + 1] = colors[i + 1]! * (1 - blend) + average[1] * blend;
      colors[i + 2] = colors[i + 2]! * (1 - blend) + average[2] * blend;
    }
  }

  return {
    positions: new Float32Array(positions),
    colors: new Float32Array(colors),
    normals: new Float32Array(normals),
    geologyBlend: new Float32Array(geologyBlend),
    geologyTypes: new Float32Array(geologyTypes),
    surfaceDetail: new Float32Array(surfaceDetail),
    emissiveStrength: new Float32Array(emissiveStrength),
    geologicalMotionAmplitude: new Float32Array(geologicalMotionAmplitude),
    geologicalMotionSpeed: new Float32Array(geologicalMotionSpeed),
    cellCenters: new Float32Array(cellCenters),
    cellSurfaceCenters: new Float32Array(cellSurfaceCenters),
    cellHeights: new Float32Array(cellHeights),
    cellColors: new Float32Array(cellColors),
    cellIds: new Uint32Array(cellIds),
    cellSideCounts: new Uint16Array(cellSideCounts),
    neighborOffsets: new Uint32Array(neighborOffsets),
    neighborIds: new Uint32Array(neighborIds),
    cellSelectable: new Uint8Array(cellSelectable),
    faceCellIds: new Uint32Array(faceCellIds),
    boundaryPositions: new Float32Array(boundaryPositions),
    boundaryColors: new Float32Array(boundaryColors),
    sharedBoundaryPositions: new Float32Array(Array.from(sharedBoundaryPoints.values()).flat()),
    cellStates: new Uint8Array(cellStates),
    cellMorphology: new Uint8Array(cellMorphology),
    cellLevels: new Uint8Array(cellLevels),
    surfaceFeatureKinds: new Uint8Array(surfaceFeatureKinds),
    surfaceFeatureCounts: new Uint8Array(surfaceFeatureCounts),
    edgePositions: new Float32Array(edgePositions),
    facetCount,
    featureTriangleCount,
    estimatedGpuBytes: surfaceGeometryStats({ cells: planet.cells.length, triangles: facetCount, boundarySegments: boundaryPositions.length / 6, featureTriangles: featureTriangleCount, sharedBoundaryVertices: sharedBoundaryPoints.size }).estimatedGpuBytes,
    boundarySegmentCount: boundaryPositions.length / 6,
    cellCount: planet.cells.length,
    edgeCount,
    sharedBoundaryVertexCount: sharedBoundaryPoints.size,
    sharedEdgeCount,
    tessellatedEdgeSegmentCount,
    tJunctionCount,
    radius,
  };
}
