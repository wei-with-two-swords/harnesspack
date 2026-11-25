import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { formatNumber } from '../lib/format';
import type { PluginListItem } from '../types';

/** Homepage global search: queries /api/v1/plugins?query= with debounce. */
export function GlobalSearch() {
  const { t } = useI18n();
  const location = useLocation();
  const fromHome = location.pathname === '/' ? location.search : '';
  const [input, setInput] = useState('');
  const [items, setItems] = useState<PluginListItem[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const query = input.trim();
    if (!query) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    // Ignore responses from superseded queries (and after unmount): clearing
    // the debounce timer alone cannot cancel a request already in flight.
    let active = true;
    const timer = setTimeout(() => {
      api
        .plugins({ query, sort: 'stars', limit: 8 })
        .then((data) => { if (active) setItems(data.items); })
        .catch(() => { if (active) setItems([]); })
        .finally(() => { if (active) setLoading(false); });
    }, 250);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [input]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, []);

  const show = open && input.trim().length > 0;

  return (
    <div className="global-search" ref={rootRef}>
      <input
        className="form-control"
        type="search"
        value={input}
        placeholder={t('common.searchPlaceholder')}
        aria-label={t('common.search')}
        onChange={(event) => {
          setInput(event.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
      />
      {show ? (
        <div className="search-results card">
          {loading ? (
            <div className="px-3 py-3 fs-sm fg-secondary">{t('common.loading')}</div>
          ) : items.length ? (
            <ul className="list-group list-group-flush">
              {items.map((item) => (
                <li key={item.slug} className="list-group-item list-group-item-action p-0">
                  <Link
                    to={`/plugins/${item.slug}`}
                    state={{ from: fromHome }}
                    className="d-flex align-items-center gap-3 px-3 py-2 text-decoration-none"
                    onClick={() => {
                      setOpen(false);
                      setInput('');
                    }}
                  >
                    <span className="min-w-0 flex-grow-1">
                      <span className="d-block text-truncate fw-medium">{item.name}</span>
                      <span className="d-block text-truncate fs-xs fg-secondary">
                        {item.owner}/{item.repo}
                      </span>
                    </span>
                    <span className="num fs-xs fg-secondary flex-shrink-0">
                      STAR {item.stars === null ? '—' : formatNumber(item.stars)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <div className="px-3 py-3 fs-sm fg-secondary">{t('common.noData')}</div>
          )}
        </div>
      ) : null}
    </div>
  );
}
