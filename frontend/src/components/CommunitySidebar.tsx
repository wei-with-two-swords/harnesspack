import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/useAuth';
import { CommunityAuth } from './CommunityAuth';

type AuthState = ReturnType<typeof useAuth>;

/** Persistent community right rail: account card plus the forum rules. */
export function CommunitySidebar({ auth }: { auth: AuthState }) {
  const { t } = useI18n();

  return (
    <div>
      <div className="card mb-3">
        <div className="card-body">
          <CommunityAuth {...auth} />
        </div>
      </div>
      <div className="card">
        <div className="card-body">
          <div className="fw-semibold mb-3">{t('community.rulesTitle')}</div>
          <ol className="list-unstyled mb-0">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <li key={n} className={`d-flex gap-3 py-2 fs-sm fg-secondary${n < 6 ? ' border-bottom' : ''}`}>
                <span className="flex-shrink-0 fw-semibold" style={{ color: 'var(--accent)' }}>
                  {String(n).padStart(2, '0')}
                </span>
                <span>{t(`community.rule${n}`)}</span>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </div>
  );
}
