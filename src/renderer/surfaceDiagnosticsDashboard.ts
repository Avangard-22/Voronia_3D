import type { SurfaceDiagnosticSnapshot } from './surfaceDiagnostics';
import type { SurfaceStabilityMonitor } from './surfaceStabilityMonitor';

export interface SurfaceDiagnosticsDashboard {
  readonly visible: boolean;
  toggle(): void;
  update(snapshot: SurfaceDiagnosticSnapshot, monitor: SurfaceStabilityMonitor): void;
  dispose(): void;
}

/** Opt-in developer HUD. Uses DOM text nodes only; it does not enter the WebGL scene. */
export function createSurfaceDiagnosticsDashboard(host: HTMLElement): SurfaceDiagnosticsDashboard {
  const panel = document.createElement('section');
  panel.setAttribute('aria-label', 'Surface diagnostics');
  panel.setAttribute('role', 'region');
  panel.hidden = true;
  Object.assign(panel.style, {
    position: 'fixed', right: '12px', bottom: '12px', zIndex: '10000', width: 'min(360px, calc(100vw - 24px))',
    maxHeight: 'min(70vh, 560px)', overflow: 'auto', padding: '12px', boxSizing: 'border-box',
    color: '#dcecff', background: 'rgba(7, 13, 25, .94)', border: '1px solid rgba(130, 190, 255, .45)',
    borderRadius: '10px', boxShadow: '0 8px 32px rgba(0,0,0,.4)', font: '12px/1.45 ui-monospace, SFMono-Regular, Menlo, monospace',
  });
  const title = document.createElement('div');
  title.textContent = 'VORONIA · SURFACE DIAGNOSTICS';
  title.style.cssText = 'font-weight:700;letter-spacing:.08em;margin-bottom:8px;color:#9ed8ff';
  const summary = document.createElement('pre');
  summary.style.cssText = 'white-space:pre-wrap;margin:0 0 8px';
  const chartLabel = document.createElement('div');
  chartLabel.textContent = 'MEMORY HISTORY';
  chartLabel.style.cssText = 'font-weight:700;margin:8px 0 4px;color:#9ed8ff';
  const chart = document.createElement('div');
  chart.setAttribute('aria-label', 'Estimated memory history');
  chart.style.cssText = 'height:44px;display:flex;align-items:flex-end;gap:2px;border-bottom:1px solid #49617d;padding:2px 0';
  const alertsTitle = document.createElement('div');
  alertsTitle.textContent = 'STABILITY ALERTS';
  alertsTitle.style.cssText = 'font-weight:700;margin:8px 0 4px;color:#9ed8ff';
  const alerts = document.createElement('div');
  const hint = document.createElement('div');
  hint.textContent = 'F3 — показать / скрыть';
  hint.style.cssText = 'opacity:.65;margin-top:8px';
  panel.append(title, summary, chartLabel, chart, alertsTitle, alerts, hint);
  host.append(panel);
  let isVisible = false;

  const toggle = (): void => { isVisible = !isVisible; panel.hidden = !isVisible; };
  const onKey = (event: KeyboardEvent): void => { if (event.key === 'F3') { event.preventDefault(); toggle(); } };
  window.addEventListener('keydown', onKey);

  return {
    get visible() { return isVisible; },
    toggle,
    update(snapshot, monitor) {
      if (!isVisible) return;
      const mb = (bytes: number): string => `${(bytes / 1024 / 1024).toFixed(1)} MB`;
      summary.textContent = [
        `Session ${(snapshot.sessionMs / 1000).toFixed(0)} s · budget ${mb(snapshot.budgetBytes)}`,
        `Resident ${mb(snapshot.totalBytes)} · peak ${mb(snapshot.peakBytes)}`,
        `Resources ${snapshot.resources.base + snapshot.resources.decorative + snapshot.resources.staging}  [base ${snapshot.resources.base} / deco ${snapshot.resources.decorative} / staging ${snapshot.resources.staging}]`,
        `Bytes  base ${mb(snapshot.bytes.base)} · deco ${mb(snapshot.bytes.decorative)} · staging ${mb(snapshot.bytes.staging)}`,
        `Loads ${snapshot.registered} · releases ${snapshot.released} · evictions ${snapshot.evicted}`,
        `Duplicates ${snapshot.duplicateRegistrations} · lifecycle delta ${snapshot.lifecycleImbalance}`,
      ].join('\n');
      const history = monitor.getHistory();
      const max = Math.max(1, ...history.map((item) => item.totalBytes));
      chart.replaceChildren(...history.map((item) => {
        const bar = document.createElement('span');
        bar.title = mb(item.totalBytes);
        bar.style.cssText = `display:block;flex:1;min-width:2px;height:${Math.max(2, item.totalBytes / max * 40)}px;background:${item.totalBytes > snapshot.budgetBytes ? '#ff6b6b' : '#56b6d9'}`;
        return bar;
      }));
      const recent = monitor.getAlerts().slice(-5).reverse();
      alerts.replaceChildren(...(recent.length ? recent.map((alert) => {
        const line = document.createElement('div');
        line.textContent = `${alert.severity.toUpperCase()}: ${alert.message}`;
        line.style.color = alert.severity === 'critical' ? '#ff8585' : '#ffd27a';
        return line;
      }) : [Object.assign(document.createElement('div'), { textContent: 'Нет предупреждений.' })]));
    },
    dispose() { window.removeEventListener('keydown', onKey); panel.remove(); isVisible = false; },
  };
}
