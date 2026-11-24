import { Link } from 'react-router-dom';

const UPSTREAM = 'https://github.com/awesome-dsh-plugin/awesome-dsh-plugin';
const UPSTREAM_NEW = `${UPSTREAM}/blob/main/data/plugins/README.md`;
const ISSUE = 'https://github.com/wei-with-two-swords/harnesspack/issues/new/choose';

const LINK = 'text-decoration-none';

const PR_BODY = `## 新增插件
- 仓库：https://github.com/<owner>/<repo>
- 分类：<ui|tools|session|...>
- 描述（英文，句号结尾）：<one sentence>
- 图标（可选）：<GitHub-hosted image url>
- tarball（可选）：<https .tgz from a GitHub release>

## 自检
- [ ] package.json 声明了 dsh.bundle 与 cordis.patch.yml
- [ ] 仓库已加 dsh-plugin topic
- [ ] README 里写清安装方式（dsh plugin add ...）
`;

export default function SubmitSection() {
  const prUrl = `${UPSTREAM}/issues/new?title=${encodeURIComponent('[plugin] <owner>/<repo>')}&body=${encodeURIComponent(PR_BODY)}`;
  return (
    <section id="submit" className="card mb-4 hp-anchor">
      <div className="card-body">
        <h2 className="fs-xl fw-semibold mb-2">插件提交</h2>
        <p className="fs-sm fg-secondary">
          HarnessPack 的名单与分类直接来自 awesome-dsh-plugin 精选清单。想让插件出现在这里，
          请先提交到上游；我们每天同步一次，收录后第二天开始有曲线。
        </p>

        <h3 className="fs-md fw-semibold mt-4">两步提交</h3>
        <ol className="ps-4 fs-sm fg-secondary mb-0">
          <li className="mb-2">
            确认仓库可安装：<code>package.json</code> 里有 <code>dsh.bundle</code>（配{' '}
            <code>cordis.patch.yml</code>），仓库有 <code>dsh-plugin</code> topic，README 写清安装命令。
          </li>
          <li>
            去上游提 PR：在 <code>data/plugins/&lt;owner&gt;__&lt;repo&gt;.yml</code> 新增一个文件
            （url、name、category、description.en 必填），格式见{' '}
            <a href={UPSTREAM_NEW} target="_blank" rel="noreferrer noopener" className={LINK}>
              上游说明
            </a>
            。
          </li>
        </ol>
        <div className="mt-4 d-flex flex-wrap gap-2">
          <a href={prUrl} target="_blank" rel="noreferrer noopener" className="btn btn-solid theme-secondary">
            用模板发起上游 PR / Issue
          </a>
          <a href={UPSTREAM} target="_blank" rel="noreferrer noopener" className="btn btn-outline theme-secondary">
            打开 awesome-dsh-plugin
          </a>
        </div>

        <h3 className="fs-md fw-semibold mt-4">提交后会发生什么</h3>
        <ul className="list-unstyled fs-sm fg-secondary mb-0">
          <li className="mb-1">· 上游合并后，我们下一次每日同步会自动收录（通常一天内）。</li>
          <li className="mb-1">· 新插件首日只有基线，第二天开始有「今日增量」和曲线。</li>
          <li className="mb-1">· 满 30 天且 star ≥ 10 才会进入最新榜。</li>
          <li>· 被上游移除时保留历史曲线，但退出所有榜单。</li>
        </ul>

        <h3 className="fs-md fw-semibold mt-4">数据不对 / 想申诉？</h3>
        <p className="fs-sm fg-secondary mb-2">
          榜单、退出、异常标记有异议，可以直接在本站仓库提 issue，7 天内回复；
          也可以在插件详情页点「数据有误 / 申诉」。
        </p>
        <div className="d-flex flex-wrap gap-2">
          <a href={ISSUE} target="_blank" rel="noreferrer noopener" className="btn btn-outline theme-secondary">
            在本站提 issue
          </a>
          <Link to="/about/changelog" className="btn btn-outline theme-secondary">
            名单变更
          </Link>
        </div>
      </div>
    </section>
  );
}
