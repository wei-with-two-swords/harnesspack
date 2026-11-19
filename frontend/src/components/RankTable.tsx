import { Link } from 'react-router-dom';
import type { RankingItem } from '../types';
import { DeltaBadge } from './DeltaBadge';
import { formatNumber, formatPercent } from '../lib/format';

function rankDelta(item: RankingItem): number | null {
  if (item.prev_rank === null) return null;
  return item.prev_rank - item.rank;
}

function ExtraCell({ item, board }: { item: RankingItem; board: string }) {
  if (board === 'growth') {
    return (
      <span className="num text-teal">
        {item.growth === null ? '—' : `+${formatPercent(item.growth)}`}
      </span>
    );
  }
  if (board === 'darkhorse') {
    const jump = item.growth ?? 0;
    return (
      <span className={`num ${jump > 0 ? 'text-rise' : jump < 0 ? 'text-fall' : 'text-muted'}`}>
        {jump > 0 ? `↑${jump}` : jump < 0 ? `↓${Math.abs(jump)}` : '—'}
      </span>
    );
  }
  const delta = rankDelta(item);
  return (
    <span
      className={`num ${delta === null ? 'text-muted' : delta > 0 ? 'text-rise' : delta < 0 ? 'text-fall' : 'text-muted'}`}
      title={item.prev_rank ? `上次第 ${item.prev_rank} 名` : '暂无上次排名'}
    >
      {delta === null ? 'NEW' : delta === 0 ? '—' : delta > 0 ? `↑${delta}` : `↓${Math.abs(delta)}`}
    </span>
  );
}

export function RankTable({ items, board }: { items: RankingItem[]; board: string }) {
  return (
    <div className="card overflow-hidden">
      <table className="w-full border-collapse text-sm">
        <thead className="border-b border-line bg-raise/40 text-left text-xs uppercase tracking-wider text-muted">
          <tr>
            <th className="w-14 px-4 py-3 text-center">#</th>
            <th className="px-2 py-3">插件</th>
            <th className="px-2 py-3 text-right">Star</th>
            <th className="hidden px-2 py-3 text-right sm:table-cell">今日</th>
            <th className="px-4 py-3 text-right">
              {board === 'growth' ? '区间增速' : board === 'darkhorse' ? '名次变化' : '排名变化'}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-line/60">
          {items.map((item) => (
            <tr key={item.slug} className="group transition hover:bg-raise/40">
              <td className="px-4 py-3 text-center">
                <span
                  className={`num text-sm ${
                    item.rank === 1
                      ? 'font-semibold text-gold'
                      : item.rank <= 3
                        ? 'text-gold/80'
                        : 'text-muted'
                  }`}
                >
                  {item.rank}
                </span>
              </td>
              <td className="px-2 py-3">
                <Link to={`/plugins/${item.slug}`} className="block hover:text-teal">
                  <span className="font-medium text-white group-hover:text-teal">{item.name}</span>
                  <span className="ml-2 text-xs text-muted">
                    {item.owner}/{item.repo}
                  </span>
                  {item.description ? (
                    <span className="mt-0.5 hidden truncate text-xs text-muted sm:block">
                      {item.description}
                    </span>
                  ) : null}
                </Link>
              </td>
              <td className="num px-2 py-3 text-right text-body">{formatNumber(item.stars)}</td>
              <td className="hidden px-2 py-3 text-right sm:table-cell">
                <DeltaBadge value={item.delta} anomaly={item.is_anomaly} />
              </td>
              <td className="px-4 py-3 text-right">
                <ExtraCell item={item} board={board} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
