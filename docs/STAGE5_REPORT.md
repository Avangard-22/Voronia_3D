# STAGE5_REPORT — Галактика в игре, ядро грани, 3D-прототип (Этап 5)

**Дата:** 2026-11-02 · **Статус:** ВЫПОЛНЕН · **CI:** `npm run ci` EXIT 0 — lint/typecheck×2/check:arch (72 файла)/**199 тестов** (178 + 21 новый)/build/build:single/check:size (**0.60 МБ** ≤ 6 МБ, three r170 ≈ 0.5 МБ)

## 1. Цель и ворота

Вердикт (Этап 5): «3D-прототип планеты (сфера → поли-сетка → граф соседства), LOD/instancing, СРАЗУ замер FPS (R1)» + пункты README: discoverPlanet в командах/UI, доход type7 (TV-24), смена активной планеты. Метод — как на Этапах 2–4: экстрактор → золотая фикстура → порт → тесты.

## 2. Извлечение

`tools/extract_stage5.cjs` (харнесс boot.cjs, seed 20260501, NOW заморожен; доступ к `window.GAME`=ge, `__INT`: Ur/ce/Ws/Fr/On/yy/Gs/Ao/Ys) → **`fixtures/stage5_audit_v0.0.41.json`**: §config/§type7/§discover/§setActive/§hidden/§stateFinal.

## 3. Паритет (золотые значения — подтверждены тестами)

| Механика | Аудит 1.x | Порт 2.0 |
|---|---|---|
| type7 энергия | 100×Ws(2)=200⚡/с ВСЕГДА (deep-инвариант), ×энерго-цепь (c event) ×oh | ✅ income.ts (coreEffect-хук); 1→200, ×1.03 c зарядным баффом |
| type7 кристаллы | 0.03💎/с ×кристальная цепь ×oh | ✅ отдельная линия |
| discoverPlanet | planet_03 «Гелика-Прайм» (seed 777001): f3 octahedron, frost, 22 клетки, carbon, узел x53.0765/y0.232/z21.881, ребро→krios, 1100🔬, planetsUnlocked+1, БЕЗ автосwitch; planet_04 «Ван» 2420🔬; override cube/f2/ferrum → planet_05 (iron, inter) 5324🔬 | ✅ Game.discoverWorld (награда через ledger — ADR-017 п.3) |
| setActivePlanet | guard PLANETS+unlocked (krios locked → false); selectedCellId=null, planetPage=0, rotX=−0.08, rotY=0; своп storage On/yy (1234/77 ↔ 0/0) | ✅ команда + reject `state`; своп — Этап 9 (TV-25, ADR-017 п.5); rotX/rotY — в scene.ts |
| Скрытый мир | planet_hidden, seed=gameStartSeed^1212761156, f6 ico, idx 100, void, узел (0,12,0) | 📋 задокументирован (§J), вызов sm — Этап 10+ (TV-35) |
| Save-реплей | — (2.0-решение) | ✅ discoveredSpecs → детерминированный мир/граф (тест roundtrip) |
| 3D-прототип | — | ✅ planetMesh (поли-сетка/граф/палитра hsl+hex), scene.ts (Three r170: vertexColors+flat, InstancedMesh в LOD ×2, LineSegments, drag), FpsMeter (fps/avg/p95, окно 240) |

## 4. Артефакты

- `src/renderer/`: **planetMesh.ts** (чистый билдер: facets=Σ(poly−2), edges=Σnb/2, cellCenters/colors, hsl/hex-парсер), **fps.ts** (FpsMeter), **scene.ts** (WebGL-обвязка: LOD/instancing/drag/rotX−0.08), status → PARTIAL (Этап 5).
- `core/discovery.ts`: +createStarterWorld/starterNode (1.x oi()+$); `core/game.ts`: world-состояние, команды `discoverPlanet`/`setActivePlanet`, `worldPlanet()`/`galaxyGraph()`, snapshot.galaxy, collect/applyState (реплей спеков), session.planetsUnlocked.
- `economy/income.ts`: type7 (×Ws безусловно + кристальная линия + coreEffect-хук).
- Контракты: DiscoverPlanetResult/SetActivePlanetResult, `planet:activated`, GameSnapshot.galaxy, DiscoverySpec (schema, опц. поле v2).
- `main.ts`: canvas-сцена + RAF-цикл + FPS-оверлей + пересборка меша при смене планеты/исследовании; `ui/app.ts`: панель «Галактика» (узлы/рукава/замок/кнопка →, «🔭 Открыть мир»).
- `tools/check_arch.mjs`: allowlist `three` — только домен renderer.

## 5. Отклонения (ADR-017)

Награда через ledger (не напрямую); реплей спеков вместо дампа планет; своп storage On/yy отложен (Этап 9); krios открывается сонаром (Этап 6, TV-33 — в тестах Этапа 4 временный save-цикл); renderer — прототип (эффекты/оверлеи baseline — Этапы 6/12); `planet:activated` — 2.0-событие (в 1.x — внешний колбэк sf).

## 6. Следующий шаг — Этап 6 (Сонар + сохранение-расширения)

Сонар-миниигра (открытие krios: Q1 @251512 — scanBonus {mult,until,accuracy}, TV-27/33), сонар-заряды уже выдаются (Этап 4); при необходимости — персистенция зарядных баффов (TV-32). Данные — тот же метод.
