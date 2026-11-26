import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { useI18n } from '../../lib/i18n';

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
  const { t } = useI18n();
  const prUrl = `${UPSTREAM}/issues/new?title=${encodeURIComponent('[plugin] <owner>/<repo>')}&body=${encodeURIComponent(PR_BODY)}`;
  return (
    <section id="submit" className="card mb-4 hp-anchor">
      <div className="card-body">
        <h2 className="fs-xl fw-semibold mb-2">{t('about.submit')}</h2>
        <p className="fs-sm fg-secondary">{t('submit.lead')}</p>

        <h3 className="fs-md fw-semibold mt-4">{t('submit.stepsTitle')}</h3>
        <ol className="ps-4 fs-sm fg-secondary mb-0">
          <li className="mb-2">
            {t('submit.step1A')}<code>package.json</code>{t('submit.step1B')}<code>dsh.bundle</code>
            {t('submit.step1C')}<code>cordis.patch.yml</code>{t('submit.step1D')}<code>dsh-plugin</code>
            {t('submit.step1E')}
          </li>
          <li>
            {t('submit.step2A')}<code>data/plugins/&lt;owner&gt;__&lt;repo&gt;.yml</code>
            {t('submit.step2B')}{' '}
            <a href={UPSTREAM_NEW} target="_blank" rel="noreferrer noopener" className={LINK}>
              {t('link.upstreamGuide')}<ExternalLink className="icon-trailing" aria-hidden="true" />
            </a>
            {t('submit.step2C')}
          </li>
        </ol>
        <div className="mt-4 d-flex flex-wrap gap-2">
          <a href={prUrl} target="_blank" rel="noreferrer noopener" className="btn btn-solid">
            {t('submit.prButton')}<ExternalLink className="icon-trailing" aria-hidden="true" />
          </a>
          <a href={UPSTREAM} target="_blank" rel="noreferrer noopener" className="btn btn-outline">
            {t('submit.upstreamButton')}<ExternalLink className="icon-trailing" aria-hidden="true" />
          </a>
        </div>

        <h3 className="fs-md fw-semibold mt-4">{t('submit.afterTitle')}</h3>
        <ul className="list-unstyled fs-sm fg-secondary mb-0">
          <li className="mb-1">{t('submit.after1')}</li>
          <li className="mb-1">{t('submit.after2')}</li>
          <li className="mb-1">{t('submit.after3')}</li>
          <li>{t('submit.after4')}</li>
        </ul>

        <h3 className="fs-md fw-semibold mt-4">{t('submit.appealTitle')}</h3>
        <p className="fs-sm fg-secondary mb-2">{t('submit.appealBody')}</p>
        <div className="d-flex flex-wrap gap-2">
          <a href={ISSUE} target="_blank" rel="noreferrer noopener" className="btn btn-outline">
            {t('submit.issueButton')}<ExternalLink className="icon-trailing" aria-hidden="true" />
          </a>
          <Link to="/changelog" className="btn btn-outline">
            {t('link.catalogChanges')}
          </Link>
        </div>
      </div>
    </section>
  );
}
