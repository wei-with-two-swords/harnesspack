import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { useI18n } from '../../lib/i18n';

const REPO = 'https://github.com/wei-with-two-swords/harnesspack';
const LINK = 'text-decoration-none';

export default function TermsSection() {
  const { t } = useI18n();
  return (
    <section id="terms" className="hp-anchor mb-4">
      <h2 className="fs-xl fw-semibold mb-2">{t('about.terms')}</h2>
      <p className="fs-sm fg-secondary mb-3">{t('terms.lead')}</p>

      <section className="card mb-4">
        <div className="card-body">
          <h3 className="fs-lg fw-semibold">{t('terms.s1Title')}</h3>
          <p className="mt-2 mb-0 fg-secondary">
            {t('terms.s1A')}{' '}
            <a className={LINK} href="https://github.com/awesome-dsh-plugin/awesome-dsh-plugin" target="_blank" rel="noreferrer">
              awesome-dsh-plugin<ExternalLink className="icon-trailing" aria-hidden="true" />
            </a>{' '}
            {t('terms.s1B')}
          </p>
        </div>
      </section>

      <section className="card mb-4">
        <div className="card-body">
          <h3 className="fs-lg fw-semibold">{t('terms.s2Title')}</h3>
          <ul className="mt-2 mb-0 ps-4 fg-secondary">
            <li className="mb-2">
              <strong className="fg-body">{t('terms.lic1A')}</strong>
              {t('terms.lic1B')}<code>data/snapshots/</code>
              {t('terms.lic1C')}{' '}
              <a className={LINK} href="https://creativecommons.org/licenses/by/4.0/deed.zh" target="_blank" rel="noreferrer">
                CC BY 4.0<ExternalLink className="icon-trailing" aria-hidden="true" />
              </a>
              {t('terms.lic1D')}
            </li>
            <li className="mb-2">
              <strong className="fg-body">{t('terms.lic2A')}</strong>
              {t('terms.lic2B')}
            </li>
            <li>
              <strong className="fg-body">{t('terms.lic3A')}</strong>
              {t('terms.lic3B')}<code>LICENSE</code>
              {t('terms.lic3C')}
            </li>
          </ul>
        </div>
      </section>

      <section className="card mb-4">
        <div className="card-body">
          <h3 className="fs-lg fw-semibold">{t('terms.s3Title')}</h3>
          <ul className="mt-2 mb-0 ps-4 fg-secondary">
            <li className="mb-1">{t('terms.ok1')}</li>
            <li className="mb-1">{t('terms.ok2')}</li>
            <li className="mb-1">{t('terms.ok3')}</li>
            <li>{t('terms.ok4')}</li>
          </ul>
        </div>
      </section>

      <section className="card mb-4">
        <div className="card-body">
          <h3 className="fs-lg fw-semibold">{t('terms.s4Title')}</h3>
          <ul className="mt-2 mb-0 ps-4 fg-secondary">
            <li className="mb-1">{t('terms.no1')}</li>
            <li className="mb-1">{t('terms.no2')}</li>
            <li className="mb-1">{t('terms.no3')}</li>
            <li>{t('terms.no4')}</li>
          </ul>
        </div>
      </section>

      <section className="card mb-4">
        <div className="card-body">
          <h3 className="fs-lg fw-semibold">{t('terms.s5Title')}</h3>
          <p className="mt-2 mb-0 fg-secondary">
            {t('terms.s5A')}<code>/api/v1</code>
            {t('terms.s5B')}<code>/og/</code>
            {t('terms.s5C')}<code>429</code>
            {t('terms.s5D')}<code>Retry-After</code>
            {t('terms.s5E')}{' '}
            <a className={LINK} href={`${REPO}/issues`} target="_blank" rel="noreferrer">
              {t('link.repoIssues')}<ExternalLink className="icon-trailing" aria-hidden="true" />
            </a>
            {t('terms.s5F')}
          </p>
        </div>
      </section>

      <section className="card mb-4">
        <div className="card-body">
          <h3 className="fs-lg fw-semibold">{t('terms.s6Title')}</h3>
          <p className="mt-2 mb-0 fg-secondary">{t('terms.s6Body')}</p>
        </div>
      </section>

      <section className="card">
        <div className="card-body">
          <h3 className="fs-lg fw-semibold">{t('terms.s7Title')}</h3>
          <p className="mt-2 mb-0 fg-secondary">
            {t('terms.s7A')}{' '}
            <a className={LINK} href={`${REPO}/issues`} target="_blank" rel="noreferrer">
              GitHub Issues<ExternalLink className="icon-trailing" aria-hidden="true" />
            </a>
            {t('terms.s7B')}{' '}
            <Link className={LINK} to="/about#rules">{t('link.inclusionRules')}</Link>
            {t('terms.s7C')}{' '}
            <Link className={LINK} to="/about#data">{t('link.dataMethods')}</Link>
            {t('terms.s7D')}
          </p>
        </div>
      </section>

      <p className="mt-4 mb-0 fs-xs fg-secondary">{t('terms.updated')}</p>
    </section>
  );
}
