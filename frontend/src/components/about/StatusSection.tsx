import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { api } from '../../lib/api';
import { useApi } from '../../lib/useApi';
import type { StatusResponse } from '../../types';
import { formatDate, formatNumber, formatPercent } from '../../lib/format';
import { ErrorState, Loading } from '../States';
import { Pager } from '../Pager';
import { useI18n } from '../../lib/i18n';

const LINK = 'text-decoration-none';
const FAILURE_PAGE_SIZE = 10;

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="card h-100">
      <div className="card-body py-3">
        <p className="fs-xs text-uppercase fg-secondary mb-0">{label}</p>
        <p className="num mt-1 mb-0 fs-2xl fw-semibold">{value}</p>
        {hint ? <p className="mt-1 mb-0 fs-xs fg-secondary">{hint}</p> : null}
      </div>
    </div>
  );
}

export default function StatusSection() {
  const { t } = useI18n();
  const { data, error, loading } = useApi<StatusResponse>(() => api.status(), []);
  const [failPage, setFailPage] = useState(0);

  return (
    <section id="status" className="hp-anchor mb-4">
      <h2 className="fs-xl fw-semibold mb-2">{t('status.title')}</h2>
      <p className="fs-sm fg-secondary mb-3" style={{ maxWidth: 'var(--measure)' }}>
        {t('status.leadA')}
        <a
          className={`mx-1 ${LINK}`}
          href="https://github.com/wei-with-two-swords/harnesspack/tree/main/data/snapshots"
          target="_blank"
          rel="noreferrer"
        >
          {t('status.repoLink')}<ExternalLink className="icon-trailing" aria-hidden="true" />
        </a>
        {t('status.leadB')}
      </p>

      {error ? <ErrorState error={error} /> : null}
      {loading ? <Loading /> : null}

      {data ? (
        <>
          <div className="row g-3 mb-3">
            <div className="col-12 sm:col-6 lg:col-3">
              <Stat
                label={t('status.stat.days')}
                value={formatNumber(data.snapshots.days)}
                hint={
                  data.snapshots.first_date
                    ? t('status.stat.since', { date: data.snapshots.first_date })
                    : t('status.stat.waiting')
                }
              />
            </div>
            <div className="col-12 sm:col-6 lg:col-3">
              <Stat
                label={t('status.stat.okRate')}
                value={data.snapshots.ok_rate === null ? '—' : formatPercent(data.snapshots.ok_rate)}
                hint={
                  data.snapshots.latest
                    ? `${formatNumber(data.snapshots.latest.ok)} / ${formatNumber(data.snapshots.latest.total)}`
                    : '—'
                }
              />
            </div>
            <div className="col-12 sm:col-6 lg:col-3">
              <Stat
                label={t('status.stat.coverage')}
                value={data.snapshots.coverage === null ? '—' : formatPercent(data.snapshots.coverage)}
                hint={t('status.stat.coverageHint', { n: formatNumber(data.snapshots.seed_count) })}
              />
            </div>
            <div className="col-12 sm:col-6 lg:col-3">
              <Stat
                label={t('status.stat.anomalies')}
                value={formatNumber(data.database.anomalies)}
                hint={t('status.stat.anomaliesHint')}
              />
            </div>
          </div>

          <div className="row g-3 mb-3">
            <div className="col-12 sm:col-6 lg:col-3">
              <Stat
                label={t('status.stat.plugins')}
                value={formatNumber(data.database.plugins)}
                hint={t('status.stat.pluginsHint', { n: formatNumber(data.database.active) })}
              />
            </div>
            <div className="col-12 sm:col-6 lg:col-3">
              <Stat label={t('status.stat.exited')} value={formatNumber(data.database.exited)} hint={t('status.stat.exitedHint')} />
            </div>
            <div className="col-12 sm:col-6 lg:col-3">
              <Stat label={t('status.stat.unavailable')} value={formatNumber(data.database.unavailable)} hint={t('status.stat.unavailableHint')} />
            </div>
            <div className="col-12 sm:col-6 lg:col-3">
              <Stat
                label={t('status.stat.stars')}
                value={formatNumber(data.database.stars_rows)}
                hint={t('status.stat.asOf', { date: data.database.as_of ?? '—' })}
              />
            </div>
          </div>

          {data.snapshots.latest ? (
            <div className="card mb-3">
              <div className="card-body">
                <div className="d-flex flex-wrap align-items-baseline justify-content-between gap-2">
                  <h3 className="fs-lg fw-semibold mb-0">{t('status.latestTitle')}</h3>
                  <p className="num fs-xs fg-secondary mb-0">
                    {data.snapshots.latest.date} · {t('status.took', { s: data.snapshots.latest.elapsed_s ?? '—' })}
                    {data.last_catalog_sync
                      ? ` · ${t('status.catalogSync', { ts: data.last_catalog_sync.at.slice(0, 16).replace('T', ' ') })}`
                      : ''}
                  </p>
                </div>
                <p className="mt-2 mb-0 fs-sm fg-secondary">
                  {t('status.latestBody', {
                    ok: formatNumber(data.snapshots.latest.ok),
                    failed: formatNumber(data.snapshots.latest.failed),
                  })}
                </p>
                {data.last_catalog_sync ? (
                  <p className="mt-1 mb-0 fs-sm fg-secondary">
                    {t('status.syncLine', {
                      added: data.last_catalog_sync.added,
                      removed: data.last_catalog_sync.removed,
                      changed: data.last_catalog_sync.changed,
                    })}
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          {data.snapshots.failures.length > 0 ? (
            <div className="card overflow-hidden mb-3">
              <div className="d-flex align-items-center justify-content-between border-bottom px-4 py-3">
                <h3 className="fs-lg fw-semibold mb-0">{t('status.failuresTitle')}</h3>
                <span className="fs-xs fg-secondary num">
                  {t('status.failuresCount', { n: formatNumber(data.snapshots.failures.length) })}
                </span>
              </div>
              <ul className="list-unstyled mb-0 fs-sm">
                {data.snapshots.failures
                  .slice(failPage * FAILURE_PAGE_SIZE, (failPage + 1) * FAILURE_PAGE_SIZE)
                  .map((f) => (
                    <li key={f.slug} className="d-flex align-items-center justify-content-between gap-3 px-4 py-2 border-bottom">
                      <span className="text-truncate">
                        <span>{f.repo}</span>
                        <span className="ms-2 fs-xs fg-secondary">{f.slug}</span>
                      </span>
                      <span className="flex-shrink-0 fs-xs fg-danger">{f.status}</span>
                    </li>
                  ))}
              </ul>
              <div className="px-4 pb-3">
                <Pager
                  page={failPage}
                  pageSize={FAILURE_PAGE_SIZE}
                  total={data.snapshots.failures.length}
                  onChange={setFailPage}
                  scrollOnChange={false}
                />
              </div>
            </div>
          ) : null}

          <p className="fs-xs fg-secondary mb-0">
            {t('status.footA')}<Link className={LINK} to="/about#data">{t('link.dataMethods')}</Link>
            {t('status.footB')}<Link className={LINK} to="/about#submit">{t('about.submit')}</Link>
            {t('status.footC')}
            {data.snapshots.as_of ? t('status.dataAsOf', { date: formatDate(data.snapshots.as_of) }) : ''}
          </p>
        </>
      ) : null}
    </section>
  );
}
