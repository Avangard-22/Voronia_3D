
/* ============================================================================
 * Voronia v0.0.41 · ОВЕРРАЙД РЕЕСТРА (инлайн, единый файл).
 * Содержит числа экономического патч-пака (оффлайн 12ч, ячейка исследований,
 * кривая апгрейда, дефицит/истощение, рецепты данных) И реестр новых систем
 * v0.0.41: покупные слоты Реактора, хардкор-верфь (20/50/50), валюта Эха.
 * Грузится ДО бандла; внешний js/balance.js (если появится) переопределит эти
 * значения — порядок: реестр → этот оверрайд → внешний файл → бандл.
 * ========================================================================== */
(function () {
  'use strict';
  var BAL = window.VORONIA_BALANCE;
  if (!BAL) return;
  var OVERRIDE = {
    cells: {
      researchMaxLevel: 15,
      researchPerLevel: 5,
      researchPerLevelGrowth: 1.3,
      researchCellCost: {
        energyBase: 25000, energyGrowth: 1.9,
        crystalsBase: 15, crystalsGrowth: 1.7,
        researchBase: 150, researchGrowth: 1.9,
        siliconFromLevel: 5, siliconBase: 50, siliconGrowth: 2
      },
      curveGrowthCap: 25,
      curveGrowthAfterCap: 1.025,
      veinYieldGrowth: 1.083,
      veinReserveGrowth: 1.104
    },
    eco: {
      deficit: { start: 3, offset: 2, step: 0.075, minMult: 0.32 },
      deplete: { start: 3, offset: 2, step: 0.07, maxMult: 1.7 }
    },
    offline: { maxSeconds: 43200, efficiency: 0.5, minSeconds: 60 },
    craft: {
      recipes: {
        researchDataBulk: { inputs: { energy: 5e5, iron: 6e4, kriogen: 2e4 }, dataGain: 1800 },
        researchDataElite: { inputs: { energy: 8e6, iron: 2e5, kriogen: 1e5, silicon: 5e3 }, dataGain: 32000 }
      },
      /* v0.0.41 · покупные слоты Реактора (пункт 6a): до 5 штук, цена растёт
         «овергигантски»: энергия + железо/криоген + кристаллы + сплавы + редкие */
      slotPurchase: {
        max: 5,
        costs: [
          { energy: 5e6,  iron: 4e5, kriogen: 15e4, crystals: 800,   steel: 300 },
          { energy: 5e7,  iron: 4e6, kriogen: 15e5, crystals: 5e3,   steel: 1500, chip: 500 },
          { energy: 5e8,  iron: 4e7, kriogen: 15e6, crystals: 3e4,   chip: 2500,  alloy: 800 },
          { energy: 5e9,  iron: 4e8, kriogen: 15e7, crystals: 2e5,   alloy: 4e3,  core: 1e3, titanium: 5e4 },
          { energy: 5e10, iron: 4e9, kriogen: 15e8, crystals: 15e5,  core: 5e3,   relic: 150, uranium: 2e4, darkMatter: 5e3 }
        ]
      }
    },
    /* v0.0.41 · верфь (пункт 6b): трюм/скорость до 50, флот до 20 кораблей;
       после порогов (10 / 10 / 5) — хардкор-цены редкими ресурсами и сплавами.
       soft: [база, рост^уровень]; hard: для energy/iron — только рост от якоря
       soft(порог), для новых ресурсов — [база, рост] от порога. */
    transport: {
      fleetMaxLevels: { cap: 50, spd: 50, ships: 19 },
      speedGrowthAfter: 1.15,
      holdLinearUntil: 10,
      holdGrowthAfter: 1.35,
      costCurves: {
        cap: {
          soft: { energy: [2500, 3], iron: [300, 2.5] }, hardFrom: 10,
          hard: { energy: 1.45, iron: 1.4, crystals: [80, 1.28], titanium: [300, 1.3], alloy: [25, 1.34] }
        },
        spd: {
          soft: { energy: [6e3, 3], iron: [500, 2.5] }, hardFrom: 10,
          hard: { energy: 1.45, iron: 1.42, crystals: [120, 1.3], uranium: [150, 1.3], core: [10, 1.35] }
        },
        ships: {
          soft: { energy: [12e3, 3.5], iron: [900, 3] }, hardFrom: 5,
          hard: { energy: 2.2, iron: 2.0, crystals: [300, 1.5], chip: [50, 1.55], core: [10, 1.5], darkMatter: [5, 1.7] }
        }
      }
    },
    /* v0.0.41 · осколки = валюта Эха (пункт 5) */
    echo: { switchCost: 250, shardToEssence: 100 },
    /* v0.0.41 · метеориты (пункт 7): бафф редких чаще и бьёт по всем открытым
       редким сразу (mult чуть снижен для баланса) */
    events: {
      anomalyPool: [
        { id: "energy_instant", weight: 55, kind: "instant", key: "energy" },
        { id: "iron_instant", weight: 28, kind: "instant", key: "iron" },
        { id: "kriogen_instant", weight: 14, kind: "instant", key: "kriogen" },
        { id: "rare_instant", weight: 22, kind: "instant", key: "rare" },
        { id: "crystal_instant", weight: 8, kind: "instant", key: "crystals" },
        { id: "buff_energy", weight: 2, kind: "buff", key: "energy", mult: 3, durMin: 8, durMax: 40 },
        { id: "buff_iron", weight: 1.5, kind: "buff", key: "iron", mult: 3, durMin: 8, durMax: 40 },
        { id: "buff_kriogen", weight: 1, kind: "buff", key: "kriogen", mult: 3, durMin: 8, durMax: 40 },
        { id: "buff_rare", weight: 2.2, kind: "buff", key: "rare", mult: 2.5, durMin: 8, durMax: 40 },
        { id: "buff_all", weight: .7, kind: "buff", key: "all", mult: 3, durMin: 5, durMax: 15 },
        { id: "jackpot", weight: .2, kind: "buff", key: "all", mult: 5, durMin: 8, durMax: 20 }
      ]
    }
  };
  function merge(dst, src) {
    for (var k in src) {
      if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
      var v = src[k];
      if (v && typeof v === 'object' && !Array.isArray(v) &&
          dst[k] && typeof dst[k] === 'object' && !Array.isArray(dst[k])) {
        merge(dst[k], v);
      } else {
        dst[k] = v;
      }
    }
    return dst;
  }
  merge(BAL, OVERRIDE);
  window.__VORONIA_PATCH = window.__VORONIA_PATCH || {};
  window.__VORONIA_PATCH.v41 = { id: 'voronia-econ-1+v41', appliedAt: new Date().toISOString() };
})();
