/** Stage 6.5 — детерминированные экспедиции к аномальным мирам. */
import type { GraphNode } from '../contracts/galaxy';
import { classifySignal } from './exploration';

export type AnomalyKind = 'rift' | 'echo' | 'singularity' | 'living-void';
export interface AnomalySite {
  readonly id: string;
  readonly planetId: string;
  readonly planetName: string;
  readonly kind: AnomalyKind;
  readonly title: string;
  readonly tier: number;
  readonly discovered: boolean;
  readonly resolved: boolean;
  readonly available: boolean;
  readonly energyCost: number;
  readonly researchCost: number;
  readonly reward: { readonly darkMatter: number; readonly relic: number; readonly essence: number };
}

const KIND_META: Readonly<Record<AnomalyKind, { title: string; energy: number; research: number; darkMatter: number; relic: number; essence: number }>> = {
  rift: { title: 'Разлом пространства', energy: 2500, research: 500, darkMatter: 2, relic: 0, essence: 0 },
  echo: { title: 'Эхо исчезнувшей системы', energy: 5000, research: 1500, darkMatter: 3, relic: 1, essence: 0 },
  singularity: { title: 'Стабилизированная сингулярность', energy: 10000, research: 4000, darkMatter: 5, relic: 2, essence: 1 },
  'living-void': { title: 'Живая пустота', energy: 20000, research: 10000, darkMatter: 8, relic: 3, essence: 2 },
};

/**
 * Приоритет классификации: геометрия мира важнее биома, биом важнее порядкового номера цепочки.
 * Иначе мир «rift anomaly» в биоме «void» получал бы вид living-void (20000⚡/10000🔬 вместо
 * 2500⚡/500🔬 tier-1) — стоимость экспедиции расходилась с заявленной цепочкой (Stage 6.5, GS-16).
 */
function kindFor(node: GraphNode, ordinal: number): AnomalyKind {
  const geometry = node.geometryName.toLowerCase();
  const biome = node.biome.toLowerCase();
  if (/rift|разлом|трещин/.test(geometry)) return 'rift';
  if (/singular|black.?hole|сингуляр/.test(geometry)) return 'singularity';
  if (/echo|reson|эхо/.test(geometry)) return 'echo';
  if (/void|пустот|living/.test(`${geometry} ${biome}`)) return 'living-void';
  if (/singular|black.?hole|сингуляр/.test(biome)) return 'singularity';
  if (/echo|reson|эхо/.test(biome)) return 'echo';
  return (['rift', 'echo', 'singularity', 'living-void'] as const)[Math.min(ordinal, 3)]!;
}

/** Список выводится из открытых узлов графа; сохранённый resolvedIds — единственный изменяемый флаг. */
export function buildAnomalySites(nodes: readonly GraphNode[], resolvedIds: ReadonlySet<string>): AnomalySite[] {
  const candidates = nodes.filter((node) => node.discovered && classifySignal({ biome: node.biome, geometry: node.geometryName, frequency: node.frequency }) === 'anomaly')
    .sort((a, b) => a.planetId.localeCompare(b.planetId, undefined, { numeric: true }));
  let previousResolved = true;
  return candidates.map((node, index) => {
    const kind = kindFor(node, index);
    const meta = KIND_META[kind];
    const tier = index + 1;
    const resolved = resolvedIds.has(node.planetId);
    const available = !resolved && previousResolved;
    previousResolved = resolved;
    const scale = Math.max(1, tier);
    return {
      id: node.planetId, planetId: node.planetId, planetName: node.name, kind, title: meta.title, tier,
      discovered: true, resolved, available,
      energyCost: Math.ceil(meta.energy * Math.pow(scale, 1.25)),
      researchCost: Math.ceil(meta.research * Math.pow(scale, 1.2)),
      reward: { darkMatter: meta.darkMatter * scale, relic: meta.relic * scale, essence: meta.essence * scale },
    };
  });
}
