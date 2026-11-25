import { useEffect, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import { api } from '../lib/api';
import { formatNumber } from '../lib/format';
import { useI18n } from '../lib/i18n';
import type { PluginListItem } from '../types';

const MIN = 2;
const MAX = 5;

export function ComparePicker({
  open,
  initialSlugs,
  onClose,
  onApply,
}: {
  open: boolean;
  initialSlugs: string[];
  onClose: () => void;
  onApply: (slugs: string[]) => void;
}) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<PluginListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string[]>(initialSlugs);
  const initialKey = initialSlugs.join(',');

  useEffect(() => {
    if (open) setSelected(initialKey ? initialKey.split(',') : []);
  }, [open, initialKey]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timer = setTimeout(() => {
      api
        .plugins({ query: q, sort: 'stars', limit: 15 })
        .then((data) => setItems(data.items))
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(timer);
  }, [query]);

  if (!open) return null;

  const toggle = (slug: string) => {
    setSelected((prev) => {
      if (prev.includes(slug)) return prev.filter((s) => s !== slug);
      if (prev.length >= MAX) return prev;
      return [...prev, slug];
    });
  };

  return (
    <div className="friend-overlay" onClick={onClose} role="presentation">
      <div
        className="friend-dialog compare-picker"
        role="dialog"
        aria-modal="true"
        aria-label={t('picker.aria')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="friend-dialog-head">
          <div className="friend-dialog-head-text">
            <h2 className="fs-lg fw-semibold mb-1">{t('picker.title')}</h2>
            <p className="fs-xs fg-secondary mb-0">{t('picker.hint', { min: MIN, max: MAX })}</p>
          </div>
          <button type="button" className="btn-icon friend-close" onClick={onClose} aria-label={t('common.close')}>
            <X aria-hidden="true" />
          </button>
        </div>

        {selected.length ? (
          <div className="compare-picker-selected">
            {selected.map((slug) => (
              <button key={slug} type="button" className="compare-picker-chip" onClick={() => toggle(slug)} title={t('picker.remove')}>
                {slug} <X aria-hidden="true" />
              </button>
            ))}
          </div>
        ) : null}

        <div className="compare-picker-search">
          <Search aria-hidden="true" />
          <input
            className="form-control"
            type="search"
            value={query}
            placeholder={t('picker.searchPlaceholder')}
            aria-label={t('common.search')}
            onChange={(event) => setQuery(event.target.value)}
            autoFocus
          />
        </div>

        <div className="compare-picker-results">
          {loading ? (
            <p className="fs-sm fg-secondary mb-0">{t('picker.searching')}</p>
          ) : !query.trim() ? (
            <p className="fs-sm fg-secondary mb-0">{t('picker.idle')}</p>
          ) : items.length === 0 ? (
            <p className="fs-sm fg-secondary mb-0">{t('picker.empty')}</p>
          ) : (
            <ul className="list-unstyled mb-0">
              {items.map((item) => {
                const checked = selected.includes(item.slug);
                return (
                  <li key={item.slug}>
                    <button
                      type="button"
                      className={`compare-picker-item${checked ? ' selected' : ''}`}
                      onClick={() => toggle(item.slug)}
                      aria-pressed={checked}
                    >
                      <span className="compare-picker-check">{checked ? <Check aria-hidden="true" /> : null}</span>
                      <span className="min-w-0 flex-grow-1">
                        <span className="d-block text-truncate fw-medium">{item.name}</span>
                        <span className="d-block text-truncate fs-xs fg-secondary">{item.owner}/{item.repo}</span>
                      </span>
                      <span className="num fs-xs fg-secondary flex-shrink-0">
                        STAR {item.stars === null ? '—' : formatNumber(item.stars)}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="compare-picker-foot">
          <span className="fs-xs fg-secondary">{t('picker.selected', { n: selected.length, max: MAX })}</span>
          <div className="d-flex gap-2">
            <button type="button" className="btn btn-outline btn-sm" onClick={onClose}>{t('picker.cancel')}</button>
            <button
              type="button"
              className="btn btn-solid btn-sm"
              disabled={selected.length < MIN}
              onClick={() => onApply(selected)}
            >
              {t('picker.apply')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
