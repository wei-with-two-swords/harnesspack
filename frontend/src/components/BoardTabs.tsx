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
    <div className="flex flex-wrap gap-1 rounded-xl border border-line bg-surface/60 p-1">
      {BOARD_TABS.map((tab) => (
        <Link
          key={tab.id}
          to={`/rankings/${tab.id}`}
          className={`rounded-lg px-3 py-2 text-sm transition ${
            active === tab.id
              ? 'bg-raise text-white shadow-sm'
              : 'text-muted hover:bg-raise/60 hover:text-body'
          }`}
          title={tab.hint}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
