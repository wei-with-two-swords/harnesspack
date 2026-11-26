import { Link } from 'react-router-dom';
import { ExternalLink } from 'lucide-react';
import { useI18n } from '../../lib/i18n';

const UPSTREAM = 'https://github.com/awesome-dsh-plugin/awesome-dsh-plugin';
const LINK = 'text-decoration-none';

export default function DataSection() {
  const { t } = useI18n();
  const boards: [string, string][] = [
    [t('data.board.velocity'), t('data.board.velocityDesc')],
    [t('data.board.growth'), t('data.board.growthDesc')],
    [t('data.board.total'), t('data.board.totalDesc')],
    [t('data.board.darkhorse'), t('data.board.darkhorseDesc')],
    [t('data.board.rookie'), t('data.board.rookieDesc')],
    [t('data.board.quality'), t('data.board.qualityDesc')],
    [t('data.board.npm'), t('data.board.npmDesc')],
  ];

  return (
    <section id="data" className="hp-anchor mb-4">
      <h2 className="fs-xl fw-semibold mb-2">{t('about.data')}</h2>
      <p className="mb-3 fg-secondary fs-sm">{t('data.lead')}</p>

      <section className="card mb-4">
        <div className="card-body">
          <h3 className="fs-lg fw-semibold">{t('data.sourceTitle')}</h3>
          <p className="mt-2 fg-secondary">
            {t('data.sourceA')}{' '}
            <a className={LINK} href="https://awesome-dsh-plugin.com" target="_blank" rel="noreferrer">
              awesome-dsh-plugin<ExternalLink className="icon-trailing" aria-hidden="true" />
            </a>{' '}
            {t('data.sourceB')}
            <code>dsh plugin add</code>
            {t('data.sourceC')}
            <code>dsh.bundle</code>
            {t('data.sourceD')}
          </p>
          <p className="mt-3 fg-secondary">
            {t('data.sourceP2A')}
            <code className="num">stargazerCount</code>
            {t('data.sourceP2B')}
          </p>
          <p className="mt-3 mb-0 fg-secondary">{t('data.sourceP3')}</p>
        </div>
      </section>

      <section className="card mb-4">
        <div className="card-body">
          <h3 className="fs-lg fw-semibold">{t('data.boardsTitle')}</h3>
          <dl className="mt-3 mb-0">
            {boards.map(([name, desc]) => (
              <div key={name} className="d-flex gap-4 py-2 border-bottom">
                <dt className="flex-shrink-0 fw-medium fg-warning" style={{ width: 'var(--s-7)' }}>
                  {name}
                </dt>
                <dd className="mb-0 fg-secondary">{desc}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 mb-0 fs-xs fg-secondary">
            {t('data.boardsFoot')}
            <Link className={LINK} to="/changelog#status">{t('link.dataStatus')}</Link>
            {t('data.boardsFootEnd')}
          </p>
        </div>
      </section>

      <section className="card mb-4">
        <div className="card-body">
          <h3 className="fs-lg fw-semibold">{t('data.npmTitle')}</h3>
          <p className="mt-2 fg-secondary">
            {t('data.npmA1')}
            <strong>{t('data.npmSide')}</strong>
            {t('data.npmA2')}
            <code>api.npmjs.org/downloads</code>
            {t('data.npmA3')}
          </p>
          <p className="mt-3 fg-secondary">
            {t('data.npmB1')}
            <code>tarball</code>
            {t('data.npmB2')}
            <strong>{t('data.npmNotInstalls')}</strong>
            {t('data.npmB3')}
          </p>
          <p className="mt-3 mb-0 fs-xs fg-secondary">{t('data.npmC')}</p>
        </div>
      </section>

      <section className="card mb-4">
        <div className="card-body">
          <h3 className="fs-lg fw-semibold">{t('data.inclusionTitle')}</h3>
          <p className="mt-2 fg-secondary">{t('data.inclusionP')}</p>
          <ul className="mt-3 mb-0 ps-4 fg-secondary">
            <li className="mb-1">{t('data.inc1')}</li>
            <li className="mb-1">{t('data.inc2')}</li>
            <li className="mb-1">{t('data.inc3')}</li>
            <li>
              {t('data.inc4A')}{' '}
              <a className={LINK} href={UPSTREAM} target="_blank" rel="noreferrer">
                awesome-dsh-plugin<ExternalLink className="icon-trailing" aria-hidden="true" />
              </a>
              {t('data.inc4B')}
            </li>
          </ul>
          <p className="mt-3 mb-0 fs-xs fg-secondary">
            {t('data.incFootA')}<code>docs/收录规则.md</code>
            {t('data.incFootB')}<code>data/catalog/changelog.jsonl</code>
            {t('data.incFootC')}
          </p>
        </div>
      </section>

      <section className="card mb-4">
        <div className="card-body">
          <h3 className="fs-lg fw-semibold">{t('data.antiTitle')}</h3>
          <p className="mt-2 mb-0 fg-secondary">{t('data.antiBody')}</p>
        </div>
      </section>

      <section className="card">
        <div className="card-body">
          <h3 className="fs-lg fw-semibold">{t('data.failsafeTitle')}</h3>
          <p className="mt-2 fg-secondary">{t('data.failsafeBody')}</p>
          <Link to="/?board=velocity" className="btn btn-solid mt-2">
            {t('data.seeVelocity')}
          </Link>
        </div>
      </section>
    </section>
  );
}
