import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink } from 'lucide-react';
import { api, ApiError } from '../lib/api';
import { useApi } from '../lib/useApi';
import { useTitle } from '../lib/useTitle';
import type { PluginDetail as Detail, SeriesResponse } from '../types';
import { StarsChart } from '../components/StarsChart';
import { DeltaBadge } from '../components/DeltaBadge';
import { Avatar } from '../components/RankTable';
import { EmptyState, ErrorState, Loading } from '../components/States';
import { formatDate, formatDateTime, formatNumber } from '../lib/format';
import { categoryLabel, categoryDescription, useI18n } from '../lib/i18n';
import { copyText } from '../lib/clipboard';

function RankChip({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="border rounded-3 px-3 py-2">
      <div className="fs-xs fg-secondary">{label}</div>
      <div className={`num mt-1 fs-lg ${value === null ? 'fg-secondary' : ''}`}>
        {value === null ? '—' : `#${value}`}
      </div>
    </div>
  );
}

const SECTION_TITLE = 'fs-sm text-uppercase fg-secondary fw-semibold mb-0';

const ISSUE_URL =
  'https://github.com/wei-with-two-swords/harnesspack/issues/new?labels=data&title=';

function CopyLine({ label, value, disabled = false }: { label: string; value: string; disabled?: boolean }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const timer = useRef<number | null>(null);
  useEffect(() => () => {
    if (timer.current !== null) window.clearTimeout(timer.current);
  }, []);

  const handleCopy = async () => {
    if (disabled) return;
    if (!(await copyText(value))) return;
    setCopied(true);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="copy-line">
      <span className="copy-line-label">{label}</span>
      <div className="copy-line-row">
        <code className="copy-line-code" title={disabled ? t('detail.npmNotMapped') : value}>
          {disabled ? t('detail.npmNotMapped') : value}
        </code>
        <button type="button" onClick={handleCopy} disabled={disabled} aria-label={`${t('detail.copyPrefix')}${label}`}>
          {copied ? t('common.copied') : t('common.copy')}
        </button>
      </div>
    </div>
  );
}

export default function PluginDetail() {
  const { t, lang } = useI18n();
  const { slug = '' } = useParams<{ slug: string }>();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? '';
  const backTo = from.startsWith('?') ? `/${from}` : '/';
  const [days, setDays] = useState(90);
  const [selected, setSelected] = useState<string[]>([]);
  const detail = useApi<Detail>(() => api.plugin(slug), [slug]);
  const series = useApi<SeriesResponse>(() => api.series(slug, days), [slug, days]);
  const points = useMemo(() => series.data?.items ?? [], [series.data]);
  const data = detail.data;
  useTitle(data ? `${data.name} · ${data.owner}/${data.repo}` : t('detail.title'), data?.description ?? undefined);

  if (detail.error) {
    const err = detail.error;
    return (
      <div className="d-flex flex-column gap-4">
        <Link to={backTo} className="fs-sm text-decoration-none">
          <><ArrowLeft className="icon-leading" aria-hidden="true" />{t('detail.back')}</>
        </Link>
        {err instanceof ApiError && err.status === 404 ? (
          <EmptyState title={t('detail.notFound')}>{t('detail.notFoundHint')}</EmptyState>
        ) : (
          <ErrorState error={err} />
        )}
      </div>
    );
  }

  if (detail.loading || !data) return <Loading rows={4} />;

  const togglePeer = (peerSlug: string) => {
    setSelected((current) =>
      current.includes(peerSlug)
        ? current.filter((s) => s !== peerSlug)
        : current.length >= 4
          ? current
          : [...current, peerSlug],
    );
  };
  const compareSlugs = [slug, ...selected];
  const compareHref = `/compare?slugs=${encodeURIComponent(compareSlugs.join(','))}`;
  const repoHttps = (data.url || `https://github.com/${data.owner}/${data.repo}`).replace(/\.git$/, '');
  const npmPackage = data.npm_package?.trim() ?? '';
  const cloneCommand = `git clone ${repoHttps}.git`;
  const npmCommand = `npm install ${npmPackage}`;
  const pluginSpec = npmPackage || `github:${data.owner}/${data.repo}`;
  const pluginCommand = `dsh plugin --profile web add ${pluginSpec}`;

  return (
    <div className="d-flex flex-column gap-4">
      <div className="d-flex flex-wrap align-items-center gap-2 fs-sm fg-secondary">
        <Link to={backTo} className="text-decoration-none">
          <><ArrowLeft className="icon-leading" aria-hidden="true" />{t('detail.back')}</>
        </Link>
        <span>/</span>
        <span>{data.harness ?? 'harness'}</span>
        <span>/</span>
        <span>{data.category ? categoryLabel(lang, data.category) : t('detail.uncategorized')}</span>
      </div>

      {data.status === 'exited' ? (
        <div className="alert theme-warning bg-subtle-warning fs-sm">
          <span className="fw-semibold fg-emphasis-warning">{t('detail.exited')}</span>
          <span className="ms-2">
            {data.exit_reason ?? t('detail.exitFallback')}
            {data.exited_at ? `（${formatDate(data.exited_at)}）` : ''}{t('detail.exitHint')}
          </span>
        </div>
      ) : null}

      {!data.available ? (
        <div className="alert theme-danger bg-subtle-danger fs-sm">
          <span className="fw-semibold fg-emphasis-danger">{t('detail.unavailable')}</span>
          <span className="ms-2">
            {t('detail.unavailableHint')}
          </span>
        </div>
      ) : null}

      <section className="card">
        <div className="card-body">
          <div className="d-flex flex-column sm:flex-row sm:align-items-start justify-content-between gap-4">
            <div className="min-w-0 d-flex gap-3">
              <Avatar owner={data.owner} size={64} />
              <div className="min-w-0">
                <h1 className="fs-3xl fw-semibold mb-0">{data.name}</h1>
                <div className="mt-1 d-flex flex-wrap align-items-center gap-2 fs-sm fg-secondary">
                  <a
                    href={data.url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-decoration-none"
                  >
                    {data.owner}/{data.repo}<ExternalLink className="icon-trailing" aria-hidden="true" />
                  </a>
                  <a
                    href={`https://github.com/${encodeURIComponent(data.owner)}`}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="text-decoration-none"
                  >
                    {t('detail.author')}<ExternalLink className="icon-trailing" aria-hidden="true" />
                  </a>
                  {data.category ? (
                    <span className="badge theme-secondary badge-subtle" title={categoryDescription(lang, data.category)}>{categoryLabel(lang, data.category)}</span>
                  ) : null}
                  {data.harness ? (
                    <span className="badge theme-secondary badge-subtle">{data.harness}</span>
                  ) : null}
                  {data.archived ? (
                    <span className="badge theme-danger badge-subtle">{t('detail.archived')}</span>
                  ) : null}
                  {data.status !== 'active' ? (
                    <span className="badge theme-secondary badge-subtle">{data.status}</span>
                  ) : null}
                </div>
                {data.description ? (
                  <p className="mt-3 mb-0 fs-sm fg-secondary" style={{ maxWidth: 'var(--measure)' }}>
                    {data.description}
                  </p>
                ) : null}
                <div className="mt-3 d-flex flex-column gap-2" style={{ maxWidth: 'var(--measure)' }}>
                  <CopyLine label="Git Clone" value={cloneCommand} />
                  <CopyLine label={t('detail.npmInstall')} value={npmCommand} disabled={!npmPackage} />
                  <CopyLine label={t('detail.pluginInstall')} value={pluginCommand} />
                </div>
              </div>
            </div>
            <div className="flex-shrink-0 sm:text-end">
              <div className="fs-xs text-uppercase fg-secondary">STAR</div>
              <div className="num fs-3xl fw-semibold" style={{ color: 'var(--accent)' }}>
                {formatNumber(data.stars)}
              </div>
              <div className="mt-1 fs-sm">
                <DeltaBadge value={data.delta} anomaly={data.is_anomaly} />
              </div>
            </div>
          </div>

          <div className="row g-2 mt-4 rank-chips">
            {[
              [t('detail.rankTotal'), data.rank_total],
              [t('detail.rankVelocity'), data.rank_velocity],
              [t('detail.rankNpm'), data.rank_npm_total],
            ].map(([label, value]) => (
              <div key={label as string} className="col-6">
                <RankChip label={label as string} value={value as number | null} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="card">
        <div className="card-body">
          <div className="mb-3 d-flex flex-wrap align-items-center justify-content-between gap-2">
            <h2 className={SECTION_TITLE}>{t('detail.starCurve')}</h2>
            <div className="d-flex align-items-center gap-2">
              <div className="btn-group btn-group-sm" role="group" aria-label={t('detail.range')}>
                {[30, 90].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDays(value)}
                    className={`btn ${days === value ? 'btn-solid active' : 'btn-outline'}`}
                    aria-pressed={days === value}
                  >
                    {t('detail.days', { n: value })}
                  </button>
                ))}
              </div>
              <span className="fs-xs fg-secondary">{t('detail.asOf', { date: formatDate(data.as_of) })}</span>
            </div>
          </div>
          {series.loading ? <Loading rows={1} /> : <StarsChart points={points} />}
          {points.length === 1 ? (
            <p className="mt-2 mb-0 fs-xs fg-secondary">{t('detail.onlyBaseline')}</p>
          ) : null}
        </div>
      </section>

      {data.peers.length > 0 ? (
        <section className="card">
          <div className="card-body">
            <div className="mb-2 d-flex flex-wrap align-items-center justify-content-between gap-2">
              <h2 className={SECTION_TITLE}>{t('detail.peers')}</h2>
              <Link to={compareHref} className="btn btn-outline btn-sm">
                {t('detail.compareSelected', { n: compareSlugs.length })}
              </Link>
            </div>
            <ul className="list-unstyled mb-0 fs-sm">
              {data.peers.map((peer) => {
                const checked = selected.includes(peer.slug);
                return (
                  <li key={peer.slug} className="d-flex align-items-center gap-3 py-2 border-bottom">
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => togglePeer(peer.slug)}
                      className="check"
                      aria-label={t('detail.comparePeer', { name: peer.name })}
                    />
                    <span className="num flex-shrink-0 fs-xs fg-secondary" style={{ width: 'var(--s-5)' }}>
                      #{peer.rank}
                    </span>
                    <Link
                      to={`/plugins/${peer.slug}`}
                      state={{ from }}
                      className="min-w-0 flex-grow-1 text-truncate text-decoration-none"
                    >
                      {peer.name}
                    </Link>
                    <span className="num flex-shrink-0 fg-secondary">{formatNumber(peer.stars)}</span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-2 mb-0 fs-xs fg-secondary">
              {t('detail.peerHint')}
            </p>
          </div>
        </section>
      ) : null}

      <section className="row g-4">
        <div className="col-12 sm:col-6">
          <div className="card h-100">
            <div className="card-body">
              <h2 className={`${SECTION_TITLE} mb-2`}>{t('detail.repoInfo')}</h2>
              <dl className="mb-0 fs-sm">
                {[
                  { key: 'owner', label: t('detail.owner'), value: <>{data.owner}</>, truncate: true },
                  { key: 'created', label: t('detail.created'), value: <>{formatDate(data.repo_created_at)}</>, truncate: true },
                  { key: 'pushed', label: t('detail.pushed'), value: <>{formatDateTime(data.pushed_at)}</>, truncate: true },
                  { key: 'branch', label: t('detail.branch'), value: <>{data.default_branch ?? '—'}</>, truncate: true },
                  { key: 'forks', label: t('detail.forks'), value: <>{formatNumber(data.forks)}</>, truncate: true },
                  { key: 'license', label: t('detail.license'), value: <>{data.license || '—'}</>, truncate: true },
                  { key: 'topics', label: t('detail.topics'), value: <>{data.topics?.length ? data.topics.join('、') : '—'}</>, truncate: false },
                  { key: 'npmPackage', label: t('detail.npmPackage'), value: <>{data.npm_package ?? '—'}</>, truncate: true },
                  {
                    key: 'npmUrl',
                    label: t('detail.npmUrl'),
                    value: data.npm_package ? (
                      <a
                        href={`https://www.npmjs.com/package/${data.npm_package}`}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-decoration-none text-truncate"
                        title={data.npm_package}
                      >
                        npmjs.com/package/{data.npm_package}<ExternalLink className="icon-trailing" aria-hidden="true" />
                      </a>
                    ) : <>—</>,
                    truncate: false,
                  },
                ].map((row) => (
                  <div key={row.key} className="d-flex justify-content-between gap-4 mb-2">
                    <dt className="fw-normal fg-secondary flex-shrink-0">{row.label}</dt>
                    <dd className={`num mb-0 text-end${row.truncate ? ' text-truncate' : ''}`}>{row.value}</dd>
                  </div>
                ))}
              </dl>
              {data.github_description && data.github_description !== data.description ? (
                <p className="mt-3 mb-0 fs-xs fg-secondary">
                  {t('detail.githubDesc')}{data.github_description}
                </p>
              ) : null}
            </div>
          </div>
        </div>
        <div className="col-12 sm:col-6">
          <div className="card h-100">
            <div className="card-body">
              <h2 className={`${SECTION_TITLE} mb-2`}>{t('detail.inclusion')}</h2>
              <dl className="mb-0 fs-sm">
                {[
                  { key: 'addedAt', label: t('detail.addedAt'), value: formatDate(data.added_at) },
                  { key: 'dataDate', label: t('detail.dataDate'), value: formatDate(data.as_of) },
                ].map((row) => (
                  <div key={row.key} className="d-flex justify-content-between gap-4 mb-2">
                    <dt className="fw-normal fg-secondary">{row.label}</dt>
                    <dd className="num mb-0 text-end">{row.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-3 d-flex flex-wrap gap-2">
                <a
                  href={`${ISSUE_URL}${encodeURIComponent(`[数据] ${data.owner}/${data.repo}`)}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="btn btn-outline btn-sm"
                >
                  {t('detail.appeal')}<ExternalLink className="icon-trailing" aria-hidden="true" />
                </a>
              </div>
              <p className="mt-3 mb-0 fs-xs fg-secondary">
                {t('detail.footnote')}
                {t('detail.footnoteRules')}<Link to="/about#rules" className="text-decoration-none">{t('link.inclusionRules')}</Link>
                {t('detail.footnoteApi')}<Link to="/api" className="text-decoration-none">{t('detail.apiDocs')}</Link>{t('detail.footnoteEnd')}
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
