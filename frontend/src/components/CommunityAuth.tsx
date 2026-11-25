import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/useAuth';

type AuthState = ReturnType<typeof useAuth>;

/** Sign-in control kept inside the forum pages instead of the global navbar. */
export function CommunityAuth({ user, oauthEnabled, signOut }: AuthState) {
  const { t } = useI18n();

  if (!oauthEnabled) return null;

  if (user) {
    return (
      <div className="d-flex align-items-center gap-2 flex-wrap mb-3">
        {user.avatar_url ? (
          <img src={user.avatar_url} alt="" width="24" height="24" style={{ borderRadius: 'var(--radius-round)' }} />
        ) : null}
        <span className="fs-sm fg-secondary" title={`${t('auth.signedInAs')}: ${user.login}`}>
          @{user.login}
        </span>
        <button type="button" className="btn btn-sm btn-outline theme-secondary" onClick={() => void signOut()}>
          {t('auth.signOut')}
        </button>
      </div>
    );
  }

  return (
    <div className="d-flex align-items-center gap-2 flex-wrap mb-3">
      <span className="fs-sm fg-secondary">{t('community.signInHint')}</span>
      <a href="/api/auth/github" className="btn btn-sm btn-outline theme-secondary">
        {t('auth.signIn')}
      </a>
    </div>
  );
}
