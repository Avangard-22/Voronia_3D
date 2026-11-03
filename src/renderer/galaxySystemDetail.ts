/** Stage 7.3 — детерминированная визуальная модель системы на основе обнаруженного узла графа. */
import type { GalaxyRenderNode } from './galaxyModel';

export interface GalaxySystemDetail {
  readonly nodeId: string;
  readonly starClass: 'blue' | 'white' | 'amber' | 'violet';
  readonly starColor: string;
  readonly planetColor: string;
  readonly orbitRadius: number;
  readonly orbitTilt: number;
  readonly orbitPhase: number;
  readonly anomaly: boolean;
  readonly title: string;
}

function hash(value: string): number {
  let result = 2166136261;
  for (let i = 0; i < value.length; i++) result = Math.imul(result ^ value.charCodeAt(i), 16777619);
  return result >>> 0;
}

/**
 * Возвращает только визуальный макет известной системы. Граф пока хранит планету,
 * но не физические параметры звезды/орбит и не каталог спутников; поэтому модель
 * показывает одну подтверждённую игровую планету и условную звезду-хозяина.
 */
export function buildGalaxySystemDetail(node: GalaxyRenderNode | null | undefined): GalaxySystemDetail | null {
  if (!node?.discovered) return null;
  const seed = hash(node.id);
  const starClass: GalaxySystemDetail['starClass'] = node.signalClass === 'cryo'
    ? 'blue'
    : node.signalClass === 'energy'
      ? 'amber'
      : node.signalClass === 'anomaly'
        ? 'violet'
        : (seed % 3 === 0 ? 'white' : 'amber');
  const starColor = ({ blue: '#8bdcff', white: '#e8f4ff', amber: '#ffd078', violet: '#c99aff' } as const)[starClass];
  const planetColor = ({ anomaly: '#c18aff', cryo: '#8ceaff', energy: '#ffe18a', resource: '#72d8b0', unknown: '#a5d9ee' } as const)[node.signalClass];
  return {
    nodeId: node.id,
    starClass,
    starColor,
    planetColor,
    orbitRadius: 1.35 + ((seed >>> 8) % 45) / 100,
    orbitTilt: (((seed >>> 16) % 31) - 15) * Math.PI / 180,
    orbitPhase: ((seed >>> 4) % 360) * Math.PI / 180,
    anomaly: node.signalClass === 'anomaly',
    title: `${starClass.toUpperCase()} · ${node.signalClass.toUpperCase()}`,
  };
}
