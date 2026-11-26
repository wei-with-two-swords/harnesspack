import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Bell } from 'lucide-react';
import { api } from '../lib/api';
import { useI18n } from '../lib/i18n';
import type { AuthUser } from '../lib/useAuth';

/** Bell link with an unread badge, shown next to the sign-in card. */
export function NotificationsBell({ user }: { user: AuthUser | null }) {
  const { t } = useI18n();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!user) return;
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
  }, [user]);

  if (!user) return null;

  return (
    <Link
      to="/community/notifications"
      className="text-decoration-none d-flex align-items-center gap-2 fs-sm mb-2"
    >
      <Bell aria-hidden="true" size={15} />
      <span>{t('notif.title')}</span>
      {unread > 0 ? (
        <span className="notif-badge num" aria-label={t('notif.unread', { count: unread })}>
          {unread > 99 ? '99+' : unread}
        </span>
      ) : null}
    </Link>
  );
}
