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
    <div className="mt-4 flex flex-col items-center justify-between gap-3 text-xs text-muted sm:flex-row">
      <span className="num">
        {from}–{to} / {total}
      </span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={page === 0}
          onClick={() => onChange(page - 1)}
          className="rounded-md border border-line px-3 py-1.5 transition enabled:hover:border-teal enabled:hover:text-white disabled:opacity-40"
        >
          上一页
        </button>
        <span className="num px-1">
          {page + 1} / {pages}
        </span>
        <button
          type="button"
          disabled={page >= pages - 1}
          onClick={() => onChange(page + 1)}
          className="rounded-md border border-line px-3 py-1.5 transition enabled:hover:border-teal enabled:hover:text-white disabled:opacity-40"
        >
          下一页
        </button>
      </div>
    </div>
  );
}
