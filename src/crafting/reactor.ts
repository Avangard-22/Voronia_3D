/**
 * crafting/reactor.ts — Этап 9.3 (Этап 8 ТЗ): реактор и крафт.
 *
 * v1-данные: `registry.craft.recipes` (входы/время/выходы, runtime-извлечение legacy),
 * слоты и_capacity — `registry.craft`. Рецепты открываются исследованиями
 * (`recipe_*`, `unlock_synth_*` из дерева Этапа 9.3).
 *
 * Правила списания (ТЗ §6: «очередки производства имеют явные правила списания»):
 *  - входыrun списываются ОДНОЙ атомарной транзакцией в момент СТАРТА run;
 *  - если оплаты не хватает — run встаёт в дефицит (job.state = 'deficit'), очередь не теряет прогресс;
 *  - выход начисляется одной транзакцией в момент завершения run;
 *  - отмена задачи возвращает только ещё не стартовавшие run (входы за текущий run невозвратны — как в 1.x).
 *
 * Время — игровое (gameMs), офлайн-расчёт реактора — Этап 11 (ТЗ), здесь сознательно не реализуется.
 */
import type { LedgerPort, TechPort } from '../contracts/ports';
import type { ResourceAmounts } from '../contracts/resources';
import type { ReactorJobView, ReactorRecipeView, ReactorView } from '../contracts/crafting';

// UI-типы живут в контрактах (слой snapshot зависит только от contracts) — реэкспорт для домена/тестов.
export type { ReactorJobView, ReactorRecipeView, ReactorView };

/** Задача очереди (домен): оплата текущего run + дефицит (последняя попытка оплаты не прошла). */
export interface ReactorJob {
  readonly id: number;
  readonly recipeId: string;
  runs: number;
  done: number;
  progressMs: number;
  paidForCurrent: boolean;
  deficit: boolean;
}

/** Рецепт → исследование, открывающее его (v1 RESEARCH_NAMES: recipe_*, unlock_synth_*). */
export const RECIPE_GATE: Readonly<Record<string, string>> = Object.freeze({
  steel: 'recipe_steel',
  chip: 'recipe_chip',
  alloy: 'recipe_alloy',
  core: 'recipe_core',
  relic: 'recipe_relic',
  researchData: 'recipe_datablock',
  researchDataBulk: 'recipe_datablock',
  researchDataElite: 'recipe_datablock',
  helium3: 'unlock_synth_helium3',
  biomass: 'unlock_synth_biomass',
  platinum: 'unlock_synth_platinum',
});

export type ReactorResult<T> = { ok: true; value: T } | { ok: false; reason: string };

export class Reactor {
  private jobs: ReactorJob[] = [];
  private nextJobId = 1;
  private lastMs: number;

  constructor(
    private readonly craft: Readonly<Record<string, unknown>>,
    private readonly recipesRaw: Readonly<Record<string, { inputs: Record<string, number>; time: number; noScale?: boolean; dataGain?: number; resGain?: number }>>,
    private readonly tech: TechPort,
    private readonly ledger: LedgerPort,
    private readonly now: () => number,
  ) {
    this.lastMs = now();
  }

  slots(): number {
    return Math.max(1, Number(this.craft['baseSlots'] ?? 1));
  }

  private queueCap(): number {
    return Math.max(1, Number(this.craft['queueCapBase'] ?? 50));
  }

  recipeIds(): readonly string[] {
    return Object.keys(this.recipesRaw);
  }

  /** Выход run: соединение/ресурс либо dataGain/resGain. */
  outputOf(recipeId: string): ResourceAmounts {
    const recipe = this.recipesRaw[recipeId];
    if (!recipe) return {};
    if (recipe.dataGain) return { research: recipe.dataGain };
    if (recipe.resGain) return { [recipeId]: recipe.resGain };
    return { [recipeId]: 1 };
  }

  gateOf(recipeId: string): string | null {
    return RECIPE_GATE[recipeId] ?? null;
  }

  recipesView(): readonly ReactorRecipeView[] {
    return this.recipeIds().map((id) => {
      const recipe = this.recipesRaw[id]!;
      const gate = this.gateOf(id);
      return {
        id,
        inputs: recipe.inputs,
        timeSec: Math.max(Number(this.craft['minTimeSec'] ?? 5), recipe.time),
        output: this.outputOf(id),
        gate,
        unlocked: gate === null || this.tech.hasResearch(gate),
      };
    });
  }

  canEnqueue(recipeId: string, runs: number): ReactorResult<{ recipeId: string; runs: number }> {
    const recipe = this.recipesRaw[recipeId];
    if (!recipe) return { ok: false, reason: 'unknown-recipe' };
    const gate = this.gateOf(recipeId);
    if (gate && !this.tech.hasResearch(gate)) return { ok: false, reason: `locked:${gate}` }; // имя исследования UI берёт из снапшота tech.nodes
    if (!Number.isFinite(runs) || runs < 1) return { ok: false, reason: 'bad-runs' };
    if (this.jobs.length >= this.queueCap()) return { ok: false, reason: 'queue-full' };
    return { ok: true, value: { recipeId, runs: Math.floor(runs) } };
  }

  enqueue(recipeId: string, runs: number): ReactorResult<{ jobId: number; queueLength: number }> {
    const check = this.canEnqueue(recipeId, runs);
    if (!check.ok) return check;
    const job: ReactorJob = { id: this.nextJobId++, recipeId, runs: Math.floor(runs), done: 0, progressMs: 0, paidForCurrent: false, deficit: false };
    this.jobs.push(job);
    return { ok: true, value: { jobId: job.id, queueLength: this.jobs.length } };
  }

  cancel(jobId: number): ReactorResult<{ removedRuns: number }> {
    const index = this.jobs.findIndex((job) => job.id === jobId);
    if (index < 0) return { ok: false, reason: 'unknown-job' };
    const job = this.jobs[index]!;
    // Возвращаем только не стартовавшие run: текущий run уже оплачен и необратим (правило списания).
    const refundedRuns = Math.max(0, job.runs - job.done - (job.paidForCurrent ? 1 : 0));
    this.jobs.splice(index, 1);
    return { ok: true, value: { removedRuns: refundedRuns } };
  }

  /** Игровой тик: прогресс активных слотов, оплаты на старте run, выходы по завершении. */
  tick(gameMs: number): { completed: number; outputs: ResourceAmounts } {
    const dt = Math.max(0, gameMs - this.lastMs);
    this.lastMs = gameMs;
    let completed = 0;
    const outputs: Record<string, number> = {};
    const slots = this.slots();
    for (let index = 0; index < Math.min(slots, this.jobs.length); index++) {
      const job = this.jobs[index]!;
      const recipe = this.recipesRaw[job.recipeId];
      if (!recipe) continue;
      if (!job.paidForCurrent) {
        const pay = this.ledger.tryCommit({ reason: `reactor:${job.recipeId}`, scope: 'global', delta: negate(recipe.inputs), gameMs });
        if (!pay.ok) { job.deficit = true; continue; } // дефицит: ждём ресурсы, прогресс не идёт
        job.paidForCurrent = true;
        job.deficit = false;
      }
      job.progressMs += dt;
      const timeMs = Math.max(Number(this.craft['minTimeSec'] ?? 5), recipe.time) * 1000;
      while (job.progressMs >= timeMs && job.done < job.runs) {
        job.progressMs -= timeMs;
        job.done += 1;
        completed += 1;
        for (const [key, value] of Object.entries(this.outputOf(job.recipeId))) outputs[key] = (outputs[key] ?? 0) + (value ?? 0);
        job.paidForCurrent = false;
        if (job.done >= job.runs) break;
        const pay = this.ledger.tryCommit({ reason: `reactor:${job.recipeId}`, scope: 'global', delta: negate(recipe.inputs), gameMs });
        if (!pay.ok) { job.deficit = true; break; } // следующий run в дефиците
        job.paidForCurrent = true;
        job.deficit = false;
      }
    }
    if (Object.keys(outputs).length > 0) {
      this.ledger.tryCommit({ reason: 'reactor:output', scope: 'global', delta: outputs, gameMs });
    }
    this.jobs = this.jobs.filter((job) => job.done < job.runs);
    return { completed, outputs: outputs };
  }

  view(): ReactorView {
    const slots = this.slots();
    return {
      slots,
      idle: this.jobs.length === 0,
      recipes: this.recipesView(),
      queue: this.jobs.map((job, index) => {
        const recipe = this.recipesRaw[job.recipeId];
        const timeMs = Math.max(Number(this.craft['minTimeSec'] ?? 5), (recipe?.time ?? 0)) * 1000;
        const active = index < slots;
        const deficit = active && job.deficit;
        return {
          id: job.id,
          recipeId: job.recipeId,
          runs: job.runs,
          done: job.done,
          progressPct: timeMs > 0 ? Math.min(100, (job.progressMs / timeMs) * 100) : 0,
          etaSec: active && !deficit && timeMs > 0 ? Math.max(0, Math.ceil((timeMs - job.progressMs) / 1000)) : null,
          state: deficit ? 'deficit' : active ? 'running' : 'queued',
        };
      }),
    };
  }

  serialize(): { jobs: readonly { id: number; recipeId: string; runs: number; done: number; progressMs: number; paidForCurrent: boolean; deficit: boolean }[]; nextJobId: number } {
    return { jobs: this.jobs.map((job) => ({ ...job })), nextJobId: this.nextJobId };
  }

  hydrate(state: { jobs?: readonly Partial<ReactorJob>[]; nextJobId?: number } | undefined): void {
    this.jobs = (state?.jobs ?? []).map((job) => ({
      id: Number(job.id ?? this.nextJobId++),
      recipeId: String(job.recipeId ?? ''),
      runs: Math.max(0, Number(job.runs ?? 0)),
      done: Math.max(0, Number(job.done ?? 0)),
      progressMs: Math.max(0, Number(job.progressMs ?? 0)),
      paidForCurrent: job.paidForCurrent === true,
      deficit: job.deficit === true,
    })).filter((job) => this.recipesRaw[job.recipeId] && job.done < job.runs);
    this.nextJobId = Math.max(this.nextJobId, Number(state?.nextJobId ?? 1));
    this.lastMs = this.now();
  }
}

function negate(amounts: Record<string, number>): ResourceAmounts {
  const out: Record<string, number> = {};
  for (const [key, value] of Object.entries(amounts)) out[key] = -(value ?? 0);
  return out;
}
