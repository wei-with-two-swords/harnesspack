import { Link } from 'react-router-dom';
import { useTitle } from '../lib/useTitle';

const ENDPOINTS: { method: string; path: string; note: string }[] = [
  { method: 'GET', path: '/api/v1/health', note: '健康检查：插件数、快照数、最新日期' },
  { method: 'GET', path: '/api/v1/dashboard', note: '首页聚合：KPI + 竞速/增速/总榜/新秀' },
  { method: 'GET', path: '/api/v1/categories', note: '分类索引：每类席位、总 star、Top 3' },
  { method: 'GET', path: '/api/v1/rankings/{board}', note: '榜单：velocity|growth|total|darkhorse|rookie，支持 window=7|30、category、limit、offset' },
  { method: 'GET', path: '/api/v1/plugins', note: '插件库：query、category、sort=stars|name|recent、limit、offset' },
  { method: 'GET', path: '/api/v1/plugins/{slug}', note: '插件详情：当前 star、各榜名次、同分类 peers' },
  { method: 'GET', path: '/api/v1/plugins/{slug}/series', note: '曲线：days=1..365，返回每日 count/delta/is_anomaly' },
  { method: 'GET', path: '/api/v1/compare', note: '对比：slugs=a,b,c（2-5 个）与 days' },
  { method: 'GET', path: '/api/v1/changelog', note: '名单变更：上游清单每次同步的新增/移除/变更' },
  { method: 'GET', path: '/api/v1/sponsors', note: '推荐位：独立区块，disclosure=sponsored' },
];

const LINK = 'text-decoration-none';

export default function ApiDocs() {
  useTitle('API 说明');
  return (
    <div className="d-flex flex-column gap-4">
      <div>
        <h1 className="fs-3xl fw-semibold mb-1">API 说明</h1>
        <p className="fs-sm fg-secondary mb-0" style={{ maxWidth: '48rem' }}>
          只读 JSON API，版本前缀 <code>/api/v1</code>。所有列表返回{' '}
          <code>{'{ items, total, as_of }'}</code>；日期一律 UTC（YYYY-MM-DD）。
          默认每 IP 每分钟 120 次（<code>/og/</code> 图片 20 次），超限返回{' '}
          <code>429</code> 与 <code>Retry-After</code>；
          需要批量数据建议直接读取公开仓库里的
          <code> data/snapshots/</code> 快照文件，条款见{' '}
          <Link to="/about/terms" className={LINK}>
            使用条款
          </Link>
          。
        </p>
        <div className="mt-3 d-flex flex-wrap gap-2">
          <a href="/api/v1/docs" target="_blank" rel="noreferrer noopener" className="btn btn-outline theme-secondary">
            打开 Swagger UI
          </a>
          <a href="/api/v1/openapi.json" target="_blank" rel="noreferrer noopener" className="btn btn-outline theme-secondary">
            OpenAPI JSON
          </a>
          <Link to="/about/rules" className="btn btn-outline theme-secondary">
            收录规则
          </Link>
        </div>
      </div>

      <section className="card overflow-hidden">
        <div className="table-responsive">
          <table className="table table-hover align-middle mb-0">
            <thead className="fs-xs text-uppercase fg-secondary">
              <tr>
                <th className="px-4 py-3 fw-medium" style={{ width: '5rem' }}>方法</th>
                <th className="px-2 py-3 fw-medium" style={{ width: '50%' }}>路径</th>
                <th className="px-2 py-3 fw-medium">说明</th>
              </tr>
            </thead>
            <tbody>
              {ENDPOINTS.map((row) => (
                <tr key={row.path}>
                  <td className="px-4 py-3">
                    <span className="badge theme-success badge-subtle">{row.method}</span>
                  </td>
                  <td className="px-2 py-3">
                    <code className="text-break">{row.path}</code>
                  </td>
                  <td className="px-2 py-3 fg-secondary">{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="card-body">
          <h2 className="fs-sm text-uppercase fg-secondary fw-semibold mb-2">示例</h2>
          <pre className="overflow-auto rounded-3 bg-subtle-secondary p-3 fs-xs mb-0">
{`curl -s https://harnesspack.dev/api/v1/rankings/velocity?limit=5
curl -s "https://harnesspack.dev/api/v1/plugins?query=dsh-pet&sort=stars"
curl -s "https://harnesspack.dev/api/v1/compare?slugs=dsh-market-dsh-market,dsh-web-zhu1090093659-dsh-web"`}
          </pre>
          <p className="mt-2 mb-0 fs-xs fg-secondary">
            字段含义见 <Link to="/about" className={LINK}>数据口径</Link>。
          </p>
        </div>
      </section>
    </div>
  );
}
