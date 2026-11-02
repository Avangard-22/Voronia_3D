/**
 * core/discovery.ts — оркестрация открытия планет (1.x ge.discoverPlanet, bundle @103509; ADR-015).
 * Единственное место, где сходятся домены planets (генератор) и galaxy (позиция/граф) — R2 architecture.
 *
 * Порядок операций ДОСЛОВНО из 1.x (критично для паритета):
 *  1. c = Fr()+1 (число планет без hidden/hiddenWorldIndex + 1) → id `planet_NN`
 *  2. seed → geometry (Jc) → frequency (Zc)
 *  3. buildPlanet (конструктор + _build: геометрия/соседи/старт/биомы/ресурсы(armId=null)/sortPoly)
 *  4. Yf: позиция Br → узел графа → armId → _assignResources(false) с рукавом (не ferrum/krios) → Kf
 *  5. initStart → ni (mixed) → _assignResources(false) ещё раз (не ferrum/krios)
 *  6. награда: floor(500 × 2.2^max(0, idx−2)) 🔬 (TV-6)
 * Js/jr (рендер) и session/achieves-сайд-эффекты — вне среза Этапа 3.
 */
import type { GraphNode, PlanetaryGraph } from '../contracts/galaxy';
import type { GeneratedPlanet } from '../contracts/planets';
import type { GeneratorCtx } from '../planets/generator';
import {
  assignPlanetResources,
  applyMixedClusters,
  buildPlanet,
  discoverReward,
  initPlanetStart,
  pickFrequency,
  pickGeometry,
} from '../planets/generator';
import { armIdAt, generatePosition, INITIAL_NODE_POS } from '../galaxy/position';
import { createInitialGraph, linkDiscoveredNode } from '../galaxy/graph';
import { STARTER_PLANET_SPECS } from '../planets/catalog';

/** 1.x Bs — id скрытого мира (не входит в счётчик Fr). */
export const HIDDEN_PLANET_ID = 'planet_hidden';

export interface DiscoveryWorld {
  readonly graph: PlanetaryGraph;
  readonly planets: Record<string, GeneratedPlanet>;
}

export interface DiscoveryInput {
  readonly name?: string | null;
  readonly biome?: string;
  /** Без seed — wall-clock fallback 1.x (Date.now()^c×2654435769); в тестах/паритете seed обязателен. */
  readonly seed?: number | null;
  readonly geometry?: string | null;
  readonly frequency?: number | null;
}

export interface DiscoveryResult {
  readonly planet: GeneratedPlanet;
  readonly node: GraphNode;
  /** 🔬 за открытие (начисление — через ledger в Game; здесь — чистое число). */
  readonly researchReward: number;
}

/** 1.x Fr — число планет, исключая hidden-id и planetIndex===hiddenWorldIndex (Mf). */
export function countDiscoverablePlanets(planets: Readonly<Record<string, GeneratedPlanet | undefined>>, hiddenWorldIndex: number): number {
  let e = 0;
  for (const t in planets) {
    const o = planets[t];
    if (o && !(t === HIDDEN_PLANET_ID || Number(o.planetIndex) === hiddenWorldIndex)) e++;
  }
  return e;
}

/** 1.x Yf — позиция/узел/armId/повторный assignResources/линковка графа. */
export function placePlanetInGalaxy(planet: GeneratedPlanet, graph: PlanetaryGraph, ctx: GeneratorCtx): GraphNode {
  const g = ctx.balance.registry.galaxy;
  const t = generatePosition(planet.seed >>> 0, graph.nodes, { spiral: g.arms, gen: g.gen, nodeRender: g.nodeRender });
  const node: GraphNode = {
    id: planet.id,
    planetId: planet.id,
    name: planet.name,
    geometryName: planet.geometryName,
    biome: planet.biome,
    geometry: planet.geometry,
    frequency: planet.f,
    seed: planet.seed,
    x: t.x,
    y: t.y,
    z: t.z,
    armId: armIdAt(t, g.arms),
    discovered: true,
  };
  graph.nodes[node.id] = node;
  planet.armId = node.armId;
  if (planet.biome !== 'ferrum' && planet.biome !== 'krios') assignPlanetResources(planet, ctx, false);
  linkDiscoveredNode(graph, node);
  return node;
}

export interface DiscoverOptions {
  /** 1.x Ze('reveal_start') — перк пыли: соседи старта сразу explored. */
  readonly revealStartPerk?: boolean;
}

/** 1.x ge.discoverPlanet — полный поток открытия (без UI/ledger-сайд-эффектов). */
export function discoverPlanet(input: DiscoveryInput, world: DiscoveryWorld, ctx: GeneratorCtx, opts: DiscoverOptions = {}): DiscoveryResult {
  const hiddenWorldIndex = ctx.balance.registry.planet.hiddenWorldIndex;
  const c = countDiscoverablePlanets(world.planets, hiddenWorldIndex) + 1;
  const l = input.seed == null ? ((Date.now() ^ (c * 2654435769)) >>> 0) : input.seed >>> 0;
  const u = input.geometry || pickGeometry(l, c, ctx);
  const f = input.frequency || pickFrequency(u, l, c, ctx);
  const h = `planet_${String(c).padStart(2, '0')}`;
  const m = buildPlanet({ id: h, name: input.name ?? null, seed: l, f, geometry: u, biome: input.biome ?? 'unknown', planetIndex: c }, ctx);
  world.planets[h] = m;
  const node = placePlanetInGalaxy(m, world.graph, ctx);
  initPlanetStart(m, opts.revealStartPerk ?? false);
  applyMixedClusters(m, ctx);
  if (!(m.biome === 'ferrum' || m.biome === 'krios')) assignPlanetResources(m, ctx, false);
  return { planet: m, node, researchReward: discoverReward(m.planetIndex || 1) };
}

/** Узел графа стартовой планеты (1.x oi(): позиции/armId/discovered — INITIAL_NODE_POS). */
export function starterNode(id: 'ferrum' | 'krios', p: GeneratedPlanet): GraphNode {
  const pos = INITIAL_NODE_POS[id];
  if (!pos) throw new Error(`starterNode: нет стартовой позиции для ${id}`);
  return {
    id,
    planetId: id,
    name: p.name,
    geometryName: p.geometryName,
    biome: p.biome,
    geometry: p.geometry,
    frequency: p.f,
    seed: p.seed,
    x: pos.x,
    y: pos.y,
    z: pos.z,
    armId: pos.armId,
    discovered: pos.discovered,
  };
}

/**
 * Начальный мир (1.x oi() + $ = {ferrum, krios}): оба планеты построены, krios discovered:false
 * (открывается сонаром — Этап 6, TV-33). Fr()=2 → первое открытие даст planet_03 (аудит §discover).
 */
export function createStarterWorld(ctx: GeneratorCtx): DiscoveryWorld {
  const ferrum = buildPlanet({ ...STARTER_PLANET_SPECS.ferrum }, ctx);
  initPlanetStart(ferrum, false); // 1.x startGame: ferrum посещён (GS-02)
  const krios = buildPlanet({ ...STARTER_PLANET_SPECS.krios }, ctx);
  const graph = createInitialGraph(starterNode('ferrum', ferrum), starterNode('krios', krios));
  return { graph, planets: { ferrum, krios } };
}
