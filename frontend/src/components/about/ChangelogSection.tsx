import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronDown } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import { formatDate } from '../../lib/format';
import { EmptyState, ErrorState, Loading } from '../States';
import { useI18n } from '../../lib/i18n';
import type { ChangelogEntry, ChangelogResponse } from '../../types';

const LINK = 'text-decoration-none';
const UNKNOWN_DAY = 'unknown-day';

function Chip({ name }: { name: string }) {
  return <span className="badge theme-secondary badge-subtle fs-xs">{name}</span>;
}

function totals(entries: ChangelogEntry[]) {
  return {
    added: entries.reduce((sum, entry) => sum + entry.added, 0),
    removed: entries.reduce((sum, entry) => sum + entry.removed, 0),
    changed: entries.reduce((sum, entry) => sum + entry.changed, 0),
  };
}

function DayNode({
  day,
  entries,
  defaultOpen,
}: {
  day: string;
  entries: ChangelogEntry[];
  defaultOpen: boolean;
}) {
  const { t } = useI18n();
  const [open, setOpen] = useState(defaultOpen);
  const sum = totals(entries);
  const isDate = /^\d{4}-\d{2}-\d{2}$/.test(day);

  return (
    <li className="hp-timeline-item">
      <span className="hp-timeline-dot" aria-hidden="true" />
      <div className="card overflow-hidden">
        <button
          type="button"
          className="hp-timeline-toggle"
          onClick={() => setOpen((value) => !value)}
          aria-expanded={open}
        >
          <ChevronDown className={`icon-leading hp-timeline-chevron${open ? ' is-open' : ''}`} aria-hidden="true" />
          <span className="fw-semibold fs-md">{isDate ? formatDate(day) : t('clog.unknownDay')}</span>
          <span className="ms-auto d-flex flex-wrap gap-3 fs-xs">
            {sum.added > 0 ? <span className="fg-success">{t('clog.plusAdded', { n: sum.added })}</span> : null}
            {sum.removed > 0 ? <span className="fg-danger">{t('clog.minusRemoved', { n: sum.removed })}</span> : null}
            {sum.changed > 0 ? <span className="fg-warning">{t('clog.tildeChanged', { n: sum.changed })}</span> : null}
            {sum.added === 0 && sum.removed === 0 && sum.changed === 0 ? (
              <span className="fg-secondary">{t('clog.noChange')}</span>
            ) : null}
          </span>
        </button>
        {open ? (
          <div className="hp-timeline-body border-top">
            {entries.map((entry, index) => (
              <div className="hp-timeline-entry" key={`${entry.at ?? 'unknown'}-${index}`}>
                <div className="d-flex flex-wrap align-items-center gap-3 fs-xs fg-secondary">
                  <span className="num">{entry.at ? entry.at.slice(11, 16) : t('clog.unknownTime')}</span>
                  <span className="fg-success">{t('clog.entryAdded', { n: entry.added })}</span>
                  <span className="fg-danger">{t('clog.entryRemoved', { n: entry.removed })}</span>
                  <span className="fg-warning">{t('clog.entryChanged', { n: entry.changed })}</span>
                </div>
                {entry.added_sample.length > 0 ? (
                  <div className="mt-2 d-flex flex-wrap gap-2 align-items-center">
                    {entry.added_sample.map((name) => (
                      <Chip key={name} name={name} />
                    ))}
                    {entry.added > entry.added_sample.length ? (
                      <span className="fs-xs fg-secondary">{t('clog.moreCount', { n: entry.added })}</span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </li>
  );
}

export default function ChangelogSection() {
  const { t } = useI18n();
  const { data, error, loading } = useApi<ChangelogResponse>(() => api.changelog(50), []);

  const groups = useMemo(() => {
    const byDay = new Map<string, ChangelogEntry[]>();
    for (const entry of data?.items ?? []) {
      const day = entry.at ? entry.at.slice(0, 10) : UNKNOWN_DAY;
      const list = byDay.get(day) ?? [];
      list.push(entry);
      byDay.set(day, list);
    }
    return Array.from(byDay, ([day, entries]) => ({ day, entries }));
  }, [data]);

  return (
    <section id="changelog" className="hp-anchor mb-4">
      <h2 className="fs-xl fw-semibold mb-2">{t('clog.title')}</h2>
      <p className="fs-sm fg-secondary mb-3" style={{ maxWidth: 'var(--measure)' }}>
        {t('clog.leadA')}{' '}
        <Link to="/about#rules" className={LINK}>
          {t('link.inclusionRules')}
        </Link>
        {t('clog.leadB')}
      </p>

      {error ? <ErrorState error={error} /> : null}
      {loading ? <Loading /> : null}
      {!loading && !error && data ? (
        groups.length > 0 ? (
          <ul className="hp-timeline">
            {groups.map((group, index) => (
              <DayNode key={group.day} day={group.day} entries={group.entries} defaultOpen={index === 0} />
            ))}
          </ul>
        ) : (
          <EmptyState title={t('clog.emptyTitle')}>{t('clog.emptyHint')}</EmptyState>
        )
      ) : null}

      {data?.as_of ? (
        <p className="mt-3 mb-0 fs-xs fg-secondary">
          {t('clog.asOf', { date: formatDate(data.as_of) })}
        </p>
      ) : null}
    </section>
  );
}
