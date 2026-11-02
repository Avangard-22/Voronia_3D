/**
 * planets/exploration.ts — ExplorationService (GS-02 старт, guards hidden/state/unknown-cell,
 * атомарное списание, раскрытие первого кольца, ветвь аномалии, события).
 * 1.x parity: Sd() @358326 — explored.add → revealed.add(self, neighbors) → currentCost=max(cur+1, floor(cur×GC)).
 * Все изменения балансов — ОДНОЙ агрегированной транзакцией ledger (ADR-013).
 */
import type { ActionResult, ScanCellResult } from '../contracts/commands';
import { fail, ok } from '../contracts/commands';
import type { ResourceAmounts } from '../contracts/resources';
import type { EventPort, LedgerPort, RngPort, ScanPricingPort, TechPort } from '../contracts/ports';
import type { BalanceConfig } from '../config/types';
import type { PlanetRuntime } from '../contracts/planets';

export interface ExplorationDeps {
  readonly ledger: LedgerPort;
  readonly bus: EventPort;
  readonly rng: RngPort;
  readonly pricing: ScanPricingPort;
  readonly tech: TechPort;
  readonly balance: BalanceConfig;
  readonly gameMs: () => number;
}

export interface ScanOutcome extends ScanCellResult {
  readonly mutantRolled: string | null;
}

export class ExplorationService {
  constructor(private deps: ExplorationDeps) {}

  /** Замена Rng при newGame/загрузке (Game — единственный владелец rng). */
  setRng(rng: RngPort): void {
    this.deps = { ...this.deps, rng };
  }

  /** Жила активна, если её ресурс открыт исследованием (1.x gt(): type3→Kt(resourceKey), type5→Kt('kriogen')). */
  veinUnlocked(rt: PlanetRuntime, cellId: number): boolean {
    const node = rt.data.cells[cellId];
    if (!node) return false;
    if (node.type === 5) return this.deps.tech.isUnlocked('kriogen');
    if (node.type === 3) return this.deps.tech.isUnlocked(node.resourceKey ?? 'iron');
    return true;
  }

  scanCell(rt: PlanetRuntime, cellId: number): ActionResult<ScanOutcome> {
    const node = rt.data.cells[cellId];
    if (!node) return fail('unknown-cell', `${rt.data.id}#${cellId}`);
    if (rt.explored.has(cellId)) return fail('state', 'already explored');
    if (!rt.revealed.has(cellId)) return fail('hidden', 'not revealed');

    const p = this.deps.pricing;
    const charge = p.chargeFor(rt);
    if (this.deps.ledger.balance('energy') < charge) return fail('energy', `need ${charge}`);

    const rngFork = this.deps.rng.fork(`scan:${rt.data.id}:${cellId}`);
    const baseline = this.deps.balance.baseline;

    // награды/дельты одной транзакцией (ADR-013)
    const delta: ResourceAmounts = { energy: -charge };
    let science = 0;
    let anomalyType: 'synth' | 'power' | 'resonance' | null = null;
    if (node.type === 4) {
      // 1.x Sd: bi({energy:1e3×rw, iron:50×rw}); research += 10+floor(rand×15); обычная наука НЕ начисляется
      delta.energy = (delta.energy ?? 0) + baseline.anomaly.energyInstantReward;
      delta.iron = (delta.iron ?? 0) + baseline.anomaly.ironInstantReward;
      science = baseline.anomaly.scienceRandomMin + rngFork.nextInt(0, baseline.anomaly.scienceRandomSpan);
      anomalyType = null; // ветвь выбирается игроком (Этап 4); дефолт 1.x — 'synth' без дохода
    } else {
      // 1.x: min(10, 1+floor(charge/1000)) — неаномальные клетки
      science = Math.min(baseline.scan.scienceMax, 1 + Math.floor(charge / baseline.scan.scienceFromChargeDivisor));
    }
    if (science > 0) delta.research = (delta.research ?? 0) + science;

    const commit = this.deps.ledger.tryCommit({ reason: `scan:${rt.data.id}#${cellId}`, scope: 'global', delta, gameMs: this.deps.gameMs() });
    if (!commit.ok) return fail(commit.insufficient.includes('energy') ? 'energy' : 'cost', commit.insufficient.join(','));

    // состояние исследования (порядок вставки значим — GS-02)
    rt.explored.add(cellId);
    rt.revealed.add(cellId);
    const revealedAdded: number[] = [];
    for (const nb of node.neighbors) {
      if (nb >= 0 && nb < rt.data.cells.length && !rt.revealed.has(nb)) {
        rt.revealed.add(nb);
        revealedAdded.push(nb);
      }
    }

    // активация клетки по типу (1.x A1/Sd-ветви)
    const st = rt.cellStates.get(cellId);
    let mutantRolled: string | null = null;
    if (st) {
      if (node.type === 3 || node.type === 5) {
        if (node.type === 3) st.ironYield = baseline.veins.baseIronYieldOnScan; // 1.x: e.ironYield=.1
        else st.kriogenYield = baseline.veins.baseIronYieldOnScan;
        // мутант жилы: 12% (1.x @386490: type3||type5, mutant=ex(armId).id; Math.random → rng-fork, ADR-016)
        if (!st.mutant && rt.data.armId && rngFork.next() < 0.12) {
          const mutants = this.deps.balance.registry.planet.mutants;
          const m = mutants[rt.data.armId];
          if (m) {
            st.mutant = m.id;
            mutantRolled = m.id;
          }
        }
      } else if (node.type === 4) {
        st.anomalyType = anomalyType;
      }
      if (node.type === 0) st.yield = 1 + st.level; // display-parity (Ur всё равно считает от level)
    }

    // рост цены скана: TV-3 — floor НА ШАГЕ, не ниже +1 (1.x Sd)
    const currentCostAfter = this.deps.pricing.advanceCurrentCost();

    this.deps.bus.emit('cell:scanned', { pid: rt.data.id, cellId, type: node.type, cost: charge, anomalyType });
    return ok({
      pid: rt.data.id,
      cellId,
      cost: charge,
      type: node.type,
      delta,
      currentCostAfter,
      revealedAdded,
      mutantRolled,
    });
  }
}
