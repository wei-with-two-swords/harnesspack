import { useEffect, useState } from 'react';
import { useI18n } from '../lib/i18n';

/** Floating button that appears after scrolling down and returns to the top. */
export function BackToTop() {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 400);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      type="button"
      className="back-to-top"
      aria-label={t('common.backToTop')}
      title={t('common.backToTop')}
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
    >
      <svg width="20" height="20" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M8 3.5a.75.75 0 0 1 .53.22l4.25 4.25a.75.75 0 1 1-1.06 1.06L8 5.31 4.28 9.03a.75.75 0 0 1-1.06-1.06l4.25-4.25A.75.75 0 0 1 8 3.5Z" />
        <path d="M8 7a.75.75 0 0 1 .53.22l2.75 2.75a.75.75 0 1 1-1.06 1.06L8 8.81 5.78 11.03a.75.75 0 0 1-1.06-1.06L7.47 7.22A.75.75 0 0 1 8 7Z" opacity=".55" />
      </svg>
    </button>
  );
}
