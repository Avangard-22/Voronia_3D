# STAGE 3 REPORT — Planet Domain: процедурный генератор

**Статус:** ВЫПОЛНЕН · **Дата:** 2026-11-02
**Ворота:** `lint ✓ · typecheck ✓ · check:arch ✓ · vitest 122/122 ✓ · build ✓ · build:single ✓ · check:size ✓` (итоговый прогон — в конце отчёта)

---

## 1. Что сделано

### 1.1 Генератор планет (src/planets/generator.ts, ~1050 строк)
Порт 1:1 класса `or` (@81832) и всех сопутствующих функций бандла v0.0.41 (ADR-015):

| 1.x | Порт | Назначение |
|-----|------|-----------|
| `qe` | `contracts/rng.ts mulberry32` | байт-идентичный RNG (инкремент 1831565813) |
| `Jc/Zc/Jo/wy/Nf` | `pickGeometry/pickFrequency/isUniquePlanet/planetTier/planetTierFinal` | выбор геометрии (weighted по Nn+geometryTuning), частоты, уникальности (2%), тира |
| `Qc/Rf/Lf/Bf/Of+y2` | `genDescriptors/genName/genPalette/genLore/genEvents` | дескрипторы (climate/surface/anomaly), имена ($f-слоги + Af для unique), HSL-палитра, лор-шаблоны, 3 события + polarity-оверлей реестра |
| `VorResRoll/VorCrystalEnsure` | `rollResources/crystalEnsure` | пул ресурсов (iron 1 / kriogen 0.7 / редкие rare×focus÷pen), слоты по idx, extra/fill-роллы, unique-бонус, barren (idx≥5, 10%), crystal-гарантия |
| `or._build/_geometry/_neighbors/_findStart/_biomes/_assignResources/_sortPoly/_validate/initStart` | `buildPlanet/buildGeometry/buildNeighbors/findStart/assignBiomes/assignPlanetResources/sortPoly/validateTopology/initPlanetStart` | субдивидация граней (toFixed(7)-дедуп), пулы биомов (ferrum/krios/генерируемые), жилы, research-клетка (34%), старт |
| `xf/kf/uy` | `uniqueForm/deformVertex/vertexHash` | деформация уникальных миров (ring/split — реальные; twin/noise гасятся нормализацией — так в 1.x); `uniqueForms` по умолчанию **true** |
| `ni/Dy/pl` | `applyMixedClusters/mixedParamsFor/ensureBaseFields` | смешанные миры: хот-точки → скоринг → кластеры по группам (t0/t1/t2/t3+key/t5; t4/t6 — синглтоны), мёрж-клетки, пересчёт графа/explored/revealed |
| `Tr/Qo/Ef/Pf` | `normalize/dot/cross/add3` | векторы |

### 1.2 Домен galaxy (src/galaxy/) — PARTIAL (Этап 3)
- `position.ts`: `generatePosition` (1.x Br — front/диск/спираль-ветви, 900 попыток, fallback золотого угла), `spiralArmIndex` (My), `armIdAt` (er), `nodeDistance` (lo), `INITIAL_NODE_POS` (ferrum −2.6/0/0.4, krios 3/0.6/−0.9 — core).
- `graph.ts`: `createPlanetaryGraph`, `createInitialGraph` (oi: edges [[ferrum,krios]], version 5), `hasEdge/nodeDegree/addEdge` (Hs/Jn/Us, cap 4), `linkDiscoveredNode` (Kf — включая 1.x-особенность: fallback-ребро в обход cap).

### 1.3 Оркестрация (src/core/discovery.ts)
`discoverPlanet` 1:1: Fr-счётчик (без planet_hidden и idx===100) → id `planet_NN` → build → `placePlanetInGalaxy` (Yf: позиция → узел → armId → повторный assignResources с рукавом → Kf) → initStart → ni → финальный assignResources → награда `floor(500×2.2^max(0,idx−2))🔬` (TV-6 закрыт).

### 1.4 Каталог и конфиг
- `catalog.ts`: **krios теперь в каталоге** (TV-11 закрыт) — генерируется production-генератором (seed 13045769, f3, ico, 92 клетки), паритет с planet_krios_full.json; `toPlanetData` — конвертация GeneratedPlanet → PlanetData.
- `tables.ts`: статические таблицы бандла (Nn/Ar/$f/If/Cf/Tf/Af/Qa/Dy) — сгенерированы из planetgen_tables.json + дословных дампов.
- `config`: типизированы `planet.lastVoronia`, `galaxy.gen/nodeRender`, `events.polarityWeights`, `roles.defs` (TV-28 — данные готовы, механика позже); loader валидирует новые обязательные пути.
- `contracts`: rng.ts, galaxy.ts, RESOURCE_GEN (te-таблица: rare/minPlanetIndex/hidden/legacy, порядок ключей значим), GeneratedPlanet/GeneratedCell/PlanetSpec.

### 1.5 Новая фикстура (дополнительное извлечение из бандла)
`tools/extract_stage3_names.cjs` → `fixtures/planetgen_named_v0.0.41.json`: сэмплы Этапа 0 создавались с именем «Ген-Тест», поэтому **Rf (авто-имена) не был покрыт**. Новый экстракт: 14 последовательных открытий (idx 3–16: авто-имена, позиции Br для planet_04+, рёбра Kf, barren seed 606, lastVoronia idx 15) + 6 unique-миров (seed 11/79/90/126/138/156 — имена Af, uniqueBonus-слоты, xf/kf-деформации).

## 2. Паритет — доказательства (tests/planetGenerator.test.ts, 16 тестов)

| Фикстура | Покрытие | Результат |
|----------|----------|-----------|
| planet_ferrum_full.json | ferrum (oi + initStart): 12 клеток, GS-02 revealed [0,2,1,3,6,7] | ✅ full-dump |
| planet_krios_full.json | krios: 92 клетки, t5=36/t3=13/t1=9/t2=4/t4=3/t0=27, start 40, reserve 139… | ✅ full-dump |
| planetgen_samples.json (6) | тетраэдр f1 / октаэдры f1,f3 / куб f2 / икосаэдры f5 — клетки, verts, poly-порядок, палитра, лор, события (polarity/weight), узел графа (x,y,z,armId), mixed-миры (38→32, 252→88, 20→26…) | ✅ full-dump |
| planetgen_named_v0.0.41.json | idx 3–22: имена Rf/Af/«Последняя Ворония», Jc/Zc-выборы, armId (inter/forge/life), позиции Br, рёбра Kf (16 рёбер), barren, unique-формы, mixed | ✅ |
| planetgen_determinism_check.json | seed 101 × 2 мира → идентичные дампы | ✅ |
| — | discoverReward: 500/500/1100/2420/5324/11712 | ✅ |
| — | geometryTuning-оверрайд (веса 0/0/0/100 → cube; minF=maxF=3 → f=3) | ✅ |

Ключевой момент отладки: расхождение mixed-кластеров planet_19 (43 vs 42) вскрыло, что `settings.uniqueForms` в 1.x **включён по умолчанию** — уникальные миры деформируются (xf/kf) ещё в `_geometry`. После порта деформации паритет полный.

## 3. Критерии Этапа 3 (README) — статус

- ✅ генератор планет по seed (discoverPlanet-поток, чистые функции + ctx)
- ✅ сид-детерминизм (фикстуры + тесты)
- ✅ биомы/дескрипторы (пулы феррум/криос/генерируемые, Qc, perks)
- ⚠️ роли — данные типизированы (roles.defs); **назначение роли** — механика transport/UI (TV-28, Этап 5/9)
- ✅ рукава (er/My, focus-бонусы VorResRoll, таблица из baseline)
- ✅ геометрия + тюнинг частот/веса (registry geometryTuning, тест оверрайда)
- ✅ krios + генерируемые планеты (каталог: ferrum+krios; сэмплы/named-фикстура)
- ✅ паритет с задокументированными фактами (MECHANICS_CATALOG §G переписан полностью)

## 4. Решения и отклонения

- ADR-015: байт-паритет (дословный порт, включая особенности 1.x), RNG в contracts, доменное разделение planets/galaxy/core, GeneratorCtx-инжекция, uniqueForms=true.
- Рендер-функции Js/jr не портированы (данные планеты не меняют) — появятся в renderer-домене.
- Deserialize mixed-миров (_forcedClusters) портирован, фикстуры нет — TV-26 (Этап 11).
- Сонар-превью (Zn) должен переиспользовать rollResources/crystalEnsure — TV-27 (Этап 6).

## 5. Следующий этап (4)

План по README: аномалии (ветви synth/power/resonance — TV-9), заряды type1/2 (TV-13), мутанты жил (TV-18), события планет (Of-пул уже в планете; активация/полярность — registry events), глубокие клетки (TV-19). Ворота: те же + паритет по fixtures/anomaly_types.json и charge-секции реестра.
