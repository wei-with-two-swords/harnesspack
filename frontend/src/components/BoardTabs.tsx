import { Link } from 'react-router-dom';

export const BOARD_TABS = [
  { id: 'velocity', label: '竞速', hint: '今日新增 star' },
  { id: 'growth', label: '增速', hint: '7 / 30 日涨幅' },
  { id: 'total', label: '总榜', hint: 'star 总量' },
  { id: 'darkhorse', label: '黑马', hint: '名次跃升' },
  { id: 'rookie', label: '新秀', hint: '30 天内新建' },
  { id: 'quality', label: '含金量', hint: '剔除异常日后的真实日均增速' },
  { id: 'npm', label: '下载', hint: 'npm 包下载量，star 仅作对照' },
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
