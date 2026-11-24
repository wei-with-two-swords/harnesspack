import { Link } from 'react-router-dom';
import type { PluginListItem } from '../types';
import { useI18n, categoryLabel, categoryDescription } from '../lib/i18n';
import { formatCompact, formatDate, formatNumber } from '../lib/format';
import { Avatar, RankMedal } from './RankTable';

/** Directory list using the same row layout as the STAR / NPM boards. */
export function PluginList({
  items,
  sort,
  offset = 0,
}: {
  items: PluginListItem[];
  sort: 'stars' | 'downloads';
  offset?: number;
}) {
  const { t, lang } = useI18n();
  const byDownloads = sort === 'downloads';

  return (
    <ul className="list-group list-group-flush">
      {items.map((item, index) => (
        <li key={item.slug} className="rank-row list-group-item p-0">
          <Link to={`/plugins/${item.slug}`} className="rank-link">
            <RankMedal rank={offset + index + 1} />
            <Avatar owner={item.owner} />
            <span className="rank-main">
              <span className="rank-name">
                <strong className="truncate">{item.name}</strong>
                <span className="rank-owner">{item.owner}/{item.repo}</span>
              </span>
              {item.description ? <span className="rank-desc">{item.description}</span> : null}
              <span className="rank-meta">
                {item.category ? (
                  <span className="badge" title={categoryDescription(lang, item.category)}>
                    {categoryLabel(lang, item.category)}
                  </span>
                ) : null}
                {item.repo_created_at ? (
                  <span className="fs-xs fg-secondary">{t('plugin.created')} {formatDate(item.repo_created_at)}</span>
                ) : null}
                {byDownloads ? (
                  <span className="num text-xs fg-secondary" title="STAR">
                    STAR {formatCompact(item.stars, lang)}
                  </span>
                ) : null}
              </span>
            </span>
            <span className="rank-value">
              {byDownloads ? formatCompact(item.downloads, lang) : formatNumber(item.stars)}
              <small>{byDownloads ? t('table.downloads') : t('table.stars')}</small>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}
