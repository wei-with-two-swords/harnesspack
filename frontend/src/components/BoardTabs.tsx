import { Link } from 'react-router-dom';

export const BOARD_TABS = [
  { id: 'velocity', label: '竞速', hint: '今日新增 star' },
  { id: 'growth', label: '增速', hint: '7 / 30 日涨幅' },
  { id: 'total', label: '总榜', hint: 'star 总量' },
  { id: 'darkhorse', label: '黑马', hint: '名次跃升' },
  { id: 'rookie', label: '新秀', hint: '30 天内新建' },
  { id: 'quality', label: '含金量', hint: '剔除异常日后的真实日均增速' },
] as const;

export function BoardTabs({ active }: { active: string }) {
  return (
    <div className="card-header px-3 pt-2 pb-0">
      <ul className="nav nav-tabs card-header-tabs flex-nowrap overflow-x-auto nav-scroll">
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
    </div>
  );
}
