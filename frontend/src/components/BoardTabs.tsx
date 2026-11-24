import { Link } from 'react-router-dom';

export const BOARD_TABS = [
  { id: 'velocity', label: '近 24 小时', hint: '最近 24 小时新增 STAR' },
  { id: 'growth', label: '区间增速', hint: '7 / 30 日涨幅' },
  { id: 'total', label: '总榜', hint: 'STAR 总量' },
  { id: 'darkhorse', label: '名次', hint: '近 7 天总榜名次提升' },
  { id: 'rookie', label: '最新', hint: '30 天内新建' },
  { id: 'quality', label: '稳健', hint: '近 30 天剔除异常日后的真实日均增速' },
  { id: 'npm', label: 'NPM', hint: 'npm 包下载量，STAR 仅作对照' },
] as const;

export function BoardTabs({ active }: { active: string }) {
  return (
    <ul className="nav nav-tabs flex-nowrap overflow-x-auto nav-scroll mb-3" aria-label="榜单切换">
      {BOARD_TABS.map((tab) => (
        <li key={tab.id} className="nav-item">
          <Link
            to={`/rankings/${tab.id}`}
            className={`nav-link text-nowrap${active === tab.id ? ' active' : ''}`}
            title={tab.hint}
          >
            {tab.label}
          </Link>
        </li>
      ))}
    </ul>
  );
}
