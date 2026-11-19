const nf = new Intl.NumberFormat('zh-CN');

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return nf.format(value);
}

export function formatCompact(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  if (Math.abs(value) >= 10000) {
    const units = ['', '万', '亿'];
    let v = value;
    let i = 0;
    while (Math.abs(v) >= 10000 && i < units.length - 1) {
      v /= 10000;
      i += 1;
    }
    return `${v.toFixed(v >= 100 ? 0 : 1)}${units[i]}`;
  }
  return nf.format(value);
}

export function formatDelta(value: number | null | undefined): string {
  if (value === null || value === undefined) return '—';
  return value > 0 ? `+${nf.format(value)}` : nf.format(value);
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined) return '—';
  return `${(value * 100).toFixed(digits)}%`;
}

export const CATEGORY_LABELS: Record<string, string> = {
  ui: 'UI',
  context: '上下文',
  model: '模型',
  search: '搜索',
  channel: '渠道',
  media: '媒体',
  skin: '皮肤',
  market: '市场',
  tools: '工具',
  workflow: '工作流',
  other: '其他',
};

export function categoryLabel(slug: string | null | undefined): string {
  if (!slug) return '其他';
  return CATEGORY_LABELS[slug] ?? slug;
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(`${iso.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'UTC',
  }).format(d);
}

export function daysSince(iso: string | null | undefined, today: string | null | undefined): string {
  if (!iso || !today) return '';
  const start = new Date(`${iso.slice(0, 10)}T00:00:00Z`).getTime();
  const end = new Date(`${today.slice(0, 10)}T00:00:00Z`).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return '';
  const days = Math.max(0, Math.round((end - start) / 86_400_000));
  return `${days} 天`;
}
