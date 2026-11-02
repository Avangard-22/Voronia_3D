/**
 * planets/anomalies.ts — ветви аномалий type4 (Этап 4).
 * Порт 1.x: Uo() @430548 (дефолт 'synth'), fm() @431082 (множитель истощения: deep-power 0.5 / power 0.7),
 * um() @430700 (выбор ветви — в 1.x модалька + тосты; 2.0 — команда chooseAnomalyBranch, UI-обвязка Этап 12).
 * Эффекты ветвей в доходе — economy/income.ts (power/resonance), синтез — economy/synth.ts.
 */
import type { ActionResult } from '../contracts/commands';
import { fail, ok } from '../contracts/commands';
import type { ChooseBranchResult } from '../contracts/anomalies';
import { branchOf, isAnomalyBranch } from '../contracts/anomalies';
import type { EventPort } from '../contracts/ports';
import type { PlanetRuntime } from '../contracts/planets';

export { branchOf, isAnomalyBranch };

/**
 * 1.x fm(planet): глобальный множитель истощения жил от power-аномалий.
 * Исследованные type4: есть power+isDeep → 0.5; есть power → 0.7; иначе 1.
 * (fixtures/stage4_audit §branches: fm_power 0.7, fm_power_deep 0.5, fm_resonance/synth/unexplored 1.)
 */
export function fmFor(rt: PlanetRuntime): number {
  let hasPower = false;
  let hasDeepPower = false;
  for (const cellId of rt.explored) {
    const node = rt.data.cells[cellId];
    const st = rt.cellStates.get(cellId);
    if (!node || !st || node.type !== 4) continue;
    if ((st.anomalyType ?? 'synth') !== 'power') continue;
    hasPower = true;
    if (st.isDeep) hasDeepPower = true;
  }
  if (hasDeepPower) return 0.5;
  return hasPower ? 0.7 : 1;
}

export interface AnomalyDeps {
  readonly bus: EventPort;
}

export class AnomalyService {
  constructor(private readonly deps: AnomalyDeps) {}

  /** 1.x um(): выбор ветви возможен один раз (anomalyType не выбран/невалиден). */
  chooseBranch(rt: PlanetRuntime, cellId: number, branch: string): ActionResult<ChooseBranchResult> {
    const node = rt.data.cells[cellId];
    const st = rt.cellStates.get(cellId);
    if (!node || !st) return fail('unknown-cell', `${rt.data.id}#${cellId}`);
    if (node.type !== 4) return fail('type', `type ${node.type}`);
    if (!rt.explored.has(cellId)) return fail('state', 'unexplored');
    if (!isAnomalyBranch(branch)) return fail('type', `unknown branch ${branch}`);
    if (st.anomalyType && isAnomalyBranch(st.anomalyType)) return fail('state', 'branch already chosen');
    st.anomalyType = branch;
    this.deps.bus.emit('cell:branchChosen', { pid: rt.data.id, cellId, branch });
    return ok({ pid: rt.data.id, cellId, branch });
  }
}
