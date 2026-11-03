# VORONIA 2.0 · ЭТАП 1 — ОТЧЁТ О ПОСТАВКЕ

**Дата:** 2026-10-23 · **Основание:** ТЗ §15 «Этап 1 — Каркас и контракты», §14.1 (вертикальные срезы), §19 (сделано/проверено)
**Baseline:** v0.0.41 (ADR-003) · **Баланс-набор:** `v0.0.41` (ADR-011) · **Слои:** матрица ADR-012, контроль `tools/check_arch.mjs`

**Ворота Этапа 1 (ТЗ §15): «Build/typecheck/tests проходят; слои разделены» — ВЫПОЛНЕНО**
(подтверждено прогоном `npm run ci`: eslint → tsc×2 → check:arch → vitest 93/93 → vite build → vite build single-file).

---

## 1. Сделано

### Каркас проекта

- Vite 6 + TypeScript ~5.8 **strict** (`noUncheckedIndexedAccess`, `verbatimModuleSyntax`, `isolatedModules`, `noImplicitOverride`, …), ESLint 9 flat + typescript-eslint **recommendedTypeChecked**, Prettier, lock-файл (`package-lock.json`).
- Все 14 доменов ТЗ §3.2 присутствуют: `contracts`, `core`, `config`, `economy`, `planets`, `progression`, `persistence`, `ui` — реализованы; `galaxy`, `logistics`, `combat`, `crafting`, `renderer`, `audio` — контракты/статусы **NOT_IMPLEMENTED** (ТЗ §19) с привязкой к этапам и данным Этапа 0 (ADR-009 для боя, TV-21 для крафта).
- CI: `.github/workflows/ci.yml` (lint, typecheck, check:arch, vitest, build, build:single, артефакты dist/dist-single).

### Ядро (ТЗ §3.1)

- **EventBus** — типизированные payload (`GameEventMap`, 9 событий), изоляция ошибок обработчиков, кольцевая история (cap из registry `bus.historyCap`=50).
- **GameClock** — централизованное игровое время: пауза/скорость, кламп огромного dt (throttling/сон → `stalledRealMs` в фонд офлайн-расчёта Этапа 11), драйверы `RafDriver` (браузер) и `ManualDriver` (тесты), serialize/hydrate.
- **Rng** — mulberry32, seedable, сериализуемый (состояние в сейве), `fork(label)`, детерминизм. Примечание: алгоритм 1.x другой — совпадение последовательностей с baseline не требуется (GS-исключение «gameStartSeed»), требуется детерминизм 2.0.
- **Logger** — уровни, кольцевой буфер, sinks.
- **Game facade** — DI-сборка доменов, роутер типизированных команд `dispatch<C>` с `CommandResultMap`, `newGame/scanCell/grant/save/load/export/import/snapshot/destroy`.

### Конфиги (ADR-011)

- Набор `src/config/data/balance/v0.0.41/`: `registry.json` (копия реестра VORONIA_BALANCE, 37 секций) + `baseline.json` (производные константы среза с provenance-разметкой).
- Загрузчик с runtime-валидацией (fail-fast, список путей проблем), контроль GS-12-значений тестом.

### Вертикальный срез «новая игра → скан клетки» (ТЗ §14.1)

- **economy/ResourceLedger** — единственная точка изменения балансов: атомарные транзакции (id, reason, scope, delta, gameMs), журнал (cap), события committed/rejected, serialize/hydrate, scope-изоляция (global/planet — база GS-11).
- **planets** — `loadPlanetData` (валидатор графа: уникальность id, симметрия соседства, без self-loop, старт существует), каталог (ferrum — реальные данные v0.0.41), `ExplorationService` (GS-02 старт, guards hidden/state/unknown-cell, атомарное списание, раскрытие первого кольца, ветвь аномалии, события).
- **progression/ScanPricing** — модель цены скана baseline (см. provenance ниже), кламп роста 1.03–1.30, формула науки, free-окно (hook Этапа 7).
- **persistence** — новая схема сейва `voronia2.save` v1 (ADR-003): envelope (format/saveVersion/gameVersion/savedAt/gameMs/rng/balanceId/payload), валидатор с инвариантами (explored ⊆ revealed, ресурсы ≥ 0, уникальность), SaveManager (backup перед перезаписью, fallback main→backup, повреждённый сейв не перезаписывает источник, export/import с лимитом размера), MemoryStorage + localStorage-адаптер.
- **ui** — рабочий экран среза (boot «Новая игра/Продолжить» + seed, HUD ресурсов/цены скана/часов, панель клеток со статусами hidden/revealed/explored и кнопкой скана, журнал событий, NOT_IMPLEMENTED-блок), рендер строго из `snapshot()`, действия строго `dispatch()`. Мобильный профиль — media-query (ADR-001).
- **Сборки:** `dist/` (модульная, 86,5 КБ JS + 3,1 КБ CSS, sourcemap) и `dist-single/index.html` (**90 КБ**, gzip 29,8 КБ) — бюджет Q3 (≤6 МБ) выполнен с огромным запасом.

## 2. Проверено (runtime, `npm run ci` — всё зелёное)

| Проверка                        | Результат                  |
| ------------------------------- | -------------------------- |
| ESLint (recommendedTypeChecked) | 0 ошибок                   |
| tsc strict ×2 проекта           | 0 ошибок                   |
| check:arch (55 файлов)          | слои разделены, циклов нет |
| **Vitest: 13 файлов, 93 теста** | **93/93 passed** (~4 с)    |
| vite build / build:single       | обе сборки OK              |

### Parity с baseline (тесты привязаны к фикстурам Этапа 0, не к хардкоду)

- **GS-01** (`Game.newGame.test.ts`, `Game.parity.test.ts` vs `golden_save_fresh_v0.0.41.json`): все ресурсы 0 (20 ресурсов сверяются с полями fresh-сейва: top-level + extraResources + compoundResources), `currentCost=10`, `activePlanetId=ferrum`, `unlockedPlanets=[ferrum]`, MAX_LEVEL↔`limits.maxCellLevel`=100.
- **GS-02**: ferrum `explored=[0]`, `revealed=[0,2,1,3,6,7]` — **включая порядок вставки** 1.x (сверка с fresh-сейвом и runtime-дампом `planet_ferrum_full`).
- **GS-03** (`Game.scanSlice.test.ts` + реплей `golden_scenario_log.json` в `Game.parity.test.ts`): trail клеток 1→2→3: цены **9, 9, 10**; дельты энергии **−9, −9, +990** (аномалия type4: +1000⚡ награда, наука не начисляется [S]); `currentCost 10→13`; `explored=[0,1,2,3]`; `revealed=10`; 3 события `cell:scanned` с полными payload; `session.scanned=3`.
- **Guards/атомарность (§16.1.2/§16.1.5):** повтор → `reason:'state'`; скрытая → `'hidden'`; нехватка → `'energy'` и **ни один баланс/счётчик не меняется**; мульт-ресурсная транзакция ledger отклоняется целиком (GS-05 принцип).
- **Round-trip (§12):** save → wipe (новая игра) → load = snapshot совпадает побайтово (deep equal); повторный save создаёт backup; битый main восстанавливается из backup; 1.x-сейв (version:39) схемой 2.0 отклоняется (миграция — Этап 14).
- **Детерминизм:** две игры с seed 777 → идентичные snapshot; Rng round-trip состояния продолжает последовательность.
- **Данные планеты:** распределение типов ferrum {0:7,1:1,2:1,3:2,4:1} = planets_summary; граф соседства симметричен; битые данные отклоняются с кодами `planet.*`.

## 3. Provenance констант среза (ТЗ §14.2 traceability)

| Константа                   | Значение                      | Источник                                                                                  | Статус                                    |
| --------------------------- | ----------------------------- | ----------------------------------------------------------------------------------------- | ----------------------------------------- |
| scan.baseCost               | 10                            | ТЗ §5.3/Прил.A; anchor `baseCost:10`                                                      | [S]                                       |
| scan.growthDefault          | 1.15                          | `window.__LvScanGrowth()` fresh                                                           | [R]; полная кривая — **TV-1 OPEN**        |
| scan.growthMin/Max          | 1.03 / 1.30                   | `Math.max(1.03,Math.min(1.3,g))` @576632                                                  | [R]                                       |
| scan.chargeDiscount         | 0.9                           | golden trail (списано 9 при currentCost 10); источник множителя не извлечён               | [R]-поведение, **TV-2 OPEN**              |
| scan.rounding               | floor                         | гипотеза TV-3: **4/4 точки golden trail** (9, 9, 10 → 13) сходятся только с floor-на-шаге | **TV-3 OPEN** (модель закреплена тестами) |
| scan.science                | min(10, 1+floor(charge/1000)) | anchor `scan.science_formula` (неаномальные клетки)                                       | [S]                                       |
| anomaly.energyInstantReward | 1000                          | golden trail GS-03 (дельта −990 при цене 10)                                              | [R]; каталог ветвей — **TV-9 OPEN**       |
| start.*                     | ferrum/[ferrum]/нули          | golden_save_fresh                                                                         | [R]                                       |
| limits.maxCellLevel         | 100                           | `MAX_LEVEL:100` fresh-сейв                                                                | [R]                                       |
| bus.historyCap              | 50                            | registry `bus.historyCap`                                                                 | [R]                                       |

## 4. Не сделано (осознанные границы Этапа 1)

- **krios не входит в каталог**: в фикстурах только сводка (92 клетки), полной геометрии нет — выдумывать запрещено (ТЗ §1.4). Отклонение от GS-01 «planets: ferrum + krios» — krios появится на Этапе 3 с production-генератором (TV-11).
- Не смоделированы (по этапам ТЗ §15): warehouseLevel/tech/prestige/weekly/achievements (в fresh-parity сверяются только поля среза), добыча/доход (Этап 6), планетный storage (Этап 6), крафт (Этап 8, блокер TV-21), бой (Этап 10, ADR-009), офлайн (Этап 11), 3D (Этап 5), аудио (Этап 13), миграция 1.x v39 (Этап 14).
- Журнал ledger не персистится (in-memory, cap 200) — решение о персистировании хвоста журнала примет Этап 2.
- Playwright E2E не подключён (тяжёлая зависимость; срез покрыт vitest; E2E — с Этапа 12 по карте ТЗ).
- Автозапуск часов в тестах не нужен (ManualDriver/advance); income-tick (fixed-step accumulator) добавится в Этапе 2 вместе с производством.

## 5. Не проверено

- Визуальный прогон UI в реальном браузере (typecheck+build прошли; ручной/E2E прогон — после Этапа 5/12; скриншот-ревью можно сделать уже сейчас через `npm run dev`).
- Поведение на реальных мобильных устройствах (ADR-001; media-query есть, прогон — Этап 12).
- GitHub Actions вживую (workflow написан, локальный эквивалент `npm run ci` зелёный).

## 6. Запуск

```bash
cd voronia2
npm ci                 # или npm install
npm run dev            # http://localhost:5173 — экран среза «Новая игра → Скан»
npm run ci             # lint + typecheck + check:arch + 93 теста + build + single-file
npm run build:single   # dist-single/index.html (90 КБ, самодостаточный)
```

## 7. Следующий шаг — Этап 2 (Core и Economy)

1. Закрыть блокеры TV-1, TV-2, TV-3 (извлечение формул из монолита с offset+runtime-подтверждением) и TV-21 (для плана Этапа 8).
2. ResourceLedger+: доходы/сек, производство из cellStates, резервы/лимиты склада, `recomputeIncome` parity (GS-07 офлайн-контур — Этап 11).
3. Апгрейд клетки L1→L5 (кривая 0/96/336/840/1680 — GS-04) + hardcore-цены после L10.
4. Персистирование журнала транзакций (решение принять в Этапе 2).
