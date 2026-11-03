/**
 * ResourceLedger (ворота Этапа 2, ADR-013, GS-05-принцип): атомарность мульт-ресурсных транзакций,
 * журнал cap 200 (in-memory, не персистится), serialize/hydrate, события tx.
 */
import { describe, it, expect } from 'vitest';
import { ResourceLedger, JOURNAL_CAP } from '../src/economy/ledger';
import { EventBus } from '../src/core/eventBus';
import type { TransactionRecord } from '../src/contracts/events';

function make() {
  const bus = new EventBus({ historyCap: 50 });
  const ledger = new ResourceLedger(bus);
  return { bus, ledger };
}

describe('ResourceLedger', () => {
  it('старт: все 21 ключ = 0', () => {
    const { ledger } = make();
    const snap = ledger.snapshot();
    expect(Object.keys(snap).length).toBe(21);
    for (const v of Object.values(snap)) expect(v).toBe(0);
  });

  it('commit: положительные/отрицательные дельты, баланс не уходит в минус', () => {
    const { ledger } = make();
    expect(ledger.tryCommit({ reason: 'grant', scope: 'global', delta: { energy: 100, iron: 5.5 }, gameMs: 0 }).ok).toBe(true);
    expect(ledger.balance('energy')).toBe(100);
    const r = ledger.tryCommit({ reason: 'spend', scope: 'global', delta: { energy: -150 }, gameMs: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.insufficient).toEqual(['energy']);
    expect(ledger.balance('energy')).toBe(100);
  });

  it('GS-05: мульт-ресурсная транзакция отклоняется ЦЕЛИКОМ', () => {
    const { ledger } = make();
    ledger.tryCommit({ reason: 'grant', scope: 'global', delta: { energy: 100 }, gameMs: 0 });
    const r = ledger.tryCommit({ reason: 'mixed', scope: 'global', delta: { energy: -50, iron: -5 }, gameMs: 1 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.insufficient).toContain('iron');
    expect(ledger.balance('energy')).toBe(100); // энергия НЕ списана
    expect(ledger.balance('iron')).toBe(0);
  });

  it('события: tx:committed / tx:rejected', () => {
    const { bus, ledger } = make();
    const committed: TransactionRecord[] = [];
    const rejected: string[] = [];
    bus.on('tx:committed', (p) => committed.push(p.tx));
    bus.on('tx:rejected', (p) => rejected.push(p.reason));
    ledger.tryCommit({ reason: 'a', scope: 'global', delta: { energy: 10 }, gameMs: 0 });
    ledger.tryCommit({ reason: 'b', scope: 'global', delta: { energy: -1000 }, gameMs: 1 });
    expect(committed).toHaveLength(1);
    expect(committed[0]).toMatchObject({ id: 1, reason: 'a', delta: { energy: 10 } });
    expect(rejected).toEqual(['insufficient:energy']);
  });

  it('журнал: cap 200, только in-memory (не входит в serialize)', () => {
    const { ledger } = make();
    expect(JOURNAL_CAP).toBe(200);
    for (let i = 0; i < 250; i++) ledger.tryCommit({ reason: `t${i}`, scope: 'global', delta: { energy: 1 }, gameMs: i });
    expect(ledger.journal()).toHaveLength(200);
    expect(ledger.journal()[0]!.reason).toBe('t50');
    const ser = ledger.serialize();
    expect(JSON.stringify(ser)).not.toContain('t249');
  });

  it('serialize/hydrate roundtrip', () => {
    const { ledger } = make();
    ledger.tryCommit({ reason: 'grant', scope: 'global', delta: { energy: 42.5, steel: 7 }, gameMs: 0 });
    const ser = ledger.serialize();
    const { ledger: l2 } = make();
    l2.hydrate(ser);
    expect(l2.balance('energy')).toBe(42.5);
    expect(l2.balance('steel')).toBe(7);
    expect(l2.journal()).toHaveLength(0);
  });

  it('scope planet:* поддерживается (структура для Этапа 9)', () => {
    const { bus, ledger } = make();
    const seen: string[] = [];
    bus.on('tx:committed', (p) => seen.push(p.tx.scope));
    ledger.tryCommit({ reason: 'planet-income', scope: 'planet:ferrum', delta: { iron: 1 }, gameMs: 0 });
    expect(seen).toEqual(['planet:ferrum']);
  });
});
