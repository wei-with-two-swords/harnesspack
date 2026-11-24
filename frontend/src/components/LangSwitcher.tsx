import { applyLang, useI18n } from '../lib/i18n';

/** Compact EN/中文 toggle button. */
export function LangSwitcher() {
  const { lang, t } = useI18n();
  const next = lang === 'en' ? 'zh' : 'en';
  return (
    <button
      type="button"
      className="btn btn-sm btn-outline lang-trigger"
      aria-label={t('nav.lang')}
      title={t('nav.lang')}
      onClick={() => applyLang(next)}
    >
      {lang === 'en' ? '中文' : 'EN'}
    </button>
  );
}
