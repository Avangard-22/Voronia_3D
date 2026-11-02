/**
 * contracts/anomalies.ts — Этап 4: ветви аномалий, заряды, синтез.
 * Данные/формулы — fixtures/stage4_audit_v0.0.41.json (золотой аудит 1.x):
 *   ветви: Ho @430366 (мета — contracts/cells ANOMALY_META), эффекты в ce() @129995;
 *   заряды: i0 @120300, s0 @119794, a0/ll @119900, surge-планировщик @122100 (v0.0.39.0);
 *   синтез: Py/Ds/el/$y/Iy/ei/Cy/ti/Ty/Ay @74572..77000 (registry transport.config);
 *   мутанты: su=BALC("planet.mutants") @495102, ролл 12% при скане @386490, ta/tb @263838.
 */
import { ANOMALY_TYPES, type AnomalyType, type CellNode, type CellState } from './cells';

/** Валидатор ветви (в contracts — чистая функция над контрактными типами; потребители: economy, planets). */
export function isAnomalyBranch(v: string): v is AnomalyType {
  return (ANOMALY_TYPES as readonly string[]).includes(v);
}

/** 1.x Uo(cell) @430548: ветвь type4 (дефолт 'synth'); не-type4 → null. */
export function branchOf(node: CellNode | undefined, st: CellState | undefined): AnomalyType | null {
  if (!node || !st || node.type !== 4) return null;
  return st.anomalyType && isAnomalyBranch(st.anomalyType) ? st.anomalyType : 'synth';
}

/** 1.x Py @74572 — дефолтный продукт синтеза по рукаву (когда в focus нет rare-ресурса). */
export const SYNTH_PRODUCT_BY_ARM: Readonly<Record<string, string>> = Object.freeze({
  forge: 'titanium',
  frost: 'titanium',
  life: 'silicon',
  void: 'uranium',
});

/** 1.x n.chargeBuffs[pid] — состояние планетного баффа зарядов. */
export interface ChargeBuffState {
  pct: number;
  until: number;
  sciencePct: number;
  scienceUntil: number;
}

/** 1.x a0() — статус баффа для UI. */
export interface ChargeStatus {
  readonly pct: number;
  readonly leftSec: number;
  readonly sciPct: number;
  readonly sciLeftSec: number;
}

/** 1.x i0() ok-результат (поля — parity fixtures/stage4_audit §2/§9). */
export interface DischargeResult {
  readonly pid: string;
  readonly cellId: number;
  readonly type: number;
  readonly pct: number;
  readonly pctTotal: number;
  readonly dur: number;
  readonly mult: number;
  readonly neighbors: number;
  readonly atCap: boolean;
  readonly science: number;
  readonly sonarChargeGained: boolean;
  readonly leftSec: number;
}

/** 1.x ti() — статус синтезатора планеты. */
export interface SynthStatus {
  readonly out: number;
  readonly in: number;
  readonly product: string | null;
  readonly input: string | null;
  readonly anomalies: number;
  readonly locked: boolean;
}

export interface ChooseBranchResult {
  readonly pid: string;
  readonly cellId: number;
  readonly branch: AnomalyType;
}

/** 1.x tl() — апгрейд аномалии (nr-цена; на maxLevel — deep-конверсия 4000⚡+500 материала ×ucm). */
export interface UpgradeAnomalyResult {
  readonly pid: string;
  readonly cellId: number;
  readonly level: number;
  readonly deepConverted: boolean;
  readonly cost: Readonly<Record<string, number>>;
}
