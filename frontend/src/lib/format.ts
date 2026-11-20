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
  tools: '工具',
  session: '会话',
  workflow: '工作流',
  usage: '用量',
  dev: '开发',
  model: '模型',
  memory: '记忆',
  theme: '主题',
  skill: '技能',
  notify: '通知',
  fun: '趣味',
  remote: '远程',
  security: '安全',
  browser: '浏览器',
  docs: '文档',
  vision: '视觉',
  git: 'Git',
  voice: '语音',
  market: '市场',
  identity: '身份',
  agi: 'AGI',
  wsl: 'WSL',
  context: '上下文',
  search: '搜索',
  channel: '渠道',
  media: '媒体',
  skin: '皮肤',
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
