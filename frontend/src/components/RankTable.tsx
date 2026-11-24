import { Link } from 'react-router-dom';
import type { RankingItem } from '../types';
import { DeltaBadge } from './DeltaBadge';
import { formatCompact, formatNumber, formatPercent } from '../lib/format';

function rankDelta(item: RankingItem): number | null {
  if (item.prev_rank === null || item.prev_rank === undefined) return null;
  return item.prev_rank - item.rank;
}

function RankLabel({ rank }: { rank: number }) {
  return (
    <span
      className={`num fs-sm ${
        rank === 1 ? 'fw-semibold fg-warning' : rank <= 3 ? 'fg-warning' : 'fg-secondary'
      }`}
    >
      {rank}
    </span>
  );
}

function ExtraCell({ item, board }: { item: RankingItem; board: string }) {
  if (board === 'growth') {
    return (
      <span className="num fg-info">
        {item.growth === null ? '—' : `+${formatPercent(item.growth)}`}
      </span>
    );
  }
  if (board === 'quality') {
    return (
      <span
        className="num fg-info"
        title={`${item.observed_days ?? 0} 天样本，${item.anomaly_days ?? 0} 天异常`}
      >
        {item.growth === null || item.growth === undefined
          ? '—'
          : `+${formatNumber(Math.round(item.growth))}/天`}
      </span>
    );
  }
  if (board === 'darkhorse') {
    const jump = item.growth ?? 0;
    return (
      <span className={`num ${jump > 0 ? 'fg-success' : jump < 0 ? 'fg-danger' : 'fg-secondary'}`}>
        {jump > 0 ? `↑${jump}` : jump < 0 ? `↓${Math.abs(jump)}` : '—'}
      </span>
    );
  }
  const delta = rankDelta(item);
  return (
    <span
      className={`num ${delta === null ? 'fg-secondary' : delta > 0 ? 'fg-success' : delta < 0 ? 'fg-danger' : 'fg-secondary'}`}
      title={item.prev_rank ? `上次第 ${item.prev_rank} 名` : '上一窗口无下载'}
    >
      {delta === null ? 'NEW' : delta === 0 ? '—' : delta > 0 ? `↑${delta}` : `↓${Math.abs(delta)}`}
    </span>
  );
}

function extraLabel(board: string): string {
  return board === 'growth'
    ? '区间增速'
    : board === 'darkhorse'
      ? '名次变化'
      : board === 'quality'
        ? '真实日均'
        : '排名变化';
}

export function RankTable({ items, board }: { items: RankingItem[]; board: string }) {
  const isNpm = board === 'npm';
  return (
    <>
      <ul className="list-group list-group-flush sm:d-none">
        {items.map((item) => (
          <li key={item.slug} className="list-group-item list-group-item-action p-0">
            <Link
              to={`/plugins/${item.slug}`}
              className="d-flex align-items-center gap-3 px-4 py-3 text-decoration-none"
            >
              <span className="flex-shrink-0 text-center" style={{ width: '1.5rem' }}>
                <RankLabel rank={item.rank} />
              </span>
              <span className="min-w-0 flex-grow-1">
                <span className="d-block text-truncate fw-medium">{item.name}</span>
                <span className="d-block text-truncate fs-xs fg-secondary">
                  {item.owner}/{item.repo}
                </span>
                <span className="mt-1 d-flex align-items-center gap-2 fs-xs">
                  {isNpm ? (
                    <span className="num fg-secondary" title="对照：GitHub star">
                      ★ {formatCompact(item.stars)}
                    </span>
                  ) : (
                    <DeltaBadge value={item.delta} anomaly={item.is_anomaly} />
                  )}
                  <ExtraCell item={item} board={board} />
                </span>
              </span>
              <span className="num fg-body flex-shrink-0 fs-sm">
                {isNpm ? formatCompact(item.downloads) : formatNumber(item.stars)}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="table-responsive d-none sm:d-block">
        <table className="table table-hover align-middle mb-0 table-fixed">
          <thead className="fs-xs text-uppercase fg-secondary">
            <tr>
              <th className="px-4 py-3 text-center" style={{ width: '3.5rem' }}>
                #
              </th>
              <th className="px-2 py-3 fw-medium">插件</th>
              <th className="px-2 py-3 text-end fw-medium" style={{ width: '7rem' }}>
                {isNpm ? '下载量' : 'Star'}
              </th>
              <th className="px-2 py-3 text-end fw-medium" style={{ width: '6rem' }}>
                {isNpm ? '对照 Star' : '今日'}
              </th>
              <th className="px-4 py-3 text-end fw-medium" style={{ width: '6rem' }}>
                {extraLabel(board)}
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.slug}>
                <td className="px-4 py-3 text-center">
                  <RankLabel rank={item.rank} />
                </td>
                <td className="px-2 py-3">
                  <Link to={`/plugins/${item.slug}`} className="d-block min-w-0 text-decoration-none">
                    <span className="d-flex align-items-baseline gap-2">
                      <span className="text-truncate fw-medium">{item.name}</span>
                      <span className="flex-shrink-0 text-truncate fs-xs fg-secondary">
                        {item.owner}/{item.repo}
                      </span>
                    </span>
                    {item.description ? (
                      <span className="mt-1 d-block text-truncate fs-xs fg-secondary">
                        {item.description}
                      </span>
                    ) : null}
                  </Link>
                </td>
                <td className="num px-2 py-3 text-end">
                  {isNpm ? formatCompact(item.downloads) : formatNumber(item.stars)}
                </td>
                <td className="px-2 py-3 text-end">
                  {isNpm ? (
                    <span className="num fg-secondary" title="GitHub star，仅作对照">
                      {formatCompact(item.stars)}
                    </span>
                  ) : (
                    <DeltaBadge value={item.delta} anomaly={item.is_anomaly} />
                  )}
                </td>
                <td className="px-4 py-3 text-end">
                  <ExtraCell item={item} board={board} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
