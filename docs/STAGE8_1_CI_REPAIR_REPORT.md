# Stage 8.1 — Ремонт CI-контура и связности галактики

**Дата:** 2026-11-03 · **Ветка:** `fix/ci-green-and-tests` · **Основание:** аудит `HEAD=bea95f8`, решения — `docs/adr/adr-018.md`

## 1. Что было сломано (воспроизведено локально, а не по логам)

| Симптом | Фактическая причина |
|---|---|
| GitHub Actions: 36 запусков, шаг «Build game» — failure, Pages не деплоятся | `npm run build` = `tsc --noEmit && vite build`; падал **tsc**, до vite дело не доходило |
| 30 ошибок `tsc`, 1089 ошибок `eslint` | `three@0.170.0` не поставляет `.d.ts`, а `@types/three` отсутствовал в devDependencies (TS7016 + implicit-any по всему `renderer/`) |
| 12 оставшихся ошибок типов | реальные дефекты: `Map` из `Uint32Array.map` (кортеж выводился как `number[]`), `hit.faceIndex: number \| null` под индексом, `flightPoints[0]` без guard, `number[][]` вместо кортежа в `surfaceStreamingPolicy`, неиспользуемая переменная, арифметика по `Uint32Array` в тесте |
| `npm run lint` / `build:single` / `ci` не запускаются | последние 4 коммита через веб-интерфейс удалили `README.md`, `eslint.config.js`, `vite.config.single.ts`, `vitest.config.ts`; в `package.json` добавлен пробел перед `{` |
| 13 из 349 тестов красные | 4 — реальный баг связности галактики; 1 — регрессия классификации аномалий; 3 — устаревшие ожидания рендера Этапа 5; 3 — сломанные сами тесты; 1 — контракт снапшота логистики; 1 — петля в рендер-графе |
| `vitest.config.ts` удалён → `testTimeout` 5 с вместо 20 с | рендер-тесты уже шли до 2,4 с: запас был на исходе |

Причина накопления: в отчётах Этапов 6–8 прямо указано, что полный Vitest и production build **не запускались** (нет `node_modules` в рабочем окружении). Код последних этапов не проверялся ни тестами, ни компилятором.

## 2. Главный дефект: недостижимая открытая планета

```
после dispatch('discoverPlanet', { seed: 777001 }):
  nodes: ferrum(discovered) · krios(NOT discovered) · planet_03(discovered)
  edges: [ferrum ↔ krios] [planet_03 ↔ krios]
  setActivePlanet('planet_03') → { ok:false, reason:'state',
      detail:'Маршрут отсутствует: между открытыми системами нет непрерывной цепочки переходов' }
  validateIntegrity() → { ok:false, issues:[ unreachable-unlocked-planet (ferrum из planet_03) ] }
```

Новый мир линкуется на геометрически ближайший узел (`linkDiscoveredNode`), которым оказывается скрытый Криос-9.
Роутер Этапа 6.6 требовал цепочку исключительно из `unlocked`-узлов → долететь до открытой планеты нельзя,
обратный перелёт на Феррум через галактическую карту — тоже, а валидатор Stage 6.8 помечал полученное
легальными командами состояние как повреждённое (и оно уходило в save). Жёсткого soft-lock не было только
потому, что `main.ts` для карточки системы использует `travelWithinSystem` в обход проверки маршрута.

**Решение (ADR-018):** транзит через неоткрытые системы с надбавкой (1.5× нанесённый на карту узел,
2.5× неизученный) + сжатие маршрута до остановок, чтобы `activePlanetId` никогда не указывал на мир без runtime.
Валидация и роутер используют одну и ту же карту связности (`buildChartedComponents`).

## 3. Изменения в `src/`

| Файл | Изменение |
|---|---|
| `galaxy/routes.ts` | транзитная маршрутизация + сжатие пути до остановок; `RouteSearchOptions.allowTransit`; `transitMultiplier`; `buildChartedComponents`; `ROUTE_POLICY.{lockedTransitMultiplier, blindTransitMultiplier}` |
| `galaxy/validation.ts` | достижимость и `route-uses-nonedge` считаются по общей с роутером карте связности |
| `galaxy/anomalies.ts` | `kindFor`: геометрия важнее биома (мир «rift anomaly / void» снова tier-1 `rift`, а не `living-void`) |
| `logistics/service.ts` | `pruneEmpty`: пустых стопок в грузе/депо не существует (канон совпал с `hydrate`) |
| `renderer/galaxyModel.ts` | фильтр петель `a === b` в рендер-граф |
| `renderer/scene.ts` | кортеж для `new Map` (`Array.from` по `Uint32Array`), guard `faceIndex == null` (два места) |
| `renderer/galaxyScene.ts` | guard первой точки маршрута перед `position.copy` |
| `renderer/surfaceChunks.ts` | убран неиспользуемый деструктурированный `values` |
| `renderer/surfaceStreamingPolicy.ts` | `sums` как `[number, number, number][]`, инкремент `counts` под `noUncheckedIndexedAccess` |
| `renderer/scene.ts` (lint) | `onBeforeCompile` через `.bind(material)` (unbound-method) |
| `core/game.ts` | `rounds: readonly number[]` вместо `Array.isArray`-сужения к `any[]`; `transitNodeIds` в результате перелёта |
| `contracts/galaxy.ts`, `contracts/commands.ts` | `GalaxyRoute.transitNodeIds?`, `TravelToPlanetResult.transitNodeIds`; inline `import()`-тип заменён на type-import |
| `main.ts` | типизированный fallback `cellStates`, убраны лишние экранирования кавычек |
| `package.json`, `package-lock.json` | `@types/three@^0.170.0`, убран мусорный пробел |
| `.gitignore` (новый) | `node_modules/`, `dist/`, `dist-single/`, `coverage/`, `*.tmp` |
| удалён `src/ui/styles.ts.tmp` | пустой мусорный файл |
| восстановлены | `README.md`, `eslint.config.js`, `vite.config.single.ts`, `vitest.config.ts` (из `468e8b4`) |

## 4. Изменения в `tests/`

| Файл | Что и почему |
|---|---|
| `stage8_1_galaxy_transit.test.ts` (новый, 5) | регрессия связности: достижимость открытого мира через скрытый узел, возврат, запрет посадки в транзитной системе, целостность runtime и save после `activateOrbitalBody`, надбавка за транзит |
| `stage6_6_expedition_routes.test.ts` (+2) | транзитный маршрут: сжатие пути, `transitNodeIds`, надбавка, сохранение контракта 6.6 за `allowTransit: false`, разница «изученный vs слепой» транзит |
| `stage5_discovery.test.ts` (2) | зафиксировано отклонение 2.0: переключение платное и возвращает сводку маршрута (`toMatchObject` вместо `toEqual`), 1.x-фикстура аудита сохранена как запись parity |
| `stage5_renderer.test.ts` (3) | контракт меша Stage 8.0.x через `tessellatedEdgeSegmentCount`/`featureTriangleCount`/`sharedEdgeCount` + golden 4023 для Феррума; инвариант сплошных блоков `faceIndex → cellId`; новая модель цвета неисследованных клеток (нейтральный тон, тип не раскрывается) |
| `stage8_0_2_cell_visual_states.test.ts` | разнообразие сторон проверяется на сгенерированном мире: Феррум — строгий додекаэдр (12×5), ассерт был непроходим по построению |
| `stage8_0_15_polygon_streaming.test.ts` | `Array.prototype.flat` не разворачивает `Uint32Array[]` → `sort((a, b) => a - b)` сравнивал NaN; заменено на `flatMap(Array.from)` |
| `stage6_8_galaxy_validation.test.ts` | в фикстуре `a` и `b` были соединены, поэтому `unreachable-unlocked-planet` не мог возникнуть; добавлен изолированный открытый узел `c` |
| `stage8_0_13_surface_chunks.test.ts` | заглушка `yieldControl` без `async` (require-await) |

## 5. Результат прогона `npm run ci` (node 20.20.2)

```
lint                0 ошибок (было 1089 → 39 → 0)
typecheck (app)     0 ошибок (было 30)
typecheck (node)    0 ошибок
check:arch          OK (104 файла, слои/циклы/границы доменов чисты)
vitest              356 passed / 356 (60 файлов) — было 336/349
build               dist/assets/index-*.js 773.91 КБ (gzip 219.61 КБ) + worker 1.61 КБ
build:single        dist-single/index.html 774.24 КБ (gzip 219.79 КБ)
check:size          OK 0.74 МБ ≤ 6 МБ
```

## 6. Ограничения и что осталось

- **Браузерная/WebGL/Android-приёмка не выполнялась** (как и на Этапах 5–8): тесты покрывают чистые доменные функции и билдеры данных, `scene.ts`/`galaxyScene.ts` — только смоук импорта и типы. TV-36 (FPS на целевом Android) остаётся OPEN.
- Множители транзита (1.5 / 2.5) выбраны из соображения «изученный маршрут дешевле слепого, но транзит не должен быть стеной». Нужен замер на живом билде: для Феррум → Гелика-Прайм стоимость перехода ≈ 24,5 тыс. ⚡.
- UI не показывает `transitNodeIds` (подсказка «перелёт через неизученную систему») — кандидат Этапа 12.
- Ветка `vite build` предупреждает о чанке > 500 КБ (three.js не вынесен в отдельный chunk) — не ошибка, но `manualChunks` уменьшил бы первый пейнт.
- История коммитов исходного репозитория — «Add files via upload»/правки через веб: `git bisect` невозможен. Рекомендация: работать ветками и обычными коммитами, CI-скрипт `npm run ci` запускать локально перед пушем.
