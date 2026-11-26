import type uPlot from 'uplot';

/**
 * Hover tooltip shared by all uPlot charts. Returned hooks are merged into
 * the chart opts; the tooltip attaches to the chart's own wrapper (made
 * position:relative via CSS class), renders the date plus one colored row
 * per series, and follows the cursor with edge clamping.
 */
export interface TooltipSeries {
  label: string;
  color: string;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function dayLabel(ts: number): string {
  return new Date(ts * 1000).toISOString().slice(0, 10);
}

function valueLabel(value: number): string {
  return new Intl.NumberFormat('en-US').format(Math.round(value));
}

export function tooltipHooks(series: TooltipSeries[]): uPlot.Hooks.Arrays {
  let tip: HTMLDivElement | null = null;
  let wrapper: HTMLElement | null = null;

  const ensure = (u: uPlot) => {
    wrapper = (u.root.querySelector('.u-wrap') as HTMLElement | null) ?? null;
    if (!wrapper) return;
    wrapper.classList.add('u-wrap-tip');
    tip = document.createElement('div');
    tip.className = 'chart-tip';
    tip.style.display = 'none';
    wrapper.appendChild(tip);
  };

  const hide = () => {
    if (tip) tip.style.display = 'none';
  };

  const render = (u: uPlot) => {
    if (!tip || !wrapper) return;
    const idx = u.cursor.idx;
    if (idx == null || !u.data[0]?.length) {
      hide();
      return;
    }
    const rows = series
      .map((s, i) => {
        const value = u.data[i + 1]?.[idx];
        if (value == null) return '';
        return (
          `<div class="chart-tip-row">` +
          `<span class="chart-tip-dot" style="background:${s.color}"></span>` +
          `<span class="chart-tip-label">${escapeHtml(s.label)}</span>` +
          `<b class="chart-tip-value">${valueLabel(value)}</b></div>`
        );
      })
      .join('');
    if (!rows) {
      hide();
      return;
    }
    tip.innerHTML = `<div class="chart-tip-date">${dayLabel(u.data[0][idx] * 1000)}</div>${rows}`;
    tip.style.display = 'block';

    const x0 = u.cursor.left ?? 0;
    const y0 = u.cursor.top ?? 0;
    const maxLeft = wrapper.clientWidth - tip.offsetWidth - 4;
    const left = x0 + 14 > maxLeft ? x0 - tip.offsetWidth - 14 : x0 + 14;
    const top = Math.max(4, Math.min(y0 - tip.offsetHeight / 2, wrapper.clientHeight - tip.offsetHeight - 4));
    tip.style.left = `${Math.max(4, left)}px`;
    tip.style.top = `${top}px`;
  };

  const cleanup = () => {
    tip?.remove();
    tip = null;
    wrapper?.classList.remove('u-wrap-tip');
    wrapper = null;
  };

  return {
    ready: [ensure],
    setCursor: [render],
    destroy: [cleanup],
  };
}
