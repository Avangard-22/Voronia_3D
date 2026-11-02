/**
 * economy/ticker.ts — EconomyTicker: шаг экономики — истощение жил (домен), затем ОДНА агрегированная
 * транзакция дохода (README Этап 2; 1.x C1 — прямые += в n.*). Подписка на тики инжектится (порт),
 * домен не знает про core/GameClock. dt приходит уже клампнутым (≤500 мс — parity C1).
 */
import type { EventPort, LedgerPort, TickListener, Unsubscribe } from '../contracts/ports';
import type { IncomeContext, IncomeService } from './income';
import type { IncomeSnapshot } from '../contracts/economy';
import type { ProductionService } from './production';
import type { PlanetRuntime } from '../contracts/planets';

export interface TickerDeps {
  readonly subscribe: (listener: TickListener) => Unsubscribe;
  readonly bus: EventPort;
  readonly ledger: LedgerPort;
  readonly income: IncomeService;
  readonly production: ProductionService;
  readonly planets: () => readonly PlanetRuntime[];
  readonly incomeContext: () => IncomeContext;
  /** Этап 4: дополнительные шаги тика (surge-планировщик, синтезатор) — между истощением и доходом. */
  readonly steps?: readonly ((dtSec: number, gameMs: number) => void)[];
}

export class EconomyTicker {
  private off: Unsubscribe | null = null;
  private lastIncome: IncomeSnapshot | null = null;

  constructor(private readonly deps: TickerDeps) {}

  start(): void {
    if (this.off) return;
    this.off = this.deps.subscribe((dtMs, gameMs) => this.tick(dtMs, gameMs));
  }

  stop(): void {
    this.off?.();
    this.off = null;
  }

  /** Один шаг экономики. */
  tick(dtMs: number, gameMs: number): void {
    const dtSec = dtMs / 1000;
    const planets = this.deps.planets();
    this.deps.production.tick(planets, dtSec);
    for (const step of this.deps.steps ?? []) step(dtSec, gameMs);
    const ctx = this.deps.incomeContext();
    const { snapshot } = this.deps.income.computeIncome(planets, ctx);
    this.lastIncome = snapshot;
    const delta = this.deps.income.tickDelta(snapshot, dtSec);
    if (Object.keys(delta).length > 0) {
      this.deps.ledger.tryCommit({ reason: 'tick:income', scope: 'global', delta, gameMs });
    }
    this.deps.bus.emit('game:tick', { dtMs, gameMs });
  }

  lastIncomeSnapshot(): IncomeSnapshot | null {
    return this.lastIncome;
  }
}
