import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';

const UPSTREAM = 'https://github.com/awesome-dsh-plugin/awesome-dsh-plugin';
const LINK = 'text-decoration-none';

export default function RulesSection() {
  return (
    <section id="rules" className="card mb-4 hp-anchor">
      <div className="card-body">
        <h2 className="fs-xl fw-semibold mb-2">收录规则</h2>
        <p className="fs-sm fg-secondary">
          我们不自己评审“谁是好插件”，名单与分类直接来自{' '}
          <a className={LINK} href={UPSTREAM} target="_blank" rel="noreferrer">
            awesome-dsh-plugin<ExternalLink className="icon-trailing" aria-hidden="true" />
          </a>{' '}
          精选清单（CC0-1.0），我们只负责仓库级去重、每日 STAR 快照与退出。
        </p>

        <h3 className="fs-md fw-semibold mt-4">名单怎么来</h3>
        <ul className="mt-2 mb-0 ps-4 fs-sm fg-secondary">
          <li className="mb-1">每天同步上游 plugins.json，按 GitHub 仓库去重（同一仓库多个条目只保留 STAR 最高的一个）。</li>
          <li className="mb-1">上游按目录链接收录的条目（/tree/...）会归一到仓库级。</li>
          <li>分类沿用上游 23 个分类，不在我们这里二次评审。</li>
        </ul>

        <h3 className="fs-md fw-semibold mt-4">上游收录标准（摘要）</h3>
        <ul className="mt-2 mb-0 ps-4 fs-sm fg-secondary">
          <li className="mb-1">仓库公开、真实可运行；不能只是占位或纯 README。</li>
          <li className="mb-1">
            package.json 需声明 <code className="bg-subtle-secondary px-1 rounded">dsh.bundle</code>（配
            cordis.patch.yml）；只声明 dsh.client 无法安装，会被拒。
          </li>
          <li className="mb-1">仓库创建满 1 天、持续维护，并加 dsh-plugin topic。</li>
          <li>描述必须与代码一致；夸大或与代码不符会被打回。</li>
        </ul>

        <h3 className="fs-md fw-semibold mt-4">每日同步与退出</h3>
        <ul className="mt-2 mb-0 ps-4 fs-sm fg-secondary">
          <li className="mb-1">每天 00:10 UTC 用 GitHub GraphQL 批量抓取一次 STAR，写入当日快照。</li>
          <li className="mb-1">上游移除的仓库：保留历史曲线，不再参与榜单（退出原因记录在名单变更里）。</li>
          <li className="mb-1">仓库被删除或改名（404）：记为退出；历史数据不删除、不插值。</li>
          <li>STAR 异常单日暴涨会被标记“异常”，但仍保留原始数据，不美化、不删除。</li>
        </ul>

        <p className="mt-4 mb-0 fs-sm fg-secondary">
          完整规则见仓库 <code>docs/收录规则.md</code>；每次同步的变更记录在{' '}
          <Link to="/about/changelog" className={LINK}>
            名单变更
          </Link>{' '}
          页，可审计。
        </p>
      </div>
    </section>
  );
}
