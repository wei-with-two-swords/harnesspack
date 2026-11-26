import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell, ChevronRight, ExternalLink } from 'lucide-react';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import { useAuth } from '../lib/useAuth';
import type { AuthUser } from '../lib/useAuth';

type AuthState = ReturnType<typeof useAuth>;

/** Unread-count link row shown inside the account card for signed-in users. */
function NotificationRow({ user }: { user: AuthUser }) {
  const { t } = useI18n();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let alive = true;
    api.community
      .unreadCount()
      .then((data) => {
        if (alive) setUnread(data.unread);
      })
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, [user.login]);

  return (
    <Link
      to="/community/notifications"
      className="community-auth-notif text-decoration-none d-flex align-items-center gap-2"
    >
      <Bell aria-hidden="true" size={15} />
      <span className="flex-grow-1">{t('notif.title')}</span>
      {unread > 0 ? (
        <span className="notif-badge num" aria-label={t('notif.unread', { count: unread })}>
          {unread > 99 ? '99+' : unread}
        </span>
      ) : null}
      <ChevronRight aria-hidden="true" size={14} className="fg-secondary" />
    </Link>
  );
}

/** Sign-in / account card shown in the community sidebar. */
export function CommunityAuth({ user, oauthEnabled, signOut }: AuthState) {
  const { t } = useI18n();

  if (!oauthEnabled) return null;

  if (user) {
    return (
      <div className="community-auth">
        <div className="d-flex align-items-center gap-2">
          {user.avatar_url ? (
            <img
              className="community-auth-avatar"
              src={user.avatar_url}
              alt=""
              width="40"
              height="40"
              loading="lazy"
            />
          ) : (
            <span className="community-auth-avatar community-auth-avatar-fallback" aria-hidden="true">
              {user.login.charAt(0).toUpperCase()}
            </span>
          )}
          <div className="flex-grow-1" style={{ minWidth: 0 }}>
            <div className="fw-medium fs-sm text-truncate">{user.name || user.login}</div>
            <div className="fs-xs fg-secondary text-truncate">@{user.login}</div>
          </div>
          <button
            type="button"
            className="btn btn-sm btn-text p-0 fs-xs fg-secondary flex-shrink-0"
            onClick={() => void signOut()}
          >
            {t('auth.signOut')}
          </button>
        </div>
        <div className="community-auth-divider" />
        <NotificationRow user={user} />
      </div>
    );
  }

  return (
    <div className="community-auth">
      <div className="fw-medium fs-sm mb-1">{t('community.signInTitle')}</div>
      <p className="fs-xs fg-secondary mb-2">{t('community.signInHint')}</p>
      <a
        href="/api/auth/github"
        className="btn btn-sm btn-outline w-100 justify-content-center"
      >
        GitHub <ExternalLink className="icon-trailing" aria-hidden="true" />
      </a>
    </div>
  );
}
