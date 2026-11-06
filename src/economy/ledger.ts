/**
 * economy/ledger.ts — ResourceLedger: ЕДИНСТВЕННАЯ точка изменения балансов (ворота Этапа 2, ADR-013).
 * Атомарные транзакции (id, reason, scope, delta, gameMs); мульт-ресурсная транзакция отклоняется ЦЕЛИКОМ (GS-05).
 * Журнал — in-memory cap 200, НЕ персистится (решение Этапа 2, STAGE1 §4).
 */
import type { ResourceAmounts, LedgerResourceKey } from '../contracts/resources';
import { LEDGER_RESOURCES } from '../contracts/resources';
import type { TransactionRecord } from '../contracts/events';
import type { CommitRequest, CommitResult, EventPort, LedgerPort } from '../contracts/ports';

export type { CommitRequest, CommitResult };
export const JOURNAL_CAP = 200;

export class ResourceLedger implements LedgerPort {
  private readonly balances = new Map<LedgerResourceKey, number>();
  private readonly journalEntries: TransactionRecord[] = [];
  private nextId = 1;

  constructor(
    private readonly bus: EventPort,
    initial?: ResourceAmounts,
  ) {
    for (const k of LEDGER_RESOURCES) this.balances.set(k, 0);
    if (initial) this.applyDelta(initial);
  }

  balance(key: LedgerResourceKey): number {
    return this.balances.get(key) ?? 0;
  }

  snapshot(): ResourceAmounts {
    const out: ResourceAmounts = {};
    for (const k of LEDGER_RESOURCES) out[k] = this.balance(k);
    return out;
  }

  /** Атомарность: если ЛЮБАЯ отрицательная дельта уводит баланс ниже 0 — транзакция отклоняется целиком. */
  tryCommit(req: CommitRequest): CommitResult {
    const insufficient: LedgerResourceKey[] = [];
    for (const [key, dv] of Object.entries(req.delta)) {
      const k = key as LedgerResourceKey;
      const v = Number(dv ?? 0);
      if (!Number.isFinite(v) || v === 0) continue;
      if (v < 0 && this.balance(k) + v < 0) insufficient.push(k);
    }
    if (insufficient.length > 0) {
      this.bus.emit('tx:rejected', { reason: 'insufficient:' + insufficient.join(','), scope: req.scope, delta: req.delta });
      return { ok: false, insufficient };
    }
    this.applyDelta(req.delta);
    const tx: TransactionRecord = { id: this.nextId++, reason: req.reason, scope: req.scope, delta: { ...req.delta }, gameMs: req.gameMs };
    this.journalEntries.push(tx);
    while (this.journalEntries.length > JOURNAL_CAP) this.journalEntries.shift();
    this.bus.emit('tx:committed', { tx });
    return { ok: true, tx };
  }

  private applyDelta(delta: ResourceAmounts): void {
    for (const [key, dv] of Object.entries(delta)) {
      const k = key as LedgerResourceKey;
      const v = Number(dv ?? 0);
      if (!Number.isFinite(v) || v === 0) continue;
      const next = Math.max(0, this.balance(k) + v);
      this.balances.set(k, next);
    }
  }

  journal(): readonly TransactionRecord[] {
    return this.journalEntries;
  }

  serialize(): { balances: Record<string, number>; nextId: number } {
    const balances: Record<string, number> = {};
    for (const k of LEDGER_RESOURCES) balances[k] = this.balance(k);
    return { balances, nextId: this.nextId };
  }

  /** Replace selected balances without creating a transaction or clearing the journal (planet On/yy storage swap). */
  replaceBalances(values: Readonly<Partial<Record<LedgerResourceKey, number>>>, keys: readonly LedgerResourceKey[]): void {
    for (const key of keys) {
      const value = values[key] ?? 0;
      this.balances.set(key, typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0);
    }
  }

  hydrate(s: { balances?: Record<string, number>; nextId?: number }): void {
    if (s.balances) {
      for (const k of LEDGER_RESOURCES) {
        const v = s.balances[k];
        this.balances.set(k, typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : 0);
      }
    }
    this.nextId = typeof s.nextId === 'number' && s.nextId > 0 ? s.nextId : 1;
    this.journalEntries.length = 0;
  }
}
