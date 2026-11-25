import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/useAuth';

const ENDPOINTS: { method: string; path: string; noteKey: string }[] = [
  { method: 'GET', path: '/api/v1/health', noteKey: 'api.ep.health' },
  { method: 'GET', path: '/api/v1/dashboard', noteKey: 'api.ep.dashboard' },
  { method: 'GET', path: '/api/v1/categories', noteKey: 'api.ep.categories' },
  { method: 'GET', path: '/api/v1/rankings/{board}', noteKey: 'api.ep.rankings' },
  { method: 'GET', path: '/api/v1/plugins', noteKey: 'api.ep.plugins' },
  { method: 'GET', path: '/api/v1/plugins/{slug}', noteKey: 'api.ep.plugin' },
  { method: 'GET', path: '/api/v1/plugins/{slug}/series', noteKey: 'api.ep.series' },
  { method: 'GET', path: '/api/v1/compare', noteKey: 'api.ep.compare' },
  { method: 'GET', path: '/api/v1/changelog', noteKey: 'api.ep.changelog' },
];

export default function ApiDocs() {
  const { t } = useI18n();
  const { oauthEnabled } = useAuth();
  return (
    <div className="d-flex flex-column gap-4">
      <div>
        <h1 className="fs-3xl fw-semibold mb-2">{t('api.title')}</h1>
        <p className="fs-sm fg-secondary mb-3" style={{ maxWidth: 'var(--measure-wide)' }}>
          {t('api.intro')} <code>https://harnesspack.dev</code>.
        </p>
        <div className="d-flex flex-wrap gap-2">
          <a href="/api/v1/docs" target="_blank" rel="noreferrer noopener" className="btn btn-outline">
            {t('api.tryIt')}
          </a>
          <a href="/api/v1/openapi.json" target="_blank" rel="noreferrer noopener" className="btn btn-outline">
            OpenAPI JSON
          </a>
          <Link to="/about/data" className="btn btn-outline">{t('footer.data')}</Link>
        </div>
      </div>

      <section className="card">
        <div className="card-body">
          <h2 className="fs-sm text-uppercase fg-secondary fw-semibold mb-2">{t('auth.rateTitle')}</h2>
          <div className="fs-xs fg-secondary">{t('auth.anonQuota')}</div>
          <div className="fs-xs fg-secondary">{t('auth.authQuota')}</div>
          <div className="fs-xs fg-secondary mt-1">
            {t('auth.quotaNote')} {oauthEnabled ? <a href="/api/auth/github">GitHub<ExternalLink className="icon-trailing" aria-hidden="true" /></a> : null}
          </div>
        </div>
      </section>

      <section className="card overflow-hidden">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="fs-xs text-uppercase fg-secondary">
              <tr>
                <th className="px-4 py-3 fw-medium" style={{ width: 'calc(var(--s-8) + var(--s-2))' }}>{t('api.method')}</th>
                <th className="px-2 py-3 fw-medium" style={{ width: '50%' }}>{t('api.path')}</th>
                <th className="px-2 py-3 fw-medium">{t('api.description')}</th>
              </tr>
            </thead>
            <tbody>
              {ENDPOINTS.map((row) => (
                <tr key={row.path}>
                  <td className="px-4 py-3"><span className="badge theme-success badge-subtle">{row.method}</span></td>
                  <td className="px-2 py-3"><code className="text-break">{row.path}</code></td>
                  <td className="px-2 py-3 fg-secondary">{t(row.noteKey)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="card-body">
          <h2 className="fs-sm text-uppercase fg-secondary fw-semibold mb-2">{t('api.tryIt')}</h2>
          <pre className="overflow-auto rounded-3 bg-subtle-secondary p-3 fs-xs mb-0">
{`curl -s "https://harnesspack.dev/api/v1/rankings/npm?range=7d&limit=5"
curl -s "https://harnesspack.dev/api/v1/plugins?query=dsh-pet&sort=stars"
curl -s "https://harnesspack.dev/api/v1/compare?slugs=a,b,c"`}
          </pre>
        </div>
      </section>
    </div>
  );
}
