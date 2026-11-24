import { useEffect, useState } from 'react';

export type Lang = 'en' | 'zh';

const STORAGE_KEY = 'harnesspack-lang';
export const LANG_EVENT = 'harnesspack:langchange';

export function readLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'en' || stored === 'zh') return stored;
  } catch {
    // ignore
  }
  return 'en';
}

export function applyLang(lang: Lang): void {
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    // ignore
  }
  document.documentElement.setAttribute('lang', lang === 'zh' ? 'zh-CN' : 'en');
  window.dispatchEvent(new CustomEvent<Lang>(LANG_EVENT, { detail: lang }));
}

export function useLang(): Lang {
  const [lang, setLang] = useState<Lang>(() => readLang());
  useEffect(() => {
    const onChange = (event: Event) => setLang((event as CustomEvent<Lang>).detail);
    window.addEventListener(LANG_EVENT, onChange);
    return () => window.removeEventListener(LANG_EVENT, onChange);
  }, []);
  return lang;
}

type Dict = Record<string, string>;

const en: Dict = {
  // nav
  'nav.rankings': 'Rankings',
  'nav.community': 'Community',
  'nav.api': 'API',
  'nav.theme': 'Toggle theme',
  'nav.lang': 'Switch language',
  'nav.menu': 'Menu',
  'nav.signin': 'Sign in with GitHub',
  // footer
  'footer.note': 'Plugin list from awesome-dsh-plugin; star data from the public GitHub API.',
  'footer.unofficial': 'Unofficial project',
  'footer.data': 'Data methods',
  'footer.api': 'API',
  'footer.status': 'Status',
  'footer.terms': 'Terms',
  'footer.sponsors': 'Sponsors',
  'footer.changelog': 'Changelog',
  'footer.compare': 'Compare',
  'footer.about': 'About',
  'footer.repo': 'Repository',
  'footer.sitemap': 'Sitemap',
  'footer.feed': 'XML feed',
  // hero
  'hero.title': 'Plugin Rankings',
  'hero.lead': 'Track community DeepSeek Harness plugins by real GitHub stars and npm downloads. Daily snapshots, no embellishment.',
  'hero.tracked': 'Plugins tracked',
  'hero.updated': 'Updated',
  // catalog sidebar
  'catalog.title': 'Catalog',
  'catalog.star': 'STAR Rankings',
  'catalog.npm': 'NPM Downloads',
  'catalog.directory': 'Plugin Directory',
  'catalog.categories': 'Categories',
  'catalog.sortStars': 'Sort by Stars',
  'catalog.sortDownloads': 'Sort by Downloads',
  'catalog.sortAsc': 'Ascending',
  'catalog.sortDesc': 'Descending',
  'catalog.all': 'All categories',
  // boards
  'board.velocity': '24H',
  'board.growth': 'Growth',
  'board.window7': '7D',
  'board.window30': '30D',
  'board.total': 'All-Time',
  'board.darkhorse': 'Top Climbers',
  'board.rookie': 'New Releases',
  'board.quality': 'Steady Growth',
  'board.category': 'Category Board',
  'board.npm': 'Downloads',
  'board.npm.24h': 'Last 24H',
  'board.npm.7d': 'Last 7 Days',
  'board.npm.30d': 'Last 30 Days',
  'board.npm.1y': 'Last Year',
  'board.npm.ytd': 'Year to Date',
  // board descriptions
  'desc.velocity': 'Ranked by today\'s new stars — the difference between adjacent snapshots.',
  'desc.growth': 'Ranked by 7 or 30 day growth; only plugins with a baseline of 50+ stars are counted.',
  'desc.total': 'Ranked by current total stars, ties broken by name.',
  'desc.darkhorse': 'Ranked by overall-rank improvement within the window — who is quietly climbing.',
  'desc.rookie': 'Plugins created in the last 30 days with at least 10 stars.',
  'desc.quality': 'Ranked by average daily growth after excluding anomalous single-day spikes.',
  'desc.category': 'Browse plugins by category, ranked by stars.',
  'desc.npm': 'Ranked by npm registry package downloads. Stars are shown for reference only; the two metrics are never combined.',
  // table
  'table.rank': 'Rank',
  'table.plugin': 'Plugin',
  'table.stars': 'Stars',
  'table.change': 'Change',
  'table.downloads': 'Downloads',
  'table.category': 'Category',
  'table.delta': '24h Δ',
  'table.new': 'NEW',
  'table.view': 'View',
  'table.sort': 'Sort',
  'table.period': 'Period',
  // npm notice
  'npm.notice': 'Downloads are npm tarball downloads (includes CI, mirrors and dependencies) — not user installs. Plugins without an npm package are excluded, not counted as zero.',
  'npm.lastActive': 'Latest complete day',
  'npm.coverage': 'Coverage',
  // common
  'common.window7': 'Last 7 days',
  'common.window30': 'Last 30 days',
  'common.loading': 'Loading…',
  'common.retry': 'Retry',
  'common.noData': 'No data available.',
  'common.results': 'results',
  'common.search': 'Search plugins',
  'common.searchPlaceholder': 'Search by name, owner or keyword…',
  'common.close': 'Close',
  'common.backToTop': 'Back to top',
  // community
  'community.title': 'Community',
  'community.soon': 'Coming soon',
  'community.intro': 'Sign in with GitHub to join the conversation. Commenting will be available in a future release.',
  'community.loginNote': 'GitHub sign-in and comments are not enabled yet.',
  // api page
  'api.title': 'API',
  'api.intro': 'All endpoints are public and require no authentication. Base URL:',
  'api.method': 'Method',
  'api.path': 'Path',
  'api.description': 'Description',
  'api.tryIt': 'OpenAPI docs',
  'api.ep.health': 'Health check: plugin count, snapshot count, latest date',
  'api.ep.dashboard': 'Homepage aggregate: KPIs + 24H/growth/total/new-releases',
  'api.ep.categories': 'Category index: seats, total stars, top 3 per category',
  'api.ep.rankings': 'Boards: velocity|growth|total|darkhorse|rookie|quality|npm; supports window=7|30, range=24h|7d|30d|1y|ytd (npm), category, limit, offset',
  'api.ep.plugins': 'Plugin directory: query, category, sort=stars|downloads|name|recent, limit, offset',
  'api.ep.plugin': 'Plugin detail: current stars, board ranks, same-category peers',
  'api.ep.series': 'Time series: days=1..365, daily count/delta/is_anomaly',
  'api.ep.compare': 'Compare: slugs=a,b,c (2-5) and days',
  'api.ep.changelog': 'List changes: additions/removals/changes from each upstream sync',
};

const zh: Dict = {
  'nav.rankings': '榜单',
  'nav.community': '社区',
  'nav.api': 'API',
  'nav.theme': '切换主题',
  'nav.lang': '切换语言',
  'nav.menu': '菜单',
  'nav.signin': '使用 GitHub 登录',
  'footer.note': 'HarnessPack 的名单来自 awesome-dsh-plugin 清单，star 数据来自 GitHub 公开 API。',
  'footer.unofficial': '非官方项目',
  'footer.data': '数据口径',
  'footer.api': 'API',
  'footer.status': '数据状态',
  'footer.terms': '使用条款',
  'footer.sponsors': '推荐位',
  'footer.changelog': '变更日志',
  'footer.compare': '插件对比',
  'footer.about': '关于',
  'footer.repo': '仓库',
  'footer.sitemap': '站点地图',
  'footer.feed': 'XML 订阅',
  'hero.title': '插件榜单',
  'hero.lead': '收录社区 DeepSeek Harness 插件，按真实 GitHub star 与 npm 下载量排名。每日快照，不美化、不回填。',
  'hero.tracked': '收录插件',
  'hero.updated': '更新于',
  'catalog.title': '目录',
  'catalog.star': 'STAR 榜',
  'catalog.npm': 'NPM 下载榜',
  'catalog.directory': '插件目录',
  'catalog.categories': '分类',
  'catalog.sortStars': '按 Star 排序',
  'catalog.sortDownloads': '按下载量排序',
  'catalog.sortAsc': '升序',
  'catalog.sortDesc': '降序',
  'catalog.all': '全部分类',
  'board.velocity': '24H',
  'board.growth': '区间增速',
  'board.window7': '7D',
  'board.window30': '30D',
  'board.total': '总榜',
  'board.darkhorse': '名次跃升',
  'board.rookie': '最新发布',
  'board.quality': '稳健增长',
  'board.category': '分类榜',
  'board.npm': '下载榜',
  'board.npm.24h': '近 24 小时',
  'board.npm.7d': '近 7 天',
  'board.npm.30d': '近 30 天',
  'board.npm.1y': '近 1 年',
  'board.npm.ytd': '年至今',
  'desc.velocity': '按今日新增 star 排序：相邻两次快照的差值，谁涨得最快。',
  'desc.growth': '按近 7 天或 30 天涨幅排序：只统计基准日 star 不低于 50 的插件。',
  'desc.total': '按当前 star 总量排序，并列时按名称升序。',
  'desc.darkhorse': '按区间内总榜名次跃升幅度排序，谁在悄悄爬升。',
  'desc.rookie': '最近 30 天新建、且 star 不低于 10 的在册插件。',
  'desc.quality': '剔除异常单日涨幅后，按剩余天数的日均新增排序。',
  'desc.category': '按分类浏览插件，默认按 star 排序。',
  'desc.npm': '按 npm registry 包下载量排序，star 仅作对照，两种数据不合并。',
  'table.rank': '排名',
  'table.plugin': '插件',
  'table.stars': 'Star',
  'table.change': '变化',
  'table.downloads': '下载量',
  'table.category': '分类',
  'table.delta': '24h 增量',
  'table.new': '新上榜',
  'table.view': '查看',
  'table.sort': '排序',
  'table.period': '周期',
  'npm.notice': '下载量为 npm tarball 下载数（含 CI、镜像与依赖），并非真实安装量；无 npm 包的插件不在榜内，不计为 0。',
  'npm.lastActive': '最近完整数据日',
  'npm.coverage': '覆盖包数',
  'common.window7': '近 7 天',
  'common.window30': '近 30 天',
  'common.loading': '加载中…',
  'common.retry': '重试',
  'common.noData': '暂无数据。',
  'common.results': '条结果',
  'common.search': '搜索插件',
  'common.searchPlaceholder': '按名称、作者或关键词搜索…',
  'common.close': '关闭',
  'common.backToTop': '回到顶部',
  'community.title': '社区',
  'community.soon': '即将开放',
  'community.intro': '使用 GitHub 账号登录参与讨论，评论功能将在后续版本开放。',
  'community.loginNote': 'GitHub 登录与评论功能尚未启用。',
  'api.title': 'API',
  'api.intro': '所有接口公开、无需鉴权。基础地址：',
  'api.method': '方法',
  'api.path': '路径',
  'api.description': '说明',
  'api.tryIt': 'OpenAPI 文档',
  'api.ep.health': '健康检查：插件数、快照数、最新日期',
  'api.ep.dashboard': '首页聚合：KPI + 24H/区间增速/总榜/最新发布',
  'api.ep.categories': '分类索引：每类席位、总 star、Top 3',
  'api.ep.rankings': '榜单：velocity|growth|total|darkhorse|rookie|quality|npm；支持 window=7|30、range=24h|7d|30d|1y|ytd（npm）、category、limit、offset',
  'api.ep.plugins': '插件库：query、category、sort=stars|downloads|name|recent、limit、offset',
  'api.ep.plugin': '插件详情：当前 star、各榜名次、同分类 peers',
  'api.ep.series': '曲线：days=1..365，返回每日 count/delta/is_anomaly',
  'api.ep.compare': '对比：slugs=a,b,c（2-5 个）与 days',
  'api.ep.changelog': '名单变更：上游清单每次同步的新增/移除/变更',
};

export function translate(lang: Lang, key: string): string {
  return (lang === 'zh' ? zh : en)[key] ?? key;
}

/** Hook returning a t() function bound to the current language. */
export function useI18n() {
  const lang = useLang();
  return { lang, t: (key: string) => translate(lang, key) };
}

/** Resolve category labels for display (categories are lowercase slugs). */
export function categoryLabel(lang: Lang, slug: string): string {
  const map: Record<string, [string, string]> = {
    agi: ['AGI', 'AGI'],
    browser: ['Browser', '浏览器'],
    dev: ['Dev', '开发'],
    docs: ['Docs', '文档'],
    fun: ['Fun', '娱乐'],
    git: ['Git', 'Git'],
    identity: ['Identity', '身份'],
    market: ['Market', '市场'],
    memory: ['Memory', '记忆'],
    model: ['Model', '模型'],
    notify: ['Notify', '通知'],
    remote: ['Remote', '远程'],
    security: ['Security', '安全'],
    session: ['Session', '会话'],
    skill: ['Skill', '技能'],
    theme: ['Theme', '主题'],
    tools: ['Tools', '工具'],
    ui: ['UI', 'UI'],
    usage: ['Usage', '用量'],
    vision: ['Vision', '视觉'],
    voice: ['Voice', '语音'],
    workflow: ['Workflow', '工作流'],
    wsl: ['WSL', 'WSL'],
  };
  const pair = map[slug];
  return pair ? (lang === 'zh' ? pair[1] : pair[0]) : slug;
}
