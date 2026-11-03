/**
 * Этап 5 — renderer: чистый билдер меш-данных + FPS-метр (вердикт R1: «сфера → поли-сетка →
 * граф соседства, LOD/instancing, замер FPS»). WebGL-обвязка (scene.ts) — смоук импорта.
 * Данные: поли-сетка клеток 1.x (Nn-триангуляция → poly/_sortPoly, порт generator.ts Этапа 3).
 */
import { describe, it, expect } from 'vitest';
import { buildPlanetMeshData, parseColor, FpsMeter, createPlanetViewer, renderPixelRatio } from '../src/renderer';
import { buildPlanet } from '../src/planets/generator';
import { STARTER_PLANET_SPECS, armsFromBalance } from '../src/planets/catalog';
import { loadBalance } from '../src/config/loader';
import type { GeneratorCtx } from '../src/planets/generator';

const balance = loadBalance();
const ctx: GeneratorCtx = { balance, arms: armsFromBalance(balance) };
const ferrum = buildPlanet({ ...STARTER_PLANET_SPECS.ferrum }, ctx);
const krios = buildPlanet({ ...STARTER_PLANET_SPECS.krios }, ctx);

describe('parseColor (палитра 1.x: hsl/hex)', () => {
  it('hex #eaf6ff → [234,246,255]/255', () => {
    const [r, g, b] = parseColor('#eaf6ff');
    expect(r).toBeCloseTo(234 / 255, 6);
    expect(g).toBeCloseTo(246 / 255, 6);
    expect(b).toBeCloseTo(1, 6);
  });
  it('hsl-оси: 0→red, 120→green, 240→blue; hsl(246,73%,50%) — по формуле', () => {
    expect(parseColor('hsl(0, 100%, 50%)')).toEqual([1, 0, 0]);
    expect(parseColor('hsl(120, 100%, 50%)')).toEqual([0, 1, 0]);
    expect(parseColor('hsl(240, 100%, 50%)')).toEqual([0, 0, 1]);
    // независимая проверка hsl(246,73%,50%): C=0.73, X=C×(1−|(246/60 mod 2)−1|)=C×0.9, m=0.135
    const [r, g, b] = parseColor('hsl(246, 73%, 50%)');
    const c = 0.73;
    const x = c * (1 - Math.abs(((246 / 60) % 2) - 1));
    const m = 0.5 - c / 2;
    // сектор 240..300 → (r,g,b)=(X,0,C)+m
    expect(r).toBeCloseTo(x + m, 6);
    expect(g).toBeCloseTo(m, 6);
    expect(b).toBeCloseTo(c + m, 6);
  });
  it('серый (s=0) и короткий hex', () => {
    expect(parseColor('hsl(0, 0%, 50%)')).toEqual([0.5, 0.5, 0.5]);
    expect(parseColor('#fff')).toEqual([1, 1, 1]);
  });
});

describe('buildPlanetMeshData (поли-сетка + граф соседства)', () => {
  it('ferrum: cellCount=12, facets=9×сегменты сторон+надстройки, edges=Σneighbors/2, размеры массивов согласованы', () => {
    const d = buildPlanetMeshData(ferrum);
    expect(d.cellCount).toBe(ferrum.cells.length);
    expect(d.cellCount).toBe(12); // GS-14: ferrum — 12 клеток
    let edges = 0;
    for (const c of ferrum.cells) edges += c.neighbors.length;
    // Контракт меша Stage 8.0.x (вместо Stage 5 «Σ poly×9 + шипы×3»):
    // каждая сторона полигона тесселируется на segments = clamp(ceil(угол/0.12), 1, 12) общих сегментов,
    // на сегмент приходится 9 треугольников склона (4 кольца × 2 + замыкающий на центр клетки).
    const sides = ferrum.cells.reduce((sum, cell) => sum + cell.poly.length, 0);
    const baseFacets = d.facetCount - d.featureTriangleCount;
    expect(sides).toBe(60); // 12 пятиугольников
    expect(d.sharedEdgeCount).toBe(edges / 2); // граф неориентированный: каждое ребро один раз
    expect(d.edgeCount).toBe(edges / 2);
    expect(sides).toBe(d.sharedEdgeCount * 2); // замкнутая поли-сетка: у каждого ребра ровно две клетки
    expect(d.tessellatedEdgeSegmentCount).toBeGreaterThanOrEqual(d.sharedEdgeCount);
    expect(baseFacets % 9).toBe(0);
    expect(baseFacets).toBe(9 * 2 * d.tessellatedEdgeSegmentCount); // по 9 треугольников на сегмент с каждой из двух сторон ребра
    expect(baseFacets).toBeGreaterThanOrEqual(sides * 9); // не меньше одного сегмента на сторону
    expect(d.featureTriangleCount).toBeGreaterThan(0); // процедурные надстройки исследованных клеток
    expect(d.facetCount).toBe(4023); // golden: детерминированная сборка Феррума (210 сегментов × 9 × 2 + 243 надстройки)
    expect(d.positions.length).toBe(d.facetCount * 9);
    expect(d.colors.length).toBe(d.facetCount * 9);
    expect(d.cellCenters.length).toBe(d.cellCount * 3);
    expect(d.cellColors.length).toBe(d.cellCount * 3);
    expect(d.cellIds.length).toBe(d.cellCount);
    expect(d.faceCellIds.length).toBe(d.facetCount);
    expect(Array.from(d.cellSideCounts)).toEqual(ferrum.cells.map((cell) => cell.poly.length));
    expect(d.cellSurfaceCenters.length).toBe(d.cellCount * 3);
    expect(d.cellHeights.length).toBe(d.cellCount);
    expect(d.edgePositions.length).toBe(d.edgeCount * 6);
    expect(d.radius).toBeGreaterThan(0.5);
    expect(d.radius).toBeLessThanOrEqual(1.1); // включает радиально поднятые клетки
  });

  it('скрытые клетки не получают маркеры и не допускают прямой выбор до reveal', () => {
    const revealed = new Set<number>([ferrum.startingCellId]);
    const d = buildPlanetMeshData(ferrum, { revealed, explored: new Set([ferrum.startingCellId]) });
    for (let i = 0; i < d.cellIds.length; i++) {
      expect(d.cellSelectable[i]).toBe(revealed.has(d.cellIds[i]!) ? 1 : 0);
    }
    expect(Array.from(d.cellSelectable).filter((v) => v === 1)).toHaveLength(1);
    expect(d.cellSelectable.length).toBe(d.cellCount);
  });

  it('krios: 92 клетки (GS-14), все центры на сфере ≤1', () => {
    const d = buildPlanetMeshData(krios);
    expect(d.cellCount).toBe(92);
    for (let i = 0; i < d.cellCount; i++) {
      const r = Math.hypot(d.cellCenters[i * 3]!, d.cellCenters[i * 3 + 1]!, d.cellCenters[i * 3 + 2]!);
      expect(r).toBeLessThanOrEqual(1.0001);
      for (let k = 0; k < 3; k++) {
        const v = d.cellColors[i * 3 + k]!;
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    }
  });


  it('рельеф: типы клеток имеют разные профили, уровень увеличивает высоту по радиальной нормали', () => {
    const base = buildPlanetMeshData(ferrum);
    const levels = new Map<number, number>(ferrum.cells.map((cell) => [cell.id, 0]));
    const upgradedCell = ferrum.cells.find((cell) => cell.type === 1)!;
    levels.set(upgradedCell.id, 16);
    const upgraded = buildPlanetMeshData(ferrum, { cellLevels: levels });
    const index = ferrum.cells.indexOf(upgradedCell);
    expect(upgraded.cellHeights[index]!).toBeGreaterThan(base.cellHeights[index]!);
    const cx = upgradedCell.center[0];
    const cy = upgradedCell.center[1];
    const cz = upgradedCell.center[2];
    const sx = upgraded.cellSurfaceCenters[index * 3]!;
    const sy = upgraded.cellSurfaceCenters[index * 3 + 1]!;
    const sz = upgraded.cellSurfaceCenters[index * 3 + 2]!;
    const cross = Math.hypot(cy * sz - cz * sy, cz * sx - cx * sz, cx * sy - cy * sx);
    expect(cross).toBeLessThan(1e-6); // поверхность смещена строго по радиусу от центра планеты
    const energy = ferrum.cells.find((cell) => cell.type === 0)!;
    const rare = ferrum.cells.find((cell) => cell.type === 2)!;
    const anomaly = ferrum.cells.find((cell) => cell.type === 4)!;
    const h = (cell: typeof energy) => base.cellHeights[ferrum.cells.indexOf(cell)]!;
    expect(h(energy)).toBeLessThan(0); // энергетическая впадина
    expect(h(rare)).toBeGreaterThan(h(energy));
    expect(h(anomaly)).toBeGreaterThan(h(rare));
  });

  it('Stage 5.4: кристаллы и аномалии получают дополнительные радиальные вершины', () => {
    const all = buildPlanetMeshData(ferrum);
    const plain = buildPlanetMeshData(ferrum, { explored: new Set(ferrum.cells.filter((c) => ![2, 4, 6, 7].includes(c.type)).map((c) => c.id)) });
    expect(all.facetCount).toBeGreaterThan(plain.facetCount);
    for (let i = 0; i < all.positions.length; i += 3) {
      const r = Math.hypot(all.positions[i]!, all.positions[i + 1]!, all.positions[i + 2]!);
      expect(r).toBeGreaterThan(0.95);
      expect(r).toBeLessThan(1.25);
    }
  });

  it('неисследованные клетки не выдают тип по форме рельефа', () => {
    const hidden = buildPlanetMeshData(ferrum, { explored: new Set() });
    const heights = Array.from(hidden.cellHeights);
    expect(new Set(heights).size).toBe(1);
    expect(heights[0]).toBeCloseTo(0.0015, 6);
  });

  it('карта faceIndex → cellId сохраняется при рельефной триангуляции', () => {
    const d = buildPlanetMeshData(ferrum);
    // Точное число треугольников на клетку зависит от тесселяции её сторон и от процедурных надстроек,
    // поэтому проверяется инвариант pickable-меша: треугольники каждой клетки идут сплошным блоком
    // в порядке planet.cells, и блоки исчерпывают меш целиком.
    let offset = 0;
    for (const cell of ferrum.cells) {
      const start = offset;
      while (offset < d.faceCellIds.length && d.faceCellIds[offset] === cell.id) offset++;
      const block = offset - start;
      expect(block).toBeGreaterThanOrEqual(cell.poly.length * 9); // минимум один сегмент на сторону
      expect(Array.from(d.faceCellIds.slice(start, offset)).every((id) => id === cell.id)).toBe(true);
    }
    expect(offset).toBe(d.facetCount);
  });

  it('детерминизм: две сборки идентичны бит-в-бит', () => {
    const a = buildPlanetMeshData(ferrum);
    const b = buildPlanetMeshData(ferrum);
    expect(Array.from(a.positions)).toEqual(Array.from(b.positions));
    expect(Array.from(a.colors)).toEqual(Array.from(b.colors));
    expect(Array.from(a.cellIds)).toEqual(Array.from(b.cellIds));
    expect(Array.from(a.faceCellIds)).toEqual(Array.from(b.faceCellIds));
    expect(Array.from(a.edgePositions)).toEqual(Array.from(b.edgePositions));
    expect(a.facetCount).toBe(b.facetCount);
  });

  it('explored-опция: исследованная клетка — из explored-палитры, неисследованная — нейтральной (Stage 8.0.2)', () => {
    const t0 = ferrum.cells.find((c) => c.type === 0)!;
    const exploredColor = parseColor(ferrum.palette.explored[String(t0.type)] ?? ferrum.palette.border);
    const unexploredColor = parseColor(ferrum.palette.unexplored[String(t0.type)] ?? ferrum.palette.border);
    expect(exploredColor).not.toEqual(unexploredColor); // палитры 1.x различаются
    const idx = ferrum.cells.indexOf(t0);
    const rgbOf = (d: ReturnType<typeof buildPlanetMeshData>, i: number): number[] => [d.cellColors[i * 3]!, d.cellColors[i * 3 + 1]!, d.cellColors[i * 3 + 2]!];

    const all = buildPlanetMeshData(ferrum); // без опции — все explored
    expect(rgbOf(all, idx)).toEqual([Math.fround(exploredColor[0]), Math.fround(exploredColor[1]), Math.fround(exploredColor[2])]);

    // Отклонение от 1.x (Stage 8.0.2): per-type unexplored-палитра раскрыла бы тип клетки до исследования.
    // Неисследованная, но открытая для взаимодействия клетка получает единый нейтральный тон от palette.border.
    const border = parseColor(ferrum.palette.border);
    const revealedTint = [border[0] * 0.72 + 0.12, border[1] * 0.72 + 0.16, border[2] * 0.72 + 0.2];
    const none = buildPlanetMeshData(ferrum, { explored: new Set() });
    expect(rgbOf(none, idx)).toEqual(revealedTint.map((v) => Math.fround(v)));
    expect(new Set(ferrum.cells.map((_, i) => rgbOf(none, i).join(','))).size).toBe(1); // тип не читается из цвета

    // Полностью скрытая клетка темнее и тоже одинакова для всех типов.
    const dark = buildPlanetMeshData(ferrum, { explored: new Set(), revealed: new Set() });
    expect(rgbOf(dark, idx)).toEqual([0.035, 0.055, 0.075].map((v) => Math.fround(v)));
    expect(new Set(ferrum.cells.map((_, i) => rgbOf(dark, i).join(','))).size).toBe(1);
    expect(rgbOf(dark, idx)).not.toEqual(rgbOf(none, idx));
  });
});

describe('FpsMeter (замер R1)', () => {
  it('ровные 16.7мс → ~60 FPS; p95=avg', () => {
    const m = new FpsMeter();
    for (let i = 0; i <= 60; i++) m.sample(i * (1000 / 60));
    const s = m.stats();
    expect(s.frames).toBe(60);
    expect(s.fps).toBeCloseTo(60, 0);
    expect(s.p95FrameMs).toBeCloseTo(s.avgFrameMs, 6);
  });
  it('спайки: 20 кадров (18×10мс + 2×100мс) → p95=100, target mobile 30 FPS/p95<33мс нарушен', () => {
    const m = new FpsMeter();
    let t = 0;
    m.sample(t);
    for (let i = 0; i < 18; i++) { t += 10; m.sample(t); }
    for (let i = 0; i < 2; i++) { t += 100; m.sample(t); }
    const s = m.stats();
    expect(s.frames).toBe(20);
    expect(s.p95FrameMs).toBe(100);
    expect(s.avgFrameMs).toBeCloseTo(19, 6);
  });
  it('окно cap: старые кадры вытесняются; reset очищает', () => {
    const m = new FpsMeter(10);
    for (let i = 0; i <= 30; i++) m.sample(i * 16);
    expect(m.stats().frames).toBe(10);
    m.reset();
    expect(m.stats().frames).toBe(0);
    expect(m.stats().fps).toBe(0);
  });
});

describe('scene.ts (WebGL-обвязка)', () => {
  it('смоук: модуль импортируется в node (three r170), createPlanetViewer — функция', () => {
    expect(typeof createPlanetViewer).toBe('function');
  });
});


describe('renderPixelRatio (Stage 5.6 mobile GPU guard)', () => {
  it('ограничивает DPR мобильного viewport значением 1.5', () => {
    expect(renderPixelRatio(3, 390)).toBe(1.5);
  });
  it('ограничивает DPR desktop значением 2', () => {
    expect(renderPixelRatio(3, 1440)).toBe(2);
  });
  it('сохраняет нативный DPR ниже лимита', () => {
    expect(renderPixelRatio(1.25, 390)).toBe(1.25);
  });
  it('использует безопасное значение для некорректного DPR', () => {
    expect(renderPixelRatio(Number.NaN, 390)).toBe(1);
  });
});
