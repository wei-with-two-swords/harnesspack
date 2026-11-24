import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../lib/i18n';

export type View =
  | { kind: 'star'; board: string; window?: number }
  | { kind: 'npm'; range: string }
  | { kind: 'category'; category: string }
  | { kind: 'directory'; sort: 'stars' | 'downloads' | 'category' };

const STAR_BOARDS = ['velocity', 'growth', 'total', 'darkhorse', 'rookie', 'quality'];
const NPM_RANGES = ['1y', 'ytd', '24h', '7d', '30d'];

export function viewToUrl(view: View): string {
  switch (view.kind) {
    case 'star': return `/?board=${view.board}${view.window ? `&window=${view.window}` : ''}`;
    case 'npm': return `/?board=npm&range=${view.range}`;
    case 'category': return `/?board=category${view.category ? `&category=${view.category}` : ''}`;
    case 'directory': return `/?view=directory&sort=${view.sort}`;
  }
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="catalog-group">
      <button
        type="button"
        className="catalog-group-title d-flex align-items-center justify-content-between"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span>{title}</span>
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"
          style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>
          <path d="M6 3l5 5-5 5z" />
        </svg>
      </button>
      {open ? <div className="catalog-group-items">{children}</div> : null}
    </div>
  );
}

export function CatalogSidebar({ view }: { view: View }) {
  const { t } = useI18n();
  const [mobileOpen, setMobileOpen] = useState(false);
  const isStar = (board: string) => view.kind === 'star' && view.board === board;
  const isNpm = (range: string) => view.kind === 'npm' && view.range === range;

  return (
    <nav className="catalog-sidebar card" aria-label={t('catalog.title')}>
      <button
        type="button"
        className="catalog-sidebar-head d-flex align-items-center justify-content-between"
        aria-expanded={mobileOpen}
        onClick={() => setMobileOpen((v) => !v)}
      >
        <span className="fs-sm fw-semibold">{t('catalog.title')}</span>
        <svg className="catalog-mobile-caret" width="12" height="12" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true"
          style={{ transform: mobileOpen ? 'rotate(90deg)' : 'none', transition: 'transform .15s' }}>
          <path d="M6 3l5 5-5 5z" />
        </svg>
      </button>
      <div className={`catalog-body${mobileOpen ? ' mobile-open' : ''}`}>

      <Group title={t('catalog.star')}>
        {STAR_BOARDS.map((board) => (
          <Link key={board} to={viewToUrl({ kind: 'star', board })}
            className={`catalog-link${isStar(board) ? ' active' : ''}`}>
            {t(`board.${board}`)}
          </Link>
        ))}
        <Link to={viewToUrl({ kind: 'category', category: '' })}
          className={`catalog-link${view.kind === 'category' ? ' active' : ''}`}>
          {t('board.category')}
        </Link>
      </Group>

      <Group title={t('catalog.npm')}>
        {NPM_RANGES.map((range) => (
          <Link key={range} to={viewToUrl({ kind: 'npm', range })}
            className={`catalog-link${isNpm(range) ? ' active' : ''}`}>
            {t(`board.npm.${range}`)}
          </Link>
        ))}
      </Group>

      <Group title={t('catalog.directory')}>
        <Link to={viewToUrl({ kind: 'directory', sort: 'stars' })}
          className={`catalog-link${view.kind === 'directory' && view.sort === 'stars' ? ' active' : ''}`}>
          {t('catalog.sortStars')} ↓
        </Link>
        <Link to={viewToUrl({ kind: 'directory', sort: 'downloads' })}
          className={`catalog-link${view.kind === 'directory' && view.sort === 'downloads' ? ' active' : ''}`}>
          {t('catalog.sortDownloads')} ↓
        </Link>
        <Link to={viewToUrl({ kind: 'directory', sort: 'category' })}
          className={`catalog-link${view.kind === 'directory' && view.sort === 'category' ? ' active' : ''}`}>
          {t('catalog.categories')}
        </Link>
      </Group>
      </div>
    </nav>
  );
}
