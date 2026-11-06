/**
 * ui/styles.ts — инлайновые стили среза (без внешних ресурсов: single-file сборка ≤6 МБ, ADR/ТЗ).
 */
const CSS = `
:root { color-scheme: dark; --v2-ui-font-size: 13px; }
/* Stage 10.0.6: one typography scale across HUD, dialogs, controls and mobile UI. */
body, body *, #app, #app *, #game-hud, #game-hud *, [role="dialog"], [role="dialog"] * { font-size: var(--v2-ui-font-size) !important; }
#app svg, #game-hud svg { font-size: inherit; }
body { margin: 0; background: #0b0f14; color: #dfe7ee; font: var(--v2-ui-font-size)/1.45 system-ui, sans-serif; }
#app { max-width: 1100px; margin: 0 auto; padding: 12px; }
#game-scene { contain: layout paint; }
#game-hud { min-width: 0; }
h1 { font-size: 20px; margin: 4px 0 10px; } h1 small { color: #8aa0b4; font-weight: 400; }
h2 { font-size: 15px; margin: 14px 0 6px; color: #a9c1d4; } h3 { font-size: 13px; margin: 8px 0; color: #8aa0b4; }
.hud { display: flex; gap: 24px; flex-wrap: wrap; }
.hud .col { min-width: 260px; }
.res { padding: 2px 0; } .res .ic { width: 22px; display: inline-block; }
.rate { color: #7ee08a; font-size: 12px; }
button { background: #16202b; color: #cfe3f2; border: 1px solid #2b3d4f; border-radius: 6px; padding: 4px 10px; cursor: pointer; font: inherit; }
button:hover { background: #1d2b3a; }
/* Этап 9.2: док клетки поверх сцены (v1-паритет) вместо сетки карточек внизу. */
.cell-dock-host { position: absolute; inset: 0; pointer-events: none; z-index: 3; }
.cell-dock { position: absolute; right: 8px; top: 8px; width: 224px; pointer-events: auto; background: rgba(8,14,20,.9); border: 1px solid #2c4a63; border-radius: 10px; padding: 8px; box-shadow: 0 6px 22px #0009; backdrop-filter: blur(3px); }
.cell-dock-head { display: flex; justify-content: space-between; align-items: center; gap: 6px; color: #8fd7ff; font-size: 10px; letter-spacing: .08em; margin-bottom: 4px; }
.cell-dock-head button { background: none; border: 0; color: #8aa0b4; cursor: pointer; font-size: 15px; line-height: 1; min-height: 0; padding: 2px 4px; }
.cell-dock-head button:hover { color: #fff; }
.cell-dock .cell { background: transparent; border: 0; padding: 2px; min-height: 0; }
.scene-hint { position: absolute; left: 50%; bottom: 8px; transform: translateX(-50%); pointer-events: none; color: #7f97ab; font-size: 11px; letter-spacing: .05em; background: rgba(4,10,16,.6); padding: 4px 12px; border-radius: 999px; white-space: nowrap; max-width: calc(100% - 20px); overflow: hidden; text-overflow: ellipsis; }
.selection-empty { padding: 12px; color: #91a6b8; text-align: center; }
.cell { border: 1px solid #223243; border-radius: 8px; padding: 8px; background: #101821; min-height: 64px; }
.cell.hidden { color: #3a4c5e; display: flex; align-items: center; justify-content: center; font-size: 20px; }
.cell.revealed { border-style: dashed; }
.cell.explored.t4 { border-color: #6c4d8f; }
.cell .ic { font-size: 16px; }
.cell small { color: #8aa0b4; display: block; }
.vein { font-size: 12px; color: #b9cede; margin: 4px 0; }
.cool { font-size: 12px; color: #e0b45c; }
.saverow { display: flex; gap: 6px; }
.save-status { min-height: 18px; margin-top: 4px; color: #8fddb2; font-size: 12px; }
.session { margin-top: 8px; font-size: 12px; color: #6f879b; }
.scene-switch { display:flex; justify-content:center; gap:7px; margin:0 auto 8px; }
.scene-switch button { min-width:110px; background:#0b1a27; border-color:#31536a; color:#9fc8dc; }
.scene-switch button.active { background:#16415a; border-color:#63c9e8; color:#e5f8ff; box-shadow:0 0 14px #1c7d9a55; }
.galaxy3d-scene { position:relative; width:min(100%, 920px); height:min(62vh, 620px); min-height:320px; margin:0 auto 12px; overflow:hidden; border:1px solid #24445b; border-radius:14px; background:#020711; box-shadow:inset 0 0 45px #071d31, 0 8px 28px #0008; }
.galaxy3d-scene canvas { width:100%; height:100%; display:block; touch-action:none; cursor:grab; }
.galaxy-scene-caption { position:absolute; top:12px; left:14px; color:#8dc9df; font:600 11px system-ui,sans-serif; letter-spacing:.16em; text-shadow:0 1px 5px #000; pointer-events:none; }
.galaxy3d-scene .view-controls { right:8px; left:auto; bottom:8px; }
.galaxy-node-panel { position:absolute; left:12px; bottom:12px; width:min(360px,calc(100% - 92px)); max-height:calc(100% - 64px); overflow:auto; padding:13px 14px; border:1px solid #39718a; border-radius:11px; background:linear-gradient(145deg,rgba(7,22,34,.96),rgba(4,11,19,.94)); box-shadow:0 12px 34px #0009,inset 0 0 24px #12364a55; backdrop-filter:blur(9px); color:#d9edf7; }
.galaxy-node-panel[hidden] { display:none; }
.galaxy-node-panel h3 { margin:2px 28px 2px 0; color:#e8f8ff; font-size:18px; }
.galaxy-nav-actions { display:flex; gap:6px; margin:7px 28px 7px 0; } .galaxy-nav-actions button { flex:1; min-width:0; padding:6px 5px; border-color:#315c72; color:#a9d9e9; font-size:9px; font-weight:800; letter-spacing:.04em; } .galaxy-nav-actions button:first-child { border-color:#5b9eb4; background:#123449; color:#d8f7ff; }
.galaxy-panel-kicker { color:#63c9e8; font:700 9px monospace; letter-spacing:.16em; }
.galaxy-panel-meta { color:#9bb8c8; font-size:11px; }
.galaxy-panel-close { position:absolute; right:7px; top:7px; width:28px; height:28px; padding:0; font-size:20px; line-height:1; }
.galaxy-panel-grid { display:grid; grid-template-columns:1fr 1fr; gap:6px; margin:10px 0; }
.galaxy-panel-grid span { display:block; padding:5px 7px; border:1px solid #234356; border-radius:6px; background:#0a1b28; color:#87aabd; font-size:10px; }
.galaxy-panel-grid b { display:block; color:#d5edf7; font-size:11px; font-weight:600; overflow-wrap:anywhere; }
.galaxy-panel-route { display:flex; flex-direction:column; gap:3px; padding:8px; border-left:2px solid #e9c96e; background:#182331; }
.galaxy-panel-route small { color:#d5bd78; font:700 9px monospace; letter-spacing:.1em; }
.galaxy-panel-route b { color:#fff0b7; font-size:12px; }
.galaxy-panel-route span { color:#9fb6c5; font-size:10px; line-height:1.4; }
.galaxy-panel-anomaly { margin:6px 0; color:#d8a7ff; font-size:11px; }
.galaxy-panel-status { margin-top:8px; color:#9ab7c8; font-size:11px; }
.galaxy-travel-button { width:100%; margin-top:9px; padding:8px; border-color:#b99b4d; background:linear-gradient(90deg,#5a4721,#293b43); color:#fff0b8; font-size:11px; font-weight:800; letter-spacing:.04em; }
.galaxy-travel-button:disabled { opacity:.45; cursor:not-allowed; }
.galaxy-world-list { margin:9px 0; padding:8px; border:1px solid #29495b; border-radius:8px; background:rgba(7,19,29,.78); }
.galaxy-world-list > small { display:block; color:#70cbe5; font:700 9px monospace; letter-spacing:.12em; margin-bottom:6px; }
.galaxy-world-row { display:flex; align-items:center; gap:8px; padding:6px 0; }
.galaxy-world-orbit { display:grid; place-items:center; width:28px; height:28px; border:1px solid #5aa5bd; border-radius:50%; color:#bceeff; font-size:19px; }
.galaxy-world-row span:nth-child(2) { min-width:0; flex:1; }
.galaxy-world-row b,.galaxy-world-row em { display:block; }
.galaxy-world-row b { color:#e2f6ff; font-size:11px; }
.galaxy-world-row em { color:#8daebd; font-size:9px; font-style:normal; }
.galaxy-world-row strong { color:#8ce0b1; font:700 8px monospace; }
.galaxy-world-list p { margin:5px 0 0; color:#748f9f; font-size:9px; line-height:1.4; }
.scene3d { position: relative; width: min(56vh, 480px); height: min(56vh, 480px); margin: 0 auto 10px; }
.scene3d canvas { width: 100%; height: 100%; display: block; touch-action: none; cursor: grab; }
.view-controls { position: absolute; left: 8px; bottom: 8px; display: flex; gap: 5px; }
.view-controls button { width: 36px; height: 36px; padding: 0; font-size: 19px; background: rgba(10,18,27,.82); border-color: #456078; }

/* Stage 9.4.2 — cinematic title screen, preserving the live planet renderer. */
#app.title-mode { position:relative; width:100%; max-width:none; min-height:100svh; height:100svh; margin:0; padding:0; overflow:hidden; background:#02050b; }
#app.title-mode .scene3d.title-backdrop { position:fixed; inset:0; z-index:0; width:100vw; height:100svh; max-width:none; max-height:none; min-height:0; margin:0; border:0; border-radius:0; overflow:hidden; background:radial-gradient(ellipse at 50% 48%,#10243b 0%,#050b17 48%,#010309 100%); }
#app.title-mode .scene3d.title-backdrop canvas { width:100%; height:100%; opacity:.94; }
#app.title-mode .scene3d.title-backdrop .fps,
#app.title-mode .scene3d.title-backdrop .view-controls,
#app.title-mode .scene3d.title-backdrop .cell-dock-host { display:none; }
.title-screen { position:fixed; inset:0; z-index:10; display:flex; flex-direction:column; justify-content:space-between; padding:clamp(18px,4vw,46px); box-sizing:border-box; color:#eaf5ff; background:linear-gradient(180deg,rgba(1,5,13,.68),rgba(2,8,18,.12) 38%,rgba(1,5,12,.72)); text-align:center; }
.title-screen::before { content:""; position:absolute; inset:0; pointer-events:none; background:radial-gradient(ellipse at 50% 52%,transparent 20%,rgba(0,0,0,.28) 75%,rgba(0,0,0,.58)); }
.title-topline,.title-bottomline { position:relative; z-index:1; display:flex; justify-content:space-between; gap:14px; color:#8da9c1; font:700 10px/1.4 ui-monospace,monospace; letter-spacing:.2em; }
.title-content { position:relative; z-index:1; width:min(680px,100%); margin:auto; padding:34px 0; text-shadow:0 2px 20px #000; }
.title-kicker { color:#8dcbe7; font:700 10px/1.5 ui-monospace,monospace; letter-spacing:.34em; }
.title-logo { margin:12px 0 0; color:#f1f8ff; font:300 clamp(38px,8vw,76px)/1.05 system-ui,sans-serif; letter-spacing:.22em; text-indent:.22em; text-shadow:0 0 28px rgba(105,196,255,.48),0 4px 28px #000; }
.title-subtitle { margin-top:12px; color:#b8d5e8; font:600 clamp(10px,1.7vw,14px)/1.4 ui-monospace,monospace; letter-spacing:.42em; }
.title-lore { margin:clamp(22px,5vh,46px) 0 8px; color:#d5e4ef; font-size:clamp(14px,2vw,17px); line-height:1.8; }
.title-prompt { margin:0; color:#8fa9bd; font-size:12px; letter-spacing:.06em; }
.title-actions { display:flex; justify-content:center; flex-wrap:wrap; gap:12px; margin-top:clamp(26px,5vh,42px); }
.title-actions button { min-width:190px; min-height:48px; padding:12px 24px; border-radius:2px; font:800 11px/1.2 ui-monospace,monospace; letter-spacing:.16em; transition:transform .2s ease,background .2s ease,border-color .2s ease,box-shadow .2s ease; }
.title-actions button:hover { transform:translateY(-2px); }
.title-primary { color:#f3fbff; border:1px solid #7ccce9; background:linear-gradient(110deg,rgba(18,73,101,.94),rgba(21,47,75,.94)); box-shadow:0 0 24px rgba(62,174,220,.2),inset 0 0 18px rgba(91,194,235,.12); }
.title-primary:hover { background:linear-gradient(110deg,#1c6688,#234e73); box-shadow:0 0 30px rgba(62,174,220,.38); }
.title-secondary { color:#b6c8d8; border:1px solid rgba(137,169,194,.48); background:rgba(5,13,24,.66); }
.title-secondary:hover { border-color:#8dcbe7; background:rgba(14,36,54,.86); }
.title-footnote { margin-top:18px; color:#6e8ca4; font:600 9px/1.5 ui-monospace,monospace; letter-spacing:.12em; }
.title-screen-leaving { opacity:0; transition:opacity .42s ease; pointer-events:none; }
@media (max-width:600px) { .title-screen { padding:18px 16px 22px; } .title-topline,.title-bottomline { font-size:8px; letter-spacing:.12em; } .title-logo { letter-spacing:.12em; text-indent:.12em; } .title-subtitle { letter-spacing:.22em; } .title-actions { flex-direction:column; align-items:center; } .title-actions button { width:min(100%,320px); } .title-lore br { display:none; } }
@media (prefers-reduced-motion:reduce) { .title-actions button,.title-screen-leaving { transition:none; } }
@media (max-width: 600px) { #app { padding: 8px; } .scene3d { width: min(76vw, 54vh, 420px); height: min(76vw, 54vh, 420px); } .galaxy3d-scene { height:min(62vh,500px); min-height:280px; } .galaxy-node-panel { left:7px; bottom:7px; width:min(310px,calc(100% - 64px)); padding:10px; } .galaxy-panel-grid { gap:4px; } .galaxy-nav-actions { margin-right:26px; } .galaxy-nav-actions button { font-size:8px; } .hud { gap: 12px; } .hud .col { min-width: min(100%, 280px); flex: 1 1 100%; } .cell-dock { width: min(200px, 46%); } button { min-height: 34px; } }
.geology-survey-card { display:flex; flex-direction:column; gap:4px; margin:7px 0; padding:8px 9px; border:1px solid rgba(93,166,191,.32); border-radius:8px; background:linear-gradient(120deg,rgba(24,65,79,.42),rgba(17,35,49,.35)); color:#a9c7d5; } .geology-survey-card b { color:#82d6e9; letter-spacing:.08em; } .geology-survey-card span { color:#a4bdc9; }
.sonar-preview { padding: 7px 9px; margin: 5px 0; border: 1px solid #28546a; border-radius: 7px; background: rgba(16,43,58,.45); color: #bdeaff; font-size: 12px; } .sonar-preview small { color: #8caebe; } .sonar-state { font-size: 12px; color: #9ec3d6; margin: 5px 0; }
.sonar-overlay { position: fixed; inset: 0; z-index: 10000; display: grid; place-items: center; padding: 16px; background: rgba(1,6,12,.94); } .sonar-dialog { width: min(100%, 520px); padding: 20px; border: 1px solid #39718a; border-radius: 14px; background: linear-gradient(145deg,#0b1b29,#071018); box-shadow: 0 20px 80px #000; text-align: center; } .sonar-dialog h2 { color: #4ddcff; letter-spacing: 1.5px; } .sonar-dialog p,.sonar-help { color: #8caebe; font-size: 12px; } .sonar-round { margin: 18px 0 10px; color: #4ddcff; font: 700 12px monospace; } .sonar-track { position: relative; height: 34px; margin: 18px 0; border: 1px solid #2b6178; border-radius: 8px; background: linear-gradient(90deg,#401b27,#263a36 38%,#235a48 50%,#263a36 62%,#401b27); overflow: hidden; } .sonar-center { position: absolute; left: 50%; top: 0; height: 100%; width: 2px; background: #eafff6; box-shadow: 0 0 12px #5cf2b0; } .sonar-cursor { position: absolute; top: 3px; width: 5px; height: 26px; margin-left: -2px; border-radius: 3px; background: #4ddcff; box-shadow: 0 0 12px #4ddcff; } .sonar-readout { font: 900 32px monospace; color: #4ddcff; margin: 10px; } .sonar-stop { width: 100%; min-height: 48px; color: white; border-color: #4ddcff; background: #12354a; font-weight: 800; letter-spacing: 1px; }
.fps { position: absolute; top: 6px; right: 8px; font-size: 11px; color: #7fe3a8; background: rgba(8, 14, 20, 0.55); padding: 2px 6px; border-radius: 4px; pointer-events: none; }
.galaxy { display: flex; flex-direction: column; gap: 5px; margin: 7px 0; }
.galaxy-map { width: min(100%, 330px); aspect-ratio: 1; margin: 6px auto; overflow: hidden; border: 1px solid #23445a; border-radius: 50%; background: radial-gradient(circle at 50% 50%, #142b3a, #07111c 68%, #03080d); box-shadow: inset 0 0 30px #000, 0 0 20px #0b2939; }
.galaxy-map svg { width: 100%; height: 100%; }
.galaxy-map line { stroke: #397b96; stroke-width: 5; stroke-opacity: .72; stroke-dasharray: 12 10; }
.galaxy-map circle { stroke-width: 5; }
.galaxy-map circle.known { fill: #48c8e8; stroke: #a3f0ff; }
.galaxy-map circle.hidden { fill: #15212c; stroke: #64788a; stroke-dasharray: 7 6; }
.galaxy-map circle.active { fill: #f2c96d; stroke: #fff0b2; filter: drop-shadow(0 0 14px #ffc94d); }
.galaxy-map text { fill: #c6e7f4; font: 26px system-ui,sans-serif; paint-order: stroke; stroke: #06101a; stroke-width: 6px; }
.galaxy-legend { display:flex; justify-content:space-around; color:#8daabd; font-size:11px; }
.galaxy-sectors { display:flex; flex-wrap:wrap; gap:6px 12px; margin:6px 0 10px; color:#8fb4c4; font-size:11px; }
.galaxy-sectors b { color:#d8f4ff; }
.galaxy-progress { font-size:11px; color:#91b7c9; }
.galaxy-progress-track { height:5px; background:#172b38; border-radius:8px; margin:4px 0 8px; overflow:hidden; }
.galaxy-progress-track i { display:block; height:100%; background:linear-gradient(90deg,#2f8eaf,#74e3d4); }
.galaxy-history { max-height:150px; overflow:auto; border-left:1px solid #28516a; padding-left:9px; }
.galaxy-history > div { padding:4px 0; font-size:12px; }
.galaxy-history small { display:block; color:#829caf; font-size:10px; }
.gnode { font-size: 12px; color: #cfe3f2; }
.gnode.undiscovered { color: #6f879b; }
.gnode small { color: #9fb4c6; }
.warehouse-capacity-track{height:7px;overflow:hidden;border-radius:99px;background:rgba(105,150,170,.18);margin:6px 0 8px}.warehouse-capacity-track i{display:block;height:100%;border-radius:inherit;background:linear-gradient(90deg,#42c5a5,#e5bf65);transition:width .2s ease}

.galaxy-progression { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:7px; margin:7px 0; }
.progression-stage { border:1px solid #29495b; border-radius:8px; padding:8px; background:rgba(9,23,34,.72); }
.progression-stage.complete { border-color:#3d9b91; background:rgba(20,62,62,.35); }
.progression-stage b,.progression-stage small { display:block; }
.progression-stage b { color:#d6f4ff; font-size:12px; }
.progression-stage small { color:#91adbb; font-size:10px; margin-top:4px; line-height:1.4; }


/* Stage 7.4 — unscanned orbital signatures are visible without revealing body identity. */
.galaxy-orbital-signatures { display: grid; gap: 7px; margin-top: 12px; }
.galaxy-orbital-signatures > small { color: #79cde8; font-size: 10px; letter-spacing: .09em; }
.galaxy-world-candidate { opacity: .76; border-style: dashed; }
.galaxy-world-candidate .galaxy-world-orbit { color: #83c9e8; }
.galaxy-world-candidate strong { color: #8ca9b7; font-size: 9px; }

/* Этап 9.3 — дерево технологий и реактор (Этапы 7/8 ТЗ): списки в колонке HUD. */
.tech-list { display: grid; gap: 6px; margin: 6px 0; max-height: 260px; overflow-y: auto; }
.tech-row { border: 1px solid #29495b; border-radius: 8px; padding: 7px 8px; background: rgba(9,23,34,.72); display: grid; gap: 3px; }
.tech-row b { color: #d6f4ff; font-size: 12px; }
.tech-row b small { color: #7fa8bd; font-weight: 400; }
.tech-row small { color: #91adbb; font-size: 10px; line-height: 1.4; }
.tech-row.bought { border-color: #3d9b91; }
.tech-row button { justify-self: start; }
.tech-state { color: #8caebe; font-size: 11px; }
.craft-btns { display: flex; gap: 6px; }
.craft-job.deficit { border-color: #a4552e; background: rgba(60,26,12,.4); }
.craft-job button { justify-self: end; }
.craft-bar { height: 6px; border-radius: 3px; background: rgba(255,255,255,.08); overflow: hidden; }
.craft-bar i { display: block; height: 100%; background: linear-gradient(90deg,#3d9b91,#79cde8); }

/* Stage 9.4.3 — v0.0.41-style compact resource HUD. No opaque full-width bar. */
.legacy-resource-hud { display:flex; align-items:center; gap:12px; width:100%; min-width:0; margin:0 auto 10px; padding:5px 0 8px; border-bottom:1px solid rgba(83,132,157,.22); }
.hud-planet-context { display:flex; align-items:center; gap:8px; flex:0 0 auto; min-width:118px; padding:3px 10px 3px 2px; border-right:1px solid rgba(104,157,181,.28); }
.hud-context-mark { color:#79d8ed; font-size:21px; text-shadow:0 0 12px rgba(91,203,230,.45); }
.hud-planet-context b,.hud-planet-context small { display:block; max-width:145px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
.hud-planet-context b { color:#d9f1fb; font-size:11px; font-weight:700; }
.hud-planet-context small { color:#68899b; font:700 8px/1.4 ui-monospace,monospace; letter-spacing:.12em; }
.hud-resource-track { display:flex; align-items:center; gap:6px; min-width:0; flex:1 1 auto; overflow-x:auto; overflow-y:hidden; scrollbar-width:thin; scrollbar-color:#31566a transparent; padding:2px 1px 5px; }
.hud-resource-chip { display:flex; align-items:center; gap:6px; flex:0 0 auto; min-height:31px; padding:3px 9px; border:1px solid rgba(75,119,143,.34); border-radius:5px; background:linear-gradient(180deg,rgba(14,31,44,.72),rgba(6,16,25,.48)); color:#d7eaf3; white-space:nowrap; }
.hud-resource-icon { width:17px; text-align:center; font-size:14px; filter:drop-shadow(0 0 5px rgba(111,205,228,.18)); }
.hud-resource-value { font:700 11px/1 ui-monospace,monospace; font-variant-numeric:tabular-nums; }
.hud-resource-rate { color:#83dba6; font:600 9px/1 ui-monospace,monospace; }
@media (max-width:700px) {
  .legacy-resource-hud { align-items:stretch; flex-direction:column; gap:5px; margin-bottom:7px; padding-bottom:6px; }
  .hud-planet-context { min-width:0; border-right:0; border-bottom:1px solid rgba(104,157,181,.16); padding:1px 3px 5px; }
  .hud-planet-context b { max-width:calc(100vw - 65px); }
  .hud-resource-track { gap:5px; margin-right:-2px; }
  .hud-resource-chip { min-height:30px; padding:3px 7px; gap:5px; }
  .hud-resource-value { font-size:10px; }
  .hud-resource-rate { font-size:8px; }
}


/* Stage 9.4.4 — planet-cell interaction panel: legacy action hierarchy, 3D-first layout. */
.cell-dock { right:clamp(8px,2vw,18px); top:clamp(8px,2vw,18px); width:min(286px,calc(100% - 20px)); max-height:calc(100% - 20px); overflow-y:auto; padding:10px; border:1px solid rgba(92,169,201,.58); border-radius:7px; background:linear-gradient(155deg,rgba(7,20,31,.94),rgba(4,11,20,.91)); box-shadow:0 10px 34px rgba(0,0,0,.48),inset 0 1px rgba(183,231,255,.06); backdrop-filter:blur(9px); }
.cell-dock-head { position:sticky; top:-10px; z-index:2; margin:-2px -2px 9px; padding:3px 2px 8px; border-bottom:1px solid rgba(88,146,174,.25); background:rgba(7,20,31,.96); color:#7fcbe5; font:700 9px/1.4 ui-monospace,monospace; letter-spacing:.13em; }
.cell-action-panel { display:grid; gap:9px; color:#c9dce8; }
.cell-panel-title { display:flex; align-items:center; gap:10px; min-width:0; }
.cell-panel-icon { display:grid; place-items:center; flex:0 0 38px; height:38px; border:1px solid rgba(111,191,218,.42); border-radius:6px; background:rgba(26,66,86,.34); color:#bdeeff; font-size:21px; text-shadow:0 0 12px rgba(87,199,235,.45); }
.cell-panel-heading { min-width:0; }
.cell-panel-heading b,.cell-panel-heading small { display:block; overflow-wrap:anywhere; }
.cell-panel-heading b { color:#e5f6ff; font-size:12px; line-height:1.35; }
.cell-panel-heading small,.cell-panel-stats small,.cell-panel-resource span,.cell-panel-branch>small { color:#7898aa; font:700 8px/1.5 ui-monospace,monospace; letter-spacing:.1em; }
.cell-panel-description,.cell-action-panel>p { margin:0; color:#9db5c4; font-size:10px; line-height:1.55; }
.cell-panel-cost { display:flex; align-items:center; justify-content:space-between; padding:7px 8px; border:1px solid rgba(79,130,155,.25); background:rgba(12,34,48,.56); color:#8caaba; font-size:10px; }
.cell-panel-cost b { color:#c8f1ff; font:700 12px ui-monospace,monospace; }
.cell-panel-stats { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:5px; }
.cell-panel-stats>div { min-width:0; padding:7px 6px; border:1px solid rgba(76,119,141,.24); background:rgba(13,30,42,.62); }
.cell-panel-stats small,.cell-panel-stats b { display:block; }
.cell-panel-stats small { font-size:7px; letter-spacing:.05em; }
.cell-panel-stats b { margin-top:3px; color:#e1f4fc; font:700 12px ui-monospace,monospace; }
.cell-geological-reward { display:flex; flex-direction:column; gap:5px; margin:2px 0 8px; padding:10px 12px; border:1px solid rgba(103,190,220,.28); border-radius:10px; background:linear-gradient(110deg,rgba(42,111,139,.16),rgba(37,65,91,.12)); }
.cell-geological-reward>span { color:#7898aa; font:700 8px/1.5 ui-monospace,monospace; letter-spacing:.1em; }
.cell-geological-reward>b { display:flex; align-items:center; gap:7px; color:#d7edf5; font-size:12px; }
.cell-geological-reward>small { color:#9eb5c1; font-size:9px; }
.cell-panel-resource { padding:8px; border:1px solid rgba(76,119,141,.27); background:rgba(13,30,42,.56); }
.cell-panel-resource>div { display:flex; justify-content:space-between; gap:6px; align-items:center; }
.cell-panel-resource b { color:#ccebf6; font:700 10px ui-monospace,monospace; }
.cell-panel-resource i { display:block; height:4px; margin-top:7px; overflow:hidden; border-radius:4px; background:#182b38; }
.cell-panel-resource em { display:block; height:100%; background:linear-gradient(90deg,#3189a8,#8ae2ce); }
.cell-panel-resource small { display:block; margin-top:5px; color:#9eb5c1; font-size:9px; }
.cell-action-primary,.cell-action-secondary { width:100%; min-height:36px; padding:8px 10px; font:800 9px/1.3 ui-monospace,monospace; letter-spacing:.09em; }
.cell-action-primary { border-color:#4e9fbd; background:linear-gradient(110deg,rgba(17,77,103,.96),rgba(17,51,75,.96)); color:#e5f9ff; box-shadow:inset 0 0 15px rgba(74,184,222,.09); }
.cell-action-primary:hover:not(:disabled) { border-color:#9ce7ff; background:linear-gradient(110deg,#1b6685,#205779); }
.cell-action-secondary { border-color:rgba(99,148,171,.46); background:rgba(15,38,52,.78); color:#b9d9e8; }
.cell-action-panel button:disabled { opacity:.42; cursor:not-allowed; }
.cell-panel-warning { color:#e6a86e; font-size:9px; text-align:right; }
.cell-panel-extraction { padding:7px 8px; border:1px solid rgba(67,166,139,.25); background:rgba(20,64,55,.2); color:#8edbc3; font-size:10px; text-align:center; }
.cell-panel-cooldown { padding:8px; border:1px solid rgba(181,139,76,.3); background:rgba(64,44,19,.25); color:#e3c28a; font-size:10px; text-align:center; }
.cell-panel-anomaly { padding:7px 8px; border-left:2px solid var(--anomaly-color,#b58ce8); background:rgba(50,31,67,.28); color:var(--anomaly-color,#cba8f0); font-size:10px; }
.cell-panel-branch { display:grid; gap:5px; }
.cell-panel-branch button { min-height:32px; text-align:left; font-size:10px; }
.cell-panel-foot { padding-top:6px; border-top:1px solid rgba(76,119,141,.2); color:#607f91; font:700 7px/1.4 ui-monospace,monospace; letter-spacing:.12em; }
.cell-dock .cell { display:none; }
@media (max-width:600px) {
  .cell-dock { right:6px; top:6px; width:min(244px,calc(100% - 12px)); max-height:min(62%,430px); padding:8px; }
  .cell-dock-head { top:-8px; }
  .cell-panel-icon { flex-basis:32px; height:32px; font-size:18px; }
  .cell-panel-heading b { font-size:11px; }
  .cell-panel-stats>div { padding:6px 5px; }
  .cell-action-primary,.cell-action-secondary { min-height:38px; }
  .scene-hint { width:max-content; max-width:calc(100% - 18px); white-space:normal; text-align:center; bottom:5px; font-size:9px; }
}

/* Stage 9.4.5 — legacy primary navigation restored as a fixed, compact bottom bar. */
.legacy-bottom-nav { position:fixed; z-index:120; left:50%; bottom:max(8px,env(safe-area-inset-bottom)); transform:translateX(-50%); display:grid; grid-template-columns:repeat(4,minmax(76px,1fr)); width:min(560px,calc(100vw - 20px)); padding:5px; gap:4px; border:1px solid rgba(91,151,179,.48); border-radius:7px; background:linear-gradient(180deg,rgba(10,25,38,.96),rgba(3,11,20,.97)); box-shadow:0 8px 30px rgba(0,0,0,.48),inset 0 1px rgba(194,230,245,.06); backdrop-filter:blur(12px); }
.legacy-bottom-nav button { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:3px; min-height:48px; padding:5px 4px; border:1px solid transparent; border-radius:4px; background:transparent; color:#7897aa; font:800 8px/1.2 ui-monospace,monospace; letter-spacing:.12em; }
.legacy-bottom-nav button span { color:#8cb9ce; font-size:17px; line-height:1; }
.legacy-bottom-nav button.active { border-color:rgba(104,202,230,.42); background:linear-gradient(180deg,rgba(31,91,117,.55),rgba(12,43,61,.48)); color:#e3f8ff; box-shadow:inset 0 0 14px rgba(79,185,218,.1),0 0 12px rgba(55,158,192,.1); }
.legacy-bottom-nav button.active span { color:#9beaff; text-shadow:0 0 10px rgba(89,210,244,.55); }
.legacy-nav-panel[hidden] { display:none !important; }
#game-hud { padding-bottom:76px; }
@media(max-width:600px) { .legacy-bottom-nav { bottom:max(5px,env(safe-area-inset-bottom)); width:calc(100vw - 12px); gap:2px; padding:4px; } .legacy-bottom-nav button { min-height:46px; font-size:7px; letter-spacing:.08em; } #game-hud { padding-bottom:70px; } }


/* Stage 9.4.6 — modal/window system restored in the v0.0.41 visual language. */
.legacy-resource-hud { position:relative; padding-right:4px; }
.hud-quick-actions { display:flex; flex:0 1 auto; align-items:center; justify-content:center; gap:4px; }
.hud-quick-actions button { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:1px; width:42px; min-width:38px; height:34px; padding:2px 3px; border:1px solid rgba(79,143,169,.38); border-radius:4px; background:linear-gradient(180deg,rgba(13,37,52,.9),rgba(5,18,29,.82)); color:#9edff1; font-size:17px; line-height:1; }
.hud-quick-actions button small { color:#6f9fb3; font:700 6px/1 ui-monospace,monospace; letter-spacing:.08em; }
.hud-quick-actions button:hover { border-color:#8be3f7; color:#e6fbff; box-shadow:0 0 10px rgba(71,187,220,.18); }
.hud-quick-actions button.is-unavailable { border-style:dashed; color:#71818b; }
.hud-quick-actions button.is-unavailable small { color:#65747d; }
.combat-status-line { display:flex; justify-content:space-between; gap:12px; padding:10px; border:1px solid rgba(122,147,162,.25); background:rgba(8,19,28,.65); color:#8ea9b8; font:700 9px ui-monospace,monospace; }
.combat-status-line b { color:#e4b87a; }
.hud-window-actions { display:flex; flex:0 0 auto; align-items:center; gap:4px; }
.hud-window-actions button { width:29px; height:29px; padding:0; border:1px solid rgba(91,151,179,.36); border-radius:4px; background:rgba(8,24,36,.76); color:#8fc8dc; font-size:15px; }
.hud-window-actions button:hover { border-color:#7ddcf5; color:#e4faff; box-shadow:0 0 10px rgba(71,187,220,.16); }
.legacy-modal-overlay { position:fixed; inset:0; z-index:20000; display:grid; place-items:center; padding:clamp(8px,3vw,24px); background:rgba(1,6,12,.78); backdrop-filter:blur(8px); animation:voronia-modal-in .16s ease-out; }
.legacy-modal { width:min(560px,100%); max-height:min(82dvh,760px); display:flex; flex-direction:column; overflow:hidden; border:1px solid rgba(94,177,207,.58); border-radius:7px; background:linear-gradient(155deg,rgba(9,26,39,.99),rgba(3,11,19,.99)); box-shadow:0 22px 90px rgba(0,0,0,.72),inset 0 1px rgba(190,235,255,.08); color:#d4e9f2; }
.legacy-modal-head { display:flex; align-items:center; gap:12px; padding:14px 16px; border-bottom:1px solid rgba(90,151,178,.28); background:linear-gradient(90deg,rgba(17,55,74,.48),transparent); }
.legacy-modal-mark { display:grid; place-items:center; width:38px; height:38px; border:1px solid rgba(107,202,231,.44); color:#9deaff; font-size:22px; }
.legacy-modal-head small,.legacy-modal-foot span { color:#668da1; font:700 8px/1.4 ui-monospace,monospace; letter-spacing:.16em; }
.legacy-modal-head h2 { margin:2px 0 0; color:#dff7ff; font:800 13px/1.3 ui-monospace,monospace; letter-spacing:.12em; }
.legacy-modal-close { margin-left:auto; width:32px; height:32px; padding:0; border:1px solid rgba(108,157,180,.3); background:transparent; color:#9bb9c8; font-size:22px; }
.legacy-modal-body { overflow:auto; padding:16px; }
.legacy-modal-foot { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:10px 16px; border-top:1px solid rgba(90,151,178,.22); }
.legacy-modal-foot button,.modal-action-grid button { min-height:36px; border:1px solid rgba(87,157,186,.48); border-radius:3px; background:linear-gradient(110deg,rgba(17,67,91,.82),rgba(10,34,50,.92)); color:#d8f5ff; font:800 9px ui-monospace,monospace; letter-spacing:.1em; }
.modal-lead { margin:0 0 14px; color:#9db9c8; font-size:11px; }
.modal-action-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; }
.modal-note { margin-top:12px; padding:9px 10px; border-left:2px solid #438eaa; background:rgba(16,45,61,.48); color:#86aaba; font-size:10px; }
.modal-list { display:grid; gap:6px; max-height:48dvh; overflow:auto; }
.modal-list-row { display:grid; gap:4px; padding:9px 10px; border:1px solid rgba(81,129,151,.24); background:rgba(8,23,34,.7); }
.modal-list-row b { color:#ccebf5; font-size:10px; }
.modal-list-row small,.modal-empty { color:#7897a8; font-size:9px; }
.modal-setting { display:flex; align-items:center; justify-content:space-between; gap:16px; padding:12px 0; border-bottom:1px solid rgba(88,139,162,.2); color:#c2dbe6; font-size:11px; }
.modal-setting select { min-width:130px; padding:7px; border:1px solid #345a70; background:#091925; color:#d9eff8; }
.modal-setting input { width:18px; height:18px; accent-color:#54b8d7; }
.modal-about-logo { margin:8px 0; color:#a8eaff; text-align:center; font:800 22px ui-monospace,monospace; letter-spacing:.12em; text-shadow:0 0 24px rgba(73,190,226,.28); }
.modal-info-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:8px; margin-top:16px; }
.modal-info-grid span { display:grid; gap:5px; padding:10px; border:1px solid rgba(81,129,151,.24); color:#6f94a7; font:700 8px ui-monospace,monospace; letter-spacing:.1em; }
.modal-info-grid b { color:#d1edf7; font-size:10px; letter-spacing:0; }
@keyframes voronia-modal-in { from { opacity:0; } to { opacity:1; } }
@media(max-width:700px) { .legacy-resource-hud { flex-wrap:wrap; } .hud-quick-actions { order:3; flex:1 1 auto; justify-content:flex-start; } .hud-quick-actions button { width:40px; height:32px; } .hud-window-actions { order:4; width:auto; margin-left:auto; justify-content:flex-end; } .hud-window-actions button { width:32px; height:30px; } .legacy-modal { max-height:88dvh; } .legacy-modal-body { padding:12px; } }
:root { --voronia-ui-scale:1; }
#app { font-size:calc(14px * var(--voronia-ui-scale)); }
.voronia-reduced-motion *, .voronia-reduced-motion *::before, .voronia-reduced-motion *::after { animation-duration:.01ms !important; animation-iteration-count:1 !important; transition-duration:.01ms !important; scroll-behavior:auto !important; }

/* Stage 9.4.7 — responsive integration hardening (phone, tablet, desktop, landscape). */
html { min-height:100%; background:#0b0f14; }
body { min-width:320px; min-height:100%; overflow-x:hidden; padding:0; padding-bottom:env(safe-area-inset-bottom); }
#app { box-sizing:border-box; width:min(100%,1280px); min-width:0; }
#game-hud, #game-hud * { min-width:0; }
#game-hud .hud { align-items:flex-start; }
#game-hud .hud .col { box-sizing:border-box; }
.scene-switch { flex-wrap:wrap; max-width:100%; }
.scene-switch button { min-width:0; min-height:38px; }
.scene3d { width:min(64vw,58vh,560px); height:min(64vw,58vh,560px); min-width:260px; min-height:260px; }
.galaxy3d-scene { width:100%; height:clamp(300px,65vh,680px); min-height:280px; }
.galaxy3d-scene canvas, .scene3d canvas { max-width:100%; }
.legacy-resource-hud, .hud-resource-track { max-width:100%; }
.legacy-modal-overlay { box-sizing:border-box; padding:max(8px,env(safe-area-inset-top)) max(8px,env(safe-area-inset-right)) max(8px,env(safe-area-inset-bottom)) max(8px,env(safe-area-inset-left)); }
.legacy-modal { width:min(560px,100%); max-height:calc(100dvh - 16px - env(safe-area-inset-top) - env(safe-area-inset-bottom)); }
.legacy-modal-body { overscroll-behavior:contain; -webkit-overflow-scrolling:touch; }
button, select, input { touch-action:manipulation; }
button:focus-visible, select:focus-visible, input:focus-visible { outline:2px solid #83dff5; outline-offset:2px; }
@media (max-width:700px) {
  #app:not(.title-mode) { padding:7px 7px calc(78px + env(safe-area-inset-bottom)); }
  .scene-switch { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); width:min(320px,100%); gap:5px; }
  .scene-switch button { padding:7px 4px; font-size:10px; }
  .scene3d { width:min(88vw,54vh); height:min(88vw,54vh); min-width:240px; min-height:240px; }
  .galaxy3d-scene { height:min(66dvh,620px); min-height:300px; border-radius:8px; }
  .galaxy-node-panel { width:min(330px,calc(100% - 64px)); max-height:55%; }
  .legacy-resource-hud { gap:4px; }
  .hud-resource-track { scroll-snap-type:x proximity; }
  .hud-resource-chip { scroll-snap-align:start; }
  .legacy-bottom-nav { left:max(6px,env(safe-area-inset-left)); right:max(6px,env(safe-area-inset-right)); width:auto; transform:none; bottom:max(5px,env(safe-area-inset-bottom)); }
  #game-hud { padding-bottom:0; }
  .cell-dock { max-height:min(58dvh,430px); }
  .legacy-modal { width:100%; max-height:calc(100dvh - 16px - env(safe-area-inset-top) - env(safe-area-inset-bottom)); }
  .legacy-modal-head { padding:10px 12px; }
  .legacy-modal-foot { padding:8px 12px; }
}
@media (max-width:380px) {
  .legacy-bottom-nav button { min-height:44px; font-size:6px; letter-spacing:.04em; }
  .legacy-bottom-nav button span { font-size:15px; }
  .cell-dock { width:min(220px,calc(100% - 12px)); }
  .title-logo { font-size:clamp(34px,11vw,48px); }
  .title-actions button { min-height:44px; }
}
@media (orientation:landscape) and (max-height:520px) {
  #app:not(.title-mode) { padding-top:5px; }
  .legacy-resource-hud { flex-direction:row; align-items:center; }
  .hud-planet-context { border-right:1px solid rgba(104,157,181,.28); border-bottom:0; }
  .scene3d { width:min(48vh,420px); height:min(48vh,420px); min-height:220px; }
  .galaxy3d-scene { height:72vh; min-height:220px; }
  .title-screen { padding:10px 18px; }
  .title-content { padding:8px 0; }
  .title-lore { margin:8px 0 4px; }
  .title-actions { margin-top:10px; }
  .title-actions button { min-height:38px; }
  .title-bottomline { font-size:7px; }
  .legacy-bottom-nav { bottom:max(3px,env(safe-area-inset-bottom)); }
}
@media (prefers-reduced-motion:reduce) {
  *, *::before, *::after { scroll-behavior:auto !important; animation-duration:.01ms !important; animation-iteration-count:1 !important; transition-duration:.01ms !important; }
}


/* Stage 9.6 — local SVG asset recovery pack; no emoji/glyph dependency. */
.legacy-icon { display:inline-block; width:18px; height:18px; flex:0 0 18px; object-fit:contain; color:#8fdcf4; vertical-align:middle; filter:drop-shadow(0 0 4px rgba(74,190,226,.22)); }
.hud-svg-icon { width:17px; height:17px; flex-basis:17px; color:#8fe7ff; }
.cell-svg-icon { width:27px; height:27px; flex-basis:27px; color:#9ceaff; }
.inline-resource-icon { width:14px; height:14px; flex-basis:14px; margin:0 2px; }
.logistics-svg-icon { width:16px; height:16px; flex-basis:16px; margin-right:3px; }
.hud-resource-icon { display:flex; align-items:center; justify-content:center; }
.cell-panel-icon { display:grid; place-items:center; }

/* Stage 9.8 — legacy UI parity polish: consistent surfaces, clear active states and tactile feedback. */
.legacy-resource-hud {
  position:relative; gap:clamp(5px, .8vw, 12px); padding:7px 0 9px;
  border-bottom-color:rgba(103,166,190,.34);
  background:linear-gradient(180deg,rgba(7,18,28,.18),rgba(7,18,28,0));
}
.hud-planet-context { min-width:clamp(112px,14vw,168px); }
.hud-context-mark { display:grid; place-items:center; width:27px; height:27px; border:1px solid rgba(103,202,230,.32); border-radius:50%; background:radial-gradient(circle,rgba(63,159,190,.18),rgba(7,22,34,.2)); }
.hud-resource-track { scrollbar-width:thin; scrollbar-color:rgba(95,174,202,.55) transparent; }
.hud-resource-track::-webkit-scrollbar { height:4px; }
.hud-resource-track::-webkit-scrollbar-thumb { border-radius:8px; background:rgba(95,174,202,.45); }
.hud-resource-chip { min-height:34px; padding:4px 8px; border-radius:4px; transition:border-color .16s ease,background .16s ease,transform .16s ease; }
.hud-resource-chip:hover { border-color:rgba(112,209,235,.62); background:linear-gradient(180deg,rgba(20,49,66,.88),rgba(7,22,33,.72)); }
.hud-resource-value { color:#e3f6fc; font:700 10px/1.2 ui-monospace,monospace; font-variant-numeric:tabular-nums; }
.hud-resource-rate { color:#76d7a5; font:600 8px/1.2 ui-monospace,monospace; }
.hud-quick-actions { gap:5px; }
.hud-quick-actions button, .hud-window-actions button {
  position:relative; overflow:hidden; border-radius:4px;
  transition:transform .14s ease,border-color .14s ease,background .14s ease,box-shadow .14s ease;
}
.hud-quick-actions button::after, .hud-window-actions button::after {
  position:absolute; inset:0; content:""; pointer-events:none;
  background:linear-gradient(135deg,rgba(190,240,255,.10),transparent 48%); opacity:.65;
}
.hud-quick-actions button:active, .hud-window-actions button:active, .legacy-bottom-nav button:active { transform:translateY(1px) scale(.97); }
.hud-quick-actions button:focus-visible, .hud-window-actions button:focus-visible, .legacy-bottom-nav button:focus-visible { outline:2px solid #9beaff; outline-offset:2px; }
.hud-quick-actions button[aria-pressed="true"] { border-color:#8be3f7; background:linear-gradient(180deg,rgba(30,91,115,.95),rgba(9,39,55,.95)); color:#e8fbff; box-shadow:inset 0 0 12px rgba(91,209,237,.16),0 0 12px rgba(71,187,220,.14); }
.hud-window-actions button { width:31px; height:31px; }
.legacy-bottom-nav { gap:5px; padding:5px; border-color:rgba(105,171,198,.55); box-shadow:0 10px 34px rgba(0,0,0,.54),inset 0 1px rgba(194,230,245,.08); }
.legacy-bottom-nav button { position:relative; min-height:50px; border-radius:3px; transition:color .16s ease,background .16s ease,border-color .16s ease,transform .12s ease; }
.legacy-bottom-nav button::before { position:absolute; top:0; left:18%; right:18%; height:2px; content:""; background:linear-gradient(90deg,transparent,#83e4fb,transparent); opacity:0; transition:opacity .16s ease; }
.legacy-bottom-nav button.active::before { opacity:1; }
.legacy-bottom-nav button.active { border-color:rgba(111,216,241,.58); background:linear-gradient(180deg,rgba(31,91,117,.62),rgba(8,35,51,.72)); }
.legacy-nav-panel { animation:legacy-panel-in .18s ease-out; }
.legacy-nav-panel[hidden] { display:none !important; }
.legacy-nav-panel:focus { outline:none; }
.cell-action-panel button:not(:disabled), .legacy-modal button:not(:disabled), .legacy-nav-panel button:not(:disabled) { transition:filter .14s ease,border-color .14s ease,background .14s ease,transform .12s ease; }
.cell-action-panel button:not(:disabled):active, .legacy-modal button:not(:disabled):active, .legacy-nav-panel button:not(:disabled):active { transform:translateY(1px); filter:brightness(1.15); }
.legacy-modal { border-radius:5px; }
.legacy-modal-head { background:linear-gradient(90deg,rgba(17,55,74,.58),rgba(7,20,31,.18) 72%,transparent); }
.legacy-modal-close:hover { border-color:rgba(132,216,239,.72); background:rgba(35,84,105,.32); color:#e6faff; }
@keyframes legacy-panel-in { from { opacity:.55; transform:translateY(3px); } to { opacity:1; transform:translateY(0); } }
@media(max-width:700px) {
  .legacy-resource-hud { gap:6px; }
  .hud-planet-context { min-width:0; flex:1 1 100%; border-right:0; border-bottom:1px solid rgba(104,157,181,.2); padding:2px 2px 6px; }
  .hud-planet-context b { max-width:calc(100vw - 90px); }
  .hud-resource-track { order:2; flex:1 1 100%; width:100%; padding-bottom:6px; }
  .hud-quick-actions { order:3; flex:1 1 auto; }
  .hud-window-actions { order:4; }
  .hud-quick-actions button { width:42px; min-width:40px; height:36px; }
  .hud-quick-actions button small { font-size:6px; }
}
@media(prefers-reduced-motion:reduce) {
  .legacy-nav-panel { animation:none; }
  .hud-resource-chip,.hud-quick-actions button,.hud-window-actions button,.legacy-bottom-nav button { transition:none; }
}


/* Stage 9.10 — planet-first composition: the 3D world fills the viewport and UI becomes layered glass. */
#app.game-mode {
  position:relative; width:100%; max-width:none; min-width:320px; height:100dvh; min-height:100dvh;
  margin:0; padding:0; overflow:hidden; isolation:isolate; background:#020711;
}
#app.game-mode .scene3d:not(.title-backdrop) {
  position:fixed; inset:0; z-index:0; width:100vw; height:100dvh; min-width:0; min-height:0;
  max-width:none; max-height:none; margin:0; overflow:hidden; border:0; border-radius:0;
  background:radial-gradient(ellipse at 50% 48%,#12263a 0%,#07111e 43%,#020711 78%,#01040a 100%);
  box-shadow:none;
}
#app.game-mode .scene3d canvas { width:100%; height:100%; max-width:none; display:block; }
#app.game-mode .galaxy3d-scene {
  position:fixed; inset:0; z-index:0; width:100vw; height:100dvh; min-height:0; max-height:none;
  margin:0; overflow:hidden; border:0; border-radius:0; background:#020711; box-shadow:none;
}
#app.game-mode .galaxy3d-scene canvas { width:100%; height:100%; }
#app.game-mode #game-hud { position:fixed; inset:0; z-index:12; padding:0; pointer-events:none; }
#app.game-mode #game-hud > .legacy-resource-hud {
  position:absolute; z-index:30; top:max(8px,env(safe-area-inset-top)); left:max(12px,env(safe-area-inset-left)); right:max(12px,env(safe-area-inset-right));
  width:auto; max-width:none; min-height:48px; margin:0; padding:6px 8px; gap:8px;
  border:1px solid rgba(91,157,184,.30); border-radius:7px;
  background:linear-gradient(180deg,rgba(4,14,24,.88),rgba(4,14,24,.60));
  box-shadow:0 7px 24px rgba(0,0,0,.23),inset 0 1px rgba(202,238,255,.05);
  backdrop-filter:blur(12px); pointer-events:auto;
}
#app.game-mode .hud-planet-context { min-width:clamp(110px,13vw,156px); }
#app.game-mode .hud-resource-track { flex:1 1 260px; min-width:0; }
#app.game-mode .hud-resource-chip { background:rgba(9,25,37,.72); }
#app.game-mode .hud-quick-actions { flex:0 0 auto; }
#app.game-mode .hud-window-actions { flex:0 0 auto; }
#app.game-mode #game-hud > .hud {
  position:absolute; z-index:22; top:calc(68px + env(safe-area-inset-top)); left:max(12px,env(safe-area-inset-left));
  display:block; width:min(292px,28vw); max-height:calc(100dvh - 154px - env(safe-area-inset-top) - env(safe-area-inset-bottom));
  margin:0; padding:10px; overflow-x:hidden; overflow-y:auto; overscroll-behavior:contain;
  border:1px solid rgba(83,145,173,.36); border-radius:7px;
  background:linear-gradient(155deg,rgba(5,17,28,.84),rgba(4,12,21,.76));
  box-shadow:0 12px 34px rgba(0,0,0,.28),inset 0 1px rgba(192,230,249,.05);
  backdrop-filter:blur(10px); pointer-events:auto;
  scrollbar-width:thin; scrollbar-color:rgba(93,164,189,.42) transparent;
}
#app.game-mode #game-hud .hud .col { display:block; width:100%; min-width:0; }
#app.game-mode #game-hud .hud h2 { margin:9px 0 4px; font-size:12px; }
#app.game-mode #game-hud .hud h2:first-child { margin-top:1px; }
#app.game-mode #game-hud .hud .legacy-nav-panel { min-width:0; animation:none; }
#app.game-mode #game-hud .hud .legacy-nav-panel > * { max-width:100%; }
#app.game-mode .scene-switch {
  position:fixed; z-index:25; top:calc(66px + env(safe-area-inset-top)); left:50%; transform:translateX(-50%);
  width:max-content; max-width:calc(100vw - 620px); margin:0; padding:4px; gap:4px;
  border:1px solid rgba(82,146,173,.34); border-radius:6px;
  background:rgba(4,15,25,.66); backdrop-filter:blur(10px); pointer-events:auto;
}
#app.game-mode .scene-switch button { min-width:104px; padding:7px 10px; background:rgba(8,28,41,.76); }
#app.game-mode .cell-dock { top:calc(116px + env(safe-area-inset-top)); right:max(12px,env(safe-area-inset-right)); max-height:calc(100dvh - 208px - env(safe-area-inset-bottom)); }
#app.game-mode .scene-hint { bottom:calc(82px + env(safe-area-inset-bottom)); z-index:4; }
#app.game-mode .view-controls { left:auto; right:max(14px,env(safe-area-inset-right)); bottom:calc(86px + env(safe-area-inset-bottom)); z-index:6; }
#app.game-mode .fps { position:absolute; top:calc(114px + env(safe-area-inset-top)); right:16px; z-index:5; }
#app.game-mode .legacy-bottom-nav { z-index:60; pointer-events:auto; }
#app.game-mode .cell-dock-host { z-index:8; }
#app.game-mode .hud-window-actions button { min-width:29px; }

/* The title mark is a single typographic word; it must never wrap between letters. */
.title-content { width:min(900px,100%); }
.title-logo {
  display:block; width:100%; max-width:100%; margin:12px auto 0; white-space:nowrap; overflow:visible;
  font-size:clamp(34px,7.2vw,76px); letter-spacing:clamp(.06em,1.35vw,.18em); text-indent:clamp(.06em,1.35vw,.18em);
  line-height:1.08;
}

@media (max-width:900px) {
  #app.game-mode #game-hud > .hud { width:min(258px,32vw); }
  #app.game-mode .scene-switch { max-width:calc(100vw - 300px); }
  #app.game-mode .scene-switch button { min-width:88px; padding:7px 6px; font-size:10px; }
}
@media (max-width:700px) {
  #app.game-mode #game-hud > .legacy-resource-hud {
    top:max(5px,env(safe-area-inset-top)); left:6px; right:6px; min-height:0; padding:5px 6px; gap:3px;
    display:flex; flex-wrap:wrap; align-items:center; border-radius:6px;
  }
  #app.game-mode .hud-planet-context { order:0; flex:0 0 auto; min-width:92px; max-width:118px; border:0; padding:1px 4px; }
  #app.game-mode .hud-planet-context b { max-width:100px; font-size:10px; }
  #app.game-mode .hud-resource-track { order:2; flex:1 1 100%; width:100%; padding:2px 0 4px; }
  #app.game-mode .hud-resource-chip { min-height:27px; padding:3px 6px; }
  #app.game-mode .hud-quick-actions { order:1; margin-left:auto; gap:3px; }
  #app.game-mode .hud-quick-actions button { width:36px; min-width:34px; height:30px; }
  #app.game-mode .hud-quick-actions button small { display:none; }
  #app.game-mode .hud-window-actions { order:1; gap:3px; }
  #app.game-mode .hud-window-actions button { width:29px; height:29px; }
  #app.game-mode #game-hud > .hud {
    top:calc(96px + env(safe-area-inset-top)); left:6px; width:min(238px,52vw);
    max-height:calc(100dvh - 174px - env(safe-area-inset-top) - env(safe-area-inset-bottom)); padding:8px;
    background:linear-gradient(155deg,rgba(5,17,28,.78),rgba(4,12,21,.68));
  }
  #app.game-mode .scene-switch {
    top:auto; bottom:calc(66px + env(safe-area-inset-bottom)); left:50%; max-width:calc(100vw - 12px);
    transform:translateX(-50%); padding:3px; gap:3px;
  }
  #app.game-mode .scene-switch button { min-width:0; min-height:32px; padding:6px 7px; font-size:9px; }
  #app.game-mode .cell-dock {
    top:calc(98px + env(safe-area-inset-top)); right:6px; width:min(220px,52vw);
    max-height:calc(100dvh - 190px - env(safe-area-inset-top) - env(safe-area-inset-bottom)); padding:8px;
  }
  #app.game-mode .view-controls { right:8px; bottom:calc(122px + env(safe-area-inset-bottom)); }
  #app.game-mode .view-controls button { width:32px; height:32px; }
  #app.game-mode .fps { top:auto; right:8px; bottom:calc(160px + env(safe-area-inset-bottom)); font-size:8px; }
  #app.game-mode .scene-hint { bottom:calc(114px + env(safe-area-inset-bottom)); max-width:calc(100vw - 18px); font-size:8px; }
  .title-logo { font-size:clamp(32px,9vw,58px); letter-spacing:clamp(.04em,.9vw,.12em); text-indent:clamp(.04em,.9vw,.12em); }
}
@media (max-width:380px) {
  #app.game-mode .hud-quick-actions button { width:31px; min-width:29px; }
  #app.game-mode .hud-window-actions button { width:26px; min-width:26px; }
  #app.game-mode .hud-planet-context { min-width:78px; max-width:90px; }
  #app.game-mode .scene-switch button { font-size:8px; padding-inline:5px; }
  .title-logo { font-size:clamp(29px,8.7vw,42px); letter-spacing:.04em; text-indent:.04em; }
}
@media (orientation:landscape) and (max-height:520px) {
  #app.game-mode #game-hud > .hud { top:58px; max-height:calc(100dvh - 112px); }
  #app.game-mode .scene-switch { top:58px; bottom:auto; }
  #app.game-mode .cell-dock { top:104px; max-height:calc(100dvh - 150px); }
  #app.game-mode .view-controls { bottom:48px; }
  #app.game-mode .legacy-bottom-nav { bottom:3px; }
  .title-content { padding:4px 0; }
  .title-logo { font-size:clamp(30px,6vw,54px); }
}


/* Stage 9.12.1 — readable orbital palette + compact mobile composition. */
:root {
  color-scheme: dark;
  --space-0:#071321; --space-1:#102638; --panel-glass:rgba(13,35,49,.88);
  --line-soft:rgba(132,190,210,.34); --text-main:#e5f3f6; --text-muted:#9bb9c5;
  --accent-cyan:#73d9e8; --accent-gold:#f0c36e;
}
body { background:radial-gradient(ellipse at 50% 42%,#142f43 0%,#091827 58%,#050d18 100%); color:var(--text-main); }
button { border-color:rgba(119,178,199,.48); background:linear-gradient(180deg,rgba(31,61,77,.94),rgba(13,34,49,.96)); color:#e2f5f8; }
.hud-resource-chip { background:linear-gradient(145deg,rgba(23,54,70,.94),rgba(9,27,41,.94)); border-color:var(--resource-accent,rgba(119,178,199,.45)); box-shadow:inset 0 1px rgba(220,248,255,.05); }
.hud-resource-chip[data-resource-chip="energy"] { --resource-accent:#e7b957; }
.hud-resource-chip[data-resource-chip="iron"],.hud-resource-chip[data-resource-chip="steel"] { --resource-accent:#aebdca; }
.hud-resource-chip[data-resource-chip="kriogen"],.hud-resource-chip[data-resource-chip="crystals"],.hud-resource-chip[data-resource-chip="silicon"] { --resource-accent:#68d5e8; }
.hud-resource-chip[data-resource-chip="research"],.hud-resource-chip[data-resource-chip="essence"] { --resource-accent:#b89ae9; }
.hud-resource-chip[data-resource-chip="dust"],.hud-resource-chip[data-resource-chip="darkMatter"] { --resource-accent:#c18de0; }
.hud-resource-chip[data-resource-chip="uranium"],.hud-resource-chip[data-resource-chip="helium3"] { --resource-accent:#9bd68c; }
.hud-resource-value { color:#f0f8fa; }
.hud-resource-rate { color:#9cdbb7; }
.legacy-bottom-nav { background:linear-gradient(180deg,rgba(20,48,64,.97),rgba(8,24,37,.98)); border-color:rgba(119,190,211,.58); }
.legacy-nav-panel,.cell-dock,.legacy-modal { background:linear-gradient(145deg,rgba(20,48,64,.96),rgba(8,23,36,.96)); border-color:rgba(115,185,207,.55); }
.cell-action-panel { background:linear-gradient(145deg,rgba(21,54,68,.96),rgba(9,27,41,.96)); }

@media (max-width:700px) {
  /* Keep the world visible: a slim resource rail, not a full-width stacked header. */
  #app.game-mode > h1 { display:none; }
  #app.game-mode #game-hud > .legacy-resource-hud {
    top:calc(5px + env(safe-area-inset-top)); left:7px; right:7px; width:auto;
    display:grid; grid-template-columns:minmax(76px,.8fr) minmax(0,2.2fr); gap:4px 6px;
    padding:6px; border:1px solid rgba(119,190,211,.48); border-radius:13px;
    background:linear-gradient(145deg,rgba(14,39,55,.94),rgba(6,19,31,.92));
    box-shadow:0 8px 28px rgba(0,0,0,.28); backdrop-filter:blur(12px);
  }
  #app.game-mode .hud-planet-context { grid-column:1; grid-row:1; min-width:0; max-width:none; border:0; padding:2px; }
  #app.game-mode .hud-planet-context b { max-width:100%; font-size:12px; }
  #app.game-mode .hud-quick-actions { grid-column:2; grid-row:1; justify-content:flex-end; margin:0; gap:4px; }
  #app.game-mode .hud-window-actions { grid-column:1 / -1; grid-row:2; justify-content:flex-end; margin:0; }
  #app.game-mode .hud-resource-track { grid-column:1 / -1; grid-row:3; display:flex; flex-wrap:nowrap; overflow-x:auto; width:100%; gap:5px; padding:2px 0; scrollbar-width:none; }
  #app.game-mode .hud-resource-track::-webkit-scrollbar { display:none; }
  #app.game-mode .hud-resource-chip { flex:1 0 100px; min-height:34px; justify-content:center; border-radius:9px; }
  #app.game-mode #game-hud > .hud {
    top:auto; bottom:calc(72px + env(safe-area-inset-bottom)); left:7px; right:7px; width:auto;
    max-height:min(48dvh,390px); overflow:auto; border:1px solid rgba(119,190,211,.55);
    border-radius:15px; padding:10px; background:rgba(10,29,43,.94); backdrop-filter:blur(14px);
    box-shadow:0 12px 34px rgba(0,0,0,.4);
  }
  #app.game-mode .cell-dock {
    top:auto; bottom:calc(72px + env(safe-area-inset-bottom)); left:7px; right:7px; width:auto;
    max-height:min(42dvh,330px); overflow:auto; border-radius:15px; padding:10px;
  }
  #app.game-mode .scene-switch { bottom:calc(68px + env(safe-area-inset-bottom)); z-index:11; }
  #app.game-mode .view-controls { right:10px; bottom:calc(126px + env(safe-area-inset-bottom)); }
  #app.game-mode .fps { bottom:calc(166px + env(safe-area-inset-bottom)); }
  #app.game-mode .scene-hint { bottom:calc(118px + env(safe-area-inset-bottom)); max-width:calc(100vw - 24px); white-space:normal; text-align:center; }
  #app.game-mode .legacy-bottom-nav { bottom:max(5px,env(safe-area-inset-bottom)); }
  #app.game-mode .legacy-bottom-nav button { min-height:48px; font-size:8px; }
  #app.game-mode .legacy-bottom-nav button span { font-size:18px; }
  #app.game-mode .scene3d:not(.title-backdrop) { width:min(92vw,58dvh); height:min(92vw,58dvh); max-width:100vw; max-height:58dvh; }
  #app.game-mode .legacy-modal { width:calc(100vw - 24px); max-height:calc(100dvh - 30px - env(safe-area-inset-top) - env(safe-area-inset-bottom)); border-radius:16px; }
}
@media (max-width:390px) {
  #app.game-mode .hud-resource-chip { flex-basis:88px; gap:4px; padding-inline:4px; }
  #app.game-mode .hud-resource-value { font-size:11px; }
  #app.game-mode .hud-resource-rate { font-size:9px; }
  #app.game-mode .hud-quick-actions button { width:32px; min-width:30px; height:32px; }
}
@media (prefers-reduced-transparency: reduce) {
  #app.game-mode #game-hud > .legacy-resource-hud,#app.game-mode #game-hud > .hud,#app.game-mode .cell-dock { backdrop-filter:none; background:#102638; }
}


/* Stage 10.0.2 — explicit feedback for direct surface actions. */
.cell-action-feedback { margin-top:8px; padding:8px 9px; border-radius:6px; font-size:11px; line-height:1.4; border:1px solid rgba(92,205,164,.35); background:rgba(34,112,86,.16); color:#a5f0d0; }
.cell-action-feedback.is-error { border-color:rgba(255,135,117,.42); background:rgba(140,48,43,.18); color:#ffc0b5; }
@media (max-width:600px) { .cell-action-feedback { font-size:10px; padding:7px; } }


/* Stage 10.0.8 — mining operation diagnostics */
.cell-mining-ops { display:flex; flex-direction:column; gap:5px; margin:7px 0; padding:9px 10px; border:1px solid rgba(115,169,205,.25); border-radius:9px; background:rgba(32,65,88,.18); color:#b8d0dc; }
.cell-mining-ops>b { color:#8fc4d9; letter-spacing:.06em; }
.cell-mining-ops-total { color:#d9edf4; }
.cell-mining-ops p { margin:2px 0 0; color:#a9c1cb; line-height:1.4; }


.mining-logistics-card{display:flex;flex-direction:column;gap:5px;margin:7px 0;padding:8px 9px;border:1px solid rgba(126,190,132,.3);border-radius:8px;background:linear-gradient(120deg,rgba(34,70,52,.36),rgba(17,35,49,.35));color:#b8d3c1}.mining-logistics-card>b{color:#a5e0b4;letter-spacing:.06em}.mining-logistics-row{display:flex;justify-content:space-between;align-items:center;gap:8px;padding:4px 0;border-bottom:1px solid rgba(150,190,160,.12)}.mining-logistics-row span:first-child{display:flex;flex-direction:column;gap:2px}.mining-logistics-row small{color:#9bb7a5}.mining-logistics-row>span:last-child{font-weight:700;color:#c8e8d0;white-space:nowrap}
`;

export function bindStyles(doc: Document = document): void {
  if (doc.getElementById('voronia2-styles')) return;
  const style = doc.createElement('style');
  style.id = 'voronia2-styles';
  style.textContent = CSS;
  doc.head.appendChild(style);
}

