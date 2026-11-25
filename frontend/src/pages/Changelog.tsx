import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import ChangelogSection from '../components/about/ChangelogSection';
import StatusSection from '../components/about/StatusSection';
import { useTitle } from '../lib/useTitle';
import { useI18n } from '../lib/i18n';

const LINK = 'text-decoration-none';

export default function Changelog() {
  const { t } = useI18n();
  useTitle(t('changelog.title'), t('changelog.metaDesc'));
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash]);

  return (
    <article className="fs-sm">
      <header className="mb-4">
        <h1 className="fs-3xl fw-semibold mb-2">{t('changelog.h1')}</h1>
        <p className="fg-secondary mb-0" style={{ maxWidth: 'var(--measure)' }}>
          {t('changelog.leadA')}<Link to="/about#data" className={LINK}>{t('link.dataMethods')}</Link>
          {t('changelog.leadB')}<Link to="/about#rules" className={LINK}>{t('link.inclusionRules')}</Link>
          {t('changelog.leadC')}
        </p>
      </header>

      <StatusSection />
      <ChangelogSection />
    </article>
  );
}
