import { useState } from 'react';
import { Link } from 'react-router-dom';
import type { RankingItem } from '../types';
import { DeltaBadge } from './DeltaBadge';
import { formatCompact, formatNumber, formatPercent } from '../lib/format';
import { useI18n, categoryLabel, categoryDescription } from '../lib/i18n';

function rankDelta(item: RankingItem): number | null {
  if (item.prev_rank === null || item.prev_rank === undefined) return null;
  return item.prev_rank - item.rank;
}

function RankMedal({ rank }: { rank: number }) {
  const tone = rank === 1 ? ' gold' : rank === 2 ? ' silver' : rank === 3 ? ' bronze' : '';
  return <span className={`rank-medal${tone}`}>{rank}</span>;
}

function Avatar({ owner }: { owner: string }) {
  const [failed, setFailed] = useState(false);
  if (failed || !owner) {
    return (
      <span className="rank-avatar inline-flex items-center justify-center text-xs fw-semibold" aria-hidden="true">
        {owner.charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      className="rank-avatar"
      src={`https://github.com/${encodeURIComponent(owner)}.png?size=64`}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
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
  const delta = rankDelta(item);
  if (!hasPrev) return <span className="fg-secondary">—</span>;
  return (
    <span className={`num ${delta === null ? 'fg-secondary' : delta > 0 ? 'fg-success' : delta < 0 ? 'fg-danger' : 'fg-secondary'}`}
      title={item.prev_rank ? `${item.prev_rank}` : t('table.new')}>
      {delta === null ? t('table.new') : delta === 0 ? '—' : delta > 0 ? `↑${delta}` : `↓${Math.abs(delta)}`}
    </span>
  );
}

/** Single vertical ranking list shared by desktop and mobile. */
export function RankTable({ items, board }: { items: RankingItem[]; board: string }) {
  const { t, lang } = useI18n();
  const compact = (v: number | null | undefined) => formatCompact(v, lang);
  const isNpm = board === 'npm';
  const hasPrev = !isNpm || items.some((i) => i.has_prev === true);
  const showChange = !(isNpm && !hasPrev);

  return (
    <ul className="list-group list-group-flush">
      {items.map((item) => (
        <li key={item.slug} className="rank-row list-group-item p-0">
          <Link to={`/plugins/${item.slug}`} className="rank-link">
            <RankMedal rank={item.rank} />
            <Avatar owner={item.owner} />
            <span className="rank-main">
              <span className="rank-name">
                <strong className="truncate">{item.name}</strong>
                <span className="rank-owner">{item.owner}/{item.repo}</span>
              </span>
              {item.description ? <span className="rank-desc">{item.description}</span> : null}
              <span className="rank-meta">
                {item.category ? (
                  <span className="badge" title={categoryDescription(lang, item.category)}>{categoryLabel(lang, item.category)}</span>
                ) : null}
                {isNpm
                  ? <span className="num text-xs fg-secondary" title="GitHub star">★ {compact(item.stars)}</span>
                  : <DeltaBadge value={item.delta} anomaly={item.is_anomaly} />}
                {showChange ? <ExtraCell item={item} board={board} hasPrev={hasPrev} /> : null}
              </span>
            </span>
            <span className="rank-value">
              {isNpm ? compact(item.downloads) : formatNumber(item.stars)}
              <small>{isNpm ? t('table.downloads') : t('table.stars')}</small>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
