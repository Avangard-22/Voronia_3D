
/* ============================================================================
 * Voronia · Патч Первого Впечатления (UX & Onboarding Patch)
 * 
 * Что делает этот модуль:
 * 1. Скрывает пугающие элементы интерфейса (индикатор 3 циклов, лишние FAB-кнопки)
 *    в первые минуты игры, плавно проявляя их по мере прогресса игрока.
 * 2. Смягчает механику истощения жил на самой первой планете (Феррум) до первого 
 *    престижа: новичка больше не наказывают 5-минутным кулдауном, жила 
 *    перезапускается за 15 секунд.
 * 3. Защищает игрока от разрушения клеток Хранителем на 0-м цикле (до 1-го престижа).
 * 4. Добавляет в плашку выбранной клетки (#cell-info-bar) прямую кнопку действия 
 *    («Сканировать» / «Улучшить»), чтобы игроку не обязательно было делать двойной тап.
 * ========================================================================== */
(function () {
  'use strict';

  function getV() { return window.__V || {}; }
  function getS() { return getV().state || {}; }
  function getL() { return getV().legacy || {}; }
  function $(id) { return document.getElementById(id); }

  /* v0.0.26 (A-3): пороги раскрытия и остывание жил читаются из VORONIA_BALANCE.uxFirst */
  function UXC(key, dflt){
    try {
      var b = window.VORONIA_BALANCE;
      var u = b && b.uxFirst;
      if (u && typeof u[key] === 'number' && isFinite(u[key])) return u[key];
    } catch(e){}
    return dflt;
  }

  /* --------------------------------------------------------------------------
   * 1. ПЛАВНОЕ РАСКРЫТИЕ ИНТЕРФЕЙСА (Снимаем когнитивную перегрузку)
   * ------------------------------------------------------------------------ */
  function manageProgressiveUI() {
    var S = getS();
    if (!S.started) return;

    var isVeteran = (S.totalPrestiges > 0) || (S.metaPrestiges > 0) || (S.essenceTotal > 0);
    var ferrum = (getL().PLANETS || {}).ferrum;
    var exploredCount = (ferrum && ferrum.explored) ? ferrum.explored.size : 1;
    var hasKrios = S.unlockedPlanets && S.unlockedPlanets.has('krios');

    // А) Индикатор циклов (Престиж › Мета › Асценсия) в самом верху.
    // Новичку он не нужен, пока у него нет кристаллов или хотя бы 8 открытых клеток.
    var cycleInd = $('cycle-indicator');
    if (cycleInd) {
      var showCycles = isVeteran || S.crystals > 0 || exploredCount >= UXC('cycleIndicatorCells', 8);
      cycleInd.classList.toggle('ux-hidden-early', !showCycles);
      cycleInd.classList.toggle('ux-revealed', showCycles);
    }

    // Б) Кнопка Склада и Добычи (#base-manage-btn).
    // Показываем после сканирования хотя бы 1 новой клетки (когда стартовый капитал потрачен).
    var baseBtn = $('base-manage-btn');
    if (baseBtn) {
      var showBase = isVeteran || exploredCount >= UXC('baseBtnCells', 2) || S.iron > 20;
      baseBtn.classList.toggle('ux-hidden-early', !showBase);
      baseBtn.classList.toggle('ux-revealed', showBase);
    }

    // В) Плавающие кнопки справа (Задания и Флот).
    // Покажем Задания после 3 открытых клеток, а Флот — когда открыт Криос-9.
    var fabQuests = $('fab-quests');
    if (fabQuests) {
      var showQuests = isVeteran || exploredCount >= UXC('questsCells', 3);
      fabQuests.classList.toggle('ux-hidden-early', !showQuests);
      fabQuests.classList.toggle('ux-revealed', showQuests);
    }

    var fabFleet = $('fab-fleet');
    if (fabFleet) {
      var showFleet = isVeteran || hasKrios || exploredCount >= UXC('fleetCells', 6);
      fabFleet.classList.toggle('ux-hidden-early', !showFleet);
      fabFleet.classList.toggle('ux-revealed', showFleet);
    }

    // Г) Плавающие кнопки слева (Радар 3D-галактики).
    // До открытия второй планеты карта галактики пуста и только путает.
    var fabRadar = $('fab-radar');
    if (fabRadar) {
      var showRadar = isVeteran || hasKrios || exploredCount >= UXC('radarCells', 10);
      fabRadar.classList.toggle('ux-hidden-early', !showRadar);
      fabRadar.classList.toggle('ux-revealed', showRadar);
    }
  }

  /* --------------------------------------------------------------------------
   * 2. СМЯГЧЕНИЕ КАРАТЕЛЬНЫХ МЕХАНИК ДЛЯ НОВИЧКОВ
   * ------------------------------------------------------------------------ */
  function softenEarlyGameMechanics() {
    var S = getS();
    var L = getL();
    if (!S.started || !L.PLANETS) return;

    var isFirstRun = (S.totalPrestiges === 0) && (S.metaPrestiges === 0);

    // А) Быстрое остывание жил на Ферруме в первом цикле.
    // Вместо 5-30 минут ожидания делаем максимум 15 секунд, чтобы игрок понял механику, но не скучал.
    if (isFirstRun && S.activePlanetId === 'ferrum') {
      var ferrum = L.PLANETS.ferrum;
      if (ferrum && ferrum.cells) {
        var now = Date.now();
        var maxWaitMs = UXC('veinCooldownMs', 15000);
        ferrum.explored.forEach(function (cid) {
          var cell = ferrum.cells[cid];
          if (cell && (cell.type === 3 || cell.type === 5) && cell.reserve <= 0) {
            if (cell.cooldownUntil > now + maxWaitMs) {
              cell.cooldownUntil = now + maxWaitMs;
            }
          }
        });
      }
    }

    // Б) Защита от разрушения клеток Хранителем на первом цикле.
    // Если новичок случайно проиграл боссу или пропустил окно — автоматически чиним клетки бесплатно.
    if (isFirstRun) {
      S.unlockedPlanets.forEach(function (pid) {
        var pl = L.PLANETS[pid];
        if (!pl || !pl.cells) return;
        var restoredAny = false;
        for (var i = 0; i < pl.cells.length; i++) {
          var c = pl.cells[i];
          if (c && c._destroyed) {
            if (c._destroyedSnapshot) {
              Object.assign(c, c._destroyedSnapshot);
              delete c._destroyedSnapshot;
            }
            c._destroyed = false;
            c._restoreAt = 0;
            c._restoreCost = null;
            restoredAny = true;
          }
        }
        if (restoredAny) {
          if (pl.boss && Array.isArray(pl.boss.punishmentCells)) {
            pl.boss.punishmentCells = [];
          }
          try { L.recomputeIncome && L.recomputeIncome(); } catch (e) {}
          try {
            window.showToast && window.showToast(
              '🛡 <b>Защита новичка</b><br><span style="font-size:11px;color:#91adbb;">На первом цикле клетки планеты защищены от разрушения Хранителем.</span>',
              'success', 5000
            );
          } catch (e) {}
        }
      });
    }
  }

  /* --------------------------------------------------------------------------
   * 3. ПРЯМАЯ КНОПКА ДЕЙСТВИЯ В ТУЛТИПЕ КЛЕТКИ (Альтернатива двойному тапу)
   * ------------------------------------------------------------------------ */
  function enhanceCellInfoBar() {
    var S = getS();
    var L = getL();
    var bar = $('cell-info-bar');
    if (!bar || !S.started || !S.activePlanet) return;

    // Если клетка не выбрана или бар скрыт — прячем кнопку
    if (S.selectedCellId === null || !bar.classList.contains('show')) {
      var existingBtn = $('ux-direct-action-btn');
      if (existingBtn) existingBtn.style.display = 'none';
      return;
    }

    var cell = S.activePlanet.cells[S.selectedCellId];
    if (!cell) return;

    var btn = $('ux-direct-action-btn');
    if (!btn) {
      btn = document.createElement('button');
      btn.id = 'ux-direct-action-btn';
      btn.type = 'button';
      // При клике имитируем повторный выбор и действие через штатные функции
      btn.addEventListener('click', function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        triggerSelectedCellAction();
      });
      bar.appendChild(btn);
    } else if (btn.parentNode !== bar) {
      bar.appendChild(btn);
    }

    var isExplored = S.activePlanet.explored.has(cell.id);
    var label = '';
    var isReady = false;

    if (!isExplored) {
      isReady = (Number(S.energy)||0) >= (Number(S.currentCost)||0);
      label = '🔍 СКАНИРОВАТЬ КЛЕТКУ';
    } else if (cell._destroyed) {
      label = '🔧 ВОССТАНОВИТЬ КЛЕТКУ';
      isReady = true;
    } else if (cell.type === 0) {
      if (cell.level >= S.MAX_LEVEL) {
        btn.style.display = 'none';
        return;
      }
      label = '⬆ УЛУЧШИТЬ (УР. ' + (cell.level + 1) + ')';
      isReady = bar.querySelector('.cib-cost.ready') !== null;
    } else if (cell.type === 3 || cell.type === 5) {
      if (!L.isCellActive(cell)) {
        btn.style.display = 'none';
        return;
      }
      if (cell.reserve <= 0) {
        var cdLeft = (cell.cooldownUntil || 0) - Date.now();
        if (cdLeft > 0) {
          label = '⏳ ОСТЫВАЕТ...';
          isReady = false;
        } else {
          var rCost = L.reactivationCost ? L.reactivationCost(cell, S.activePlanetId) : 0;
          label = '↻ РЕАКТИВИРОВАТЬ (' + (window.fmtBig ? window.fmtBig(rCost) : rCost) + ' ⚡)';
          isReady = S.energy >= rCost;
        }
      } else if (cell.level < S.MAX_LEVEL) {
        label = '⬆ УЛУЧШИТЬ БУР (УР. ' + (cell.level + 1) + ')';
        isReady = bar.querySelector('.cib-cost.ready') !== null;
      } else {
        btn.style.display = 'none';
        return;
      }
    } else if (cell.type === 1 || cell.type === 2) {
      var chargeCd = (cell._chargeCooldown || 0) - Date.now();
      if (chargeCd <= 0) {
        label = '⚡ РАЗРЯДИТЬ КЛЕТКУ (БАФФ)';
        isReady = true;
      } else {
        btn.style.display = 'none';
        return;
      }
    } else if (cell.type === 4) {
      if (!cell.anomalyType) {
        label = '🌌 ВЫБРАТЬ ПУТЬ АНОМАЛИИ';
        isReady = true;
      } else if (cell.level < 5 || !cell.isDeep) {
        label = '⬆ РАЗВИТЬ АНОМАЛИЮ';
        isReady = bar.querySelector('.cib-cost.ready') !== null;
      } else {
        btn.style.display = 'none';
        return;
      }
    } else if (cell.type === 6) {
      if ((cell.level || 0) < L.RCELL_MAX_LEVEL) {
        label = '🔬 УЛУЧШИТЬ ЯЧЕЙКУ (УР. ' + ((cell.level || 0) + 1) + ')';
        isReady = bar.querySelector('.cib-cost.ready') !== null;
      } else {
        btn.style.display = 'none';
        return;
      }
    } else {
      btn.style.display = 'none';
      return;
    }

    btn.textContent = label;
    btn.className = isReady ? 'ready' : 'locked';
    btn.style.display = 'block';
  }

  // Выполнение действия с выбранной клеткой (аналог второго тапа по холсту)
  function triggerSelectedCellAction() {
    var S = getS();
    var L = getL();
    var D = window.__ccDebug || {}; // Если включен дебаг, но мы используем публичные методы
    if (!S.started || !S.activePlanet || S.selectedCellId === null) return;

    var cellId = S.selectedCellId;
    var cell = S.activePlanet.cells[cellId];
    if (!cell) return;

    // Проецируем центр клетки на экран, чтобы синтезировать тап ровно по ней
    var proj = L.project ? L.project(cell.center) : { x: S.W / 2, y: S.H / 2, z: 1 };
    var canvas = $('game');
    if (!canvas) return;

    var rect = canvas.getBoundingClientRect();
    var clientX = rect.left + proj.x;
    var clientY = rect.top + proj.y;

    // Если клетка повернута обратной стороной или проекция не удалась — вызываем API напрямую
    if (!proj || proj.z <= 0) {
      directApiFallback(cell);
      return;
    }

    // Синтезируем быстрый клик (pointerdown -> pointerup) в координаты клетки,
    // так как S.selectedCellId уже равен cellId, игра воспримет это как 2-й тап!
    var wasExplored = S.activePlanet.explored.has(cell.id);
    var wasLevel = cell.level | 0;
    var wasReserve = cell.reserve;
    try {
      var downEvt = new PointerEvent('pointerdown', {
        pointerId: 999, button: 0, buttons: 1, isPrimary: true,
        clientX: clientX, clientY: clientY, bubbles: true
      });
      var upEvt = new PointerEvent('pointerup', {
        pointerId: 999, button: 0, buttons: 0, isPrimary: true,
        clientX: clientX, clientY: clientY, bubbles: true
      });
      canvas.dispatchEvent(downEvt);
      canvas.dispatchEvent(upEvt);
    } catch (e) {}
    setTimeout(function () {
      try {
        var done = wasExplored
          ? ((cell.level | 0) !== wasLevel || cell.reserve !== wasReserve || !cell._destroyed || S.selectedCellId === null)
          : S.activePlanet.explored.has(cell.id);
        if (!done) directApiFallback(cell);
      } catch (e) {}
    }, 250);
  }

  // Запасной прямой вызов, если клетка ушла за край вращающейся планеты
  function directApiFallback(cell) {
    var S = getS();
    var L = getL();
    var bar = $('cell-info-bar');
    if (bar) bar.classList.remove('show');
    S.selectedCellId = null;

    if (!S.activePlanet.explored.has(cell.id)) {
      if (S.energy >= S.currentCost) {
        S.energy -= S.currentCost;
        S.activePlanet.explored.add(cell.id);
        cell.neighbors.forEach(function (n) { S.activePlanet.revealed.add(n); });
        S.currentCost = Math.max(S.currentCost + 1, Math.floor(S.currentCost * (window.__LvScanGrowth ? window.__LvScanGrowth() : 1.15)));
        L.recomputeIncome && L.recomputeIncome();
        L.updateUI && L.updateUI();
        window.requestSave && window.requestSave();
      } else {
        window.showWarning && window.showWarning('Не хватает энергии');
      }
    }
  }

  /* --------------------------------------------------------------------------
   * 4. ЗАПУСК И НАБЛЮДЕНИЕ
   * ------------------------------------------------------------------------ */
  function initPatch() {
    // Запускаем регулярную проверку состояния интерфейса и смягчения механик
    setInterval(function () {
      try { manageProgressiveUI(); } catch (e) {}
      try { softenEarlyGameMechanics(); } catch (e) {}
      try { enhanceCellInfoBar(); } catch (e) {}
    }, 250);

    // Мгновенно обновляем кнопку в тултипе при любом клике по игре
    document.addEventListener('pointerup', function () {
      setTimeout(function () {
        try { enhanceCellInfoBar(); } catch (e) {}
        try { manageProgressiveUI(); } catch (e) {}
      }, 30);
    }, { passive: true });

    console.info('[Voronia UX Patch] v0.0.25: правки первого впечатления подключены.');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPatch);
  } else {
    setTimeout(initPatch, 0);
  }
})();
