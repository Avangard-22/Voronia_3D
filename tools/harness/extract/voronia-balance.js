/* Voronia · VORONIA_BALANCE — единый реестр балансных чисел.
 * Сгенерирован сборщиком из исходника v0.0.11.0: значения совпадают с прежними,
 * но теперь живут в одном месте. Правка здесь = правка во всей игре.
 * Объекты читаются через BALC() (глубокий клон), скаляры — через BAL.<path>.
 * Файл js/balance.js (если лежит рядом) может переопределить значения ДО загрузки бандла.
 */
(function(){
var B = {

/* === ГИГИЕНА / ПРОИЗВОДИТЕЛЬНОСТЬ === */
"hygiene": {
"autosaveMs": 1e4, /* инлайн-формула */
"floatingTextCap": 60, /* R0 */
"fpsWarnBelow": 40, /* инлайн-формула */
"fpsWindowMs": 3e3, /* инлайн-формула */
"meteorCap": 40, /* U0 */
"particleCap": 180, /* инлайн-формула */
"sanitizeIntervalMs": 15e3, /* (v0.0.14/15) */
"saveIntervalCheckMs": 5e3, /* инлайн-формула */
"saveThrottleMs": 2e3, /* by */
"uiTickMs": 80, /* инлайн-формула */
},

/* === РЕНДЕР (не влияет на баланс) === */
"render": {
"bgCacheVersion": 1, /* H0 */
"biomeLayers": 6, /* qa */
"biomeTileSize": 48, /* Ye */
"fieldObjectTuning": {ship:{ttl:45e3},comet:{ttl:3e4},cache:{ttl:6e4}}, /* (v0.0.14/15) */
"glowSpriteSize": 96, /* Qs */
"glowSprites": 12, /* N0 */
},

/* === КЛЕТКИ ПЛАНЕТЫ === */
"cells": {
"curveGrowth": 1.13, /* p1 — (v17) 1.28→1.115; (v0.0.33) →1.13: хардкор-экстраполяция после 20 уровня */
"deepLevelThreshold": 8, /* fl */
"deepUpgradeCurve": [{e:0,a:20,b:0,g:0,x:0},{e:110,a:50,b:0,g:0,x:0},{e:430,a:100,b:25,g:0,x:0},{e:950,a:180,b:55,g:0,x:0},{e:1900,a:290,b:95,g:0,x:0},{e:3400,a:460,b:150,g:0,x:0},{e:5800,a:700,b:225,g:0,x:0},{e:9e3,a:1020,b:330,g:0,x:0},{e:13500,a:1450,b:470,g:0,x:0},{e:19500,a:2050,b:650,g:0,x:0},{e:29e3,a:3e3,b:850,g:35,x:3},{e:37e3,a:3800,b:1050,g:50,x:4},{e:47e3,a:4800,b:1300,g:70,x:5},{e:6e4,a:6100,b:1650,g:95,x:7},{e:76e3,a:7700,b:2100,g:125,x:9},{e:154e3,a:15520,b:4320,g:264,x:19},{e:230e3,a:23370,b:6555,g:409,x:30},{e:334e3,a:34100,b:9570,g:594,x:48},{e:494e3,a:50440,b:14560,g:936,x:78},{e:714e3,a:73500,b:21600,g:1380,x:120}], /* y0 · (v0.0.33) idx15-19: ×1.6→×3.0 хардкор после 15 ур. */
"levelRewards": [null,null,null,null,null,null,null,null,null,null,{key:"carbon",amount:150},{key:"carbon",amount:180},{key:"carbon",amount:216},{key:"carbon",amount:259},{key:"silicon",amount:250},{key:"silicon",amount:360},{key:"silicon",amount:432},{key:"silicon",amount:518},{key:"silicon",amount:622},{key:"silicon",amount:746},{key:"silicon",amount:896},{key:"silicon",amount:1075},{key:"silicon",amount:1290},{key:"silicon",amount:1548},{key:"titanium",amount:400},{key:"titanium",amount:480},{key:"titanium",amount:576},{key:"titanium",amount:691},{key:"titanium",amount:829},{key:"titanium",amount:995},{key:"titanium",amount:1194},{key:"titanium",amount:1433},{key:"titanium",amount:1720},{key:"titanium",amount:2064},{key:"uranium",amount:500},{key:"uranium",amount:600},{key:"uranium",amount:720},{key:"uranium",amount:864},{key:"uranium",amount:1037},{key:"uranium",amount:1244},{key:"uranium",amount:1493},{key:"uranium",amount:1792},{key:"helium3",amount:260},{key:"helium3",amount:312},{key:"helium3",amount:374},{key:"helium3",amount:449},{key:"helium3",amount:539},{key:"helium3",amount:647},{key:"helium3",amount:776},{key:"helium3",amount:932},{key:"darkMatter",amount:80},{key:"darkMatter",amount:96},{key:"darkMatter",amount:115},{key:"darkMatter",amount:138},{key:"darkMatter",amount:166},{key:"darkMatter",amount:199},{key:"darkMatter",amount:239},{key:"darkMatter",amount:287},{key:"biomass",amount:950},{key:"biomass",amount:1140},{key:"biomass",amount:1368},{key:"biomass",amount:1642},{key:"biomass",amount:1970},{key:"biomass",amount:2364},{key:"biomass",amount:2837},{key:"biomass",amount:3404},{key:"platinum",amount:380},{key:"platinum",amount:456},{key:"platinum",amount:547},{key:"platinum",amount:657},{key:"platinum",amount:788},{key:"platinum",amount:946},{key:"platinum",amount:1135},{key:"platinum",amount:1362},{key:"uranium",amount:2150},{key:"uranium",amount:2580},{key:"uranium",amount:3096},{key:"uranium",amount:3715},{key:"uranium",amount:4458},{key:"uranium",amount:5350},{key:"uranium",amount:6420},{key:"uranium",amount:7704},{key:"uranium",amount:9245},{key:"uranium",amount:11094},{key:"darkMatter",amount:345},{key:"darkMatter",amount:414},{key:"darkMatter",amount:497},{key:"darkMatter",amount:596},{key:"darkMatter",amount:715},{key:"darkMatter",amount:858},{key:"darkMatter",amount:1030},{key:"darkMatter",amount:1236},{key:"platinum",amount:1650},{key:"platinum",amount:1980},{key:"platinum",amount:2376},{key:"platinum",amount:2851},{key:"platinum",amount:3421},{key:"platinum",amount:4106},{key:"platinum",amount:4927},{key:"platinum",amount:5912},{key:"darkMatter",amount:1483}], /* k0 — (v0.0.33) 🚚-лестница пересобрана: ВСЕ ресурсы игры участвуют в апгрейдах; замена «взамен» отменена — только конкретный ресурс (gated: пока не открыт — не взимается) */
"recycleEnergyMult": 6, /* yv */
"reactCooldownBaseMs": 3e5, /* (v0.0.17.1) кулдаун восстановления жилы: 5 мин */
"reactCooldownPerCntMs": 15e4, /* +2.5 мин за каждое повторное истощение */
"reactCooldownMaxMs": 18e5, /* потолок 30 мин */
"reactCooldownCntCap": 20, /* cap reactCount в формуле кулдауна */
"reactCooldownPerk2Mul": .5, /* перк react2 */
"reactAutoSkipEnergyFactor": 10, /* auto_react: запас ⚡×10 сверх цены реактивации */
"researchCostFromLevel": 16, /* (v0.0.33) 25→16: хардкор-зона — наука в цене апгрейда с 16 уровня */
"researchCostBase": 250, /* цена первого такого апгрейда (уровень 15→16) */
"researchCostGrowth": 1.14, /* (v17) 1.75→1.12; (v0.0.33) →1.14 хардкор */ /* рост за каждый следующий уровень */
"researchMaxLevel": 10, /* Pn */
"researchPerLevel": 5, /* ci */
"hardcore": { /* v0.0.33 · ХАРДКОР после 15 уровня: продукция РЕАКТОРА — ядро прогрессии. Пыль/эссенция/зёрна в апгрейдах НЕ участвуют. Gated: компонент взимается, только когда рецепт открыт. Никаких замен «взамен». */
fromLevel: 16,
compounds: { /* составные из Реактора: раньше и больше — конкурируют с крафтом бонусов */
steel:{from:24,base:4,growth:1.08,cap:250,research:"recipe_steel"},
chip:{from:34,base:4,growth:1.08,cap:250,research:"recipe_chip"},
alloy:{from:46,base:4,growth:1.08,cap:250,research:"recipe_alloy"},
core:{from:58,base:3,growth:1.08,cap:150,research:"recipe_core"},
relic:{from:70,base:2,growth:1.07,cap:100,research:"recipe_relic"}},
},
"resourceChain": {darkMatter:"platinum",platinum:"uranium",uranium:"biomass",biomass:"titanium",titanium:"helium3",helium3:"silicon",silicon:"carbon",carbon:null}, /* u1 */
"resourceWeights": {carbon:1,kriogen:.8,silicon:.65,titanium:.4,uranium:.16,darkMatter:.03}, /* S0 */
"typePriority": {4:0,7:.4,6:.5,2:1,1:2,3:3,5:4,0:5}, /* Fi */
"upgradeCurve": [{e:0,a:10,b:0,g:0,x:0},{e:80,a:22,b:0,g:0,x:0},{e:280,a:50,b:0,g:0,x:0},{e:700,a:90,b:25,g:0,x:0},{e:1400,a:150,b:45,g:0,x:0},{e:2500,a:230,b:80,g:0,x:0},{e:4200,a:340,b:125,g:0,x:0},{e:6800,a:500,b:180,g:0,x:0},{e:1e4,a:720,b:250,g:0,x:0},{e:14500,a:1e3,b:340,g:0,x:0},{e:22e3,a:1500,b:450,g:25,x:2},{e:28e3,a:1900,b:560,g:35,x:3},{e:36e3,a:2400,b:700,g:50,x:4},{e:46e3,a:3e3,b:880,g:70,x:5},{e:58e3,a:3800,b:1150,g:95,x:7},{e:117e3,a:7680,b:2320,g:200,x:14},{e:175e3,a:11590,b:3420,g:314,x:23},{e:255e3,a:17160,b:4950,g:473,x:35},{e:380e3,a:26e3,b:7280,g:728,x:57},{e:555e3,a:38400,b:10500,g:1080,x:90}], /* g0 · (v0.0.33) idx15-19: ×1.6→×3.0 хардкор после 15 ур. */
},

/* === ГЕНЕРАЦИЯ ПЛАНЕТ === */
"planet": {
"biomeMults": {ferrum:{mult:1},krios:{mult:.6}}, /* Xa */
"geometryTuning": {icosahedron:{weight:45,minFrequency:1,maxFrequency:5},octahedron:{weight:25,minFrequency:1,maxFrequency:4},tetrahedron:{weight:10,minFrequency:1,maxFrequency:4},cube:{weight:15,minFrequency:1,maxFrequency:4}}, /* (v0.0.14/15) */
"hiddenWorldIndex": 100, /* Mf */
"mutants": {forge:{id:"ember",name:"🔥 Уголёк",yieldMult:1.5,depletionMult:1.5,color:"#ff8c4d"},frost:{id:"rime",name:"❄ Иней",yieldMult:1.2,depletionMult:.8,color:"#8fe0ff"},life:{id:"mycelium",name:"🌱 Мицелий",yieldMult:1.3,depletionMult:1,color:"#7ee08a"},void:{id:"shadow",name:"🌑 Тень",yieldMult:2,depletionMult:2,color:"#c084fc"},core:{id:"prime",name:"⚪ Прайм",yieldMult:1.4,depletionMult:1.2,color:"#eaf8ff"}}, /* su */
"specialCellChance": .34, /* d1 */
"tierThresholds": [2,8,15], /* инлайн-формула */
"uniqueChance": .02, /* ky */
"resourceDist": { /* (v0.0.17.1) пул ресурсов P3+: железо/криоген + редкие, дефицит */
"ironWeight": 1, "kriogenWeight": .7, "focusBonus": 1.8, "depthPenalty": .5, "depthScale": 4,
"slots": [[5,1],[9,2],[14,3],[999,4]], "extraSlotPct": .1, "extraSlotDepthPct": .01, "extraSlotMax": .25, "slotFillPct": .6,
"uniqueBonus": 1, "maxSlots": 5, "barrenChance": .1, "barrenMinIndex": 5
},
"lastVoronia": {index:15,resources:["iron","kriogen","carbon","silicon","titanium","uranium","darkMatter"],cost:{e:1,i:1,k:1},armName:"РУКАВ БЕЗДНЫ",armColor:"#c084fc"}, /* v0.0.21.1 · финальный мир: копеечное открытие, максимум ресурсов */
},

/* === ГЕНЕРАЦИЯ ГАЛАКТИКИ === */
"galaxy": {
"arms": {arms:4,b:.55,r0:3.5,width:3.2}, /* Fn */
"gen": {armBias:.55,starterExclusionR:24,starterZoneR:12,outerRadius:95,maxTries:900,radialBias:.45,frontChance:.15,frontRadius:72}, /* cn · (v0.0.21.1) разлёт по всей карте: диск 30→95, эксклюзия 9→24, MIN-дистанция ниже */
"nodeRender": {BASE_R:4.5,SCALE:4.5,MIN_DIST:9,THICK:3.2}, /* Rr · (v0.0.21.1) MIN_DIST 4→9: планеты не слипаются в цепочки */
"mapCam": {zoomMin:.12,zoomMax:16,focusZoom:2.6,panClamp:150,lerp:.14,panSpeed:1}, /* (v0.0.33) свободная камера карты: пределы зума, фокус-зум на планету, кламп панорамы, плавность */
},

"uxFirst": {
"cycleIndicatorCells": 8, "baseBtnCells": 2, "questsCells": 3, "fleetCells": 6, "radarCells": 10,
"veinCooldownMs": 15000
}, /* v0.0.26 · пороги Патча Первого Впечатления (A-3) */

/* === СКЛАД === */
"warehouse": {
"alloyCostFactor": 2, /* инлайн-формула */
"baseTons": 10, /* Sy */
"bonusPerLevel": .05, /* инлайн-формула */
"energyCostBase": 800, /* инлайн-формула */
"energyCostGrowth": 1.6, /* инлайн-формула */
"tonsPerLevel": 5, /* инлайн-формула */
"upgradeMax": 10, /* Ls */
},

/* === ЗАРЯДЫ (богатые/редкие клетки) === */
"charge": {
"buffCap": .25, /* cl */
"config": {1:{basePct:.03,baseDur:20,cd:45,label:"Богатая",science:5,sciencePct:.05},2:{basePct:.08,baseDur:25,cd:90,label:"Редкая",science:15,sciencePct:.15}}, /* Vs */
"neighborBonus": .15, /* Qy */
"neighborDurBonusSec": 5, /* Jy */
"neighborMax": 2, /* Zy */
"scienceCap": .5, /* Xy */
},

/* === ЯДРО ГРАНИ === */
"core": {
"baseYield": 100, /* Ao */
"buildCost": {crystals:900,energy:2e5}, /* Ro — (v17) хардкор ×3.6/×4 */
"crystalRate": .03, /* Ys */
"mergeFallbackCost": {crystals:140,energy:3e4}, /* $0 — (v17) ×3.5/×3.75 */
"mergeRichCost": {crystals:90,energy:2e4}, /* vl — (v17) ×3.6/×4 */
"reactivate": {max:14,step:.55}, /* инлайн-формула */
},

/* === ХРАНИТЕЛЬ (бой и Стража) === */
"boss": {
"attackThrottleMs": 200, /* wv */
"comboMax": 5, /* Mv */
"comboStep": .1, /* gm */
"comboWindowMs": 1500, /* hm */
"guardianTiers": [{id:"sentinel",name:"🛡 Страж",tier:1,hpMult:.5,weaponTier:1,reward:{iron:5e3,kriogen:2e3,crystals:10},canRepeat:!1},{id:"guardian",name:"⚔ Хранитель",tier:2,hpMult:1,weaponTier:2,reward:"choice3",canRepeat:!1},{id:"overlord",name:"🌌 Владыка",tier:3,hpMult:2,weaponTier:3,reward:{essence:500,buff:"allMult1.3_4h"},canRepeat:!0,cooldownMs:3*3600*1e3}], /* ba */
"openDurationMs": 3e3, /* kv */
"openMult": 1.3, /* Nd */
"phaseMults": {shield:{energy:1,iron:3,kriogen:2},armor:{energy:2,iron:1,kriogen:3},core:{energy:3,iron:2,kriogen:1}}, /* Fd */
"punishCellsBase": 3, /* hv */
"punishCellsMax": 8, /* gv */
"punishRestoreMs": 900*1e3, /* Bd */
"regenRate": .4, /* Sv */
"regenThresholdMs": 2e3, /* _v */
"reviveCooldownMs": 300*1e3, /* Ev */
"rewards": [{id:"power",icon:"⚡",title:"СИЛА ХРАНИТЕЛЯ",desc:"+25% к доходу этой планеты (энергия, железо, криоген, редкие) до престижа"},{id:"crystal",icon:"💎",title:"КРИСТАЛЬНОЕ ЭХО",desc:"+0.02 💎/с от этой планеты (глобально, до престижа)"},{id:"reserve",icon:"⛏",title:"НЕДРА БЕЗДНЫ",desc:"Все месторождения планеты +50% к максимальному запасу сейчас и впредь"}], /* ha */
"sealDurationMs": 4*3600*1e3, /* v0.0.21: бонус короче минимального кулдауна */
"sealMinerReactivateMult": .85, /* v0.0.23: скидка печати рудокопа 15% */
"sealMinerUpgradeMult": .85, /* v0.0.23: скидка печати рудокопа 15% */
"seals": [{id:"energy_seal",icon:"⚡",name:"Печать Потока",desc:"+30% энергии планеты",weight:25},{id:"iron_seal",icon:"⛏",name:"Печать Недр",desc:"+30% железа планеты",weight:25},{id:"kriogen_seal",icon:"❄",name:"Печать Стужи",desc:"+30% криогена планеты",weight:20},{id:"depletion_seal",icon:"⏳",name:"Печать Тверди",desc:"−20% истощения планеты",weight:15},{id:"scan_seal",icon:"⛏",name:"Печать Рудокопа",desc:"−15% цена улучшения и реактивации месторождений и криогенных жил",weight:12},{id:"all_seal",icon:"✨",name:"Печать Единства",desc:"+12% ко всему на планете",weight:5}], /* ga */
"shieldGainPct": .08, /* xv */
"strikeIntervalMs": 6e3, /* Od */
"strikeIntervalRandMs": 3e3, /* инлайн-формула */
"strikeWindupMs": 1500, /* vv */
"timeLimitMs": 3e4, /* Yi */
"watchCountdownMs": 2700*1e3, /* rx */
"watchIntervalMs": 12*3600*1e3, /* zd */
"watchWindowMs": 3*3600*1e3, /* Wd */
},

/* === ПРЕСТИЖ / ПЫЛЬ === */
"prestige": {
"burnResearch": !0, /* (v0.0.16) */
"countRewards": [{count:15,reward:{dust:5,crystals:5,research:100},label:"Новичок"},{count:30,reward:{dust:15,crystals:15,research:300},label:"Опытный"},{count:50,reward:{dust:40,crystals:40,research:800},label:"Ветеран"},{count:70,reward:{dust:100,crystals:100,research:2e3},label:"Мастер"},{count:90,reward:{dust:250,crystals:250,research:5e3},label:"Гроссмейстер"},{count:105,reward:{dust:600,crystals:600,research:12e3},label:"Легенда"}], /* Jl */
"crystalThreshold": 10, /* Fs */
"dustEnergyBonus": .05, /* jc */
"dustIronBonus": .03, /* Kc */
},

/* === НЕДЕЛЬНЫЙ ЦИКЛ === */
"weekly": {
"bulkPack": {energy:2e6,iron:5e4,kriogen:2e4}, /* ib */
"eliteGapMs": 14*864e5, /* xi */
"eliteRequiredCycles": 4, /* mo */
"questTuning": {scan:{targets:[8,15,25],reward:{crystals:1}},upgrade:{targets:[4,8,15],reward:{crystals:1}},deep:{targets:[1,1,2],reward:{dust:1}},anomaly:{targets:[1,2],reward:{dust:1}},tech:{targets:[1,2,3],reward:{dust:1}},travel:{targets:[1,2],reward:{dust:1}},planet:{targets:[1],reward:{dust:2}},prestige:{targets:[1],reward:{dust:2}},offline:{targets:[1],reward:{crystals:1}}}, /* (v0.0.14/15) */
"researchJitter": 600, /* sb */
"researchMax": 5e5, /* ab */
"researchMin": 150, /* rb */
"reward": {dust:15,crystals:20,research:150}, /* ar */
"streakDays": 7, /* Fo */
"surgeHours": 24, /* ip */
"surgeMult": 2, /* Ul */
},

/* === ГЛУБИННЫЙ СОНАР === */
"sonar": {
"chargeMax": 3, /* Hr */
"difficulty": {baseRounds:3,maxIdx:9,basePeriod:1.6,periodStep:.06,minPeriod:1}, /* (v0.0.16) */
"hintEnergy": 1500, /* Ya */
"rerollBurnPct": .25, /* Qf */
"rerollHistory": 3, /* Xf */
"rerollMax": 25, /* uo */
"rewardGood": 1.25, /* (v0.0.16) */
"rewardHours": 24, /* (v0.0.16) */
"rewardIdxBonus": .05, /* (v0.0.16) */
"rewardOk": 1.1, /* (v0.0.16) */
"rewardPerfect": 1.5, /* (v0.0.16) */
"roundSpeedFloor": .55, /* (v0.0.16) */
"roundSpeedStep": .92, /* (v0.0.16) */
"tierRewards": [{count:5,label:"Искатель",reward:{research:200,dust:5,crystals:3}},{count:15,label:"Переборщик",reward:{research:1e3,dust:25,crystals:10}},{count:25,label:"Пересборщик",reward:{research:5e3,dust:100,crystals:30}}], /* sl */
},

/* === ОФФЛАЙН === */
"offline": {
"efficiency": .5, /* xy */
"maxSeconds": 3*3600, /* vy */
"minSeconds": 60, /* Yc */
},

/* === ТРАНСПОРТ И ФЛОТ === */
"transport": {
"config": {basePerSec:.02,inputPerOutput:8,offlineCapMult:1,maxLevel:5,deepMult:2}, /* Dn */
"fleetBaseCap": 200, /* pb */
"flightBaseCost": 8e3, /* bb */
"flightCostPerTon": 6, /* vb */
"haulFeePerTon": 5, /* rs */
"routeCacheMs": 300*1e3, /* kp */
"speedTiers": [1,1.4,2,3,4.5,6.5,9,12,16,21,27], /* v0.0.20.0: верфь, тиры L7-10 */
"fleetMaxLevels": {cap:10,spd:10,ships:6}, /* pp.*.max — v0.0.20.0 верфь */
"supplyNodesMax": 2, /* By */
"supplyTiers": [{cap:1,speed:1},{cap:1.3,speed:1.15},{cap:1.5,speed:1.25}], /* инлайн-формула */
},

/* === РЕАКТОР / КРАФТ === */
"craft": {
"autoIntervalMs": 3e4, /* Db */
"baseSlots": 1, /* Hb */
"esoQueueBonus": 25, /* Wb */
"haulIntervalSec": 12, /* Jb */
"haulTimeoutMs": 15e3, /* Xb */
"massPerUnit": {steel:1,alloy:1.5,chip:2,core:2,relic:8,researchData:1.5,researchDataBulk:1.2,helium3:4,biomass:2,platinum:6}, /* Zb */
"maxHauls": 200, /* Qb */
"minTimeSec": 5, /* qb */
"offlineCapSec": 8*3600, /* Vb */
"queueCapBase": 50, /* Ub */
"queueCapPerWarehouse": 10, /* zb */
"recipeDefaultMult": 1e4, /* _d */
"recipes": {steel:{inputs:{carbon:10,energy:1e3},time:30},chip:{inputs:{silicon:10,steel:1,energy:5e3},time:60},alloy:{inputs:{titanium:10,chip:1,energy:25e3},time:90},core:{inputs:{uranium:10,alloy:1,energy:12e4},time:150},relic:{inputs:{darkMatter:10,core:1,energy:8e5},time:300},researchData:{inputs:{energy:1e5,silicon:25e3,carbon:25e3,steel:500},time:20,noScale:!0,dataGain:2500},researchDataBulk:{inputs:{energy:2e6,iron:5e4,kriogen:2e4},time:20,noScale:!0,dataGain:400},researchDataElite:{inputs:{energy:1e7,iron:2e5,kriogen:1e5,silicon:5e3},time:30,noScale:!0,dataGain:5e3},helium3:{inputs:{energy:1e8,iron:5e5,silicon:1e4},time:60,noScale:!0,resGain:50},biomass:{inputs:{energy:25e7,kriogen:1e6,titanium:1e4},time:120,noScale:!0,resGain:50},platinum:{inputs:{energy:5e8,iron:2e6,uranium:1e4},time:300,noScale:!0,resGain:25}}, /* gr */
"refundRatio": .8, /* Gb */
"resonanceBonus": .3, /* Yb */
"speedBase": .3, /* Kb */
"speedPerWarehouseLevel": .03, /* jb */
},

/* === ТЕХНОЛОГИИ === */
"tech": {
"costCurveLate": {tableDepth:10,lastRow:9,expFrom:9,lateGrowth:1.35}, /* (v0.0.20) ×1.35 за уровень после 10-го */
"costScaleCurve": {costScale:[1.15,1.1,1.07,1.05,1.04,1.03,1.02,1.015,1.01,1.005,1,0.98,0.96,0.94,0.92,0.9,0.88,0.86,0.84,0.82,0.8,0.796875,0.79375,0.790625,0.7875,0.784375,0.78125,0.778125,0.775,0.771875,0.76875,0.765625,0.7625,0.759375,0.75625,0.753125,0.75,0.746875,0.74375,0.740625,0.7375,0.734375,0.73125,0.728125,0.725,0.721875,0.71875,0.715625,0.7125,0.709375,0.70625,0.703125,0.7,0.696875,0.69375,0.690625,0.6875,0.684375,0.68125,0.678125,0.675,0.671875,0.66875,0.665625,0.6625,0.659375,0.65625,0.653125,0.65,0.646875,0.64375,0.640625,0.6375,0.634375,0.63125,0.628125,0.625,0.621875,0.61875,0.615625,0.6125,0.609375,0.60625,0.603125,0.6,0.596875,0.59375,0.590625,0.5875,0.584375,0.58125,0.578125,0.575,0.571875,0.56875,0.565625,0.5625,0.559375,0.55625,0.553125,0.55],ironBoost:[1,2,4,8,12,16,24,32,48,64,100,140,200,280,400,600,900,1400,2200,3500,5500,6006,6535,7085,7658,8253,8871,9511,10173,10857,11564,12293,13044,13817,14613,15431,16271,17134,18019,18926,19855,20807,21781,22777,23795,24836,25899,26984,28092,29222,30374,31548,32745,33964,35205,36468,37754,39062,40393,41745,43120,44517,45937,47378,48842,50328,51837,53368,54921,56496,58094,59714,61356,63020,64707,66416,68147,69901,71677,73475,75295,77138,79003,80890,82799,84731,86685,88661,90660,92681,94724,96789,98877,100987,103119,105273,107450,109649,111871,114114,116380],kriogenBoost:[1,2,4,8,12,16,24,32,48,64,100,140,200,280,400,600,900,1400,2200,3500,5500,6006,6535,7085,7658,8253,8871,9511,10173,10857,11564,12293,13044,13817,14613,15431,16271,17134,18019,18926,19855,20807,21781,22777,23795,24836,25899,26984,28092,29222,30374,31548,32745,33964,35205,36468,37754,39062,40393,41745,43120,44517,45937,47378,48842,50328,51837,53368,54921,56496,58094,59714,61356,63020,64707,66416,68147,69901,71677,73475,75295,77138,79003,80890,82799,84731,86685,88661,90660,92681,94724,96789,98877,100987,103119,105273,107450,109649,111871,114114,116380],therm:[1,0.8,0.6,0.4,0.35,0.3,0.25,0.2,0.15,0.12,0.1,0.08,0.06,0.05,0.04,0.035,0.03,0.025,0.02,0.015,0.01],recon:[1,0.8,0.6,0.4,0.35,0.3,0.25,0.2,0.15,0.12,0.1,0.08,0.06,0.05,0.04,0.035,0.03,0.025,0.02,0.015,0.01],hyperdrill:[2,2.5,3,4,4.5,5,6,7,8,10,12,15,20,28,40,55,75,100,140,200,280,308.7,338.8,370.3,403.2,437.5,473.2,510.3,548.8,588.7,630,672.7,716.8,762.3,809.2,857.5,907.2,958.3,1010.8,1064.7,1120,1176.7,1234.8,1294.3,1355.2,1417.5,1481.2,1546.3,1612.8,1680.7,1750,1820.7,1892.8,1966.3,2041.2,2117.5,2195.2,2274.3,2354.8,2436.7,2520,2604.7,2690.8,2778.3,2867.2,2957.5,3049.2,3142.3,3236.8,3332.7,3430,3528.7,3628.8,3730.3,3833.2,3937.5,4043.2,4150.3,4258.8,4368.7,4480,4592.7,4706.8,4822.3,4939.2,5057.5,5177.2,5298.3,5420.8,5544.7,5670,5796.7,5924.8,6054.3,6185.2,6317.5,6451.2,6586.3,6722.8,6860.7,7000]}, /* tg */
"costScaleTable": {costScale:[{e:1e3,i:50},{e:5e3,i:200},{e:2e4,i:500},{e:8e4,i:1500,carbon:200},{e:25e4,i:4e3,carbon:800,silicon:400},{e:8e5,i:1e4,carbon:2e3,silicon:1200,helium3:600},{e:25e5,i:3e4,titanium:800,silicon:3e3},{e:8e6,i:8e4,titanium:2500,biomass:1500},{e:25e6,i:2e5,uranium:3e3,platinum:800},{e:1e8,i:5e5,darkMatter:50}],ironBoost:[{e:500,i:100},{e:2500,i:300},{e:1e4,i:800},{e:5e4,i:2500,carbon:150},{e:2e5,i:8e3,carbon:600,silicon:300},{e:8e5,i:25e3,carbon:1800,silicon:900,helium3:500},{e:25e5,i:8e4,titanium:700,silicon:2500},{e:8e6,i:2e5,titanium:2e3,biomass:1200},{e:25e6,i:5e5,uranium:2500,platinum:600},{e:1e8,i:1e6,darkMatter:40}],maxLevel:[{e:2e3,i:200},{e:8e3,i:600},{e:3e4,i:1500},{e:1e5,i:4e3,carbon:300},{e:35e4,i:12e3,carbon:1200,silicon:600},{e:12e5,i:35e3,carbon:3e3,silicon:1800,helium3:900},{e:4e6,i:1e5,titanium:1200,silicon:4e3},{e:12e6,i:25e4,titanium:3500,biomass:2e3},{e:4e7,i:6e5,uranium:4e3,platinum:1200},{e:15e7,i:15e5,darkMatter:80}],crystalBoost:[{c:5},{c:25},{c:100},{c:400,carbon:200},{c:1500,carbon:800,silicon:400},{c:5e3,carbon:2e3,silicon:1200,helium3:600},{c:15e3,titanium:800,silicon:3e3},{c:5e4,titanium:2500,biomass:1500},{c:15e4,uranium:3e3,platinum:800},{c:5e5,darkMatter:50}],kriogenBoost:[{e:1e3,i:200,k:50},{e:5e3,i:500,k:200},{e:2e4,i:1e3,k:500},{e:8e4,i:3e3,k:1500,carbon:200},{e:25e4,i:8e3,k:4e3,carbon:800,silicon:400},{e:8e5,i:25e3,k:1e4,carbon:2e3,silicon:1200,helium3:600},{e:25e5,i:8e4,k:25e3,titanium:800,silicon:3e3},{e:8e6,i:2e5,k:6e4,titanium:2500,biomass:1500},{e:25e6,i:5e5,k:15e4,uranium:3e3,platinum:800},{e:1e8,i:1e6,k:4e5,darkMatter:50}],therm:[{e:2e3,i:300,k:100},{e:8e3,i:800,k:400},{e:3e4,i:2e3,k:1e3},{e:1e5,i:5e3,k:2500,carbon:300},{e:35e4,i:15e3,k:6e3,carbon:1200,silicon:600},{e:12e5,i:4e4,k:15e3,carbon:3e3,silicon:1800,helium3:900},{e:4e6,i:12e4,k:4e4,titanium:1200,silicon:4e3},{e:12e6,i:3e5,k:1e5,titanium:3500,biomass:2e3},{e:4e7,i:8e5,k:25e4,uranium:4e3,platinum:1200},{e:15e7,i:2e6,k:6e5,darkMatter:80}],hyperdrill:[{e:1500,i:250,k:80},{e:6e3,i:600,k:250},{e:25e3,i:1500,k:800},{e:9e4,i:3500,k:2e3,carbon:250},{e:3e5,i:1e4,k:5e3,carbon:900,silicon:450},{e:1e6,i:3e4,k:12e3,carbon:2400,silicon:1400,helium3:700},{e:35e5,i:9e4,k:3e4,titanium:1e3,silicon:3500},{e:1e7,i:25e4,k:8e4,titanium:3e3,biomass:1800},{e:35e6,i:6e5,k:18e4,uranium:3500,platinum:1e3},{e:12e7,i:15e5,k:45e4,darkMatter:70}],recon:[{e:1200,i:150,k:60},{e:5e3,i:400,k:180},{e:2e4,i:1e3,k:500},{e:8e4,i:2500,k:1200,carbon:180},{e:25e4,i:7e3,k:3500,carbon:700,silicon:350},{e:8e5,i:2e4,k:9e3,carbon:1800,silicon:1e3,helium3:500},{e:25e5,i:6e4,k:22e3,titanium:700,silicon:2500},{e:8e6,i:16e4,k:55e3,titanium:2e3,biomass:1200},{e:25e6,i:4e5,k:12e4,uranium:2500,platinum:600},{e:9e7,i:1e6,k:3e5,darkMatter:40}]}, /* Q0 */
"maxLevel": 100, /* (v0.0.20) техно до 100 · W1 */
},

/* === ПЛЕТЕНИЕ (эхо-нити) === */
"echo": {
"copiesMax": 2, /* Dv */
"copiesMaxNewWeave": 3, /* инлайн-формула */
"shareAdjacent": .4, /* Tm */
"shareArm": .25, /* Zd */
"slotsMax": 5, /* io */
"treeHourTickMs": 3600*1e3, /* Bm */
},

/* === СЕРДЦЕ ВОРОНИИ === */
"heart": {
"foldCostWeaves": 5, /* ns */
"stages": [{fold:1,name:"Сплетено",allMult:1.025,echoKept:0,desc:"+2.5% ко всему"},{fold:3,name:"Углублено",allMult:1.075,echoKept:1,desc:"+7.5% ко всему · 1 слот эха переживает престиж"},{fold:5,name:"Пробуждено",allMult:1.15,echoKept:2,desc:"+15% ко всему · 2 слота эха переживают престиж"},{fold:8,name:"Едино",allMult:1.25,echoKept:3,desc:"+25% ко всему · 3 слота · энергия от Хранителей всей сети"}], /* ad */
},

/* === ДРЕВО ПЛАНЕТЫ === */
"tree": {
"eventMods": {tem_growth:{positive:1.1,rewardMult:1.05},tem_cycle:{mixed:1.2},frz_arch:{negative:.85},frz_lens:{positive:1.1},scr_forge:{positive:1.15},scr_ash:{negative:.8},tox_sym:{negative:.65,positive:1.05},tox_res:{negative:.65},rad_mut:{mixed:1.3},rad_decay:{mixed:1.4,eventSpeed:1.15},rck_bed:{negative:.9},rck_deep:{positive:1.1},ocean_flow:{positive:1.1,flavorAdd:"🌊"},ocean_deep:{rewardMult:1.2,comboChance:.1},dstr_dune:{mixed:1.15},dstr_mir:{positive:1.05,negative:.9},mtl_vein:{positive:1.1},mtl_cond:{mixed:1.1,rewardMult:1.1},crl_facet:{rewardMult:1.15},crl_lens:{comboChance:.2,eventSpeed:1.1},fge_horn:{positive:1.15,rewardMult:1.05},fge_temper:{mixed:1.25,rewardMult:1.15},fro_rime:{negative:.65},fro_sleep:{positive:1.2,eventSpeed:.9},lif_myc:{positive:1.3,rewardMult:1.1,flavorAdd:"🍄"},lif_bloom:{mixed:1.4,negative:.75},voi_pact:{negative:1.5,rewardMult:1.5,flavorAdd:"🌑"},voi_echo:{mixed:1.6,negative:1.2,comboChance:.15},cor_prime:{positive:1.05,rewardMult:1.2},cor_stab:{negative:.7,positive:1.05},cra_bench:{mixed:1.15},cra_quality:{rewardMult:1.2,comboChance:.1},fee_grid:{positive:1.1},fee_batt:{rewardMult:1.15},sch_lab:{mixed:1.2,rewardMult:1.1},sch_arch:{positive:1.15,comboChance:.15},spc_core:{rewardMult:1.3,eventSpeed:1.2},spc_unique:{positive:1.25,rewardMult:1.25},spc_hidden:{mixed:1.5,rewardMult:1.4}}, /* Dm */
},

/* === СОБЫТИЯ И АНОМАЛИИ === */
"events": {
"anomalyPool": [{id:"energy_instant",weight:55,kind:"instant",key:"energy"},{id:"iron_instant",weight:28,kind:"instant",key:"iron"},{id:"kriogen_instant",weight:14,kind:"instant",key:"kriogen"},{id:"rare_instant",weight:22,kind:"instant",key:"rare"},{id:"crystal_instant",weight:8,kind:"instant",key:"crystals"},{id:"buff_energy",weight:2,kind:"buff",key:"energy",mult:3,durMin:8,durMax:40},{id:"buff_iron",weight:1.5,kind:"buff",key:"iron",mult:3,durMin:8,durMax:40},{id:"buff_kriogen",weight:1,kind:"buff",key:"kriogen",mult:3,durMin:8,durMax:40},{id:"buff_rare",weight:1.5,kind:"buff",key:"rare",mult:3,durMin:8,durMax:40},{id:"buff_all",weight:.7,kind:"buff",key:"all",mult:3,durMin:5,durMax:15},{id:"jackpot",weight:.2,kind:"buff",key:"all",mult:5,durMin:8,durMax:20}], /* _n */
"armMods": {forge:{positive:1.3,mixed:1,negative:.7,rewardMult:1,flavor:"🔥"},frost:{positive:1,mixed:1.2,negative:.9,rewardMult:1.2,flavor:"❄"},life:{positive:1.5,mixed:1,negative:.5,rewardMult:.9,flavor:"🌱"},void:{positive:.6,mixed:1,negative:1.8,rewardMult:2,flavor:"🌑"},core:{positive:1,mixed:1,negative:1,rewardMult:1.1,flavor:"⚪"},inter:{positive:1,mixed:1,negative:1,rewardMult:1,flavor:"⚪"}}, /* ka */
"chains": [{id:"aurora_forge",chain:["stellar_shower","solar_flare"],name:"🌌 АУРОРА-КУЗНИЦА",duration:40,desc:"Звёздный ливень + Вспышка: ×20 кристаллы, ×10 энергия",effects:{crystalMult:20,energyMult:10}},{id:"abyss_bloom",chain:["deep_bloom","void_echo"],name:"🌑 ЦВЕТ БЕЗДНЫ",duration:45,desc:"Глубинный цвет + Эхо пустоты: аномалии ×6, истощение ×0.1",effects:{anomalyChance:6,depletionMult:.1}},{id:"storm_cathedral",chain:["storm_quasar","ion_storm"],name:"⚡ ГРОЗОВОЙ СОБОР",duration:30,desc:"Грозовой квазар + Ионный шторм: ×20 энергия, скан ×3",effects:{energyMult:20,scanCostMult:3}}], /* Jh */
"pairs": [{id:"stellar_shower",pair:["meteor_storm","crystal_bloom"],name:"🌟 ЗВЁЗДНЫЙ ЛИВЕНЬ",duration:30,desc:"Метеоритный шторм + Кристальный расцвет: ×15 к кристаллам",effects:{meteorRate:8,crystalMult:15}},{id:"supernova",pair:["solar_flare","quasar_pulse"],name:"💥 СВЕРХНОВАЯ",duration:25,desc:"Вспышка + Квазар: ×12 к энергии и железу",effects:{energyMult:12,ironMult:12}},{id:"forge_winds",pair:["gas_cloud","reactor_resonance"],name:"🔥 КУЗНЕЧНЫЕ ВЕТРЫ",duration:40,desc:"Облако + Резонанс: скан −70% и синтез ×2",effects:{scanCostMult:.3,synthMult:2}},{id:"deep_bloom",pair:["deep_pulse","crystal_bloom"],name:"🌀 ГЛУБИННЫЙ ЦВЕТ",duration:45,desc:"Пульс + Расцвет: истощение ×0.25 и кристаллы ×6",effects:{depletionMult:.25,crystalMult:6}},{id:"void_dust",pair:["void_echo","cosmic_dust"],name:"🌑 ПЫЛЬ ПУСТОТЫ",duration:40,desc:"Эхо + Пыль: аномалии ×4 и все ресурсы ×2",effects:{anomalyChance:4,allMult:2}},{id:"storm_quasar",pair:["ion_storm","quasar_pulse"],name:"⚡ ГРОЗОВОЙ КВАЗАР",duration:20,desc:"Шторм + Квазар: энергия ×8, но скан ×2",effects:{energyMult:8,scanCostMult:2}}], /* Qh */
"polarityWeights": {meteor_storm:{polarity:"positive",weight:.8},solar_flare:{polarity:"positive",weight:.9},crystal_bloom:{polarity:"positive",weight:.9},quasar_pulse:{polarity:"positive",weight:.7},reactor_resonance:{polarity:"positive",weight:.8},gas_cloud:{polarity:"mixed",weight:.9},deep_pulse:{polarity:"mixed",weight:.8},cosmic_dust:{polarity:"mixed",weight:.7},void_echo:{polarity:"mixed",weight:.6},acid_rain:{polarity:"negative",weight:.8,compensate:{crystals:2}},ion_storm:{polarity:"negative",weight:.8,compensate:{crystals:2}},magnetic_anomaly:{polarity:"negative",weight:.7,compensate:{crystals:3}},resonance_collapse:{polarity:"negative",weight:.6,compensate:{crystals:4}}}, /* Zh */
},

/* === РЕДКИЕ РЕСУРСЫ === */
"rare": {
"lockedWeight": .35, /* hy */
"reachAhead": 2, /* gy */
},

/* === РОЛИ ПЛАНЕТ === */
"roles": {
"costGrowthPerDuplicate": 1.8, /* инлайн-формула */
"defs": {crafter:{id:"crafter",icon:"⚗",name:"Мастеровая",color:"#c084fc",desc:"Синтез и сплавы: −25% время, +15% выход, −15% добыча",mult:{energy:.85,iron:.85,kriogen:.85,rare:1,synthTime:.75,synthOut:1.15,scan:1,research:1},fleet:{cap:1,speed:1},cost:{e:9e4,i:3500,materials:{core:5}}},feeder:{id:"feeder",icon:"⚡",name:"Питающая",color:"#4ddcff",desc:"+25% энергии, +5% редких, −15% синтез",mult:{energy:1.25,iron:1,kriogen:1,rare:1.05,synthTime:1.15,synthOut:.85,scan:1,research:1},fleet:{cap:1,speed:1},cost:{e:6e4,i:2500,materials:{alloy:20}}},scholar:{id:"scholar",icon:"🔬",name:"Учёная",color:"#7ee08a",desc:"+20% науки, −20% цена скана, −10% добыча",mult:{energy:.9,iron:.9,kriogen:.9,rare:1,synthTime:1,synthOut:1,scan:.8,research:1.2},fleet:{cap:1,speed:1},cost:{e:75e3,i:2e3,materials:{chip:10}}}}, /* kt */
},

/* === ИНТЕРФЕЙС === */
"ui": {
"statsPages": 3, /* lr */
"toastStackMax": 3, /* инлайн-формула */
},

/* === ПРЕМИУМ === */
"premium": {
"durations": [3,7,15,30], /* hx */
"prices": {autoScan:{3:49,7:89,15:159,30:249},autoUpgrade:{3:69,7:129,15:229,30:349},autoTransport:{3:89,7:169,15:299,30:449},dispatcher:{3:109,7:209,15:369,30:549},vip:{30:1190}}, /* Go · v0.0.40.2: пересмотр цен — вход от 49 ₽, VIP 1190 ₽ вместо 2500 ₽ */
"botUsername": "", /* v0.0.40.2: имя TG-бота без @ (заполнить после BotFather); пока пусто — кнопки покупки не показываются */
"botStars": {autoScan:{3:40,7:75,15:135,30:210},autoUpgrade:{3:55,7:105,15:190,30:290},autoTransport:{3:75,7:140,15:250,30:375},dispatcher:{3:90,7:170,15:300,30:450},vip:{30:990}}, /* v0.0.40.2: цены в Telegram Stars для бота (≈₽/1.2) */
},

/* === ЭКОНОМИКА: МНОЖИТЕЛИ === */
"eco": {
"deficit": {start:3,offset:2,step:.06,minMult:.55}, /* инлайн-формула */
"deficitPrestige": {start:0,step:.005,minMult:.6}, /* (v0.0.16) */
"deplete": {start:3,offset:2,step:.05,maxMult:1.5}, /* инлайн-формула */
"scan": {start:3,step:.35,curve:1.1}, /* инлайн-формула */
"softCurveA": {start:3,step:.2}, /* инлайн-формула */
"softCurveB": {start:3,step:.1}, /* инлайн-формула */
},

/* === СЕЙВ === */
"save": {
"backupIntervalMs": 36e5, /* qx */
},

/* === ШИНА СОБЫТИЙ === */
"bus": {
"historyCap": 50, /* zx */
},

/* === КОНТЕКСТНЫЕ ПОДСКАЗКИ === */
"tips": {
"throttleMs": 45e3, /* ey */
},

/* === СОЦИАЛЬНЫЙ СЛОЙ === */
"social": {
"tierGifts": {1:10,2:25,3:50,4:100,5:250}, /* Wc */
"tierThresholds": [0,0,100,500,2e3,1e4], /* mw */
},

/* === АУДИО === */
"audio": {
"volumes": {title:{src:"music/title.mp3",volume:.55},planet:{src:"music/planet.mp3",volume:.5},galaxy:{src:"music/galaxy.mp3",volume:.45}}, /* Tn */
},

/* === ДИСПЕТЧЕР === */
"dispatch": {
"ageLowMs": 15e4, /* ug */
"ageMs": 9e4, /* dg */
"batchEnergy": 50, /* Zu */
"batchIron": 50, /* ef */
"config": {enabled:!1,intervalMs:25e3,nonstopIntervalMs:4e3,nonstop:!0,lastRunAt:0,log:[],lastDispatchAt:0,idleSince:0,lastCheckAt:0,lastIdleLogAt:0,stats:{sent:0,mass:0,skipped:0,multi:0,wakeups:0,checks:0,hold:0,energyHold:0},demandAge:{},holdLogAt:{},priority:{sonar:100,reactor:92,activePlanet:78,bossRecovery:70,reactivate:60,anyUpgrade:42,recipe:40,stockpile:30}}, /* Le */
"critPrio": 90, /* fg */
"floor": 10, /* lg */
"minFill": .35, /* cg */
"minMass": 35, /* ig */
"resourceWeights": {energy:1,iron:4,kriogen:4}, /* nf */
},

/* === 5-й СЛОЙ: РАСКОЛ === */
"shards": {
"absorbBonus": .05, /* инлайн-формула */
"absorbCap": .5, /* инлайн-формула */
"cacheMs": 2e3, /* инлайн-формула */
"chronicleMax": 40, /* инлайн-формула */
"fabricBonus": .1, /* инлайн-формула */
"membraneMult": .5, /* инлайн-формула */
"minEssenceToSplit": 1e5, /* инлайн-формула */
"minMetaToSplit": 3, /* инлайн-формула */
"minWorldsToSplit": 3, /* инлайн-формула */
"seedsEssenceDivisor": 1e3, /* инлайн-формула */
"seedsMetaBonus": .1, /* инлайн-формула */
"seedsSmallWorldFactor": .35, /* инлайн-формула */
"seedsSmallWorldLimit": 8, /* инлайн-формула */
"seedsWorldBonus": .05, /* инлайн-формула */
"splitEssenceShare": .25, /* инлайн-формула */
"synthBonus": .02, /* инлайн-формула */
"synthCap": 10, /* инлайн-формула */
"synthCost": 10, /* инлайн-формула */
"transferCooldownMs": 864e5, /* инлайн-формула */
"transferLoss": .3, /* инлайн-формула */
"tree": {seamSlot:{tier:1,cost:5,name:"Тонкий шов",repeatable:!0,costGrowth:3,desc:"+1 слот параллельной вселенной (каждая следующая дороже ×3)"},essencePool:{tier:1,cost:10,name:"Общий пул эссенции",desc:"Эссенция стекает в общий банк: можно снимать в любой вселенной (раз в сутки)"},sharedAch:{tier:1,cost:15,name:"Общие достижения",desc:"Открытые в одной вселенной засчитываются во всех"},dustBridge:{tier:2,cost:50,name:"Мост пыли",desc:"Пыль перетекает между вселенными с потерей 30%"},quickSwitch:{tier:2,cost:75,name:"Быстрый перелёт",desc:"Смена вселенной без подтверждения"},shardBridge:{tier:2,cost:200,name:"Мост осколков",desc:"Осколки перетекают между вселенными с потерей 30%"},weaveFabric:{tier:3,cost:500,name:"Ткань реальности",desc:"+10% к добыче во всех вселенных"},weaverAnchor:{tier:3,cost:750,name:"Якорь Ткача",desc:"3 изученных узла дерева переносятся в новую вселенную"},membrane:{tier:3,cost:1200,name:"Мембрана",desc:"Хранители в не-первой вселенной бьются в 0.5 силы"},absorb:{tier:4,cost:2000,name:"Поглощение",desc:"Можно поглотить вселенную: +5% добычи навсегда (до +50%), слот освобождается"},synthSeeds:{tier:4,cost:5000,name:"Синтез зёрен",desc:"Открывает конвертацию 10 🌠 → 1 семя синтеза: +2% к добыче (до 10 семян)"}}, /* инлайн-формула */
},

/* === СЛЕДЫ ДРУГА === */
"ghost": {
"alpha": .16, /* инлайн-формула */
"codePrefix": "VORGP1", /* инлайн-формула */
"color": "#c084fc", /* инлайн-формула */
"markAlpha": .5, /* инлайн-формула */
"markColors": ["#ffd27a","#ff8c8c","#7ec9e8"], /* инлайн-формула */
"markRadius": 7, /* инлайн-формула */
"maxCellsPerPlanet": 400, /* инлайн-формула */
"maxDraw": 140, /* инлайн-формула */
"maxMarks": 40, /* инлайн-формула */
"maxPlanets": 24, /* инлайн-формула */
"maxWeaves": 60, /* инлайн-формула */
"weaveAlpha": .22, /* инлайн-формула */
"weaveColor": "192,132,252", /* инлайн-формула */
"weaveDash": [3,5], /* инлайн-формула */
},

/* === CINEMATIC === */
"cinematic": {
"arrivalMs": 1200, /* (v0.0.16) */
"blackoutMs": 320, /* (v0.0.16) */
"collapseMs": 1000, /* (v0.0.16) */
"colors": {collapse:"#ff4d9d",fold:"#c084fc",burn:"#eaf8ff"}, /* (v0.0.16) */
"cracks": 24, /* (v0.0.16) */
"reportMs": 4200, /* (v0.0.16) */
"zoomFrom": .22, /* (v0.0.16) */
"zoomTo": .98, /* (v0.0.16) */
},

/* === GUARDIAN === */
"guardian": {
"shardAwarePct": 35, /* инлайн-формула */
"shardLines": {sentinel:["Я чувствую шов. По ту сторону — ещё одна грань, и на ней кто-то держит удар. Не я.",
"Ты расколол мир. Я остался на этом осколке — значит, моя служба стала короче и яснее.",
"Раньше я охранял границу мира. Теперь граница проходит сквозь меня.",
"Когда ты уходишь в другую вселенную, я стою здесь. Это и есть моя работа."],
guardian:["Ещё одно Я рядом. Оно не моё — и всё же я слышу, как оно дышит сквозь шов.",
"Раскол не рана, если ты знаешь, зачем режешь. Ты знаешь?",
"Я помню Воронию целой. Ты сделал её несколькими — и она не перестала быть собой.",
"Между вселенными тише, чем здесь. Но тишина не защищает. Защищаю я."],
overlord:["Ты разделил то, что я держал одним куском. Интересно: стало ли тебя больше — или просто стало два?",
"Я раскололся первым. Ты повторяешь мой жест, но осознанно. Это уже не падение, а ремесло.",
"Швы — это тоже плетение. Просто нить идёт сквозь пустоту.",
"Смотри в оба: в одной из твоих вселенных я не сплю. И в этой — тоже."]}, /* (v0.0.14/15) */
},

/* === MAP === */
"map": {
"resourceIconSize": 11, /* (v0.0.16) */
"resourceIconsMax": 6, /* (v0.0.16) */
},

};
window.VORONIA_BALANCE = window.VORONIA_BALANCE || {};
(function merge(dst, src){ for (var k in src) { if (src[k] && typeof src[k]==="object" && !Array.isArray(src[k]) && dst[k] && typeof dst[k]==="object" && !Array.isArray(dst[k])) merge(dst[k], src[k]); else dst[k] = src[k]; } })(window.VORONIA_BALANCE, B);
window.__VORONIA_BALANCE_WIRED = Object.keys(B).map(function(c){ return Object.keys(B[c]).map(function(k){ return c+"."+k; }); }).reduce(function(a,b){return a.concat(b)},[]);
})();