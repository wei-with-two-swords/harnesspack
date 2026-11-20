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

export default function ApiDocs() {
  useTitle('API 说明');
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-white">API 说明</h1>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted">
          只读 JSON API，版本前缀 <code className="text-body">/api/v1</code>。所有列表返回{' '}
          <code className="text-body">{'{ items, total, as_of }'}</code>；日期一律 UTC（YYYY-MM-DD）。
          默认每 IP 每分钟 120 次（<code className="text-body">/og/</code> 图片 20 次），超限返回{' '}
          <code className="text-body">429</code> 与 <code className="text-body">Retry-After</code>；
          需要批量数据建议直接读取公开仓库里的
          <code className="text-body"> data/snapshots/</code> 快照文件，条款见{' '}
          <Link to="/about/terms" className="text-teal hover:underline">
            使用条款
          </Link>
          。
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <a href="/api/v1/docs" target="_blank" rel="noreferrer noopener" className="btn">
            打开 Swagger UI
          </a>
          <a href="/api/v1/openapi.json" target="_blank" rel="noreferrer noopener" className="btn">
            OpenAPI JSON
          </a>
          <Link to="/about/rules" className="btn">
            收录规则
          </Link>
        </div>
      </div>

      <section className="card overflow-hidden">
        <table className="w-full table-fixed text-sm">
          <thead className="border-b border-line text-left text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="w-16 px-4 py-3 font-medium">方法</th>
              <th className="w-1/2 px-2 py-3 font-medium">路径</th>
              <th className="px-2 py-3 font-medium">说明</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line/60">
            {ENDPOINTS.map((row) => (
              <tr key={row.path} className="hover:bg-raise/40">
                <td className="px-4 py-3">
                  <span className="pill border-rise/40 text-rise">{row.method}</span>
                </td>
                <td className="px-2 py-3">
                  <code className="break-all text-body">{row.path}</code>
                </td>
                <td className="px-2 py-3 text-muted">{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="card card-pad">
        <h2 className="section-title mb-2">示例</h2>
        <pre className="overflow-x-auto rounded-lg bg-ink p-3 text-xs leading-relaxed text-body">
{`curl -s https://harnesspack.dev/api/v1/rankings/velocity?limit=5
curl -s "https://harnesspack.dev/api/v1/plugins?query=dsh-pet&sort=stars"
curl -s "https://harnesspack.dev/api/v1/compare?slugs=dsh-market-dsh-market,dsh-web-zhu1090093659-dsh-web"`}
        </pre>
        <p className="mt-2 text-xs text-muted">
          字段含义见 <Link to="/about" className="text-teal hover:underline">数据口径</Link>。
        </p>
      </section>
    </div>
  );
}
