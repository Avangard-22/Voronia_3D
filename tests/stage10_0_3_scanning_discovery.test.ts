import { describe, expect, it } from 'vitest';
import { makeGame, grant } from './helpers';

describe('Stage 10.0.3 — scanning and discovery state', () => {
  it('does not expose geological type in snapshot before a cell is scanned', () => {
    const { game } = makeGame(777);
    const rt = game.runtime('ferrum')!;
    const revealed = rt.data.cells.find((cell) => rt.revealed.has(cell.id) && !rt.explored.has(cell.id))!;
    const hidden = rt.data.cells.find((cell) => !rt.revealed.has(cell.id))!;
    const view = game.snapshot().planets.find((planet) => planet.id === 'ferrum')!;
    expect(view.cells.find((cell) => cell.id === revealed.id)).toMatchObject({ status: 'revealed', type: -1 });
    expect(view.cells.find((cell) => cell.id === hidden.id)).toMatchObject({ status: 'hidden', type: -1 });
    expect(view.cells.find((cell) => cell.id === revealed.id)?.type).not.toBe(rt.data.cells[revealed.id]!.type);
  });

  it('successful scan reveals exactly the direct undiscovered neighbors and identifies the cell', () => {
    const { game } = makeGame(777);
    const rt = game.runtime('ferrum')!;
    grant(game, { energy: 1000 });
    const target = rt.data.cells.find((cell) => rt.revealed.has(cell.id) && !rt.explored.has(cell.id))!;
    const before = new Set(rt.revealed);
    const expectedAdded = target.neighbors.filter((id) => id >= 0 && id < rt.data.cells.length && !before.has(id));
    const result = game.dispatch('scanCell', { pid: 'ferrum', cellId: target.id });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(rt.explored.has(target.id)).toBe(true);
    expect(result.value.revealedAdded).toEqual(expectedAdded);
    for (const id of target.neighbors) expect(rt.revealed.has(id)).toBe(true);
    const view = game.snapshot().planets.find((planet) => planet.id === 'ferrum')!;
    expect(view.cells.find((cell) => cell.id === target.id)).toMatchObject({ status: 'explored', type: rt.data.cells[target.id]!.type });
  });

  it('failed scan leaves discovery graph, scan price and balances unchanged', () => {
    const { game } = makeGame(777);
    const rt = game.runtime('ferrum')!;
    const target = rt.data.cells.find((cell) => rt.revealed.has(cell.id) && !rt.explored.has(cell.id))!;
    const revealedBefore = [...rt.revealed];
    const exploredBefore = [...rt.explored];
    const priceBefore = game.pricing.getCurrentCost();
    const balancesBefore = ['energy', 'iron', 'research'].map((key) => game.ledger.balance(key as 'energy' | 'iron' | 'research'));
    const result = game.dispatch('scanCell', { pid: 'ferrum', cellId: target.id });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toBe('energy');
    expect([...rt.revealed]).toEqual(revealedBefore);
    expect([...rt.explored]).toEqual(exploredBefore);
    expect(game.pricing.getCurrentCost()).toBe(priceBefore);
    expect(['energy', 'iron', 'research'].map((key) => game.ledger.balance(key as 'energy' | 'iron' | 'research'))).toEqual(balancesBefore);
  });
});
