/**
 * ui/styles.ts — инлайновые стили среза (без внешних ресурсов: single-file сборка ≤6 МБ, ADR/ТЗ).
 */
const CSS = `
:root { color-scheme: dark; }
body { margin: 0; background: #0b0f14; color: #dfe7ee; font: 14px/1.45 system-ui, sans-serif; }
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
.selected-cell { max-width: 480px; margin: 8px auto 14px; padding: 10px; border: 1px solid #6b6040; border-radius: 10px; background: linear-gradient(145deg, rgba(39,35,24,.8), rgba(14,21,29,.9)); }
.selected-cell h2 { margin-top: 0; color: #f0d58a; }
.selection-empty { padding: 12px; color: #91a6b8; text-align: center; }
.selected-cell .cell { background: transparent; border: 0; padding: 2px; min-height: 0; }
.board { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 8px; margin: 14px 0; }
.cell { border: 1px solid #223243; border-radius: 8px; padding: 8px; background: #101821; min-height: 64px; }
.cell.hidden { color: #3a4c5e; display: flex; align-items: center; justify-content: center; font-size: 20px; }
.cell.revealed { border-style: dashed; }
.cell.explored.t4 { border-color: #6c4d8f; }
.cell .ic { font-size: 16px; }
.cell small { color: #8aa0b4; display: block; }
.vein { font-size: 12px; color: #b9cede; margin: 4px 0; }
.cool { font-size: 12px; color: #e0b45c; }
.journal { border-top: 1px solid #223243; margin-top: 8px; }
.tx { font-size: 12px; color: #9fb4c6; padding: 1px 0; }
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
.scene3d { position: relative; width: min(56vh, 480px); height: min(56vh, 480px); margin: 0 auto 10px; }
.scene3d canvas { width: 100%; height: 100%; display: block; touch-action: none; cursor: grab; }
.view-controls { position: absolute; left: 8px; bottom: 8px; display: flex; gap: 5px; }
.view-controls button { width: 36px; height: 36px; padding: 0; font-size: 19px; background: rgba(10,18,27,.82); border-color: #456078; }
@media (max-width: 600px) { #app { padding: 8px; } .scene3d { width: min(76vw, 54vh, 420px); height: min(76vw, 54vh, 420px); } .galaxy3d-scene { height:min(62vh,500px); min-height:280px; } .hud { gap: 12px; } .hud .col { min-width: min(100%, 280px); flex: 1 1 100%; } .board { grid-template-columns: repeat(auto-fill, minmax(132px, 1fr)); } .selected-cell { max-width: none; } button { min-height: 34px; } }
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
.logistics-amount { display:flex; align-items:center; gap:8px; margin:6px 0; color:#9ec3d6; font-size:12px; }
.logistics-amount input { width:90px; background:#0b1721; color:#dcecf5; border:1px solid #355268; border-radius:5px; padding:5px; }
.logistics-rows { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:6px; margin:7px 0; }
.logistics-row { border:1px solid #29495b; border-radius:7px; padding:7px; background:rgba(9,23,34,.72); }
.logistics-row b,.logistics-row small { display:block; }
.logistics-row small { color:#91adbb; font-size:10px; margin:3px 0 5px; }
.logistics-row div { display:flex; gap:4px; flex-wrap:wrap; }
.logistics-row button { font-size:11px; padding:3px 6px; }

.galaxy-progression { display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:7px; margin:7px 0; }
.progression-stage { border:1px solid #29495b; border-radius:8px; padding:8px; background:rgba(9,23,34,.72); }
.progression-stage.complete { border-color:#3d9b91; background:rgba(20,62,62,.35); }
.progression-stage b,.progression-stage small { display:block; }
.progression-stage b { color:#d6f4ff; font-size:12px; }
.progression-stage small { color:#91adbb; font-size:10px; margin-top:4px; line-height:1.4; }
`;

export function bindStyles(doc: Document = document): void {
  if (doc.getElementById('voronia2-styles')) return;
  const style = doc.createElement('style');
  style.id = 'voronia2-styles';
  style.textContent = CSS;
  doc.head.appendChild(style);
}
