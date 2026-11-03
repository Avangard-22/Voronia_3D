# STAGE 2 REPORT — Core и Economy (восстановление)

**Статус:** ВЫПОЛНЕН (восстановлен после утраты исходников; ворота зелёные) · **Дата:** 2026-11-02
**CI:** `lint ✓ · typecheck(app) ✓ · typecheck(node) ✓ · check:arch ✓ (58 файлов) · vitest 103/103 ✓ · build ✓ · build:single ✓ (96 КБ) · check:size ✓ (0.09 МБ ≤ 6 МБ)`

> ⚠️ Это ВОССТАНОВЛЕННЫЙ отчёт. Оригинальный STAGE2_REPORT (148 тестов) утрачен вместе с исходниками.
> restoration-сессия: (1) заново поднят харнесс извлечения из baseline-монолита (24+1 фикстура),
> (2) восстановлен скаффолд и все домены среза по документам (README/VERDICT/STAGE1_REPORT) и фикстурам,
> (3) тестовое покрытие пересобрано — 103 теста (дельта с оригиналом — в §5).

---

## 1. Что сделано

### 1.1 Ядро (core/)
- `EventBus` — типизированная шина (payload `GameEventMap`), изоляция ошибок обработчиков, кольцевая история cap = registry `bus.historyCap` (50). Имена событий — parity 1.x (`cell:scanned`, `cell:upgraded`).
- `GameClock` — Raf/Manual-драйверы, пауза/скорость (0.25–4), кламп dt ≤ 500 мс (parity C1), избыток — в фонд `stalledRealMs` (офлайн-расчёт Этапа 11), serialize/hydrate.
- `Rng` — mulberry32, seedable, `fork(label)` (FNV-1a от label ⊕ состояние), `nextInt`, serialize/hydrate. Совпадение ПОСЛЕДОВАТЕЛЬНОСТЕЙ с 1.x не требуется (GS-исключение «gameStartSeed»); требуется детерминизм 2.0 — подтверждён тестом.
- `Logger` — уровни, cap-буфер, LogSink-порты.
- `Game` — фасад: единственный DI-сборщик (ADR-012), диспетчер `dispatch<C>(cmd, payload) → ActionResult<CommandResultMap[C]>`, snapshot() для UI, `SaveSource` (collectState/applyState), `advance(dtMs)` для тестов.

### 1.2 Конфигурация (config/)
- `registry.json` v0.0.41 (37 секций, копия `window.VORONIA_BALANCE` после override-v41) — типизированный `RegistryView`, fail-fast валидатор со СПИСКОМ проблемных путей.
- `baseline.json` — source-only константы с `_provenance`: скан/аномалия/апгрейд (raw-кривая `g0` 20 записей + yl-продолжение), Vr-профиль уровня (таблицы 26+26), жилы (формулы $n/$l/ta), склад, research-капы (ng), старт, галактика (таблицы рукавов Df/Za/Lr + biomeMults Xc).

### 1.3 Контракты (contracts/)
- 21 ключ ledger (7 top + 8 extra + 5 compounds + shards), `COMPOUND_BONUS` (steel .005/chip .015/alloy .03/core .05/relic .1, кап ×6 — Fa()), грузовые веса `dn`.
- Типы клеток 0–7, `CellState` (+isDeep), perks/descriptors, `PlanetData`, `PlanetRuntime` (Set с порядком вставки — GS-02).
- Команды/результаты/отказы (закрытый набор причин parity: `state/energy/cost/max/type/cooldown/hidden/unknown-cell/not-implemented`).
- Порты (ADR-012): `StoragePort/ClockDriver/RngPort/LogPort/EventPort/LedgerPort/TechPort/ScanPricingPort/TickListener` — домены НЕ импортируют друг друга и core.
- `GameSnapshot` — UI рендерит только из снапшота.

### 1.4 Экономика (economy/)
- `ResourceLedger` — единственная точка изменения балансов (ворота ТЗ §15). Атомарные транзакции `{id, reason, scope, delta, gameMs}`; мульт-ресурсная транзакция отклоняется ЦЕЛИКОМ (GS-05-принцип); журнал in-memory cap 200, НЕ персистится (ADR-013).
- `IncomeService` — ce()/ng() parity: постатейный доход (energyByType), именованные цепочки модификаторов (ADR-014), планетный кап research `(50+50×idx)`, хуки поздних этапов множителем 1.
- `ProductionService` — истощение жил ta() (0.056/с ferrum), cooldown 300000+150000n (кап 1.8M/20 — registry), реактивация $n (65/101/136/172⚡), Xs=min(14,1+0.55n), l1=1+max(0,L−9)×0.07, Wr(idx), gt-анлоки (kriogen за `unlock_kriogenBoost`).
- `CellUpgradeService` — zn()/Ni()/ml()/Vr()/b0()/_0()/hcApply() parity: кривая g0 (registry) + yl-продолжение (1.13^n → cap 25 → 1.025), цена round(e×r)/round(a×r) (r=1.2 «Мёрзлый»), +1🔬 = min(25, 1+floor(E/2500)), yield=1+L, reserve-профиль (1/1→2/2), deep c L8, levelRewards c L10, hardcore-compounds c L16 (gated рецептами), research-цена c L16 (250×1.14^k), x0-цены научных клеток li() (25000⚡/15💎/150🔬, ×1.9/1.7/1.9, silicon c L5).
- `WarehouseService` — Vi=10+5L, Gi=1+0.05L, Td={alloy (L+1)², energy ceil(800×1.6^L)} (float-ceil parity: L2→2049), Hf=explored×Vi, Ey=Σ storage×dn, кап 10, атомарность alloy+energy.
- `EconomyTicker` — за тик: истощение (домен) → ОДНА агрегированная транзакция дохода (`tick:income`) → `game:tick`.

### 1.5 Планеты (planets/)
- `loadPlanetData` + валидатор графа (уникальные id, симметричные соседства, без self-loop, старт существует; коды `planet.*`, fail-fast).
- `planet_ferrum_v0.0.41.json` — из fixtures/planet_ferrum_full.json (12 клеток, типы {0:7,1:1,2:1,3:2,4:1}, seed 15929600, perks «Мёрзлый/Каменистый»).
- `applyStartState` — GS-02: explored=[0], revealed=[0,2,1,3,6,7] (порядок вставки!), cell0 yield=1.
- `ExplorationService` — Sd() parity: guards (state/hidden/energy/unknown-cell), charge=floor(currentCost×perk×arm 0.9), одна транзакция (−charge +награды), аномалия +1000⚡/+50⛏/+10..24🔬, неаномальные +min(10,1+floor(charge/1000))🔬, рост цены max(cur+1, floor(cur×growth)) — TV-3 floor НА ШАГЕ, жила→ironYield 0.1, мутант-ролл 12%.

### 1.6 Прогрессия (progression/)
- `ScanPricing` — growth=clamp(costScaleCurve[tech.costScale], 1.03, 1.3), fresh 1.15; TV-1/2/3 закрыты.
- `TechState` — уровни + Kt-анлоки (RESOURCE_UNLOCK из fixtures/resources_research), costScaleMult()=Gk().

### 1.7 Персистентность (persistence/)
- Схема `voronia2.save` v2 + валидатор; миграция legacy v39 (ВНЕ плана — оригинал отнёс её к Этапу 14; оставлена как есть, покрыта тестом на golden save).
- `SaveManager` — save/load/export/import, автосейв (registry hygiene.autosaveMs), MemoryStorage/LocalStorageAdapter, ключи `voronia2.save.v2` + legacy `cosmicClickerV19`.
- Roundtrip: ресурсы/explored/revealed(порядок)/currentCost/warehouse/tech/session/gameMs переживают save→load.

### 1.8 UI-минимум (ui/) и точка входа
- HUD (ресурсы+ставки, скан, склад, сейв-кнопки, журнал транзакций), доска клеток (hidden/revealed/explored, апгрейд/скан/реактивация), рендер ТОЛЬКО из снапшота, команды ТОЛЬКО через dispatch.
- `main.ts` — RafDriver + LocalStorage, загрузка сейва (v2/legacy), авто-рендер 4 Гц, `window.__VORONIA2`.
- Домены-заглушки: renderer(6)/audio(13)/galaxy(5)/logistics(9)/combat(8)/crafting(6) — статусы NOT_IMPLEMENTED (ТЗ §19).

### 1.9 Инструменты и CI
- `tools/check_arch.mjs` — слои ADR-012 (contracts←config←domains←core←ui), R2 домен↛домен, R3 ui↛домены, R4 main — composition root, R5 циклы, R6 src↛fixtures/tools/tests; .json-данные разрешены.
- `tools/check_size.mjs` — dist-single ≤ 6 МБ.
- `tools/harness/{boot,dom_stubs}.cjs` + `tools/extract_stage0.cjs` — извлечение фикстур из монолита (перезапускаемо: `npm run extract`, ~20 с, 24 фикстуры).
- `.github/workflows/ci.yml` — lint/typecheck×2/check:arch/test/build/build:single/check:size + artifact.

## 2. Parity-таблицы (все подтверждены тестами)

| Точка | Ожидание (v0.0.41) | Тест |
|---|---|---|
| GS-01 старт | ресурсы 0 (t=0), cost 10, MAX_LEVEL 100, wh 0, eps 1 (cell0) | gs01gs02 |
| GS-02 старт-исследование | explored [0]; revealed [0,2,1,3,6,7] (порядок) | gs01gs02 |
| GS-03 скан-trail 1→2→3 | charge 9/9/10; ΔE −9/−9/+990; cost 10→11→12→13; 🔬 +1/+1/[10..24] | gs03 |
| GS-04 апгрейд ×5 | 0/96/336/840/1680⚡; 12/26/60/108/180⛏; +1🔬×5; yield 6; reserve 2/2 | gs04 |
| Доход midgame | 42⚡ = 7×6; 0.69⛏ = 0.1×1.15×6; 0.002🔬; energyByType {0:42,3:0} | income |
| Доход raw (все 12) | 20⚡ (7+3+10); 0.23⛏; 0.007🔬 | income |
| Compound | 1+min(Σu×bonus,5), кап ×6 | income |
| Жилы | ta 0.056/с; cooldown 300000+150000n (кап 1.8M/20); $n 65/101/136/172; Xs min(14,1+.55n); −0.028/тик | veins |
| Склад | Td alloy 1/4/9/16…100; energy 800/1280/2049/3277…54976; Vi 10+5L; Gi 1+.05L; Hf; Ey | warehouse |
| Ledger | атомарность (GS-05), журнал cap 200, serialize/hydrate, tx-события | ledger |
| Сейв | roundtrip, export/import, legacy v39 (golden), порядок revealed | persistence |
| Детерминизм | seed→идентичный снапшот (включая mutant-роллы и science-аномалии) | determinism |
| Часы | кламп 500 мс, stalledRealMs, пауза, скорость | busTicker |
| Шина | история cap 50, изолятор ошибок, once/off | busTicker |
| Конфиг | GS-12 значения реестра, кривая g0=registry, fail-fast | config |
| Данные планеты | граф валиден; битые данные → коды planet.* | planetData |

## 3. Provenance (источники чисел)
- Runtime-извлечение из baseline-монолита (harness boot + `window.__INT`, ~160 имён): Sd@358326, ln@132442, ce@123246, zn@120467, Ni@361014, C1@204815, ng@717304, Ur@115078, Fa@683593, ta@263838, $n@171973, Xs@171869, zr@120467, gt@120375, Vr@139084, ml@140162, b0@140693, _0@144004, hcApply@144536, li (research-цены), yl (кривая), Kt/Gk (evcombo).
- Фикстуры (25): gs01–gs04, income_midgame_documented, income_audit, veins_audit, warehouse_curve/audit, galaxy_arms_full, anomaly_types, resources_research, golden_save_fresh/midgame, planet_ferrum_full, planet_krios_full, planetgen_tables/samples/determinism_check, rng_determinism, bus_events, save_schema39_keys, research_cells, planets_summary, meta.
- Реестр v0.0.41 (37 секций) — registry.json; всё остальное source-only — baseline.json с `_provenance`.

## 4. Решения восстановления
- Legacy v39-миграция реализована СЕЙЧАС (опережение плана — оригинал: Этап 14); поведение зафиксировано тестом на golden save.
- `PlanetRuntime`/`TechLevels`/`ArmModifiers`/`CommitRequest` вынесены в contracts — домены общаются только портами (check_arch R2 enforce).
- Сессия считается ПОДПИСКАМИ Game на шину (домены не знают о сессии); `cell:upgraded` несёт `deepUnlocked`.
- Журнал ledger — 200 записей in-memory (как в оригинале, ADR-013).

## 5. Дельта с оригинальным Этапом 2
- Тестов 103 против 148: покрытие parity-точек §2 полное; в оригинале дополнительно были юнит-тесты по каждому домену (logger/clock internals/validator edge-cases) и `economy_audit_v0.0.41.json`-фикстура (утрачена; заменена income_audit+warehouse_curve — значения сходятся).
- `tools/extract_stage2.js` и `tools/anchors.py` не восстановлены (их результат — фикстуры — уже извлечён `extract_stage0.cjs` + probes).
- Ey midgame 420464 т (оригинальная контрольная точка) — не воспроизводится без утраченного economy_audit; Ey покрыт формулой (Σ storage×dn) и структурным тестом.

## 6. Не сделано (осознанно, по этапам)
Синтез/заряды/аномалии-ветви (4), 3D-рендер (5), крафт (6/8), покупка технологий (7), генератор планет/krios (3 — СЛЕДУЮЩИЙ), галактика/роли/транспорт (9), бой/печати/офлайн (10/11), полный UI (12), аудио (13), миграция 1.x в части расширенных секций (14).

## 7. Ворота Этапа 2 — ЗАКРЫТЫ
✅ Баланс меняется только через ledger · ✅ Атомарность транзакций · ✅ Детерминизм по seed · ✅ Слои/порты (check_arch) · ✅ Single-file ≤6 МБ · ✅ CI зелёный.
