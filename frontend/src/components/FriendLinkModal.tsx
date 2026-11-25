import { useEffect, useState, type FormEvent } from 'react';
import { ExternalLink, X } from 'lucide-react';
import { useI18n } from '../lib/i18n';
import { copyText } from '../lib/clipboard';

const SITE = {
  name: 'HarnessPack',
  url: 'https://harnesspack.dev',
  icon: 'https://harnesspack.dev/favicon-180.png',
  descEn:
    'DeepSeek Harness plugin rankings by real GitHub STARs and npm downloads. Daily snapshots, no embellishment.',
  descZh:
    '收录社区 DeepSeek Harness 插件，按真实 GitHub STAR 与 npm 下载量排名。',
};

const ISSUE_URL =
  'https://github.com/wei-with-two-swords/harnesspack/issues/new?labels=friend-link';

function CopyRow({ label, value }: { label: string; value: string }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    if (!(await copyText(value))) return;
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <div className="copy-line">
      <span className="copy-line-label">{label}</span>
      <code className="copy-line-code" title={value}>{value}</code>
      <button type="button" onClick={handleCopy} className="btn btn-outline btn-sm flex-shrink-0">
        {copied ? t('common.copied') : t('common.copy')}
      </button>
    </div>
  );
}

export function FriendLinkModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t, lang } = useI18n();
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [icon, setIcon] = useState('');
  const [desc, setDesc] = useState('');

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const description = lang === 'zh' ? SITE.descZh : SITE.descEn;
  const allInfo = [
    `${t('friend.siteName')}: ${SITE.name}`,
    `${t('friend.siteUrl')}: ${SITE.url}`,
    `${t('friend.siteIcon')}: ${SITE.icon}`,
    `${t('friend.siteDesc')}: ${description}`,
  ].join('\n');

  const handleCopyAll = async () => {
    if (await copyText(allInfo)) {
      const btn = document.getElementById('friend-copy-all');
      if (btn) {
        const original = btn.textContent;
        btn.textContent = t('common.copied');
        window.setTimeout(() => { btn.textContent = original; }, 1600);
      }
    }
  };

  const handleApply = (e: FormEvent) => {
    e.preventDefault();
    const body = [
      `站点名称：${name}`,
      `站点网址：${url}`,
      `站点图标：${icon || '（未提供）'}`,
      `站点描述：${desc || '（未提供）'}`,
    ].join('\n');
    const href = `${ISSUE_URL}&title=${encodeURIComponent(`友链申请：${name}`)}&body=${encodeURIComponent(body)}`;
    window.open(href, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="friend-overlay" onClick={onClose} role="presentation">
      <div
        className="friend-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t('friend.title')}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="friend-dialog-head">
          <div className="friend-dialog-head-text">
            <h2 className="fs-lg fw-semibold mb-1">{t('friend.title')}</h2>
            <p className="fs-xs fg-secondary mb-0">{t('friend.subtitle')}</p>
          </div>
          <button type="button" className="btn-icon friend-close" onClick={onClose} aria-label={t('friend.close')}>
            <X aria-hidden="true" />
          </button>
        </div>

        <div className="friend-site">
          <img src="/favicon-180.png" alt="" width="40" height="40" className="friend-site-icon" />
          <div className="min-w-0">
            <div className="fw-semibold">{SITE.name}</div>
            <div className="fs-xs fg-secondary">{description}</div>
          </div>
        </div>

        <div className="friend-info-rows">
          <CopyRow label={t('friend.siteName')} value={SITE.name} />
          <CopyRow label={t('friend.siteUrl')} value={SITE.url} />
          <CopyRow label={t('friend.siteIcon')} value={SITE.icon} />
          <CopyRow label={t('friend.siteDesc')} value={description} />
        </div>
        <div className="friend-copy-all-row">
          <button id="friend-copy-all" type="button" onClick={handleCopyAll} className="btn btn-outline btn-sm">
            {t('friend.copyAll')}
          </button>
        </div>

        <form className="friend-apply" onSubmit={handleApply}>
          <h3 className="fs-sm fw-semibold mb-1">{t('friend.applyTitle')}</h3>
          <p className="fs-xs fg-secondary mb-2">{t('friend.applyHint')}</p>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder={t('friend.fieldName')} required />
          <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder={t('friend.fieldUrl')} type="url" required />
          <input value={icon} onChange={(e) => setIcon(e.target.value)} placeholder={t('friend.fieldIcon')} type="url" />
          <textarea value={desc} onChange={(e) => setDesc(e.target.value)} placeholder={t('friend.fieldDesc')} rows={2} />
          <button type="submit" className="btn btn-outline btn-sm">
            {t('friend.applySubmit')}<ExternalLink className="icon-trailing" aria-hidden="true" />
          </button>
        </form>
      </div>
    </div>
  );
}
