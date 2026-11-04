import { describe, expect, it } from 'vitest';
import { buildGalaxySystemDetail } from '../src/renderer/galaxySystemDetail';
import type { GalaxyRenderNode } from '../src/renderer/galaxyModel';

const node = (overrides: Partial<GalaxyRenderNode> = {}): GalaxyRenderNode => ({
  id: 'krios-9', seed: 90210, name: 'Криос-9', x: 2, y: 0.1, z: -4,
  discovered: true, unlocked: true, active: false, armId: 'Asterion',
  sectorId: 'inner', signalClass: 'cryo', ...overrides,
});

describe('Stage 7.3 — star system detail', () => {
  it('does not build a system display for hidden or missing nodes', () => {
    expect(buildGalaxySystemDetail(node({ discovered: false }))).toBeNull();
    expect(buildGalaxySystemDetail(null)).toBeNull();
  });

  it('creates a deterministic visual profile from a discovered graph node', () => {
    const first = buildGalaxySystemDetail(node());
    const second = buildGalaxySystemDetail(node());
    expect(first).toEqual(second);
    expect(first?.nodeId).toBe('krios-9');
    expect(first?.starClass).toBe('blue');
    expect(first?.planetColor).toBe('#8ceaff');
    expect(first?.orbitRadius).toBeGreaterThan(1.3);
  });

  it('marks anomaly systems for their additional visual treatment', () => {
    const anomaly = buildGalaxySystemDetail(node({ id: 'rift-01', signalClass: 'anomaly' }));
    expect(anomaly?.anomaly).toBe(true);
    expect(anomaly?.starClass).toBe('violet');
  });

  // Этап 9.2: подпись системы берётся из каталога, а не дублирует классы сигналов
  // (прежнее «BLUE · CRYO» читалось на панели как «BLUEBLUE»).
  it('Этап 9.2: без каталога подпись — имя подтверждённого мира, catalog null', () => {
    const detail = buildGalaxySystemDetail(node());
    expect(detail?.title).toBe('Криос-9');
    expect(detail?.catalog).toBeNull();
  });

  it('Этап 9.2: с каталожной сводкой имя/обозначение/цвет звезды берутся из каталога', () => {
    const catalog = {
      title: 'Ворантея',
      designation: 'VOR-Ζ-114',
      starColor: '#ffe39a',
      starLabel: 'yellow · 5772 K',
      temperatureK: 5772,
      luminosity: 1.02,
      planetCount: 3,
    };
    const detail = buildGalaxySystemDetail(node(), catalog);
    expect(detail?.title).toBe('Ворантея');
    expect(detail?.starColor).toBe('#ffe39a');
    expect(detail?.catalog).toEqual(catalog);
  });
});
