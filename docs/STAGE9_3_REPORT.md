# Этап 9.3 — Технологии и реактор (Этапы 7/8 ТЗ) + фикс миграции кулдаунов

**Дата:** 2026-11-03 · **Версия:** `2.0.0-stage9.3.0` · **Решения:** `docs/adr/adr-021.md`
**CI:** lint 0 · typecheck (app+node) 0 · check:arch OK (108 файлов) · **Vitest 452/452 (67 файлов)** ·
build:single 810.21 КБ (gzip 231.79 КБ) · check:size 0.77 МБ ≤ 6 МБ.

## 1. Дерево исследований (Этап 7 ТЗ)

**Новые файлы:** `src/progression/techTree.ts` (граф + цены + политика), тесты `tests/stage9_3_tech.test.ts`.

- **8 многоступенчатых технологий v1** (`costScale, ironBoost, maxLevel, crystalBoost, kriogenBoost, therm, hyperdrill, recon`) —
  цены из `registry.tech.costScaleTable` (parity v0.0.41), после 10-й строки — поздний рост ×1.35/уровень; потолок `LEVEL_TECH_MAX = 100`.
- **Unlock-исследования v1** (`RESEARCH_NAMES` из фикстуры): открытие ресурсов (`unlock_kriogenBoost/carbon/silicon/titanium/uranium/darkMatter`),
  ветки (`unlock_therm/hyperdrill/recon`), рецепты (`recipe_steel/chip/alloy/core/relic/datablock`), синтез-ресурсы (`unlock_synth_helium3/biomass/platinum`), бусты синтеза (`boost_synth`, `boost_synth2`).
- **Граф prerequisites:** `kriogenBoost←unlock_kriogenBoost`, `therm←unlock_therm`, `hyperdrill←unlock_hyperdrill`,
  `recon←unlock_recon`, `boost_synth2←boost_synth`, `recipe_alloy/chip←recipe_steel`, `recipe_core←recipe_alloy`, `recipe_relic←recipe_core`.
- **Эффекты — типизированные модификаторы** (TechPort): `yieldMult` (+25%/уровень iron/crystal/kriogen),
  `veinCooldownMult` (therm: ×0.9^уровень, пол 0.4), `veinYieldMult` (hyperdrill: +20%/уровень),
  `scanCostMult` (recon: −5%/уровень, пол 0.5), `cellMaxLevelBonus` (+1/уровень к потолку клетки).
  Потребители: `income.ts`, `production.ts`, `upgrades.ts`, `scanPricing.ts`.
- **Команда `buyTech {id}`** → `{techId, level}`; отказы `unknown-tech | locked | max | cost`;
  списание одной атомарной транзакцией `tech:<id>`; счётчик сессии `techsBought`.
- Баланс, которого не было в данных v1 (цены unlock, численные эффекты) — единый блок `RESEARCH_POLICY` (ТЗ §15).

## 2. Реактор и крафт (Этап 8 ТЗ, §6)

**Новые файлы:** `src/crafting/reactor.ts`, `src/contracts/crafting.ts`, тесты `tests/stage9_3_reactor.test.ts`.

- **11 рецептов v1** из `registry.craft.recipes`: соединения (steel→chip→alloy→core→relic),
  блоки данных (researchData/Bulk/Elite → `research`), синтез-ресурсы (helium3/biomass/platinum → resGain).
- **Гейты:** рецепт доступен после соответствующего исследования (`RECIPE_GATE`); UI показывает 🔒 с именем требуемого исследования.
- **Правила списания (§6):** входы run — одна атомарная транзакция на старте run (`reactor:<recipe>`);
  нехватка → `deficit` (пауза, прогресс не теряется, UI: «⚠ Дефицит ресурсов»); выход — одна транзакция
  `reactor:output` по завершении; отмена возвращает только не стартовавшие run.
- **Очередь:** cap `queueCapBase = 50` (отказ `queue-full`), активный слот `baseSlots = 1`, время run
  `max(minTimeSec, recipe.time)`; ETA — секунды текущего run (никаких эпохальных чисел).
- **Персистентность:** `SaveGameV2.reactor?` (задачи + `nextJobId`); export/import и load/save сохраняют
  очередь и прогресс; `hydrate` отбрасывает неизвестные/завершённые задачи; `newGame` очищает.
- **UI:** панель «🏭 Реактор» в колонке HUD — очередь (прогресс-бар/состояние/✕-отмена) и рецепты (+1/+10);
  пустая очередь — точный текст ТЗ **«Реактор в покое…»**; состав панелей не зависит от состояния — структура не «прыгает».
- Офлайн-прогресс реактора — Этап 11 (осознанный перенос).

## 3. Фикс миграции: эпохальные кулдауны («⏳ 1700000000 с»)

`src/persistence/schema.ts` — `legacyGameMs()`: значения `cooldownUntil` из legacy v39 на шкале
`Date.now()` (`> 1e11`) → 0; отрицательные/нечисловые → 0; обычные игровые мс сохраняются.
Регресс-тесты: `tests/stage9_3_migration.test.ts` (5 тестов, включая UI-следствие на загруженном сейве).

## 4. Контракты и оснащение

- `contracts/commands.ts`: команды `buyTech`, `craftEnqueue {recipeId, runs?}`, `craftCancel {jobId}`;
  `REJECT_REASONS` += `locked, unknown-tech, unknown-recipe, queue-full, unknown-job` (аддитивно).
- `contracts/snapshot.ts`: `GameSnapshot.tech: TechSnapshot` и `GameSnapshot.reactor: ReactorView`.
- `contracts/ports.ts`: `TechPort` += `level`, `yieldMult`, `veinCooldownMult`, `veinYieldMult`, `scanCostMult`, `cellMaxLevelBonus`.
- `contracts/tech.ts`: `TechNodeView/TechSnapshot` (view-типы дерева).
- `core/game.ts`: Reactor в конструкторе (секция `registry.raw.craft`), шаг тика реактора, снапшот
  (`tech`/`reactor`), serialize/hydrate (включая `newGame`), три новых case диспетчера.
- `ui/app.ts` + `ui/styles.ts`: панели «🔬 Технологии» и «🏭 Реактор», действия `buy-tech/craft-enqueue/craft-cancel`, стили строк/прогресс-баров/дефицита. Заголовок HUD — «Stage 9.3».

## 5. Тесты (54 новых, всего 452)

- `stage9_3_tech.test.ts` (26): целостность графа, parity цен (таблица + поздний рост + политика),
  buyTech-потоки (unknown/locked/cost/max/успех/многоуровневость/costScale-зеркало),
  все модификаторы эффектов, **каждый RESOURCE_UNLOCK-unlock индивидуально**, интеграции (recon→цена скана, ironBoost→perSec), techNodes.
- `stage9_3_reactor.test.ts` (23): снапшот/гейты/выходы рецептов, цикл run (атомарные транзакции),
  дефицит-пауза-возобновление, ETA, dataGain, runs-по умолчанию/flooring/отказ, отмены, queue-full,
  export→import персистентность, hydrate-фильтры, newGame-сброс, UI-тексты («Реактор в покое…», дефицит, стабильность структуры), unit слоты/дефолты.
- `stage9_3_migration.test.ts` (5): epoch→0, граница 1e11, обычные мс, мусор→0, UI-следствие.

## 6. Как играть (что появилось на экране)

1. Копите `research` (блоки данных появятся позже; стартовый доход — клетки/жилы).
2. Колонка HUD → «🔬 Технологии»: покупайте unlock-исследования и уровни технологий (кнопка с ценой; 🔒 — требование; ✓ максимум).
3. «🏭 Реактор»: после `recipe_steel` доступен рецепт «Сталь» (+1/+10). Входы списываются на старте run;
   при нехватке задача ждёт в состоянии «Дефицит»; ✕ снимает не стартовавшие run. Пусто — «Реактор в покое…».

## 7. Известные пробелы (не входят в 9.3)

Prestige-матрица (Этап 7 ТЗ — частично, за пределами среза), боевые системы/стражи (Этап 10),
офлайн/премиум (Этап 11), роли планет/флот, модальные окна/тосты/онбординг (Этап 12),
перенос `RESEARCH_POLICY` в registry и свободные орбиты `discoverPlanet` (backlog Этапа 9.1).
