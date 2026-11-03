/**
 * tests/helpers.ts — сборка Game для тестов: ManualDriver (ручные тики), MemoryStorage, фиксированный seed.
 * Фикстуры читаются через fs (import JSON из fixtures/ в tests запрещён только для src — check_arch R6).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Game } from '../src/core/game';
import { ManualDriver } from '../src/core/gameClock';
import { MemoryStorage } from '../src/persistence/storage';
import { loadBalance } from '../src/config/loader';
import { buildCatalog } from '../src/planets/catalog';
import type { LedgerResourceKey } from '../src/contracts/resources';

export const TEST_SEED = 15929600; // seed ferrum v0.0.41
export const FIXTURES_DIR = join(import.meta.dirname, '..', 'fixtures');

export interface TestGame {
  game: Game;
  storage: MemoryStorage;
  driver: ManualDriver;
}

export function makeGame(seed: number = TEST_SEED): TestGame {
  const storage = new MemoryStorage();
  const driver = new ManualDriver();
  const game = new Game({
    balance: loadBalance(),
    catalog: buildCatalog(),
    storage,
    clockDriver: driver,
    rngSeed: seed,
  });
  return { game, storage, driver };
}

export function grant(game: Game, delta: Partial<Record<LedgerResourceKey, number>>): void {
  const res = game.dispatch('grant', { delta, reason: 'test-grant' });
  if (!res.ok) throw new Error(`grant отвергнут: ${res.reason} ${res.detail ?? ''}`);
}

/** Прогнать N тиков по dtMs. */
export function advance(game: Game, ticks: number, dtMs = 500): void {
  for (let i = 0; i < ticks; i++) game.advance(dtMs);
}

export function fixture<T = unknown>(name: string): T {
  return JSON.parse(readFileSync(join(FIXTURES_DIR, name), 'utf8')) as T;
}

export const closeTo = (a: number, b: number, eps = 1e-9): boolean => Math.abs(a - b) <= eps;
