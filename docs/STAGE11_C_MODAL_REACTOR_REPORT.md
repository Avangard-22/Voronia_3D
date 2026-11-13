# Stage 11 C — Modal Architecture & Reactor v39

## Базовая ревизия

`18db5a81d9b16ad19a565b882090e3945e0fde8d` (`2.0.0-phase10.1.13`).

## Изменённые существующие файлы

- `src/contracts/crafting.ts`
- `src/contracts/commands.ts`
- `src/crafting/reactor.ts`
- `src/core/game.ts`
- `src/persistence/schema.ts`
- `src/ui/app.ts`

## Добавленные файлы

- `src/ui/modalWindows.ts`
- `tests/stage11_c_reactor_modal.test.ts`
- `STAGE_11_C_NOTES.md`
- `REPLACE_REPOSITORY_RU.md`

## Поведение

Реактор поддерживает покупку дополнительных слотов через `Game.dispatch('craftBuySlot', {})`. Стоимость берётся из `registry.craft.slotPurchase`, списание выполняется атомарно через `ResourceLedger`, число приобретённых слотов сериализуется в `SaveGameV2.reactor.slotsPurchased`. Для старых сохранений отсутствие поля трактуется как ноль.

UI использует `Game.snapshot()` и игровые команды через `Game.dispatch`; новые модальные окна не должны напрямую изменять доменные объекты.

## Ограничения / незакрытые пункты

- Offline report пока не получает отдельную структуру офлайн-начислений.
- Planet role assignment не реализован в домене V2.
- Вариант покупки слота не реализует доказанный V1 `spendAny` между складами нескольких планет; используется общий V2 ledger.
- Не выполнен runtime smoke-test в браузере и на мобильном устройстве.

## Статус проверок

- Stage C source anchors: PASS.
- TypeScript syntax transpilation: PASS, 219 файлов.
- JSON parse: PASS.
- `npm ci`: не завершён — тайм-аут npm registry в среде подготовки.
- Typecheck / Vitest / production build / browser runtime: NOT VERIFIED.

Нельзя трактовать синтаксическую проверку как доказательство полной типовой корректности или готовности к публикации.
