import { Link } from 'react-router-dom';
import { useI18n, categoryLabel } from '../lib/i18n';
import { viewToUrl, type View } from './CatalogSidebar';

const STAR_BOARDS = ['velocity', 'growth', 'total', 'darkhorse', 'rookie', 'quality'];
const NPM_RANGES = ['1y', 'ytd', '24h', '7d', '30d'];

type Chip = { key: string; label: string; to: string };

/** Two-level switcher: tabs for STAR / NPM / directory, chips for each board. */
export function BoardSwitcher({ view, categories }: { view: View; categories: string[] }) {
  const { t, lang } = useI18n();
  const tab = view.kind === 'npm' ? 'npm' : view.kind === 'directory' ? 'directory' : 'star';

  const tabs: Chip[] = [
    {
      key: 'star',
      label: t('catalog.star'),
      to: viewToUrl({ kind: 'star', board: view.kind === 'star' ? view.board : 'total' }),
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
    ...STAR_BOARDS.map((board) => ({
      key: board,
      label: t(`board.${board}`),
      to: viewToUrl({ kind: 'star', board }),
    })),
    { key: 'category', label: t('board.category'), to: viewToUrl({ kind: 'category', category: '' }) },
  ];
  const npmChips: Chip[] = NPM_RANGES.map((range) => ({
    key: range,
    label: t(`board.npm.${range}`),
    to: viewToUrl({ kind: 'npm', range }),
  }));
  const dirChips: Chip[] = [
    { key: 'stars', label: `${t('catalog.sortStars')} ↓`, to: viewToUrl({ kind: 'directory', sort: 'stars' }) },
    { key: 'downloads', label: `${t('catalog.sortDownloads')} ↓`, to: viewToUrl({ kind: 'directory', sort: 'downloads' }) },
    { key: 'category', label: t('catalog.categories'), to: viewToUrl({ kind: 'directory', sort: 'category' }) },
  ];

  const chips = tab === 'npm' ? npmChips : tab === 'directory' ? dirChips : starChips;
  const activeChip = tab === 'npm' && view.kind === 'npm' ? view.range
    : tab === 'directory' && view.kind === 'directory' ? view.sort
    : view.kind === 'category' ? 'category'
    : view.kind === 'star' ? view.board
    : '';
  const showCategories = view.kind === 'category' || (view.kind === 'directory' && view.sort === 'category');

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
      </div>

      <div className="switch-chips mt-3">
        {chips.map((chip) => (
          <Link
            key={chip.key}
            to={chip.to}
            className={`switch-chip${chip.key === activeChip ? ' active' : ''}`}
          >
            {chip.label}
          </Link>
        ))}
      </div>

      {showCategories ? (
        <div className="switch-chips mt-2">
          <Link
            to={viewToUrl({ kind: 'category', category: '' })}
            className={`switch-chip${view.kind === 'category' && !view.category ? ' active' : ''}`}
          >
            {t('catalog.all')}
          </Link>
          {categories.map((cat) => (
            <Link
              key={cat}
              to={viewToUrl({ kind: 'category', category: cat })}
              className={`switch-chip${view.kind === 'category' && view.category === cat ? ' active' : ''}`}
            >
              {categoryLabel(lang, cat)}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}
