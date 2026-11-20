interface PagerProps {
  page: number;
  pageSize: number;
  total: number;
  onChange: (page: number) => void;
}

export function Pager({ page, pageSize, total, onChange }: PagerProps) {
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) return null;
  const from = page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);
  return (
    <div className="mt-4 d-flex flex-column sm:flex-row align-items-center justify-content-between gap-2 fs-sm fg-secondary">
      <span className="num">
        {from}–{to} / {total}
      </span>
      <nav aria-label="分页">
        <ul className="pagination pagination-sm mb-0">
          <li className={`page-item${page === 0 ? ' disabled' : ''}`}>
            <button type="button" className="page-link" disabled={page === 0} onClick={() => onChange(page - 1)}>
              上一页
            </button>
          </li>
          <li className="page-item disabled">
            <span className="page-link num">
              {page + 1} / {pages}
            </span>
          </li>
          <li className={`page-item${page >= pages - 1 ? ' disabled' : ''}`}>
            <button
              type="button"
              className="page-link"
              disabled={page >= pages - 1}
              onClick={() => onChange(page + 1)}
            >
              下一页
            </button>
          </li>
        </ul>
      </nav>
    </div>
  );
}
