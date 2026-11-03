# Stage 8.0.22 — Surface Streaming Stress Lab & Performance Benchmark

## Цель

Добавить воспроизводимый CPU-side стенд для измерения основных этапов подготовки поверхности и проверки существующего frame-budgeted streaming runtime. Стенд работает на настоящем `GeneratedPlanet` и настоящем `buildPlanetMeshData`; не подменяет исходные `cell.poly` тестовой гекс-сеткой и не меняет игровое состояние.

## Реализация

- `src/renderer/surfaceStressLab.ts`
  - `benchmarkPlanetSurface(planet, options)` — отдельный прогон по уровням procedural feature detail `0/1/2`.
  - `runSurfaceStressSuite(planets, options)` — последовательный прогон набора планет.
  - измеряет CPU-время построения меша, polygon-aware chunk plan, сборки surface chunks и серии LOD-переходов;
  - фиксирует фактические число клеток/треугольников/вершин/чанков, гистограмму сторон полигонов, cross-chunk adjacency, байты геометрии и результаты staging runtime;
  - проверяет frame-budgeted установку чанков и сценарий намеренно недостаточного staging budget.
- Экспортировано через `src/renderer/index.ts`.
- Добавлены тесты `tests/stage8_0_22_surface_stress_lab.test.ts` на реальной планете Krios, построенной production-генератором.
- Версия проекта: `2.0.0-stage8.0.22`.

## Что измеряется

| Метрика | Значение |
|---|---|
| `meshBuildMs` | CPU-время `buildPlanetMeshData` |
| `chunkPlanMs` | CPU-время построения графового polygon-aware плана |
| `chunkBuildMs` | CPU-время разбиения triangle soup на чанки |
| `lodSweepMs` | CPU-время 5 500 обновлений контроллера Near/Mid/Far |
| `estimatedGpuBytes` | расчётная оценка по существующей модели `surfaceBudget`, не показание GPU-драйвера |
| `chunkBytes` | фактическая сумма `byteLength` подготовленных typed arrays чанков |
| `runtimePeakStagingBytes` | байты подготовленного staging runtime на момент снимка |
| `budgetExceeded` | runtime отклонил staging из-за заданного лимита |

## Инварианты

- Исходные `cell.poly` не меняются и не нормализуются до шестиугольников.
- Гистограмма сторон полигонов берётся из `PlanetMeshData.cellSideCounts`.
- Chunk plan группирует целые клетки по графу соседства; максимальный размер настраивается (по умолчанию 48).
- LOD-прогон тестирует существующий hysteresis controller; он не меняет базовую топологию клеток.
- Staging runtime получает чанки из реального mesh build; benchmark не подключается к live scene и не меняет сохранение.

## Проверки и ограничения

- `node tools/check_arch.mjs` — PASS (102 файла; слои/циклы/границы доменов чисты).
- Изолированная строгая компиляция TypeScript для нового стенда и его импортируемых renderer-модулей — PASS.
- Полный Vitest/Vite build не запускался: зависимости проекта (`node_modules`) в рабочей копии отсутствуют.
- Browser/WebGL, реальный FPS, GPU/VRAM и мобильные устройства не измерялись. Время в отчётах стенда — CPU-время текущей среды.
- Набор тестов использует production-generated Krios (92 клетки); API принимает произвольный массив `GeneratedPlanet`, чтобы запускать более крупные и разнообразные сценарии по мере добавления генераторных fixtures.
- Внутри harness `yieldControl` отключён для повторяемого CPU-замера; это измерение стоимости работы, а не отзывчивости браузерного event loop.

## Вывод

Stage 8.0.22 добавляет измерительный слой поверх существующих построителей и streaming runtime. Он позволяет сравнивать feature detail tiers и выявлять CPU/memory регрессии без вмешательства в игровую логику. Реальные GPU/FPS выводы следует делать только после отдельного browser/WebGL прогона на целевых устройствах.
