import { useEffect } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { useI18n } from '../lib/i18n';

const UPSTREAM = 'https://github.com/awesome-dsh-plugin/awesome-dsh-plugin';
const PR_TITLE = '[plugin] <owner>/<repo>';
const PR_BODY = `## 新增插件
- 仓库：https://github.com/<owner>/<repo>
- 分类：<ui|tools|session|...>
- 描述（英文，句号结尾）：<one sentence.>
- 图标（可选）：<GitHub-hosted image url>
- tarball（可选）：<https .tgz from a GitHub release>

## 自检
- [ ] package.json 声明了 dsh.bundle 与 cordis.patch.yml
- [ ] 仓库已加 dsh-plugin topic
- [ ] README 里写清安装方式（dsh plugin add ...）
`;
const PR_URL = `${UPSTREAM}/compare?quick_pull=1&title=${encodeURIComponent(PR_TITLE)}&body=${encodeURIComponent(PR_BODY)}`;

export function SubmitModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="friend-overlay" onClick={onClose} role="presentation">
      <div
        className="friend-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t('hero.submit')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="friend-dialog-head">
          <div className="friend-dialog-head-text">
            <h2 className="fs-lg fw-semibold mb-1">{t('hero.submit')}</h2>
            <p className="fs-xs fg-secondary mb-0">{t('hero.submitIntro')}</p>
          </div>
          <button type="button" className="btn-icon friend-close" onClick={onClose} aria-label={t('common.close')}>
            <X aria-hidden="true" />
          </button>
        </div>
        <div className="mt-4 d-flex flex-wrap gap-2">
          <a href={PR_URL} target="_blank" rel="noreferrer noopener" className="btn btn-solid">
            {t('hero.submitPr')}<ExternalLink className="icon-trailing" aria-hidden="true" />
          </a>
          <a href={UPSTREAM} target="_blank" rel="noreferrer noopener" className="btn btn-outline">
            {t('hero.submitRepo')}<ExternalLink className="icon-trailing" aria-hidden="true" />
          </a>
        </div>
      </div>
    </div>
  );
}
