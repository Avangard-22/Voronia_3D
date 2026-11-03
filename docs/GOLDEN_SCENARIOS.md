# GOLDEN SCENARIOS (GS-00…GS-17)

Статусы после восстановления Этапа 2 (2026-11-02). ✅ — покрыт тестами voronia2/tests; ⬜ — ждёт своего этапа.

| ID | Сценарий | Ожидание (данные — runtime-аудит v0.0.41) | Статус |
|----|----------|--------------------------------------------|--------|
| GS-00 | Бут харнесса | монолит стартует в node-vm, `__INT` ~160 имён | ✅ (tools/harness, `npm run extract`) |
| GS-01 | Старт-нули | все ресурсы 0 (t=0), currentCost 10, MAX_LEVEL 100, warehouseLevel 0, eps=1 (cell0 type0 L0), research 0.001/с | ✅ tests/gs01gs02 |
| GS-02 | Стартовое исследование | explored=[0]; revealed=[0,2,1,3,6,7] — ПОРЯДОК вставки (self, затем соседи cell0 в порядке списка); cell0 yield=1 | ✅ tests/gs01gs02 |
| GS-03 | Скан-trail 1→2→3 | charge 9/9/10 (floor(cost×0.9 рукав core)); ΔE −9/−9/+990 (аномалия −10+1000); currentCost 10→11→12→13; 🔬 +1/+1/[10..24]; guards state/hidden/energy/unknown-cell | ✅ tests/gs03 |
| GS-04 | Апгрейд cell0 ×5 | energy 0/96/336/840/1680 (g0×1.2 «Мёрзлый»); iron 12/26/60/108/180 (round(a×1.2)); +1🔬×5; yield 2→6; reserve/maxReserve 1/1→2/2 (Vr); guards max/energy/cost; атомарность | ✅ tests/gs04 |
| GS-05 | Атомарность ledger | мульт-ресурсная транзакция при нехватке ЛЮБОГО ресурса отклоняется ЦЕЛИКОМ | ✅ tests/ledger, gs04 |
| GS-06 | Доход midgame | 42⚡ = (6+1)×6; 0.69⛏ = 0.1×1.15×6; 0.002🔬 = 2×0.001; energyByType {0:42, 3:0} | ✅ tests/income |
| GS-07 | Доход raw (все 12) | 20⚡ (type0 7 + type1 3 + type2 10); 0.23⛏ (2 жилы×0.1×1.15); compound=1 | ✅ tests/income |
| GS-08 | Жилы | ta 0.056/с; cooldown 300000+150000n (кап 1.8M/20); $n 65/101/136/172; Xs min(14,1+0.55n); reserve=maxReserve после реактивации | ✅ tests/veins |
| GS-09 | Склад | Td {alloy (L+1)², energy ceil(800×1.6^L)}: 1/4/9…100, 800/1280/2049/3277…54976; Vi 10+5L; Gi 1+0.05L; Hf explored×Vi; кап 10 | ✅ tests/warehouse |
| GS-10 | Сейв-roundtrip | save→load→(save): ресурсы/explored/revealed(порядок)/cost/warehouse/tech/session идентичны | ✅ tests/persistence |
| GS-11 | Детерминизм | одинаковый seed + скрипт → идентичный снапшот (включая mutant-роллы, science аномалии) | ✅ tests/determinism |
| GS-12 | Реестр/шина | bus.historyCap 50; значения registry (склад/кривые/рукава/costScaleCurve[0]=1.15); fail-fast loader | ✅ tests/config, busTicker |
| GS-13 | Legacy v39 | golden save мигрирует: 20 ресурсов, ferrum explored/revealed, cost 10, tech, warehouse | ✅ tests/persistence (опережение плана — оригинал: Этап 14) |
| GS-14 | Генератор планет | seed→планета (biome/дескрипторы/рукав/геометрия/клетки); детерминизм; krios seed 13045769 | ✅ tests/planetGenerator (16 тестов: 6 full-dump сэмплов + named-фикстура idx3–22 + krios/ferrum + детерминизм + тюнинг) |
| GS-15 | Заряды и surge (Этап 4) | разряд type1 {pct .03, dur 20, science +5, cooldown 45с}, type2 {.08, +15, sonar +1, 90с}; стек .11 → s0 ×1.11 (14→15.54⚡), наука ×1.2 (.001→.0012); krios 9×type1 → .25 atCap, s0 1.25; сосед mult 1.15 → pct .0345/dur 25; сонар-кап 3; истечение → cleanup; авто-surge: nextAt 45..120с, выброс .0195/20с (type2 .092/25с), без науки/сонара, детерминизм по fork | ✅ tests/stage4_charge (fixtures/stage4_audit §discharge/§s0/§chargeKrios/§surge) |
| GS-16 | Аномалии/мутанты/deep/синтез (Этап 4) | ветви: power +4/+8/+16/+32⚡, resonance +.005/.01/.02/.04💎, synth 0; fm .7/.5 (только истощение: .056→.0392); chooseAnomalyBranch reject type/state; мутанты: ember .084/rime .0448/shadow .112, yield ×1.5; nr {50,300}×3^L (idx5 91/547); tl 300/900/2700/8100/24300⚡ + 60/180/540/1620/4860⛏, deep 4800⚡+600⛏ (ucm-асимметрия), L8→isDeep (+.05💎, ×2); синтез: ferrum L2 {.054,.432}, krios L1 {.036,.288} (ОБА перка), boost_synth ×1.5, Ty(10с) −4.32⛏/+0.54🧪 | ✅ tests/stage4_anomaly + tests/stage4_synth (fixtures/stage4_audit §branches/§mutants/§deep/§synth) |
| GS-17 | Ядро грани/открытие миров/смена планеты (Этап 5) | type7: 100×Ws(2)=200⚡ ВСЕГДА (deep-инвариант) + 0.03💎/с, ×зарядная цепь; discover seed 777001 → planet_03 «Гелика-Прайм» (frost, f3 octahedron, 22 клетки, 1100🔬, узел x53.0765/y0.232/z21.881, ребро→krios, без автосwitch); 888002 → planet_04 «Ван» (2420🔬); override cube/f2/ferrum → planet_05 (5324🔬); setActive: guard (krios locked → false), своп storage 1.x (1234/77 ↔ 0/0) — Этап 9; save-реплей спеков детерминирован; 3D-билдер: facets=Σ(poly−2), edges=Σnb/2, krios 92 клетки | ✅ tests/stage5_discovery + tests/stage5_renderer (fixtures/stage5_audit) |

## Исключения детерминизма (унаследованы от 1.x)
- `gameStartSeed = (Date.now() ^ 305419896) >>> 0` — wall-clock; в тестах фиксируется явным seed.
- `session.startTime` — wall-clock, вне сравнения снапшотов.
- Последовательности RNG 2.0 НЕ обязаны совпадать с 1.x (алгоритм mulberry32 тот же, порядок потребления свой); parity проверяется по наблюдаемым числам (science-диапазон 10..24, структура мутантов).
