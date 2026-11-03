/** Stage 5.4 — визуальные надстройки + сквозной игровой цикл одной планеты. */
import { describe, it, expect } from 'vitest';
import { buildPlanetMeshData } from '../src/renderer/planetMesh';
import { makeGame, grant } from './helpers';

describe('Stage 5.4: рельеф и Planet Vertical Slice', () => {
  it('кристаллические/аномальные клетки добавляют грани и сохраняют faceIndex → cellId', () => {
    const { game } = makeGame(15929600);
    const planet = game.worldPlanet('ferrum')!;
    const all = buildPlanetMeshData(planet);
    const neutral = buildPlanetMeshData(planet, { explored: new Set() });
    expect(all.facetCount).toBeGreaterThan(neutral.facetCount);
    expect(all.faceCellIds.length).toBe(all.facetCount);
    expect(all.positions.length).toBe(all.facetCount * 9);
    expect(all.colors.length).toBe(all.facetCount * 9);
  });

  it('полный цикл: выбрать раскрытую клетку → сканировать → улучшить → увидеть рост рельефа', () => {
    const { game } = makeGame(15929600);
    grant(game, { energy: 1_000_000, iron: 1_000_000, kriogen: 1_000_000, crystals: 1_000_000, research: 1_000_000, steel: 1_000_000, alloy: 1_000_000, silicon: 1_000_000 });
    const runtime = game.runtime('ferrum')!;
    const generated = game.worldPlanet('ferrum')!;
    const target = runtime.data.cells.find((cell) => runtime.revealed.has(cell.id) && !runtime.explored.has(cell.id) && cell.type !== 4 && cell.type !== 6);
    expect(target).toBeDefined();
    if (!target) return;

    const beforeScan = game.snapshot();
    const scan = game.dispatch('scanCell', { pid: 'ferrum', cellId: target.id });
    expect(scan.ok).toBe(true);
    const afterScan = game.snapshot();
    const scannedView = afterScan.planets.find((p) => p.id === 'ferrum')!.cells.find((c) => c.id === target.id)!;
    expect(scannedView.status).toBe('explored');
    expect(afterScan.session.scanned).toBeGreaterThan(beforeScan.session.scanned);

    const beforeMesh = buildPlanetMeshData(generated, {
      explored: runtime.explored,
      cellLevels: new Map([...runtime.cellStates].map(([id, state]) => [id, state.level])),
    });
    const upgrade = game.dispatch('upgradeCell', { pid: 'ferrum', cellId: target.id });
    expect(upgrade.ok).toBe(true);
    if (!upgrade.ok) return;
    expect(upgrade.value.level).toBeGreaterThan(0);

    const afterMesh = buildPlanetMeshData(generated, {
      explored: runtime.explored,
      cellLevels: new Map([...runtime.cellStates].map(([id, state]) => [id, state.level])),
    });
    const index = generated.cells.findIndex((cell) => cell.id === target.id);
    expect(afterMesh.cellHeights[index]).toBeGreaterThan(beforeMesh.cellHeights[index]!);
    expect(afterMesh.faceCellIds.length).toBe(afterMesh.facetCount);
    expect(game.snapshot().session.upgraded).toBeGreaterThan(0);
  });
});
