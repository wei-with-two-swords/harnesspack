import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { useI18n, categoryLabel, categoryDescription } from '../lib/i18n';
import { viewToUrl, type View } from './CatalogSidebar';

const STAR_7D = { board: 'growth' as const, window: 7 };
const STAR_30D = { board: 'growth' as const, window: 30 };
const NPM_RANGES = ['1y', 'ytd', '24h', '7d', '30d'];

type Chip = { key: string; label: string; to: string; hint?: string };

/** Two-level switcher: tabs for STAR / NPM / directory, chips for each board. */
export function BoardSwitcher({ view, categories, actions }: {
  view: View;
  categories: string[];
  /** Optional right-aligned actions (copy view / exports) inside the tab row. */
  actions?: ReactNode;
}) {
  const { t, lang } = useI18n();
  const tab = view.kind === 'npm' ? 'npm' : view.kind === 'directory' ? 'directory' : 'star';

  const tabs: Chip[] = [
    {
      key: 'star',
      label: t('catalog.star'),
      to: viewToUrl({
        kind: 'star',
        board: view.kind === 'star' ? view.board : 'total',
        window: view.kind === 'star' ? view.window : undefined,
      }),
    },
    {
      key: 'npm',
      label: t('catalog.npm'),
      to: viewToUrl({ kind: 'npm', range: view.kind === 'npm' ? view.range : '1y' }),
    },
    {
      key: 'directory',
      label: t('catalog.directory'),
      to: viewToUrl({ kind: 'directory', sort: view.kind === 'directory' ? view.sort : 'stars' }),
    },
  ];

  const starChips: Chip[] = [
    { key: 'total', label: t('board.total'), to: viewToUrl({ kind: 'star', board: 'total' }), hint: t('desc.total') },
    { key: 'velocity', label: t('board.velocity'), to: viewToUrl({ kind: 'star', board: 'velocity' }), hint: t('desc.velocity') },
    { key: 'growth7', label: t('board.window7'), to: viewToUrl({ kind: 'star', ...STAR_7D }), hint: t('desc.growth') },
    { key: 'growth30', label: t('board.window30'), to: viewToUrl({ kind: 'star', ...STAR_30D }), hint: t('desc.growth') },
    { key: 'darkhorse', label: t('board.darkhorse'), to: viewToUrl({ kind: 'star', board: 'darkhorse' }), hint: t('desc.darkhorse') },
    { key: 'rookie', label: t('board.rookie'), to: viewToUrl({ kind: 'star', board: 'rookie' }), hint: t('desc.rookie') },
    { key: 'quality', label: t('board.quality'), to: viewToUrl({ kind: 'star', board: 'quality' }), hint: t('desc.quality') },
    { key: 'category', label: t('board.category'), to: viewToUrl({ kind: 'category', category: '' }), hint: t('desc.category') },
  ];
  const npmChips: Chip[] = NPM_RANGES.map((range) => ({
    key: range,
    label: t(`board.npm.${range}`),
    to: viewToUrl({ kind: 'npm', range }),
    hint: t('desc.npm'),
  }));
  const dirChips: Chip[] = [
    { key: 'stars', label: t('catalog.sortStars'), to: viewToUrl({ kind: 'directory', sort: 'stars' }) },
    { key: 'downloads', label: t('catalog.sortDownloads'), to: viewToUrl({ kind: 'directory', sort: 'downloads' }) },
    { key: 'category', label: t('catalog.categories'), to: viewToUrl({ kind: 'directory', sort: 'category' }) },
  ];

  const chips = tab === 'npm' ? npmChips : tab === 'directory' ? dirChips : starChips;
  const activeChip = tab === 'npm' && view.kind === 'npm' ? view.range
    : tab === 'directory' && view.kind === 'directory' ? view.sort
    : view.kind === 'category' ? 'category'
    : view.kind === 'star'
      ? (view.board === 'growth' ? `growth${view.window === 30 ? '30' : '7'}` : view.board)
      : '';
  const showCategories = view.kind === 'category' || (view.kind === 'directory' && view.sort === 'category');
  const inDirectoryCategory = view.kind === 'directory' && view.sort === 'category';
  const dirCategory = inDirectoryCategory && view.kind === 'directory' ? (view.category ?? '') : '';
  const categoryHref = (cat: string) => inDirectoryCategory
    ? viewToUrl({ kind: 'directory', sort: 'category', category: cat })
    : viewToUrl({ kind: 'category', category: cat });
  const categoryActive = (cat: string) => inDirectoryCategory
    ? dirCategory === cat
    : view.kind === 'category' && view.category === cat;

  return (
    <div className="mb-4">
      <div className="switch-tabs" role="tablist" aria-label={t('catalog.title')}>
        {tabs.map((item) => (
          <Link
            key={item.key}
            to={item.to}
            role="tab"
            aria-selected={item.key === tab}
            className={`switch-tab${item.key === tab ? ' active' : ''}`}
          >
            {item.label}
          </Link>
        ))}
        {actions ? <div className="switch-tabs-actions">{actions}</div> : null}
      </div>

      <div className="switch-chips mt-3">
        {chips.map((chip) => (
          <Link
            key={chip.key}
            to={chip.to}
            title={chip.hint}
            className={`switch-chip${chip.key === activeChip ? ' active' : ''}`}
          >
            {chip.label}
          </Link>
        ))}
      </div>

      {showCategories ? (
        <div className="switch-chips mt-2">
          <Link
            to={categoryHref('')}
            title={categoryDescription(lang, 'all')}
            className={`switch-chip${categoryActive('') ? ' active' : ''}`}
          >
            {t('catalog.all')}
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat}
              to={categoryHref(cat)}
              title={categoryDescription(lang, cat)}
              className={`switch-chip${categoryActive(cat) ? ' active' : ''}`}
            >
              {categoryLabel(lang, cat)}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
