import { Link } from 'react-router-dom';
import type { RankingItem } from '../types';
import { DeltaBadge } from './DeltaBadge';
import { formatCompact, formatNumber, formatPercent } from '../lib/format';
import { useI18n } from '../lib/i18n';

function rankDelta(item: RankingItem): number | null {
  if (item.prev_rank === null || item.prev_rank === undefined) return null;
  return item.prev_rank - item.rank;
}

function RankLabel({ rank }: { rank: number }) {
  return (
    <span className={`num fs-sm ${rank === 1 ? 'fw-semibold fg-warning' : rank <= 3 ? 'fg-warning' : 'fg-secondary'}`}>
      {rank}
    </span>
  );
}

function ExtraCell({ item, board, hasPrev }: { item: RankingItem; board: string; hasPrev: boolean }) {
  const { t } = useI18n();
  if (board === 'growth') {
    return <span className="num fg-info">{item.growth === null ? '—' : `+${formatPercent(item.growth)}`}</span>;
  }
  if (board === 'quality') {
    return (
      <span className="num fg-info" title={`${item.observed_days ?? 0}/${item.anomaly_days ?? 0}`}>
        {item.growth === null || item.growth === undefined ? '—' : `+${formatNumber(Math.round(item.growth))}/d`}
      </span>
    );
  }
  if (board === 'darkhorse') {
    const jump = item.growth ?? 0;
    return <span className={`num ${jump > 0 ? 'fg-success' : jump < 0 ? 'fg-danger' : 'fg-secondary'}`}>
      {jump > 0 ? `↑${jump}` : jump < 0 ? `↓${Math.abs(jump)}` : '—'}
    </span>;
  }
  // npm or velocity: rank change; when no baseline, show NEW/—
  const delta = rankDelta(item);
  if (!hasPrev) return <span className="fg-secondary">—</span>;
  return (
    <span className={`num ${delta === null ? 'fg-secondary' : delta > 0 ? 'fg-success' : delta < 0 ? 'fg-danger' : 'fg-secondary'}`}
      title={item.prev_rank ? `${item.prev_rank}` : t('table.new')}>
      {delta === null ? t('table.new') : delta === 0 ? '—' : delta > 0 ? `↑${delta}` : `↓${Math.abs(delta)}`}
    </span>
  );
}

function extraLabel(board: string, hasPrev: boolean): string {
  const { t } = useI18n();
  if (board === 'growth') return t('table.delta');
  if (board === 'darkhorse') return t('table.change');
  if (board === 'quality') return t('table.delta');
  return hasPrev ? t('table.change') : '—';
}

export function RankTable({ items, board }: { items: RankingItem[]; board: string }) {
  const { t, lang } = useI18n();
  const compact = (v: number | null | undefined) => formatCompact(v, lang);
  const isNpm = board === 'npm';
  const hasPrev = !isNpm || items.some((i) => i.has_prev === true);
  const showChange = !(isNpm && !hasPrev);

  return (
    <>
      <ul className="list-group list-group-flush sm:d-none">
        {items.map((item) => (
          <li key={item.slug} className="list-group-item list-group-item-action p-0">
            <Link to={`/plugins/${item.slug}`} className="d-flex align-items-center gap-3 px-4 py-3 text-decoration-none">
              <span className="flex-shrink-0 text-center" style={{ width: '1.5rem' }}><RankLabel rank={item.rank} /></span>
              <span className="min-w-0 flex-grow-1">
                <span className="d-block text-truncate fw-medium">{item.name}</span>
                <span className="d-block text-truncate fs-xs fg-secondary">{item.owner}/{item.repo}</span>
                <span className="mt-1 d-flex align-items-center gap-2 fs-xs">
                  {isNpm ? <span className="num fg-secondary" title="GitHub star">★ {compact(item.stars)}</span>
                    : <DeltaBadge value={item.delta} anomaly={item.is_anomaly} />}
                  {showChange ? <ExtraCell item={item} board={board} hasPrev={hasPrev} /> : null}
                </span>
              </span>
              <span className="num fg-body flex-shrink-0 fs-sm">
                {isNpm ? compact(item.downloads) : formatNumber(item.stars)}
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="table-responsive d-none sm:d-block">
        <table className="table table-hover align-middle mb-0 table-fixed">
          <thead className="fs-xs text-uppercase fg-secondary">
            <tr>
              <th className="px-4 py-3 text-center" style={{ width: '3.5rem' }}>#</th>
              <th className="px-2 py-3 fw-medium">{t('table.plugin')}</th>
              <th className="px-2 py-3 text-end fw-medium" style={{ width: '7rem' }}>
                {isNpm ? t('table.downloads') : t('table.stars')}
              </th>
              <th className="px-2 py-3 text-end fw-medium" style={{ width: '6rem' }}>
                {isNpm ? t('table.stars') : t('table.delta')}
              </th>
              {showChange ? (
                <th className="px-4 py-3 text-end fw-medium" style={{ width: '6rem' }}>{extraLabel(board, hasPrev)}</th>
              ) : null}
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.slug}>
                <td className="px-4 py-3 text-center"><RankLabel rank={item.rank} /></td>
                <td className="px-2 py-3">
                  <Link to={`/plugins/${item.slug}`} className="d-block min-w-0 text-decoration-none">
                    <span className="d-flex align-items-baseline gap-2">
                      <span className="text-truncate fw-medium">{item.name}</span>
                      <span className="flex-shrink-0 text-truncate fs-xs fg-secondary">{item.owner}/{item.repo}</span>
                    </span>
                    {item.description ? <span className="mt-1 d-block text-truncate fs-xs fg-secondary">{item.description}</span> : null}
                  </Link>
                </td>
                <td className="num px-2 py-3 text-end">
                  {isNpm ? compact(item.downloads) : formatNumber(item.stars)}
                </td>
                <td className="px-2 py-3 text-end">
                  {isNpm ? <span className="num fg-secondary">{compact(item.stars)}</span>
                    : <DeltaBadge value={item.delta} anomaly={item.is_anomaly} />}
                </td>
                {showChange ? (
                  <td className="px-4 py-3 text-end"><ExtraCell item={item} board={board} hasPrev={hasPrev} /></td>
                ) : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
