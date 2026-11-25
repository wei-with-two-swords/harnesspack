import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/useAuth';

/** GitHub sign-in is live; commenting stays a placeholder for now. */
export default function Community() {
  const { t } = useI18n();
  const { user, oauthEnabled, signOut } = useAuth();
  return (
    <section style={{ maxWidth: '46rem' }}>
      <div className="d-flex align-items-center gap-2 mb-2">
        <h1 className="fs-3xl fw-semibold mb-0">{t('community.title')}</h1>
        <span className="badge theme-warning badge-subtle">{t('community.soon')}</span>
      </div>
      <p className="fs-sm fg-secondary mb-4">{t('community.intro')}</p>

      <div className="card mb-3">
        <div className="card-body d-flex align-items-center justify-content-between flex-wrap gap-3">
          <div>
            <div className="fw-medium mb-1 d-flex align-items-center gap-2">
              {user?.avatar_url ? (
                <img src={user.avatar_url} alt="" width="22" height="22" style={{ borderRadius: '50%' }} />
              ) : null}
              {user ? `${t('auth.signedInAs')}: ${user.login}` : t('nav.signin')}
            </div>
            <div className="fs-xs fg-secondary">{t('community.loginNote')}</div>
            <div className="fs-xs fg-secondary mt-1">
              {t('auth.anonQuota')} · {t('auth.authQuota')}
            </div>
          </div>
          {user ? (
            <button type="button" className="btn btn-outline theme-secondary" onClick={() => void signOut()}>
              {t('auth.signOut')}
            </button>
          ) : oauthEnabled ? (
            <a href="/api/auth/github" className="btn btn-outline theme-secondary">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                <path d="M8 0C3.58 0 0 3.58 0 8a8 8 0 0 0 5.47 7.59c.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82A7.4 7.4 0 0 1 8 3.75c.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8 8 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
              </svg>
              GitHub
            </a>
          ) : null}
        </div>
      </div>

      <div className="card">
        <div className="card-body">
          <div className="fs-sm fw-semibold mb-3">{t('community.title')}</div>
          <div className="form-control" style={{ minHeight: '5rem', opacity: 0.6, color: 'var(--faint)' }}>
            {t('community.intro')}
          </div>
        </div>
      </div>
    </section>
  );
}
