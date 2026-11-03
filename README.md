# VORONIA 2.0 · Проектная папка

> **Статус на 2026-11-03 (Этап 9.0):** `npm run ci` зелёный целиком — lint 0, typecheck (app+node) 0,
> `check:arch` OK (105 файлов), **Vitest 388/388**, `build` 789.57 КБ (gzip 225.11 КБ),
> `check:size` 0.75 МБ ≤ 6 МБ. Версия `2.0.0-stage9.0.0`.
> **Этап 9.0 — слой звёздных систем:** галактика теперь состоит из **39 звёздных систем и 112 планет** (центральная звезда-аналог Солнца +
> системы игровых планет + 36 фоновых систем на спиральных рукавах), в каждой **1–5 планет на орбитах** вокруг
> звезды с реальными орбитальными элементами и кеплеровыми периодами. Диск галактики, ядро и дистанция камеры
> строятся от фактического радиуса карты систем (раньше — от константы 18, из-за чего галактика выглядела пустой).
> Подробно: `docs/STAGE9_0_REPORT.md` · решения: `docs/adr/adr-019.md`.
>
> **Этап 8.1 (предыдущий):** `npm run ci` впервые зелёный целиком — Vitest 356/356, `build` 773.91 КБ.
> Починено: отсутствующий `@types/three` (из-за него падал `tsc`, а вместе с ним шаг «Build game» в GitHub Actions
> и деплой на Pages), баг связности галактики (открытая планета была недостижима, а `validateIntegrity()` помечал
> легальное состояние как `unreachable-unlocked-planet`), классификация аномалий, контракт снапшота логистики,
> 13 падавших тестов. Восстановлены удалённые через веб-интерфейс `eslint.config.js`, `vite.config.single.ts`,
> `vitest.config.ts`, `README.md`; добавлен `.gitignore`.
> Подробно: `docs/STAGE8_1_CI_REPAIR_REPORT.md` · решения: `docs/adr/adr-018.md`.
> Ниже — историческая шапка Этапа 6 (частично устарела: трекер и отчёты ведутся до Этапа 9.0).

**Стадия:** Этап 6 — **ЧАСТИЧНО**. Stage 6.7 добавляет грузовой трюм, локальные планетарные депо и топливную надбавку за перевозимый груз; Stage 6.6 добавляет поиск маршрутов по открытому графу и оплату прыжков; Stage 6.5 добавляет последовательные аномальные экспедиции с атомарной оплатой и уникальными наградами; Stage 6.4 добавляет цепочки экспедиционных лицензий и доменные скидки на открытие миров; Stage 6.2 добавил классификацию сонарных сигналов, карту XZ галактики, прогресс рубежей и журнал экспедиции; Stage 6.1 — экономику зарядов/пересборок, Stage 6.0 — трёхраундовый сонар, открытие Криос-9 и бонус добычи; полный CI и мобильная приёмка ещё не подтверждены. Stage 5.1 исправляет жизненный цикл Canvas, Stage 5.2 добавляет Raycaster/выбор клетки, Stage 5.3 вводит радиальный рельеф, Stage 5.5 — террасы и типовые кристаллические/аномальные надстройки; Stage 5.6 — runtime hardening, event-driven rebuild и мобильный DPR guard. Сквозной игровой цикл покрыт новым интеграционным тестом, но полный CI и браузерная приёмка ещё не подтверждены · **Дата:** 2026-11-02
**⚠️ ВОССТАНОВЛЕНИЕ (2026-11-02):** исходники voronia2 были утрачены; каркас, домены, тесты и документы Этапов 0–2 восстановлены по сохранившимся README/VERDICT/STAGE1_REPORT, фикстурам runtime-извлечения и харнессу (пересобран из baseline-монолита); затем **Этап 3 закрыт заново** (генератор планет + галактика, 18 тестов), **Этап 4** (заряды/surge/ветви/мутанты/deep/синтез, 56 тестов) и **Этап 5** (type7/discovery/setActivePlanet/3D-прототип, 21 тест). Текущее покрытие — **199 тестов** (оригинал на конец Этапа 2: 148; дельта — `docs/STAGE2_REPORT.md` §5). Legacy v39-миграция реализована раньше плана (оригинал: Этап 14).
**Основание:** `uploads/VORONIA_2_0_TECHNICAL_SPECIFICATION_v1_0.docx` (ТЗ ред. 1.0) + вердикт `../VORONIA_2.0_VERDICT.md`
**Baseline (ADR-003):** `../Voronia_2.5D_Hybrid_v0.0.41_PROD.html` — не изменять (ТЗ §19).
**Отчёты:** `docs/STAGE6_2_REPORT.md` · `docs/STAGE6_1_REPORT.md` · `docs/STAGE6_REPORT.md` · `docs/STAGE1_REPORT.md` (каркас) · `docs/STAGE2_REPORT.md` (экономика) · `docs/STAGE3_REPORT.md` (генератор/галактика) · `docs/STAGE4_REPORT.md` (аномалии/заряды/синтез) · **`docs/STAGE5_REPORT.md`** (type7/discovery/3D: parity-таблица + отклонения ADR-017).

---

## Быстрый старт

```bash
cd voronia2
npm ci                # node ^20.19 || >=22.12 (проверено на 20.20.2)
npm run dev           # http://localhost:5173 — запуск текущей исходной версии
npm run ci            # lint + typecheck×2 + check:arch + все Vitest-тесты + build + build:single + check:size
npm run test          # только vitest
npm run build:single  # dist-single/index.html — самодостаточный файл (≤ 6 МБ, ADR-002/Q3)
```

## Структура

```
voronia2/
├── package.json / package-lock.json / tsconfig*.json / vite.config*.ts / vitest.config.ts
├── eslint.config.js / .gitignore / .github/workflows/deploy.yml (build + GitHub Pages)
├── index.html                       ← вход dev/сборки
├── src/
│   ├── contracts/                   ← типы, команды, события, порты; economy.ts (доход/цены/склад), клетки, ресурсы, anomalies.ts (ветви/заряды/синтез), tech.ts (RESOURCE_UNLOCK), rng.ts, galaxy.ts (PlanetData/GraphData/роль)
│   ├── core/                        ← EventBus, GameClock (+Raf/Manual), Rng, Logger, Game facade (тик-подписка, world/граф, команды discoverPlanet/setActivePlanet); discovery.ts — оркестратор открытия миров (Этапы 3/5)
│   ├── config/                      ← лоадер+валидатор; registryView (типизированный реестр, +секция roles); data/balance/v0.0.41/{registry,baseline}.json (ADR-011)
│   ├── economy/                     ← ResourceLedger, IncomeService (ce/ng parity + ветви type4/deep-кристаллы), ProductionService (жилы/истощение + sleepFor/fm + мутанты),
│   │                                  CellUpgradeService (zn/Ni/x0 parity), AnomalyUpgradeService (nr/To/tl + ucm-асимметрия), WarehouseService (Vi/Hf/Ey/Td/Gi),
│   │                                  ChargeService (i0/s0/a0/ll + авто-surge), SynthService (el/Iy/ei/Cy/Ly/ti/Ty/$o), EconomyTicker (C1 parity + steps)
│   ├── planets/                     ← tables.ts (дескрипторы/биомы/лор), generator.ts (порт 1:1: Rf/Jc/Zc/Qc/Lf/Bf/Of/ni + unique-формы xf/uy/kf, ADR-015),
│   │                                  catalog.ts (ferrum + krios + генерируемые), loadPlanetData (+armId/perks/resourceList/origin), ExplorationService (+ролл мутанта type3‖type5),
│   │                                  anomalies.ts (fmFor, AnomalyService/выбор ветви); data/planet_ferrum_v0.0.41.json
│   ├── galaxy/                      ← рукава: спираль er()/armId; позиции Br(); граф oi()/Kf(); классификация сигналов, карта, лицензии, аномальные экспедиции и маршрутизация (Stage 6.2–6.6)
│   ├── progression/                 ← ScanPricing (TV-1/2/3 закрыты), TechState (уровни+unlocks; покупка — Этап 7)
│   ├── persistence/                 ← схема voronia2.save v2 + миграция v1→v2, SaveManager (backup/fallback), storage-адаптеры
│   ├── ui/                          ← HUD (ставки/склад/заряды+сонар/синтез), клетки (апгрейд/реактивация/⚡разряд/ветви аномалий/▲аномалия), журнал; команды→dispatch, рендер→snapshot
│   ├── renderer/                    ← 3D-сцена (Этап 5, PARTIAL): planetMesh.ts (радиальный рельеф по типам/уровням + faceIndex→cellId), scene.ts (Three.js r170: vertexColors, InstancedMesh/LOD, drag, Raycaster, маркер выбранной клетки), fps.ts (FpsMeter fps/avg/p95)
│   ├── audio/ logistics/ combat/ crafting/   ← NOT_IMPLEMENTED-статусы + контракты (Этапы 13/9/10/8)
│   └── main.ts                      ← точка входа браузера
├── docs/
│   ├── STAGE1_REPORT.md / … / STAGE4_REPORT.md / STAGE5_REPORT.md   ← отчёты поставки (parity-таблицы, provenance)
│   ├── MECHANICS_CATALOG.md         ← реестр механик v0.0.41 (§1–16 + §17 — формулы Этапа 2; §A–J — данные/генератор/аномалии/type7+discovery, §G/§I/§J полные)
│   ├── TO_VERIFY.md                 ← TV-1..11/13/16/18/19/24 CLOSED (+TV-34 CLOSED-DEVIATION); TV-14/15/21/33 PARTIAL; TV-29..32/35/36 OPEN
│   ├── GOLDEN_SCENARIOS.md          ← GS-00…GS-17 (GS-01…04, GS-14…17 ✅)
│   └── adr/                         ← ADR-001…017, все ПРИНЯТЫ (015 — генератор; 016 — аномалии/заряды/синтез; 017 — world/discovery/3D)
├── fixtures/                        ← артефакты runtime-извлечения, 28 файлов (Этапы 0/2/3/4 + stage5_audit_v0.0.41.json); только чтение
└── tools/
    ├── check_arch.mjs               ← контроль слоёв ADR-012 + циклы + allowlist внешних (three — только renderer) (в CI)
    ├── check_size.mjs               ← gate single-file ≤6 МБ (ADR-002/Q3, в CI)
    ├── harness/boot.cjs + dom_stubs.cjs   ← бут baseline-монолита в node (нужен ../uploads/*.html)
    └── extract_stage0.cjs / extract_stage3_names.cjs / extract_stage4.cjs / extract_stage5.cjs   ← извлечение фикстур (Этапы 0/3/4/5)
```

## Архитектура

- **Матрица слоёв (ADR-012):** contracts ← config ← домены ← core (Game facade) ← ui. Домены связаны только через порты; Game — единственный сборщик (DI). Контроль: `npm run check:arch`.
- **Экономика (Этап 2, ADR-013):** баланс меняется ТОЛЬКО атомарными транзакциями ledger (скан, апгрейд, реактивация, склад, доход на тике — одна агрегированная транзакция на scope за тик). Производство/сек отделено от запасов; резервы жил — доменное состояние клетки. Активная планета ↔ global scope (parity 1.x), неактивные → planet scope (Этап 9). Журнал не персистится.
- **Модификаторы (ADR-014):** цепочки порядка из `ce()/ln()/zn()/C1()` — типизированные контексты с именованными множителями; baseline ferrum полностью подтверждён runtime-аудитом (×0.9 скана = рукав «ЯДРО»; ×1.2 апгрейда = дескриптор «Мёрзлый»; ×1.15 железа = «Каменистый»; ×6 дохода = compound-бонус).
- **Команды/события:** `dispatch<C> → ActionResult<CommandResultMap[C]>`; отказы — закрытый набор причин (parity-имена 1.x: `state/energy/cost/max/type/cooldown`). Событие `cell:upgraded` — то же имя шины, что в 1.x.
- **Баланс:** только версионированные наборы (ADR-011): реестр v0.0.41 (37 секций) типизирован fail-fast (`registryView`), source-only константы — в baseline.json с offset'ами в комментариях.
- **Сейв:** `voronia2.save` **v2** (полные cellStates + warehouse + tech); читает и мигрирует v1; импорт 1.x v39 — Этап 14.

## Parity с v0.0.41 (данные — runtime-аудит, не ТЗ)

- **GS-01/02/03** (Этап 1): старт-нули, explored/revealed, скан-трейл 9/9/10 → 13, аномалия −990.
- **GS-04** (Этап 2): апгрейд 0→96→336→840→1680⚡ (+iron 12/26/60/108/180, +1🔬×5, yield 6, reserve 2/2).
- **Доход:** midgame-ferrum 42⚡/с = 7 × compound 6; 0.69⛏/с = 0.115 × 6; 0.002🔬/с; наука type6 линейна 5×L.
- **Жилы:** истощение 0.056/с (0.1×0.7×0.8), кулдаун 300с+150с×n, реактивация 65/101⚡, Xs min(14, 1+0.55n).
- **Склад:** Vi 10+5L т/ячейка, Gi ×(1+0.05L), Td {alloy (L+1)², energy ceil(800×1.6^L)}, Ey midgame 420464 т.
- **GS-14** (Этап 3): генератор планет — 6 full-dump сэмплов клетка-в-клетку (клетки/вершины/палитра/события/лор/узлы графа), named-фикстура idx3–22 (имена/позиции/рёбра, barren planet_08, «Последняя Ворония» planet_15, уникальные миры idx17–22 с деформацией xf/kf), krios/ferrum byte-match, детерминизм (seed → одна планета), награды 500/500/1100/2420/5324/11712.
- **GS-15/16** (Этап 4, золотая фикстура `fixtures/stage4_audit_v0.0.41.json`): разряды .03/.08 → стек .11 → s0 ×1.11 (14→15.54⚡) и наука ×1.2; krios-кап .25/сонар-кап 3/сосед ×1.15; surge .0195/20с · .092/25с; ветви +4…+32⚡ / +.005…+.04💎; fm .7/.5 только в истощении; мутанты .084/.0448/.112; tl-паразит 300…24300⚡ + 60…4860⛏ и deep-конверсия 4800⚡/600⛏ (ucm-асимметрия); синтез ferrum L2 {.054,.432} / krios L1 {.036,.288} (ОБА перка) / Ty(10с) −4.32⛏ +0.54🧪.
- Полный список контрольных точек: `docs/STAGE2_REPORT.md` §2, `docs/STAGE3_REPORT.md`, `docs/STAGE4_REPORT.md` §3, `docs/STAGE5_REPORT.md` §3, `docs/MECHANICS_CATALOG.md` §17.4 + §G + §I + §J.
- **GS-17** (Этап 5, фикстура `fixtures/stage5_audit_v0.0.41.json`): type7 = 200⚡ (100×Ws, deep-инвариант) + 0.03💎/с; discover seed 777001 → planet_03 «Гелика-Прайм» (frost, 22 клетки, 1100🔬, узел x53.0765/y0.232/z21.881, ребро→krios, без автосwitch); planet_04 «Ван» 2420🔬; override → planet_05 5324🔬; setActive guard (krios locked → false); save-реплей спеков детерминирован; 3D-билдер: facets=Σ(poly−2), edges=Σnb/2, krios 92 клетки, FpsMeter p95.

Не смоделировано (осознанно, по этапам): своп storage планет On/yy и пер-планетные стоки (9, TV-25), покупка технологий/древ и spc_hidden-профили (7, TV-29), крафт и постройка/слияние ядра грани (8, TV-21/35), назначение ролей/транспорт/переходы c ценой (9, TV-28/30), бой/печати/скрытый мир sm() (10, TV-20/35), офлайн/prestige-окна и Ay (11, TV-31), полный UI — модалки/тосты/2.5D-оверлеи и эффекты рендера (12; 3D-прототип Этапа 5 — PARTIAL), аудио (13), миграция 1.x (14), FPS-замер на целевом Android (TV-36). Type7-доход, discoverPlanet/setActivePlanet и галактика в UI — закрыты Этапом 5; аномалии/заряды/мутанты/deep/синтез — Этапом 4; генератор планет — Этапом 3.

## Перезапуск инструментов извлечения

```bash
cd voronia2
npm run extract        # tools/extract_stage0.cjs — бут монолита (tools/harness/boot.cjs + dom_stubs.cjs,
                       # слои в tools/harness/extract/) → 24 фикстуры в fixtures/, ~20 с.
                       # Baseline: ../uploads/Voronia_2.5D_Hybrid_v0.0.41_PROD.html (не изменять, ADR-003).
# Примечание: оригинальные extract_stage2.js/anchors.py/build_harness.py утрачены;
# их результат (economy-фикстуры) покрыт текущими 28 фикстурами (см. docs/STAGE2_REPORT.md §3).
node tools/extract_stage4.cjs   # золотой аудит Этапа 4 → fixtures/stage4_audit_v0.0.41.json
                                # (seed 20260401, NOW заморожен, surge через реальный setInterval; ~30 с)
node tools/extract_stage5.cjs   # золотой аудит Этапа 5 → fixtures/stage5_audit_v0.0.41.json
                                # (seed 20260501: type7/discoverPlanet/setActivePlanet/hidden; ~2 с)
```

## Решения владельца

- **Q1 (2026-10-23):** ADR-004…008 — ПОДТВЕРЖДЕНЫ (ПРИНЯТЫ).
- **Q3 (2026-10-23):** бюджет single-file **≤ 6 МБ** — зафиксирован в ADR-002 и в CI (`check:size`).
- Ранее: ADR-009 (числа боя = реестр v0.0.41), ADR-010 (полный перенос систем вне ТЗ §4), ADR-011/012 (конфиги/слои).

## Открытые вопросы

Новых блокеров нет. Открытые TV Этапа 5: **TV-35** (постройка/слияние ядра грани — core.buildCost/mergeRichCost/mergeFallbackCost; скрытый мир sm() — поток «сердца Воронии», Этап 8/10), **TV-36** (FPS на целевом Android — FpsMeter встроен в main.ts, нужен замер на устройстве; desktop-сборка 0.60 МБ). Ранние: TV-25 (своп storage On/yy — аудит §setActive зафиксирован, Этап 9), TV-26/27/28, TV-29…33.

## Предыдущий статус: доведение Planet Vertical Slice

Stage 5.5 реализует многослойный рельеф и типовые надстройки. Новый интеграционный тест проверяет цепочку «сканирование → улучшение → изменение высоты». До закрытия вертикального среза остаются полный CI, браузерный smoke-test, проверка мобильной производительности и визуальная приёмка. См. `docs/STAGE5_4_REPORT.md`.

## История этапа: Stage 5.5

Stage 5.5 добавляет многослойный радиальный рельеф клеток, террасы, типовые кристаллические/аномальные надстройки и интеграционный тест цикла «сканирование → улучшение → изменение геометрии». См. `docs/STAGE5_4_REPORT.md`. Полный CI требует `npm ci` и `npm run ci`; в рабочем окружении установка npm-зависимостей пока не завершилась.


## Stage 5.5 — Planet Vertical Slice validation

- Проверены переключение активной планеты, сохранение выбора, восстановление открытых миров и независимость runtime-прогресса планет.
- Добавлены экспорт JSON-файла и импорт JSON-сохранения через UI с сообщением о результате.
- Для мобильного управления добавлены pinch-to-zoom, drag-вращение и экранные кнопки масштаба/сброса вида.
- Полная браузерная/WebGL-проверка зависит от установки npm-зависимостей и должна выполняться на целевых устройствах.

Подробности реализации и границы проверки: `docs/STAGE5_5_REPORT.md`.


## Stage 5.6 — Runtime hardening

- Убран пересчёт/сортировка подписи всех клеток на каждом RAF-кадре: меш помечается dirty после команды и перестраивается один раз.
- RAF останавливается в скрытой вкладке и возобновляется при возвращении; FPS-окно сбрасывается.
- `pagehide` отменяет RAF, останавливает игровые таймеры/автосейв и освобождает WebGL-ресурсы.
- DPR ограничен 1.5 на узких viewport и 2 на широких; добавлены unit-тесты функции ограничения.
- См. `docs/STAGE5_6_REPORT.md`. Полный CI и физическая мобильная проверка остаются обязательными.


## Stage 6.3 — SONAR SYSTEM

- Реализована трёхраундовая интерактивная мини-игра: остановка сигнала оценивается по формуле `clamp(1 − |position| × 1.4, 0, 1)`; сложность и пороги берутся из `registry.sonar`.
- Криос-9 открывается только с Феррума после исследования всех его клеток и оплаты `hintEnergy` из реестра (1500⚡ в текущем балансе). После открытия узел графа помечается `discovered`, создаётся runtime и сохраняется прогресс.
- За точность ≥50/70/90% выдаётся бонус добычи ×1.10/×1.25/×1.50 на 24 часа; бонус встроен в `IncomeService.scanBonus`, сохраняется и восстанавливается.
- Следующий процедурный мир предварительно генерируется тем же `runDiscovery` на изолированной копии графа. Кнопка открытия использует тот же seed, поэтому показанные имя/биом/геометрия/ресурсы совпадают с созданной планетой.
- Сонарные заряды, уже выдаваемые разрядами type2 и ограниченные `sonar.chargeMax`, остаются в сейве. Их расход на повторные сканирования/пересборку и полный цикл reroll ещё не реализованы (TV-33 остаётся PARTIAL).
- Проверки: `check_arch` пройден; строгая проверка TypeScript изменённых игровых/UI-модулей и тестового файла пройдена; временная CommonJS-сборка Game и Node smoke/edge checks прошли (unlock, списание, preview-match, save/restore, отказные сценарии). Полный Vitest/Vite build/browser/WebGL/Android не запускались: `npm ci` завершился по тайм-ауту. См. `docs/STAGE6_REPORT.md`.


## Stage 6.3 — Galaxy Depth

- Добавлена стабильная радиальная классификация секторов: ядро, внутренний, средний и внешний рубеж.
- Предварительная сигнатура показывает сектор, а открытые узлы получают сектор в игровом snapshot.
- Снимок галактики сообщает распределение открытых миров по секторам и список исследованных рукавов.
- Добавлен доменный барьер для аномальных сигнатур: минимум 3 обнаруженных мира, 2 разных рукава и 1500 исследований. Проверка выполняется в `Game.discoverWorld`, а не только в UI.
- Требования барьера доступны UI, кнопка открытия блокируется с явным отображением недостающих условий.
- Полноценный 3D-рендеринг галактики намеренно отложен: текущий этап развивает доменную логику и данные.


## Stage 6.4 — Galaxy Progression
Экспедиционные лицензии вычисляются из открытых миров, рукавов, секторов и исследований. Достигнутые рубежи дают не складывающуюся скидку 3–15% на стоимость открытия последующих миров. Подробности: `docs/STAGE6_4_REPORT.md`.


## Stage 6.5 — Anomaly Systems

- [x] Обнаруженные аномальные миры формируют последовательную цепочку экспедиций.
- [x] Для каждой экспедиции рассчитываются тип, уровень, стоимость энергии/исследований и уникальная награда.
- [x] Доменная команда требует активную аномальную планету, доступность текущего звена и достаточные ресурсы.
- [x] Списание стоимости и выдача тёмной материи/реликтов/эссенции проходят одной атомарной ledger-транзакцией.
- [x] Повторное получение награды заблокировано; список завершённых экспедиций хранится в Save v2.
- [x] Snapshot и HUD показывают цепочку, требования, награды и доступное действие.
- [ ] Полный Vitest / production build / браузерная приёмка.


## Stage 6.6 — Expedition Routes

- Маршруты строятся алгоритмом Dijkstra по рёбрам существующего графа; в качестве транзита учитываются только обнаруженные и открытые системы.
- Каждый маршрут показывает полный путь, число прыжков, суммарную дистанцию/стоимость и следующий узел.
- Перелёт выполняется одним прыжком за команду, чтобы промежуточные системы оставались частью игрового процесса.
- Стоимость прыжка: `ceil(distance × 150 + sector surcharge)`, где надбавки: ядро 0, внутренний сектор 250, средний 700, внешний 1400 энергии. При касании аномальной системы применяется множитель 1.25.
- Энергия списывается атомарно через ledger. Старый `setActivePlanet` сохранён как совместимый alias, но бесплатное переключение больше невозможно.
- Маршрутные сметы вычисляются из графа и текущей позиции и не дублируются в сейве; активная планета и счётчик перелётов сохраняются существующей схемой.
- Добавлены тесты маршрутизации, блокировки закрытых транзитных узлов, надбавок, оплаты и отказа при недостатке энергии.


## Stage 6.7 — Galaxy Economy / Logistics

- Грузовой трюм: 100 т базовой вместимости + 50 т за уровень склада.
- Погрузка транспортируемых материалов из общего ledger в трюм; энергия, исследования, пыль, эссенция, кристаллы и осколки не перевозятся.
- Выгрузка в локальное депо планеты с вместимостью `exploredCells × tonsPerCell`; переполнение не теряет груз.
- Ресурсы, соответствующие специализации планеты по `resourceKey` клеток, занимают на 25% меньше места в депо.
- Вывоз из депо обратно в общий ledger разрешён только на текущей планете.
- Масса груза повышает цену каждого прыжка: `ceil(cargoMass × distance × 0.5)` энергии; Dijkstra и HUD учитывают фактическую загрузку.
- Состояние трюма и всех депо сохраняется в опциональной секции Save v2; старые v2-сохранения загружаются с пустой логистикой.
- См. `docs/STAGE6_7_REPORT.md`. Полный Vitest/build/browser/Android QA ещё не выполнен.


## Stage 6.8 — Galaxy Validation

- [x] `Game.validateIntegrity()` aggregates runtime graph checks and `validateSaveV2()` results.
- [x] Validates unlocked/discovered/runtime planet consistency and active planet membership.
- [x] Validates graph node identity/coordinates, dangling/self/duplicate edges and reachability of unlocked planets.
- [x] Validates route endpoints, hop summary, open-node usage, graph edges and finite nonnegative costs.
- [x] Validates cargo/depot amounts and rejects depots attached to locked/unknown planets.
- [x] Added integrated test for unlock → cargo → travel → depot → save/load, plus deliberately corrupted graph/state cases.
- [x] Node smoke test of fresh state and full Ferrum→Krios logistics/save round-trip passed.
- [ ] Full Vitest / production build / browser-WebGL / Android acceptance.
- See `docs/STAGE6_8_REPORT.md`.


## Stage 7.2 — Galaxy Visual Depth

- Интерактивность Stage 7.1 сохранена: выбор обнаруженных систем, карточки, маршруты и доменный перелёт остаются без изменений.
- Добавлены детерминированные процедурные облака газа/пыли и звёздные скопления. Это фоновые визуальные слои, не игровые объекты.
- Добавлено центральное кольцо галактики и ближняя детализация ядер обнаруженных звёздных систем.
- Реализованы три LOD-режима (`wide`, `regional`, `system`): на близком расстоянии общегалактические декоративные слои скрываются, а маркеры известных систем получают дополнительную детализацию.
- Бюджет частиц уменьшается на узких экранах и устройствах с высоким DPR.
- Игровые узлы, их координаты и связи по-прежнему поступают только из `PlanetaryGraph`; декоративные облака и скопления не создают фиктивные планеты.
- Добавлены тесты порогов LOD и адаптивного бюджета. Подробности: `docs/STAGE7_2_REPORT.md`; интерактивность описана в `docs/STAGE7_1_REPORT.md`.


## Stage 7.3 — Star System Detail

- Выбор обнаруженного узла переводит камеру в локальный режим системы с плавным фокусом.
- В локальном режиме отображаются условная звезда-хозяин, орбитальная траектория и одна подтверждённая игровая планета, соответствующая выбранному узлу `PlanetaryGraph`.
- Цветовой профиль звезды/планеты и параметры схематичной орбиты детерминированы ID узла и классом сигнала.
- Для аномальных миров добавляется отдельный визуальный ореол.
- Закрытие карточки возвращает камеру к галактическому обзору.
- Важно: текущая игровая модель не хранит спектральный класс звезды, физические орбиты или каталоги дополнительных планет. Поэтому звезда и орбита пока являются визуальной схемой, а не симуляцией; дополнительные планеты не выдумываются.


## Stage 7.4 — Planetary System Exploration

Подробности и ограничения: `docs/STAGE7_4_REPORT.md`.

- Добавлен доменный `StarSystemCatalog`, детерминированно строящийся из seed обнаруженного узла `PlanetaryGraph`.
- Первый объект каталога связан с существующей игровой планетой. Дополнительно создаются 1–3 орбитальных кандидата с параметрами орбиты и внутренним классом тела.
- Неразведанные кандидаты не раскрывают имя, класс и состав: интерфейс показывает только обезличенные орбитальные сигнатуры и расстояния.
- Каталог проходит валидацию уникальности ID, принадлежности host-системе, корректности орбит и защиты от утечки данных.
- Карточка системы продолжает показывать подтверждённую планету, биом, геометрию, доступность и активное состояние. Переход к поверхности и перелёт по `travelToPlanet` сохранены.
- Ограничение: орбитальные кандидаты пока не имеют planet runtime, не могут быть посещены или сканированы. Следующий подэтап должен добавить доменную команду исследования орбиты, раскрытие кандидата и создание runtime только для подтверждённой планеты.


## Stage 7.4.2 — Orbital Discovery & Planet Activation

Исследование орбитальных сигнатур и активация дополнительных игровых планет. Исследование стоит 500 энергии + 100 исследований; активация — 2 000 энергии + 500 исследований. Результаты сохраняются в `orbitalExploration`, а созданные миры восстанавливаются через `discoveredSpecs`. Подробности и ограничения: `docs/STAGE7_4_1_REPORT.md`.


## Stage 7.4.2 — System Topology & Orbital Navigation

- Добавлена доменная проекция иерархии звёздной системы: звезда/система → орбитальные тела → активированные планеты.
- Неисследованные орбиты не раскрывают класс тела; неактивированные тела не допускаются к межпланетной навигации.
- Добавлена команда `travelWithinSystem`: переход между родительской планетой и активированными орбитальными планетами одной системы без оплаты межзвёздного прыжка.
- Связь с родительской системой восстанавливается из сохранённого `orbitalExploration.activatedBodies`; отдельный дублирующий save-state не вводится.

## Stage 7.4.3 — Orbital System Visualization

Добавлена трёхмерная визуализация звёздной системы: центральная звезда, орбитальные кольца и анимированные подтверждённые/активированные планеты. Клик по планете инициирует доменную команду `travelWithinSystem`; неизвестные тела не раскрываются до исследования и активации. Подробности и ограничения — `docs/STAGE7_4_3_REPORT.md`.


## Stage 7.4.4 — Orbital Mechanics & System Readability

Орбитальные данные каталога (эксцентриситет, наклон, фаза и класс звезды) передаются в 3D-представление. Орбиты отображаются эллипсами, планеты движутся по приближённой кеплеровской модели. Подробности и ограничения: `docs/STAGE7_4_4_REPORT.md`.

## Stage 7.4.5 — System Navigation & Exploration Interface

Добавлена явная навигация между поверхностью планеты, галактической картой и звёздной системой. Карточка выбранной системы содержит действия входа в систему и возврата к галактике. Системная топология повторно строится из актуального состояния исследования, а выбор подтверждённой/активированной планеты выполняет доменный переход `travelWithinSystem`. Неизвестные тела не становятся доступными для посещения до прохождения сканирования и активации.


## Stage 7.4.6 — System Exploration Completion & Data Persistence

Усилена валидация сохранённого состояния орбитальных исследований: родительская система должна быть открыта; идентификаторы тел должны относиться к этой системе; активированное тело обязано быть предварительно просканировано; привязанная планета должна присутствовать среди открытых миров и иметь `DiscoverySpec`; одна планета не может быть привязана к нескольким телам одной системы. Существующие поля `orbitalExploration` сохранены без смены формата, поэтому корректные сейвы предыдущих подэтапов остаются совместимыми. Добавлены тесты round-trip после перехода на орбитальную планету и отклонения повреждённых связей.

## Stage 8.0.1 — Planet Surface Interaction Core

Added revealed-aware direct cell picking on the 3D planet surface. Hidden cells are not selectable and their markers are suppressed. Selected revealed/explored cells continue to invoke existing `Game.dispatch` commands through the HUD; the renderer does not own scan or upgrade rules. See `docs/STAGE8_0_1_REPORT.md`.


## Stage 8.0.2 — Cell Visual States & Surface Feedback

Добавлены отдельные визуальные состояния hidden / revealed / explored, нейтральная подача неразведённых клеток и цветовая дифференциация контуров. Контуры строятся по исходному `cell.poly`: число сторон и геометрия каждой ячейки сохраняются, универсальная шестиугольная сетка не вводится. Для каждой стороны полигона создаётся собственный сегмент границы; выбранная клетка получает пульсирующий маркер. Рельеф и его радиальный рост остаются привязаны к типу и уровню конкретной клетки. Добавлены тесты сохранения различной полигональной геометрии и трёх состояний исследования.


## Stage 8.0.3 — Cell Geometry & Upgrade Deformation

Сохранена исходная переменная полигональная топология Voronia (`cell.poly`), добавлена детерминированная индивидуальная морфология каждой клетки и зависимая от уровня деформация внутренних склонов/террас. Границы соседних ячеек остаются на общей базовой сфере и не расходятся при улучшении. В `PlanetMeshData` добавлены `cellMorphology` и `cellLevels`. Добавлены тесты топологии, детерминизма, изменения рельефа и сохранения контуров. Подробности и ограничения: `docs/STAGE8_0_3_REPORT.md`.

## Stage 8.0.4 — Continuous Planet Surface & Cell Boundary Integration

- Added a shared-vertex pass in `src/renderer/planetMesh.ts`: polygon vertices that represent the same point on the sphere receive one deterministic seam position.
- Shared seam height is derived from the mean relief contribution of all cells incident to that vertex, with a restrained 12% transfer of local relief. This reduces abrupt height discontinuities while retaining per-cell relief profiles and non-uniform polygon topology.
- Exposed `sharedBoundaryPositions` and `sharedBoundaryVertexCount` for diagnostics and geometry validation.
- Original per-cell polygon boundaries remain visible; the renderer does not replace Voronia's variable polygons with a regular hexagonal grid.
- Added `tests/stage8_0_4_surface_continuity.test.ts` for unique shared-vertex counts, finite/radially bounded seam coordinates, and traversal-order determinism.
- Scope note: this stage aligns shared polygon vertices. It does not yet implement a high-resolution geodesic edge tessellation or GPU displacement shader; browser/WebGL visual acceptance remains deferred.

## Stage 8.0.5 — Planet Surface Topology & Adaptive Tessellation

Добавлена каноническая топология общих рёбер и адаптивное разбиение длинных сторон полигонов сферической интерполяцией. Соседние клетки используют одну последовательность seam-точек; исходные контуры `cell.poly` и индивидуальная геометрия ячеек сохраняются. Подробности и ограничения: `docs/STAGE8_0_5_REPORT.md`.


## Stage 8.0.6 — Surface Normals, Shading & Geological Transitions

- `planetMesh.ts` now emits a normalized normal per surface vertex, accumulated across coincident coordinates so adjacent cells share lighting normals at their seams.
- Geological vertex colors receive a restrained blend at coordinates shared by multiple cell polygons; interior cell colors remain unchanged.
- `geologyBlend` exposes a 0..1 seam transition mask for later material/shader work.
- `scene.ts` uses hemisphere + key/fill directional lighting and `MeshStandardMaterial` with conservative roughness/metalness.
- Cell polygon geometry, IDs, reveal/explore states and domain commands remain unchanged.
- Added `tests/stage8_0_6_surface_shading.test.ts` for normal validity, color bounds and state preservation.

Browser/WebGL visual acceptance remains pending.

## Stage 8.0.7 — Geological Materials & Surface Detail

Добавлены физические профили геологических материалов для существующих типов клеток, per-vertex атрибуты класса геологии, детерминированной микродетализации и интенсивности свечения. Материал поверхности использует shader patch поверх `MeshStandardMaterial`: тип клетки влияет на оттенок, шероховатость, металлический отклик и сдержанное свечение; процедурная микродеталь не изменяет геометрию. Скрытые и только раскрытые клетки получают нейтральный класс `-1` и нулевое свечение, чтобы материал не раскрывал тип до исследования. Переменная геометрия `cell.poly`, контуры и доменная логика сохранены. Подробности и ограничения: `docs/STAGE8_0_7_REPORT.md`.

## Stage 8.0.8 — Geological Structures & Procedural Surface Features

Добавлены типоспецифичные процедурные образования: энергетические кольцевые берега, ресурсные плато, горные хребты, кристаллические кластеры и аномальные дуги. Формы остаются привязанными к индивидуальным полигонам ячеек; скрытые и только раскрытые клетки не показывают геологические образования. Диагностические массивы `surfaceFeatureKinds` и `surfaceFeatureCounts` добавлены в `PlanetMeshData`. Подробности: `docs/STAGE8_0_8_REPORT.md`.


## Stage 8.0.9 — Geological Animation & Dynamic Surface Evolution

Добавлена детерминированная per-vertex конфигурация динамики геологических классов: энергетические бассейны получают слабое движение потока, кристаллы — пульсацию, горные структуры — минимальное дыхание рельефа, аномалии — более выраженное пространственное колебание. `PlanetMeshData` передаёт `geologicalMotionAmplitude` и `geologicalMotionSpeed`; Three.js shader использует общий временной uniform и очень малое радиальное смещение вершин вместе с анимированным цветовым/эмиссионным откликом. Для hidden/revealed геология остаётся `-1`, амплитуда и скорость равны нулю. Анимация не меняет доменное состояние, уровни клеток, сохранения или экономику. Тесты добавлены в `tests/stage8_0_9_geological_animation.test.ts`. Реальная компиляция GLSL и браузерная оценка отложены.

## Stage 8.0.10 — Surface Performance & GPU Optimization

Добавлен адаптивный регулятор качества поверхности (`low` / `balanced` / `high`), который оценивает скользящее время кадра, снижает внутреннее разрешение canvas при устойчивой нагрузке и уменьшает стоимость процедурных шейдерных деталей. Повышение качества выполняется с гистерезисом после устойчивого запаса производительности. Геометрия и топология ячеек не упрощаются.

Подробности: `docs/STAGE8_0_10_REPORT.md`.


## Stage 8.0.11 — Planet Surface Geometry Budget & LOD

Добавлены бюджеты геометрии поверхности, оценка GPU-памяти и диагностика количества треугольников/процедурных образований. Для процедурных колец, хребтов и кристаллических надстроек введены три уровня плотности (`low` / `balanced` / `high`); базовая поли-сетка клеток и соответствие `faceIndex → cellId` не упрощаются. Дистанционная политика LOD подготовлена как отдельная чистая функция. Полноценное динамическое переключение геометрии поверхности при движении камеры оставлено следующим этапом, чтобы не пересобирать тяжёлый меш каждый кадр. Подробности: `docs/STAGE8_0_11_REPORT.md`.

### Stage 8.0.12 — Runtime LOD & Surface Streaming
- Added distance-driven near/mid/far runtime LOD with hysteresis.
- Decorative boundaries, neighbour graph, marker detail and shader workload now scale with camera distance without rebuilding the planet mesh.
- Base cell surface and `faceCellIds` remain unchanged at every LOD tier, preserving cell raycasting and original polygon diversity.
- Scope: progressive activation of resident layers; asynchronous chunk streaming and base topology simplification are not implemented.
- Details: `docs/STAGE8_0_12_REPORT.md`.

## Stage 8.0.13 — Surface Chunking & Asynchronous Geometry Pipeline

Добавлена кооперативная асинхронная разбивка поверхности на 8 пространственных чанков. На время подготовки исходный монолитный меш остаётся видимым и интерактивным; после завершения чанки заменяют его без потери `faceIndex → cellId` (используется отдельная карта граней для каждого чанка). Переключение планеты отменяет устаревшую задачу. См. `docs/STAGE8_0_13_REPORT.md`.

### Stage 8.0.14 — Web Workers & Memory-Aware Surface Streaming
- Added Worker-based spatial partitioning with Transferable ArrayBuffers and explicit 24 MiB input-copy/output geometry budgets.
- Kept the monolithic surface visible and pickable until chunk replacement is ready; stale jobs are ignored when the active planet changes.
- Preserved arbitrary source cell polygons (`cell.poly`) and their individual side counts. Render triangles are internal tessellation primitives, not cell-shape definitions.
- See `docs/STAGE8_0_14_REPORT.md` for memory behavior and limitations.


## Stage 8.0.15 — Polygon-Aware Surface Streaming

Добавлены исходные side-count каждого `cell.poly` и CSR-граф соседства в `PlanetMeshData`. Планировщик чанков группирует целые клетки обходом реального графа `GeneratedCell.neighbors`; Worker и резервный pipeline распределяют GPU-треугольники по чанку исходной клетки. Диагностика сохраняет гистограмму числа сторон и считает связи между чанками. Исходные многоугольники не разбиваются и не нормализуются; GPU-треугольники являются только способом растеризации внутренней области полигона. Общие границы остаются в глобальном слое, построенном по согласованной топологии. Подробности и ограничения: `docs/STAGE8_0_15_REPORT.md`.

## Stage 8.0.16 — Seamless Chunk Boundaries & Priority Streaming

- Added canonical cross-chunk border dependencies derived from the original cell adjacency graph; cells remain whole polygons and are never split to fit a render chunk.
- Added camera-facing and interaction-aware chunk priority. The selected cell and its real graph neighbours are boosted ahead of unrelated chunks.
- Worker and cooperative fallback now process/install chunks in deterministic priority order. The monolithic surface remains available until the replacement set is complete.
- Shared cell boundaries continue to originate from the globally tessellated source topology; chunk partitioning does not independently regenerate or simplify polygon edges.
- Added tests for canonical border keys, cross-chunk dependencies, active-cell priority, and empty topology.
- This stage orders preparation; it does not yet implement camera-driven eviction/reloading or guarantee zero GPU memory overlap during atomic replacement.

## Stage 8.0.17 — Surface Streaming Runtime & Memory Eviction

- Added frame-budgeted runtime installation of prepared polygon-aware surface chunks (two chunks per frame by default).
- Chunk order is recalculated from the current camera direction and selected cell's owning chunk while the source monolithic surface remains visible and pickable.
- Chunk replacement is atomic: the monolithic surface is removed only after every staged chunk is ready; on staging-budget failure the original surface remains active.
- Added a 24 MiB staging-memory guard and explicit release of temporary/staged geometry on cancellation or planet replacement.
- Memory eviction is intentionally limited to uninstalled staging payloads. Resident base-surface chunks are not evicted because they provide continuous rendering and Raycaster coverage.
- Original `cell.poly` polygons, their side counts, adjacency, and `faceIndex → cellId` mapping remain intact. GPU triangles are only a rendering representation.

## Stage 8.0.18 — Surface Residency Manager & GPU Resource Recovery

- Added a residency manager with estimated GPU attribute-buffer accounting, LRU eviction for unpinned decorative resources, and hard protection for interactive base geometry.
- Registered the base planet surface, polygon boundaries, neighbour graph, and streamed surface chunks. Under pressure, disposable boundary/graph geometry can be released; base cell geometry is never evicted.
- Added WebGL context-loss/restoration handling: rendering pauses during loss, and retained geometry attributes/materials are marked dirty after restoration for Three.js re-upload.
- Preserved original `cell.poly` shapes, side counts, and `faceIndex → cellId` interaction mapping.
- Memory figures are estimates, not driver-reported VRAM. Full browser context-loss verification remains outstanding. Details: `docs/STAGE8_0_18_REPORT.md`.


## Stage 8.0.19 — Surface Resource Streaming & Dynamic Restoration

Added frame-budgeted restoration of evicted polygon-boundary and neighbour-graph overlays from retained planet CPU data. Restoration is LOD-aware, priority ordered, re-registers resources with the residency budget, and is cancelled on planet replacement. Base interactive polygon surface remains pinned. See `docs/STAGE8_0_19_REPORT.md`.

## Stage 8.0.20 — Surface Streaming Diagnostics & Long-Session Stability
- Added typed residency lifecycle events and bounded diagnostics for base/decorative/staging resource counts, estimated bytes, peak residency, duplicate registrations, evictions, and lifecycle balance.
- Exposed read-only runtime diagnostics through `PlanetViewer.getSurfaceDiagnostics()`.
- Added a deterministic 1,000-cycle resource lifecycle stress helper and tests asserting zero residual resources/bytes.
- Diagnostics observe renderer resources only; they do not alter source `cell.poly` geometry, polygon side counts, adjacency, or cell picking.
- Byte totals remain estimates, not driver-reported VRAM; browser long-session/GPU leak profiling remains outstanding. See `docs/STAGE8_0_20_REPORT.md`.

## Stage 8.0.21 — Surface Diagnostics Dashboard & Automated Stability Monitoring
- Added an F3 developer dashboard for estimated surface memory, resource categories, lifecycle counters, and recent stability alerts.
- Added bounded automated monitoring for memory-budget overruns, duplicate resource registrations, lifecycle mismatches, and rapid memory growth.
- Monitoring remains observational and does not alter cell geometry or streaming policy. Original variable-sided `cell.poly` polygons remain unchanged.
- See `docs/STAGE8_0_21_REPORT.md`.

## Stage 8.0.22 — Surface Streaming Stress Lab & Performance Benchmark

Добавлен CPU-side benchmark harness для реального `GeneratedPlanet`: замеры mesh build, polygon-aware chunk planning, chunk build, LOD hysteresis sweep и staging runtime. Отчёт включает гистограмму исходных сторон `cell.poly`, геометрические метрики, byteLength чанков и результат проверки staging budget. Стенд не меняет игровой runtime и не заявляет реальные GPU/FPS/VRAM показатели. Подробности: `docs/STAGE8_0_22_REPORT.md`.


## Stage 8.0.23 — Adaptive Surface Streaming Controller

- Added device-aware streaming profiles (`constrained` / `balanced` / `capable`) using conservative browser hints (mobile, device memory, hardware concurrency).
- Added a rolling frame-time and residency-pressure controller with fast degradation and delayed recovery. It adapts chunks installed per frame and temporary staging budget without changing polygon topology or geological detail.
- The live renderer now feeds frame timing and estimated residency pressure into the controller and applies limits to the active streaming generation without discarding chunks already staged.
- Camera-facing chunks remain prioritized; the selected cell's owning chunk and its actual adjacency-graph neighbours receive interaction priority.
- Original variable-sided `cell.poly` geometry, base-surface continuity, and `faceIndex → cellId` picking remain unchanged. Device hints are heuristics; browser/GPU-specific profiling is still required.
- Details: `docs/STAGE8_0_23_REPORT.md`.

## Stage 8.0.24 — Surface GPU Resource Lifecycle & Memory Pressure Recovery

Added an explicit GPU-resource lifecycle registry for base surface geometry and streamed chunks. Resource disposal is idempotent, residency records are removed with their resources, duplicate IDs are safely replaced, and context restoration re-marks retained geometry attributes for upload. Existing decorative resources retain their reconstructible eviction path. See `docs/STAGE8_0_24_REPORT.md` for scope and verification limits.
