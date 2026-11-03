/** Stage 7.4 — детерминированный доменный каталог тел звёздной системы.
 * Каталог вычисляется из seed узла PlanetaryGraph: одинаковый seed всегда даёт одинаковую систему.
 * Первый мир — существующая игровая планета; дополнительные тела пока являются неразведанными
 * кандидатами без runtime и не могут быть посещены до отдельного этапа орбитального исследования.
 */
import type { GraphNode } from '../contracts/galaxy';

export type StarClass = 'blue' | 'white' | 'yellow' | 'orange' | 'red';
export type SystemBodyClass = 'terrestrial' | 'ice' | 'gas-giant' | 'dwarf' | 'asteroid-belt';
export type SystemBodyStatus = 'confirmed' | 'unscanned';

export interface StarSystemBody {
  readonly id: string;
  readonly hostPlanetId: string;
  readonly name: string | null;
  readonly bodyClass: SystemBodyClass;
  readonly status: SystemBodyStatus;
  readonly orbitIndex: number;
  readonly semiMajorAxis: number;
  readonly eccentricity: number;
  readonly inclination: number;
  readonly orbitalPhase: number;
  readonly sourcePlanetId: string | null;
}

export interface StarSystemCatalog {
  readonly id: string;
  readonly seed: number;
  readonly hostPlanetId: string;
  readonly star: { readonly class: StarClass; readonly temperatureK: number; readonly luminosity: number };
  readonly bodies: readonly StarSystemBody[];
  readonly generatedAtVersion: 1;
}

function mix32(value: number): number {
  let x = value >>> 0;
  x ^= x >>> 16; x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15; x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}

function random01(seed: number, salt: number): number {
  return mix32(seed ^ Math.imul(salt + 1, 0x9e3779b1)) / 0x1_0000_0000;
}

function classifyStar(seed: number): StarSystemCatalog['star'] {
  const roll = random01(seed, 1);
  if (roll < 0.08) return { class: 'blue', temperatureK: 10000 + Math.round(random01(seed, 2) * 12000), luminosity: 8 + random01(seed, 3) * 22 };
  if (roll < 0.2) return { class: 'white', temperatureK: 7500 + Math.round(random01(seed, 2) * 2500), luminosity: 2 + random01(seed, 3) * 5 };
  if (roll < 0.56) return { class: 'yellow', temperatureK: 5200 + Math.round(random01(seed, 2) * 1300), luminosity: 0.65 + random01(seed, 3) * 1.1 };
  if (roll < 0.84) return { class: 'orange', temperatureK: 3700 + Math.round(random01(seed, 2) * 1300), luminosity: 0.12 + random01(seed, 3) * 0.5 };
  return { class: 'red', temperatureK: 2400 + Math.round(random01(seed, 2) * 1300), luminosity: 0.01 + random01(seed, 3) * 0.12 };
}

/** Создаёт стабильную систему только для существующего узла; скрытые узлы отклоняются. */
export function buildStarSystemCatalog(node: Pick<GraphNode, 'id' | 'name' | 'seed' | 'discovered'> | null | undefined): StarSystemCatalog | null {
  if (!node?.discovered || !node.id || !Number.isFinite(node.seed)) return null;
  const seed = mix32(node.seed ^ 0x51a7e);
  const extraCount = 1 + Math.floor(random01(seed, 4) * 3);
  const bodies: StarSystemBody[] = [{
    id: `body:${node.id}:0`, hostPlanetId: node.id, name: node.name,
    bodyClass: 'terrestrial', status: 'confirmed', orbitIndex: 0,
    semiMajorAxis: 0.8 + random01(seed, 5) * 0.9,
    eccentricity: 0, inclination: 0, orbitalPhase: random01(seed, 6) * Math.PI * 2,
    sourcePlanetId: node.id,
  }];
  const classes: readonly SystemBodyClass[] = ['terrestrial', 'ice', 'gas-giant', 'dwarf', 'asteroid-belt'];
  for (let index = 1; index <= extraCount; index++) {
    const roll = random01(seed, 10 + index);
    bodies.push({
      id: `body:${node.id}:${index}`, hostPlanetId: node.id, name: null,
      bodyClass: classes[Math.floor(roll * classes.length)]!, status: 'unscanned', orbitIndex: index,
      semiMajorAxis: 1.25 + index * 0.85 + random01(seed, 20 + index) * 0.65,
      eccentricity: random01(seed, 30 + index) * 0.18,
      inclination: (random01(seed, 40 + index) - 0.5) * 0.28,
      orbitalPhase: random01(seed, 50 + index) * Math.PI * 2,
      sourcePlanetId: null,
    });
  }
  return { id: `system:${node.id}`, seed, hostPlanetId: node.id, star: classifyStar(seed), bodies, generatedAtVersion: 1 };
}

/** Проверяет инварианты каталога перед передачей в UI/рендерер. */
export function validateStarSystemCatalog(catalog: StarSystemCatalog): readonly string[] {
  const issues: string[] = [];
  if (catalog.bodies.length < 2) issues.push('system-has-no-orbital-candidates');
  const ids = new Set<string>();
  for (const body of catalog.bodies) {
    if (ids.has(body.id)) issues.push(`duplicate-body:${body.id}`);
    ids.add(body.id);
    if (body.hostPlanetId !== catalog.hostPlanetId) issues.push(`wrong-host:${body.id}`);
    if (!Number.isFinite(body.semiMajorAxis) || body.semiMajorAxis <= 0) issues.push(`invalid-orbit:${body.id}`);
    if (body.status === 'confirmed' && (!body.sourcePlanetId || !body.name)) issues.push(`confirmed-body-without-source:${body.id}`);
    if (body.status === 'unscanned' && (body.sourcePlanetId || body.name)) issues.push(`unscanned-body-leaks-identity:${body.id}`);
  }
  if (catalog.bodies[0]?.status !== 'confirmed' || catalog.bodies[0]?.sourcePlanetId !== catalog.hostPlanetId) issues.push('host-world-not-first-confirmed-body');
  return issues;
}
