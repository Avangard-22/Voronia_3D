# STAGE4_REPORT — Аномалии и заряды (Этап 4)

**Дата:** 2026-11-02 · **Статус:** ВЫПОЛНЕН · **CI:** `npm run ci` EXIT 0 — lint/typecheck×2/check:arch (69 файлов)/**178 тестов** (122 + 56 новых)/build/build:single/check:size (0.13 МБ ≤ 6 МБ)

## 1. Цель и ворота (ТЗ §15)

Порт механик 1.x: заряды жил type1/2 (i0/s0/a0/ll), авто-surge v0.0.39.0, ветви аномалий type4 (Ho/Uo/um + эффекты в ce), fm-истощение, мутанты жил (su/ролл 12%), deep (b0 L8 + tl-путь аномалий c nr/To/ucm), синтезатор (el/Iy/ei/Cy/Ly/ti/Ty). Ворота: паритет c задокументированными фактами 1.x; данные — только извлечение из бандла; баланс — только через ledger; детерминизм по seed.

## 2. Метод

1. **Извлечение:** `tools/extract_stage4.cjs` (харнесс `tools/harness/boot.cjs`, `__INT` пополнен; `env.Date.now` переопределён ПОСЛЕ бута — NOW заморожен; surge ловится реальным setInterval; `tl` — под `__ccAutoQuiet=true`) → **`fixtures/stage4_audit_v0.0.41.json`** (seed 20260401): §config/§discharge/§s0/§branches/§synth/§mutants/§deep/§chargeKrios/§surge/§busTail/§stateFinal.
2. **Порт:** контракты (cells/anomalies/events/commands/snapshot) → домены (economy/charge.ts, economy/synth.ts, planets/anomalies.ts, anomalyUpgradeCost+AnomalyUpgradeService в economy/upgrades.ts) → интеграция в core/game.ts (4 сервиса, 3 dispatch-кейса, шаги тикера, bus-слушатели, snapshot/collect/applyState) → минимальный UI (разряд/ветвь/апгрейд аномалии + панели зарядов/синтеза).
3. **Тесты:** 56 тестов на золотой фикстуре (tests/stage4_charge|stage4_anomaly|stage4_synth).

## 3. Паритет (золотые значения — все подтверждены тестами)

| Механика | Аудит 1.x | Порт 2.0 |
|---|---|---|
| Разряд type1/type2 | pct .03/.08, dur 20+5×соседи, science 5/15×mult, cooldown 45/90с, sonar +1 (cap 3) | ✅ ChargeService (§discharge, §chargeKrios) |
| Стек/s0 | .03+.08=.11 → ×1.11: 14→15.54⚡; наука ×1.2: .001→.0012; krios 9× → .25 atCap, s0 1.25; сосед mult 1.15 → .0345/25с | ✅ (§s0, §chargeKrios) |
| Surge | nextAt 45..120/90..240с; .0195/20с, .092/25с; без науки/сонара; cooldown=surgeUntil | ✅ шаг тикера + rng.fork (§surge; ADR-016 п.4/5) |
| Ветви | power +4/+8/+16/+32⚡; resonance +.005/.01/.02/.04💎; synth 0; дефолт 'synth' (Uo) | ✅ ce-цепи income.ts (§branches) |
| fm | power .7, deep-power .5; ТОЛЬКО истощение: .056→.0392 | ✅ production.sleepFor (§branches.fm*; ADR-016 п.3) |
| Мутанты | ember .084 / rime .0448 / shadow .112; yield ×1.5; ролл type3‖type5 | ✅ exploration+production (§mutants) |
| deep/tl | L8→isDeep (×2, type0 +.05💎); nr {50,300}×3^L (idx5 91/547); шаги 300/900/2700/8100/24300⚡+60/180/540/1620/4860⛏; deep 4800⚡+600⛏ (ucm 1.2 асимметрия) | ✅ b0/AnomalyUpgradeService (§deep; ADR-016 п.8) |
| Синтез | ferrum L2 {.054,.432}; krios L1 {.036,.288} (ОБА перка); deep ×2; boost_synth ×1.5/+2 ×2; Ty(10с) −4.32⛏/+0.54🧪, −2.88❄/+0.36🧪; origin.synthesized | ✅ SynthService (§synth; ADR-016 п.6/7) |

## 4. Артефакты

- `src/economy/charge.ts` (ChargeService: i0/s0/a0/ll + surge-планировщик), `src/economy/synth.ts` (SynthService: el/Iy/Ly/ei/Cy/ti/Ty/$o), `src/planets/anomalies.ts` (fmFor, AnomalyService/chooseAnomalyBranch), `anomalyUpgradeCost`+`AnomalyUpgradeService` в `src/economy/upgrades.ts`.
- `contracts/anomalies.ts` (branchOf/isAnomalyBranch/SYNTH_PRODUCT_BY_ARM/ChargeStatus/SynthStatus), расширения: IncomeContext.planetHooksFor/spcHiddenFor, production.sleepFor, ticker steps, schema `sonarCharges?`, CellView charge-поля.
- `core/game.ts`: сервисы, dispatch `dischargeCell`/`chooseAnomalyBranch`/`upgradeAnomalyCell`, шаги тикера (surge → production → synth), snapshot `charge/sonarCharges/synth`, collect/applyState.
- `ui/app.ts`: кнопки ⚡Разряд / ▲Аномалия / выбор ветви; панели «Заряды (сонар)» и «Синтез».
- `baseline.json`: секции anomalyUpgrade/anomalyIncome/synth/surge c `_provenance`.

## 5. Отклонения (ADR-016)

Reject-reasons закрытым набором (+detail); surge — шаг тикера вместо setInterval; Math.random → rng.fork/seeded rng; синтез — единый ledger c scope `planet:<pid>` (пер-планетные стоки — Этап 9, TV-25); баффы зарядов не персистятся (TV-32); модалка um → команда+кнопки (тосты — Этап 12). Хуки-плейсхолдеры: spc_hidden (TV-29, Этап 7), Co/mt (TV-30, Этап 9), Ay offline (TV-31, Этап 11).

## 6. Следующий шаг — Этап 5 (Galaxy/Discovery + 3D-рендер)

discoverPlanet (core/discovery.ts готов, не подключён к UI), открытие krios (в тестах Этапа 4 — через save-цикл), доход type7 (TV-24), граф/переходы. Данные — тем же методом (экстрактор → фикстура → порт → тесты).
