import { useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import RulesSection from '../components/about/RulesSection';
import SubmitSection from '../components/about/SubmitSection';
import DataSection from '../components/about/DataSection';
import TermsSection from '../components/about/TermsSection';
import { useTitle } from '../lib/useTitle';
import { useI18n } from '../lib/i18n';

const ANCHORS = [
  { id: 'intro', key: 'about.intro' },
  { id: 'rules', key: 'about.rules' },
  { id: 'submit', key: 'about.submit' },
  { id: 'data', key: 'about.data' },
  { id: 'terms', key: 'about.terms' },
];

export default function About() {
  const { t } = useI18n();
  useTitle(t('about.title'), t('about.metaDesc'));
  const { hash } = useLocation();

  useEffect(() => {
    if (!hash) return;
    const el = document.getElementById(hash.slice(1));
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, [hash]);

  return (
    <article className="fs-sm">
      <header id="intro" className="mb-4 hp-anchor">
        <h1 className="fs-3xl fw-semibold mb-2">{t('about.h1')}</h1>
        <p className="mb-3 fg-secondary" style={{ maxWidth: 'var(--measure)' }}>
          {t('about.lead')}
        </p>
        <nav className="d-flex flex-wrap gap-3" aria-label={t('about.toc')}>
          {ANCHORS.map((item) => (
            <Link key={item.id} to={`/about#${item.id}`} className="text-decoration-none">
              {t(item.key)}
            </Link>
          ))}
        </nav>
      </header>

      <div className="row g-3 align-items-start">
        <div className="col-12 lg:col-6">
          <RulesSection />
          <DataSection />
        </div>
        <div className="col-12 lg:col-6">
          <SubmitSection />
          <TermsSection />
        </div>
      </div>
    </article>
  );
}
