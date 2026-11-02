/** Galaxy exploration domain: signal classification, sectors, milestones and expedition progression. */
import type { GraphNode } from '../contracts/galaxy';

export type SignalClass = 'anomaly' | 'energy' | 'cryo' | 'resource' | 'unknown';

export interface SignalDescriptor {
  readonly biome?: string | null;
  readonly geometry?: string | null;
  readonly resources?: readonly string[];
  readonly frequency?: number;
}

const SIGNAL_META: Record<SignalClass, { label: string; icon: string }> = {
  anomaly: { label: 'Аномальный', icon: '✧' },
  energy: { label: 'Энергетический', icon: 'ϟ' },
  cryo: { label: 'Криогенный', icon: '❄' },
  resource: { label: 'Ресурсный', icon: '◆' },
  unknown: { label: 'Неизвестный', icon: '◌' },
};

export function classifySignal(input: SignalDescriptor): SignalClass {
  const biome = (input.biome ?? '').toLowerCase();
  const geometry = (input.geometry ?? '').toLowerCase();
  const resources = (input.resources ?? []).join(' ').toLowerCase();
  if (/anomal|void|rift|аномал|пустот/.test(`${biome} ${geometry} ${resources}`)) return 'anomaly';
  if (/krios|cryo|ice|frost|лед|крио/.test(`${biome} ${geometry} ${resources}`)) return 'cryo';
  if (/energy|power|энерг|plasma|плазм/.test(resources)) return 'energy';
  if (/ferrum|iron|crystal|ore|resource|желез|кристалл|руда/.test(`${biome} ${resources}`)) return 'resource';
  return 'unknown';
}

export function signalMeta(signal: SignalClass): { label: string; icon: string } {
  return SIGNAL_META[signal];
}

export interface GalaxyMapPoint {
  readonly id: string;
  readonly x: number;
  readonly y: number;
  readonly discovered: boolean;
}

/** Преобразует координаты XZ графа в viewBox 0..1000 с полями и защитой от нулевого диапазона. */
export function layoutGalaxy(nodes: readonly GraphNode[]): GalaxyMapPoint[] {
  if (!nodes.length) return [];
  const xs = nodes.map((n) => n.x);
  const zs = nodes.map((n) => n.z);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const spanX = Math.max(1, maxX - minX);
  const spanZ = Math.max(1, maxZ - minZ);
  const scale = 900 / Math.max(spanX, spanZ);
  const offsetX = (1000 - spanX * scale) / 2;
  const offsetY = (1000 - spanZ * scale) / 2;
  return nodes.map((node) => ({
    id: node.id,
    x: offsetX + (node.x - minX) * scale + 50,
    y: offsetY + (node.z - minZ) * scale + 50,
    discovered: node.discovered,
  }));
}

export function galaxyMilestone(discoveredCount: number): { current: number; next: number; progress: number } {
  const milestones = [2, 3, 5, 8, 12, 18, 25, 35, 50];
  const current = [...milestones].reverse().find((n) => discoveredCount >= n) ?? 0;
  const next = milestones.find((n) => discoveredCount < n) ?? 50;
  return { current, next, progress: Math.max(0, Math.min(1, discoveredCount / next)) };
}


export type GalaxySectorId = 'core' | 'inner' | 'mid' | 'outer';
export interface GalaxySector {
  readonly id: GalaxySectorId;
  readonly label: string;
  readonly radius: number;
}

/** Сектора фиксируются по радиусу в мировых координатах, поэтому не "переезжают" при открытии новых узлов. */
export function galaxySector(node: Pick<GraphNode, 'x' | 'z'>): GalaxySector {
  const radius = Math.hypot(node.x, node.z);
  if (radius < 12) return { id: 'core', label: 'Ядро', radius };
  if (radius < 35) return { id: 'inner', label: 'Внутренний сектор', radius };
  if (radius < 65) return { id: 'mid', label: 'Средний сектор', radius };
  return { id: 'outer', label: 'Внешний рубеж', radius };
}

export interface AnomalyGateStatus {
  readonly unlocked: boolean;
  readonly discoveredWorlds: number;
  readonly requiredWorlds: number;
  readonly discoveredArms: number;
  readonly requiredArms: number;
  readonly research: number;
  readonly requiredResearch: number;
  readonly missing: readonly ('worlds' | 'arms' | 'research')[];
}

/** Аномальные сигнатуры требуют подтверждённого опыта нескольких систем, а не только оплаты открытия. */
export function anomalyGateStatus(input: {
  readonly discoveredWorlds: number;
  readonly discoveredArms: number;
  readonly research: number;
}): AnomalyGateStatus {
  const requiredWorlds = 3;
  const requiredArms = 2;
  const requiredResearch = 1500;
  const missing: ('worlds' | 'arms' | 'research')[] = [];
  if (input.discoveredWorlds < requiredWorlds) missing.push('worlds');
  if (input.discoveredArms < requiredArms) missing.push('arms');
  if (input.research < requiredResearch) missing.push('research');
  return {
    unlocked: missing.length === 0,
    discoveredWorlds: input.discoveredWorlds,
    requiredWorlds,
    discoveredArms: input.discoveredArms,
    requiredArms,
    research: input.research,
    requiredResearch,
    missing,
  };
}


export interface GalaxyProgressionStage {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly unlocked: boolean;
  readonly requirements: {
    readonly worlds: { readonly current: number; readonly required: number };
    readonly arms: { readonly current: number; readonly required: number };
    readonly sectors: { readonly current: number; readonly required: number };
    readonly research: { readonly current: number; readonly required: number };
  };
  readonly discoveryDiscountPct: number;
}

export interface GalaxyProgressionStatus {
  readonly completed: number;
  readonly total: number;
  readonly discountPct: number;
  readonly stages: readonly GalaxyProgressionStage[];
  readonly nextStage: GalaxyProgressionStage | null;
}

/**
 * Этап 6.4: цепочка экспедиционных лицензий. Прогресс выводится из фактов графа и ledger,
 * не дублируется в сохранении. Скидка применяется только к будущей стоимости открытия миров.
 */
export function galaxyProgressionStatus(input: {
  readonly discoveredWorlds: number;
  readonly discoveredArms: number;
  readonly discoveredSectors: number;
  readonly research: number;
}): GalaxyProgressionStatus {
  const definitions = [
    { id: 'first-contact', name: 'Первый контакт', description: 'Закрепиться в двух системах и подтвердить первый маршрут.', worlds: 2, arms: 1, sectors: 1, research: 0, discount: 3 },
    { id: 'cartographer', name: 'Картограф', description: 'Исследовать несколько рукавов и накопить научные данные.', worlds: 5, arms: 2, sectors: 2, research: 1500, discount: 6 },
    { id: 'pioneer', name: 'Пионер дальнего космоса', description: 'Достичь трёх секторов и расширить сеть экспедиций.', worlds: 8, arms: 3, sectors: 3, research: 5000, discount: 10 },
    { id: 'deep-space', name: 'Глубокий космос', description: 'Освоить все четыре сектора и создать устойчивую галактическую сеть.', worlds: 12, arms: 4, sectors: 4, research: 15000, discount: 15 },
  ] as const;
  const stages: GalaxyProgressionStage[] = definitions.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    unlocked: input.discoveredWorlds >= d.worlds && input.discoveredArms >= d.arms && input.discoveredSectors >= d.sectors && input.research >= d.research,
    requirements: {
      worlds: { current: input.discoveredWorlds, required: d.worlds },
      arms: { current: input.discoveredArms, required: d.arms },
      sectors: { current: input.discoveredSectors, required: d.sectors },
      research: { current: input.research, required: d.research },
    },
    discoveryDiscountPct: d.discount,
  }));
  const completed = stages.filter((stage) => stage.unlocked).length;
  const nextStage = stages.find((stage) => !stage.unlocked) ?? null;
  const discountPct = stages.filter((stage) => stage.unlocked).reduce((max, stage) => Math.max(max, stage.discoveryDiscountPct), 0);
  return { completed, total: stages.length, discountPct, stages, nextStage };
}
