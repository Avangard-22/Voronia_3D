# TO_VERIFY (TV) — пункты проверки, унаследованные от анализа монолита

Статусы после восстановления Этапа 2. CLOSED — подтверждено тестом/фикстурой в voronia2; PARTIAL — подтверждено частично; OPEN — ждёт этапа.

| ID | Пункт | Статус | Чем закрыт |
|----|-------|--------|------------|
| TV-1 | Цена скана = floor(currentCost × perk × рукав); core ×0.9 | CLOSED | tests/gs03 (9/9/10) |
| TV-2 | Рост цены: growth = clamp(costScaleCurve[tech.costScale], 1.03, 1.3), fresh 1.15 | CLOSED | tests/config + scanPricing |
| TV-3 | Шаг цены: max(cur+1, floor(cur×growth)) — floor НА ШАГЕ | CLOSED | tests/gs03 (10→13) |
| TV-4 | Аномалия: +1000⚡ +50⛏ мгновенно, 🔬 10+floor(rand×15), обычная наука не начисляется | CLOSED | tests/gs03 |
| TV-5 | Compound-бонус: 1+min(Σunits×bonus, 5), кап ×6 | CLOSED | tests/income |
| TV-6 | Награда за открытие планеты: floor(500×2.2^max(0,idx−2))🔬 (уточнено по бандлу: это награда discoverPlanet, не аномалии) | CLOSED | tests/planetGenerator (discoverReward + discoverPlanet) |
| TV-7 | Жилы: ta 0.056/с = 0.1×0.8(core)×0.7(«Мёрзлый»); l1=1+max(0,L−9)×0.07; Wr(idx) | CLOSED | tests/veins |
| TV-8 | Кулдаун/реактивация: 300000+150000n (кап registry); $n=max(40,round(48×(L+1)^1.18×s×Xs×perk)) → 65/101/136/172 | CLOSED | tests/veins |
| TV-9 | Ветви аномалий (synth/power/resonance): модалька выбора, эффекты (power: сон ×0.7, deep ×0.5; resonance: кристаллы) | CLOSED | Этап 4: ce-эффекты +4×(1+L)×dc ⚡ / +.005×(1+L)×dc 💎 (tests/stage4_anomaly, GS-16); fm .7/.5 — только истощение; команда chooseAnomalyBranch; модалка um/тосты — UI Этап 12 |
| TV-10 | Склад: Td/Vi/Gi/Hf/Ey, float-ceil parity (L2 → 2049) | CLOSED | tests/warehouse |
| TV-11 | Генератор планет: seed → идентичная планета; биомы/дескрипторы/рукава/геометрия/mixed/unique-формы | CLOSED | tests/planetGenerator (16 тестов: 6 сэмплов full-dump, named-фикстура idx3–22, krios/ferrum, детерминизм) |
| TV-12 | Смена активной планеты без транспорта | CLOSED-DEVIATION | Этап 8.1 (ADR-018): `setActivePlanet` — алиас `travelToPlanet`: оплата первого перехода, маршрут сжимается до остановок, транзит через неоткрытые системы 1.5×/2.5×. Guard 1.x «существует И открыта» сохранён и усилен (`runtimes.has`); бесплатного переключения в 2.0 нет — tests/stage8_1_galaxy_transit (5), tests/stage5_discovery |
| TV-13 | Заряды type1/2 (registry charge): пассивный доход 3/10 подтверждён (GS-07), зарядные циклы | CLOSED | Этап 4: i0/s0/a0/ll + авто-surge v0.0.39.0 (tests/stage4_charge, GS-15; фикстура stage4_audit §discharge/§s0/§surge) |
| TV-14 | Исследовательские клетки: li-цены (25000/15/150, ×1.9/1.7/1.9, silicon c L5), доход ng линейный 5×min(15,L), display hl=5×1.3^(L−1) | PARTIAL | формулы в upgrades.ts + тест li; полный прогон x0 — Этап 7 (покупка технологий) |
| TV-15 | levelRewards/hardcore: _0 c L10 (×1.18^min(40,·) за таблицей), hcApply c L16 (gated рецептами) | PARTIAL | формулы перенесены (upgrades.ts), тесты — Этапы 6/8 (крафт/рецепты) |
| TV-16 | Детерминизм RNG 2.0 (seed → снапшот) | CLOSED | tests/determinism |
| TV-17 | Офлайн-доход (registry offline maxSeconds/efficiency; stalledRealMs-фонд) | OPEN | Этап 11 (фонд копится — tests/busTicker) |
| TV-18 | Мутанты жил: ролл 12%, эффект yieldMult/depletionMult | CLOSED | Этап 4: ролл type3\|\|type5 (exploration.ts), su-таблица по рукавам, ta ember .084/rime .0448/shadow .112 (tests/stage4_anomaly); UI-тосты — Этап 12 |
| TV-19 | Глубокие клетки: b0 c L8 (isDeep), Ws=2 доход, deep-истощение, deepUpgradeCurve | CLOSED | Этап 4: b0 L8→isDeep (×2, type0 +.05💎/с), tl-путь аномалий maxLevel 5 + deep-конверсия 4800⚡/600⛏ c ucm-асимметрией (tests/stage4_anomaly, GS-16) |
| TV-20 | Печати/боссы/стражи/коллапсы (seal-множители в цепочках — хуки=1) | OPEN | Этапы 8/10 |
| TV-21 | Крафт соединений (recipes) — влияние на compound-доход | PARTIAL | compound-мультипликатор закрыт (TV-5); рецепты — Этап 6/8 |
| TV-22 | Reactivate: refill reserve = maxReserve (полный) | OPEN→проверить на Этапе 3 харнесс-пробой (реализовано по декодированному C1; точная фикстура не записана) |
| TV-23 | Поля кривой g0: `g` (kriogen-компонент цены) и `x` — назначение не подтверждено фикстурой (ferrum: g=0, x=0 на низких уровнях) | OPEN | Этап 3+ (krios-жилы) |
| TV-24 | type7 «ядро грани»: доход-ресурс (energy 100 по Ur vs crystals×core.crystalRate). Unique-формы xf/kf портированы (Этап 3) | CLOSED | Этап 5: ОБА — energy 100×Ws(2) всегда (deep-инвариант) + crystals 0.03×цепь (аудит §type7, tests/stage5_discovery); постройка/слияние ядра — TV-35 |
| TV-25 | Научные клетки: silicon-цена списывается с ХРАНИЛИЩА планеты (Wt), не с глобального ledger; своп storage при смене планеты (On/yy: iron/kriogen/extraResources; аудит stage5 §setActive: 1234/77 ↔ 0/0) | OPEN | Этап 9 (planet scope); сейчас — единый ledger c scope-метками, своп не портирован (ADR-017) |
| TV-26 | Mixed-миры из сейва: _mixedClusters → _forcedClusters → ni() (код портирован, фикстуры сейва со смешанным миром нет) | OPEN | Этап 11 (persistence mixed-планет) |
| TV-27 | Сонар-превью и открытый мир используют один детерминированный discovery pipeline; показанные данные совпадают с фактически созданной планетой | CLOSED-DEVIATION | Stage 6.0: preview запускает runDiscovery на изолированной копии графа и повторно использует seed при открытии; прямой вызов Zn/VorResRoll не портирован |
| TV-28 | Роли планет (roles.defs crafter/feeder/scholar): данные типизированы в config; назначение роли (цена, supplyNodes, fleet) — механика transport/UI | OPEN | Этап 5/9 (транспорт) |
| TV-29 | spc_hidden (ao(pid,'spc_hidden')): tech-профиль скрывает ветви — все type4 считаются как synth (Ds/ti) и power-доход в ce; в 2.0 — хук spcHiddenFor=false | OPEN | Этап 7 (tech-профили); хук заведён в income/synth |
| TV-30 | Ролевые модификаторы синтеза: Co(synthOut) и mt(synthOutMult)/mt(anomalyBonusMult) в ti-цепи; в 2.0 — хуки roleMultFor/modsFor=1 | OPEN | Этап 9 (роли/транспорт) |
| TV-31 | Ay() — offline-вариант тика синтеза (offlineCapMult=1) и offline-накопление зарядных баффов/surge | OPEN | Этап 11 (offline) |
| TV-32 | Баффы зарядов и surge-состояние НЕ персистятся в save v2 (короткоживущие; в 1.x — runtime n.chargeBuffs, сбрасывался при перезагрузке) | OPEN | подтверждено решением ADR-016; расширение схемы — Этап 6 (сонар) при необходимости |
| TV-33 | Сонар: полный цикл (превью, открытие Криос-9, бонус, расход зарядов/повторный скан) | PARTIAL | Stage 6.0: трёхраундовый unlock Криос-9, бонус 24ч и preview следующего мира реализованы; расход зарядов, reroll и повторное сканирование остаются открытыми. Кап выдачи 3 подтверждён tests/stage4_charge |
| TV-34 | 1.x surge-планировщик — setInterval(2000) c тост-троттлингом 12000мс; 2.0 — шаг тикера по surgeNextAt (семантика эквивалентна, ADR-016); тосты — UI | CLOSED-DEVIATION | tests/stage4_charge (Game-интеграция surge-шага); сверка на живом UI — Этап 12 |
| TV-35 | Ядро грани: постройка/слияние (core.buildCost {900💎,200000⚡}, mergeRichCost {90,20000}, mergeFallbackCost {140,30000}; qr — «единственное на планете») + скрытый мир sm() (seed=gameStartSeed^1212761156, idx 100, поток «сердца Воронии») | OPEN | Этап 8/10 (крафт/боссы); доход type7 закрыт TV-24 |
| TV-36 | FPS на целевом Android (вердикт R1): FpsMeter (fps/avg/p95) встроен в main.ts; критерии Приложения B — desktop 60, mobile 30, p95<33мс, heap<350МБ, soak 60мин | OPEN | нужен замер на устройстве (после Этапа 5-превью); desktop-сборка 0.60 МБ single-file |
