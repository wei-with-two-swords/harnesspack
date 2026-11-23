import { Link } from 'react-router-dom';
import { useTitle } from '../lib/useTitle';

const REPO = 'https://github.com/wei-with-two-swords/harnesspack';
const LINK = 'text-decoration-none';

export default function Terms() {
  useTitle('使用条款与数据许可', 'HarnessPack 的数据来源、许可范围、API 限流与使用边界。');

  return (
    <article className="fs-sm" style={{ maxWidth: '48rem' }}>
      <header className="mb-4">
        <h1 className="fs-3xl fw-semibold mb-2">使用条款与数据许可</h1>
        <p className="mb-0 fg-secondary">
          一句话：数据尽量开放、署名即可用；站点内容与批量数据保留权利；请不要绕过限流把全量历史拿去转售。
        </p>
      </header>

      <section className="card mb-4">
        <div className="card-body">
          <h2 className="fs-lg fw-semibold">1. 数据来源</h2>
          <p className="mt-2 mb-0 fg-secondary">
            star 数来自 GitHub 公开 REST / GraphQL API；名单与分类来自{' '}
            <a className={LINK} href="https://github.com/awesome-dsh-plugin/awesome-dsh-plugin" target="_blank" rel="noreferrer">
              awesome-dsh-plugin
            </a>{' '}
            清单（CC0-1.0）。我们只做仓库级去重、每日快照、榜单与衍生指标。
          </p>
        </div>
      </section>

      <section className="card mb-4">
        <div className="card-body">
          <h2 className="fs-lg fw-semibold">2. 许可范围</h2>
          <ul className="mt-2 mb-0 ps-4 fg-secondary">
            <li className="mb-2">
              <strong className="fg-body">每日快照</strong>（仓库里的 <code>data/snapshots/</code>）：按{' '}
              <a className={LINK} href="https://creativecommons.org/licenses/by/4.0/deed.zh" target="_blank" rel="noreferrer">
                CC BY 4.0
              </a>{' '}
              提供，转载、研究、做二次分析都可以，但必须保留署名并链接回 harnesspack.dev。
            </li>
            <li className="mb-2">
              <strong className="fg-body">站点内容</strong>（文案、图表、页面排版、徽章/分享图样式）：按 CC BY-NC 4.0 提供，禁止直接商用或整体复制成竞争站点。
            </li>
            <li>
              <strong className="fg-body">代码</strong>：MIT，见仓库 <code>LICENSE</code>。
            </li>
          </ul>
        </div>
      </section>

      <section className="card mb-4">
        <div className="card-body">
          <h2 className="fs-lg fw-semibold">3. 你可以做什么</h2>
          <ul className="mt-2 mb-0 ps-4 fg-secondary">
            <li className="mb-1">在 README、博客、论文里引用榜单或曲线，附上来源链接即可。</li>
            <li className="mb-1">用公开 API 做个人工具、机器人、看板；合理频率下无需申请。</li>
            <li className="mb-1">下载快照做研究、复现榜单，或提交 issue 指出数据错误。</li>
            <li>嵌入徽章 / 分享图 / RSS；这些资源本身带回流链接。</li>
          </ul>
        </div>
      </section>

      <section className="card mb-4">
        <div className="card-body">
          <h2 className="fs-lg fw-semibold">4. 请不要做什么</h2>
          <ul className="mt-2 mb-0 ps-4 fg-secondary">
            <li className="mb-1">用自动化手段绕过限流、批量抓取全量历史，用于转售或搭建替代站点。</li>
            <li className="mb-1">去掉署名、伪造来源，或把数据包装成你自己的原始观测。</li>
            <li className="mb-1">对站点发起压力测试、爬取式攻击，或影响其他访客的正常使用。</li>
            <li>用榜单结果做投资建议、排名承诺或付费“保榜”宣传。</li>
          </ul>
        </div>
      </section>

      <section className="card mb-4">
        <div className="card-body">
          <h2 className="fs-lg fw-semibold">5. API 与限流</h2>
          <p className="mt-2 mb-0 fg-secondary">
            只读 JSON，前缀 <code>/api/v1</code>。默认每 IP 每分钟 120 次；<code>/og/</code> 图片每分钟 20 次。
            超限返回 <code>429</code> 与 <code>Retry-After</code>。需要更高配额或批量导出，请在{' '}
            <a className={LINK} href={`${REPO}/issues`} target="_blank" rel="noreferrer">
              仓库 issue
            </a>{' '}
            说明用途。
          </p>
        </div>
      </section>

      <section className="card mb-4">
        <div className="card-body">
          <h2 className="fs-lg fw-semibold">6. 免责声明</h2>
          <p className="mt-2 mb-0 fg-secondary">
            数据按「现状」提供，不保证完整、实时或无误差；star 数可能被第三方操纵，我们只做异常标注、不改原始记录。
            本站非 DeepSeek 官方项目，榜单不构成任何形式的推荐或投资建议。
          </p>
        </div>
      </section>

      <section className="card">
        <div className="card-body">
          <h2 className="fs-lg fw-semibold">7. 变更与联系</h2>
          <p className="mt-2 mb-0 fg-secondary">
            条款变更会随代码提交记录公开。问题、授权申请或下架请求，请到{' '}
            <a className={LINK} href={`${REPO}/issues`} target="_blank" rel="noreferrer">
              GitHub Issues
            </a>
            ；一般 7 天内回复。另见{' '}
            <Link className={LINK} to="/about#rules">
              收录规则
            </Link>{' '}
            与{' '}
            <Link className={LINK} to="/about">
              数据口径
            </Link>
            。
          </p>
        </div>
      </section>

      <p className="mt-4 mb-0 fs-xs fg-secondary">最后更新：2026-11-20。本页不构成法律意见。</p>
    </article>
  );
}
