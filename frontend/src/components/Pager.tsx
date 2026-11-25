import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { formatNumber } from '../lib/format';
import { useI18n } from '../lib/i18n';

interface PagerProps {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
  /** Inner lists usually want to stay in place; full-page tables scroll to top. */
  scrollOnChange?: boolean;
}

/** Page numbers to render: first/last plus a small window around the current page. */
function pageItems(page: number, pages: number): (number | null)[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, index) => index);
  const start = Math.min(Math.max(page - 1, 1), pages - 4);
  const items: (number | null)[] = [0];
  if (start > 1) items.push(null);
  for (let index = start; index < start + 3; index += 1) items.push(index);
  if (start + 2 < pages - 2) items.push(null);
  items.push(pages - 1);
  return items;
}

export function Pager({ page, pageSize, total, onChange, scrollOnChange = true }: PagerProps) {
  const { t } = useI18n();
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;

  const clamp = (next: number) => Math.min(Math.max(next, 0), pages - 1);
  // The caller may pass a page beyond the last one (e.g. total shrank or a
  // stale offset in the URL). Clamp every display value so the range never
  // shows from > to or an out-of-bounds active page.
  const current = clamp(page);
  const go = (next: number) => {
    const target = clamp(next);
    if (target === current) return;
    onChange(target);
    if (scrollOnChange && typeof window !== 'undefined') window.scrollTo({ top: 0 });
  };

  const from = current * pageSize + 1;
  const to = Math.min(total, (current + 1) * pageSize);

  return (
    <div className="mt-4 d-flex flex-column sm:flex-row align-items-center justify-content-between gap-2 fs-sm fg-secondary">
      <span className="num">
        {t('pager.range', { from: formatNumber(from), to: formatNumber(to), total: formatNumber(total) })}
      </span>
      <nav aria-label={t('pager.nav')}>
        <ul className="pagination pagination-sm mb-0 flex-wrap">
          <li className={`page-item${current === 0 ? ' disabled' : ''}`}>
            <button
              type="button"
              className="page-link"
              disabled={current === 0}
              onClick={() => go(0)}
              aria-label={t('pager.first')}
            >
              <ChevronsLeft aria-hidden="true" />
            </button>
          </li>
          <li className={`page-item${current === 0 ? ' disabled' : ''}`}>
            <button
              type="button"
              className="page-link"
              disabled={current === 0}
              onClick={() => go(current - 1)}
            >
              {t('pager.prev')}
            </button>
          </li>
          {pageItems(current, pages).map((item, index) =>
            item === null ? (
              <li key={`gap-${index}`} className="page-item disabled">
                <span className="page-link">…</span>
              </li>
            ) : (
              <li key={item} className={`page-item${item === current ? ' active' : ''}`}>
                <button
                  type="button"
                  className="page-link num"
                  aria-current={item === current ? 'page' : undefined}
                  onClick={() => go(item)}
                >
                  {item + 1}
                </button>
              </li>
            ),
          )}
          <li className={`page-item${current >= pages - 1 ? ' disabled' : ''}`}>
            <button
              type="button"
              className="page-link"
              disabled={current >= pages - 1}
              onClick={() => go(current + 1)}
            >
              {t('pager.next')}
            </button>
          </li>
          <li className={`page-item${current >= pages - 1 ? ' disabled' : ''}`}>
            <button
              type="button"
              className="page-link"
              disabled={current >= pages - 1}
              onClick={() => go(pages - 1)}
              aria-label={t('pager.last')}
            >
              <ChevronsRight aria-hidden="true" />
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
