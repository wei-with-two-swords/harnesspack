import { Link } from 'react-router-dom';
import { useTitle } from '../lib/useTitle';

const UPSTREAM = 'https://github.com/awesome-dsh-plugin/awesome-dsh-plugin';
const LINK = 'text-decoration-none';

export default function Rules() {
  useTitle('收录规则', 'HarnessPack 的名单来源、收录标准、每日同步与退出机制。');
  return (
    <section style={{ maxWidth: '48rem' }}>
      <div className="mb-4">
        <h1 className="fs-3xl fw-semibold mb-1">收录规则</h1>
        <p className="fs-sm fg-secondary mb-0">
          我们不自己评审“谁是好插件”，名单与分类直接来自{' '}
          <a className={LINK} href={UPSTREAM} target="_blank" rel="noreferrer">
            awesome-dsh-plugin
          </a>{' '}
          精选清单（CC0-1.0），我们只负责仓库级去重、每日 star 快照与退出。
        </p>
      </div>

      <article className="card mb-4">
        <div className="card-body">
          <h2 className="fs-lg fw-semibold">名单怎么来</h2>
          <ul className="mt-2 mb-0 ps-4 fs-sm fg-secondary">
            <li className="mb-1">每天同步上游 plugins.json，按 GitHub 仓库去重（同一仓库多个条目只保留 star 最高的一个）。</li>
            <li className="mb-1">上游按目录链接收录的条目（/tree/...）会归一到仓库级。</li>
            <li>分类沿用上游 23 个分类，不在我们这里二次评审。</li>
          </ul>
        </div>
      </article>

      <article className="card mb-4">
        <div className="card-body">
          <h2 className="fs-lg fw-semibold">上游收录标准（摘要）</h2>
          <ul className="mt-2 mb-0 ps-4 fs-sm fg-secondary">
            <li className="mb-1">仓库公开、真实可运行；不能只是占位或纯 README。</li>
            <li className="mb-1">
              package.json 需声明 <code className="bg-subtle-secondary px-1 rounded">dsh.bundle</code>（配
              cordis.patch.yml）；只声明 dsh.client 无法安装，会被拒。
            </li>
            <li className="mb-1">仓库创建满 1 天、持续维护，并加 dsh-plugin topic。</li>
            <li>描述必须与代码一致；夸大或与代码不符会被打回。</li>
          </ul>
        </div>
      </article>

      <article className="card mb-4">
        <div className="card-body">
          <h2 className="fs-lg fw-semibold">每日同步与退出</h2>
          <ul className="mt-2 mb-0 ps-4 fs-sm fg-secondary">
            <li className="mb-1">每天 00:10 UTC 用 GitHub GraphQL 批量抓取一次 star，写入当日快照。</li>
            <li className="mb-1">上游移除的仓库：保留历史曲线，不再参与榜单（退出原因记录在名单变更里）。</li>
            <li className="mb-1">仓库被删除或改名（404）：记为退出；历史数据不删除、不插值。</li>
            <li>star 异常单日暴涨会被标记“异常”，但仍保留原始数据，不美化、不删除。</li>
          </ul>
        </div>
      </article>

      <article className="card">
        <div className="card-body">
          <h2 className="fs-lg fw-semibold">如何提交收录</h2>
          <p className="mt-2 fs-sm fg-secondary">
            提交入口在上游：向 awesome-dsh-plugin 仓库提 PR，按
            <code className="mx-1 bg-subtle-secondary px-1 rounded">data/plugins/&lt;owner&gt;__&lt;repo&gt;.yml</code>
            新增一条（url、name、category、description.en 必填）。上游合并后，我们的下一次同步会自动收录。
          </p>
          <p className="mt-2 mb-0 fs-sm fg-secondary">
            对线上数据有异议（榜单、退出、异常标记）可以在{' '}
            <a
              href="https://github.com/wei-with-two-swords/harnesspack/issues"
              className={LINK}
              target="_blank"
              rel="noreferrer"
            >
              本站仓库
            </a>{' '}
            提 issue，7 天内答复。
          </p>
        </div>
      </article>

      <div className="mt-4 d-flex gap-4 fs-sm">
        <Link to="/about" className={LINK}>
          ← 数据口径
        </Link>
        <Link to="/about/changelog" className={LINK}>
          名单变更 →
        </Link>
      </div>
    </section>
  );
}
