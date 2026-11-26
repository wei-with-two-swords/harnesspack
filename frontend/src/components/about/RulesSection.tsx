import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { useI18n } from '../../lib/i18n';

const UPSTREAM = 'https://github.com/awesome-dsh-plugin/awesome-dsh-plugin';
const LINK = 'text-decoration-none';

export default function RulesSection() {
  const { t } = useI18n();
  return (
    <section id="rules" className="card mb-4 hp-anchor">
      <div className="card-body">
        <h2 className="fs-xl fw-semibold mb-2">{t('about.rules')}</h2>
        <p className="fs-sm fg-secondary">
          {t('rules.leadA')}{' '}
          <a className={LINK} href={UPSTREAM} target="_blank" rel="noreferrer">
            awesome-dsh-plugin<ExternalLink className="icon-trailing" aria-hidden="true" />
          </a>{' '}
          {t('rules.leadB')}
        </p>

        <h3 className="fs-md fw-semibold mt-4">{t('rules.howTitle')}</h3>
        <ul className="mt-2 mb-0 ps-4 fs-sm fg-secondary">
          <li className="mb-1">{t('rules.how1')}</li>
          <li className="mb-1">{t('rules.how2')}</li>
          <li>{t('rules.how3')}</li>
        </ul>

        <h3 className="fs-md fw-semibold mt-4">{t('rules.upstreamTitle')}</h3>
        <ul className="mt-2 mb-0 ps-4 fs-sm fg-secondary">
          <li className="mb-1">{t('rules.up1')}</li>
          <li className="mb-1">
            {t('rules.up2A')}
            <code className="bg-subtle-secondary px-1 rounded">dsh.bundle</code>
            {t('rules.up2B')}
          </li>
          <li className="mb-1">{t('rules.up3')}</li>
          <li>{t('rules.up4')}</li>
        </ul>

        <h3 className="fs-md fw-semibold mt-4">{t('rules.syncTitle')}</h3>
        <ul className="mt-2 mb-0 ps-4 fs-sm fg-secondary">
          <li className="mb-1">{t('rules.sync1')}</li>
          <li className="mb-1">{t('rules.sync2')}</li>
          <li className="mb-1">{t('rules.sync3')}</li>
          <li>{t('rules.sync4')}</li>
        </ul>

        <p className="mt-4 mb-0 fs-sm fg-secondary">
          {t('rules.footA')}<code>docs/收录规则.md</code>
          {t('rules.footB')}{' '}
          <Link to="/changelog" className={LINK}>
            {t('link.catalogChanges')}
          </Link>
          {t('rules.footC')}
        </p>
      </div>
    </section>
  );
}
