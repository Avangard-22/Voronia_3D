# Phase 10.1.12 — V1 → V2 Parity Gap Closure & Final Mechanics Audit

**Baseline authority:** V1 `v0.0.41.0`, save schema 39.  
**Input:** Phase 10.1.11 regression ZIP / current V2 source tree.  
**Scope:** evidence-led mechanics audit and closure of only demonstrably closed gaps. No new gameplay systems and no speculative balance changes.

## Итог аудита

| Статус | Количество | Значение |
|---|---:|---|
| PASS | 3 | Подтверждено тестами/фикстурами |
| PARTIAL | 9 | Частично реализовано, нужна дополнительная сверка |
| GAP | 9 | Известное расхождение или незавершённая механика |
| BLOCKED | 1 | Нужна внешняя среда/реальный runtime |

**Вердикт:** полный V1 → V2 parity closure НЕ достигнут. Это не формальная отметка PASS: в исходном реестре остаются незакрытые TV-пункты, а часть предыдущих фаз имеет только контрактные проверки, не полный игровой replay. Подробный реестр — `PHASE10_1_12_PARITY_MATRIX.json`.

## Подтверждённые области

- Базовый scan/reveal loop и его ценовые anchors.
- Переключение планет и локальные запасы.
- Базовая складская модель.
- Контрактное покрытие специальных ячеек, синтезатора/мутантов, offline progression, timed effects и save integrity.
- Наличие golden V1 fresh и mid-game save fixtures.

## Оставшиеся P0/P1 расхождения

1. **Офлайн-синтез:** V1 `Ay()` не подтверждён отдельным golden replay; текущая реализация использует общий тик SynthService.
2. **Hidden profile / synth modifiers:** `spcHiddenFor` возвращает `false`; `roleMultFor` и `modsFor` по умолчанию равны `1`.
3. **Сохранение зарядов:** при загрузке `charge.reset()`; соответствие краткоживущей семантике V1 требует подтверждения fixture/replay.
4. **Sonar:** расход зарядов, reroll и повторное сканирование остаются частичными.
5. **Миграция:** mid-game V39 golden save должен быть реально проигран через load → state diff; наличие fixture само по себе не является PASS.

## Оставшиеся P2/P3 расхождения и блокеры

- Guardian battle / seals / collapses; reactivation refill; mixed-world saves; planet roles; core build/merge и hidden world.
- Полный каталог crafting recipes и progression.
- Реальные Android-проверки FPS, p95 frame time, heap и длительного soak.

## Что сделано в этой фазе

- Сформирован единый статусный parity matrix с точными ссылками на исходные тесты и fixtures.
- Разделены доказанные PASS, частичное покрытие, известные GAP и внешние BLOCKED проверки.
- Добавлен автоматический аудит, который не позволяет объявлять закрытие на основании одного наличия названия теста: проверяются источники/фикстуры и список обязательных unresolved пунктов.
- Не менялись игровые формулы и баланс без подтверждённого V1 reference.

## Валидация и ограничения

- Выполняются доступные Node contract checks для фаз 10.1.1–10.1.12.
- Полный Vitest, TypeScript и Vite Build требуют установки зависимостей (`node_modules` отсутствует в исходном архиве).
- Полный parity verdict остаётся **PARTIAL / NOT CLOSED** до прохождения перечисленных golden replay и runtime gates.

## Следующий этап — Phase 10.1.13

**P0 Gap Closure: Offline Synth, Hidden Profile & Golden Save Replay**

1. Восстановить V1 `Ay()` офлайн-синтез на основе runtime fixture.
2. Реализовать `spc_hidden` и synth role/meta modifiers только по подтверждённым V1 правилам.
3. Прогнать fresh и mid-game V1 schema-39 saves через миграцию и сравнить state diff.
4. Проверить отсутствие двойных начислений и потери ресурсов на restart/reload.
5. Обновить parity matrix по фактическим тестовым результатам.

**Цель:** закрыть конкретные P0/P1 пробелы, не вводя новых игровых механик и не меняя экономику V1.
