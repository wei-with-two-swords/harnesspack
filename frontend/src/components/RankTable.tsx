import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { RankingItem } from '../types';
import { formatCompact, formatDate, formatDelta, formatNumber, formatPercent } from '../lib/format';
import { useI18n, categoryLabel, categoryDescription } from '../lib/i18n';

type Translate = (key: string) => string;
type Focus = { value: ReactNode; label: string; tone?: 'success' | 'danger' };

function rankDelta(item: RankingItem): number | null {
  if (item.prev_rank === null || item.prev_rank === undefined) return null;
  return item.prev_rank - item.rank;
}

export function RankMedal({ rank }: { rank: number }) {
  const tone = rank === 1 ? ' gold' : rank === 2 ? ' silver' : rank === 3 ? ' bronze' : '';
  return <span className={`rank-medal${tone}`}>{rank}</span>;
}

export function Avatar({ owner, size = 32 }: { owner: string; size?: number }) {
  const [failed, setFailed] = useState(false);
  const style = { width: size, height: size };
  if (failed || !owner) {
    return (
      <span className="rank-avatar inline-flex items-center justify-center text-xs fw-semibold" style={style} aria-hidden="true">
        {owner.charAt(0).toUpperCase()}
      </span>
    );
  }
  return (
    <img
      className="rank-avatar"
      style={style}
      src={`https://github.com/${encodeURIComponent(owner)}.png?size=${Math.max(64, size * 2)}`}
      alt=""
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

/** Rank movement in the previous snapshot's ranking. */
function RankChange({ item, t }: { item: RankingItem; t: Translate }) {
  const delta = rankDelta(item);
  const title = item.prev_rank ? `${t('table.rank')} ${item.prev_rank}` : t('table.new');
  const tone = delta === null ? 'fg-secondary' : delta > 0 ? 'fg-success' : delta < 0 ? 'fg-danger' : 'fg-secondary';
  const text = delta === null
    ? t('table.new')
    : delta === 0
      ? '—'
      : delta > 0
        ? `↑${delta}`
        : `↓${Math.abs(delta)}`;
  return <span className={`num ${tone}`} title={title}>{text}</span>;
}

/** Rank improvement used by the Movers board. */
function RankJump({ value }: { value: number | null }) {
  if (value === null || value === 0) return <span className="fg-secondary">—</span>;
  const tone = value > 0 ? 'fg-success' : 'fg-danger';
  return <span className={`num ${tone}`}>{value > 0 ? `↑${value}` : `↓${Math.abs(value)}`}</span>;
}

/** npm rows keep the historical compact rank-change meta. */
function ExtraCell({ item, hasPrev, t }: { item: RankingItem; hasPrev: boolean; t: Translate }) {
  if (!hasPrev) return <span className="fg-secondary">—</span>;
  return <RankChange item={item} t={t} />;
}

function primaryFocus(
  item: RankingItem,
  board: string,
  window: number,
  lang: 'en' | 'zh',
  t: Translate,
): Focus {
  switch (board) {
    case 'velocity': {
      const value = item.delta;
      return {
        value: formatDelta(value),
        label: t('table.delta'),
        tone: value === null ? undefined : value > 0 ? 'success' : value < 0 ? 'danger' : undefined,
      };
    }
    case 'growth': {
      const value = item.growth;
      return {
        value: value === null || value === undefined ? '—' : `${value > 0 ? '+' : ''}${formatPercent(value)}`,
        label: window === 30 ? t('common.window30') : t('common.window7'),
        tone: value === null || value === undefined ? undefined : value > 0 ? 'success' : value < 0 ? 'danger' : undefined,
      };
    }
    case 'darkhorse':
      return { value: <RankJump value={item.growth ?? null} />, label: t('table.rankJump') };
    case 'rookie':
      return { value: formatDate(item.repo_created_at), label: t('plugin.created') };
    case 'quality': {
      const value = item.growth;
      const rounded = value === null || value === undefined ? null : Math.round(value);
      return {
        value: rounded === null
          ? '—'
          : `${rounded > 0 ? '+' : ''}${formatNumber(rounded)}${lang === 'zh' ? '/天' : '/d'}`,
        label: t('table.avgGrowth'),
        tone: rounded === null ? undefined : rounded > 0 ? 'success' : rounded < 0 ? 'danger' : undefined,
      };
    }
    case 'npm':
      return { value: formatCompact(item.downloads, lang), label: t('table.downloads') };
    default:
      return { value: formatNumber(item.stars), label: t('table.stars') };
  }
}

/** Single vertical ranking list shared by desktop and mobile. */
export function RankTable({
  items,
  board,
  window,
}: {
  items: RankingItem[];
  board: string;
  window?: number | string | null;
}) {
  const { t, lang } = useI18n();
  const compact = (v: number | null | undefined) => formatCompact(v, lang);
  const isNpm = board === 'npm';
  const hasPrev = !isNpm || items.some((i) => i.has_prev === true);
  const showChange = !(isNpm && !hasPrev);
  const activeWindow = window === 30 || window === '30' ? 30 : 7;

  return (
    <ul className="list-group list-group-flush">
      {items.map((item) => {
        const categoryBadge = item.category ? (
          <span className="badge" title={categoryDescription(lang, item.category)}>{categoryLabel(lang, item.category)}</span>
        ) : null;
        const starRef = (
          <span className="num text-xs fg-secondary" title={t('table.stars')}>STAR {compact(item.stars)}</span>
        );
        const focus = primaryFocus(item, board, activeWindow, lang, t);
        const secondary = isNpm ? (
          <>
            {starRef}
            {showChange ? <ExtraCell item={item} hasPrev={hasPrev} t={t} /> : null}
          </>
        ) : board === 'darkhorse' || board === 'rookie' || board === 'quality'
          ? starRef
          : <RankChange item={item} t={t} />;

        return (
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
              </span>
              <span className="rank-category">{categoryBadge}</span>
              <span className="rank-secondary">{secondary}</span>
              <span className="rank-value">
                <span className={focus.tone ? `fg-${focus.tone}` : ''}>{focus.value}</span>
                <small>{focus.label}</small>
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
