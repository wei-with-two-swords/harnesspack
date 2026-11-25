import { ChevronsLeft, ChevronsRight } from 'lucide-react';
import { formatNumber } from '../lib/format';

interface PagerProps {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
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

export function Pager({ page, pageSize, total, onChange }: PagerProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;

  const clamp = (next: number) => Math.min(Math.max(next, 0), pages - 1);
  const go = (next: number) => {
    const target = clamp(next);
    if (target === page) return;
    onChange(target);
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  };

  const from = page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);

  return (
    <div className="mt-4 d-flex flex-column sm:flex-row align-items-center justify-content-between gap-2 fs-sm fg-secondary">
      <span className="num">
        第 {formatNumber(from)}–{formatNumber(to)} 条 / 共 {formatNumber(total)} 条
      </span>
      <nav aria-label="分页">
        <ul className="pagination pagination-sm mb-0 flex-wrap">
          <li className={`page-item${page === 0 ? ' disabled' : ''}`}>
            <button
              type="button"
              className="page-link"
              disabled={page === 0}
              onClick={() => go(0)}
              aria-label="第一页"
            >
              <ChevronsLeft aria-hidden="true" />
            </button>
          </li>
          <li className={`page-item${page === 0 ? ' disabled' : ''}`}>
            <button
              type="button"
              className="page-link"
              disabled={page === 0}
              onClick={() => go(page - 1)}
            >
              上一页
            </button>
          </li>
          {pageItems(page, pages).map((item, index) =>
            item === null ? (
              <li key={`gap-${index}`} className="page-item disabled">
                <span className="page-link">…</span>
              </li>
            ) : (
              <li key={item} className={`page-item${item === page ? ' active' : ''}`}>
                <button
                  type="button"
                  className="page-link num"
                  aria-current={item === page ? 'page' : undefined}
                  onClick={() => go(item)}
                >
                  {item + 1}
                </button>
              </li>
            ),
          )}
          <li className={`page-item${page >= pages - 1 ? ' disabled' : ''}`}>
            <button
              type="button"
              className="page-link"
              disabled={page >= pages - 1}
              onClick={() => go(page + 1)}
            >
              下一页
            </button>
          </li>
          <li className={`page-item${page >= pages - 1 ? ' disabled' : ''}`}>
            <button
              type="button"
              className="page-link"
              disabled={page >= pages - 1}
              onClick={() => go(pages - 1)}
              aria-label="最后一页"
            >
              <ChevronsRight aria-hidden="true" />
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
